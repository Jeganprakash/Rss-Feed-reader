import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Use /tmp for Vercel serverless (ephemeral but writable)
const DB_PATH = process.env.DATABASE_PATH || '/tmp/feed.db';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  const migrationPath = path.resolve(process.cwd(), 'migrations', '001_initial.sql');
  if (fs.existsSync(migrationPath)) {
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    database.exec(migration);
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
