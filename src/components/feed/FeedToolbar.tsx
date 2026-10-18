"use client";

import { SearchBar } from "@/components/feed/SearchBar";
import { CategoryPills } from "@/components/feed/CategoryPills";
import { cn } from "@/lib/utils/cn";
import type { CategorySlug } from "@/types/database";

interface FeedToolbarProps {
  category: CategorySlug | null;
  onCategoryChange: (slug: CategorySlug | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  className?: string;
}

export function FeedToolbar({
  category,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  className,
}: FeedToolbarProps) {
  return (
    <div
      className={cn(
        "sticky top-14 z-40 -mx-4 border-b border-slate-200/80 bg-[#f6f9f7]/95 px-4 py-3 backdrop-blur-md sm:top-16 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <SearchBar value={searchQuery} onChange={onSearchChange} />
      <CategoryPills
        value={category}
        onChange={onCategoryChange}
        className="mt-3 snap-x snap-mandatory scroll-pl-4"
      />
    </div>
  );
}
