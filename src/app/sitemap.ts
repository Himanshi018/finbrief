import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();

  return [
    { url: base, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/feed`, lastModified, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/saved`, lastModified, changeFrequency: "weekly", priority: 0.5 },
  ];
}
