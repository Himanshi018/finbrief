import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { APP_TAGLINE } from "@/lib/constants/categories";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/90 bg-gradient-to-b from-[#e8f2ec] via-[#f4f7f5] to-[#f4f7f5]">
      <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-teal-200/30 blur-3xl" />

      <SiteHeader className="border-transparent bg-transparent backdrop-blur-none" />

      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
        <p className="mb-3 inline-flex rounded-full border border-emerald-900/10 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-900">
          {APP_TAGLINE}
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
          Understand money and markets in minutes, not hours.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
          FinBrief curates finance-only headlines — markets, startups, fintech, and
          the global economy — and explains each story in plain language on a
          calm, mobile-first feed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/feed"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-emerald-900"
          >
            Start reading
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
          >
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}

export function FeaturesSection() {
  const items = [
    {
      title: "Finance-only feed",
      body: "Markets, startups, economy, fintech, AI business, and global finance — curated for relevance.",
    },
    {
      title: "Plain-language summaries",
      body: "Each story is condensed to about 60 words with jargon explained so you can stay informed confidently.",
    },
    {
      title: "Save on this device",
      body: "Bookmark stories locally and pick up where you left off — account sync can come later without changing the feed.",
    },
  ];

  return (
    <section id="how-it-works" className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h2 className="text-2xl font-semibold text-slate-900">Built for daily reading</h2>
      <p className="mt-2 max-w-xl text-sm text-slate-600">
        Professional, modern, and trustworthy — designed like a product you&apos;d open every morning.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition duration-200 hover:border-emerald-200/80 hover:shadow-md"
          >
            <h3 className="font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
