import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { rankTopNewestArticles } from '@/lib/article-ranker';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const DEFAULT_TOP_N = 20;
const MAX_TOP_N = 100;
const COOLDOWN_MS = 45_000;

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

  try {
    const body = (await request.json()) as { topN?: unknown };
    const parsedTopN = parseTopN(body?.topN);

    if (parsedTopN === null) {
      return jsonNoStore(
        { ok: false, error: `topN must be an integer between 1 and ${MAX_TOP_N}` },
        { status: 400 }
      );
    }

    topN = parsedTopN;
  } catch {
    // Empty or invalid JSON body falls back to default top N.
  }

  rankingInProgress = true;
  lastTriggeredAt = now;

  try {
    ensureDb();
    const result = await rankTopNewestArticles(topN);

    return jsonNoStore({
      ok: true,
      topN,
      ...result,
      message: `Ranked ${result.processed} newest articles`,
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
