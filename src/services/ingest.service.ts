import { fetchAllCategoryNews, type FilterDecision } from "@/lib/newsapi/client";
import { fetchAllRssNews } from "@/lib/rss/client";
import { CATEGORY_DEFINITIONS, INDIA_BOOST_HOURS } from "@/lib/constants/categories";
import {
  AiUnavailableError,
  checkFinanceRelevance,
  generateArticleInsights,
  type ArticleInsights,
} from "@/lib/ai/summarize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RawNewsItem } from "@/types/news";

/** Default batch size when the caller doesn't specify one. */
export const DEFAULT_INGEST_ARTICLES = 10;
/** Hard cap on articles per run (ingest or backfill): each one costs an AI call. */
export const MAX_INGEST_ARTICLES = 50;
/**
 * AI calls per ingest run, as a multiple of maxArticles. Stories the relevance
 * gate rejects don't count toward maxArticles, so this bounds the spend when
 * many candidates turn out not to be finance.
 */
const AI_CALLS_PER_ARTICLE_BUDGET = 3;

/**
 * NEWS_SOURCE picks where articles come from. RSS is the default because
 * NewsAPI's free plan is dev-only and delays articles by 24h.
 */
const NEWS_SOURCES = {
  rss: { label: "RSS feeds", fetch: fetchAllRssNews },
  newsapi: { label: "NewsAPI", fetch: fetchAllCategoryNews },
} as const;
export type NewsSource = keyof typeof NEWS_SOURCES;

export function resolveNewsSource(): NewsSource {
  const value = process.env.NEWS_SOURCE?.trim().toLowerCase() || "rss";
  if (!(value in NEWS_SOURCES)) {
    throw new Error(`NEWS_SOURCE must be "rss" or "newsapi" (got "${process.env.NEWS_SOURCE}")`);
  }
  return value as NewsSource;
}

export interface IngestOptions {
  maxArticles?: number;
  /** Fetch and filter only; no AI calls and no database writes. */
  dryRun?: boolean;
}

export interface IngestResult {
  message: string;
  dryRun: boolean;
  /** Which NEWS_SOURCE this run used. */
  source: NewsSource | null;
  maxArticles: number;
  fetched: number;
  inserted: number;
  /** Already in the database. */
  skipped: number;
  /** Rejected earlier by the relevance gate or cleanup (article_rejections); no AI call spent. */
  previouslyRejected: number;
  /** Not stored: the AI relevance gate said the story isn't finance. */
  rejectedByAi: number;
  /** "title: reason" for each AI rejection in this run. */
  aiRejections: string[];
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
  /** Every filter accept/reject with its reason (dry run only). */
  decisions?: FilterDecision[];
  warnings: string[];
  errors: string[];
}

/** Rank key: publish time, with India-relevant stories counted as fresher. */
function rankTime(item: RawNewsItem): number {
  return new Date(item.publishedAt).getTime() + (item.india ? INDIA_BOOST_HOURS * 3_600_000 : 0);
}

/** Warn when a category slug in code has no row in the categories table. */
async function findMissingCategorySlugs(): Promise<string[]> {
  const { data, error } = await createAdminClient().from("categories").select("slug");
  if (error) return [`could not read categories table: ${error.message}`];
  const slugs = new Set((data ?? []).map((row) => row.slug as string));
  return CATEGORY_DEFINITIONS.filter((def) => !slugs.has(def.slug)).map(
    (def) => `category "${def.slug}" is missing from the categories table; its articles will fail to insert`,
  );
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
 * Wraps the AI calls with per-run fail-fast: after the first
 * AiUnavailableError (bad key, no credits, unknown model, ...) it logs one
 * message and returns null for every later call instead of retrying.
 */
export function createAiStep() {
  const aiEnabled = Boolean(process.env.OPENAI_API_KEY);
  let stopped: string | null = null;
  let calls = 0;

  async function guard<T>(call: () => Promise<T | null>): Promise<T | null> {
    if (!aiEnabled || stopped) return null;
    calls += 1;
    try {
      return await call();
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) throw err;
      stopped = `${err.reason}: ${err.message}`;
      log(`  ! AI stopped for the rest of this run (${stopped})`);
      return null;
    }
  }

  type Input = { title: string; description: string | null };
  return {
    aiEnabled,
    /** One-line reason AI was switched off for this run, if it was. */
    get stopped() {
      return stopped;
    },
    /** Requests actually sent to the provider this run. */
    get calls() {
      return calls;
    },
    generate: (input: Input) => guard(() => generateArticleInsights(input)),
    checkRelevance: (input: Input) => guard(() => checkFinanceRelevance(input)),
  };
}

