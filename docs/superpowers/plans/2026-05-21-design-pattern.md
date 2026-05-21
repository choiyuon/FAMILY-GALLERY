# Design Pattern Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 디자인 패턴 spec(`2026-05-21-design-pattern.md`)에 정의된 토큰을 확정하고, 적용 화면(갤러리·라이트박스·로그인)이 공유할 시각 프리미티브(Topbar, Hero, ChipRow, MasonryLayout, PillButton, UnderlineInput)를 만든 뒤 `/styleguide` 라우트에 모아 시각 검증한다. 이후 Plan 1의 login/landing/gallery 작업과 Plan 2의 그리드·라이트박스 작업이 이 프리미티브를 그대로 import해서 쓴다.

**Architecture:** Plan 1의 DB·Auth 의존성을 타지 않는 순수 UI 레이어. 각 프리미티브는 Server Component로 작성 가능한 stateless presentational 단위(상호작용이 필요한 ChipRow/UnderlineInput만 `"use client"`). 스타일은 Tailwind v4 `@theme` 블록과 CSS 변수(토큰)로만. 테스트는 Vitest + React Testing Library, jsdom 환경.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Tailwind v4, `next/font/google`, Vitest, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.

---

## Reference Documents

- 디자인 패턴 spec: `docs/superpowers/specs/2026-05-21-design-pattern.md`
- 부모 spec (수정 대상): `docs/superpowers/specs/2026-05-14-family-gallery-design.md`
- 기존 plan (참고만): `docs/superpowers/plans/2026-05-14-foundation.md`
- 프로젝트 가드레일: `AGENTS.md`

**이 플랜이 가정하는 상태**: Plan 1이 아직 실행되지 않았거나, Plan 1 Task 1 (project bootstrap)까지만 실행된 상태. Plan 1 Task 2 (design tokens)가 이미 실행됐다면 본 플랜 Task 1이 그 결과를 덮어쓴다.

---

## File Structure

```
family-gallery/
├── src/
│   ├── app/
│   │   ├── layout.tsx                       # MODIFY: load 4 google fonts
│   │   ├── globals.css                      # MODIFY: @theme block + token import
│   │   └── styleguide/
│   │       └── page.tsx                     # CREATE: visual verification route
│   ├── components/
│   │   └── design/
│   │       ├── pill-button.tsx              # CREATE
│   │       ├── underline-input.tsx          # CREATE
│   │       ├── hero.tsx                     # CREATE
│   │       ├── chip-row.tsx                 # CREATE
│   │       ├── topbar.tsx                   # CREATE
│   │       └── masonry-layout.tsx           # CREATE
│   └── styles/
│       └── tokens.css                       # CREATE (or MODIFY if Plan 1 Task 2 ran)
└── tests/
    ├── setup-jsdom.ts                       # CREATE: matchers
    └── components/
        ├── pill-button.test.tsx             # CREATE
        ├── underline-input.test.tsx         # CREATE
        ├── hero.test.tsx                    # CREATE
        ├── chip-row.test.tsx                # CREATE
        ├── topbar.test.tsx                  # CREATE
        └── masonry-layout.test.tsx          # CREATE
```

`vitest.config.ts`도 만들거나 갱신한다 (Task 2).

---

## Setup Notes (read before starting)

1. **Next.js 16 기준** (AGENTS.md §0~§1). 미들웨어는 `proxy.ts` 명명을 쓰지만 본 플랜은 미들웨어를 다루지 않는다.
2. **Tailwind v4**. `tailwind.config.{js,ts}` 파일은 만들지 마라. 모든 토큰은 `@theme` 블록과 CSS 변수로 노출.
3. **폰트는 `next/font/google`만** (AGENTS.md §7).
4. **각 Task = 한 커밋** (AGENTS.md §10). 커밋 메시지는 한국어 본문 + 영어 prefix.
5. **커밋은 사용자가 각 Task 종료 시점에 지시할 때만** (AGENTS.md §10 + executing-plans 체크포인트). 자동 커밋 금지.
6. **테스트는 진짜 DB가 필요하지 않음** — 이 플랜의 컴포넌트는 DB를 안 탄다. 다만 jsdom 환경이 필요.
7. **시각 검증**: 매 Task에서 `npm run dev` → 브라우저 확인을 빼먹지 말 것 (AGENTS.md §3).

---

