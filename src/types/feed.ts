export interface FeedItem {
  id: string;
  title: string;
  source: FeedSource;
  publishedAt: string;
  urlOriginal: string | null;
  urlSource: string;
  createdAt: string;
  normalizedTitle: string;
}

export type FeedSource = 'REUTERS' | 'THE_VERGE' | 'TECHCRUNCH';

export interface SourceMetadata {
  source: FeedSource;
  lastFetchTime: string | null;
  lastFetchStatus: string | null;
  lastError: string | null;
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface RawFeedEntry {
  title: string;
  link: string;
  pubDate: string;
  source: FeedSource;
}
