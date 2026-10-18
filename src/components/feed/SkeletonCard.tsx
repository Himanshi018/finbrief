import { cn } from "@/lib/utils/cn";

interface SkeletonCardProps {
  className?: string;
  compact?: boolean;
}

export function SkeletonCard({ className, compact }: SkeletonCardProps) {
  if (compact) {
    return (
      <div
        className={cn(
          "flex animate-pulse items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3",
          className,
        )}
      >
        <div className="h-2 w-2 rounded-full bg-emerald-200" />
        <div className="h-3 flex-1 rounded bg-slate-100" />
      </div>
    );
  }

  return (
    <article
      className={cn(
        "animate-pulse overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
    >
      <div className="aspect-[16/9] bg-slate-100" />
      <div className="space-y-3 p-5 sm:p-6">
        <div className="h-3 w-32 rounded bg-slate-100" />
        <div className="h-6 w-full rounded bg-slate-100" />
        <div className="h-6 w-4/5 rounded bg-slate-100" />
        <div className="space-y-2 pt-1">
          <div className="h-3 w-full rounded bg-slate-50" />
          <div className="h-3 w-full rounded bg-slate-50" />
          <div className="h-3 w-2/3 rounded bg-slate-50" />
        </div>
        <div className="mt-2 h-11 w-40 rounded-xl bg-emerald-100" />
      </div>
    </article>
  );
}
