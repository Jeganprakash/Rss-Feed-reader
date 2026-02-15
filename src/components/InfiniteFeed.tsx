"use client";

import { useState, useCallback, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import FeedCard from "./FeedCard";
import type { FeedItem, FeedResponse } from "@/types/feed";

export default function InfiniteFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const { ref: bottomRef, inView } = useInView({ threshold: 0 });

  const fetchFeed = useCallback(
    async (currentCursor: string | null) => {
      if (loading) return;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (currentCursor) params.set("cursor", currentCursor);
        params.set("limit", "20");

        const res = await fetch(`/api/feed?${params}`);
        if (!res.ok) throw new Error("Failed to load feed");

        const data: FeedResponse = await res.json();

        setItems((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        setError("Could not load feed. Please try again.");
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    },
    [loading]
  );

  // Initial load
  useEffect(() => {
    fetchFeed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load more when bottom is in view
  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchFeed(cursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasMore]);

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
        <button
          onClick={() => fetchFeed(null)}
          className="rounded-lg bg-feed-accent px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
