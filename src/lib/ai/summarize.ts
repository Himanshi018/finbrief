import OpenAI from "openai";
import { CLICKBAIT_TITLE_PATTERNS } from "@/lib/constants/categories";
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
const TITLE_TARGET_WORDS = 12;
/** A simple_title longer than this is discarded (the UI falls back to the original title). */
const TITLE_MAX_WORDS = 16;
const INSIGHTS_MAX_TOKENS = 2048;
const RELEVANCE_MAX_TOKENS = 512;

/** Shared by the ingest call and the cleanup check so both judge the same way. */
const RELEVANCE_RULES = `Relevance rules:
- Relevant: markets and stocks news, banking, RBI / SEBI / central banks and regulators, the economy (inflation, GDP, jobs data, budgets, trade, oil prices, mortgage and interest rates), real estate and property markets (including big land or property deals), companies' business results and deals, startup funding, personal finance, fintech, payments and crypto, AI business (funding, revenue, deals).
- Also relevant: geopolitics with a direct market or economic impact, such as attacks on oil tankers or shipping routes, oil supply disruptions, sanctions (imposed, passed or paused), trade deals, tariffs and export controls.
- Not relevant: crime, accidents, sports, elections, campaigns, party politics, legislative majorities and other politics without a clear economic angle, shopping deals and product discounts, consumer tech or gadget launches, entertainment, health or food-safety rules, local news, stock tips or price predictions.
- Judge the story itself, not the publisher or passing mentions: a crime story that mentions money is still crime, and a real news story from a repost or stock-tips site is still news.
- Stock-picking content is NOT relevant even though it is about stocks: whether to buy, sell or hold a stock, price targets or "upside", fair-value estimates, "how investors are reacting", "history says patient investors get rewarded". FinBrief explains news; it is not a stock-tips app.
- relevance_reason: one short sentence explaining the decision.`;

const INSIGHTS_SYSTEM_PROMPT = `You are FinBrief's finance editor, writing for college students and young professionals.
Respond with a single JSON object and nothing else, in exactly this shape:
{"is_finance_relevant": boolean, "relevance_reason": string, "simple_title": string, "summary": string, "why_it_matters": string, "key_terms": [{"term": string, "explanation": string}]}
${RELEVANCE_RULES}
If is_finance_relevant is false, return "" for the text fields and [] for key_terms.
Rules for relevant stories:
- simple_title: a clear, factual headline in plain English, at most ${TITLE_TARGET_WORDS} words, saying what actually happened. Not a question. No hype or clickbait ("could soar", "you won't believe", "here's why"). Keep the key names and numbers. No trailing full stop.
- summary: under ${SUMMARY_TARGET_WORDS} words, one plain-English paragraph on what happened, why it matters for money/markets/business, and who is affected.
- why_it_matters: under ${WHY_TARGET_WORDS} words, 2-3 sentences on the real-world impact on ordinary people, the economy, jobs, startups or daily life. Neutral and educational; never investment advice.
- key_terms: 3 to 5 important finance or business terms from the article, each with a one-sentence explanation a college student would understand.
- Plain text inside strings: no markdown, no headings, no labels like "Summary:".
- Do not invent facts that are not in the source.`;

export interface ArticleInsights {
  /** AI relevance gate; false means "not finance, don't store". null if the model omitted it. */
  isFinanceRelevant: boolean | null;
  relevanceReason: string | null;
  simpleTitle: string | null;
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
 * Validate the plain-English headline. Rather than truncate a bad one, return
 * null so the UI shows the original title: a cut-off headline reads worse.
 */
function cleanSimpleTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/^\s*(?:\*\*)?(?:simple[ _]title|headline|title)\s*:?\s*(?:\*\*)?\s*/i, "")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim();
  if (!text || text.endsWith("?")) return null;
  if (text.split(" ").length > TITLE_MAX_WORDS) return null;
  if (CLICKBAIT_TITLE_PATTERNS.some((pattern) => pattern.test(text))) return null;
  return text;
}