## Task 1: 토큰 확정 + 폰트 로딩

**Files:**
- Create or Modify: `src/styles/tokens.css`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify (temporary): `src/app/page.tsx` (smoke 화면용; 4단계에서 복구)

- [ ] **Step 1.1: `src/styles/tokens.css` 작성**

Create or overwrite `src/styles/tokens.css`:
```css
:root {
  /* Renaissance light palette (spec 2026-05-21 §2) */
  --color-bg: #F5EFE4;
  --color-bg-elevated: #FBF6EC;
  --color-ink: #1B2B3A;
  --color-ink-muted: #6E5B3F;
  --color-gold: #B8924B;
  --color-gold-soft: #D7B879;
  --color-wine: #7A2E2E;
  --color-border: #E7DDC9;
  --color-shadow: rgba(27, 43, 58, 0.08);

  --font-serif: var(--font-cormorant), var(--font-noto-serif-kr), ui-serif, Georgia, serif;
  --font-sans: var(--font-inter), var(--font-pretendard), ui-sans-serif, system-ui, sans-serif;
}

[data-theme="dark"] {
  --color-bg: #1F1A14;
  --color-bg-elevated: #2A2218;
  --color-ink: #F5EFE4;
  --color-ink-muted: #C9A96A;
  --color-gold: #B8924B;
  --color-gold-soft: #8A6E3A;
  --color-wine: #7A2E2E;
  --color-border: #3A2F22;
  --color-shadow: rgba(0, 0, 0, 0.4);
}

html, body {
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  min-height: 100vh;
}

h1, h2, h3, h4 {
  font-family: var(--font-serif);
  font-weight: 500;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 1.2: `src/app/globals.css` 작성**

Overwrite `src/app/globals.css`:
```css
@import "tailwindcss";
@import "../styles/tokens.css";

@theme {
  --color-bg: #F5EFE4;
  --color-bg-elevated: #FBF6EC;
  --color-ink: #1B2B3A;
  --color-ink-muted: #6E5B3F;
  --color-gold: #B8924B;
  --color-gold-soft: #D7B879;
  --color-wine: #7A2E2E;
  --color-border: #E7DDC9;

  --font-serif: var(--font-cormorant), var(--font-noto-serif-kr), ui-serif, Georgia, serif;
  --font-sans: var(--font-inter), var(--font-pretendard), ui-sans-serif, system-ui, sans-serif;
}
```

(Tailwind v4 `@theme` 블록은 클래스(`bg-bg`, `text-ink`, `font-serif` 등)를 생성한다.)

- [ ] **Step 1.3: 4종 폰트 로드 (`src/app/layout.tsx`)**

Overwrite `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSerifKr = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-serif-kr",
  display: "swap",
});

// Pretendard는 Google Fonts에 없어 CDN 또는 self-host. 임시로 시스템 폰트로 폴백.
const pretendardVar = "--font-pretendard";

