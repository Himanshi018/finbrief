import type { ArticleWithRelations, CategorySlug, KeyTerm } from "@/types/database";

export interface SavedArticleSnapshot {
  id: string;
  title: string;
  // Optional: snapshots saved before these fields existed lack them
  simple_title?: string | null;
  key_terms?: KeyTerm[] | null;
  url: string;
  summary: string | null;
  why_it_matters: string | null;
  description: string | null;
  image_url: string | null;
  image_credit_name?: string | null;
  image_credit_url?: string | null;
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
    simple_title: article.simple_title,
    key_terms: article.key_terms,
    url: article.url,
    summary: article.summary,
    why_it_matters: article.why_it_matters,
    description: article.description,
    image_url: article.image_url,
    image_credit_name: article.image_credit_name ?? null,
    image_credit_url: article.image_credit_url ?? null,
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
    simple_title: snapshot.simple_title ?? null,
    url: snapshot.url,
    description: snapshot.description,
    summary: snapshot.summary,
    why_it_matters: snapshot.why_it_matters,
    key_terms: snapshot.key_terms ?? null,
    image_url: snapshot.image_url,
    image_credit_name: snapshot.image_credit_name ?? null,
    image_credit_url: snapshot.image_credit_url ?? null,
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
