-- Migration 001: Initial schema for RSS Mix Feed (PostgreSQL/Neon)
-- Created: 2026-02-15

ALTER TABLE item_rankings
ADD COLUMN IF NOT EXISTS used_fallback boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS item_rankings_used_fallback_idx
ON item_rankings (used_fallback);
