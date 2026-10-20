import { NextRequest, NextResponse } from "next/server";
import { authorizeIngest } from "@/lib/api/ingest-auth";
import {
  IngestionInProgressError,
  runNewsIngestion,
} from "@/services/ingest.service";

/** Vercel Hobby: crons run once a day and functions are capped at 60s. */
export const maxDuration = 60;
/** Small batch so one run finishes inside maxDuration (each article costs AI + image lookups). */
const CRON_MAX_ARTICLES = 10;

export async function GET(request: NextRequest) {
  const auth = authorizeIngest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  try {
    const result = await runNewsIngestion({ maxArticles: CRON_MAX_ARTICLES });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof IngestionInProgressError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error("GET /api/cron/ingest:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Cron ingest failed" },
      { status: 500 },
    );
  }
}
