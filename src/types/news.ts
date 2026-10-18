import type { CategorySlug } from "./database";

export interface NewsApiArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

export interface RawNewsItem {
  externalId: string;
  title: string;
  url: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: string;
  sourceName: string;
  sourceDomain: string | null;
  categorySlug: CategorySlug;
}

export interface ArticlesPageResponse {
  articles: import("./database").ArticleWithRelations[];
  nextCursor: string | null;
}
