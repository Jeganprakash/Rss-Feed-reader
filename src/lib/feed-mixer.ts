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
          `SELECT feed_items.*,
                  item_rankings.importance_score AS importance_score,
                  item_rankings.reason AS importance_reason,
                  item_rankings.ranked_at AS ranked_at
           FROM feed_items
           LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
           WHERE feed_items.source = ? AND feed_items.created_at < ?
           ORDER BY feed_items.created_at DESC,
                    COALESCE(item_rankings.importance_score, 50) DESC
           LIMIT ?`
        )
        .all(source, cursorCreatedAt, limit) as Record<string, unknown>[];
    } else {
      rows = db
        .prepare(
          `SELECT feed_items.*,
                  item_rankings.importance_score AS importance_score,
                  item_rankings.reason AS importance_reason,
                  item_rankings.ranked_at AS ranked_at
           FROM feed_items
           LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
           WHERE feed_items.source = ?
           ORDER BY feed_items.created_at DESC,
                    COALESCE(item_rankings.importance_score, 50) DESC
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
        importanceScore:
          typeof row.importance_score === 'number'
            ? row.importance_score
            : null,
        importanceReason:
          typeof row.importance_reason === 'string'
            ? row.importance_reason
            : null,
        rankedAt:
          typeof row.ranked_at === 'string'
            ? row.ranked_at
            : null,
      }))
    );
  }

  // Fair mix: round-robin with random source order per round
  const items: FeedItem[] = [];
  const indices = new Map<FeedSource, number>(
    ALL_SOURCES.map((s) => [s, 0])
  );

  while (items.length < limit) {
    // Prioritize higher-scored items while still pulling max one per source each round.
    const prioritizedSources = [...ALL_SOURCES].sort((a, b) => {
      const aIdx = indices.get(a) || 0;
      const bIdx = indices.get(b) || 0;
      const aScore = sourceQueues.get(a)?.[aIdx]?.importanceScore ?? 50;
      const bScore = sourceQueues.get(b)?.[bIdx]?.importanceScore ?? 50;

      if (aScore === bScore) {
        return Math.random() - 0.5;
      }
      return bScore - aScore;
    });
    let addedThisRound = false;

    for (const source of prioritizedSources) {
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