export const metadata: Metadata = {
  title: "가족 갤러리",
  description: "우리 가족 사진과 영상",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${cormorant.variable} ${inter.variable} ${notoSerifKr.variable}`}
      style={{ [pretendardVar]: "Pretendard, sans-serif" } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
```

(Pretendard는 Google Fonts에 없으므로 `next/font/google`로는 못 받음. 현재는 시스템에 있으면 쓰고 없으면 폴백. 필요 시 별도 task에서 Pretendard self-host 검토.)

- [ ] **Step 1.4: 임시 smoke 화면**

Overwrite `src/app/page.tsx` temporarily:
```tsx
export default function RootPage() {
  return (
    <main className="p-12">
      <h1 className="text-5xl mb-4">가족 갤러리.</h1>
      <p className="text-[var(--color-ink-muted)] italic">
        — 베이지 배경 위에 다크네이비 잉크, 세리프 헤딩, 골드/와인 액센트가 보여야 함 —
      </p>
      <div className="mt-8 flex gap-3">
        <span className="px-3 py-1 rounded-full bg-[var(--color-wine)] text-[var(--color-bg)] text-xs uppercase tracking-widest">와인</span>
        <span className="px-3 py-1 rounded-full bg-[var(--color-gold)] text-[var(--color-bg)] text-xs uppercase tracking-widest">골드</span>
      </div>
    </main>
  );
}
```

- [ ] **Step 1.5: 브라우저 확인**

Run:
```bash
npm run dev
```

Visit http://localhost:3000.

Expected:
- 배경이 `#F5EFE4` 따뜻한 베이지
- "가족 갤러리." 가 Cormorant 세리프, 큰 사이즈, weight 500
- 부제가 ink-muted 갈색, 이탤릭 세리프
- 두 알약: 와인색 / 골드색

만약 색이 기본 흰색이면 `tokens.css` import가 안 들어간 것. globals.css의 `@import "../styles/tokens.css";` 줄을 확인.

Stop the server (Ctrl-C).

- [ ] **Step 1.6: `src/app/page.tsx`를 redirect로 복구**

Overwrite `src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/gallery");
}
```

- [ ] **Step 1.7: 타입 체크**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 1.8: Commit**

```bash
git add src/styles/tokens.css src/app/globals.css src/app/layout.tsx src/app/page.tsx
git commit -m "feat(design): finalize renaissance tokens and load google fonts"
```

---

## Task 2: 컴포넌트 테스트 환경

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts` (if missing — Plan 1 Task 5에서 만들지만 본 plan을 먼저 돌리면 여기서 만든다)
- Create: `tests/setup-jsdom.ts`
- Create: `tests/components/.gitkeep`

- [ ] **Step 2.1: 의존성 설치**

Run:
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
```

(`@vitejs/plugin-react`는 vitest가 tsx를 처리하는 데 필요.)

- [ ] **Step 2.2: vitest 설정**

Create or overwrite `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./tests/setup-jsdom.ts"],
        },
      },
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

(Plan 1이 이미 단일-env vitest를 만들었으면 이 설정으로 갈음. unit 테스트는 `tests/unit/`, 컴포넌트 테스트는 `tests/components/`로 디렉토리 분리.)

- [ ] **Step 2.3: jsdom setup 파일**

Create `tests/setup-jsdom.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 2.4: `tests/components/` 디렉토리 placeholder**

Create empty `tests/components/.gitkeep` (so directory exists).

- [ ] **Step 2.5: package.json 스크립트**

Modify `package.json` `scripts` to ensure these exist (keep others):
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2.6: 환경 smoke**

Create temporary `tests/components/_smoke.test.tsx`:
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

describe("jsdom smoke", () => {
  it("renders a heading", () => {
    render(<h1>안녕</h1>);
    expect(screen.getByRole("heading", { name: "안녕" })).toBeInTheDocument();
  });
});
```

Run:
```bash
npm test
```

Expected: 1 test passes in the `jsdom` project. Any other unit tests from Plan 1 (if executed) also pass.

Delete `tests/components/_smoke.test.tsx`.

- [ ] **Step 2.7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup-jsdom.ts tests/components/.gitkeep
git commit -m "chore(test): add jsdom project and RTL for component tests"
```

---

## Task 3: PillButton (TDD)

**Files:**
- Create: `tests/components/pill-button.test.tsx`
- Create: `src/components/design/pill-button.tsx`

- [ ] **Step 3.1: 실패하는 테스트**

Create `tests/components/pill-button.test.tsx`:
```tsx
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
```

- [ ] **Step 3.2: 실패 확인**

Run:
```bash
npm test
```

Expected: 5 failures referencing `@/components/design/pill-button`.

- [ ] **Step 3.3: 최소 구현**

Create `src/components/design/pill-button.tsx`:
```tsx
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
```

- [ ] **Step 3.4: 초록**

Run:
```bash
npm test
```

Expected: 5 passes (plus any prior unit tests).

- [ ] **Step 3.5: 타입 체크**

Run:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3.6: Commit**

```bash
git add tests/components/pill-button.test.tsx src/components/design/pill-button.tsx
git commit -m "feat(design): add PillButton primitive with variants"
```

---

## Task 4: UnderlineInput (TDD)

**Files:**
- Create: `tests/components/underline-input.test.tsx`
- Create: `src/components/design/underline-input.tsx`

- [ ] **Step 4.1: 실패하는 테스트**

Create `tests/components/underline-input.test.tsx`:
```tsx
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
    // 마지막 콜의 input.value는 "엄마"
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last.target.value).toBe("엄마");
  });

  it("data-style='underline'로 식별된다 (box/카드 변형이 아니라는 의도)", () => {
    render(<UnderlineInput placeholder="x" />);
    expect(screen.getByPlaceholderText("x")).toHaveAttribute("data-style", "underline");
  });
});
```

- [ ] **Step 4.2: 실패 확인**

Run `npm test`. Expected: 4 failures.

- [ ] **Step 4.3: 최소 구현**

Create `src/components/design/underline-input.tsx`:
```tsx
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
```

- [ ] **Step 4.4: 초록**

Run `npm test`. Expected: 4 passes.

- [ ] **Step 4.5: 타입 체크**

Run `npx tsc --noEmit`. Expected: 0 errors.

- [ ] **Step 4.6: Commit**

```bash
git add tests/components/underline-input.test.tsx src/components/design/underline-input.tsx
git commit -m "feat(design): add UnderlineInput primitive"
```

---

## Task 5: Hero (Quiet) (TDD)

**Files:**
- Create: `tests/components/hero.test.tsx`
- Create: `src/components/design/hero.tsx`

- [ ] **Step 5.1: 실패하는 테스트**

Create `tests/components/hero.test.tsx`:
```tsx
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
```

- [ ] **Step 5.2: 실패 확인**

Run `npm test`. Expected: 4 failures.

- [ ] **Step 5.3: 최소 구현**

Create `src/components/design/hero.tsx`:
```tsx
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
```

- [ ] **Step 5.4: 초록**

Run `npm test`. Expected: 4 passes.

- [ ] **Step 5.5: 타입 체크**

Run `npx tsc --noEmit`. Expected: 0 errors.

- [ ] **Step 5.6: Commit**

```bash
git add tests/components/hero.test.tsx src/components/design/hero.tsx
git commit -m "feat(design): add Hero (quiet variant)"
```

---

## Task 6: ChipRow (TDD)

**Files:**
- Create: `tests/components/chip-row.test.tsx`
- Create: `src/components/design/chip-row.tsx`

- [ ] **Step 6.1: 실패하는 테스트**

Create `tests/components/chip-row.test.tsx`:
```tsx
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
```

- [ ] **Step 6.2: 실패 확인**

Run `npm test`. Expected: 4 failures.

- [ ] **Step 6.3: 최소 구현**

Create `src/components/design/chip-row.tsx`:
```tsx
"use client";

export interface ChipItem {
  id: string;
  label: string;
}

export interface ChipRowProps {
  items: ChipItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function ChipRow({ items, activeId, onSelect }: ChipRowProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-6 md:px-10 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = item.id === activeId;
        const base =
          "shrink-0 rounded-full px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase transition-colors";
        const tone = active
          ? "bg-[var(--color-ink)] text-[var(--color-bg)] border border-[var(--color-ink)]"
          : "border border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-ink-muted)]";
        return (
          <button
            key={item.id}
            type="button"
            data-active={active}
            aria-pressed={active}
            onClick={() => onSelect(item.id)}
            className={`${base} ${tone}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6.4: 초록**

Run `npm test`. Expected: 4 passes.

- [ ] **Step 6.5: 타입 체크**

Run `npx tsc --noEmit`. Expected: 0 errors.

- [ ] **Step 6.6: Commit**

```bash
git add tests/components/chip-row.test.tsx src/components/design/chip-row.tsx
git commit -m "feat(design): add ChipRow filter primitive"
```

---

## Task 7: Topbar (TDD)

**Files:**
- Create: `tests/components/topbar.test.tsx`
- Create: `src/components/design/topbar.tsx`

- [ ] **Step 7.1: 실패하는 테스트**

Create `tests/components/topbar.test.tsx`:
```tsx
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
```

- [ ] **Step 7.2: 실패 확인**

Run `npm test`. Expected: 5 failures.

- [ ] **Step 7.3: 최소 구현**

Create `src/components/design/topbar.tsx`:
```tsx
import Link from "next/link";
import * as React from "react";

export interface TopbarNavItem {
  href: string;
  label: string;
}

export interface TopbarProps {
  wordmark?: string;
  navItems?: TopbarNavItem[];
  cta?: React.ReactNode;
}

export function Topbar({ wordmark = "Gallery.", navItems = [], cta }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-6 md:px-10 py-3 md:py-4 border-b border-[var(--color-border)]">
      <Link href="/" className="italic font-serif text-base md:text-lg text-[var(--color-ink)]">
        {wordmark}
      </Link>

      <div className="flex items-center gap-4 md:gap-5">
        <nav
          data-testid="topbar-nav"
          className="hidden md:flex items-center gap-4 text-[11px] tracking-[0.12em] uppercase text-[var(--color-ink-muted)]"
        >
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[var(--color-ink)] transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>
        {cta}
      </div>
    </header>
  );
}
```

- [ ] **Step 7.4: 초록**

Run `npm test`. Expected: 5 passes.

- [ ] **Step 7.5: 타입 체크**

Run `npx tsc --noEmit`. Expected: 0 errors.

- [ ] **Step 7.6: Commit**

```bash
git add tests/components/topbar.test.tsx src/components/design/topbar.tsx
git commit -m "feat(design): add Topbar primitive with wordmark + nav + cta"
```

---

## Task 8: MasonryLayout (TDD)

**Files:**
- Create: `tests/components/masonry-layout.test.tsx`
- Create: `src/components/design/masonry-layout.tsx`

- [ ] **Step 8.1: 실패하는 테스트**

Create `tests/components/masonry-layout.test.tsx`:
```tsx
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
```

- [ ] **Step 8.2: 실패 확인**

Run `npm test`. Expected: 4 failures.

- [ ] **Step 8.3: 최소 구현**

Create `src/components/design/masonry-layout.tsx`:
```tsx
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
```

- [ ] **Step 8.4: 초록**

Run `npm test`. Expected: 4 passes.

- [ ] **Step 8.5: 타입 체크**

Run `npx tsc --noEmit`. Expected: 0 errors.

- [ ] **Step 8.6: Commit**

```bash
git add tests/components/masonry-layout.test.tsx src/components/design/masonry-layout.tsx
git commit -m "feat(design): add MasonryLayout primitive (CSS columns)"
```

---

## Task 9: `/styleguide` 시각 검증 라우트

**Files:**
- Create: `src/app/styleguide/_chip-demo.tsx`
- Create: `src/app/styleguide/page.tsx`

- [ ] **Step 9.1: ChipRow 데모 client 컴포넌트 먼저 작성**

Create `src/app/styleguide/_chip-demo.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ChipRow, type ChipItem } from "@/components/design/chip-row";

const CHIPS: ChipItem[] = [
  { id: "all", label: "전체" },
  { id: "photo", label: "사진" },
  { id: "video", label: "영상" },
  { id: "2024", label: "2024" },
  { id: "travel", label: "여행" },
  { id: "birthday", label: "생일" },
];

export function ClientChipDemo() {
  const [active, setActive] = useState("all");
  return <ChipRow items={CHIPS} activeId={active} onSelect={setActive} />;
}
```

- [ ] **Step 9.2: 스타일가이드 페이지 작성**

Create `src/app/styleguide/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { Topbar } from "@/components/design/topbar";
import { Hero } from "@/components/design/hero";
import { MasonryLayout } from "@/components/design/masonry-layout";
import { PillButton } from "@/components/design/pill-button";
import { UnderlineInput } from "@/components/design/underline-input";
import { ClientChipDemo } from "./_chip-demo";

const SEEDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12"];

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <Topbar
        navItems={[
          { href: "/gallery", label: "사진" },
          { href: "/admin", label: "관리" },
        ]}
        cta={<PillButton>업로드</PillButton>}
      />

      <Hero title="가족 갤러리." subtitle="— 우리가 모은 순간들 —" />

      <ClientChipDemo />

      <MasonryLayout>
        {SEEDS.map((seed, i) => {
          const heights = [400, 200, 320, 480, 240, 360, 200, 280, 400, 220, 320, 260];
          const h = heights[i % heights.length];
          return (
            <img
              key={seed}
              src={`https://picsum.photos/seed/${seed}/400/${h}`}
              alt={`sample-${seed}`}
              className="w-full block rounded-sm"
              loading="lazy"
            />
          );
        })}
      </MasonryLayout>

      <section className="px-6 md:px-10 py-10 border-t border-[var(--color-border)]">
        <h2 className="font-serif text-2xl mb-4">PillButton</h2>
        <div className="flex flex-wrap gap-3">
          <PillButton>primary</PillButton>
          <PillButton variant="ghost">ghost</PillButton>
          <PillButton disabled>disabled</PillButton>
        </div>
      </section>

      <section className="px-6 md:px-10 py-10 border-t border-[var(--color-border)]">
        <h2 className="font-serif text-2xl mb-4">UnderlineInput</h2>
        <div className="max-w-sm flex flex-col gap-4">
          <UnderlineInput placeholder="이메일" />
          <UnderlineInput type="password" placeholder="비밀번호" />
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 9.3: 브라우저 시각 검증 (라이트 모드)**

