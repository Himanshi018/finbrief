/**
 * Local ingestion without the dev server or CRON_SECRET.
 *
 *   npm run ingest                 # 10 new articles (default)
 *   npm run ingest -- --max 25     # up to 25 (hard cap: MAX_INGEST_ARTICLES)
 *   npm run ingest -- --dry-run    # fetch + filter only; no AI calls, no DB writes
 */
import { loadEnv, parseArgs, printList, runMain } from "./cli";
import type { FilterDecision } from "../src/lib/newsapi/client";

loadEnv();

/** Per-category filter report for tuning the rules in src/lib/constants/categories.ts. */
function printDecisions(decisions: FilterDecision[]) {
  const byCategory = new Map<string, FilterDecision[]>();
  for (const d of decisions) byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]);

  for (const [category, list] of byCategory) {
    const kept = list.filter((d) => d.accepted).length;
    console.log(`\n== ${category}: ${kept} accepted, ${list.length - kept} rejected`);
    for (const d of list) {
      const title = d.title.length > 80 ? `${d.title.slice(0, 79)}...` : d.title;
      console.log(`  ${d.accepted ? "ACCEPT" : "reject"}  ${title}`);
      console.log(`          ${d.reason}  [${d.source}]`);
    }
  }
}

runMain(async () => {
  const args = parseArgs(process.argv.slice(2), ["max"]);
  if (args.help) {
    console.log("Usage: npm run ingest -- [--max N] [--dry-run]");
    return;
  }

  // Imported after env loading so module-level reads see .env.local
  const { runNewsIngestion, MAX_INGEST_ARTICLES } = await import(
    "../src/services/ingest.service"
  );

  if (args.max !== undefined && args.max > MAX_INGEST_ARTICLES) {
    console.warn(`--max ${args.max} exceeds the cap; using ${MAX_INGEST_ARTICLES}`);
  }

  const result = await runNewsIngestion({ maxArticles: args.max, dryRun: args.dryRun });

  if (result.decisions?.length) printDecisions(result.decisions);
  printList("Would insert (round-robin across categories):", result.candidates);
  printList("Errors:", result.errors);
  console.log(`\n${result.message}`);

  if (result.errors.length && result.inserted === 0 && !result.dryRun) process.exitCode = 1;
});
