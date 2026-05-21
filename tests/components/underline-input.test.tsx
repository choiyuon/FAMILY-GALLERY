import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnderlineInput } from "@/components/design/underline-input";

describe("UnderlineInput", () => {
  it("placeholder를 렌더한다", () => {
    render(<UnderlineInput placeholder="이메일" />);
    expect(screen.getByPlaceholderText("이메일")).toBeInTheDocument();
  });

  it("type='password'를 적용하면 input type이 password", () => {
    render(<UnderlineInput type="password" placeholder="비밀번호" data-testid="pw" />);
    const input = screen.getByTestId("pw") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("onChange를 받으면 입력 시 호출된다", async () => {
    const onChange = vi.fn();
    render(<UnderlineInput placeholder="이름" onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText("이름"), "엄마");
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last.target.value).toBe("엄마");
  });

  it("data-style='underline'로 식별된다 (box/카드 변형이 아니라는 의도)", () => {
    render(<UnderlineInput placeholder="x" />);
    expect(screen.getByPlaceholderText("x")).toHaveAttribute("data-style", "underline");
  });
});
