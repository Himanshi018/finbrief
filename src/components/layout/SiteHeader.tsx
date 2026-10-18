"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants/categories";
import { cn } from "@/lib/utils/cn";
import { useSavedArticles } from "@/context/SavedArticlesContext";

interface SiteHeaderProps {
  className?: string;
}

const navLinkClass = (active: boolean) =>
  cn(
    "rounded-full px-3 py-2 transition duration-200 sm:px-4",
    active
      ? "bg-emerald-800 text-white"
      : "text-slate-700 hover:bg-white hover:text-emerald-900",
  );

export function SiteHeader({ className }: SiteHeaderProps) {
  const pathname = usePathname();
  const { saved } = useSavedArticles();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-slate-200/90 bg-[#f6f9f7]/92 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-sm font-bold text-white shadow-sm">
            FB
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              {APP_NAME}
            </span>
            <span className="hidden truncate text-[11px] font-medium text-slate-500 sm:block">
              {APP_TAGLINE}
            </span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 text-sm font-medium sm:gap-2">
          <Link href="/feed" className={navLinkClass(pathname === "/feed")}>
            Feed
          </Link>
          <Link href="/saved" className={navLinkClass(pathname === "/saved")}>
            <span className="inline-flex items-center">
              Saved
              {saved.length > 0 ? (
                <span
                  className={cn(
                    "ml-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    pathname === "/saved"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-100 text-emerald-800",
                  )}
                >
                  {saved.length}
                </span>
              ) : null}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
