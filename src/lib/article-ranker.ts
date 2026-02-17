import { getDb } from "./db";
import type { FeedSource } from "@/types/feed";

const DEFAULT_RANK_MODEL = process.env.OPENAI_RANK_MODEL || "gpt-4o-mini";
const RANK_BATCH_SIZE = Number(process.env.RANK_BATCH_SIZE || 8);
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 12_000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 2);

interface RankCandidate {
  id: string;
  title: string;
  source: FeedSource;
  published_at: string | Date;
}

export interface ProvidedRankCandidate {
  id: string;
  title: string;
  source: FeedSource;
  publishedAt: string;
}

interface RankOutput {
  score: number;
  reason: string;
  model: string;
  usedFallback: boolean;
}

export interface RankedItem {
  itemId: string;
  importanceScore: number;
  reason: string;
  model: string;
  rankedAt: string;
  usedFallback: boolean;
}

export interface RankBatchResult {
  processed: number;
  llmRanked: number;
  fallbackRanked: number;
  failed: number;
  model: string;
  rankings: RankedItem[];
}

function clampScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return Math.min(100, Math.max(0, Math.round(parsed)));
  }
  return 50;
}

function truncateReason(reason: unknown): string {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (!text) return "Importance estimated from headline + source + recency.";
  // keep it short, single-line
  const oneLine = text.replace(/\s+/g, " ");
  return oneLine.length > 180 ? `${oneLine.slice(0, 177)}...` : oneLine;
}

function formatTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function heuristicRank(title: string): Omit<RankOutput, "model"> {
  const normalized = title.toLowerCase();

  const highImpactTerms = [
    "war",
    "attack",
    "ceasefire",
    "election",
    "inflation",
    "federal reserve",
    "interest rate",
    "rate hike",
    "rate cut",
    "policy",
    "sanction",
    "regulation",
    "earnings",
    "guidance",
    "layoff",
    "security",
    "breach",
    "outage",
    "bank",
    "default",
  ];

  const mediumImpactTerms = [
    "launch",
    "update",
    "product",
    "partnership",
    "acquisition",
    "merger",
    "funding",
    "startup",
    "chip",
    "market",
    "ipo",
  ];

  let score = 38;
  for (const term of highImpactTerms) {
    if (normalized.includes(term)) score += 10;
  }
  for (const term of mediumImpactTerms) {
    if (normalized.includes(term)) score += 4;
  }

  return {
    score: clampScore(score),
    reason: "Heuristic ranking used because LLM output was unavailable.",
    usedFallback: true,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * One-call batch rank using strict JSON schema.
 * Returns a map: itemId -> RankOutput (LLM) OR null if parsing failed.
 */
async function rankBatchWithLlm(batch: RankCandidate[]): Promise<Map<string, RankOutput | null>> {
  const out = new Map<string, RankOutput | null>();
  for (const c of batch) out.set(c.id, null);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    for (const c of batch) out.set(c.id, { ...heuristicRank(c.title), model: "heuristic-fallback" });
    return out;
  }

  // Strict JSON Schema: model must output exactly this shape.
  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "news_importance_batch",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["results"],
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "importanceScore", "reason"],
              properties: {
                id: { type: "string" },
                importanceScore: { type: "integer", minimum: 0, maximum: 100 },
                reason: { type: "string" },
              },
            },
          },
        },
      },
    },
  } as const;

  const systemPrompt = [
    "You rank news importance for a general reader deciding what to read NOW.",
    "Return JSON only (schema enforced).",
    "",
    "Scoring rubric (0-100):",
    "- 90-100: Major global/national impact, urgent, broad relevance (wars, elections, central banks, major disasters).",
    "- 70-89: Significant business/tech/policy impact or widely relevant consumer event.",
    "- 40-69: Niche but meaningful, or moderate importance.",
    "- 0-39: Minor, celebrity/viral fluff, highly niche, or low consequence.",
    "",
    "Reason rules:",
    "- One short sentence (<= 20 words), no quotes, no extra keys, no newlines.",
    "- Mention the WHY: impact + breadth + urgency (and sometimes source credibility).",
  ].join("\n");

  const userPayloadLines: string[] = [];
  userPayloadLines.push("Rank each item independently; do not compare scores across the list.");
  userPayloadLines.push("Items:");
  for (const c of batch) {
    userPayloadLines.push(
      [
        `- id: ${c.id}`,
        `  title: ${c.title}`,
        `  source: ${String(c.source)}`,
        `  publishedAt: ${formatTimestamp(c.published_at)}`,
      ].join("\n")
    );
  }

  const body = {
    model: DEFAULT_RANK_MODEL,
    temperature: 0.1,
    response_format: responseFormat,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPayloadLines.join("\n") },
    ],
  };

  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= OPENAI_MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }, OPENAI_TIMEOUT_MS);

      if (!res.ok) {
        // Retry on 429/5xx; otherwise bail
        const shouldRetry = res.status === 429 || (res.status >= 500 && res.status <= 599);
        const text = await res.text().catch(() => "");
        const err = new Error(`OpenAI request failed (${res.status}) ${text.slice(0, 300)}`);
        if (shouldRetry && attempt < OPENAI_MAX_RETRIES) {
          lastErr = err;
          await sleep(250 * Math.pow(2, attempt));
          continue;
        }
        throw err;
      }

      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI response did not include content");

      const parsed = JSON.parse(content) as { results?: Array<{ id: string; importanceScore: unknown; reason: unknown }> };
      const results = Array.isArray(parsed.results) ? parsed.results : [];

      // Fill outputs for ids we asked for (ignore any extra)
      for (const r of results) {
        if (!r || typeof r.id !== "string") continue;
        if (!out.has(r.id)) continue;

        out.set(r.id, {
          score: clampScore(r.importanceScore),
          reason: truncateReason(r.reason),
          model: DEFAULT_RANK_MODEL,
          usedFallback: false,
        });
      }

      // Any missing ids -> fallback
      for (const c of batch) {
        if (!out.get(c.id)) {
          out.set(c.id, { ...heuristicRank(c.title), model: "heuristic-fallback" });
        }
      }

      return out;
    } catch (e) {
      lastErr = e;
      if (attempt < OPENAI_MAX_RETRIES) {
        await sleep(250 * Math.pow(2, attempt));
        continue;
      }
    }
  }

  console.error("LLM batch ranking failed; falling back to heuristics:", lastErr);
  for (const c of batch) out.set(c.id, { ...heuristicRank(c.title), model: "heuristic-fallback" });
  return out;
}

