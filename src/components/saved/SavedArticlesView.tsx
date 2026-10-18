"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SavedArticleList } from "@/components/feed/ArticleList";
import { EmptyState } from "@/components/feed/EmptyState";
import { useSavedArticles } from "@/context/SavedArticlesContext";
import { useToast } from "@/context/ToastContext";
import { snapshotToArticle } from "@/types/saved";

export function SavedArticlesView() {
  const { saved, removeSaved } = useSavedArticles();
  const { toast } = useToast();

  const articles = useMemo(() => saved.map(snapshotToArticle), [saved]);

  const handleRemove = useCallback(
    (id: string) => {
      removeSaved(id);
      toast("Removed from saved", "default");
    },
    [removeSaved, toast],
  );

  return (
    <main className="min-h-screen flex-1">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Saved for later
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Articles you bookmark on this device. Sign-in sync comes later.
          </p>
        </header>

        {articles.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Tap the bookmark icon on any story in your feed to build a personal reading list."
            action={
              <Link
                href="/feed"
                className="inline-flex rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                Browse the feed
              </Link>
            }
          />
        ) : (
          <SavedArticleList articles={articles} onRemove={handleRemove} />
        )}
      </div>
    </main>
  );
}
