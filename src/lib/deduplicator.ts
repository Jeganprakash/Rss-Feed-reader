import { getDb } from './db';

/**
 * Normalize a title for deduplication comparison.
 * - Lowercase
 * - Strip punctuation
 * - Collapse whitespace
 * - Trim
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a feed item is a duplicate based on:
 * 1. Exact URL match (url_source or url_original)
 * 2. Exact normalized title match
 */
export async function isDuplicate(
  url: string,
  normalizedTitle: string
): Promise<boolean> {
  const db = getDb();

  const urlMatch = (await db`
    SELECT 1 FROM feed_items
    WHERE url_source = ${url} OR url_original = ${url}
    LIMIT 1
  `) as Array<{ exists: number }>;
  if (urlMatch.length > 0) return true;

  const titleMatch = (await db`
    SELECT 1 FROM feed_items
    WHERE normalized_title = ${normalizedTitle}
    LIMIT 1
  `) as Array<{ exists: number }>;

  return titleMatch.length > 0;
}