Run:
```bash
npm run dev
```

Visit http://localhost:3000/styleguide. 체크리스트:

- [ ] 톱바: 좌측 "Gallery." 이탤릭 세리프, 우측 nav 3종(데스크톱만), 우측 끝 와인 알약 "업로드"
- [ ] 모바일(브라우저 너비 < 768px) — nav 텍스트 숨김, CTA만 보임
- [ ] Hero: 큰 세리프 "가족 갤러리.", 그 아래 이탤릭 부제, 베이지 배경 위 다크네이비
- [ ] 칩: 활성 칩(전체)이 다크 배경+베이지 글자, 나머지는 베이지 위 보더+갈색
- [ ] 칩 행: 모바일에서 가로 스크롤 가능 (스크롤바는 숨김)
- [ ] Masonry: 모바일 2열 / 태블릿 3열 / 데스크톱 4열, 행 정렬 깨짐 없이 흐름
- [ ] PillButton: primary(와인 채움), ghost(아웃라인), disabled(투명)
- [ ] UnderlineInput: 박스/카드 없음, 밑줄만, 포커스 시 밑줄 색이 와인

문제가 있으면 해당 컴포넌트 task로 돌아가 수정. 다시 테스트 + 시각 확인.

- [ ] **Step 9.4: 다크 테마 시각 검증**

