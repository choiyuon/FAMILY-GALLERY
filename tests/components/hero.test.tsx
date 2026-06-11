import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "@/components/design/hero";

describe("Hero (Quiet)", () => {
  it("title을 h1으로 렌더한다", () => {
    render(<Hero title="가족 갤러리." />);
    const h1 = screen.getByRole("heading", { level: 1, name: "가족 갤러리." });
    expect(h1).toBeInTheDocument();
  });

  it("subtitle이 있으면 같이 렌더한다", () => {
    render(<Hero title="가족 갤러리." subtitle="— 우리가 모은 순간들 —" />);
    expect(screen.getByText("— 우리가 모은 순간들 —")).toBeInTheDocument();
  });

  it("subtitle이 없으면 부제 노드가 없다", () => {
    render(<Hero title="제목" />);
    expect(screen.queryByTestId("hero-subtitle")).not.toBeInTheDocument();
  });

  it("subtitle은 italic serif 클래스가 붙는다", () => {
    render(<Hero title="t" subtitle="s" />);
    const sub = screen.getByTestId("hero-subtitle");
    expect(sub.className).toMatch(/italic/);
    expect(sub.className).toMatch(/font-serif/);
  });
});