export interface RejectionRecord {
  external_id: string;
  title: string;
  reason: string;
}

/**
 * Stories rejected by the relevance gate or cleanup (table from migration
 * 004). If the table doesn't exist yet this degrades to a no-op with one
 * warning, so ingestion keeps working before the migration is run.
 */
export function createRejectionStore(warnings: string[]) {
  const supabase = createAdminClient();
  let available = true;

  const handle = (error: { code?: string; message: string }) => {
    const missing =
      error.code === "42P01" || error.code === "PGRST205" || /article_rejections/.test(error.message);
    if (!missing) throw new Error(error.message);
    if (available) {
      available = false;
      warnings.push(
        "article_rejections table is missing, so rejected stories will be re-checked with AI on every run. Run supabase/migrations/004_article_rejections.sql in the Supabase SQL editor.",
      );
    }
  };

  return {
    async has(externalId: string): Promise<boolean> {
      if (!available) return false;
      const { data, error } = await supabase
        .from("article_rejections")
        .select("external_id")
        .eq("external_id", externalId)
        .maybeSingle();
      if (error) {
        handle(error);
        return false;
      }
      return Boolean(data);
    },
    /** Returns false if the records couldn't be stored (table missing). */
    async add(records: RejectionRecord[]): Promise<boolean> {
      if (records.length === 0) return true;
      if (!available) return false;
      const { error } = await supabase
        .from("article_rejections")
        .upsert(records, { onConflict: "external_id" });
      if (error) {
        handle(error);
        return false;
      }
      return true;
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
    // (simple_title is optional: the UI falls back to the original title)
    simple_title: insights?.simpleTitle ?? null,
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
    throw new Error(withMigrationHint(error.message));
  }
  return true;
}

/** Point at the migration when the DB predates the simple_title column. */
function withMigrationHint(message: string): string {
  return /simple_title/.test(message)
    ? `${message}. Run supabase/migrations/003_article_simple_title.sql in the Supabase SQL editor.`
    : message;
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
    source: null,
    maxArticles,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    previouslyRejected: 0,
    rejectedByAi: 0,
    aiRejections: [],
    aiFailures: 0,
    durationMs: 0,
    aiStopped: null,
    warnings: [],
    errors: [],
  };
  if (dryRun) result.candidates = [];
  const rejections = createRejectionStore(result.warnings);
  const maxAiCalls = maxArticles * AI_CALLS_PER_ARTICLE_BUDGET;

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

  let source: NewsSource;
  try {
    source = resolveNewsSource();
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return finish();
  }
  result.source = source;
  const { label, fetch: fetchNews } = NEWS_SOURCES[source];
  log(`source: ${label} (NEWS_SOURCE=${source})`);

  if (dryRun) {
    result.decisions = [];
    result.warnings.push(...(await findMissingCategorySlugs()));
  }

  let items: RawNewsItem[];
  try {
    items = await fetchNews(dryRun ? (d) => result.decisions!.push(d) : undefined);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "News fetch failed");
    return finish();
  }

  result.fetched = items.length;
  log(`fetched ${items.length} finance articles from ${label}`);
  if (items.length === 0) {
    result.warnings.push(
      source === "newsapi"
        ? "NewsAPI returned no usable articles; check NEWS_API_KEY and the server log"
        : "RSS feeds returned no usable articles; check the feed errors in the server log",
    );
  }

  // Round-robin across categories (each newest-first) instead of one global
  // newest-first list: busy queries like markets would otherwise fill every
  // run and slower ones like global-finance would never make the cut.
  // Within a category, India-relevant stories rank as INDIA_BOOST_HOURS fresher.
  const byCategory = new Map<string, RawNewsItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.categorySlug) ?? [];
    list.push(item);
    byCategory.set(item.categorySlug, list);
  }
  const queues = [...byCategory.values()].map((list) =>
    list.sort((a, b) => rankTime(b) - rankTime(a)),
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
      if (await rejections.has(item.externalId)) {
        result.previouslyRejected += 1;
        continue;
      }

      if (dryRun) {
        result.candidates!.push(`[${item.categorySlug}]${item.india ? " (India)" : ""} ${item.title}`);
        processed += 1;
        continue;
      }

      // Insert even when AI fails: the source won't return this story again
      // once it ages out, and the feed hides it until it's backfilled.
      if (ai.calls >= maxAiCalls) {
        result.warnings.push(
          `Stopped after ${ai.calls} AI calls (budget for --max ${maxArticles}); many candidates were not finance`,
        );
        break;
      }
      const insights = await ai.generate({ title: item.title, description: item.description });

      // Relevance gate: don't store stories the AI says aren't finance
      if (insights?.isFinanceRelevant === false) {
        const reason = insights.relevanceReason ?? "not finance";
        result.rejectedByAi += 1;
        result.aiRejections.push(`${item.title}: ${reason}`);
        log(`  - not finance [${item.categorySlug}] ${item.title.slice(0, 70)} (${reason})`);
        await rejections.add([{ external_id: item.externalId, title: item.title, reason: `AI gate: ${reason}` }]);
        continue;
      }
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
  /** The relevance gate said "not finance"; left for `npm run cleanup-articles`. */
  notRelevant: number;
  aiStopped: string | null;
  durationMs: number;
  candidates?: string[];
  warnings: string[];
  errors: string[];
}

