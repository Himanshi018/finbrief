import type { CategorySlug } from "@/types/database";

export const APP_NAME = "FinBrief";
export const APP_TAGLINE = "Finance news explained simply.";
/** Feedback form opened from the header and article pages; links are hidden when unset. */
export const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim() || null;

// NewsAPI query syntax: quoted phrases, AND / OR, parentheses; 500 chars max.
// Indian terms are included so India coverage shows up in every relevant category.
export const CATEGORY_DEFINITIONS: {
  slug: CategorySlug;
  name: string;
  newsQuery: string;
}[] = [
  {
    slug: "markets",
    name: "Markets",
    newsQuery: '"stock market" OR "S&P 500" OR Nasdaq OR earnings OR IPO OR Sensex OR Nifty OR SEBI',
  },
  {
    slug: "startups",
    name: "Startups",
    newsQuery: '"startup funding" OR "venture capital" OR "funding round" OR unicorn OR "Indian startup"',
  },
  {
    slug: "economy",
    name: "Economy",
    newsQuery: 'inflation OR GDP OR "central bank" OR "interest rates" OR recession OR RBI OR "Union Budget" OR rupee',
  },
  {
    slug: "fintech",
    name: "Fintech",
    newsQuery: 'fintech OR "digital payments" OR neobank OR UPI OR "crypto regulation"',
  },
  {
    slug: "ai-business",
    name: "AI Business",
    newsQuery: '(AI OR "artificial intelligence") AND (funding OR revenue OR valuation OR IPO OR earnings OR acquisition)',
  },
  {
    slug: "global-finance",
    name: "Global Finance",
    newsQuery:
      '"global economy" OR "world economy" OR "Federal Reserve" OR "global markets" OR "oil prices" OR "oil supply" OR "trade war" OR tariffs OR sanctions OR "Strait of Hormuz" OR "Red Sea shipping" OR IMF OR "World Bank" OR forex',
  },
];

/**
 * Passed to NewsAPI as excludeDomains, and checked again in evaluateArticle.
 * 247wallst.com is deliberately NOT here: it also publishes real news
 * (mortgage rates, bank moves), so its stories are judged on the headline
 * (CLICKBAIT_TITLE_PATTERNS) and the AI gate like any other publisher.
 */
export const EXCLUDED_DOMAINS = [
  // Stock-pick publishers: almost all stock tips, which FinBrief doesn't cover
  "fool.com",
  "investorplace.com",
  "zacks.com",
  "simplywall.st",
  "marketbeat.com",
  "insidermonkey.com",
  "seekingalpha.com",
  // Package registries, code hosts and deal/release sites that NewsAPI indexes
  "pypi.org",
  "github.com",
  "npmjs.com",
  "rlsbb.cc",
  "hip2save.com",
];

/**
 * Stock-prediction and buy/sell clickbait. FinBrief explains the news; it is
 * not a stock-tips app. Checked against the title only.
 */
export const CLICKBAIT_TITLE_PATTERNS: RegExp[] = [
  /\bpull the trigger\b/i,
  /^prediction:/i,
  /\bcould (go|be worth|soar|surge|double|triple|skyrocket|surprise|make you|turn)\b/i,
  /\b(stock|shares)\b.*\bby 20[3-9]\d\b/i,
  /\bhere.?s (where|why|what|how)\b.*\b(stock|shares|investors?|portfolio)\b/i,
  /\b(should (you|investors)|time to|is it time to|too late to) (buy|sell|subscribe|invest|own|hold)\b/i,
  /\b(buy|sell) (on|the) (the )?dip\b/i,
  /\bunstoppable\b/i,
  // "This mRNA Stock Is...", "Into This Stock": the publisher won't name it in the headline
  /\bthis\s+(?:[\w-]+\s+){0,3}(stock|etf|dividend)\b/i,
  // Listicles: "3 Growth Stocks With...", "...and 2 Other Penny Stocks". Anchored so
  // ordinary reporting like "Sensex falls 500 points as bank shares slide" passes.
  /^\d+\s+(?:[\w-]+\s+){0,3}(stocks|etfs)\b/i,
  /\band \d+ (more|other)\b.*\b(stocks|etfs)\b/i,
  // Ticker in the headline, e.g. "Shikoku Bank (TSE:8387)": screener-generated posts
  /\((?:NYSE|NASDAQ|Nasdaq\w*|TSE|TSX|LSE|ASX|SGX|SEHK|HKEX|KRX|NSE|BSE):\s?[\w.]+\)/,
  /\binvestment (narrative|thesis|case)\b/i,
  // Screener / stock-picking formats ("History Says Patient Investors Get Rewarded")
  /\bhistory says\b/i,
  /\bpatient investors\b/i,
  /\bhow investors are reacting to\b/i,
  /\bstock fair value\b/i,
  /\bfair value (estimate|edges|moves|rises|falls|cut|lifted)\b/i,
  /\b(buy|sell),? (or|and) hold\b/i,
  /\bis .{1,40} a (buy|sell)\b/i,
  /\bbetter (buy|stock)\b/i,
  /\b(stocks?|shares) to (buy|own|watch|hold|avoid)\b/i,
  /\bbuy (now|today|before|and hold)\b/i,
  /\b(top|best) \d* ?(stocks?|dividend stocks?|shares)\b/i,
  /\b(millionaire|get rich|passive income|retire (early|rich))\b/i,
  /\b(no-brainer|screaming buy|fully priced)\b/i,
  /\bdividend dollars\b/i,
  // Indian stock-tip formats ("Small-cap stock under ₹50 with a dividend...", "Multibagger
  // penny stock..."). "small-cap stock" is singular only: "Small-cap stocks slump 3%" is market news.
  /\b(stocks?|shares) (under|below) (₹|rs\.?\s?|inr\s?|\$)\s?\d/i,
  /\bmultibaggers?\b/i,
  /\bpenny stocks?\b/i,
  /\b(small|mid|micro)[- ]?cap stock\b/i,
];

