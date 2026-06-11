import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Topbar } from "@/components/design/topbar";
import { PillButton } from "@/components/design/pill-button";

describe("Topbar", () => {
  it("워드마크를 'Gallery.' 기본값으로 렌더한다", () => {
    render(<Topbar />);
    expect(screen.getByText("Gallery.")).toBeInTheDocument();
  });

  it("워드마크는 italic 세리프", () => {
    render(<Topbar />);
    const wm = screen.getByText("Gallery.");
    expect(wm.className).toMatch(/italic/);
    expect(wm.className).toMatch(/font-serif/);
  });

  it("nav items가 있으면 데스크톱에서 보이는 nav 컨테이너에 렌더한다", () => {
    render(
      <Topbar
        navItems={[
          { href: "/gallery", label: "사진" },
          { href: "/admin", label: "관리" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "사진" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "관리" })).toBeInTheDocument();
  });

  it("nav 컨테이너는 모바일에서 숨기는 클래스(hidden md:flex)를 가진다", () => {
    render(
      <Topbar navItems={[{ href: "/", label: "X" }]} />
    );
    const nav = screen.getByTestId("topbar-nav");
    expect(nav.className).toMatch(/hidden/);
    expect(nav.className).toMatch(/md:flex/);
  });

  it("cta가 주어지면 우측에 렌더한다", () => {
    render(<Topbar cta={<PillButton>업로드</PillButton>} />);
    expect(screen.getByRole("button", { name: "업로드" })).toBeInTheDocument();
  });
});
