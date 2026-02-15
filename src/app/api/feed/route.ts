import { NextRequest, NextResponse } from 'next/server';
import { initDb } from '@/lib/db';
import { getMixedFeed } from '@/lib/feed-mixer';

let initialized = false;

function ensureDb() {
  if (!initialized) {
    initDb();
    initialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    ensureDb();

    const { searchParams } = request.nextUrl;
    const cursor = searchParams.get('cursor') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (limitParam && (isNaN(limit) || limit < 1 || limit > 50)) {
      return NextResponse.json(
        { error: 'limit must be between 1 and 50' },
        { status: 400 }
      );
    }

    const result = getMixedFeed({ cursor, limit });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Feed API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
