import type { CategorySlug } from "@/types/database";
import { hashString } from "@/lib/utils/cn";

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const FETCH_TIMEOUT_MS = 10_000;
/** Results to pick from per query, so stories with the same keywords get different photos. */
const RESULTS_PER_QUERY = 15;

export interface StockPhoto {
  url: string;
  photographer: string;
  photographerUrl: string;
}

interface PexelsSearchResponse {
  photos: {
    photographer: string;
    photographer_url: string;
    src: { landscape: string; large: string };
  }[];
}

/**
 * Topic keywords checked against the headline, most specific first: the first
 * match becomes the 1-2 word search query. Pexels has no news photos, so these
 * describe the subject ("oil refinery"), not the event.
 */
const TOPIC_QUERIES: [RegExp, string][] = [
  [/\b(oil|crude|brent|opec|petrol|diesel)\b/i, "oil refinery"],
  [/\bgold\b/i, "gold bars"],
  [/\b(bitcoin|crypto\w*|ethereum)\b/i, "bitcoin"],
  [/\b(rupee|dollar|forex|currenc\w*|yen|euro)\b/i, "currency exchange"],
  [/\b(ipo|listing|listed)\b/i, "stock exchange"],
  [/\b(tariff\w*|export\w*|import\w*|shipping|tanker\w*|cargo|port|hormuz|red sea)\b/i, "cargo ship"],
  [/\b(rbi|central bank|federal reserve|fed|repo rate|interest rates?|rate (hike|cut)\w*)\b/i, "central bank"],
  [/\b(inflation|prices?)\b/i, "inflation"],
  [/\b(bank\w*|lender\w*|loan\w*|nbfc\w*|deposit\w*)\b/i, "bank building"],
  [/\b(upi|payments?|fintech\w*|wallet)\b/i, "digital payment"],
  [/\b(insur\w*)\b/i, "insurance"],
  [/\b(real estate|housing|property|realty)\b/i, "real estate"],
  [/\b(ev|electric vehicles?|battery|batteries)\b/i, "electric car"],
  [/\b(chip\w*|semiconductor\w*)\b/i, "semiconductor"],
  [/\b(ai|artificial intelligence|genai)\b/i, "artificial intelligence"],
  [/\b(budget|tax\w*|gst)\b/i, "tax documents"],
  [/\b(funding|raises?|venture|seed|series [a-e])\b/i, "startup team"],
  [/\b(sensex|nifty|stocks?|shares|market)\b/i, "stock market"],
];

const CATEGORY_QUERIES: Record<CategorySlug, string> = {
  markets: "stock market",
  startups: "startup office",
  economy: "economy money",
  fintech: "digital payment",
  "ai-business": "artificial intelligence",
  "global-finance": "global trade",
};

export function pexelsEnabled(): boolean {
  return Boolean(process.env.PEXELS_API_KEY);
}

/** 1-2 keywords from the headline's topic, else from the category. */
export function photoQuery(headline: string, category: CategorySlug): string {
  return TOPIC_QUERIES.find(([pattern]) => pattern.test(headline))?.[1] ?? CATEGORY_QUERIES[category];
}

// One search per query per process: a run asks for the same few queries many times
const searchCache = new Map<string, Promise<PexelsSearchResponse["photos"]>>();

async function search(query: string): Promise<PexelsSearchResponse["photos"]> {
  const params = new URLSearchParams({
    query,
    orientation: "landscape",
    per_page: String(RESULTS_PER_QUERY),
  });
  const res = await fetch(`${PEXELS_SEARCH_URL}?${params.toString()}`, {
    headers: { Authorization: process.env.PEXELS_API_KEY ?? "" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Pexels error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as PexelsSearchResponse).photos ?? [];
}

/**
 * A free Pexels photo for a story with no feed thumbnail and no og:image.
 * Returns null when PEXELS_API_KEY is unset, nothing matched, or the request
 * failed; the card then has no image. `seed` (the article id) picks a stable
 * photo from the results so similar stories don't all share one image.
 */
export async function findStockPhoto(
  headline: string,
  category: CategorySlug,
  seed: string,
): Promise<StockPhoto | null> {
  if (!pexelsEnabled()) return null;
  const query = photoQuery(headline, category);

  let request = searchCache.get(query);
  if (!request) {
    request = search(query);
    searchCache.set(query, request);
  }
  try {
    const photos = await request;
    if (photos.length === 0) return null;
    const index = Math.abs(Number.parseInt(hashString(seed).split("_")[1], 36)) % photos.length;
    const photo = photos[index];
    return {
      url: photo.src.landscape || photo.src.large,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
    };
  } catch (err) {
    searchCache.delete(query);
    console.error(`Pexels search "${query}" failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}
