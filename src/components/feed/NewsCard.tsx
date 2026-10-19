"use client";

import Link from "next/link";
import { formatPublishedDate } from "@/lib/utils/date";
import {
  estimateReadingTime,
  formatReadingTime,
} from "@/lib/utils/reading-time";
import { cn } from "@/lib/utils/cn";
import type { ArticleWithRelations } from "@/types/database";
import { SaveArticleButton } from "@/components/feed/SaveArticleButton";
import { WhyItMatters } from "@/components/article/WhyItMatters";
import { KeyTermChips } from "@/components/article/KeyTermChips";
import { ArticleImage } from "@/components/article/ArticleImage";

interface NewsCardProps {
  article: ArticleWithRelations;
  className?: string;
  showRemoveSaved?: boolean;
  onRemoveSaved?: () => void;
  /** Landing-page sample: no save button, links go to the feed. */
  preview?: boolean;
}

/**
 * Inshorts-style brief: the card itself delivers the value (plain headline,
 * summary, why it matters, jargon explained) without needing a click.
 */
export function NewsCard({
  article,
  className,
  showRemoveSaved,
  onRemoveSaved,
  preview = false,
}: NewsCardProps) {
  const headline = article.simple_title?.trim() || article.title;
  const summary =
    article.summary?.trim() ||
    article.description?.trim() ||
    "Summary will appear once this article is processed.";
  const whyItMatters = article.why_it_matters?.trim();
  const keyTerms = article.key_terms ?? [];

  const categoryName = article.category?.name ?? "Finance";
  const sourceName = article.source?.name ?? "Source";
  const readingMinutes = estimateReadingTime(`${headline} ${summary} ${whyItMatters ?? ""}`);
  const href = preview ? "/feed" : `/articles/${article.id}`;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-300",
        "hover:border-emerald-200/80 hover:shadow-md",
        className,
      )}
    >
      <ArticleImage
        src={article.image_url}
        creditName={article.image_credit_name}
        creditUrl={article.image_credit_url}
        href={href}
        sizes="(max-width: 768px) 100vw, 672px"
      />

      <div className="p-4 sm:p-6">
        {/* Category + time, with save on the right */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-900">
              {categoryName}
            </span>
            <time dateTime={article.published_at}>{formatPublishedDate(article.published_at)}</time>
          </div>

          {preview ? null : showRemoveSaved ? (
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

        <Link href={href}>
          <h2 className="mt-3 text-lg font-semibold leading-snug tracking-tight text-slate-900 transition-colors hover:text-emerald-900 sm:text-xl">
            {headline}
          </h2>
        </Link>

        <p className="mt-2 text-[0.95rem] leading-7 text-slate-600">{summary}</p>

        {whyItMatters ? <WhyItMatters text={whyItMatters} className="mt-4" /> : null}

        {keyTerms.length > 0 ? <KeyTermChips terms={keyTerms} max={3} className="mt-4" /> : null}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="min-w-0 truncate text-xs text-slate-500">
            via{" "}
            {preview ? (
              <span className="font-semibold text-slate-700">{sourceName}</span>
            ) : (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Read the original on ${sourceName}`}
                className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-emerald-800 hover:decoration-emerald-400"
              >
                {sourceName}
              </a>
            )}
            <span aria-hidden> · </span>
            {formatReadingTime(readingMinutes)}
          </p>
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-emerald-800 transition-colors hover:text-emerald-950"
          >
            {preview ? "Open the feed" : "Read full brief"}
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.17 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
