export interface KeyTerm {
  term: string;
  explanation: string;
}

export type CategorySlug =
  | "markets"
  | "startups"
  | "economy"
  | "fintech"
  | "ai-business"
  | "global-finance";

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Source {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
}

export interface Article {
  id: string;
  external_id: string;
  title: string;
  url: string;
  description: string | null;
  summary: string | null;
  why_it_matters: string | null;
  key_terms: KeyTerm[] | null;
  image_url: string | null;
  category_id: string | null;
  source_id: string | null;
  published_at: string;
  created_at: string;
}

export interface ArticleWithRelations extends Article {
  category: Pick<Category, "slug" | "name"> | null;
  source: Pick<Source, "name"> | null;
}

export interface User {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedArticle {
  id: string;
  user_id: string;
  article_id: string;
  created_at: string;
}
