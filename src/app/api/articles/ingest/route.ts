import { NextRequest, NextResponse } from "next/server";
import { authorizeIngest } from "@/lib/api/ingest-auth";
import {
  IngestionInProgressError,
  runNewsIngestion,
} from "@/services/ingest.service";

export async function POST(request: NextRequest) {
  const auth = authorizeIngest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized", reason: auth.reason }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await runNewsIngestion({
      maxArticles: body.maxArticles,
      dryRun: body.dryRun === true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IngestionInProgressError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("POST /api/articles/ingest:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion failed" },
      { status: 500 },
    );
  }
}
