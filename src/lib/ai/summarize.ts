import OpenAI from "openai";
import type { KeyTerm } from "@/types/database";

// Hard caps applied after generation (safety net; prompts aim lower)
const MAX_WORDS = 60;
const WHY_MAX_WORDS = 80;

// Defaults target Groq; the model only exists there, so the URL must match
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Any OpenAI-compatible provider (OpenAI, Groq, ...). `||` so an empty
// value in .env.local falls back instead of being used as-is.
function createAiClient(apiKey: string) {
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  return {
    client: new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL,
    }),
    model,
    // Only reasoning models accept reasoning_effort; others reject it with a 400
    reasoning: /gpt-oss/i.test(model) ? { reasoning_effort: "low" as const } : {},
  };
}

// Leading labels models like to add, e.g. "**Why It Matters:**", "## Summary", "Summary:"
const LEADING_LABEL_RE =
  /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:summary|why it matters|why this matters|answer)\s*:?\s*(?:\*\*|__)?\s*:?\s*/i;

function stripLeadingLabel(text: string): string {
  return text.replace(LEADING_LABEL_RE, "").trim();
}

/** Pull the JSON payload out of a reply that may wrap it in ```json fences or prose. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}

// Prompt targets sit below the hard caps (MAX_WORDS / WHY_MAX_WORDS) so the
// model finishes its sentences; enforceWordLimit is only a safety net.
const SUMMARY_TARGET_WORDS = 45;
const WHY_TARGET_WORDS = 60;
const INSIGHTS_MAX_TOKENS = 2048;

const INSIGHTS_SYSTEM_PROMPT = `You are FinBrief's finance editor, writing for college students and young professionals.
Respond with a single JSON object and nothing else, in exactly this shape:
{"summary": string, "why_it_matters": string, "key_terms": [{"term": string, "explanation": string}]}
Rules:
- summary: under ${SUMMARY_TARGET_WORDS} words, one plain-English paragraph on what happened, why it matters for money/markets/business, and who is affected.
- why_it_matters: under ${WHY_TARGET_WORDS} words, 2-3 sentences on the real-world impact on ordinary people, the economy, jobs, startups or daily life. Neutral and educational; never investment advice.
- key_terms: 3 to 5 important finance or business terms from the article, each with a one-sentence explanation a college student would understand.
- Plain text inside strings: no markdown, no headings, no labels like "Summary:".
- Do not invent facts that are not in the source.`;

export interface ArticleInsights {
  summary: string | null;
  whyItMatters: string | null;
  keyTerms: KeyTerm[] | null;
}

export type AiUnavailableReason = "auth" | "quota" | "rate_limit" | "model" | "connection";

/**
 * The provider can't serve any request right now (bad key, no credits, unknown
 * model, ...). Callers should stop calling AI for the rest of the run.
 */
export class AiUnavailableError extends Error {
  constructor(
    readonly reason: AiUnavailableReason,
    message: string,
  ) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** Map provider errors that will repeat on every call to AiUnavailableError. */
function toAiUnavailable(err: unknown, model: string): AiUnavailableError | null {
  if (err instanceof OpenAI.APIConnectionError) {
    return new AiUnavailableError("connection", `cannot reach the AI provider (${err.message})`);
  }
  if (!(err instanceof OpenAI.APIError)) return null;

  const code = String(err.code ?? "");
  const detail = err.message.replace(/^\d{3}\s*/, "");
  if (err.status === 401 || err.status === 403) {
    return new AiUnavailableError("auth", `API key rejected (${err.status}): ${detail}`);
  }
  if (err.status === 404 || code === "model_not_found") {
    return new AiUnavailableError("model", `model "${model}" is not available: ${detail}`);
  }
  if (err.status === 429) {
    // The SDK has already retried with backoff, so this is not a brief blip
    return code === "insufficient_quota" || err.type === "insufficient_quota"
      ? new AiUnavailableError("quota", `out of credits: ${detail}`)
      : new AiUnavailableError("rate_limit", `rate limited after retries: ${detail}`);
  }
  return null;
}

function parseKeyTerms(value: unknown): KeyTerm[] | null {
  if (!Array.isArray(value)) return null;
  const terms = value
    .filter(
      (e): e is KeyTerm =>
        typeof e?.term === "string" && typeof e?.explanation === "string" && e.term.trim() !== "",
    )
    .slice(0, 5)
    .map(({ term, explanation }) => ({ term: term.trim(), explanation: explanation.trim() }));
  return terms.length > 0 ? terms : null;
}

function cleanField(value: unknown, cap: number): string | null {
  if (typeof value !== "string") return null;
  const text = stripLeadingLabel(value);
  return text ? enforceWordLimit(text, cap) : null;
}

/**
 * Summary, Why It Matters and Key Terms in one request. Fields the model
 * leaves out or malforms come back null. Returns null when no API key is set
 * or the reply is unusable; throws AiUnavailableError when the provider
 * itself is unavailable.
 */
export async function generateArticleInsights(input: {
  title: string;
  description: string | null;
}): Promise<ArticleInsights | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { client, model, reasoning } = createAiClient(apiKey);
  const userContent = [
    `Headline: ${input.title}`,
    input.description ? `Details: ${input.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string | undefined;
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: INSIGHTS_MAX_TOKENS,
      response_format: { type: "json_object" },
      ...reasoning,
      messages: [
        { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? undefined;
  } catch (err) {
    const unavailable = toAiUnavailable(err, model);
    if (unavailable) throw unavailable;
    console.warn(`[ai] request failed for "${input.title.slice(0, 60)}": ${err instanceof Error ? err.message : err}`);
    return null;
  }

  if (!raw?.trim()) {
    console.warn(`[ai] empty reply for "${input.title.slice(0, 60)}"`);
    return null;
  }

  try {
    const parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    return {
      summary: cleanField(parsed.summary, MAX_WORDS),
      whyItMatters: cleanField(parsed.why_it_matters, WHY_MAX_WORDS),
      keyTerms: parseKeyTerms(parsed.key_terms),
    };
  } catch {
    console.warn(`[ai] reply was not valid JSON for "${input.title.slice(0, 60)}"`);
    return null;
  }
}

function enforceWordLimit(text: string, limit: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(" ");
  return `${words.slice(0, limit).join(" ")}…`;
}
