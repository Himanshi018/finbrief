interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/90 px-6 py-8 text-center shadow-sm">
      <p className="font-semibold text-red-900">We couldn&apos;t refresh your feed</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-red-800/85">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl bg-red-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-900"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
