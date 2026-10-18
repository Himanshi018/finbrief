"use client";

import { useEffect, useRef } from "react";

interface UseIntersectionLoadOptions {
  onIntersect: () => void;
  enabled?: boolean;
  rootMargin?: string;
}

export function useIntersectionLoad({
  onIntersect,
  enabled = true,
  rootMargin = "200px",
}: UseIntersectionLoadOptions) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onIntersect, rootMargin]);

  return ref;
}
