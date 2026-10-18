import Link from "next/link";
import type { Metadata } from "next";
import { HeroSection, FeaturesSection } from "@/components/marketing/LandingSections";
import { APP_TAGLINE } from "@/lib/constants/categories";

export const metadata: Metadata = {
  title: "Home",
  description: APP_TAGLINE,
};

export default function HomePage() {
  return (
    <main className="flex-1">
      <HeroSection />
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
