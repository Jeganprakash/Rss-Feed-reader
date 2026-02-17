import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getMixedFeed } from '@/lib/feed-mixer';

// Force dynamic rendering (don't try to statically generate)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let initialized = false;

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

export async function GET(request: NextRequest) {
  try {
    await ensureDb();

    const { searchParams } = request.nextUrl;
    const cursor = searchParams.get('cursor') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (limitParam && (isNaN(limit) || limit < 1 || limit > 50)) {
      return jsonNoStore(
        { error: 'limit must be between 1 and 50' },
        { status: 400 }
      );
    }

    const result = await getMixedFeed({ cursor, limit });

    return jsonNoStore(result);
  } catch (err: unknown) {
    console.error('Feed API error:', err);
    return jsonNoStore(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
