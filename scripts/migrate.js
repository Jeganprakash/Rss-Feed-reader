#!/usr/bin/env node

const { loadEnvConfig } = require('@next/env');
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');
const sql = neon(process.env.DATABASE_URL);

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Split SQL file content into executable statements.
 * Handles semicolons inside strings, comments, and dollar-quoted blocks.
 */
function splitSqlStatements(input) {
  const statements = [];
  let current = '';

  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      current += ch;
      if (ch === '$') {
        const maybeEnd = input.slice(i - dollarTag.length + 1, i + 1);
        if (maybeEnd === dollarTag) {
          dollarTag = null;
        }
      }
      continue;
    }

    if (!inSingle && !inDouble && ch === '-' && next === '-') {
      current += ch + next;
      i += 1;
      inLineComment = true;
      continue;
    }

    if (!inSingle && !inDouble && ch === '/' && next === '*') {
      current += ch + next;
      i += 1;
      inBlockComment = true;
      continue;
    }

    if (!inSingle && !inDouble && ch === '$') {
      const rest = input.slice(i);
      const match = rest.match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        const tag = match[0];
        current += tag;
        i += tag.length - 1;
        dollarTag = tag;
        continue;
      }
    }

    if (!inDouble && ch === "'") {
      current += ch;
      if (inSingle && next === "'") {
        current += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }

    if (!inSingle && ch === '"') {
      current += ch;
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && ch === ';') {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);

  return statements;
}

async function ensureMigrationsTable() {
  await sql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigration(filename) {
  const rows = await sql(
    'SELECT filename, checksum FROM schema_migrations WHERE filename = $1 LIMIT 1',
    [filename]
  );
  return rows[0] || null;
}

async function applyMigration(filename, fileSql) {
  const statements = splitSqlStatements(fileSql);
  const checksum = sha256(fileSql);

  const existing = await getAppliedMigration(filename);
  if (existing) {
    if (existing.checksum !== checksum) {
      throw new Error(
        `${filename} was already applied but file content has changed. ` +
          'Create a new migration file instead of editing applied migrations.'
      );
    }
    return { status: 'skipped' };
  }

  await sql.transaction((tx) => {
    const queries = statements.map((statement) => tx(statement));
    queries.push(
      tx(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum]
      )
    );
    return queries;
  });

  return { status: 'applied', statements: statements.length };
}

async function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log(`No migrations directory found at ${MIGRATIONS_DIR}`);
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migration files found.');
    return;
  }

  await ensureMigrationsTable();

  let applied = 0;
  let skipped = 0;

  console.log(`Database: ${process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':****@')}`);
  console.log(`Found ${files.length} migration file(s)\n`);

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const fileSql = fs.readFileSync(filePath, 'utf8');

    process.stdout.write(`Running ${file} ... `);
    const result = await applyMigration(file, fileSql);

    if (result.status === 'applied') {
      applied += 1;
      console.log(`applied (${result.statements} statement${result.statements === 1 ? '' : 's'})`);
    } else {
      skipped += 1;
      console.log('skipped (already applied)');
    }
  }

  console.log('\nMigration summary:');
  console.log(`  Applied: ${applied}`);
  console.log(`  Skipped: ${skipped}`);
}

main().catch((error) => {
  console.error('\nMigration failed:');
  console.error(error);
  process.exit(1);
});
