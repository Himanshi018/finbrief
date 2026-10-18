import type { ArticleWithRelations, CategorySlug } from "@/types/database";

export interface SavedArticleSnapshot {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  why_it_matters: string | null;
  description: string | null;
  image_url: string | null;
  published_at: string;
  sourceName: string;
  categoryName: string;
  categorySlug: CategorySlug | null;
  savedAt: string;
}

export function articleToSnapshot(article: ArticleWithRelations): SavedArticleSnapshot {
  return {
    id: article.id,
    title: article.title,
    url: article.url,
    summary: article.summary,
    why_it_matters: article.why_it_matters,
    description: article.description,
    image_url: article.image_url,
    published_at: article.published_at,
    sourceName: article.source?.name ?? "Source",
    categoryName: article.category?.name ?? "Finance",
    categorySlug: article.category?.slug ?? null,
    savedAt: new Date().toISOString(),
  };
}

export function snapshotToArticle(snapshot: SavedArticleSnapshot): ArticleWithRelations {
  return {
    id: snapshot.id,
    external_id: snapshot.id,
    title: snapshot.title,
    url: snapshot.url,
    description: snapshot.description,
    summary: snapshot.summary,
    why_it_matters: snapshot.why_it_matters,
    key_terms: null,
    image_url: snapshot.image_url,
    category_id: null,
    source_id: null,
    published_at: snapshot.published_at,
    created_at: snapshot.savedAt,
    category: snapshot.categorySlug
      ? { slug: snapshot.categorySlug, name: snapshot.categoryName }
      : null,
    source: { name: snapshot.sourceName },
  };
}
