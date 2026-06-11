import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChipRow, type ChipItem } from "@/components/design/chip-row";

const items: ChipItem[] = [
  { id: "all", label: "전체" },
  { id: "photo", label: "사진" },
  { id: "video", label: "영상" },
];

describe("ChipRow", () => {
  it("모든 라벨을 렌더한다", () => {
    render(<ChipRow items={items} activeId="all" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "사진" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "영상" })).toBeInTheDocument();
  });

  it("active 칩은 aria-pressed=true", () => {
    render(<ChipRow items={items} activeId="photo" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "사진" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute("aria-pressed", "false");
  });

  it("클릭하면 onSelect에 id를 넘긴다", async () => {
    const onSelect = vi.fn();
    render(<ChipRow items={items} activeId="all" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "영상" }));
    expect(onSelect).toHaveBeenCalledWith("video");
  });

  it("active 칩은 data-active=true", () => {
    render(<ChipRow items={items} activeId="all" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: "사진" })).toHaveAttribute("data-active", "false");
  });
});
