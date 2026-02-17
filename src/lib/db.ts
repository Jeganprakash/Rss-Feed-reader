import { neon } from '@neondatabase/serverless';

type NeonClient = ReturnType<typeof neon>;

let db: NeonClient | null = null;
let initialized = false;
let initializationPromise: Promise<void> | null = null;

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    const presentFallbacks = [
      'POSTGRES_URL',
      'POSTGRES_PRISMA_URL',
      'NEON_DATABASE_URL',
      'DATABASE_PATH',
    ].filter((key) => Boolean(process.env[key]));

    const hint =
      presentFallbacks.length > 0
        ? ` Found ${presentFallbacks.join(', ')} but this app now requires DATABASE_URL explicitly to avoid connecting to the wrong database.`
        : '';

    throw new Error(
      `DATABASE_URL is not configured.${hint}`
    );
  }
  return databaseUrl;
}

export function getDb(): NeonClient {
  if (!db) {
    db = neon(requireDatabaseUrl());
  }
  return db;
}

export async function initDb(): Promise<void> {
  if (initialized) return;
  if (initializationPromise) return initializationPromise;

  const database = getDb();

  initializationPromise = (async () => {
    await database`
      CREATE TABLE IF NOT EXISTS feed_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source TEXT NOT NULL,
        published_at TIMESTAMPTZ NOT NULL,
        url_original TEXT,
        url_source TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        normalized_title TEXT NOT NULL
      )
    `;

    await database`
      CREATE INDEX IF NOT EXISTS idx_created_at ON feed_items(created_at DESC)
    `;
    await database`
      CREATE INDEX IF NOT EXISTS idx_source ON feed_items(source)
    `;
    await database`
      CREATE INDEX IF NOT EXISTS idx_url_original ON feed_items(url_original)
    `;
    await database`
      CREATE INDEX IF NOT EXISTS idx_normalized_title ON feed_items(normalized_title)
    `;

    await database`
      CREATE TABLE IF NOT EXISTS source_metadata (
        source TEXT PRIMARY KEY,
        last_fetch_time TIMESTAMPTZ,
        last_fetch_status TEXT,
        last_error TEXT
      )
    `;

    await database`
      INSERT INTO source_metadata (source, last_fetch_time, last_fetch_status, last_error)
      VALUES
        ('REUTERS', NULL, NULL, NULL),
        ('THE_VERGE', NULL, NULL, NULL),
        ('TECHCRUNCH', NULL, NULL, NULL)
      ON CONFLICT (source) DO NOTHING
    `;

    await database`
      CREATE TABLE IF NOT EXISTS item_rankings (
        item_id TEXT PRIMARY KEY,
        importance_score DOUBLE PRECISION NOT NULL,
        reason TEXT,
        model TEXT NOT NULL,
        ranked_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT fk_item_rankings_item
          FOREIGN KEY (item_id) REFERENCES feed_items(id) ON DELETE CASCADE
      )
    `;

    await database`
      CREATE INDEX IF NOT EXISTS idx_item_rankings_score ON item_rankings(importance_score DESC)
    `;
    await database`
      CREATE INDEX IF NOT EXISTS idx_item_rankings_ranked_at ON item_rankings(ranked_at DESC)
    `;

    initialized = true;
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
}
