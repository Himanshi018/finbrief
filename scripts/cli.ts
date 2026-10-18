/** Shared helpers for the npm scripts in this folder. */
import { loadEnvConfig } from "@next/env";

/** Load .env.local with the same rules as `next dev`. Call before importing src/ modules. */
export function loadEnv() {
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
}

export interface CliArgs {
  max?: number;
  delay?: number;
  dryRun: boolean;
  noAi: boolean;
  help: boolean;
}

/** Parses --max N, --delay MS, --no-ai, --dry-run, --help (also --max=N / --delay=MS). */
export function parseArgs(argv: string[], allowed: ("max" | "delay" | "no-ai")[]): CliArgs {
  const args: CliArgs = { dryRun: false, noAi: false, help: false };

  const readNumber = (flag: "max" | "delay", raw: string | undefined, min: number) => {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min) {
      throw new Error(`--${flag} must be a whole number${min > 0 ? " greater than 0" : " (0 or more)"}`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split("=", 2);
    if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--help" || flag === "-h") args.help = true;
    else if (flag === "--no-ai" && allowed.includes("no-ai")) args.noAi = true;
    else if (flag === "--max" && allowed.includes("max")) args.max = readNumber("max", inline ?? argv[++i], 1);
    else if (flag === "--delay" && allowed.includes("delay")) args.delay = readNumber("delay", inline ?? argv[++i], 0);
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

export function printList(heading: string, items: string[] | undefined) {
  if (!items?.length) return;
  console.log(`\n${heading}`);
  for (const item of items) console.log(`  - ${item}`);
}

export function runMain(main: () => Promise<void>) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
