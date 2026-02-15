import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function About() {
  return (
    <main className="min-h-screen bg-feed-bg">
      <header className="sticky top-0 z-10 border-b border-feed-border bg-feed-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-feed-text"
          >
            RSS Mix
          </Link>
          <nav className="flex items-center gap-4">
            <span className="text-sm font-medium text-feed-text">About</span>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10">
        <h2 className="mb-4 text-2xl font-bold tracking-tight text-feed-text">
          About RSS Mix
        </h2>
        <div className="space-y-4 text-feed-muted">
          <p>
            RSS Mix is a minimalist news aggregator that combines feeds from
            Reuters, The Verge, and TechCrunch into a single, clean timeline.
          </p>
          <p>
            Designed mobile-first with a focus on readability. No ads, no
            tracking, no distractions -- just the headlines that matter.
          </p>
          <h3 className="pt-2 text-lg font-semibold text-feed-text">
            Sources
          </h3>
          <ul className="list-inside list-disc space-y-1">
            <li>Reuters -- World &amp; business news</li>
            <li>The Verge -- Technology &amp; culture</li>
            <li>TechCrunch -- Startups &amp; tech industry</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