브라우저 개발자도구 콘솔에서:
```js
document.documentElement.setAttribute("data-theme", "dark");
```

체크리스트:
- [ ] 배경이 `#1F1A14` 어두운 우드
- [ ] 글자가 베이지로 반전
- [ ] 칩/보더 등 모든 색이 토큰 따라 자연스럽게 다크화

`data-theme` 속성 제거하고 라이트로 복귀:
```js
document.documentElement.removeAttribute("data-theme");
```

Stop the server.

- [ ] **Step 9.5: 타입 체크**

Run `npx tsc --noEmit`. Expected: 0 errors.

- [ ] **Step 9.6: Commit**

```bash
git add src/app/styleguide/page.tsx src/app/styleguide/_chip-demo.tsx
git commit -m "feat(design): add /styleguide route for visual verification"
```

---

## Task 10: 부모 spec 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-05-14-family-gallery-design.md`

이 Task는 코드 변경 없음. 부모 spec을 디자인 패턴 spec §9에 기재된 6가지 변경에 맞춘다.

- [ ] **Step 10.1: §9 머리말에 디자인 패턴 spec 포인터 추가**

Find:
```markdown
## 9. UI / 디자인 (르네상스 미술관)

### 9.1 색 / 타이포
```

Replace with:
```markdown
## 9. UI / 디자인 (르네상스 미술관)

> **세부 시각 규칙은 `2026-05-21-design-pattern.md`를 따른다.** 본 절은 토큰 원본과 적용 외 화면(편집·휴지통·관리자·설정)의 기본 분위기만 기술한다.

### 9.1 색 / 타이포
```

