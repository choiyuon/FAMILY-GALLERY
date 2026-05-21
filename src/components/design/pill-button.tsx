import * as React from "react";

type Variant = "primary" | "ghost";

export interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function PillButton({
  variant = "primary",
  className,
  children,
  type = "button",
  ...rest
}: PillButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-xs tracking-[0.15em] uppercase font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClass =
    variant === "primary"
      ? "bg-[var(--color-wine)] text-[var(--color-bg)] hover:bg-[#5e2222]"
      : "border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-ink-muted)]";

  return (
    <button
      type={type}
      data-variant={variant}
      className={[base, variantClass, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