async function rankCandidates(candidates: RankCandidate[]): Promise<RankBatchResult> {
  const db = getDb();

  let llmRanked = 0;
  let fallbackRanked = 0;
  let failed = 0;

  const rankings: RankedItem[] = [];

  for (let i = 0; i < candidates.length; i += RANK_BATCH_SIZE) {
    const batch = candidates.slice(i, i + RANK_BATCH_SIZE);

    const batchMap = await rankBatchWithLlm(batch);

    for (const candidate of batch) {
      const ranked = batchMap.get(candidate.id) ?? null;

      if (!ranked) {
        failed++;
        console.error(`Failed to rank item ${candidate.id}: no rank output`);
        continue;
      }

      const rankedAt = new Date().toISOString();

      // Ensure item still exists
      const exists = (await db`
        SELECT 1 AS exists
        FROM feed_items
        WHERE id = ${candidate.id}
        LIMIT 1
      `) as Array<{ exists: number }>;

      if (exists.length > 0) {
        // NOTE: Add used_fallback column if you can; if not, drop it from INSERT/UPDATE.
        await db`
          INSERT INTO item_rankings (item_id, importance_score, reason, model, ranked_at, used_fallback)
          VALUES (
            ${candidate.id},
            ${ranked.score},
            ${ranked.reason},
            ${ranked.model},
            ${rankedAt},
            ${ranked.usedFallback}
          )
          ON CONFLICT (item_id) DO UPDATE SET
            importance_score = EXCLUDED.importance_score,
            reason = EXCLUDED.reason,
            model = EXCLUDED.model,
            ranked_at = EXCLUDED.ranked_at,
            used_fallback = EXCLUDED.used_fallback
        `;
      }

      rankings.push({
        itemId: candidate.id,
        importanceScore: ranked.score,
        reason: ranked.reason,
        model: ranked.model,
        rankedAt,
        usedFallback: ranked.usedFallback,
      });

      if (ranked.usedFallback) fallbackRanked++;
      else llmRanked++;
    }
  }

  return {
    processed: candidates.length,
    llmRanked,
    fallbackRanked,
    failed,
    model: process.env.OPENAI_API_KEY ? DEFAULT_RANK_MODEL : "heuristic-fallback",
    rankings,
  };
}

/**
 * Rank the top N newest feed items and persist their importance scores.
 */
export async function rankTopNewestArticles(limit: number): Promise<RankBatchResult> {
  const db = getDb();
  const safeLimit = Math.max(1, Math.min(limit, 100));

  const candidates = (await db`
    SELECT id, title, source, published_at
    FROM feed_items
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `) as RankCandidate[];

  return rankCandidates(candidates);
}

/**
 * Rank provided items (typically from currently loaded client feed items).
 */
export async function rankProvidedArticles(
  providedItems: ProvidedRankCandidate[],
  limit: number
): Promise<RankBatchResult> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const sliced = providedItems.slice(0, safeLimit);

  const seen = new Set<string>();
  const candidates: RankCandidate[] = [];

  for (const item of sliced) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);

    candidates.push({
      id: item.id,
      title: item.title,
      source: item.source,
      published_at: item.publishedAt,
    });
  }

  return rankCandidates(candidates);
}