- [ ] **Step 10.2: §9.2 (장식 요소) 갈음**

Find the section starting with `### 9.2 장식 요소` and replace its full body with:
```markdown
### 9.2 장식 요소

- 적용 화면(갤러리·라이트박스·로그인)의 장식 어휘는 `2026-05-21-design-pattern.md` §4를 따른다 (톱바 + 알약 CTA, 큰 세리프 디스플레이, 작은 캡션 라벨, 카테고리 필터 칩).
- 적용 외 화면(편집 캔버스·휴지통·관리자·설정)은 평이한 폼 카드를 사용한다. 1px 골드 보더와 코너 장식은 사용하지 않는다.
- 종이 텍스처 SVG 배경은 옵션 — 구현 폴리시 단계에서 도입 여부 결정.
```

- [ ] **Step 10.3: §9.3 (모바일 우선) 간소화**

Find the section starting with `### 9.3 모바일 우선` and replace its full body with:
```markdown
### 9.3 모바일 우선

- 그리드 컬럼: 모바일 2 / 태블릿 3 / 데스크톱 4 (`2026-05-21-design-pattern.md` §3.1에서 상세).
- 라이트박스 스택, 칩 가로 스크롤, 톱바 단축 규칙은 디자인 패턴 spec §7 참조.
- Lighthouse 모바일 90+ 목표 (이미지 lazy load, 코드 스플릿, 폰트 prefetch).
```

