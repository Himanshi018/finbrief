import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { NewsFeed } from "@/components/feed/NewsFeed";
import { listArticles } from "@/services/articles.service";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants/categories";

export const metadata: Metadata = {
  title: "Feed",
  description: `Today's finance brief — AI summaries of markets, startups, and the economy. ${APP_TAGLINE}`,
  openGraph: {
    title: "Today's finance brief",
    description: `Scroll FinBrief for quick, beginner-friendly finance stories. ${APP_TAGLINE}`,
    type: "website",
    url: "/feed",
    siteName: APP_NAME,
  },
};

export default async function FeedPage() {
  let initialArticles: Awaited<ReturnType<typeof listArticles>>["articles"] = [];
  let initialCursor: string | null = null;

  try {
    const page = await listArticles({ limit: 10 });
    initialArticles = page.articles;
    initialCursor = page.nextCursor;
  } catch (err) {
    console.error("Feed SSR load failed:", err);
  }

  return (
    <main className="min-h-screen flex-1">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <header className="pb-2 pt-6 sm:pt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Today&apos;s brief
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
            {APP_TAGLINE} Scroll for summaries you can read in under a minute.
          </p>
        </header>
        <NewsFeed initialArticles={initialArticles} initialCursor={initialCursor} />
      </div>
    </main>
  );
}
