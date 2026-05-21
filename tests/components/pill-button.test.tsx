import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PillButton } from "@/components/design/pill-button";

describe("PillButton", () => {
  it("자식 텍스트를 렌더한다", () => {
    render(<PillButton>업로드</PillButton>);
    expect(screen.getByRole("button", { name: "업로드" })).toBeInTheDocument();
  });

  it("기본 variant는 와인 채움 (data-variant='primary')", () => {
    render(<PillButton>들어가기</PillButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "primary");
  });

  it("variant='ghost'는 outline 스타일", () => {
    render(<PillButton variant="ghost">취소</PillButton>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", "ghost");
  });

  it("disabled prop을 적용하면 클릭이 무시된다", async () => {
    const onClick = vi.fn();
    render(<PillButton onClick={onClick} disabled>업로드</PillButton>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("type을 받아 form submit 버튼으로 동작한다", () => {
    render(<PillButton type="submit">들어가기</PillButton>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
