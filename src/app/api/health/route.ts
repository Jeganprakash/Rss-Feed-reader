import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import type { FeedSource } from '@/types/feed';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

let initialized = false;

function ensureDb() {
  if (!initialized) {
    initDb();
    initialized = true;
  }
}

export async function GET() {
  try {
    ensureDb();
    const db = getDb();

    const rows = db
      .prepare('SELECT source, last_fetch_time FROM source_metadata')
      .all() as { source: FeedSource; last_fetch_time: string | null }[];

    const lastFetchTime: Record<string, string | null> = {};
    for (const row of rows) {
      lastFetchTime[row.source.toLowerCase()] = row.last_fetch_time;
    }

    return NextResponse.json({ ok: true, lastFetchTime });
  } catch (err: unknown) {
    console.error('Health API error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
