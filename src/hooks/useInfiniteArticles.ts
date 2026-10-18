"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CategorySlug } from "@/types/database";
import type { ArticleWithRelations } from "@/types/database";
import { fetchArticlesPage } from "@/lib/api/articles-client";

interface UseInfiniteArticlesOptions {
  category: CategorySlug | null;
  initialArticles?: ArticleWithRelations[];
  initialCursor?: string | null;
}

export function useInfiniteArticles({
  category,
  initialArticles = [],
  initialCursor = null,
}: UseInfiniteArticlesOptions) {
  const [articles, setArticles] = useState<ArticleWithRelations[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(
    initialCursor != null || initialArticles.length === 0,
  );

  // The cursor never affects rendering, so it lives in a ref only
  const loadingRef = useRef(false);
  const cursorRef = useRef<string | null>(initialCursor);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchArticlesPage({
        category,
        cursor: cursorRef.current,
      });

      setArticles((prev) => {
        const ids = new Set(prev.map((a) => a.id));
        const merged = [...prev];
        for (const article of data.articles) {
          if (!ids.has(article.id)) merged.push(article);
        }
        return merged;
      });
      cursorRef.current = data.nextCursor;
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [category, hasMore]);

  useEffect(() => {
    if (articles.length === 0 && hasMore && !loadingRef.current && !error) {
      void loadMore();
    }
  }, [articles.length, hasMore, error, loadMore]);

  const retry = useCallback(() => {
    setError(null);
    void loadMore();
  }, [loadMore]);

  return {
    articles,
    loading,
    error,
    hasMore,
    loadMore,
    retry,
  };
}
