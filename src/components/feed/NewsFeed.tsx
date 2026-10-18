"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { CategorySlug } from "@/types/database";
import type { ArticleWithRelations } from "@/types/database";
import { FeedToolbar } from "@/components/feed/FeedToolbar";
import { ArticleList } from "@/components/feed/ArticleList";
import { SkeletonCard } from "@/components/feed/SkeletonCard";
import { EmptyState } from "@/components/feed/EmptyState";
import { ErrorState } from "@/components/feed/ErrorState";
import { useInfiniteArticles } from "@/hooks/useInfiniteArticles";
import { useIntersectionLoad } from "@/hooks/useIntersectionLoad";
import { filterArticlesByQuery } from "@/lib/feed/filter-articles";
import { cn } from "@/lib/utils/cn";

interface NewsFeedPanelProps {
  category: CategorySlug | null;
  searchQuery: string;
  initialArticles: ArticleWithRelations[];
  initialCursor: string | null;
}

const NewsFeedPanel = memo(function NewsFeedPanel({
  category,
  searchQuery,
  initialArticles,
  initialCursor,
}: NewsFeedPanelProps) {
  const { articles, loading, error, hasMore, loadMore, retry } = useInfiniteArticles({
    category,
    initialArticles,
    initialCursor,
  });

  const filteredArticles = useMemo(
    () => filterArticlesByQuery(articles, searchQuery),
    [articles, searchQuery],
  );

  const handleIntersect = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const sentinelRef = useIntersectionLoad({
    onIntersect: handleIntersect,
    enabled: hasMore && !loading && !error,
  });

  const showInitialSkeleton = articles.length === 0 && loading && !error;
  const showEmptyFeed = articles.length === 0 && !loading && !error;
  const showNoSearchResults =
    !showEmptyFeed && searchQuery.trim().length > 0 && filteredArticles.length === 0;

  return (
    <div
      className={cn(
        "animate-[feed-in_0.35s_ease-out]",
        "space-y-5 pt-4",
      )}
    >
      {error ? <ErrorState message={error} onRetry={retry} /> : null}

      {showEmptyFeed ? (
        <EmptyState />
      ) : null}

      {showNoSearchResults ? (
        <EmptyState
          title="No matches in your feed"
          description="Try a different keyword, pick another category, or scroll to load more stories."
        />
      ) : null}

      {!showEmptyFeed && !showNoSearchResults && filteredArticles.length > 0 ? (
        <ArticleList articles={filteredArticles} />
      ) : null}

      {searchQuery.trim() && hasMore && !showEmptyFeed ? (
        <p className="text-center text-xs text-slate-500">
          Search filters loaded stories. Scroll to load more, then search again.
        </p>
      ) : null}

      {showInitialSkeleton ? (
        <div className="space-y-5">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {loading && articles.length > 0 ? <SkeletonCard compact /> : null}

      <div ref={sentinelRef} className="h-6" aria-hidden />
    </div>
  );
});

interface NewsFeedProps {
  initialArticles: ArticleWithRelations[];
  initialCursor: string | null;
}

export function NewsFeed({ initialArticles, initialCursor }: NewsFeedProps) {
  const [category, setCategory] = useState<CategorySlug | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  return (
    <div className="space-y-1">
      <FeedToolbar
        category={category}
        onCategoryChange={setCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <NewsFeedPanel
        key={category ?? "all"}
        category={category}
        searchQuery={searchQuery}
        initialArticles={category === null ? initialArticles : []}
        initialCursor={category === null ? initialCursor : null}
      />
    </div>
  );
}
