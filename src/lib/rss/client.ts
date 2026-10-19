import type { CategorySlug } from "@/types/database";
import type { RawNewsItem } from "@/types/news";
import {
  cleanText,
  collectCategoryNews,
  evaluateArticle,
  type DecisionSink,
} from "@/lib/newsapi/client";
import {
  RSS_DESCRIPTION_MAX_CHARS,
  RSS_FEEDS,
  RSS_ITEMS_PER_FEED,
  RSS_MAX_AGE_HOURS,
  type RssFeed,
} from "@/lib/rss/feeds";
import { extractDomain, hashString } from "@/lib/utils/cn";

const RSS_USER_AGENT = "FinBrief/1.0";
const FETCH_TIMEOUT_MS = 15_000;

interface RssItem {
  title: string | null;
  link: string | null;
  description: string | null;
  pubDate: string | null;
}

/** Inner text of the first <name>...</name>, with CDATA unwrapped. */
function readTag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return null;
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() || null;
}

/** RSS 2.0 <item>s (all the configured feeds are RSS 2.0). */
function parseItems(xml: string): RssItem[] {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(([, body]) => ({
    title: readTag(body, "title"),
    link: readTag(body, "link") ?? readTag(body, "guid"),
    description: readTag(body, "description"),
    pubDate: readTag(body, "pubDate"),
  }));
}

/** First sentences up to `max` chars, cut on a word boundary: a teaser, not the article. */
function shorten(text: string | null, max: number): string | null {
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentenceEnd = cut.lastIndexOf(". ");
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:.-]+$/, "")}…`;
}

async function fetchFeed(feed: RssFeed): Promise<RssItem[]> {
  const res = await fetch(feed.url, {
    headers: {
      "User-Agent": RSS_USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const items = parseItems(await res.text());
  if (items.length === 0) throw new Error("no <item> elements (feed moved or blocked?)");
  return items.slice(0, RSS_ITEMS_PER_FEED);
}

/**
 * One category's RSS feeds, mapped to the same RawNewsItem shape and run
 * through the same evaluateArticle filter as NewsAPI. Only the title, a short
 * description, the source name and the link are kept (plus the publish time
 * for ordering); no images and never the article body.
 */
export async function fetchCategoryRss(
  categorySlug: CategorySlug,
  onDecision?: DecisionSink,
): Promise<RawNewsItem[]> {
  const feeds = RSS_FEEDS.filter((f) => f.category === categorySlug);
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const minTime = Date.now() - RSS_MAX_AGE_HOURS * 3_600_000;

  const seen = new Set<string>();
  const items: RawNewsItem[] = [];

  results.forEach((result, i) => {
    const feed = feeds[i];
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : result.reason;
      console.error(`Failed to fetch RSS feed ${feed.url}:`, reason);
      return;
    }

    for (const entry of result.value) {
      const title = cleanText(entry.title);
      const url = cleanText(entry.link);
      if (!title || !url || !/^https?:\/\//.test(url)) continue;

      // Second pass: some feeds entity-escape their HTML, so tags only appear after decoding
      const description = shorten(cleanText(cleanText(entry.description)), RSS_DESCRIPTION_MAX_CHARS);
      const sourceDomain = extractDomain(url);
      const published = entry.pubDate ? new Date(entry.pubDate) : null;
      const decide = (accepted: boolean, reason: string) =>
        onDecision?.({ category: categorySlug, title, source: feed.sourceName, accepted, reason });

      if (!published || Number.isNaN(published.getTime())) {
        decide(false, "no valid publish date");
        continue;
      }
      if (published.getTime() < minTime) {
        decide(false, `stale (published ${published.toISOString().slice(0, 10)})`);
        continue;
      }

      const verdict = evaluateArticle(title, description, sourceDomain);
      decide(verdict.accepted, verdict.reason);
      if (!verdict.accepted) continue;

      const externalId = hashString(url);
      if (seen.has(externalId)) continue;
      seen.add(externalId);

      items.push({
        externalId,
        title,
        url,
        description,
        imageUrl: null,
        publishedAt: published.toISOString(),
        sourceName: feed.sourceName,
        sourceDomain,
        categorySlug: verdict.category ?? categorySlug,
        india: verdict.india,
      });
    }
  });

  return items;
}

/** RSS ingestion entry point (NEWS_SOURCE=rss, the default). */
export function fetchAllRssNews(onDecision?: DecisionSink): Promise<RawNewsItem[]> {
  return collectCategoryNews(fetchCategoryRss, onDecision);
}
