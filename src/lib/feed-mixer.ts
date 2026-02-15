import { getDb } from './db';
import type { FeedItem, FeedSource } from '../types/feed';

const ALL_SOURCES: FeedSource[] = ['REUTERS', 'THE_VERGE', 'TECHCRUNCH'];

interface FeedQueryOptions {
  cursor?: string;
  limit?: number;
}

/**
 * Fair mixing: pull items from each source proportionally (1:1:1),
 * falling back to other sources when a queue is exhausted.
 * Uses cursor-based pagination.
 */
export function getMixedFeed(options: FeedQueryOptions = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);

  // Determine the cursor's created_at for pagination
  let cursorCreatedAt: string | null = null;
  if (options.cursor) {
    const row = db
      .prepare('SELECT created_at FROM feed_items WHERE id = ?')
      .get(options.cursor) as { created_at: string } | undefined;
    cursorCreatedAt = row?.created_at || null;
  }

  // Build per-source queues
  const sourceQueues = new Map<FeedSource, FeedItem[]>();

  for (const source of ALL_SOURCES) {
    let rows: Record<string, unknown>[];
    if (cursorCreatedAt) {
      rows = db
        .prepare(
          `SELECT * FROM feed_items
           WHERE source = ? AND created_at < ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(source, cursorCreatedAt, limit) as Record<string, unknown>[];
    } else {
      rows = db
        .prepare(
          `SELECT * FROM feed_items
           WHERE source = ?
           ORDER BY created_at DESC
           LIMIT ?`
        )
        .all(source, limit) as Record<string, unknown>[];
    }

    sourceQueues.set(
      source,
      rows.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        title: row.title as string,
        source: row.source as FeedSource,
        publishedAt: row.published_at as string,
        urlOriginal: (row.url_original as string) || null,
        urlSource: row.url_source as string,
        createdAt: row.created_at as string,
        normalizedTitle: row.normalized_title as string,
      }))
    );
  }

  // Fair mix: round-robin with random source order per round
  const items: FeedItem[] = [];
  const indices = new Map<FeedSource, number>(
    ALL_SOURCES.map((s) => [s, 0])
  );

  while (items.length < limit) {
    // Shuffle sources each round for fairness
    const shuffled = [...ALL_SOURCES].sort(() => Math.random() - 0.5);
    let addedThisRound = false;

    for (const source of shuffled) {
      if (items.length >= limit) break;

      const queue = sourceQueues.get(source) || [];
      const idx = indices.get(source) || 0;

      if (idx < queue.length) {
        items.push(queue[idx]);
        indices.set(source, idx + 1);
        addedThisRound = true;
      }
    }

    if (!addedThisRound) break;
  }

  const lastItem = items[items.length - 1];
  const nextCursor = lastItem?.id || null;

  // Check if there are more items beyond this page
  let hasMore = false;
  if (lastItem) {
    const moreRow = db
      .prepare(
        `SELECT 1 FROM feed_items WHERE created_at < ? LIMIT 1`
      )
      .get(lastItem.createdAt);
    hasMore = !!moreRow;
  }

  return { items, nextCursor, hasMore };
}
