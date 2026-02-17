"use client";

import { useState, useCallback, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import FeedCard from "./FeedCard";
import type { FeedItem, FeedResponse } from "@/types/feed";

type FetchMode = "append" | "replace";

interface FetchFeedOptions {
  currentCursor: string | null;
  mode?: FetchMode;
  bypassCache?: boolean;
}

interface TriggerFetchResponse {
  ok: boolean;
  itemsIngested?: number;
  error?: string;
  retryAfterSeconds?: number;
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

  const { ref: bottomRef, inView } = useInView({ threshold: 0 });

  const fetchFeed = useCallback(
    async ({
      currentCursor,
      mode = "append",
      bypassCache = false,
    }: FetchFeedOptions): Promise<boolean> => {
      if (loading) return false;
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
          setItems(data.items);
        } else {
          setItems((prev) => [...prev, ...data.items]);
        }
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        return true;
      } catch {
        setError("Could not load feed. Please try again.");
        return false;
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [loading]
  );

  const handlePullNewFeed = useCallback(async () => {
    if (pulling || loading) return;

    setPulling(true);
    setPullMessage(null);
    setPullError(null);

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

      const refreshed = await fetchFeed({
        currentCursor: null,
        mode: "replace",
        bypassCache: true,
      });

      if (!refreshed) {
        setPullError("Feed was pulled, but refresh failed. Please retry.");
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
  }, [fetchFeed, loading, pulling]);

  // Initial load
  useEffect(() => {
    fetchFeed({ currentCursor: null, mode: "replace", bypassCache: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load more when bottom is in view
  useEffect(() => {
    if (inView && hasMore && !loading && !pulling) {
      fetchFeed({ currentCursor: cursor, mode: "append" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasMore, pulling]);

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
            disabled={pulling || loading}
            className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pulling ? "Pulling..." : "Pull New Feed"}
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
          disabled={pulling || loading}
          className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pulling ? "Pulling..." : "Pull New Feed"}
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
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-2 flex justify-end">
        <button
          onClick={handlePullNewFeed}
          disabled={pulling || loading}
          className="rounded-lg border border-feed-border bg-feed-surface px-4 py-2 text-sm font-medium text-feed-text transition-colors hover:border-feed-accent/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pulling ? "Pulling..." : "Pull New Feed"}
        </button>
      </div>

      {pullMessage && (
        <p role="status" aria-live="polite" className="text-sm text-feed-muted">
          {pullMessage}
        </p>
      )}

      {pullError && <p className="text-sm text-red-500">{pullError}</p>}

      {items.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}

      {/* Scroll sentinel */}
      <div ref={bottomRef} className="h-1" />

      {loading && (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-feed-border border-t-feed-accent" />
        </div>
      )}

      {!hasMore && items.length > 0 && (
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
