import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MasonryLayout } from "@/components/design/masonry-layout";

describe("MasonryLayout", () => {
  it("자식 노드를 모두 렌더한다", () => {
    render(
      <MasonryLayout>
        <div data-testid="t1">1</div>
        <div data-testid="t2">2</div>
        <div data-testid="t3">3</div>
      </MasonryLayout>
    );
    expect(screen.getByTestId("t1")).toBeInTheDocument();
    expect(screen.getByTestId("t2")).toBeInTheDocument();
    expect(screen.getByTestId("t3")).toBeInTheDocument();
  });

  it("컨테이너는 CSS columns 클래스를 사용한다", () => {
    render(
      <MasonryLayout>
        <div>x</div>
      </MasonryLayout>
    );
    const container = screen.getByTestId("masonry-container");
    // Tailwind columns 유틸: columns-2 / md:columns-3 / lg:columns-4
    expect(container.className).toMatch(/columns-2/);
    expect(container.className).toMatch(/md:columns-3/);
    expect(container.className).toMatch(/lg:columns-4/);
  });

  it("각 자식 래퍼는 break-inside-avoid 클래스를 가진다", () => {
    render(
      <MasonryLayout>
        <div data-testid="child">x</div>
      </MasonryLayout>
    );
    const child = screen.getByTestId("child");
    // 자식은 wrapper로 감싸지므로 parent를 본다
    const wrapper = child.parentElement;
    expect(wrapper?.className).toMatch(/break-inside-avoid/);
  });

  it("columns prop으로 컬럼 수를 덮어쓸 수 있다 (e.g., {mobile:1, tablet:2, desktop:3})", () => {
    render(
      <MasonryLayout columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
        <div>x</div>
      </MasonryLayout>
    );
    const container = screen.getByTestId("masonry-container");
    expect(container.className).toMatch(/columns-1/);
    expect(container.className).toMatch(/md:columns-2/);
    expect(container.className).toMatch(/lg:columns-3/);
  });
});
