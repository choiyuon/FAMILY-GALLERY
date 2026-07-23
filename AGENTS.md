# Family Gallery — Agent Guardrails

> 작업 시작 전 무조건 0~3절을 먼저 읽는다. 그 외는 작업 종류에 따라 해당 절로 점프.

---

## 0. Tech stack (truth — overrides your training data)

| 항목 | 값 | 비고 |
|---|---|---|
| Next.js | **16.2.6** | **15가 아니다.** Plan 문서에 "15"로 적혀 있으면 16 기준으로 읽어라. |
| React | 19.2.4 | |
| Tailwind | v4 (`@tailwindcss/postcss`) | v3 문법 금지 (`tailwind.config.js` 없음, `@theme` 블록 사용) |
| TypeScript | 5.x | strict |
| Node | 20.9+ 필수 | Next.js 16 요구사항 |
| ORM (예정) | Drizzle + `@neondatabase/serverless` | Plan 1 Task 3~4 |
| Auth (예정) | Auth.js v5 (`next-auth@beta`) Credentials + JWT | Plan 1 Task 7~9 |
| Password (예정) | Argon2id via `@node-rs/argon2` | bcrypt/scrypt 금지 |
| 객체 스토리지 | Cloudflare R2 (S3 호환) | Plan 2 |
| 호스팅 | Vercel Hobby | |
| 테스트 | Vitest (unit) + Playwright (E2E) | 실제 DB 사용 (§4 참조) |

---

## 1. Next.js 16 breaking-change 체크리스트

App Router 코드 작성 전, 해당하는 경우 `node_modules/next/dist/docs/01-app/` 의 관련 문서를 먼저 읽는다.

**Async-only가 된 API** (동기 접근하면 런타임 에러):

- `cookies()`, `headers()`, `draftMode()` — 전부 `await` 필수
- `params`, `searchParams` (page/layout/route/default) — `Promise<...>` 타입
- Page 컴포넌트 타입은 `PageProps`, layout은 `LayoutProps`, route handler는 `RouteContext` 사용 (`npx next typegen`으로 생성)

**파일/설정 변경**:

- 미들웨어는 `middleware.ts`가 아니라 **`proxy.ts`** (deprecated → renamed). Plan 1에 `middleware.ts`라 적혀 있어도 `proxy.ts`로 만든다.
- `next.config.ts`의 turbopack 설정은 **top-level `turbopack: {}`** (no longer under `experimental`)
- Turbopack은 dev/build 둘 다 기본. `--turbopack` 플래그 붙이지 마라
- `next lint`는 ESLint CLI 직접 실행으로 대체됨

**삭제/금지**:

- `experimental_ppr` Route Segment Config 제거
- `unstable_` 프리픽스가 빠진 안정 API 사용 (codemod로 자동 교체)
- 클라이언트 코드에서 Node native module(`fs` 등) import 금지

작성한 코드가 위 중 하나에 해당하면, 해당 docs를 인용해 PR 설명/커밋 메시지에 근거를 남긴다.

---

## 2. Plan-driven execution (필수 워크플로)

이 프로젝트의 모든 구현 작업은 `docs/superpowers/plans/*.md`에 적힌 task를 따른다. 즉흥적으로 코드를 쓰지 않는다.

- 현재 활성 plan: `docs/superpowers/plans/2026-05-14-foundation.md` (Plan 1: Foundation)
- 상위 spec: `docs/superpowers/specs/2026-05-14-family-gallery-design.md`
- task는 위에서 아래로 순차 진행. 한 task = 한 커밋 = 한 verification.
- task에 적힌 명령(`npm install`, `npm test` 등)을 그대로 실행한 출력으로 결과 확인. "성공했을 것이다" 추측 금지.

**Plan에 없는 일을 하려고 할 때**:

- 작은 보강(타입 좁히기, 누락된 import 등) → 그냥 한다.
- 새 기능/스코프 변경 → 먼저 brainstorming 후 plan을 새로 쓰거나 기존 plan을 수정한다.
- spec 자체에 어긋나 보이는 결정이 필요하면 **사용자에게 묻는다.**

**호출할 스킬**:

- 단일 plan 실행: `superpowers:executing-plans`
- 같은 plan의 독립 task 병렬 실행: `superpowers:subagent-driven-development`
- 새 plan 작성: `superpowers:writing-plans`
- 새 기능 설계 (spec 외): `superpowers:brainstorming` (먼저)

---

## 3. TDD + verification (양보 불가)

**TDD가 의무인 영역** (spec §14 + plan):

- 비밀번호 해시/검증 (`src/lib/auth/password.ts`)
- 초대 토큰 생성/검증 (`src/lib/invites/tokens.ts`)
- 권한 가드 (`src/lib/auth/guard.ts` — admin-only API에 member 접근 시 403)
- 이름 중복 검사 + 제안 생성 (`src/lib/media/title.ts`, Plan 2)
- 휴지통 30일 청소 쿼리 (Plan 2)
- audit_log 작성기 (`src/lib/audit/log.ts`)

