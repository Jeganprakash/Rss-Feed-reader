# RSS Mix Feed

A modern, mobile-first news aggregator that combines RSS feeds from Reuters, The Verge, and TechCrunch into a single infinite scroll feed.

## Features

- 🔄 **Infinite scroll** feed with fair source mixing
- ⬇️ **Pull New Feed button** for on-demand ingestion
- 🤖 **Manual Rank Top N** button with LLM scoring
- 🔐 **Basic Auth** gate for single-user access
- 🌓 **Dark mode** with system preference detection
- 📱 **Mobile-first** responsive design
- 🎯 **Smart deduplication** to avoid repeat articles
- ⚡ **Fast loading** with cursor-based pagination
- 🔗 **Direct links** to original articles

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: SQLite (better-sqlite3)
- **Deployment**: Vercel with Cron Jobs

## Getting Started

### Prerequisites

- **Node.js 20 (LTS)** - **Required** for better-sqlite3 compatibility
  - ⚠️ **Important**: Node.js v25+ is not yet supported by better-sqlite3
  - Use `nvm use 20` or see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for installation help
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd news-rss-feed
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and set your app credentials, `CRON_SECRET`, and LLM config:
```bash
# Basic Auth (single user)
APP_AUTH_USER=your-username
APP_AUTH_PASS=your-strong-password

# Cron Security
CRON_SECRET=your-random-secret-here-change-in-production

# LLM Ranking
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_RANK_MODEL=gpt-4o-mini

# Generate a random secret (example):
openssl rand -base64 32
```

4. Initialize the database:
```bash
npm run migrate
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### First-time Database Population

The feeds will be empty initially. To populate:

**Option 1: Wait for cron** (runs daily at 00:00 UTC in production)

**Option 2: Use the in-app buttons**  
Click **Pull New Feed** and/or **Rank Top 20** on the home page.

**Option 3: Manual trigger API** (development):
```bash
curl -X POST http://localhost:3000/api/trigger-fetch \
  -u YOUR_APP_AUTH_USER:YOUR_APP_AUTH_PASS
```

**Option 4: Protected cron endpoint**:
```bash
curl -X POST http://localhost:3000/api/cron/fetch-feeds \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Option 5: Manual ranking API** (development):
```bash
curl -X POST http://localhost:3000/api/trigger-rank \
  -H "Content-Type: application/json" \
  -d '{"topN":20}' \
  -u YOUR_APP_AUTH_USER:YOUR_APP_AUTH_PASS
```

Replace `YOUR_CRON_SECRET` with the value from your `.env.local`.

Replace `YOUR_APP_AUTH_USER` and `YOUR_APP_AUTH_PASS` with values from your `.env.local`.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run migrate` - Initialize or update database

### Project Structure

```
src/
├── app/
│   ├── page.tsx              # Home page (infinite feed)
│   ├── about/page.tsx        # About page
│   ├── layout.tsx            # Root layout with theme provider
│   ├── globals.css           # Global styles and CSS variables
│   └── api/
│       ├── feed/route.ts     # GET /api/feed (paginated feed)
│       ├── health/route.ts   # GET /api/health (status check)
│       ├── trigger-fetch/route.ts  # POST /api/trigger-fetch
│       ├── trigger-rank/route.ts   # POST /api/trigger-rank
│       └── cron/
│           └── fetch-feeds/route.ts  # POST /api/cron/fetch-feeds
├── components/
│   ├── FeedCard.tsx          # Individual feed item card
│   ├── InfiniteFeed.tsx      # Infinite scroll container
│   └── ThemeToggle.tsx       # Dark mode toggle button
├── lib/
│   ├── db.ts                 # Database connection
│   ├── rss-fetcher.ts        # RSS fetching service
│   ├── article-ranker.ts     # LLM + fallback ranking service
│   ├── deduplicator.ts       # Deduplication logic
│   └── feed-mixer.ts         # Fair mixing algorithm
└── types/
    └── feed.ts               # TypeScript type definitions
