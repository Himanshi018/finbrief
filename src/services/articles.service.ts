import type { CategorySlug } from "@/types/database";
import type { ArticleWithRelations } from "@/types/database";
import { PAGE_SIZE } from "@/lib/constants/categories";
import { createServerClient } from "@/lib/supabase/server";

export interface ArticleCursor {
  published_at: string;
  id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: ArticleCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): ArticleCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as ArticleCursor;
    // Values are interpolated into a PostgREST filter, so validate them strictly
    if (
      typeof parsed.published_at === "string" &&
      typeof parsed.id === "string" &&
      UUID_RE.test(parsed.id) &&
      !Number.isNaN(Date.parse(parsed.published_at)) &&
      /^[\d\-T:.+Z ]+$/.test(parsed.published_at)
    ) {
      return { published_at: parsed.published_at, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

export async function listArticles(params: {
  category?: CategorySlug | null;
  cursor?: string | null;
  limit?: number;
}): Promise<{ articles: ArticleWithRelations[]; nextCursor: string | null }> {
  const supabase = createServerClient();
  if (!supabase) {
    return { articles: [], nextCursor: null };
  }
  const limit = params.limit ?? PAGE_SIZE;
  const cursor = decodeCursor(params.cursor);

  let query = supabase
    .from("articles")
    .select(
      `
      *,
      category:categories ( slug, name ),
      source:sources ( name )
    `,
    )
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (params.category) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", params.category)
      .maybeSingle();

    // Unknown category: return nothing rather than silently dropping the filter
    if (!cat?.id) {
      return { articles: [], nextCursor: null };
    }
    query = query.eq("category_id", cat.id);
  }

  if (cursor) {
    // Keyset on (published_at, id) so articles sharing a timestamp aren't skipped
    const ts = cursor.published_at;
    query = query.or(
      `published_at.lt."${ts}",and(published_at.eq."${ts}",id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as ArticleWithRelations[];
  const hasMore = rows.length > limit;
  const articles = hasMore ? rows.slice(0, limit) : rows;

  const last = articles[articles.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ published_at: last.published_at, id: last.id })
      : null;

  return { articles, nextCursor };
}

export async function listCategories() {
  const supabase = createServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getArticleById(id: string): Promise<ArticleWithRelations | null> {
  const supabase = createServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("articles")
    .select(
      `
      *,
      category:categories ( slug, name ),
      source:sources ( name )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ArticleWithRelations | null) ?? null;
}

export async function listRelatedArticles(params: {
  categoryId: string | null;
  excludeId: string;
  limit?: number;
}): Promise<ArticleWithRelations[]> {
  const supabase = createServerClient();
  if (!supabase || !params.categoryId) return [];

  const limit = params.limit ?? 3;

  const { data, error } = await supabase
    .from("articles")
    .select(
      `
      *,
      category:categories ( slug, name ),
      source:sources ( name )
    `,
    )
    .eq("category_id", params.categoryId)
    .neq("id", params.excludeId)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as ArticleWithRelations[];
}
