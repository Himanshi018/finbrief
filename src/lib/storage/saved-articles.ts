import type { SavedArticleSnapshot } from "@/types/saved";

export const SAVED_ARTICLES_STORAGE_KEY = "finbrief_saved_articles_v1";

// Stable empty array so useSyncExternalStore sees an unchanged snapshot
const EMPTY: SavedArticleSnapshot[] = [];

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedValue: SavedArticleSnapshot[] = EMPTY;

function parse(raw: string | null): SavedArticleSnapshot[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedArticleSnapshot[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Client snapshot; re-parses only when the stored string changes. */
export function readSavedArticles(): SavedArticleSnapshot[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SAVED_ARTICLES_STORAGE_KEY);
  } catch {
    // Storage blocked (e.g. private mode): fall back to the in-memory copy
    return cachedValue;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

/** Server/hydration snapshot: nothing is saved until the client reads storage. */
export function readSavedArticlesOnServer(): SavedArticleSnapshot[] {
  return EMPTY;
}

export function writeSavedArticles(articles: SavedArticleSnapshot[]) {
  const raw = JSON.stringify(articles);
  cachedRaw = raw;
  cachedValue = articles;
  try {
    window.localStorage.setItem(SAVED_ARTICLES_STORAGE_KEY, raw);
  } catch {
    // Quota exceeded or storage blocked; keep the in-memory value
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSavedArticles(listener: () => void) {
  listeners.add(listener);

  // Keep other tabs in sync
  const onStorage = (event: StorageEvent) => {
    if (event.key === SAVED_ARTICLES_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
