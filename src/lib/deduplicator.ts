import type Database from 'better-sqlite3';

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
export function isDuplicate(
  db: Database.Database,
  url: string,
  normalizedTitle: string
): boolean {
  // Check URL match
  const urlMatch = db
    .prepare(
      `SELECT 1 FROM feed_items
       WHERE url_source = ? OR url_original = ?
       LIMIT 1`
    )
    .get(url, url);

  if (urlMatch) return true;

  // Check normalized title match
  const titleMatch = db
    .prepare(
      `SELECT 1 FROM feed_items
       WHERE normalized_title = ?
       LIMIT 1`
    )
    .get(normalizedTitle);

  return !!titleMatch;
}
