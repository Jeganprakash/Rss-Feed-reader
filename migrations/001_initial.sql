-- Migration 001: Initial schema for RSS Mix Feed
-- Created: 2026-02-15

-- Feed items table: stores all RSS articles from all sources
CREATE TABLE IF NOT EXISTS feed_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TEXT NOT NULL,
  url_original TEXT,
  url_source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  normalized_title TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_created_at ON feed_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source ON feed_items(source);
CREATE INDEX IF NOT EXISTS idx_url_original ON feed_items(url_original);
CREATE INDEX IF NOT EXISTS idx_normalized_title ON feed_items(normalized_title);

-- Source metadata table: tracks fetch status per source
CREATE TABLE IF NOT EXISTS source_metadata (
  source TEXT PRIMARY KEY,
  last_fetch_time TEXT,
  last_fetch_status TEXT,
  last_error TEXT
);

-- Seed initial source metadata rows
INSERT OR IGNORE INTO source_metadata (source, last_fetch_time, last_fetch_status, last_error)
VALUES
  ('REUTERS', NULL, NULL, NULL),
  ('THE_VERGE', NULL, NULL, NULL),
  ('TECHCRUNCH', NULL, NULL, NULL);

-- Item rankings table: stores per-article importance scores from LLM ranking
CREATE TABLE IF NOT EXISTS item_rankings (
  item_id TEXT PRIMARY KEY,
  importance_score REAL NOT NULL,
  reason TEXT,
  model TEXT NOT NULL,
  ranked_at TEXT NOT NULL,
  FOREIGN KEY (item_id) REFERENCES feed_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_item_rankings_score ON item_rankings(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_item_rankings_ranked_at ON item_rankings(ranked_at DESC);
