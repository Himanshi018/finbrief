import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SaveArticleButton } from "@/components/feed/SaveArticleButton";
import { ShareButtons } from "@/components/article/ShareButtons";
import { getArticleById, listRelatedArticles } from "@/services/articles.service";
import { formatPublishedDate } from "@/lib/utils/date";
import { getSiteUrl } from "@/lib/seo/site-url";
import { APP_NAME } from "@/lib/constants/categories";
import type { KeyTerm } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return {};

  const description = article.summary ?? article.description ?? undefined;
  return {
    title: article.title,
    description,
    openGraph: {
      title: `${article.title} · ${APP_NAME}`,
      description,
      images: article.image_url ? [{ url: article.image_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) notFound();

  const related = await listRelatedArticles({
    categoryId: article.category_id,
    excludeId: article.id,
    limit: 3,
  });

  const summary =
    article.summary?.trim() ||
    article.description?.trim() ||
    "No summary available.";
  const categoryName = article.category?.name ?? "Finance";
  const sourceName = article.source?.name ?? "Source";
  const articleUrl = `${getSiteUrl()}/articles/${article.id}`;
  const keyTerms: KeyTerm[] | null = article.key_terms ?? null;

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        {/* Back */}
        <div className="pb-3 pt-5">
          <Link
            href="/feed"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-emerald-200 hover:text-emerald-800"
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Feed
          </Link>
        </div>

        {/* Hero image */}
        {article.image_url ? (
          <div className="relative mt-1 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
            <Image
              src={article.image_url}
              alt=""
              fill
              priority
              unoptimized
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 672px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
            <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-emerald-900 shadow-sm">
              {categoryName}
            </span>
          </div>
        ) : null}

        {/* Card content */}
        <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          {/* Category pill (no-image variant) */}
          {!article.image_url ? (
            <span className="mb-4 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
              {categoryName}
            </span>
          ) : null}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              {sourceName}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={article.published_at}>
              {formatPublishedDate(article.published_at)}
            </time>
          </div>

          {/* Headline */}
          <h1 className="mt-3 text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl sm:leading-tight">
            {article.title}
          </h1>

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-2">
            <SaveArticleButton article={article} />
            <ShareButtons title={article.title} url={articleUrl} />
          </div>

          <hr className="my-7 border-slate-100" />

          {/* Summary */}
          <section aria-labelledby="summary-heading">
            <h2
              id="summary-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              Summary
            </h2>
            <p className="mt-3 text-base leading-8 text-slate-700">
              {summary}
            </p>
          </section>

          {/* Why It Matters */}
          {article.why_it_matters ? (
            <>
              <hr className="my-7 border-slate-100" />
              <section aria-labelledby="why-heading">
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-emerald-50/30 p-5 sm:p-6">
                  {/* decorative circle */}
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-100/60" aria-hidden />
                  <h2
                    id="why-heading"
                    className="relative flex items-center gap-2 text-sm font-bold text-emerald-900"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-200/80 text-base shadow-sm"
                      aria-hidden
                    >
                      💡
                    </span>
                    Why It Matters
                  </h2>
                  <p className="relative mt-3 text-[0.95rem] leading-7 text-emerald-950/80 sm:leading-8">
                    {article.why_it_matters}
                  </p>
                </div>
              </section>
            </>
          ) : null}

          {/* Key Terms */}
          <hr className="my-7 border-slate-100" />
          <section aria-labelledby="terms-heading">
            <h2
              id="terms-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-slate-400"
            >
              Key Terms
            </h2>

            {keyTerms && keyTerms.length > 0 ? (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {keyTerms.map(({ term, explanation }) => (
                  <li
                    key={term}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-emerald-200/80 hover:bg-emerald-50/40"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      {term}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                      {explanation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm italic text-slate-400">
                Key terms not available for this article.
              </p>
            )}
          </section>

          <hr className="my-7 border-slate-100" />

          {/* Read full article CTA */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 text-center sm:p-6">
            <p className="mb-4 text-sm text-slate-500">
              This is an AI-generated summary. Read the complete story on{" "}
              <span className="font-semibold text-slate-700">{sourceName}</span>.
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Read full article
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-8">
            <h2
              id="related-heading"
              className="mb-4 text-base font-bold text-slate-900"
            >
              More from {categoryName}
            </h2>
            <div className="space-y-3">
              {related.map((rel) => (
                <Link
                  key={rel.id}
                  href={`/articles/${rel.id}`}
                  className="block rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition duration-200 hover:border-emerald-200/80 hover:shadow-md"
                >
                  <div className="mb-1.5 text-xs text-slate-500">
                    {rel.source?.name ?? "Source"}
                    <span aria-hidden> · </span>
                    {formatPublishedDate(rel.published_at)}
                  </div>
                  <p className="text-sm font-semibold leading-snug text-slate-900">
                    {rel.title}
                  </p>
                  {rel.summary ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                      {rel.summary}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
