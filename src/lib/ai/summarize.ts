import OpenAI from "openai";
import type { KeyTerm } from "@/types/database";

const MAX_WORDS = 60;
const WHY_MAX_WORDS = 80;

const SYSTEM_PROMPT = `You are FinBrief's finance editor. Summarize news for beginners.
Rules:
- Maximum ${MAX_WORDS} words.
- Plain English; explain jargon in simple terms when needed.
- Focus on what happened, why it matters for money/markets/business, and who is affected.
- No bullet points, no markdown, one short paragraph.
- Do not invent facts not present in the source.`;

const WHY_SYSTEM_PROMPT = `You are a finance teacher explaining to college students and young professionals.`;

// Defaults target Groq; the model only exists there, so the URL must match
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

// Reasoning models spend hidden tokens before answering, and those count
// against max_tokens. Limits are generous; the prompts' word limits plus
// enforceWordLimit keep the visible output short.
const SUMMARY_MAX_TOKENS = 1024;
const WHY_MAX_TOKENS = 1024;
const KEY_TERMS_MAX_TOKENS = 1536;

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

export async function summarizeArticle(input: {
  title: string;
  description: string | null;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackSummary(input.title, input.description);
  }

  const { client, model, reasoning } = createAiClient(apiKey);

  const userContent = [
    `Headline: ${input.title}`,
    input.description ? `Details: ${input.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: SUMMARY_MAX_TOKENS,
      ...reasoning,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const text = stripLeadingLabel(completion.choices[0]?.message?.content ?? "");
    if (!text) return fallbackSummary(input.title, input.description);
    return enforceWordLimit(text, MAX_WORDS);
  } catch (err) {
    console.error("AI summarization failed:", err);
    return fallbackSummary(input.title, input.description);
  }
}

export async function generateWhyItMatters(input: {
  title: string;
  summary: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { client, model, reasoning } = createAiClient(apiKey);

  const userContent = `Article headline: ${input.title}\nArticle summary: ${input.summary}\n\nWrite a "Why It Matters" section (2-4 sentences maximum) in simple, clear English.\nExplain the real-world impact on ordinary people, economy, jobs, startups, or daily life.\nBe neutral, educational, and never give investment advice.\nFocus on understanding, not speculation.`;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: WHY_MAX_TOKENS,
      ...reasoning,
      messages: [
        { role: "system", content: WHY_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const text = stripLeadingLabel(completion.choices[0]?.message?.content ?? "");
    if (!text) return null;
    return enforceWordLimit(text, WHY_MAX_WORDS);
  } catch (err) {
    console.error("Why it matters generation failed:", err);
    return null;
  }
}

export async function generateKeyTerms(input: {
  title: string;
  summary: string;
}): Promise<KeyTerm[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { client, model, reasoning } = createAiClient(apiKey);

  const userContent = `Article: ${input.title}\nSummary: ${input.summary}\n\nIdentify 3 to 5 important finance or business terms from this article. For each, write a one-sentence plain-English explanation a college student would understand.\n\nReturn ONLY a JSON array, no extra text:\n[{"term": "...", "explanation": "..."}, ...]`;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: KEY_TERMS_MAX_TOKENS,
      ...reasoning,
      messages: [
        { role: "system", content: "You are a finance teacher. Respond only with a valid JSON array." },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(extractJson(raw)) as unknown;

    if (!Array.isArray(parsed)) return null;
    return (parsed as Array<{ term: unknown; explanation: unknown }>)
      .filter((e) => typeof e.term === "string" && typeof e.explanation === "string")
      .slice(0, 5)
      .map(({ term, explanation }) => ({ term: term as string, explanation: explanation as string }));
  } catch (err) {
    console.error("Key terms generation failed:", err);
    return null;
  }
}

function fallbackSummary(title: string, description: string | null): string {
  const base = description?.trim() || title;
  return enforceWordLimit(base, MAX_WORDS);
}

function enforceWordLimit(text: string, limit: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return words.join(" ");
  return `${words.slice(0, limit).join(" ")}…`;
}
