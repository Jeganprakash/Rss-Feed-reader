# Deployment Guide

## Quick Deploy to Vercel

### Step 1: Prepare Repository

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Vercel will auto-detect Next.js

### Step 3: Configure Environment Variables

In Vercel dashboard, add these environment variables:

**Production Environment:**

```
CRON_SECRET=<generate-random-secret>
DATABASE_PATH=./data/feed.db
NODE_ENV=production
```

To generate `CRON_SECRET`:
```bash
openssl rand -base64 32
```

Optional (uses defaults from vercel.json if not set):
```
REUTERS_RSS_URL=https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen
VERGE_RSS_URL=https://www.theverge.com/rss/index.xml
TECHCRUNCH_RSS_URL=https://techcrunch.com/feed/
FETCH_INTERVAL_MINUTES=15
```

### Step 4: Deploy

```bash
vercel --prod
```

Or use Vercel's Git integration (automatic on push to main).

### Step 5: Initialize Database

After first deployment, trigger the initial feed fetch:

```bash
curl -X POST https://your-app.vercel.app/api/cron/fetch-feeds \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Note**: Replace `YOUR_CRON_SECRET` with your actual secret.

### Step 6: Verify

1. Check health: `https://your-app.vercel.app/api/health`
2. Open app: `https://your-app.vercel.app`
3. Verify feed loads with items

## Cron Job Setup

Vercel automatically configures the cron job from `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-feeds",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This runs every 15 minutes. Vercel automatically adds authentication.

## Database Considerations

### SQLite (Default - V1)

**Pros:**
- Simple, no external dependencies
- Zero configuration
- Works immediately

**Cons:**
- Ephemeral on Vercel (resets on redeploy)
- Not persistent across function invocations
- Limited to single instance

**Best for:** Demo, V1, low traffic

### Upgrade to Postgres (V2)

For production scale, migrate to Vercel Postgres:

1. Enable Vercel Postgres in dashboard
2. Update `src/lib/db.ts` to use `@vercel/postgres`
3. Run migrations against Postgres
4. Update env vars

**Migration script** (create when needed):
```sql
-- Postgres version of schema
-- Run via Vercel Postgres dashboard or `psql`
```

## Monitoring

### Check Feed Status

```bash
curl https://your-app.vercel.app/api/health
```

### View Vercel Logs

```bash
vercel logs --prod
```

Or use Vercel Dashboard → Logs tab.

### Common Issues

**Feed empty on first load:**
- Solution: Manually trigger cron endpoint (see Step 5)

**Cron not running:**
- Check Vercel Dashboard → Settings → Cron Jobs
- Verify `vercel.json` is committed
- Check function logs

**TypeScript errors on build:**
- Run `npm run build` locally first
- Fix any type errors before deploying

## CI/CD

### Automatic Deploys

Vercel automatically deploys on:
- Push to `main` branch → Production
- Pull requests → Preview deployments

### Pre-deploy Checks

Add to `.github/workflows/test.yml`:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm install
      - run: npm run lint
      - run: npm run build
```

## Environment-Specific Configuration

### Development (.env.local)

```env
DATABASE_PATH=./data/feed.db
CRON_SECRET=dev-secret-not-for-production
NODE_ENV=development
```

### Preview (Vercel Preview)

Uses same config as production but different database instance.

### Production (Vercel Production)

Uses env vars from Vercel dashboard.

## Rollback

If deployment fails:

```bash
# Via CLI
vercel rollback

# Or via Vercel Dashboard
# Deployments → Previous deployment → "Promote to Production"
```

## Performance Tuning

### Edge Functions

Currently using Node.js runtime. For global performance, consider Edge Runtime:

```ts
// In route.ts
export const runtime = 'edge';
```

**Note**: Edge runtime doesn't support SQLite. Requires Postgres or external DB.

### Caching

API routes already include cache headers (see `vercel.json`):

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

## Security

### Environment Variables

- Never commit `.env.local` (already in `.gitignore`)
- Rotate `CRON_SECRET` periodically
- Use Vercel's encrypted environment variables

### API Security

- Cron endpoint protected by `CRON_SECRET`
- Public API routes (`/api/feed`, `/api/health`) are intentionally public
- No authentication needed for V1 (no user data)

### Content Security

- RSS feeds fetched server-side (no CORS issues)
- External links open in new tabs
- No user-generated content

## Cost Estimation

### Vercel Free Tier

- **Bandwidth**: 100 GB/month
- **Serverless Functions**: 100 GB-hours/month
- **Cron Jobs**: Included

**Expected usage (V1):**
- ~20,000 function invocations/month (3 sources × 4 fetches/hour × 730 hours)
- ~1-5 GB bandwidth/month (depending on traffic)
- Well within free tier limits

### Upgrade Triggers

Consider Vercel Pro ($20/month) if:
- Traffic exceeds 100 GB bandwidth/month
- Need Vercel Postgres for persistent DB
- Require team collaboration features

## Troubleshooting

### Build Fails

```bash
# Test build locally
npm run build

# Check TypeScript errors
npm run lint

# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Feed Not Updating

```bash
# Check cron logs
vercel logs --prod | grep cron

# Manually trigger
curl -X POST https://your-app.vercel.app/api/cron/fetch-feeds \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Check health endpoint
curl https://your-app.vercel.app/api/health
```

### Database Issues

```bash
# Re-run migrations locally
npm run migrate

# Check database file exists
ls -lh data/feed.db

# For Vercel: Database recreates on each cold start (expected with SQLite)
```

## Next Steps Post-Deployment

1. ✅ Verify feed loads
2. ✅ Test dark mode
3. ✅ Test infinite scroll
4. ✅ Check mobile responsiveness
5. ✅ Monitor Vercel logs for errors
6. 📊 Set up analytics (optional - Vercel Analytics)
7. 🔔 Set up uptime monitoring (optional - UptimeRobot, Better Stack)

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
