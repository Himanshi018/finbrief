import Link from "next/link";
import type { Metadata } from "next";
import {
  ExampleBriefSection,
  FeaturesSection,
  HeroSection,
} from "@/components/marketing/LandingSections";
import { listArticles } from "@/services/articles.service";
import { APP_TAGLINE } from "@/lib/constants/categories";
import type { ArticleWithRelations } from "@/types/database";

export const metadata: Metadata = {
  title: "Home",
  description: APP_TAGLINE,
};

// Refresh the example brief every 10 minutes rather than on every visit
export const revalidate = 600;

export default async function HomePage() {
  let example: ArticleWithRelations | null = null;
  try {
    // listArticles only returns briefs with all AI fields, so this is a complete card
    const page = await listArticles({ limit: 1 });
    example = page.articles[0] ?? null;
  } catch (err) {
    console.error("Landing example load failed:", err);
  }

  return (
    <main className="flex-1">
      <HeroSection />
      <ExampleBriefSection article={example} />
      <FeaturesSection />
      <footer className="border-t border-slate-200/90 bg-white py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} FinBrief · {APP_TAGLINE}
          </p>
          <Link href="/feed" className="font-semibold text-emerald-800 hover:underline">
            Open feed →
          </Link>
        </div>
      </footer>
    </main>
  );
}
