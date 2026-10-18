"use client";

import { memo, useCallback } from "react";
import type { ArticleWithRelations } from "@/types/database";
import { NewsCard } from "@/components/feed/NewsCard";

interface ArticleListProps {
  articles: ArticleWithRelations[];
}

function ArticleListInner({ articles }: ArticleListProps) {
  return (
    <div className="space-y-5">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}

export const ArticleList = memo(ArticleListInner);

interface SavedArticleListProps {
  articles: ArticleWithRelations[];
  onRemove: (id: string) => void;
}

function SavedArticleListInner({ articles, onRemove }: SavedArticleListProps) {
  const handleRemove = useCallback(
    (id: string) => {
      onRemove(id);
    },
    [onRemove],
  );

  return (
    <div className="space-y-5">
      {articles.map((article) => (
        <NewsCard
          key={article.id}
          article={article}
          showRemoveSaved
          onRemoveSaved={() => handleRemove(article.id)}
        />
      ))}
    </div>
  );
}

export const SavedArticleList = memo(SavedArticleListInner);
