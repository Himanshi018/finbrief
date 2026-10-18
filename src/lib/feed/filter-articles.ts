import type { ArticleWithRelations } from "@/types/database";

export function filterArticlesByQuery(
  articles: ArticleWithRelations[],
  query: string,
): ArticleWithRelations[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return articles;

  return articles.filter((article) => {
    const headline = article.title.toLowerCase();
    const source = (article.source?.name ?? "").toLowerCase();
    const category = (article.category?.name ?? "").toLowerCase();
    return (
      headline.includes(normalized) ||
      source.includes(normalized) ||
      category.includes(normalized)
    );
  });
}
