import * as React from "react";

type ColumnCount = 1 | 2 | 3 | 4 | 5;

export interface MasonryLayoutProps {
  children: React.ReactNode;
  columns?: {
    mobile?: ColumnCount;
    tablet?: ColumnCount;
    desktop?: ColumnCount;
  };
}

const COLUMNS_BASE: Record<ColumnCount, string> = {
  1: "columns-1",
  2: "columns-2",
  3: "columns-3",
  4: "columns-4",
  5: "columns-5",
};
const COLUMNS_MD: Record<ColumnCount, string> = {
  1: "md:columns-1",
  2: "md:columns-2",
  3: "md:columns-3",
  4: "md:columns-4",
  5: "md:columns-5",
};
const COLUMNS_LG: Record<ColumnCount, string> = {
  1: "lg:columns-1",
  2: "lg:columns-2",
  3: "lg:columns-3",
  4: "lg:columns-4",
  5: "lg:columns-5",
};

export function MasonryLayout({
  children,
  columns = { mobile: 2, tablet: 3, desktop: 4 },
}: MasonryLayoutProps) {
  const mobile = columns.mobile ?? 2;
  const tablet = columns.tablet ?? 3;
  const desktop = columns.desktop ?? 4;
  const containerClass = [
    COLUMNS_BASE[mobile],
    COLUMNS_MD[tablet],
    COLUMNS_LG[desktop],
    "gap-1.5 md:gap-2.5",
    "px-6 md:px-10 py-4",
  ].join(" ");

  return (
    <div data-testid="masonry-container" className={containerClass}>
      {React.Children.map(children, (child, idx) => (
        <div key={idx} className="break-inside-avoid mb-1.5 md:mb-2.5">
          {child}
        </div>
      ))}
    </div>
  );
}
