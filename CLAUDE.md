# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RSS Mix Feed** - A mobile-first news aggregator that combines RSS feeds from Reuters, The Verge, and TechCrunch into a single infinite scroll feed with intelligent mixing and deduplication.

**Tech Stack**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, SQLite, Node.js

**Key Features**: Infinite scroll, dark mode, mobile-optimized, fair source mixing, deduplication

## Development Setup

```bash
npm install
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run migrate      # Run database migrations
```

## Common Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run migrate` - Initialize/update database

## Architecture

**Monorepo structure** using Next.js with API routes:
- Frontend: `/src/app` (App Router pages)
- Backend: `/src/app/api` (API routes)
- Services: `/src/lib` (RSS fetching, dedup, mixing)
- Database: SQLite at `./data/feed.db`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed tech decisions.

## Key Conventions

- **TypeScript**: Strict mode enabled, use explicit types
- **Styling**: Tailwind CSS utility classes, mobile-first responsive design
- **API**: Cursor-based pagination, REST endpoints under `/api`
- **Code Style**: Prettier + ESLint, 2-space indentation
- **Commits**: Descriptive messages following conventional commits

## File Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # Backend API routes
│   └── page.tsx        # Frontend pages
├── components/         # React components
├── lib/               # Business logic (RSS, dedup, DB)
└── types/             # TypeScript type definitions
```
