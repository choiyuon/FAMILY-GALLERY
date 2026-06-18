"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  title: string;
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/media/search?q=${encodeURIComponent(query)}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  function onSelect(id: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/gallery?photo=${id}`, { scroll: false });
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        placeholder="검색"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
        className="w-40 md:w-56 text-xs px-3 py-1.5 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] rounded-full placeholder:text-[var(--color-ink-muted)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-gold)]"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-[var(--color-shadow)] rounded z-50 max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onMouseDown={() => onSelect(r.id)}
              className="w-full text-left px-3 py-2 text-sm font-sans text-[var(--color-ink)] hover:bg-[var(--color-bg)] flex items-center gap-2 border-b border-[var(--color-border)] last:border-0"
            >
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
