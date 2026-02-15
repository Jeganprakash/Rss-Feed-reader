import Link from "next/link";
import InfiniteFeed from "@/components/InfiniteFeed";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-feed-bg">
      <header className="sticky top-0 z-10 border-b border-feed-border bg-feed-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold tracking-tight text-feed-text">
            RSS Mix
          </h1>
          <nav className="flex items-center gap-4">
            <Link
              href="/about"
              className="text-sm text-feed-muted hover:text-feed-text"
            >
              About
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <InfiniteFeed />
      </div>
    </main>
  );
}
