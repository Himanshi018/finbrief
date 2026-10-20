import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SaveArticleButton } from "@/components/feed/SaveArticleButton";
import { ShareButtons } from "@/components/article/ShareButtons";
import { WhyItMatters } from "@/components/article/WhyItMatters";
import { ArticleImage } from "@/components/article/ArticleImage";
import { getArticleById, listRelatedArticles } from "@/services/articles.service";
import { formatPublishedDate } from "@/lib/utils/date";
import { getSiteUrl } from "@/lib/seo/site-url";
import { APP_NAME, FEEDBACK_URL } from "@/lib/constants/categories";
import { extractDomain } from "@/lib/utils/cn";
import type { KeyTerm } from "@/types/database";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return {};

  const title = article.simple_title?.trim() || article.title;
  const description = article.summary ?? article.description ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title: `${title} · ${APP_NAME}`,
      description,
      type: "article",
      url: `/articles/${article.id}`,
      siteName: APP_NAME,
      publishedTime: article.published_at,
      images: article.image_url ? [{ url: article.image_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
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
  const headline = article.simple_title?.trim() || article.title;
  const hasSimpleTitle = headline !== article.title;
  const categoryName = article.category?.name ?? "Finance";
  const sourceName = article.source?.name ?? "Source";
  const sourceDomain = extractDomain(article.url);
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

        {/* Hero photo (feed thumbnail, og:image or Pexels); hidden when there is none */}
        <ArticleImage
          src={article.image_url}
          creditName={article.image_credit_name}
          creditUrl={article.image_credit_url}
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="mb-5 mt-1 rounded-2xl shadow-sm"
        />

        {/* Card content */}
        <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
          <span className="mb-4 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
            {categoryName}
          </span>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Read the original on ${sourceName}`}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-emerald-800 hover:decoration-emerald-400"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              {sourceName}
              <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden>
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
            <span aria-hidden>·</span>
            <time dateTime={article.published_at}>
              {formatPublishedDate(article.published_at)}
            </time>
          </div>

          {/* Headline */}
          <h1 className="mt-3 text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl sm:leading-tight">
            {headline}
          </h1>

          {/* The publisher's own headline, for transparency */}
          {hasSimpleTitle ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-600">Original headline:</span>{" "}
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-slate-300 underline-offset-2 transition-colors hover:text-emerald-800 hover:decoration-emerald-400"
              >
                {article.title}
              </a>{" "}
              <span className="whitespace-nowrap">({sourceName})</span>
            </p>
          ) : null}

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-2">
            <SaveArticleButton article={article} />
            <ShareButtons title={headline} url={articleUrl} />
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

          {/* Why It Matters: directly after the summary, same block as the feed card */}
          {article.why_it_matters ? (
            <WhyItMatters text={article.why_it_matters} size="page" as="h2" className="mt-6" />
          ) : null}

          {/* Terms explained */}
          {keyTerms && keyTerms.length > 0 ? (
            <>
              <hr className="my-7 border-slate-100" />
              <section aria-labelledby="terms-heading">
                <h2 id="terms-heading" className="text-base font-bold text-slate-900">
                  Terms explained
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  The jargon in this story, in plain English.
                </p>
                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {keyTerms.map(({ term, explanation }) => (
                    <div
                      key={term}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <dt className="text-sm font-bold text-emerald-800">{term}</dt>
                      <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {explanation}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </>
          ) : null}

          <hr className="my-7 border-slate-100" />

          {/* Original source: FinBrief stores only the headline, a short teaser, the thumbnail URL and this link */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 text-center sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Original source
            </p>
            <p className="mt-2 text-base font-semibold text-slate-800">{sourceName}</p>
            {sourceDomain ? <p className="text-xs text-slate-500">{sourceDomain}</p> : null}
            <p className="mb-4 mt-3 text-sm text-slate-500">
              The summary above is AI-generated from the headline and teaser. The full story is
              published by <span className="font-semibold text-slate-700">{sourceName}</span>.
            </p>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Read full article on {sourceName}
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
                    {rel.simple_title?.trim() || rel.title}
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

        {FEEDBACK_URL ? (
          <p className="mt-10 text-center text-sm text-slate-500">
            Spotted a mistake or have an idea?{" "}
            <a
              href={FEEDBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:decoration-emerald-600"
            >
              Send feedback
            </a>
          </p>
        ) : null}
      </div>
    </main>
  );
}
