#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'feed.db');
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Get all SQL migration files sorted by name
const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

console.log(`Database: ${DB_PATH}`);
console.log(`Found ${files.length} migration(s)\n`);

for (const file of files) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf-8');

  console.log(`Running ${file}...`);
  try {
    db.exec(sql);
    console.log(`  ✓ ${file} applied successfully`);
  } catch (err) {
    console.error(`  ✗ ${file} failed: ${err.message}`);
    process.exit(1);
  }
}

db.close();
console.log('\nAll migrations applied successfully.');