/** "AI" alone isn't finance news; it needs one of these alongside it. */
export const AI_BUSINESS_KEYWORDS = [
  "funding",
  "fundrais*",
  "revenue*",
  "valuation*",
  "ipo*",
  "earnings",
  "acquisition*",
  "acquire*",
  "merger*",
  "invest*",
  "profit*",
  "series a",
  "series b",
  "series c",
];

/**
 * Geopolitics with a direct market or economic impact (oil supply, shipping
 * routes, sanctions, trade, tariffs). A finance story whose headline matches
 * goes to global-finance, whichever category's query returned it.
 */
export const GEO_ECONOMIC_KEYWORDS = [
  "sanction*",
  "embargo*",
  "tariff*",
  "trade war*",
  "trade deal*",
  "oil supply",
  "oil price*",
  "crude oil",
  "opec",
  "tanker*",
  "shipping route*",
  "shipping lane*",
  "strait of hormuz",
  "hormuz",
  "red sea",
  "suez canal",
];

/** India-relevant coverage gets ranked ahead of equally fresh stories. */
export const INDIA_KEYWORDS = [
  // Not "india*": that would also match "Indiana"
  "india",
  "indian",
  "indians",
  "rbi",
  "reserve bank of india",
  "sebi",
  "sensex",
  "nifty",
  "rupee*",
  "union budget",
  "upi",
  "bse",
  "nse",
  "crore*",
  "lakh",
];
export const INDIA_DOMAINS = [
  "economictimes.indiatimes.com",
  "timesofindia.indiatimes.com",
  "livemint.com",
  "business-standard.com",
  "moneycontrol.com",
  "thehindubusinessline.com",
  "financialexpress.com",
  "thehindu.com",
  "hindustantimes.com",
  "ndtvprofit.com",
  "inc42.com",
  "yourstory.com",
  "entrackr.com",
];
/** How much fresher an India-relevant story counts as when picking a batch. */
export const INDIA_BOOST_HOURS = 12;

// Matched case-insensitively as whole words (see evaluateArticle). A trailing
// "*" also matches longer forms: "invest*" covers investor, investment, etc.
// Avoid short or everyday words ("ai", "rate", "trade", "market", "business"):
// they match unrelated stories like "chai", "pirate" or "trade punches".
// An article needs one of these in its title, or two different ones in its
// description: a single passing mention ("won't cover inflation") isn't enough.
export const FINANCE_KEYWORDS = [
  "stock",
  "stocks",
  "stock market*",
  "stock exchange*",
  "share price*",
  "shares",
  "global markets",
  "world economy",
  "world bank",
  "oil price*",
  "oil supply",
  "real estate",
  "property market*",
  "housing market*",
  "home prices",
  "home sales",
  "sanction*",
  "embargo*",
  "tanker*",
  "shipping route*",
  "shipping lane*",
  "strait of hormuz",
  "red sea",
  "suez canal",
  "supply chain*",
  "crude oil",
  "opec",
  "bond yield*",
  "funding round*",
  "rupee*",
  "union budget",
  "upi",
  "invest*",
  "financ*",
  "bank*",
  "econom*",
  "startup*",
  "fundrais*",
  "venture capital",
  "valuation*",
  "ipo*",
  "earnings",
  "inflation",
  "interest rate*",
  "mortgage*",
  "loan*",
  "lender*",
  "lending",
  "fed",
  "federal reserve",
  "crypto*",
  "bitcoin",
  "ethereum",
  "fintech*",
  "payments",
  "revenue*",
  "profit*",
  "trade war*",
  "trade deal*",
  "trade deficit*",
  "tariff*",
  "exports",
  "bond",
  "bonds",
  "equity",
  "equities",
  "nasdaq",
  "dow jones",
  "s&p",
  "sensex",
  "nifty",
  "gdp",
  "recession*",
  "fiscal",
  "monetary",
  "merger*",
  "acquisition*",
  "dividend*",
  "buyback*",
  "repurchase*",
  "wall street",
  "treasury",
  "forex",
  "currenc*",
  "imf",
  "rbi",
  "sebi",
];

export const PAGE_SIZE = 10;
