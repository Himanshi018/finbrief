import type { CategorySlug } from "@/types/database";
import type { ArticlesPageResponse } from "@/types/news";

export async function fetchArticlesPage(params: {
  category?: CategorySlug | null;
  cursor?: string | null;
  limit?: number;
}): Promise<ArticlesPageResponse> {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));

  const res = await fetch(`/api/articles?${search.toString()}`);
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? "Failed to load articles");
  }

  return (await res.json()) as ArticlesPageResponse;
}