```

## API Reference

### Authentication

All routes are protected by HTTP Basic Auth except `/api/cron/fetch-feeds`.

Example:
```bash
curl -u YOUR_APP_AUTH_USER:YOUR_APP_AUTH_PASS http://localhost:3000/api/feed
```

### GET /api/feed

Returns paginated feed items with fair source mixing.

**Query Parameters:**
- `cursor` (optional): Last item ID from previous page
- `limit` (optional, default 20, max 50): Items per page

**Response:**
```json
{
  "items": [
    {
      "id": "abc123",
      "title": "Article headline",
      "source": "REUTERS",
      "publishedAt": "2024-02-15T10:30:00Z",
      "urlOriginal": "https://reuters.com/article",
      "createdAt": "2024-02-15T10:35:00Z"
    }
  ],
  "nextCursor": "xyz789",
  "hasMore": true
}
```

### GET /api/health

Returns system health status and last fetch times.

**Response:**
```json
{
  "ok": true,
  "lastFetchTime": {
    "REUTERS": "2024-02-15T10:30:00Z",
    "VERGE": "2024-02-15T10:31:00Z",
    "TECHCRUNCH": "2024-02-15T10:32:00Z"
  }
}
```

### POST /api/cron/fetch-feeds

Triggers RSS feed fetching (called by Vercel Cron).

**Headers:**
- `Authorization: Bearer <CRON_SECRET>`

**Response:**
```json
{
  "ok": true,
  "itemsIngested": 42
}
```

### POST /api/trigger-fetch

Triggers manual RSS fetching for the in-app **Pull New Feed** button.

**Notes:**
- Protected by HTTP Basic Auth middleware.
- Protected by a short cooldown and in-flight lock to avoid overlapping fetches.

**Response:**
```json
{
  "ok": true,
  "itemsIngested": 3,
  "message": "Feed pull completed successfully"
}
```

### POST /api/trigger-rank

Triggers manual ranking for the top N newest articles.

**Request Body (optional):**
```json
{
  "topN": 20
}
```

**Notes:**
- Protected by HTTP Basic Auth middleware.
- Uses LLM ranking when `OPENAI_API_KEY` is set, otherwise falls back to heuristic scoring.
- Protected by cooldown and in-flight lock to avoid overlap.

**Response:**
```json
{
  "ok": true,
  "topN": 20,
  "processed": 20,
  "llmRanked": 20,
  "fallbackRanked": 0,
  "failed": 0,
  "model": "gpt-4o-mini",
  "message": "Ranked 20 newest articles"
}
```

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Set up environment variables in Vercel:
```bash
vercel env add APP_AUTH_USER production
vercel env add APP_AUTH_PASS production
vercel env add CRON_SECRET production
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_RANK_MODEL production
```

Enter your app credentials, a random cron secret, and your OpenAI settings when prompted.

3. Deploy:
```bash
vercel --prod
```

4. Initialize database (first deployment only):

SSH into your deployment or use Vercel's serverless function to run:
```bash
vercel env pull .env.production
node scripts/migrate.js
```

Or trigger the first fetch manually after deployment:
```bash
curl -X POST https://your-app.vercel.app/api/cron/fetch-feeds \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Vercel Cron Configuration

The `vercel.json` configures a cron job to run daily at `00:00 UTC`:

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-feeds",
      "schedule": "0 0 * * *"
    }
  ]
}
```

Vercel automatically adds the `CRON_SECRET` header when calling this endpoint.

### Database Persistence

**Important**: Vercel's serverless functions are stateless, so the SQLite database file is ephemeral by default.

**Options for production:**

1. **Vercel KV/Postgres** (recommended for production scale)
   - Migrate from SQLite to Vercel Postgres
   - Requires schema migration

2. **External database** (Supabase, PlanetScale, Railway)
   - Use hosted Postgres
   - Update connection in `src/lib/db.ts`

3. **Keep SQLite** (acceptable for V1 demo)
   - Database resets on each deployment
   - Feed re-populates from RSS sources
   - Good enough for low-traffic demo

For V1, option 3 (SQLite) works fine. The database will repopulate automatically via the cron job.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_PATH` | Path to SQLite database file | `./data/feed.db` |
| `APP_AUTH_USER` | Basic auth username for app/API access | (required) |
| `APP_AUTH_PASS` | Basic auth password for app/API access | (required) |
| `CRON_SECRET` | Secret for cron endpoint auth | (required) |
| `OPENAI_API_KEY` | OpenAI API key for LLM ranking | (optional) |
| `OPENAI_RANK_MODEL` | OpenAI model for ranking | `gpt-4o-mini` |
| `REUTERS_RSS_URL` | Reuters RSS feed URL | Google News Reuters query |
| `VERGE_RSS_URL` | The Verge RSS feed URL | `https://www.theverge.com/rss/index.xml` |
| `TECHCRUNCH_RSS_URL` | TechCrunch RSS feed URL | `https://techcrunch.com/feed/` |
| `FETCH_INTERVAL_MINUTES` | Minutes between fetches | `15` |
| `NODE_ENV` | Node environment | `production` |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.

## License

MIT

## Contributing

This is a V1 project focused on core functionality. For V2+ features (AI summarization, user accounts, etc.), see ARCHITECTURE.md.
