import type { CategorySlug } from "@/types/database";

export interface RssFeed {
  url: string;
  /** Publisher name shown on cards and the detail page. */
  sourceName: string;
  /** Starting category; evaluateArticle can still move a story (e.g. to global-finance). */
  category: CategorySlug;
}

/**
 * Indian finance RSS feeds used when NEWS_SOURCE=rss (the default).
 * Checked 2026-10-19: all return fresh items. Left out on purpose: Moneycontrol
 * (its /rss/*.xml feeds still respond but stopped updating in April 2024) and
 * Business Standard (403 unless the request pretends to be a browser).
 */
export const RSS_FEEDS: RssFeed[] = [
  // markets
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", sourceName: "The Economic Times", category: "markets" },
  { url: "https://www.livemint.com/rss/markets", sourceName: "Livemint", category: "markets" },
  // startups
  { url: "https://economictimes.indiatimes.com/tech/startups/rssfeeds/78570540.cms", sourceName: "The Economic Times", category: "startups" },
  { url: "https://economictimes.indiatimes.com/tech/funding/rssfeeds/78570550.cms", sourceName: "The Economic Times", category: "startups" },
  // economy
  { url: "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms", sourceName: "The Economic Times", category: "economy" },
  { url: "https://www.livemint.com/rss/economy", sourceName: "Livemint", category: "economy" },
  // fintech (banking, payments, NBFCs)
  { url: "https://economictimes.indiatimes.com/industry/banking/finance/rssfeeds/13358259.cms", sourceName: "The Economic Times", category: "fintech" },
  // ai-business
  { url: "https://economictimes.indiatimes.com/tech/artificial-intelligence/rssfeeds/110870909.cms", sourceName: "The Economic Times", category: "ai-business" },
  { url: "https://www.livemint.com/rss/AI", sourceName: "Livemint", category: "ai-business" },
  // global-finance
  { url: "https://economictimes.indiatimes.com/news/international/rssfeeds/858478126.cms", sourceName: "The Economic Times", category: "global-finance" },
  // Oil, gold and OPEC: global prices driven by sanctions and supply
  { url: "https://economictimes.indiatimes.com/markets/commodities/rssfeeds/1808152121.cms", sourceName: "The Economic Times", category: "global-finance" },
];

/** Newest items taken from each feed per run (feeds list 35-50, newest first). */
export const RSS_ITEMS_PER_FEED = 20;
/** Older items are skipped, so a feed that stops updating can't flood the feed with old news. */
export const RSS_MAX_AGE_HOURS = 72;
/** Stored descriptions are cut to this length: a teaser, never the article body. */
export const RSS_DESCRIPTION_MAX_CHARS = 280;
