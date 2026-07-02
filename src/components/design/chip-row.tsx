"use client";

export interface ChipItem {
  id: string;
  label: string;
}

export interface ChipRowProps {
  items: ChipItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function ChipRow({ items, activeId, onSelect }: ChipRowProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-6 md:px-10 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = item.id === activeId;
        const base =
          "cursor-pointer shrink-0 rounded-full px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase transition-colors";
        const tone = active
          ? "bg-[var(--color-ink)] text-[var(--color-bg)] border border-[var(--color-ink)]"
          : "border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-ink-muted)]";
        return (
          <button
            key={item.id}
            type="button"
            data-active={active}
            aria-pressed={active}
            onClick={() => onSelect(item.id)}
            className={`${base} ${tone}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
