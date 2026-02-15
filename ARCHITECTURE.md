# RSS Mix Feed - Architecture (V1)

## Tech Stack Decisions

### Backend
- **Framework**: Node.js with TypeScript
- **Runtime**: Node 20+
- **Key Libraries**:
  - `rss-parser` - RSS/Atom feed parsing
  - `node-cron` - Scheduled job execution
  - `express` - REST API server
  - `better-sqlite3` - Database driver
  - `axios` - HTTP requests for RSS fetching

**Rationale**: Node.js provides excellent RSS parsing libraries, easy deployment, and simple job scheduling. TypeScript adds type safety.

### Database
- **Database**: SQLite (file-based)
- **Migration tool**: Native SQL scripts (keep it simple for V1)
- **Location**: `./data/feed.db`

**Rationale**: SQLite is perfect for V1 - no separate server, easy deployment, sufficient performance for this scale. Can migrate to Postgres later if needed.

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (utility-first, mobile-optimized)
- **Key Libraries**:
  - `next-themes` - Dark mode management
  - `date-fns` - Date formatting ("2h ago")
  - `react-intersection-observer` - Infinite scroll detection

**Rationale**: Next.js provides excellent mobile performance, built-in optimizations, easy deployment, and great developer experience. Tailwind enables rapid mobile-first UI development.

### Deployment
- **Option 1 (Recommended)**: Monorepo approach
  - Backend + Frontend in single Next.js app
  - Backend as Next.js API routes (`/api`)
  - Deploy to Vercel (free tier)
  - Vercel Cron for scheduled jobs

- **Option 2**: Separate services
  - Backend on Fly.io (includes cron)
  - Frontend on Vercel
  - CORS configuration needed

**V1 Recommendation**: Monorepo (Option 1) for simplicity.

## Project Structure

```
news-rss-feed/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── page.tsx           # Home feed
│   │   ├── about/page.tsx     # About page
│   │   └── api/               # Backend API routes
│   │       ├── feed/route.ts  # GET /api/feed
│   │       └── health/route.ts # GET /api/health
│   ├── components/
│   │   ├── FeedCard.tsx       # Feed item card
│   │   ├── InfiniteFeed.tsx   # Infinite scroll container
│   │   └── ThemeToggle.tsx    # Dark mode toggle
│   ├── lib/
│   │   ├── db.ts              # Database connection
│   │   ├── rss-fetcher.ts     # RSS fetching service
│   │   ├── deduplicator.ts    # Dedup logic
│   │   └── feed-mixer.ts      # Fair mixing algorithm
│   └── types/
│       └── feed.ts            # TypeScript types
├── data/
│   └── feed.db                # SQLite database
├── migrations/
│   └── 001_initial.sql        # Database schema
├── public/                     # Static assets
├── package.json
└── README.md
```

## Key Design Decisions

### 1. Monorepo vs Microservices
**Decision**: Monorepo (Next.js with API routes)
- Simpler deployment
- No CORS issues
- Easier local development
- Suitable for V1 scale

### 2. Database Choice
**Decision**: SQLite
- File-based, no separate server
- Sufficient for expected load
- Easy to backup (single file)
- Can upgrade to Postgres if needed

### 3. Scheduled Jobs
**Decision**: Vercel Cron (if on Vercel) or node-cron
- Vercel Cron: `/api/cron/fetch-feeds` endpoint
- Runs every 10-20 minutes
- Includes basic auth token for security

### 4. Feed Mixing Algorithm
**Decision**: Weighted random selection from 3 queues
- Maintain 3 sorted queues (one per source)
- For each item, randomly pick source (1:1:1 weight)
- Take newest from that source queue
- Fallback to other sources if queue empty

### 5. Pagination Strategy
**Decision**: Cursor-based pagination
- Cursor = last item's `id`
- Query: `WHERE id < cursor ORDER BY created_at DESC LIMIT 20`
- More efficient than offset-based for infinite scroll

## API Specification

### GET /api/feed
**Query Parameters**:
- `cursor` (optional): Last item ID from previous page
- `limit` (optional, default 20, max 50): Items per page

**Response**:
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
**Response**:
```json
{
  "ok": true,
  "lastFetchTime": {
    "reuters": "2024-02-15T10:30:00Z",
    "verge": "2024-02-15T10:31:00Z",
    "techcrunch": "2024-02-15T10:32:00Z"
  }
}
```

### POST /api/cron/fetch-feeds
**Headers**: `Authorization: Bearer <CRON_SECRET>`
**Response**: `{ "ok": true, "itemsIngested": 42 }`

## Database Schema

### Table: feed_items
```sql
CREATE TABLE feed_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TEXT NOT NULL,
  url_original TEXT,
  url_source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  normalized_title TEXT NOT NULL
);

CREATE INDEX idx_created_at ON feed_items(created_at DESC);
CREATE INDEX idx_source ON feed_items(source);
CREATE INDEX idx_url_original ON feed_items(url_original);
CREATE INDEX idx_normalized_title ON feed_items(normalized_title);
```

### Table: source_metadata
```sql
CREATE TABLE source_metadata (
  source TEXT PRIMARY KEY,
  last_fetch_time TEXT,
  last_fetch_status TEXT,
  last_error TEXT
);
```

## Environment Variables

```env
# Database
DATABASE_PATH=./data/feed.db

# Cron Security
CRON_SECRET=your-random-secret-here

# RSS Sources
REUTERS_RSS_URL=https://news.google.com/rss/search?q=site%3Areuters.com&hl=en-US&gl=US&ceid=US%3Aen
VERGE_RSS_URL=https://www.theverge.com/rss/index.xml
TECHCRUNCH_RSS_URL=https://techcrunch.com/feed/

# Polling Interval (minutes)
FETCH_INTERVAL=15
```

## Non-Functional Requirements

### Performance Targets
- First Contentful Paint: < 1.5s on 4G
- API response time: < 200ms (p95)
- Infinite scroll: < 100ms per page

### Reliability
- Graceful degradation if one feed fails
- Retry logic with exponential backoff
- Error logging for monitoring

### Security
- Cron endpoint protected by bearer token
- Input validation on all API endpoints
- No user data stored (no auth in V1)

## Future Considerations (Post-V1)

- Migrate to Postgres if scale increases
- Add Redis for caching feed results
- Implement WebSockets for real-time updates
- Add AI summarization
- User accounts and personalization
