import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { fetchAllFeeds } from '@/lib/rss-fetcher';
import { getMixedFeed } from '@/lib/feed-mixer';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const COOLDOWN_MS = 60_000;

let initialized = false;
let fetchInProgress = false;
let lastTriggeredAt = 0;

async function ensureDb() {
  if (!initialized) {
    await initDb();
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

async function runManualFetch() {
  if (fetchInProgress) {
    return jsonNoStore(
      { ok: false, error: 'Feed pull is already running. Please wait.' },
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
        error: `Please wait ${retryAfterSeconds}s before pulling again.`,
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  fetchInProgress = true;
  lastTriggeredAt = now;

  try {
    await ensureDb();
    const itemsIngested = await fetchAllFeeds();
    const snapshot = await getMixedFeed({ limit: 20 });

    return jsonNoStore(
      {
        ok: true,
        itemsIngested,
        message: 'Feed pull completed successfully',
        items: snapshot.items,
        nextCursor: snapshot.nextCursor,
        hasMore: snapshot.hasMore,
      }
    );
  } catch (err: unknown) {
    console.error('Manual fetch error:', err);
    return jsonNoStore(
      { ok: false, error: 'Feed fetch failed' },
      { status: 500 }
    );
  } finally {
    fetchInProgress = false;
  }
}

/**
 * Manual trigger endpoint - can be called after deployment
 * to populate the database immediately without waiting for cron
 */
export async function POST() {
  return runManualFetch();
}
