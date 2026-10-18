/**
 * Local ingestion without the dev server or CRON_SECRET.
 *
 *   npm run ingest                 # 10 new articles (default)
 *   npm run ingest -- --max 25     # up to 25 (hard cap: MAX_INGEST_ARTICLES)
 *   npm run ingest -- --dry-run    # fetch + filter only; no AI calls, no DB writes
 */
import { loadEnv, parseArgs, printList, runMain } from "./cli";

loadEnv();

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

  printList("Would insert:", result.candidates);
  printList("Errors:", result.errors);
  console.log(`\n${result.message}`);

  if (result.errors.length && result.inserted === 0 && !result.dryRun) process.exitCode = 1;
});
