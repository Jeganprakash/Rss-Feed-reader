import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import type { FeedSource } from '@/types/feed';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let initialized = false;

async function ensureDb() {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
}

export async function GET() {
  try {
    await ensureDb();
    const db = getDb();

    const rows = (await db`
      SELECT source, last_fetch_time FROM source_metadata
    `) as Array<{ source: FeedSource; last_fetch_time: string | Date | null }>;

    const lastFetchTime: Record<string, string | null> = {};
    for (const row of rows) {
      lastFetchTime[row.source.toLowerCase()] =
        row.last_fetch_time instanceof Date
          ? row.last_fetch_time.toISOString()
          : row.last_fetch_time;
    }

    const totalRows = (await db`
      SELECT COUNT(*)::int AS count FROM feed_items
    `) as Array<{ count: number }>;

    const totalItems = Number(totalRows[0]?.count ?? 0);
    const sourceRows = (await db`
      SELECT source, COUNT(*)::int AS count
      FROM feed_items
      GROUP BY source
      ORDER BY source
    `) as Array<{ source: string; count: number }>;
    const sourceItemCounts: Record<string, number> = {};
    for (const row of sourceRows) {
      sourceItemCounts[row.source] = Number(row.count);
    }

    return NextResponse.json({
      ok: true,
      lastFetchTime,
      totalItems,
      sourceItemCounts,
    });
  } catch (err: unknown) {
    console.error('Health API error:', err);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
