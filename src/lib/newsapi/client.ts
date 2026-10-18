import type { CategorySlug } from "@/types/database";
import type { NewsApiResponse, RawNewsItem } from "@/types/news";
import { CATEGORY_DEFINITIONS, FINANCE_KEYWORDS } from "@/lib/constants/categories";
import { extractDomain, hashString } from "@/lib/utils/cn";

const NEWS_API_BASE = "https://newsapi.org/v2";

function keywordToPattern(keyword: string): string {
  const isPrefix = keyword.endsWith("*");
  const escaped = (isPrefix ? keyword.slice(0, -1) : keyword)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return isPrefix ? escaped : `${escaped}\\b`;
}

// Whole-word match so "ai" can't hit "chai" and "fed" can't hit "offered"
const FINANCE_PATTERN = new RegExp(
  `\\b(?:${FINANCE_KEYWORDS.map(keywordToPattern).join("|")})`,
  "i",
);

function isFinanceRelated(title: string, description: string | null): boolean {
  return FINANCE_PATTERN.test(`${title} ${description ?? ""}`);
}

function stripHtml(text: string | null): string | null {
  if (!text) return null;
  return text.replace(/<[^>]+>/g, "").replace(/\[\+\d+ chars\]$/, "").trim() || null;
}

export async function fetchCategoryNews(
  categorySlug: CategorySlug,
  pageSize = 20,
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

    const description = stripHtml(article.description);
    if (!isFinanceRelated(article.title, description)) continue;

    const externalId = hashString(article.url);
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    items.push({
      externalId,
      title: article.title.trim(),
      url: article.url,
      description,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt,
      sourceName: article.source.name,
      sourceDomain: extractDomain(article.url),
      categorySlug,
    });
  }

  return items;
}

export async function fetchAllCategoryNews(): Promise<RawNewsItem[]> {
  const byUrl = new Map<string, RawNewsItem>();

  for (const cat of CATEGORY_DEFINITIONS) {
    try {
      const batch = await fetchCategoryNews(cat.slug, 15);
      for (const item of batch) {
        if (!byUrl.has(item.url)) {
          byUrl.set(item.url, item);
        }
      }
    } catch (err) {
      console.error(`Failed to fetch category ${cat.slug}:`, err);
    }
  }

  return [...byUrl.values()];
}
