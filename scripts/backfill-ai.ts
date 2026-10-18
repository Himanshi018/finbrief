/**
 * Fill in summary / why_it_matters / key_terms for articles stored without them.
 * Those articles are hidden from the feed until this has run.
 *
 *   npm run backfill-ai                  # up to 10 articles, newest first
 *   npm run backfill-ai -- --max 30      # up to 30 (hard cap: MAX_INGEST_ARTICLES)
 *   npm run backfill-ai -- --dry-run     # list what's pending; no AI calls, no DB writes
 *   npm run backfill-ai -- --delay 8000  # ms between articles (default 5000, for Groq's free tier)
 */
import { loadEnv, parseArgs, printList, runMain } from "./cli";

loadEnv();

runMain(async () => {
  const args = parseArgs(process.argv.slice(2), ["max", "delay"]);
  if (args.help) {
    console.log("Usage: npm run backfill-ai -- [--max N] [--delay MS] [--dry-run]");
    return;
  }

  const { runAiBackfill, MAX_INGEST_ARTICLES } = await import("../src/services/ingest.service");

  if (args.max !== undefined && args.max > MAX_INGEST_ARTICLES) {
    console.warn(`--max ${args.max} exceeds the cap; using ${MAX_INGEST_ARTICLES}`);
  }

  const result = await runAiBackfill({
    maxArticles: args.max,
    dryRun: args.dryRun,
    delayMs: args.delay,
  });

  printList("Would backfill:", result.candidates);
  printList("Errors:", result.errors);
  console.log(`\n${result.message}`);

  if ((result.errors.length || result.aiStopped) && result.updated === 0 && !result.dryRun) {
    process.exitCode = 1;
  }
});
