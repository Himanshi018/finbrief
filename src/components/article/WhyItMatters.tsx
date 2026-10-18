import { cn } from "@/lib/utils/cn";

interface WhyItMattersProps {
  text: string;
  /** "card" for feed cards, "page" for the article detail page. */
  size?: "card" | "page";
  /** Heading level for the label, so it nests correctly under the page's headings. */
  as?: "h2" | "h3";
  className?: string;
}

/** FinBrief's core differentiator: the plain-language "why should I care". */
export function WhyItMatters({ text, size = "card", as: Heading = "h3", className }: WhyItMattersProps) {
  return (
    <section
      className={cn(
        "rounded-r-xl border-l-4 border-emerald-600 bg-emerald-50",
        size === "card" ? "px-4 py-3.5" : "px-5 py-5 sm:px-6",
        className,
      )}
    >
      <Heading
        className={cn(
          "flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-800",
          size === "card" ? "text-[11px]" : "text-xs",
        )}
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M10 2a6 6 0 00-3.6 10.8c.4.3.6.8.6 1.2v.5a1 1 0 001 1h4a1 1 0 001-1V14c0-.4.2-.9.6-1.2A6 6 0 0010 2zM8 17.5a1 1 0 001 1h2a1 1 0 001-1V17H8v.5z" />
        </svg>
        Why it matters
      </Heading>
      <p
        className={cn(
          "font-medium text-slate-800",
          size === "card" ? "mt-1.5 text-[0.95rem] leading-relaxed" : "mt-2 text-base leading-8",
        )}
      >
        {text}
      </p>
    </section>
  );
}
