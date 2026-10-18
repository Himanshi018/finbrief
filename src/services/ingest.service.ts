import { fetchAllCategoryNews } from "@/lib/newsapi/client";
import { summarizeArticle, generateWhyItMatters, generateKeyTerms } from "@/lib/ai/summarize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RawNewsItem } from "@/types/news";
import type { KeyTerm } from "@/types/database";

/** Default batch size when the caller doesn't specify one. */
export const DEFAULT_INGEST_ARTICLES = 10;
/** Hard cap on new articles per run: each one costs 3 OpenAI calls. */
export const MAX_INGEST_ARTICLES = 50;

export interface IngestOptions {
  maxArticles?: number;
  /** Fetch and filter only; no AI calls and no database writes. */
  dryRun?: boolean;
}

export interface IngestResult {
  message: string;
  dryRun: boolean;
  maxArticles: number;
  fetched: number;
  inserted: number;
  /** Already in the database. */
  skipped: number;
  /** Inserted with no AI fields (missing key, quota exhausted, etc.). */
  aiFailures: number;
  durationMs: number;
  /** Titles that would be inserted (dry run only). */
  candidates?: string[];
  warnings: string[];
  errors: string[];
}

export class IngestionInProgressError extends Error {
  constructor() {
    super("An ingestion is already running; try again when it finishes");
  }
}

const log = (...args: unknown[]) => console.log("[ingest]", ...args);

/** Clamp a requested batch size into 1..MAX_INGEST_ARTICLES. */
export function resolveMaxArticles(requested: unknown): number {
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested < 1) {
    return DEFAULT_INGEST_ARTICLES;
  }
  return Math.min(Math.floor(requested), MAX_INGEST_ARTICLES);
}

async function upsertSource(name: string, domain: string | null) {
  const supabase = createAdminClient();

  if (domain) {
    const { data: existing } = await supabase
      .from("sources")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();
    if (existing?.id) return existing.id;
  }

  const { data, error } = await supabase
    .from("sources")
    .insert({ name, domain })
    .select("id")
    .single();

  if (error) {
    const { data: byName } = await supabase
      .from("sources")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (byName?.id) return byName.id;
    throw new Error(error.message);
  }

  return data.id;
}

async function getCategoryId(slug: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .single();

  if (error || !data) throw new Error(`Category not found: ${slug}`);
  return data.id;
}

async function articleExists(externalId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("articles")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function insertArticle(
  item: RawNewsItem,
  summary: string,
  whyItMatters: string | null,
  keyTerms: KeyTerm[] | null,
) {
  const supabase = createAdminClient();
  const [sourceId, categoryId] = await Promise.all([
    upsertSource(item.sourceName, item.sourceDomain),
    getCategoryId(item.categorySlug),
  ]);

  const { error } = await supabase.from("articles").insert({
    external_id: item.externalId,
    title: item.title,
    url: item.url,
    description: item.description,
    summary,
    why_it_matters: whyItMatters,
    key_terms: keyTerms,
    image_url: item.imageUrl,
    source_id: sourceId,
    category_id: categoryId,
    published_at: item.publishedAt,
  });

  if (error) {
    if (error.code === "23505") return false;
    throw new Error(error.message);
  }
  return true;
}

// Guards against overlapping runs within one server process (double-clicks,
// a cron firing during a manual run). Not a distributed lock.
let running = false;

export async function runNewsIngestion(options?: IngestOptions): Promise<IngestResult> {
  if (running) throw new IngestionInProgressError();
  running = true;
  try {
    return await ingest(options);
  } finally {
    running = false;
  }
}

async function ingest(options?: IngestOptions): Promise<IngestResult> {
  const startedAt = Date.now();
  const maxArticles = resolveMaxArticles(options?.maxArticles);
  const dryRun = options?.dryRun ?? false;
  const aiEnabled = Boolean(process.env.OPENAI_API_KEY);

  const result: IngestResult = {
    message: "",
    dryRun,
    maxArticles,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    aiFailures: 0,
    durationMs: 0,
    warnings: [],
    errors: [],
  };
  if (dryRun) result.candidates = [];

  if (
    typeof options?.maxArticles === "number" &&
    options.maxArticles > MAX_INGEST_ARTICLES
  ) {
    result.warnings.push(
      `Requested ${options.maxArticles} articles; capped at ${MAX_INGEST_ARTICLES}`,
    );
  }
  if (!aiEnabled && !dryRun) {
    result.warnings.push(
      "OPENAI_API_KEY is not set: summaries fall back to the NewsAPI description",
    );
  }

  log(`start: max=${maxArticles}${dryRun ? " (dry run)" : ""}, ai=${aiEnabled ? "on" : "off"}`);

  const finish = () => {
    result.durationMs = Date.now() - startedAt;
    if (result.aiFailures > 0) {
      result.warnings.push(
        `AI generation failed for ${result.aiFailures} article(s); check the server log (missing credits or invalid key are the usual causes)`,
      );
    }
    result.message = summarize(result);
    log(result.message);
    for (const w of result.warnings) log("warning:", w);
    return result;
  };

  let items: RawNewsItem[];
  try {
    items = await fetchAllCategoryNews();
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "News fetch failed");
    return finish();
  }

  result.fetched = items.length;
  log(`fetched ${items.length} finance articles from NewsAPI`);
  if (items.length === 0) {
    result.warnings.push("NewsAPI returned no usable articles; check NEWS_API_KEY and the server log");
  }

  const sorted = [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  let processed = 0;
  for (const item of sorted) {
    if (processed >= maxArticles) break;

    try {
      if (await articleExists(item.externalId)) {
        result.skipped += 1;
        continue;
      }

      if (dryRun) {
        result.candidates!.push(`[${item.categorySlug}] ${item.title}`);
        processed += 1;
        continue;
      }

      const summary = await summarizeArticle({
        title: item.title,
        description: item.description,
      });

      const [whyItMatters, keyTerms] = await Promise.all([
        generateWhyItMatters({ title: item.title, summary }),
        generateKeyTerms({ title: item.title, summary }),
      ]);
      const aiFailed = aiEnabled && whyItMatters === null && keyTerms === null;

      const inserted = await insertArticle(item, summary, whyItMatters, keyTerms);
      if (inserted) {
        result.inserted += 1;
        processed += 1;
        if (aiFailed) result.aiFailures += 1;
        log(
          `  + ${processed}/${maxArticles} [${item.categorySlug}] ${item.title.slice(0, 70)}${aiFailed ? "  (no AI fields)" : ""}`,
        );
      } else {
        result.skipped += 1;
      }
    } catch (err) {
      const message =
        err instanceof Error ? `${item.title}: ${err.message}` : "Insert failed";
      result.errors.push(message);
      log("  ! error:", message);
    }
  }

  return finish();
}

function summarize(r: IngestResult): string {
  const secs = (r.durationMs / 1000).toFixed(1);
  if (r.dryRun) {
    return `Dry run: ${r.candidates?.length ?? 0} new article(s) would be inserted (fetched ${r.fetched}, ${r.skipped} already stored) in ${secs}s`;
  }
  const parts = [`Inserted ${r.inserted} new article(s)`, `fetched ${r.fetched}`, `${r.skipped} already stored`];
  if (r.errors.length) parts.push(`${r.errors.length} error(s)`);
  return `${parts.join(", ")} in ${secs}s`;
}
