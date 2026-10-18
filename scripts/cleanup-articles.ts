/**
 * Remove stored articles that fail the current keyword filter or the AI
 * relevance gate. Deleted stories are recorded so ingestion won't re-add them.
 *
 *   npm run cleanup-articles -- --dry-run     # report what would be deleted and why
 *   npm run cleanup-articles                  # actually delete
 *   npm run cleanup-articles -- --no-ai       # keyword filter only (no AI calls)
 *   npm run cleanup-articles -- --max 20      # only the 20 newest articles
 *   npm run cleanup-articles -- --delay 4000  # ms between AI checks (default 2500)
 */
import { loadEnv, parseArgs, runMain } from "./cli";
import type { CleanupDecision } from "../src/services/cleanup.service";

loadEnv();

function printDecisions(decisions: CleanupDecision[], dryRun: boolean) {
  const del = decisions.filter((d) => d.action === "delete");
  const keep = decisions.filter((d) => d.action === "keep");
  const line = (d: CleanupDecision) => {
    const title = d.title.length > 85 ? `${d.title.slice(0, 84)}...` : d.title;
    const move = d.moveTo ? `\n      move: ${d.category ?? "none"} -> ${d.moveTo}` : "";
    console.log(`  ${title}\n      [${d.by}] ${d.reason}${move}`);
  };

  console.log(`\n== ${dryRun ? "Would delete" : "Deleted"} (${del.length})`);
  del.forEach(line);
  console.log(`\n== Keep (${keep.length})`);
  keep.forEach(line);
}

runMain(async () => {
  const args = parseArgs(process.argv.slice(2), ["max", "delay", "no-ai"]);
  if (args.help) {
    console.log("Usage: npm run cleanup-articles -- [--dry-run] [--no-ai] [--max N] [--delay MS]");
    return;
  }

  const { runArticleCleanup } = await import("../src/services/cleanup.service");
  const result = await runArticleCleanup({
    dryRun: args.dryRun,
    useAi: !args.noAi,
    maxArticles: args.max,
    delayMs: args.delay,
  });

  printDecisions(result.decisions, result.dryRun);
  if (result.errors.length) {
    console.log("\nErrors:");
    for (const e of result.errors) console.log(`  - ${e}`);
  }
  console.log(`\n${result.message}`);
  if (!result.dryRun && result.toDelete > 0) {
    console.log("Deleted stories were recorded in article_rejections, so ingestion won't re-add them.");
  }

  if (result.errors.length) process.exitCode = 1;
});
