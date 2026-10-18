import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listArticles } from "@/services/articles.service";

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(30).optional(),
  category: z
    .enum([
      "markets",
      "startups",
      "economy",
      "fintech",
      "ai-business",
      "global-finance",
    ])
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { articles, nextCursor } = await listArticles({
      category: parsed.data.category ?? null,
      cursor: parsed.data.cursor ?? null,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ articles, nextCursor });
  } catch (err) {
    console.error("GET /api/articles:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load articles" },
      { status: 500 },
    );
  }
}