순서: **빨강(실패하는 테스트 작성) → 초록(최소 구현) → 리팩터.** 구현부터 쓰지 않는다. 스킬: `superpowers:test-driven-development`.

**완료 주장 전 verification 게이트** — 매 task의 마지막 단계:

1. `npm test` (Vitest) — 관련 unit 테스트 통과
2. `npx tsc --noEmit` — 타입 에러 0
3. 해당 task가 UI를 추가하면 `npm run dev`로 띄워 브라우저에서 손으로 확인 (텍스트/색/레이아웃)
4. 위 3개의 실제 출력을 보지 않은 상태에서 "완료/통과" 말하지 마라

스킬: `superpowers:verification-before-completion`. 버그/예상 외 동작이 나오면 `superpowers:systematic-debugging`을 먼저 호출.

---

## 4. 테스트는 진짜 DB로 (No mocks)

Spec §14가 명시: "테스트는 별도 Neon 브랜치 + 테스트 R2 버킷 사용." 즉:

- DB 클라이언트를 mock하지 마라. 테스트 DB는 `src/lib/db/client.ts`의 `resolveDatabaseUrl()`이 고른다:
  - `TEST_DATABASE_URL`이 있으면 그 Neon 인스턴스를 쓴다 (별도 브랜치여야 함).
  - 없으면 in-memory PGlite로 폴백한다. PGlite는 WASM으로 컴파일된 **진짜 Postgres**이고 같은 마이그레이션을 적용하므로 mock이 아니다.
  - **`DATABASE_URL`로는 절대 폴백하지 않는다.** 그건 프로덕션 DB이고 `truncateAll()`이 통째로 지운다. `TEST_DATABASE_URL`을 `DATABASE_URL`과 같은 값으로 두면 `resolveDatabaseUrl()`이 예외를 던진다.
- 매 테스트 전 `tests/helpers/db.ts`의 `truncateAll()`로 초기화.
- 권한 가드 테스트는 진짜 user row를 만들어서 진짜 세션으로 호출. 가짜 세션 객체를 함수에 직접 주입하는 식의 검사는 의미 없음.

이유: 과거 사례에서 mock DB가 통과시킨 코드가 prod 마이그레이션에서 깨졌다는 일반 교훈이 있고, 이 프로젝트의 가장 큰 위험은 권한 우회와 schema drift이므로 통합 수준에서 검증해야 한다.

---

## 5. 보안 non-negotiables

| 규칙 | 이유 |
|---|---|
| 비밀번호는 **Argon2id만** (`@node-rs/argon2`). bcrypt/scrypt/plaintext SHA 금지. | spec §13 |
| 비밀번호 평문을 어떤 로그/audit/에러 메시지에도 남기지 마라. | |
| JWT 쿠키: `HttpOnly` + `Secure` + `SameSite=Lax`. 셋 중 하나라도 빠지면 안 됨. | spec §13 |
| 모든 mutation API 핸들러는 첫 줄에서 `auth()` (Auth.js v5) 호출 후 권한 확인. 클라 UI 숨김은 보조에 불과. | spec §10.1 |
| 관리자 전용 엔드포인트는 `requireAdmin()` 가드 통과 후에만 본문 실행. | |
| R2 pre-signed URL TTL: 업로드 **5분**, 조회 **24시간**. 그 이상으로 늘리지 마라. | spec §13 |
| R2 `original/` 키는 **절대 덮어쓰지 마라.** 편집본은 `edited/` 별도 키로 저장. | spec §3.1 |
| 업로드 파일은 MIME + 매직 바이트 양쪽 검증 (`file-type` 라이브러리). | spec §13 |
| 초대 토큰은 32-byte url-safe random, 만료 7일, 1회 사용. `used_at != NULL`이면 거부. | spec §10.2 |
| 영상 길이 상한 기본 5분 (env로 조정 가능). 거대 파일 차단용 디폴트. | spec §13 |

---

## 6. 무료 한도 가드레일

이 프로젝트는 무료 티어 전제. 다음을 어기는 결정은 사용자에게 먼저 물어라.

| 한도 | 값 |
|---|---|
| 사진 업로드 크기 | 25 MB |
| 영상 업로드 크기 | 100 MB |
| 영상 길이 | 5 분 |
| R2 스토리지 경고선 | 8 GB (10 GB가 무료 한도) |
| Vercel Cron | 1개만 (매일 03:00 KST 휴지통 청소) |

**도입 금지** (무료 한도 깨지거나 Vercel serverless에서 안 됨):

- 서버 측 ffmpeg / 영상 변환 → 영상 썸네일은 **브라우저에서** canvas로 첫 프레임 추출.
- on-the-fly 이미지 리사이즈 → 변형(thumb 200px, medium 1280px, original)은 **업로드 시점**에 sharp로 한 번에 생성.
- 백그라운드 워커/큐 → Vercel 서버리스 한 함수 호출 안에서 끝낸다.
- Sentry 등 유료 의존 (MVP 미포함).

