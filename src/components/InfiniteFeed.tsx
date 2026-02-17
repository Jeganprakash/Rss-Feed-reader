"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useInView } from "react-intersection-observer";
import FeedCard from "./FeedCard";
import type { FeedItem, FeedResponse, FeedSource } from "@/types/feed";

type FetchMode = "append" | "replace";

interface FetchFeedOptions {
  currentCursor: string | null;
  mode?: FetchMode;
  bypassCache?: boolean;
}

interface TriggerFetchResponse {
  ok: boolean;
  itemsIngested?: number;
  items?: FeedItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

interface TriggerRankResponse {
  ok: boolean;
  topN?: number;
  processed?: number;
  llmRanked?: number;
  fallbackRanked?: number;
  failed?: number;
  model?: string;
  usedProvidedItems?: boolean;
  rankings?: Array<{
    itemId: string;
    importanceScore: number;
    reason: string;
    rankedAt: string;
  }>;
  error?: string;
  retryAfterSeconds?: number;
}

const RANK_TOP_N = 20;
type SortMode = "priority" | "newest";
type SourceFilter = "ALL" | FeedSource;

const SOURCE_FILTER_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "ALL", label: "All Sources" },
  { value: "REUTERS", label: "Reuters" },
  { value: "THE_VERGE", label: "The Verge" },
  { value: "TECHCRUNCH", label: "TechCrunch" },
];

