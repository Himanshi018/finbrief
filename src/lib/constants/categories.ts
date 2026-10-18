import type { CategorySlug } from "@/types/database";

export const APP_NAME = "FinBrief";
export const APP_TAGLINE = "Finance news explained simply.";

export const CATEGORY_DEFINITIONS: {
  slug: CategorySlug;
  name: string;
  newsQuery: string;
}[] = [
  {
    slug: "markets",
    name: "Markets",
    newsQuery: "stock market OR S&P 500 OR NASDAQ OR earnings OR IPO",
  },
  {
    slug: "startups",
    name: "Startups",
    newsQuery: "startup funding OR venture capital OR unicorn startup",
  },
  {
    slug: "economy",
    name: "Economy",
    newsQuery: "inflation OR GDP OR central bank OR interest rates OR recession",
  },
  {
    slug: "fintech",
    name: "Fintech",
    newsQuery: "fintech OR digital payments OR neobank OR crypto regulation",
  },
  {
    slug: "ai-business",
    name: "AI Business",
    newsQuery: "AI business OR artificial intelligence companies OR AI investment",
  },
  {
    slug: "global-finance",
    name: "Global Finance",
    newsQuery: "global economy OR IMF OR forex OR international trade finance",
  },
];

// Matched case-insensitively as whole words (see isFinanceRelated). A trailing
// "*" also matches longer forms: "invest*" covers investor, investment, etc.
// Avoid short or everyday words ("ai", "rate", "trade", "market", "business"):
// they match unrelated stories like "chai", "pirate" or "trade punches".
export const FINANCE_KEYWORDS = [
  "stock*",
  "share price*",
  "invest*",
  "financ*",
  "bank*",
  "econom*",
  "startup*",
  "funding",
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
  "wall street",
  "treasury",
  "forex",
  "currenc*",
  "imf",
  "rbi",
  "sebi",
];

export const PAGE_SIZE = 10;
