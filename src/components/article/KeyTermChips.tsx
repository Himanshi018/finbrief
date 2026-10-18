"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { KeyTerm } from "@/types/database";

interface KeyTermChipsProps {
  terms: KeyTerm[];
  /** How many chips to show; the detail page lists every term separately. */
  max?: number;
  className?: string;
}

/** Jargon as tappable chips; tapping one expands its plain-English explanation inline. */
export function KeyTermChips({ terms, max = 3, className }: KeyTermChipsProps) {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();
  const shown = terms.slice(0, max);
  if (shown.length === 0) return null;

  const panelId = `${baseId}-explanation`;
  const active = open === null ? null : shown[open];

  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Terms in this story
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {shown.map((t, i) => {
          const selected = open === i;
          return (
            <button
              key={t.term}
              type="button"
              aria-expanded={selected}
              aria-controls={panelId}
              onClick={() => setOpen(selected ? null : i)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                selected
                  ? "border-emerald-800 bg-emerald-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-900",
              )}
            >
              {t.term}
              <svg
                viewBox="0 0 20 20"
                className={cn("h-3 w-3 transition-transform", selected && "rotate-180")}
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          );
        })}
      </div>
      <div id={panelId} role="region" aria-live="polite">
        {active ? (
          <p className="mt-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">
            <span className="font-semibold text-slate-900">{active.term}:</span> {active.explanation}
          </p>
        ) : null}
      </div>
    </div>
  );
}