function parseDateToTime(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getNewestTimestamp(item: FeedItem): number {
  const publishedTime = parseDateToTime(item.publishedAt);
  if (publishedTime > 0) {
    return publishedTime;
  }
  return parseDateToTime(item.createdAt);
}

function dedupeItemsById(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const deduped: FeedItem[] = [];

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped;
}

export default function InfiniteFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [ranking, setRanking] = useState(false);
  const [rankMessage, setRankMessage] = useState<string | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const loadingRef = useRef(false);

  const { ref: bottomRef, inView } = useInView({ threshold: 0 });

  const fetchFeed = useCallback(
    async ({
      currentCursor,
      mode = "append",
      bypassCache = false,
    }: FetchFeedOptions): Promise<boolean> => {
      if (loadingRef.current) return false;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (currentCursor) params.set("cursor", currentCursor);
        params.set("limit", "20");
        if (bypassCache) params.set("ts", Date.now().toString());

        const res = await fetch(`/api/feed?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load feed");

        const data: FeedResponse = await res.json();

        if (mode === "replace") {
          setItems(dedupeItemsById(data.items));
        } else {
          setItems((prev) => dedupeItemsById([...prev, ...data.items]));
        }
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        return true;
      } catch {
        setError("Could not load feed. Please try again.");
        return false;
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setInitialLoad(false);
      }
    },
    []
  );

  const handlePullNewFeed = useCallback(async () => {
    if (pulling || loading || ranking) return;

    setPulling(true);
    setPullMessage(null);
    setPullError(null);
    setRankMessage(null);
    setRankError(null);

    try {
      const res = await fetch("/api/trigger-fetch", {
        method: "POST",
        cache: "no-store",
      });

      let payload: TriggerFetchResponse | null = null;
      try {
        payload = (await res.json()) as TriggerFetchResponse;
      } catch {
        payload = null;
      }

      if (!res.ok || !payload?.ok) {
        const fallback = "Could not pull new feed. Please try again.";
        const message =
          payload?.retryAfterSeconds && payload.retryAfterSeconds > 0
            ? `Please wait ${payload.retryAfterSeconds}s before pulling again.`
            : payload?.error || fallback;
        throw new Error(message);
      }

      const itemsIngested = payload.itemsIngested ?? 0;
      setPullMessage(
        itemsIngested === 0
          ? "No new articles found."
          : `Pulled ${itemsIngested} new ${
              itemsIngested === 1 ? "article" : "articles"
            }.`
      );

      if (Array.isArray(payload.items)) {
        setItems(dedupeItemsById(payload.items));
        setCursor(payload.nextCursor ?? null);
        setHasMore(Boolean(payload.hasMore));
      } else {
        const refreshed = await fetchFeed({
          currentCursor: null,
          mode: "replace",
          bypassCache: true,
        });

        if (!refreshed) {
          setPullError("Feed was pulled, but refresh failed. Please retry.");
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not pull new feed. Please try again.";
      setPullError(message);
    } finally {
      setPulling(false);
    }
  }, [fetchFeed, loading, pulling, ranking]);

  const handleRankTopNewest = useCallback(async () => {
    if (ranking || loading || pulling) return;

    setRanking(true);
    setRankMessage(null);
    setRankError(null);
    setPullMessage(null);
    setPullError(null);

    try {
      const rankInput = [...items]
        .sort((a, b) => getNewestTimestamp(b) - getNewestTimestamp(a))
        .slice(0, RANK_TOP_N)
        .map((item) => ({
          id: item.id,
          title: item.title,
          source: item.source,
          publishedAt: item.publishedAt,
        }));

      const res = await fetch("/api/trigger-rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topN: RANK_TOP_N, items: rankInput }),
        cache: "no-store",
      });

      let payload: TriggerRankResponse | null = null;
      try {
        payload = (await res.json()) as TriggerRankResponse;
      } catch {
        payload = null;
      }

      if (!res.ok || !payload?.ok) {
        const fallback = "Could not rank articles. Please try again.";
        const message =
          payload?.retryAfterSeconds && payload.retryAfterSeconds > 0
            ? `Please wait ${payload.retryAfterSeconds}s before ranking again.`
            : payload?.error || fallback;
        throw new Error(message);
      }

      const processed = payload.processed ?? 0;
      const llmRanked = payload.llmRanked ?? 0;
      const fallbackRanked = payload.fallbackRanked ?? 0;
      const failed = payload.failed ?? 0;
      const rankings = payload.rankings ?? [];

      if (rankings.length > 0) {
        const rankingsById = new Map(rankings.map((entry) => [entry.itemId, entry]));
        setItems((prev) =>
          prev.map((item) => {
            const ranked = rankingsById.get(item.id);
            if (!ranked) return item;
            return {
              ...item,
              importanceScore: ranked.importanceScore,
              importanceReason: ranked.reason,
              rankedAt: ranked.rankedAt,
            };
          })
        );
      }

      const rankedTarget = payload.usedProvidedItems
        ? "loaded articles"
        : "newest articles";

      setRankMessage(
        processed === 0
          ? "No articles available to rank."
          : `Ranked ${processed} ${rankedTarget} (LLM: ${llmRanked}, fallback: ${fallbackRanked}, failed: ${failed}).`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not rank articles. Please try again.";
      setRankError(message);
    } finally {
      setRanking(false);
    }
  }, [items, loading, pulling, ranking]);

  const displayedItems = useMemo(() => {
    const filteredItems =
      sourceFilter === "ALL"
        ? items
        : items.filter((item) => item.source === sourceFilter);

    return [...filteredItems].sort((a, b) => {
      if (sortMode === "priority") {
        const aRanked = typeof a.importanceScore === "number";
        const bRanked = typeof b.importanceScore === "number";

        // Ranked items should always be shown ahead of unranked ones.
        if (aRanked !== bRanked) {
          return aRanked ? -1 : 1;
        }

        if (aRanked && bRanked) {
          const aScore = a.importanceScore ?? 0;
          const bScore = b.importanceScore ?? 0;
          if (aScore !== bScore) return bScore - aScore;
        }
      }

      return getNewestTimestamp(b) - getNewestTimestamp(a);
    });
  }, [items, sortMode, sourceFilter]);

  // Initial load
  useEffect(() => {
    fetchFeed({ currentCursor: null, mode: "replace", bypassCache: true });
  }, [fetchFeed]);

  // Load more when bottom is in view
  useEffect(() => {
    if (inView && hasMore && !loading && !pulling && !ranking) {
      fetchFeed({ currentCursor: cursor, mode: "append" });
    }
  }, [cursor, fetchFeed, hasMore, inView, loading, pulling, ranking]);

  if (initialLoad) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-feed-border border-t-feed-accent" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-3 text-feed-muted">{error}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => fetchFeed({ currentCursor: null, mode: "replace" })}
            className="rounded-lg bg-feed-accent px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
          <button
            onClick={handlePullNewFeed}
            disabled={pulling || loading || ranking}
            className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pulling ? "Pulling..." : "Pull New Feed"}
          </button>
          <button
            onClick={handleRankTopNewest}
            disabled={ranking || loading || pulling}
            className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ranking ? `Ranking Top ${RANK_TOP_N}...` : `Rank Top ${RANK_TOP_N}`}
          </button>
        </div>
        {pullMessage && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-feed-muted"
          >
            {pullMessage}
          </p>
        )}
        {pullError && <p className="mt-3 text-sm text-red-500">{pullError}</p>}
        {rankMessage && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-feed-muted"
          >
            {rankMessage}
          </p>
        )}
        {rankError && <p className="mt-3 text-sm text-red-500">{rankError}</p>}
      </div>
    );
  }

  if (!initialLoad && items.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-3 text-feed-muted">
          No articles yet. Feed will populate soon.
        </p>
        <p className="mb-4 text-sm text-feed-muted">
          Cron job runs daily at midnight UTC to fetch fresh articles.
        </p>
        <button
          onClick={handlePullNewFeed}
          disabled={pulling || loading || ranking}
          className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pulling ? "Pulling..." : "Pull New Feed"}
        </button>
        <button
          onClick={handleRankTopNewest}
          disabled={ranking || loading || pulling}
          className="ml-2 rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ranking ? `Ranking Top ${RANK_TOP_N}...` : `Rank Top ${RANK_TOP_N}`}
        </button>
        {pullMessage && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-feed-muted"
          >
            {pullMessage}
          </p>
        )}
        {pullError && <p className="mt-3 text-sm text-red-500">{pullError}</p>}
        {rankMessage && (
          <p
            role="status"
            aria-live="polite"
            className="mt-3 text-sm text-feed-muted"
          >
            {rankMessage}
          </p>
        )}
        {rankError && <p className="mt-3 text-sm text-red-500">{rankError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-feed-muted">Sort</span>
            <select
              value={sortMode}
              onChange={(event) =>
                setSortMode(event.target.value as SortMode)
              }
              className="rounded-lg border border-feed-border bg-feed-surface px-3 py-2 text-sm text-feed-text outline-none transition-colors focus:border-feed-accent/60"
            >
              <option value="priority">Priority</option>
              <option value="newest">Newest</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-feed-muted">Source</span>
            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as SourceFilter)
              }
              className="rounded-lg border border-feed-border bg-feed-surface px-3 py-2 text-sm text-feed-text outline-none transition-colors focus:border-feed-accent/60"
            >
              {SOURCE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRankTopNewest}
            disabled={ranking || loading || pulling}
            className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ranking ? `Ranking Top ${RANK_TOP_N}...` : `Rank Top ${RANK_TOP_N}`}
          </button>
          <button
            onClick={handlePullNewFeed}
            disabled={pulling || loading || ranking}
            className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pulling ? "Pulling..." : "Pull New Feed"}
          </button>
        </div>
      </div>

      {pullMessage && (
        <p role="status" aria-live="polite" className="text-sm text-feed-muted">
          {pullMessage}
        </p>
      )}

      {pullError && <p className="text-sm text-red-500">{pullError}</p>}
      {rankMessage && (
        <p role="status" aria-live="polite" className="text-sm text-feed-muted">
          {rankMessage}
        </p>
      )}
      {rankError && <p className="text-sm text-red-500">{rankError}</p>}

      {displayedItems.length === 0 && items.length > 0 && (
        <p className="py-4 text-center text-sm text-feed-muted">
          No articles match the selected source filter.
        </p>
      )}

      {displayedItems.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}

      {/* Scroll sentinel */}
      <div ref={bottomRef} className="h-1" />

      {loading && (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-feed-border border-t-feed-accent" />
        </div>
      )}

      {!hasMore && displayedItems.length > 0 && (
        <p className="py-6 text-center text-sm text-feed-muted">
          You&apos;re all caught up.
        </p>
      )}

      {error && items.length > 0 && (
        <p className="py-4 text-center text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
