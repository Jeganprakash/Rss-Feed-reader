import { formatDistanceToNowStrict } from "date-fns";
import type { FeedItem, FeedSource } from "@/types/feed";

const SOURCE_CONFIG: Record<FeedSource, { label: string; className: string }> = {
  REUTERS: {
    label: "Reuters",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  THE_VERGE: {
    label: "The Verge",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  TECHCRUNCH: {
    label: "TechCrunch",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};

function formatTimeAgo(dateString: string): string {
  try {
    return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true });
  } catch {
    return "";
  }
}

export default function FeedCard({ item }: { item: FeedItem }) {
  const sourceConfig = SOURCE_CONFIG[item.source] ?? {
    label: item.source,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };

  const url = item.urlOriginal || item.urlSource;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-feed-border bg-feed-surface p-4 transition-colors hover:border-feed-accent/40 active:bg-feed-bg sm:p-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${sourceConfig.className}`}
        >
          {sourceConfig.label}
        </span>
        <span className="text-xs text-feed-muted">
          {formatTimeAgo(item.publishedAt)}
        </span>
      </div>
      <h2 className="text-base font-medium leading-snug text-feed-text sm:text-lg">
        {item.title}
      </h2>
    </a>
  );
}
