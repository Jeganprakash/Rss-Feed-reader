import Parser from 'rss-parser';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { getDb } from './db';
import { isDuplicate, normalizeTitle } from './deduplicator';
import type { FeedSource, RawFeedEntry } from '../types/feed';

const parser = new Parser();

const FEED_SOURCES: Record<FeedSource, string> = {
  REUTERS:
    process.env.REUTERS_RSS_URL ||
    'https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen',
  THE_VERGE:
    process.env.VERGE_RSS_URL || 'https://www.theverge.com/rss/index.xml',
  TECHCRUNCH:
    process.env.TECHCRUNCH_RSS_URL || 'https://techcrunch.com/feed/',
};

const FEED_FETCH_TIMEOUT_MS = 8000;

/**
 * Resolve a Google News redirect URL to the original article URL.
 * Google News RSS links go through a redirect; we follow it to get
 * the canonical Reuters URL.
 */
async function resolveGoogleNewsUrl(googleUrl: string): Promise<string> {
  try {
    const response = await axios.head(googleUrl, {
      maxRedirects: 5,
      timeout: 5000,
      validateStatus: () => true,
    });
    return (response.request?.res?.responseUrl as string) || googleUrl;
  } catch {
    return googleUrl;
  }
}

async function fetchFeedXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'RSS-Mix-Fetcher/1.0',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Feed fetch failed with ${response.status}`);
    }

    return await response.text();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Feed fetch timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSingleSource(source: FeedSource): Promise<RawFeedEntry[]> {
  const url = FEED_SOURCES[source];
  const xml = await fetchFeedXml(url);
  const feed = (await parser.parseString(xml)) as {
    items?: Array<{
      title?: string;
      link?: string;
      pubDate?: string;
    }>;
  };

  const entries: RawFeedEntry[] = [];

  // Process only first 30 items to stay within Vercel timeout
  const itemsToProcess = (feed.items || []).slice(0, 30);

  for (const item of itemsToProcess) {
    if (!item.title || !item.link) continue;

    let link = item.link;

    // Skip Google News redirect resolution on Vercel (too slow)
    // Use the redirect URL directly - it still works for clicking
    if (source === 'REUTERS' && !process.env.VERCEL) {
      // Only resolve locally, not on Vercel
      link = await resolveGoogleNewsUrl(link);
    }

    entries.push({
      title: item.title,
      link,
      pubDate: item.pubDate || new Date().toISOString(),
      source,
    });
  }

  return entries;
}

function updateSourceMetadata(
  source: FeedSource,
  status: string,
  error: string | null
): void {
  const db = getDb();
  db.prepare(
    `UPDATE source_metadata
     SET last_fetch_time = ?, last_fetch_status = ?, last_error = ?
     WHERE source = ?`
  ).run(new Date().toISOString(), status, error, source);
}

/**
 * Fetch all RSS sources, deduplicate, and insert new items into the database.
 * Returns the count of newly ingested items.
 */
export async function fetchAllFeeds(): Promise<number> {
  const db = getDb();
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO feed_items
       (id, title, source, published_at, url_original, url_source, created_at, normalized_title)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let totalIngested = 0;

  for (const source of Object.keys(FEED_SOURCES) as FeedSource[]) {
    try {
      const entries = await fetchSingleSource(source);

      for (const entry of entries) {
        const normTitle = normalizeTitle(entry.title);

        if (isDuplicate(db, entry.link, normTitle)) {
          continue;
        }

        const now = new Date().toISOString();
        insertStmt.run(
          randomUUID(),
          entry.title,
          entry.source,
          new Date(entry.pubDate).toISOString(),
          source === 'REUTERS' ? entry.link : null,
          entry.link,
          now,
          normTitle
        );
        totalIngested++;
      }

      updateSourceMetadata(source, 'ok', null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to fetch ${source}: ${message}`);
      updateSourceMetadata(source, 'error', message);
    }
  }

  return totalIngested;
}
