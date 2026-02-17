import { getDb } from './db';
import type { FeedItem, FeedSource } from '../types/feed';

const ALL_SOURCES: FeedSource[] = ['REUTERS', 'THE_VERGE', 'TECHCRUNCH'];

interface FeedQueryOptions {
  cursor?: string;
  limit?: number;
}

type FeedRow = {
  id: string;
  title: string;
  source: string;
  published_at: string | Date;
  url_original: string | null;
  url_source: string;
  created_at: string | Date;
  normalized_title: string;
  importance_score: number | string | null;
  importance_reason: string | null;
  ranked_at: string | Date | null;
};

function toIsoTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function toImportanceScore(value: number | string | null): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeSource(source: string): FeedSource {
  const normalized = source.toUpperCase().replace(/[^A-Z]/g, '');

  if (normalized.includes('REUTERS')) return 'REUTERS';
  if (normalized.includes('VERGE')) return 'THE_VERGE';
  if (normalized.includes('TECHCRUNCH')) return 'TECHCRUNCH';

  // Keep API contract stable even if legacy source labels exist in DB.
  return 'REUTERS';
}

function mapRowToFeedItem(row: FeedRow): FeedItem {
  return {
    id: row.id as string,
    title: row.title as string,
    source: normalizeSource(row.source),
    publishedAt:
      toIsoTimestamp(row.published_at) || new Date(0).toISOString(),
    urlOriginal: row.url_original || null,
    urlSource: row.url_source as string,
    createdAt:
      toIsoTimestamp(row.created_at) || new Date(0).toISOString(),
    normalizedTitle: row.normalized_title as string,
    importanceScore: toImportanceScore(row.importance_score),
    importanceReason: row.importance_reason || null,
    rankedAt: toIsoTimestamp(row.ranked_at),
  };
}

/**
 * Fair mixing: pull items from each source proportionally (1:1:1),
 * falling back to other sources when a queue is exhausted.
 * Uses cursor-based pagination.
 */
export async function getMixedFeed(options: FeedQueryOptions = {}) {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);

  // Determine the cursor's created_at for pagination
  let cursorCreatedAt: string | null = null;
  if (options.cursor) {
    const rows = (await db`
      SELECT created_at FROM feed_items WHERE id = ${options.cursor} LIMIT 1
    `) as Array<{ created_at?: string | Date }>;
    const firstRow = rows[0];
    cursorCreatedAt = toIsoTimestamp(firstRow?.created_at || null);
  }

  // Build per-source queues
  const sourceQueues = new Map<FeedSource, FeedItem[]>();

  for (const source of ALL_SOURCES) {
    let rows: FeedRow[];
    if (cursorCreatedAt) {
      rows = (await db`
        SELECT feed_items.*,
               item_rankings.importance_score AS importance_score,
               item_rankings.reason AS importance_reason,
               item_rankings.ranked_at AS ranked_at
        FROM feed_items
        LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
        WHERE feed_items.source = ${source} AND feed_items.created_at < ${cursorCreatedAt}
        ORDER BY feed_items.created_at DESC,
                 COALESCE(item_rankings.importance_score, 50) DESC
        LIMIT ${limit}
      `) as FeedRow[];
    } else {
      rows = (await db`
        SELECT feed_items.*,
               item_rankings.importance_score AS importance_score,
               item_rankings.reason AS importance_reason,
               item_rankings.ranked_at AS ranked_at
        FROM feed_items
        LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
        WHERE feed_items.source = ${source}
        ORDER BY feed_items.created_at DESC,
                 COALESCE(item_rankings.importance_score, 50) DESC
        LIMIT ${limit}
      `) as FeedRow[];
    }

    sourceQueues.set(
      source,
      rows.map(mapRowToFeedItem)
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

  // Fallback for legacy datasets where `source` values don't match expected enum labels.
  if (items.length === 0) {
    const fallbackRows = cursorCreatedAt
      ? ((await db`
          SELECT feed_items.*,
                 item_rankings.importance_score AS importance_score,
                 item_rankings.reason AS importance_reason,
                 item_rankings.ranked_at AS ranked_at
          FROM feed_items
          LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
          WHERE feed_items.created_at < ${cursorCreatedAt}
          ORDER BY feed_items.created_at DESC,
                   COALESCE(item_rankings.importance_score, 50) DESC
          LIMIT ${limit}
        `) as FeedRow[])
      : ((await db`
          SELECT feed_items.*,
                 item_rankings.importance_score AS importance_score,
                 item_rankings.reason AS importance_reason,
                 item_rankings.ranked_at AS ranked_at
          FROM feed_items
          LEFT JOIN item_rankings ON item_rankings.item_id = feed_items.id
          ORDER BY feed_items.created_at DESC,
                   COALESCE(item_rankings.importance_score, 50) DESC
          LIMIT ${limit}
        `) as FeedRow[]);

    items.push(...fallbackRows.map(mapRowToFeedItem));
  }

  const lastItem = items[items.length - 1];
  const nextCursor = lastItem?.id || null;

  // Check if there are more items beyond this page
  let hasMore = false;
  if (lastItem) {
    const moreRows = (await db`
      SELECT 1 FROM feed_items
      WHERE created_at < ${lastItem.createdAt}
      LIMIT 1
    `) as Array<{ exists: number }>;
    hasMore = moreRows.length > 0;
  }

  return { items, nextCursor, hasMore };
}
