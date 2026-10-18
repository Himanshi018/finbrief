"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ArticleWithRelations } from "@/types/database";
import {
  articleToSnapshot,
  type SavedArticleSnapshot,
} from "@/types/saved";
import {
  readSavedArticles,
  readSavedArticlesOnServer,
  subscribeSavedArticles,
  writeSavedArticles,
} from "@/lib/storage/saved-articles";

interface SavedArticlesContextValue {
  saved: SavedArticleSnapshot[];
  isSaved: (id: string) => boolean;
  toggleSave: (article: ArticleWithRelations) => boolean;
  removeSaved: (id: string) => void;
}

const SavedArticlesContext = createContext<SavedArticlesContextValue | null>(null);

export function SavedArticlesProvider({ children }: { children: ReactNode }) {
  // localStorage is the source of truth; the server snapshot is empty so
  // hydration matches, then React re-renders with the stored list.
  const saved = useSyncExternalStore(
    subscribeSavedArticles,
    readSavedArticles,
    readSavedArticlesOnServer,
  );

  const isSaved = useCallback(
    (id: string) => saved.some((item) => item.id === id),
    [saved],
  );

  // Read the store directly so rapid clicks never act on a stale render
  const toggleSave = useCallback((article: ArticleWithRelations) => {
    const current = readSavedArticles();
    const exists = current.some((item) => item.id === article.id);
    const without = current.filter((item) => item.id !== article.id);
    writeSavedArticles(exists ? without : [articleToSnapshot(article), ...without]);
    return !exists;
  }, []);

  const removeSaved = useCallback((id: string) => {
    writeSavedArticles(readSavedArticles().filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({ saved, isSaved, toggleSave, removeSaved }),
    [saved, isSaved, toggleSave, removeSaved],
  );

  return (
    <SavedArticlesContext.Provider value={value}>
      {children}
    </SavedArticlesContext.Provider>
  );
}

export function useSavedArticles() {
  const ctx = useContext(SavedArticlesContext);
  if (!ctx) {
    throw new Error("useSavedArticles must be used within SavedArticlesProvider");
  }
  return ctx;
}
