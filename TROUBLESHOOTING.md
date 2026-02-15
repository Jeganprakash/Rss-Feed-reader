# Troubleshooting Guide

## better-sqlite3 Native Bindings Error

### Problem
```
Error: Could not locate the bindings file
```

This occurs when using Node.js versions that don't have prebuilt better-sqlite3 binaries.

### Solution 1: Use Node.js 20 (LTS) - Recommended

**Why**: Node 20 is the LTS version that Vercel uses, so this ensures development matches production.

**Using nvm (recommended)**:
```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node 20
nvm install 20

# Use Node 20
nvm use 20

# Verify
node --version  # Should show v20.x.x

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Now run migrations
npm run migrate
```

**Using Homebrew (macOS)**:
```bash
brew uninstall node
brew install node@20
brew link node@20

# Verify
node --version  # Should show v20.x.x

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run migrate
```

### Solution 2: Use Alternative Database (sql.js)

If you can't change Node versions, we can switch to sql.js (pure JavaScript SQLite):

**Step 1**: Update dependencies
```bash
npm uninstall better-sqlite3
npm install sql.js
```

**Step 2**: Update `src/lib/db.ts`
```typescript
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/feed.db';
let db: SqlJsDatabase | null = null;

export async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Create data directory
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode
  db.run('PRAGMA journal_mode = WAL;');

  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

// Auto-save every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(saveDb, 5 * 60 * 1000);
}
```

**Step 3**: Update API routes to call `saveDb()` after writes.

**Note**: sql.js is slower than better-sqlite3 but works with any Node version.

### Solution 3: Build from Source

If you must use Node v25:

```bash
# Install build tools (macOS)
xcode-select --install

# Try building
npm rebuild better-sqlite3
```

This may fail due to Node v25 compatibility issues in better-sqlite3.

## Security Vulnerabilities

### Problem
```
4 high severity vulnerabilities
```

### Investigation
```bash
npm audit
```

### Fix (if safe)
```bash
# Review changes first
npm audit fix --force

# Or update specific packages
npm update
```

**Note**: Audit warnings in dependencies are common. Only fix if they affect your usage.

## Vercel Deployment Issues

### Database Not Persisting

**Problem**: Database resets on each deployment.

**Expected**: This is normal with SQLite on Vercel's serverless functions.

**Solutions**:
1. Accept ephemeral DB (feeds repopulate from RSS)
2. Migrate to Vercel Postgres (for persistence)
3. Use external DB (Supabase, PlanetScale)

### Cron Jobs Not Running

**Problem**: Feeds not auto-updating.

**Check**:
1. Vercel Dashboard → Settings → Cron Jobs
2. Verify `vercel.json` is committed
3. Check function logs for errors

**Manual Trigger**:
```bash
curl -X POST https://your-app.vercel.app/api/cron/fetch-feeds \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Build Fails on Vercel

**Problem**: TypeScript or build errors.

**Solution**:
```bash
# Test build locally first
npm run build

# Fix any TypeScript errors
npm run lint

# Commit fixes
git add .
git commit -m "fix: build errors"
git push
```

## Development Issues

### Port Already in Use

**Problem**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**:
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Hot Reload Not Working

**Problem**: Changes not reflecting in browser.

**Solutions**:
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear Next.js cache: `rm -rf .next`
3. Restart dev server

### TypeScript Errors

**Problem**: Type errors in IDE or build.

**Solution**:
```bash
# Regenerate types
rm -rf .next node_modules
npm install
npm run build
```

## RSS Fetching Issues

### Empty Feed

**Problem**: No items in feed after migration.

**Solution**:
```bash
# Manually trigger fetch
curl -X POST http://localhost:3000/api/cron/fetch-feeds \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Check health
curl http://localhost:3000/api/health
```

### RSS Source Failing

**Problem**: One source not returning items.

**Check**:
```bash
# Test RSS URLs directly
curl "https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen"
curl "https://www.theverge.com/rss/index.xml"
curl "https://techcrunch.com/feed/"
```

**Check Logs**: Function logs in Vercel or console output locally.

## Performance Issues

### Slow Initial Load

**Solutions**:
1. Increase API cache: Edit `vercel.json` cache headers
2. Optimize images (if added in future)
3. Enable Vercel Edge Functions

### Infinite Scroll Laggy

**Solutions**:
1. Reduce items per page: Change `limit=20` to `limit=10`
2. Add virtualization (react-window)
3. Optimize re-renders

## Browser Issues

### Dark Mode Not Persisting

**Problem**: Theme resets on refresh.

**Check**:
1. localStorage not blocked (privacy mode)
2. Console for hydration errors
3. ThemeProvider properly wrapped

### Styles Not Loading

**Problem**: Unstyled content.

**Solution**:
```bash
# Rebuild Tailwind
rm -rf .next
npm run dev
```

## Still Stuck?

1. Check [GitHub Issues](https://github.com/your-repo/issues)
2. Review error logs in Vercel Dashboard
3. Enable verbose logging in `.env.local`:
   ```
   NODE_ENV=development
   ```
4. Search for similar issues in Next.js/better-sqlite3 repos

## Quick Reset

If all else fails, reset everything:

```bash
# Clean everything
rm -rf node_modules .next data package-lock.json

# Reinstall with Node 20
nvm use 20
npm install

# Initialize
npm run migrate
npm run dev
```