업로드는 R2 pre-signed PUT으로 클라가 R2에 직접 → Vercel API 본문 한도 우회.

---

## 7. 디자인 일관성 (르네상스 미술관)

- **색은 토큰만** 사용: `var(--color-bg|bg-elevated|ink|ink-muted|gold|gold-soft|wine|border|shadow)`. 인라인 hex (`#FFF` 등) 금지. 새 색이 정말 필요하면 `src/styles/tokens.css`에 토큰 추가 + light/dark 양쪽 정의.
- **폰트**: h1~h4는 `var(--font-serif)` (Cormorant Garamond + Noto Serif KR), 본문/UI는 `var(--font-sans)` (Inter + Pretendard). Google Fonts만 사용 (`next/font/google`).
- **그리드**: 모바일 2열 / 태블릿 3 / 데스크톱 4. 모바일 우선으로 작성하고 `md:`/`lg:`로 키운다.
- **다크 테마**는 `[data-theme="dark"]` 토글로. 첫 방문은 `prefers-color-scheme` 감지, 이후엔 `users.theme` + localStorage.
- **Lighthouse 모바일 90+** 목표. 이미지 lazy load, 폰트 prefetch, 코드 스플릿.
- 새 UI 컴포넌트 만들 때 `superpowers:frontend-design` 스킬을 호출해 디자인 품질 점검.

---

## 8. DB 스키마 규율

- `src/lib/db/schema.ts`가 **단일 소스 오브 트루스**. 이걸 고치고 `npm run db:generate`로 마이그레이션을 만든다.
- **생성된 마이그레이션 SQL을 손으로 편집하지 마라.** 잘못됐으면 schema.ts를 고치고 다시 generate.
- 새 컬럼/테이블 추가 시 spec §4를 같은 커밋에서 갱신.
- 모든 mutation은 `audit_log`에 한 row를 남긴다 (`action`, `actor_id`, `target_media_id`/`target_user_id`, `metadata`). 누락 시 PR 불가.
- 미디어 삭제는 **soft delete만** (`deleted_at`). 진짜 DELETE는 (a) `/trash/empty` 또는 (b) 30일 cron 청소에서만.
- `media.title_lower` UNIQUE 제약을 우회하는 쿼리 만들지 마라 (이름 전역 유니크가 spec의 핵심 규칙).

---

## 9. 한국어 / 영어 분리

- 사용자에게 보이는 모든 문자열 (UI 텍스트, 에러 메시지, 메타데이터, 이메일 본문) → **한국어**
- 코드 식별자, 변수명, 함수명, 주석, 커밋 메시지 본문 → **영어**
- 단, 사용자와의 대화/PR 설명은 사용자가 쓴 언어를 따른다 (한국어)

---

## 10. 커밋 / 브랜치 규칙

- 한 Plan task = **한 커밋**. 여러 task를 한 커밋에 묶지 마라.
- 메시지 prefix: `feat:` (기능 추가), `fix:` (버그), `chore:` (설정/리팩터/문서 인프라), `test:` (테스트만), `docs:` (문서)
- 본문 마지막에 `Co-Authored-By: Claude Opus 4.7 ...` trailer 유지.
- 브랜치는 기본 `main`. worktree를 명시적으로 열었을 때만 별도 브랜치.
- 커밋은 사용자가 명시적으로 지시할 때만 만든다 (자동 커밋 금지).

---

## 11. 스킬 인덱스 (언제 어느 스킬을)

| 상황 | 스킬 |
|---|---|
| 이 프로젝트의 어떤 task든 시작 전 | **이 AGENTS.md 먼저** |
| 새 기능/스코프 변경 설계 | `superpowers:brainstorming` (구현 코드 쓰기 전) |
| `docs/superpowers/plans/*.md`의 task 진행 | `superpowers:executing-plans` |
| 같은 plan의 독립 task 병렬 처리 | `superpowers:subagent-driven-development` |
| 구현 코드를 쓸 때 (특히 §3 TDD 목록) | `superpowers:test-driven-development` |
| 새 plan 작성 | `superpowers:writing-plans` |
| 버그/테스트 실패/예상 외 동작 | `superpowers:systematic-debugging` (수정 시도 전) |
| "완료/통과/고침" 말하기 전 | `superpowers:verification-before-completion` |
| UI 컴포넌트/페이지 디자인 | `superpowers:frontend-design` |
| 작업 마무리 (merge/PR 결정) | `superpowers:finishing-a-development-branch` |
| PR 코드 리뷰 받기/주기 | `superpowers:requesting-code-review` / `:receiving-code-review` / `code-review:code-review` |
| 격리된 워크스페이스 필요 | `superpowers:using-git-worktrees` |
