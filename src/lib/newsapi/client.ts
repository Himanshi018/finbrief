import type { CategorySlug } from "@/types/database";
import type { NewsApiResponse, RawNewsItem } from "@/types/news";
import {
  AI_BUSINESS_KEYWORDS,
  CATEGORY_DEFINITIONS,
  CLICKBAIT_TITLE_PATTERNS,
  EXCLUDED_DOMAINS,
  FINANCE_KEYWORDS,
  INDIA_DOMAINS,
  GEO_ECONOMIC_KEYWORDS,
  INDIA_KEYWORDS,
} from "@/lib/constants/categories";
import { extractDomain, hashString } from "@/lib/utils/cn";

const NEWS_API_BASE = "https://newsapi.org/v2";

function keywordToPattern(keyword: string): string {
  const isPrefix = keyword.endsWith("*");
  const escaped = (isPrefix ? keyword.slice(0, -1) : keyword)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  // Prefix keywords consume the rest of the word so the match reads naturally in logs
  return isPrefix ? `${escaped}\\w*` : `${escaped}\\b`;
}

// Whole-word matching so "ai" can't hit "chai" and "fed" can't hit "offered"
function keywordRegex(keywords: string[]): RegExp {
  return new RegExp(`\\b(?:${keywords.map(keywordToPattern).join("|")})`, "gi");
}

const FINANCE_PATTERN = keywordRegex(FINANCE_KEYWORDS);
const AI_BUSINESS_PATTERN = keywordRegex(AI_BUSINESS_KEYWORDS);
const INDIA_PATTERN = keywordRegex(INDIA_KEYWORDS);
const GEO_ECONOMIC_PATTERN = keywordRegex(GEO_ECONOMIC_KEYWORDS);
const AI_PATTERN = /\b(?:AI|A\.I\.|artificial intelligence|generative AI|GenAI)\b/;

function distinctMatches(pattern: RegExp, text: string): string[] {
  return [...new Set([...text.matchAll(pattern)].map((m) => m[0].toLowerCase()))];
}

function domainMatches(domain: string | null, list: string[]): boolean {
  return Boolean(domain && list.some((d) => domain === d || domain.endsWith(`.${d}`)));
}

export interface ArticleVerdict {
  accepted: boolean;
  /** Human-readable explanation, shown in `npm run ingest -- --dry-run`. */
  reason: string;
  india: boolean;
  /** Set when the story belongs in a specific category regardless of which query found it. */
  category?: CategorySlug;
}

/**
 * Decide whether a NewsAPI article belongs in FinBrief. Rules, in order:
 * 1. non-news sites and prediction/buy-sell clickbait headlines are rejected
 * 2. it needs a real finance signal: a finance keyword in the title, or two
 *    different ones in the description
 * 3. AI stories also need a business angle (funding, revenue, earnings, ...)
 */
export function evaluateArticle(
  title: string,
  description: string | null,
  domain: string | null,
): ArticleVerdict {
  const desc = description ?? "";
  const text = `${title} ${desc}`;
  const india = domainMatches(domain, INDIA_DOMAINS) || distinctMatches(INDIA_PATTERN, text).length > 0;
  const reject = (reason: string): ArticleVerdict => ({ accepted: false, reason, india });

  if (domainMatches(domain, EXCLUDED_DOMAINS)) return reject(`excluded source (${domain})`);
  const clickbait = CLICKBAIT_TITLE_PATTERNS.find((p) => p.test(title));
  if (clickbait) return reject(`clickbait title ("${title.match(clickbait)?.[0]}")`);

  const inTitle = distinctMatches(FINANCE_PATTERN, title);
  const inDesc = distinctMatches(FINANCE_PATTERN, desc).filter((m) => !inTitle.includes(m));
  if (inTitle.length === 0 && inDesc.length < 2) {
    return reject(
      inDesc.length === 0
        ? "no finance keywords"
        : `weak signal (only "${inDesc[0]}" in description)`,
    );
  }

  if (AI_PATTERN.test(text)) {
    const business = distinctMatches(AI_BUSINESS_PATTERN, text);
    if (business.length === 0) return reject("AI story without a business angle");
  }

  const evidence = [
    inTitle.length ? `title: ${inTitle.join(", ")}` : "",
    inDesc.length ? `description: ${inDesc.slice(0, 4).join(", ")}` : "",
  ].filter(Boolean);
  // Geopolitics with a market impact (sanctions, oil supply, shipping) is global finance
  const geo = distinctMatches(GEO_ECONOMIC_PATTERN, title);
  const category: CategorySlug | undefined = geo.length ? "global-finance" : undefined;
  const notes = [india ? "+India boost" : "", category ? `-> ${category} (${geo.join(", ")})` : ""].filter(Boolean);
  return {
    accepted: true,
    reason: evidence.join("; ") + (notes.length ? ` (${notes.join("; ")})` : ""),
    india,
    category,
  };
}

