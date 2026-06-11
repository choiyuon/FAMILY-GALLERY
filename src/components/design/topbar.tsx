import Link from "next/link";
import * as React from "react";

export interface TopbarNavItem {
  href: string;
  label: string;
}

export interface TopbarProps {
  wordmark?: string;
  navItems?: TopbarNavItem[];
  cta?: React.ReactNode;
}

export function Topbar({ wordmark = "Gallery.", navItems = [], cta }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-6 md:px-10 py-3 md:py-4 border-b border-[var(--color-border)]">
      <Link href="/" className="italic font-serif text-base md:text-lg text-[var(--color-ink)]">
        {wordmark}
      </Link>

      <div className="flex items-center gap-4 md:gap-5">
        <nav
          data-testid="topbar-nav"
          className="hidden md:flex items-center gap-4 text-[11px] tracking-[0.12em] uppercase text-[var(--color-ink-muted)]"
        >
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[var(--color-ink)] transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>
        {cta}
      </div>
    </header>
  );
}