- [ ] **Step 10.4: §4 media 테이블에 `short_edge_px` 컬럼 추가**

Find the §4 `media` table definition (rows defining title, kind, mime_type, ...). Add a new row to that table:

```markdown
| short_edge_px | integer NOT NULL | 사진/영상 원본의 짧은 변(px). 그리드 호버 캡션 표시 여부 판정 (≥300이면 캡션 노출). 업로드 시 sharp 메타로 계산. |
```

- [ ] **Step 10.5: §11 설정 패널에 "로그인 배경 사진 사용" 토글 추가**

Find the §11 settings table. Add a row:

```markdown
| 로그인 배경 사진 사용 | 관리자 전용 토글. OFF면 fallback 정물화 사용 | 새 `settings` 단일 row 테이블 (디자인 패턴 spec §8 참조) |
```

- [ ] **Step 10.6: §16 향후/스코프 밖에 `media.caption` 후보 추가**

Find §16 (향후/스코프 밖). Add bullet:

```markdown
- 미디어별 자유 캡션 컬럼 (`media.caption text NULL`) — 라이트박스 메타 패널에 이탤릭 인용으로 노출. 디자인 패턴 spec §5.2에서 비워둔 자리.
```

- [ ] **Step 10.7: 일관성 확인**

Run:
```bash
grep -n "FAB\|코너 장식\|1px 골드 보더" docs/superpowers/specs/2026-05-14-family-gallery-design.md
```

Expected: §9.2를 제외한 다른 곳에 잔여 언급이 없거나, 있어도 신·구 충돌이 없는 맥락(예: spec 본문 다른 절은 영향 없음). 잔여 충돌이 있다면 그 문단을 수정.

Run:
```bash
grep -n "short_edge_px" docs/superpowers/specs/2026-05-14-family-gallery-design.md
```

Expected: 최소 1줄 (방금 추가한 줄).

- [ ] **Step 10.8: Commit**

```bash
git add docs/superpowers/specs/2026-05-14-family-gallery-design.md
git commit -m "docs(spec): align parent spec with new design pattern"
```

---

## Out of Scope (다음 Plan들이 할 일)

이 plan은 아래를 하지 않는다 — 디자인 패턴이 적용될 화면들을 만드는 일은 각각의 plan에서 처리:

- **Plan 1 (Foundation)**: login/landing/gallery placeholder 페이지를 만들 때 본 plan의 `Topbar`, `Hero`, `PillButton`, `UnderlineInput`을 import해서 사용. Plan 1 Task 12/13의 시안 부분을 본 plan의 프리미티브 호출로 갈음하도록 Plan 1을 별도 revision으로 갱신해야 한다 (이 plan 실행 후 사용자와 함께 결정).
- **Plan 2 (Media)**: media 테이블 추가 + `short_edge_px` 컬럼 포함 + 그리드 페이지에서 `MasonryLayout`을 실제 데이터로 채움 + 라이트박스 컴포넌트 작성 + 로그인 배경 사진 엔드포인트 + `settings` 테이블 도입. 모두 새 plan으로 작성.
- 캡션 호버 트랜지션의 픽셀 단위 polishing, 다크 테마에서의 각 컴포넌트 디테일 미세조정 — 시각 검증 후 필요 시 폴리시 plan으로.

---

## Verification (전체 종료 게이트)

본 plan 종료 시 다음을 만족하는지 손으로 확인:

- [ ] `npm test` 전부 통과 (단위 + jsdom 컴포넌트)
- [ ] `npx tsc --noEmit` 에러 0
- [ ] `npm run dev` → `/styleguide` 라이트 모드 시각 체크리스트 (Task 9.3) 통과
- [ ] `/styleguide` 다크 모드 (Task 9.4) 통과
- [ ] `git log --oneline -15` — 각 task 별 커밋이 분리돼 있고 메시지 prefix가 가이드(`feat:`, `chore:`, `docs:`)에 맞음
- [ ] 부모 spec(`2026-05-14-family-gallery-design.md`)에 §9 머리말 포인터·`short_edge_px`·로그인 배경 토글·`media.caption` 후보가 반영돼 있음