interface ArticleInput {
  title: string;
  description: string | null;
}

function toUserContent(input: ArticleInput): string {
  return [`Headline: ${input.title}`, input.description ? `Details: ${input.description}` : ""]
    .filter(Boolean)
    .join("\n");
}

/**
 * One JSON-mode chat request. Returns the parsed object, or null when the
 * reply is missing or unusable (logged as one line). Throws
 * AiUnavailableError when the provider itself is unavailable.
 */
async function requestJson(
  input: ArticleInput,
  systemPrompt: string,
  maxTokens: number,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { client, model, reasoning } = createAiClient(apiKey);
  const label = input.title.slice(0, 60);

  let raw: string | undefined;
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      ...reasoning,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: toUserContent(input) },
      ],
    });
    raw = completion.choices[0]?.message?.content ?? undefined;
  } catch (err) {
    const unavailable = toAiUnavailable(err, model);
    if (unavailable) throw unavailable;
    console.warn(`[ai] request failed for "${label}": ${err instanceof Error ? err.message : err}`);
    return null;
  }

  if (!raw?.trim()) {
    console.warn(`[ai] empty reply for "${label}"`);
    return null;
  }
  try {
    return JSON.parse(extractJson(raw)) as Record<string, unknown>;
  } catch {
    console.warn(`[ai] reply was not valid JSON for "${label}"`);
    return null;
  }
}

function parseRelevance(parsed: Record<string, unknown>) {
  const relevant = parsed.is_finance_relevant;
  const reason = parsed.relevance_reason;
  return {
    isFinanceRelevant: typeof relevant === "boolean" ? relevant : null,
    relevanceReason: typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 200) : null,
  };
}

/**
 * Relevance gate, Simple title, Summary, Why It Matters and Key Terms in one
 * request. Fields the model leaves out or malforms come back null; when the
 * gate says "not finance" the content fields are null too. Returns null when
 * no API key is set or the reply is unusable; throws AiUnavailableError when
 * the provider itself is unavailable.
 */
export async function generateArticleInsights(input: ArticleInput): Promise<ArticleInsights | null> {
  const parsed = await requestJson(input, INSIGHTS_SYSTEM_PROMPT, INSIGHTS_MAX_TOKENS);
  if (!parsed) return null;

  const relevance = parseRelevance(parsed);
  if (relevance.isFinanceRelevant === false) {
    return { ...relevance, simpleTitle: null, summary: null, whyItMatters: null, keyTerms: null };
  }
  return {
    ...relevance,
    simpleTitle: cleanSimpleTitle(parsed.simple_title),
    summary: cleanField(parsed.summary, MAX_WORDS),
    whyItMatters: cleanField(parsed.why_it_matters, WHY_MAX_WORDS),
    keyTerms: parseKeyTerms(parsed.key_terms),
  };
}

const RELEVANCE_SYSTEM_PROMPT = `You are FinBrief's finance editor. Decide whether a news story belongs in a finance news app.
Respond with a single JSON object and nothing else: {"is_finance_relevant": boolean, "relevance_reason": string}
${RELEVANCE_RULES}`;

/**
 * Relevance gate only (no summaries): a cheap check for stories already in
 * the database. Returns null when no API key is set or the reply is unusable.
 */
export async function checkFinanceRelevance(
  input: ArticleInput,
): Promise<{ relevant: boolean; reason: string } | null> {
  const parsed = await requestJson(input, RELEVANCE_SYSTEM_PROMPT, RELEVANCE_MAX_TOKENS);
  if (!parsed) return null;
  const { isFinanceRelevant, relevanceReason } = parseRelevance(parsed);
  if (isFinanceRelevant === null) return null;
  return { relevant: isFinanceRelevant, reason: relevanceReason ?? "(no reason given)" };
}

function enforceWordLimit(text: string, limit: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(" ");
  return `${words.slice(0, limit).join(" ")}…`;
}
