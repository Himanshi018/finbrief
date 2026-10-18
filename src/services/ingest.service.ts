import { fetchAllCategoryNews } from "@/lib/newsapi/client";
import {
  AiUnavailableError,
  generateArticleInsights,
  type ArticleInsights,
} from "@/lib/ai/summarize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RawNewsItem } from "@/types/news";

/** Default batch size when the caller doesn't specify one. */
export const DEFAULT_INGEST_ARTICLES = 10;
/** Hard cap on articles per run (ingest or backfill): each one costs an AI call. */
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
  /**
   * Inserted without all three AI fields. They stay hidden from the feed
   * until `npm run backfill-ai` fills them in.
   */
  aiFailures: number;
  /** Set when the AI provider failed hard (auth, quota, model) and AI was skipped for the rest of the run. */
  aiStopped: string | null;
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

function isComplete(insights: ArticleInsights | null): boolean {
  return Boolean(insights?.summary && insights.whyItMatters && insights.keyTerms);
}

/**
 * Wraps generateArticleInsights with per-run fail-fast: after the first
 * AiUnavailableError (bad key, no credits, unknown model, ...) it logs one
 * message and returns null for every later call instead of retrying.
 */
function createAiStep() {
  const aiEnabled = Boolean(process.env.OPENAI_API_KEY);
  let stopped: string | null = null;

  return {
    aiEnabled,
    /** One-line reason AI was switched off for this run, if it was. */
    get stopped() {
      return stopped;
    },
    async generate(input: { title: string; description: string | null }) {
      if (!aiEnabled || stopped) return null;
      try {
        return await generateArticleInsights(input);
      } catch (err) {
        if (!(err instanceof AiUnavailableError)) throw err;
        stopped = `${err.reason}: ${err.message}`;
        log(`  ! AI stopped for the rest of this run (${stopped})`);
        return null;
      }
    },
  };
}

