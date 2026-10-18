import { cn } from "@/lib/utils/cn";
import type { CategorySlug } from "@/types/database";
import { CATEGORY_DEFINITIONS } from "@/lib/constants/categories";

interface CategoryPillsProps {
  value: CategorySlug | null;
  onChange: (slug: CategorySlug | null) => void;
  className?: string;
}

export function CategoryPills({ value, onChange, className }: CategoryPillsProps) {
  return (
    <div
      role="tablist"
      aria-label="News categories"
      className={cn(
        "flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "snap-start shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
          value === null
            ? "bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-800/20"
            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
        )}
      >
        All
      </button>
      {CATEGORY_DEFINITIONS.map((cat) => (
        <button
          key={cat.slug}
          type="button"
          role="tab"
          aria-selected={value === cat.slug}
          onClick={() => onChange(cat.slug)}
          className={cn(
            "snap-start shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
            value === cat.slug
              ? "bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-800/20"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300",
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
