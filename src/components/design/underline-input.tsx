"use client";

import * as React from "react";

export type UnderlineInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const UnderlineInput = React.forwardRef<HTMLInputElement, UnderlineInputProps>(
  function UnderlineInput({ className, type = "text", ...rest }, ref) {
    const base =
      "w-full bg-transparent border-0 border-b border-[var(--color-border)] py-2.5 text-sm text-[var(--color-ink)] placeholder:italic placeholder:font-serif placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-wine)] transition-colors";
    return (
      <input
        ref={ref}
        type={type}
        data-style="underline"
        className={[base, className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  }
);
