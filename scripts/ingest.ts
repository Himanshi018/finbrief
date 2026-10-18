/**
 * Local ingestion without the dev server or CRON_SECRET.
 *
 *   npm run ingest                 # 10 new articles (default)
 *   npm run ingest -- --max 25     # up to 25 (hard cap: MAX_INGEST_ARTICLES)
 *   npm run ingest -- --dry-run    # fetch + filter only; no AI calls, no DB writes
 */
import { loadEnvConfig } from "@next/env";

// Same .env.local loading rules as `next dev`
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

function parseArgs(argv: string[]) {
  const args = { max: undefined as number | undefined, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--max") args.max = Number(argv[++i]);
    else if (arg.startsWith("--max=")) args.max = Number(arg.slice("--max=".length));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.max !== undefined && !(Number.isInteger(args.max) && args.max > 0)) {
    throw new Error("--max must be a positive whole number");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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

  if (result.candidates?.length) {
    console.log("\nWould insert:");
    for (const title of result.candidates) console.log(`  - ${title}`);
  }
  if (result.errors.length) {
    console.log("\nErrors:");
    for (const e of result.errors) console.log(`  - ${e}`);
  }
  console.log(`\n${result.message}`);

  if (result.errors.length && result.inserted === 0 && !result.dryRun) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
