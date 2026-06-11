export interface HeroProps {
  title: string;
  subtitle?: string;
}

export function Hero({ title, subtitle }: HeroProps) {
  return (
    <section className="px-6 pt-7 pb-3 md:px-10 md:pt-9 md:pb-4">
      <h1 className="font-serif text-[30px] md:text-[38px] lg:text-[44px] leading-none tracking-[-0.01em]">
        {title}
      </h1>
      {subtitle && (
        <p
          data-testid="hero-subtitle"
          className="mt-2 italic font-serif text-xs md:text-sm text-[var(--color-ink-muted)]"
        >
          {subtitle}
        </p>
      )}
    </section>
  );
}
