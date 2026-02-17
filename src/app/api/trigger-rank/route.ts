import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import type { FeedSource } from '@/types/feed';
import { rankTopNewestArticles, rankProvidedArticles } from '@/lib/article-ranker';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const DEFAULT_TOP_N = 20;
const MAX_TOP_N = 100;
const COOLDOWN_MS = 45_000;
const VALID_SOURCES: FeedSource[] = ['REUTERS', 'THE_VERGE', 'TECHCRUNCH'];

let initialized = false;
let rankingInProgress = false;
let lastTriggeredAt = 0;

function ensureDb() {
  if (!initialized) {
    initDb();
    initialized = true;
  }
}

function jsonNoStore(body: object, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...init?.headers,
      'Cache-Control': 'no-store',
    },
  });
}

function parseTopN(value: unknown): number | null {
  if (typeof value === 'undefined') return DEFAULT_TOP_N;

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }

  if (value < 1 || value > MAX_TOP_N) {
    return null;
  }

  return value;
}

function parseProvidedItems(
  value: unknown,
  topN: number
): Array<{ id: string; title: string; source: FeedSource; publishedAt: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: Array<{
    id: string;
    title: string;
    source: FeedSource;
    publishedAt: string;
  }> = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (parsed.length >= topN) break;
    if (!item || typeof item !== 'object') continue;

    const candidate = item as Record<string, unknown>;
    const id = candidate.id;
    const title = candidate.title;
    const source = candidate.source;
    const publishedAt = candidate.publishedAt;

    if (
      typeof id !== 'string' ||
      typeof title !== 'string' ||
      typeof source !== 'string' ||
      typeof publishedAt !== 'string'
    ) {
      continue;
    }

    if (!id.trim() || !title.trim() || !VALID_SOURCES.includes(source as FeedSource)) {
      continue;
    }

    if (seen.has(id)) continue;
    seen.add(id);

    parsed.push({
      id: id.trim(),
      title: title.trim(),
      source: source as FeedSource,
      publishedAt: publishedAt.trim(),
    });
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  if (rankingInProgress) {
    return jsonNoStore(
      { ok: false, error: 'Ranking is already running. Please wait.' },
      { status: 409 }
    );
  }

  const now = Date.now();
  const elapsed = now - lastTriggeredAt;
  if (elapsed < COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return jsonNoStore(
      {
        ok: false,
        error: `Please wait ${retryAfterSeconds}s before ranking again.`,
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    );
  }

  let topN = DEFAULT_TOP_N;
  let providedItems: Array<{
    id: string;
    title: string;
    source: FeedSource;
    publishedAt: string;
  }> = [];

  try {
    const body = (await request.json()) as { topN?: unknown; items?: unknown };
    const parsedTopN = parseTopN(body?.topN);

    if (parsedTopN === null) {
      return jsonNoStore(
        { ok: false, error: `topN must be an integer between 1 and ${MAX_TOP_N}` },
        { status: 400 }
      );
    }

    topN = parsedTopN;
    providedItems = parseProvidedItems(body?.items, topN);
  } catch {
    // Empty or invalid JSON body falls back to default top N.
  }

  rankingInProgress = true;
  lastTriggeredAt = now;

  try {
    ensureDb();
    let result = await rankTopNewestArticles(topN);
    let usedProvidedItems = false;

    if (result.processed === 0 && providedItems.length > 0) {
      result = await rankProvidedArticles(providedItems, topN);
      usedProvidedItems = true;
    }

    const message =
      result.processed === 0
        ? 'No articles available to rank.'
        : usedProvidedItems
          ? `Ranked ${result.processed} loaded articles`
          : `Ranked ${result.processed} newest articles`;

    return jsonNoStore({
      ok: true,
      topN,
      usedProvidedItems,
      ...result,
      message,
    });
  } catch (error: unknown) {
    console.error('Manual rank error:', error);
    return jsonNoStore(
      { ok: false, error: 'Article ranking failed' },
      { status: 500 }
    );
  } finally {
    rankingInProgress = false;
  }
}