export interface FilterDecision {
  category: CategorySlug;
  title: string;
  source: string;
  accepted: boolean;
  reason: string;
}

type DecisionSink = (decision: FilterDecision) => void;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntity(match: string, name: string): string {
  if (name.startsWith("#")) {
    const code = Number(name.slice(1));
    return Number.isInteger(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
  }
  return HTML_ENTITIES[name.toLowerCase()] ?? match;
}

/**
 * Normalise NewsAPI text without gluing words together:
 * - tags become a space (`Near<br>$110` -> `Near $110`, not `Near$110`)
 * - non-breaking / thin / zero-width spaces become a normal space or vanish
 * - a missing space after a leading label is restored (`Analysis:Why` -> `Analysis: Why`)
 */
function cleanText(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[\s\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g, " ")
    .replace(/\[\+\d+ chars\]$/, "")
    .replace(/^([A-Z][a-z]+):(?=[A-Z])/, "$1: ")
    .trim();
  return cleaned || null;
}

export async function fetchCategoryNews(
  categorySlug: CategorySlug,
  pageSize = 20,
  onDecision?: DecisionSink,
): Promise<RawNewsItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    throw new Error("NEWS_API_KEY is not configured");
  }

  const def = CATEGORY_DEFINITIONS.find((c) => c.slug === categorySlug);
  if (!def) {
    throw new Error(`Unknown category: ${categorySlug}`);
  }

  const params = new URLSearchParams({
    q: def.newsQuery,
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(pageSize),
    // Match the query against what we filter on, not the full article body
    searchIn: "title,description",
    excludeDomains: EXCLUDED_DOMAINS.join(","),
    apiKey,
  });

  const res = await fetch(`${NEWS_API_BASE}/everything?${params.toString()}`, {
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NewsAPI error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as NewsApiResponse;
  if (data.status !== "ok") {
    throw new Error("NewsAPI returned non-ok status");
  }

  const seen = new Set<string>();
  const items: RawNewsItem[] = [];

  for (const article of data.articles) {
    if (!article.title || article.title === "[Removed]" || !article.url) continue;

    const title = cleanText(article.title);
    if (!title) continue;
    const description = cleanText(article.description);
    const sourceDomain = extractDomain(article.url);
    const verdict = evaluateArticle(title, description, sourceDomain);
    onDecision?.({
      category: categorySlug,
      title,
      source: article.source.name,
      accepted: verdict.accepted,
      reason: verdict.reason,
    });
    if (!verdict.accepted) continue;

    const externalId = hashString(article.url);
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    items.push({
      externalId,
      title,
      url: article.url,
      description,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt,
      sourceName: article.source.name,
      sourceDomain,
      categorySlug: verdict.category ?? categorySlug,
      india: verdict.india,
    });
  }

  return items;
}

/**
 * Same story syndicated under different URLs (Biztoc reposts, "- Al Jazeera"
 * suffixes): compare titles without the trailing " - Source" and punctuation.
 */
function titleKey(title: string): string {
  return title
    .replace(/\s+[-|]\s+[^-|]{2,40}$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Fetch every category. A story returned by several queries (same URL or same
 * headline) keeps the first category in CATEGORY_DEFINITIONS order.
 * `onDecision` gets exactly one final decision per article for dry-run reports.
 */
export async function fetchAllCategoryNews(onDecision?: DecisionSink): Promise<RawNewsItem[]> {
  const byUrl = new Map<string, RawNewsItem>();
  const byTitle = new Map<string, RawNewsItem>();

  for (const cat of CATEGORY_DEFINITIONS) {
    try {
      // Hold back accepts until the duplicate check below has had its say
      const accepted = new Map<string, FilterDecision>();
      const batch = await fetchCategoryNews(cat.slug, 15, (d) =>
        d.accepted ? accepted.set(d.title, d) : onDecision?.(d),
      );
      for (const item of batch) {
        const existing = byUrl.get(item.url) ?? byTitle.get(titleKey(item.title));
        if (existing) {
          onDecision?.({
            category: cat.slug,
            title: item.title,
            source: item.sourceName,
            accepted: false,
            reason:
              existing.url === item.url
                ? `duplicate (already taken by ${existing.categorySlug})`
                : `duplicate story (same headline from ${existing.sourceName}, in ${existing.categorySlug})`,
          });
          continue;
        }
        byUrl.set(item.url, item);
        byTitle.set(titleKey(item.title), item);
        const decision = accepted.get(item.title);
        if (decision) onDecision?.(decision);
      }
    } catch (err) {
      console.error(`Failed to fetch category ${cat.slug}:`, err instanceof Error ? err.message : err);
    }
  }

  return [...byUrl.values()];
}