async function insertArticle(item: RawNewsItem, insights: ArticleInsights | null) {
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
    // null = not generated yet; the feed hides these until backfilled
    summary: insights?.summary ?? null,
    why_it_matters: insights?.whyItMatters ?? null,
    key_terms: insights?.keyTerms ?? null,
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
  const ai = createAiStep();
  const aiEnabled = ai.aiEnabled;

  const result: IngestResult = {
    message: "",
    dryRun,
    maxArticles,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    aiFailures: 0,
    durationMs: 0,
    aiStopped: null,
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
      "OPENAI_API_KEY is not set: articles are stored without AI fields and stay hidden from the feed until backfilled",
    );
  }

  log(`start: max=${maxArticles}${dryRun ? " (dry run)" : ""}, ai=${aiEnabled ? "on" : "off"}`);

  const finish = () => {
    result.durationMs = Date.now() - startedAt;
    result.aiStopped = ai.stopped;
    if (result.aiFailures > 0 && aiEnabled) {
      result.warnings.push(
        `${result.aiFailures} article(s) stored without complete AI fields (hidden from the feed); run \`npm run backfill-ai\` to fill them in`,
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

  // Round-robin across categories (each newest-first) instead of one global
  // newest-first list: busy queries like markets would otherwise fill every
  // run and slower ones like global-finance would never make the cut.
  const byCategory = new Map<string, RawNewsItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.categorySlug) ?? [];
    list.push(item);
    byCategory.set(item.categorySlug, list);
  }
  const queues = [...byCategory.values()].map((list) =>
    list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
  );
  const sorted: RawNewsItem[] = [];
  for (let i = 0; queues.some((q) => i < q.length); i++) {
    for (const q of queues) if (i < q.length) sorted.push(q[i]);
  }

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

      // Insert even when AI fails: NewsAPI won't return this story again
      // once it ages out, and the feed hides it until it's backfilled.
      const insights = await ai.generate({ title: item.title, description: item.description });
      const aiFailed = !isComplete(insights);

      const inserted = await insertArticle(item, insights);
      if (inserted) {
        result.inserted += 1;
        processed += 1;
        if (aiFailed) result.aiFailures += 1;
        log(
          `  + ${processed}/${maxArticles} [${item.categorySlug}] ${item.title.slice(0, 70)}${aiFailed ? "  (AI incomplete: hidden until backfilled)" : ""}`,
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

// ---------------------------------------------------------------------------
// AI backfill: fill in articles stored without summary / why_it_matters / key_terms
// ---------------------------------------------------------------------------

/** Pause between AI calls; Groq's free tier allows ~8k tokens/min (~600 per article). */
export const DEFAULT_BACKFILL_DELAY_MS = 5000;

export interface BackfillOptions {
  maxArticles?: number;
  /** List what would be backfilled; no AI calls and no database writes. */
  dryRun?: boolean;
  delayMs?: number;
}

export interface BackfillResult {
  message: string;
  dryRun: boolean;
  /** Articles still missing at least one AI field (before this run). */
  pending: number;
  updated: number;
  /** Got a reply but some fields were still missing; left for the next run. */
  incomplete: number;
  failed: number;
  aiStopped: string | null;
  durationMs: number;
  candidates?: string[];
  warnings: string[];
  errors: string[];
}

const MISSING_AI_FILTER = "summary.is.null,why_it_matters.is.null,key_terms.is.null";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runAiBackfill(options?: BackfillOptions): Promise<BackfillResult> {
  const startedAt = Date.now();
  const maxArticles = resolveMaxArticles(options?.maxArticles);
  const dryRun = options?.dryRun ?? false;
  const delayMs = Math.max(0, options?.delayMs ?? DEFAULT_BACKFILL_DELAY_MS);
  const warnings: string[] = [];
  const ai = createAiStep();
  const supabase = createAdminClient();

  const result: BackfillResult = {
    message: "",
    dryRun,
    pending: 0,
    updated: 0,
    incomplete: 0,
    failed: 0,
    aiStopped: null,
    durationMs: 0,
    warnings,
    errors: [],
  };

  const finish = () => {
    result.durationMs = Date.now() - startedAt;
    result.aiStopped = ai.stopped;
    const secs = (result.durationMs / 1000).toFixed(1);
    result.message = dryRun
      ? `Dry run: ${result.candidates?.length ?? 0} of ${result.pending} pending article(s) would be backfilled`
      : `Backfilled ${result.updated} article(s)` +
        (result.incomplete ? `, ${result.incomplete} still incomplete` : "") +
        (result.failed ? `, ${result.failed} failed` : "") +
        `; ${Math.max(0, result.pending - result.updated)} still pending, in ${secs}s` +
        (result.aiStopped ? `. AI stopped early (${result.aiStopped})` : "");
    log(result.message);
    for (const w of warnings) log("warning:", w);
    return result;
  };

  if (!ai.aiEnabled && !dryRun) {
    result.errors.push("OPENAI_API_KEY is not set; nothing to backfill with");
    return finish();
  }

  const { data, count, error } = await supabase
    .from("articles")
    .select("id,title,description", { count: "exact" })
    .or(MISSING_AI_FILTER)
    .order("published_at", { ascending: false })
    .limit(maxArticles);

  if (error) {
    result.errors.push(error.message);
    return finish();
  }

  const rows = (data ?? []) as { id: string; title: string; description: string | null }[];
  result.pending = count ?? rows.length;
  log(`backfill: ${result.pending} article(s) missing AI fields; processing up to ${maxArticles}${dryRun ? " (dry run)" : ""}`);

  if (dryRun) {
    result.candidates = rows.map((r) => r.title);
    return finish();
  }

  for (const [i, row] of rows.entries()) {
    if (i > 0 && delayMs > 0) await sleep(delayMs);

    const insights = await ai.generate({ title: row.title, description: row.description });
    if (ai.stopped) break;
    if (!insights) {
      result.failed += 1;
      log(`  ! ${i + 1}/${rows.length} no usable AI reply: ${row.title.slice(0, 70)}`);
      continue;
    }

    // Overwrite all three: rows from before AI worked hold fallback summaries
    const patch = {
      ...(insights.summary && { summary: insights.summary }),
      ...(insights.whyItMatters && { why_it_matters: insights.whyItMatters }),
      ...(insights.keyTerms && { key_terms: insights.keyTerms }),
    };
    const { error: updateError } = await supabase.from("articles").update(patch).eq("id", row.id);
    if (updateError) {
      result.errors.push(`${row.title}: ${updateError.message}`);
      log(`  ! ${i + 1}/${rows.length} update failed: ${updateError.message}`);
      continue;
    }

    if (isComplete(insights)) {
      result.updated += 1;
      log(`  + ${i + 1}/${rows.length} ${row.title.slice(0, 70)}`);
    } else {
      result.incomplete += 1;
      log(`  ~ ${i + 1}/${rows.length} partial reply, still hidden: ${row.title.slice(0, 70)}`);
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
  const stopped = r.aiStopped ? `. AI stopped early (${r.aiStopped})` : "";
  return `${parts.join(", ")} in ${secs}s${stopped}`;
}
