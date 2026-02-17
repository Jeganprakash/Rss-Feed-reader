import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { fetchAllFeeds } from '@/lib/rss-fetcher';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const COOLDOWN_MS = 60_000;

let initialized = false;
let fetchInProgress = false;
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
    ensureDb();
    const itemsIngested = await fetchAllFeeds();

    return jsonNoStore(
      {
        ok: true,
        itemsIngested,
        message: 'Feed pull completed successfully',
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

export async function GET() {
  return runManualFetch();
}
