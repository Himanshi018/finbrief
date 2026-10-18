"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPublishedDate } from "@/lib/utils/date";
import {
  estimateReadingTime,
  formatReadingTime,
} from "@/lib/utils/reading-time";
import { cn } from "@/lib/utils/cn";
import type { ArticleWithRelations } from "@/types/database";
import { SaveArticleButton } from "@/components/feed/SaveArticleButton";

interface NewsCardProps {
  article: ArticleWithRelations;
  className?: string;
  showRemoveSaved?: boolean;
  onRemoveSaved?: () => void;
}

export function NewsCard({
  article,
  className,
  showRemoveSaved,
  onRemoveSaved,
}: NewsCardProps) {
  const summary =
    article.summary?.trim() ||
    article.description?.trim() ||
    "Summary will appear once this article is processed.";

  const categoryName = article.category?.name ?? "Finance";
  const sourceName = article.source?.name ?? "Source";
  const readingMinutes = estimateReadingTime(`${article.title} ${summary}`);

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-300",
        "hover:-translate-y-0.5 hover:border-emerald-200/80 hover:shadow-md",
        className,
      )}
    >
      {article.image_url ? (
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-slate-100 sm:aspect-[16/9]">
          <Image
            src={article.image_url}
            alt=""
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
            sizes="(max-width: 768px) 100vw, 672px"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-emerald-900 shadow-sm">
            {categoryName}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3 sm:px-6">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
            {categoryName}
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                {sourceName}
              </span>
              <span aria-hidden>·</span>
              <time dateTime={article.published_at}>{formatPublishedDate(article.published_at)}</time>
              <span aria-hidden>·</span>
              <span>{formatReadingTime(readingMinutes)}</span>
            </div>

            <Link href={`/articles/${article.id}`}>
              <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-slate-900 transition-colors hover:text-emerald-900 sm:text-[1.35rem] sm:leading-tight">
                {article.title}
              </h2>
            </Link>
          </div>

          {showRemoveSaved ? (
            <button
              type="button"
              onClick={onRemoveSaved}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              Remove
            </button>
          ) : (
            <SaveArticleButton article={article} className="shrink-0" />
          )}
        </div>

        <p className="mt-4 text-[0.95rem] leading-7 text-slate-700 sm:text-base sm:leading-8">
          {summary}
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-emerald-900 sm:w-auto"
          >
            Read original
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
          <p className="text-center text-xs text-slate-500 sm:text-left">
            Opens in a new tab · {sourceName}
          </p>
        </div>
      </div>
    </article>
  );
}
