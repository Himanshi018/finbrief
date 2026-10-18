"use client";

import { cn } from "@/lib/utils/cn";
import type { ArticleWithRelations } from "@/types/database";
import { useSavedArticles } from "@/context/SavedArticlesContext";
import { useToast } from "@/context/ToastContext";

interface SaveArticleButtonProps {
  article: ArticleWithRelations;
  className?: string;
}

export function SaveArticleButton({ article, className }: SaveArticleButtonProps) {
  const { isSaved, toggleSave } = useSavedArticles();
  const { toast } = useToast();
  const saved = isSaved(article.id);

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved" : "Save article"}
      aria-pressed={saved}
      onClick={() => {
        const nowSaved = toggleSave(article);
        toast(
          nowSaved ? "Saved to your reading list" : "Removed from saved",
          nowSaved ? "success" : "default",
        );
      }}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border transition duration-200",
        saved
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-slate-200/80 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-800",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 3H7a2 2 0 00-2 2v16l7-3.5L19 21V5a2 2 0 00-2-2z"
        />
      </svg>
    </button>
  );
}