const MISSING_AI_FILTER =
  "simple_title.is.null,summary.is.null,why_it_matters.is.null,key_terms.is.null";

interface BackfillRow {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  why_it_matters: string | null;
  key_terms: unknown;
}

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
    notRelevant: 0,
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
        (result.notRelevant
          ? `, ${result.notRelevant} not finance (run npm run cleanup-articles to remove)`
          : "") +
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
    .select("id,title,description,summary,why_it_matters,key_terms", { count: "exact" })
    .or(MISSING_AI_FILTER)
    .order("published_at", { ascending: false })
    .limit(maxArticles);

  if (error) {
    result.errors.push(withMigrationHint(error.message));
    return finish();
  }

  const rows = (data ?? []) as BackfillRow[];
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
    if (insights.isFinanceRelevant === false) {
      result.notRelevant += 1;
      log(
        `  - ${i + 1}/${rows.length} not finance, left untouched (${insights.relevanceReason ?? "no reason"}): ${row.title.slice(0, 70)}`,
      );
      continue;
    }

    // Rows already showing in the feed only need a simple_title; keep their
    // reviewed text. Other rows get all fields overwritten, since rows from
    // before AI worked hold fallback summaries.
    const onlyTitle = Boolean(row.summary && row.why_it_matters && row.key_terms);
    const patch = {
      ...(insights.simpleTitle && { simple_title: insights.simpleTitle }),
      ...(!onlyTitle && insights.summary && { summary: insights.summary }),
      ...(!onlyTitle && insights.whyItMatters && { why_it_matters: insights.whyItMatters }),
      ...(!onlyTitle && insights.keyTerms && { key_terms: insights.keyTerms }),
    };
    if (Object.keys(patch).length === 0) {
      result.incomplete += 1;
      log(`  ~ ${i + 1}/${rows.length} nothing usable in the reply: ${row.title.slice(0, 70)}`);
      continue;
    }
    const { error: updateError } = await supabase.from("articles").update(patch).eq("id", row.id);
    if (updateError) {
      const message = withMigrationHint(updateError.message);
      result.errors.push(`${row.title}: ${message}`);
      log(`  ! ${i + 1}/${rows.length} update failed: ${message}`);
      continue;
    }

    const visible = onlyTitle || isComplete(insights);
    const noTitle = insights.simpleTitle ? "" : " (no usable simple title; showing original)";
    if (visible && (insights.simpleTitle || !onlyTitle)) {
      result.updated += 1;
      log(`  + ${i + 1}/${rows.length} ${insights.simpleTitle ?? row.title.slice(0, 70)}${noTitle}`);
    } else {
      result.incomplete += 1;
      log(`  ~ ${i + 1}/${rows.length} partial reply${visible ? "" : ", still hidden"}: ${row.title.slice(0, 70)}${noTitle}`);
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
  if (r.rejectedByAi) parts.push(`${r.rejectedByAi} rejected as not finance`);
  if (r.previouslyRejected) parts.push(`${r.previouslyRejected} rejected earlier`);
  if (r.errors.length) parts.push(`${r.errors.length} error(s)`);
  const stopped = r.aiStopped ? `. AI stopped early (${r.aiStopped})` : "";
  return `${parts.join(", ")} in ${secs}s${stopped}`;
}
