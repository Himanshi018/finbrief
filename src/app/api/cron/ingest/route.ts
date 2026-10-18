import { NextRequest, NextResponse } from "next/server";
import { authorizeIngest } from "@/lib/api/ingest-auth";
import {
  IngestionInProgressError,
  runNewsIngestion,
} from "@/services/ingest.service";

export async function GET(request: NextRequest) {
  const auth = authorizeIngest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  try {
    const result = await runNewsIngestion({ maxArticles: 25 });
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
