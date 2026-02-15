import { NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { fetchAllFeeds } from '@/lib/rss-fetcher';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

let initialized = false;

function ensureDb() {
  if (!initialized) {
    initDb();
    initialized = true;
  }
}

/**
 * Manual trigger endpoint - can be called after deployment
 * to populate the database immediately without waiting for cron
 */
export async function GET() {
  try {
    ensureDb();
    const itemsIngested = await fetchAllFeeds();

    return NextResponse.json({
      ok: true,
      itemsIngested,
      message: 'Feed populated successfully'
    });
  } catch (err: unknown) {
    console.error('Manual fetch error:', err);
    return NextResponse.json(
      { ok: false, error: 'Feed fetch failed' },
      { status: 500 }
    );
  }
}
