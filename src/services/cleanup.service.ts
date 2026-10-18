import { evaluateArticle } from "@/lib/newsapi/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractDomain } from "@/lib/utils/cn";
import type { CategorySlug } from "@/types/database";
import {
  createAiStep,
  createRejectionStore,
  type RejectionRecord,
} from "@/services/ingest.service";

/** Relevance-only calls are small (~250 tokens), so they can run faster than backfill. */
export const DEFAULT_CLEANUP_DELAY_MS = 2500;
/** Safety cap on how many stored articles one run looks at. */
export const MAX_CLEANUP_ARTICLES = 500;

export interface CleanupOptions {
  /** Report only: no deletions (AI checks still run unless useAi is false). */
  dryRun?: boolean;
  /** Check at most this many articles, newest first. Default: all (up to the cap). */
  maxArticles?: number;
  /** Also ask the AI relevance gate about articles the keyword filter keeps. */
  useAi?: boolean;
  delayMs?: number;
}

export interface CleanupDecision {
  id: string;
  title: string;
  action: "delete" | "keep";
  /** Which check decided: the keyword filter, the AI gate, or neither. */
  by: "filter" | "ai" | "none";
  reason: string;
  /** Kept, but belongs in another category (e.g. sanctions/oil stories -> global-finance). */
  moveTo?: CategorySlug;
  /** Current category, shown alongside moveTo. */
  category?: string | null;
}

export interface CleanupResult {
  message: string;
  dryRun: boolean;
  checked: number;
  toDelete: number;
  deleted: number;
  toMove: number;
  moved: number;
  aiChecks: number;
  aiStopped: string | null;
  decisions: CleanupDecision[];
  warnings: string[];
  errors: string[];
}

const log = (...args: unknown[]) => console.log("[cleanup]", ...args);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface StoredArticle {
  id: string;
  external_id: string;
  title: string;
  description: string | null;
  url: string;
  category: { slug: string } | null;
}

/**
 * Re-run the current keyword filter and the AI relevance gate over stored
 * articles and delete the ones that fail. Deleted stories are recorded in
 * article_rejections so ingestion won't bring them back.
 */
export async function runArticleCleanup(options?: CleanupOptions): Promise<CleanupResult> {
  const startedAt = Date.now();
  const dryRun = options?.dryRun ?? false;
  const useAi = options?.useAi ?? true;
  const delayMs = Math.max(0, options?.delayMs ?? DEFAULT_CLEANUP_DELAY_MS);
  const limit = Math.min(Math.max(1, options?.maxArticles ?? MAX_CLEANUP_ARTICLES), MAX_CLEANUP_ARTICLES);
  const supabase = createAdminClient();
  const ai = createAiStep();

  const result: CleanupResult = {
    message: "",
    dryRun,
    checked: 0,
    toDelete: 0,
    deleted: 0,
    toMove: 0,
    moved: 0,
    aiChecks: 0,
    aiStopped: null,
    decisions: [],
    warnings: [],
    errors: [],
  };
  const rejections = createRejectionStore(result.warnings);

  const finish = () => {
    result.aiChecks = ai.calls;
    result.aiStopped = ai.stopped;
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    const kept = result.checked - result.toDelete;
    result.message = dryRun
      ? `Dry run: ${result.toDelete} of ${result.checked} article(s) would be deleted, ${kept} kept, ${result.toMove} recategorised (${result.aiChecks} AI checks) in ${secs}s`
      : `Deleted ${result.deleted} of ${result.checked} article(s), ${kept} kept, ${result.moved} recategorised (${result.aiChecks} AI checks) in ${secs}s`;
    if (result.aiStopped) {
      result.message += `. AI stopped early (${result.aiStopped}); unchecked articles were kept`;
    }
    log(result.message);
    for (const w of result.warnings) log("warning:", w);
    return result;
  };

  if (useAi && !ai.aiEnabled) {
    result.warnings.push("OPENAI_API_KEY is not set: only the keyword filter was applied");
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id,external_id,title,description,url,category:categories(slug)")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    result.errors.push(error.message);
    return finish();
  }

  const rows = (data ?? []) as unknown as StoredArticle[];
  result.checked = rows.length;
  log(`checking ${rows.length} article(s)${useAi && ai.aiEnabled ? " with the keyword filter and AI gate" : " with the keyword filter"}${dryRun ? " (dry run)" : ""}`);

  const doomed: (StoredArticle & { reason: string })[] = [];
  const moves: { id: string; to: CategorySlug }[] = [];
  const decide = (
    row: StoredArticle,
    d: Omit<CleanupDecision, "id" | "title" | "category">,
    targetCategory?: CategorySlug,
  ) => {
    const current = row.category?.slug ?? null;
    const moveTo =
      d.action === "keep" && targetCategory && targetCategory !== current ? targetCategory : undefined;
    result.decisions.push({ id: row.id, title: row.title, ...d, category: current, moveTo });
    if (d.action === "delete") doomed.push({ ...row, reason: d.reason });
    if (moveTo) moves.push({ id: row.id, to: moveTo });
  };

  for (const row of rows) {
    // 1. Current keyword filter (free)
    const verdict = evaluateArticle(row.title, row.description, extractDomain(row.url));
    if (!verdict.accepted) {
      decide(row, { action: "delete", by: "filter", reason: verdict.reason });
      continue;
    }
    if (!useAi || !ai.aiEnabled || ai.stopped) {
      decide(row, { action: "keep", by: "filter", reason: verdict.reason }, verdict.category);
      continue;
    }

    // 2. AI relevance gate
    if (ai.calls > 0 && delayMs > 0) await sleep(delayMs);
    const relevance = await ai.checkRelevance({ title: row.title, description: row.description });
    if (!relevance) {
      decide(
        row,
        { action: "keep", by: "none", reason: ai.stopped ? "AI unavailable; kept" : "AI reply unusable; kept" },
        verdict.category,
      );
    } else if (!relevance.relevant) {
      decide(row, { action: "delete", by: "ai", reason: relevance.reason });
    } else {
      decide(row, { action: "keep", by: "ai", reason: relevance.reason }, verdict.category);
    }
  }

  result.toDelete = doomed.length;
  result.toMove = moves.length;
  if (dryRun) return finish();

  // Recategorise kept stories first; independent of the deletions below
  for (const target of new Set(moves.map((m) => m.to))) {
    const { data: cat, error: catError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", target)
      .maybeSingle();
    if (catError || !cat) {
      result.errors.push(`category "${target}" not found; articles not moved`);
      continue;
    }
    const ids = moves.filter((m) => m.to === target).map((m) => m.id);
    const { error: moveError, count: movedCount } = await supabase
      .from("articles")
      .update({ category_id: cat.id }, { count: "exact" })
      .in("id", ids);
    if (moveError) result.errors.push(`move to ${target} failed: ${moveError.message}`);
    else result.moved += movedCount ?? ids.length;
  }

  if (doomed.length === 0) return finish();

  // Record first so a deleted story can't be re-ingested, then delete
  const records: RejectionRecord[] = doomed.map((row) => ({
    external_id: row.external_id,
    title: row.title,
    reason: `cleanup: ${row.reason}`,
  }));
  await rejections.add(records);

  const { error: deleteError, count } = await supabase
    .from("articles")
    .delete({ count: "exact" })
    .in(
      "id",
      doomed.map((row) => row.id),
    );
  if (deleteError) {
    result.errors.push(`delete failed: ${deleteError.message}`);
    return finish();
  }
  result.deleted = count ?? doomed.length;
  return finish();
}
