"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

interface ArticleImageProps {
  src: string | null;
  /** Photographer credit, set for Pexels stock photos. */
  creditName?: string | null;
  creditUrl?: string | null;
  /** Wrap the image in a link (feed cards). The credit stays outside it. */
  href?: string;
  priority?: boolean;
  sizes: string;
  className?: string;
}

/**
 * 16:9 news photo (feed thumbnail, page og:image or Pexels). Renders nothing
 * when there is no photo or it fails to load, so the card simply has no image.
 */
export function ArticleImage({
  src,
  creditName,
  creditUrl,
  href,
  priority,
  sizes,
  className,
}: ArticleImageProps) {
  // Track which URL failed, so a new src gets a fresh attempt
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return null;

  const image = (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      priority={priority}
      sizes={sizes}
      className="object-cover"
      onError={() => setFailedSrc(src)}
    />
  );

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden bg-slate-100", className)}>
      {href ? (
        <Link href={href} tabIndex={-1} aria-hidden className="absolute inset-0">
          {image}
        </Link>
      ) : (
        image
      )}
      {creditName ? (
        <p className="absolute bottom-2 right-2 rounded-full bg-slate-950/60 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
          Photo:{" "}
          {creditUrl ? (
            <a href={creditUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
              {creditName}
            </a>
          ) : (
            creditName
          )}{" "}
          /{" "}
          <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            Pexels
          </a>
        </p>
      ) : null}
    </div>
  );
}
