import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    // Article photos render with `unoptimized` (served straight from the
    // publisher), so this list only matters if optimization is turned on.
    // It covers the RSS sources and Pexels; older NewsAPI images from other
    // hosts still display because they aren't optimized either.
    remotePatterns: [
      // The Economic Times: image CDN, plus og:image fallbacks on its own domains
      { protocol: "https", hostname: "img.etimg.com" },
      { protocol: "https", hostname: "**.indiatimes.com" },
      // Livemint: images are served from www.livemint.com/lm-img/ and its subdomains
      { protocol: "https", hostname: "**.livemint.com" },
      { protocol: "https", hostname: "livemint.com" },
      // Pexels stock photos (fallback when neither the feed nor the page has one)
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
