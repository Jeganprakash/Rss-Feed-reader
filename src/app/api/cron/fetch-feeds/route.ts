import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { fetchAllFeeds } from '@/lib/rss-fetcher';

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

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDb();
    const itemsIngested = await fetchAllFeeds();

    return NextResponse.json({ ok: true, itemsIngested });
  } catch (err: unknown) {
    console.error('Cron fetch error:', err);
    return NextResponse.json(
      { ok: false, error: 'Feed fetch failed' },
      { status: 500 }
    );
  }
}
