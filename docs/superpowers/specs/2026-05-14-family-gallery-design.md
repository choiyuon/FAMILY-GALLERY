# 가족 갤러리 웹페이지 — 설계 문서

- **상태**: 초안 (사용자 리뷰 대기)
- **작성일**: 2026-05-14
- **원본 요구사항**: `가족 갤러리 웹페이지.txt`

## 1. 목적

가족 구성원이 각자 계정으로 접속해 사진과 영상을 함께 모아두고, 검색·편집·소프트 삭제할 수 있는 비공개 갤러리. 르네상스 미술관의 분위기를 차용한 시각 디자인. 모바일 우선.

## 2. 결정된 핵심 사항

| 항목 | 결정 |
|---|---|
| 사용 모델 | 멀티유저, 가족 구성원이 각자 계정. 외부 공유 불가 |
| 기술 스택 | Next.js (App Router) + TypeScript |
| 데이터베이스 | Neon Postgres (무료 티어) |
| 객체 스토리지 | Cloudflare R2 (10GB 무료, egress 무료) |
| 인증 | Auth.js (Credentials provider, JWT 쿠키) |
| 호스팅 | Vercel Hobby (개인용, 무료) |
| 가입 방식 | 관리자가 발급한 1회용 초대 링크 |
| 권한 모델 | 2개 역할: 관리자 / 멤버. 멤버는 삭제·휴지통 접근 불가 |
| 편집 기능 범위 | 풀버전 1차에 포함 (밝기/채도/대비 + 그리기 도구 + 자르기 + 원본 복원) |
| 우선 플랫폼 | 모바일 우선, 데스크톱도 작동 |
| 설정 항목 | 영상 볼륨, 라이트/다크 테마, 분류 필터, 랜딩으로 이동(종료) |

## 3. 시스템 아키텍처

```
브라우저 (모바일 우선)
   ├── 그리드 / 라이트박스 / 편집 캔버스 (react-konva, react-image-crop)
   └── Auth.js JWT 세션 쿠키
            │ HTTPS
Vercel (Next.js 서버리스)
   ├── App Router 페이지
   ├── REST 스타일 API 라우트
   ├── sharp 썸네일 생성
   ├── Auth.js 인증 핸들러
   └── Cron Job (1일 1회, 30일 지난 휴지통 청소)
            │
   ┌────────┴────────────┐
Neon Postgres        Cloudflare R2
- users              - originals/
- media              - medium/
- invites            - thumb/
- audit_log          - edited/
```

### 3.1 핵심 아키텍처 결정

- **이미지 변형은 업로드 시점에 만든다.** sharp로 thumb (200px) + medium (1280px) + original을 R2에 한번에 저장. 조회 시 변환 없음. (대안: on-the-fly 리사이즈는 무료 한도가 적어 채택 안 함.)
- **원본은 절대 덮어쓰지 않는다.** 편집본은 `edited/` 키에 별도 저장하고 DB가 포인터 관리. "원본 복원" = 편집본 R2 객체 삭제 + 포인터 NULL.
- **영상 썸네일은 클라이언트에서 추출한다.** 업로드 직전 브라우저에서 `<video>` + canvas로 첫 프레임을 JPEG로 만들어 함께 전송. Vercel에서 ffmpeg 안 씀.
- **모놀리식 Next.js.** 프론트 + API + 인증 같은 코드베이스. R2/Neon만 외부 의존.

### 3.2 표시 규칙 (어느 R2 키를 보여줄지)

| 위치 | 사진 | 영상 |
|---|---|---|
| 그리드 카드 | `r2_thumb_key` | `r2_thumb_key` (첫 프레임) |
| 라이트박스 | `r2_edited_key` 있으면 그것, 없으면 `r2_medium_key` | `r2_original_key` (재생) |
| 편집 캔버스 진입 | 항상 `r2_original_key` (편집을 깨끗한 원본 위에서 다시 시작) | 진입 불가 |

"원본 복원" 후엔 `r2_edited_key`가 NULL이 되어 자동으로 medium이 표시됨.

## 4. 데이터 모델

### 4.1 users

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| email | text UNIQUE | 로그인 ID |
| password_hash | text | Argon2 |
| display_name | text | "엄마", "아빠" 등 |
| role | enum('admin','member') | 기본 'member' |
| theme | enum('light','dark') | UI 테마 선호값 |
| created_at | timestamptz | |

### 4.2 invites

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| token | text UNIQUE | URL에 들어가는 32byte url-safe 랜덤 |
| created_by | UUID → users.id | 발급한 관리자 |
| expires_at | timestamptz | 발급 후 7일 |
| used_at | timestamptz NULL | 사용시 기록 |
| used_by | UUID NULL → users.id | 가입한 사용자 |

### 4.3 media

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| owner_id | UUID → users.id | 업로드한 사람 |
| title | text | 사용자가 지정한 이름 |
| title_lower | text UNIQUE INDEX | 검색 + 중복 검사 (case-insensitive) |
| kind | enum('photo','video') | |
| mime_type | text | |
| width / height | int | |
| duration_ms | int NULL | 영상만 |
| size_bytes | bigint | 원본 크기 |
| r2_original_key | text | R2 객체 키 |
| r2_medium_key | text NULL | 사진에만 있음 |
| r2_thumb_key | text | 사진/영상 모두 |
| r2_edited_key | text NULL | 편집본이 있을 때만 |
| created_at | timestamptz | |
| deleted_at | timestamptz NULL INDEX | NULL = 갤러리, NOT NULL = 휴지통 |
| deleted_by | UUID NULL → users.id | |

UNIQUE 인덱스 (`title_lower`)로 이름 전역 유니크 강제.

### 4.4 audit_log

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigserial PK | |
| actor_id | UUID → users.id | |
| action | text | 'upload', 'edit', 'delete', 'restore', 'purge', 'role_change', 'invite_create', 'invite_redeem' |
| target_media_id | UUID NULL | |
| target_user_id | UUID NULL | |
| metadata | jsonb | 자유 추가 정보 |
| created_at | timestamptz | |

## 5. 라우트 및 페이지

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── invite/[token]/page.tsx
├── (app)/
│   ├── landing/page.tsx          종료 후 도착 ("갤러리 들어가기" + "로그아웃")
│   ├── gallery/page.tsx          ★ 메인 그리드
│   ├── trash/page.tsx            휴지통 (admin)
│   └── admin/page.tsx            초대 발급 / 역할 변경 / audit log (admin)
└── api/
    ├── auth/[...nextauth]/
    ├── media/
    │   ├── upload                POST: pre-signed URL 발급 + 메타 저장
    │   ├── search?q=             GET
    │   ├── [id]                  GET / DELETE
    │   ├── [id]/edit             POST: 편집본 저장
    │   └── [id]/restore-original POST
    ├── trash/
    │   ├── empty                 POST
    │   └── [id]/restore          POST
    └── invites/
        ├── (POST)                새 발급
        └── [token]/redeem        POST: 가입 완료
```

라이트박스는 별도 라우트가 아닌 `gallery?photo=<id>` 쿼리 파라미터 기반 오버레이.

## 6. 컴포넌트

| 컴포넌트 | 책임 |
|---|---|
| MediaGrid | 무한 스크롤 그리드. 모바일 2열 / 태블릿 3 / 데스크톱 4 |
| Lightbox | 풀스크린 모달. 스와이프(모바일) + 화살표(데스크톱). 하단 액션바 (편집 / 삭제 - admin만) |
| UploadButton | 좌하단 고정 FAB. `<input type="file" accept="image/*,video/*" multiple>` |
| UploadDialog | 선택 파일 미리보기 + 각각 이름 입력 + 중복 검사 |
| NameSuggestModal | 중복시 가장 작은 미사용 번호 3개 제안 ("여행 (1)", "여행 (2)", "여행 (3)") |
| EditorCanvas | 라이트박스에서 붓 버튼 → 진입. 조정/그리기/자르기 3탭 |
| SettingsSheet | 우하단 톱니바퀴 FAB → 모바일 bottom sheet, 데스크톱 우측 패널 |
| TrashBar | 상단 반투명 휴지통 진입 (admin만) |
| SearchBar | 상단 검색. 결과 1개 → 자동 라이트박스, 다수 → 필터 그리드 |
| ConfirmDialog | 삭제 등 위험 작업 확인 (휴지통 비우기는 "DELETE" 타이핑 요구) |

## 7. 주요 사용자 흐름

### 7.1 업로드

1. 좌하단 FAB 탭 → 파일 선택 (다중 가능).
2. 선택된 파일들이 카드 리스트로 표시. 각 카드에 이름 입력 칸 (기본값: 파일명에서 확장자 제거).
3. "올리기" 탭:
   - 각 파일에 대해 클라이언트가 `POST /api/media/upload`로 메타 + title 검사 요청 → 서버가 `title_lower` UNIQUE 충돌이면 409 + 제안 3개 응답.
   - 충돌 시 그 카드에 `NameSuggestModal` 표시. 사용자가 1개 선택 후 재시도.
   - 검사 통과 → 서버가 R2 pre-signed PUT URL 발급 → 클라가 직접 R2로 업로드.
   - 업로드 완료 후 클라가 `POST /api/media/upload/complete`로 완료 알림 → 서버가 sharp로 thumb/medium 생성 + DB row 삽입 + audit_log.

### 7.2 갤러리 보기

1. `/gallery` 진입시 첫 30개 미디어 fetch (deleted_at IS NULL, 필터 적용, 최신순).
2. 무한 스크롤로 다음 페이지 fetch.
3. 카드 탭 → URL에 `?photo=<id>` 푸시 → `<Lightbox>` 오버레이.
4. 좌/우 스와이프 또는 화살표 키로 prev/next.
5. 라이트박스 닫기 → URL에서 `?photo` 제거.

### 7.3 검색

1. 상단 검색바에 단어 입력 → debounce 300ms → `GET /api/media/search?q=...`.
2. 서버가 `title_lower LIKE '%q%'` 조회.
3. 결과 1개 → 자동으로 그 미디어 라이트박스 열기.
4. 2개 이상 → 그리드를 그 결과들로 필터링 (URL에 `?q=` 반영).

### 7.4 편집 (사진만)

1. 라이트박스 하단 붓 버튼 → 편집 모드 진입.
2. 3개 탭 사용 (자세한 동작은 §8).
3. "저장" 탭 → 클라가 캔버스 합성 → JPEG 인코딩 → R2 `edited/`에 업로드 → `PUT /api/media/[id]/edit`로 `r2_edited_key` 갱신 + audit_log.
4. "원본 복원" 탭 → 확인 다이얼로그 → `POST /api/media/[id]/restore-original` → R2 객체 삭제 + DB 컬럼 NULL.
5. 영상에서는 붓 버튼 비활성.

### 7.5 삭제 / 휴지통 (admin만)

1. 라이트박스 하단 휴지통 아이콘 → 확인 다이얼로그 ("정말로 삭제 하시겠습니까?" + 취소 / 확인) → `deleted_at = now()`. R2는 그대로.
2. 상단 휴지통 버튼 → `/trash` → 휴지통 미디어 그리드.
3. 각 카드에서 "복원" → `deleted_at = NULL`.
4. 상단 "휴지통 비우기" → "DELETE" 타이핑 확인 → 모든 휴지통 미디어의 R2 객체 + DB row 즉시 삭제.
5. 매일 1회 Vercel Cron → `deleted_at < now() - interval '30 days'`인 모든 미디어 영구 삭제.

### 7.6 가입 / 로그인

1. 관리자가 `/admin` → "초대 발급" → 토큰 URL이 클립보드에 복사됨.
2. 가족이 URL을 받아 `/invite/[token]` → 토큰 검증 (만료/사용여부) → 이메일 + 비번 + 표시명 입력 → 가입 완료 → 자동 로그인 → `/gallery`.
3. 일반 로그인: `/login` → 이메일/비번 → JWT 쿠키 발급 → `/gallery`.

## 8. 편집 캔버스 상세

### 8.1 기술 스택

- **react-konva** (Konva.js 래퍼) — 레이어 + 터치 드래그 + 스트로크 관리. 번들 ~60KB.
- **react-image-crop** — 자르기 UI.
- **밝기/채도/대비** — CSS `filter`로 실시간 미리보기 → 저장 시 캔버스 픽셀 조작으로 베이크.

### 8.2 레이어 구조

```
[1] 배경 — 원본 사진 (Konva Image), 절대 안 건드림
[2] 조정 — CSS filter, 저장 시 [1]에 베이크
[3] 그리기 — Konva Line 스트로크 모음
```

### 8.3 그리기 도구

| 도구 | 구현 |
|---|---|
| 연필 | Konva Line, strokeWidth 2px |
| 펜 | Konva Line, strokeWidth 4px, lineCap='round' |
| 붓 | Konva Line, strokeWidth 12px, lineCap='round', opacity 0.8 |
| 지우개 | `globalCompositeOperation: 'destination-out'`, 그린 선만 지움 |

색상: `<input type="color">` + 최근 사용 6개 swatch (localStorage).

### 8.4 자르기

- `react-image-crop`으로 영역 선택. 비율 프리셋 (free / 1:1 / 4:3 / 16:9).
- 저장시 선택 영역만 캔버스에 그려서 인코딩.

### 8.5 저장 흐름

1. 사용자가 "저장" 탭.
2. 클라가 단계별 합성:
   a. 자르기 영역 적용해 캔버스 크기 결정.
   b. 원본 이미지 그리기.
   c. 조정 필터 적용 (픽셀 조작).
   d. 그리기 레이어 위에 그리기.
3. `canvas.toBlob('image/jpeg', 0.92)` → R2 pre-signed PUT URL로 업로드.
4. `POST /api/media/[id]/edit` → DB `r2_edited_key` 갱신 + audit_log.

## 9. UI / 디자인 (르네상스 미술관)

### 9.1 색 / 타이포

- 라이트: 베이지 (#F5EFE4), 잉크 다크네이비 (#1B2B3A), 골드 (#B8924B), 와인 (#7A2E2E).
- 다크: 어두운 벽 (#1F1A14) + 동일 골드.
- 본문: `Cormorant Garamond` + `Noto Serif KR`.
- UI: `Inter` + `Pretendard`.
- 모두 Google Fonts 무료.

### 9.2 장식 요소

- 사진 카드: 1px 골드 보더 + 코너 장식 (CSS gradient + box-shadow) → "액자" 느낌.
- 그리드 배경: 미세한 종이 텍스처 SVG (~5KB).
- 라이트박스 배경: 검은 갤러리 벽.
- FAB: 좌하단 업로드 (골드), 우하단 설정 (반투명 골드 톱니), 상단 휴지통 (반투명 와인레드, admin만).

### 9.3 모바일 우선

- 그리드: 모바일 2열 / 태블릿 3 / 데스크톱 4.
- 라이트박스: 스와이프가 주, 화살표 키 보조.
- 설정 패널: 모바일 bottom sheet, 데스크톱 우측 패널.
- Lighthouse 모바일 90+ 목표 (이미지 lazy load, 코드 스플릿, 폰트 prefetch).

## 10. 권한 / 인증

### 10.1 역할

| 역할 | 권한 |
|---|---|
| 관리자 | 업로드 / 편집 / 삭제 / 휴지통 관리 / 초대 발급 / 역할 변경 / audit 조회 |
| 멤버 | 업로드 / 보기 / 검색 / 편집 (삭제·휴지통 접근 불가) |

- 멤버가 편집해도 "원본 복원"으로 누구나 되돌릴 수 있음 (감사 로그 남음).
- 권한 검사는 모든 API 핸들러에서 `getServerSession` 후 수행. 클라 UI 숨김은 보조.

### 10.2 초대 토큰

- 32byte url-safe random.
- 만료 7일.
- 1회 사용. `used_at`이 NULL이 아니면 재사용 거부.

## 11. 설정 패널

| 항목 | 동작 | 저장 위치 |
|---|---|---|
| 영상 볼륨 | 0~100 슬라이더, 비디오 태그에 적용 | localStorage |
| 테마 | 라이트 / 다크 토글 | DB `users.theme` + localStorage 캐시. 첫 방문은 `prefers-color-scheme` 감지 |
| 분류 필터 | 라디오: 전체 / 사진 / 영상 | localStorage + URL `?filter=` |
| 종료 | `/landing`으로 이동 | 동작만, 저장 없음 |

## 12. 운영 / 무료 한도

- R2 사용량은 관리자 페이지에 표시 (Cloudflare API). 8GB 초과시 경고.
- 업로드 제한: 사진 25MB, 영상 100MB. R2 pre-signed PUT으로 직행 → Vercel API 본문 한도 우회.
- Vercel Cron 1개만 사용 (30일 휴지통 청소). 매일 03:00 KST.
- Sentry 무료 티어는 선택. MVP에는 미포함.

## 13. 보안 고려

- 비밀번호: Argon2id.
- JWT 쿠키: `HttpOnly`, `Secure`, `SameSite=Lax`.
- 모든 mutation API: CSRF 보호 (Auth.js 기본).
- R2 pre-signed URL 만료: 업로드 5분, 조회 24시간.
- 파일 검증: MIME + 매직 바이트 양쪽 확인 (`file-type` 라이브러리).
- 영상 최대 길이 기본값: 5분 (악의적 거대 파일 차단용 디폴트, 환경변수로 조정 가능).

## 14. 테스트 전략

- **단위 테스트** (Vitest):
  - 이름 충돌 검사 + 제안 생성 로직.
  - 권한 가드 (관리자 전용 API에 멤버 접근 시 403).
  - 휴지통 30일 청소 쿼리.
- **통합 테스트** (Playwright):
  - 로그인 → 업로드 → 라이트박스 → 편집 → 원본 복원.
  - 초대 발급 → 가입 → 로그인.
  - 멤버가 삭제 버튼 못 보고 API 직접 호출시 403.
- **E2E 데이터**: 테스트는 별도 Neon 브랜치 + 테스트 R2 버킷 사용.

## 15. 작업 분해 (출시 순서)

1. 프로젝트 부트스트랩 (Next.js + TS + Tailwind + 디자인 토큰).
2. Auth.js 로그인 / 미들웨어.
3. DB 마이그레이션 (drizzle 또는 prisma — drizzle 추천, Neon 친화적).
4. R2 클라이언트 + pre-signed URL API.
5. 업로드 흐름 (이름 중복 + 제안 + 썸네일 생성).
6. 그리드 + 라이트박스.
7. 검색 + 분류 필터.
8. 삭제 + 휴지통 + Cron.
9. 초대 / 가입 / admin 페이지.
10. 편집 캔버스 (조정 → 그리기 → 자르기 순).
11. 설정 패널 (테마, 볼륨).
12. 르네상스 디자인 폴리시 + 모바일 검증.
13. 배포 + 무료 한도 모니터링 UI.

## 16. 향후 (스코프 밖)

- 영상 편집.
- 가족 외부 공유 링크.
- 앨범 / 태그 / 날짜 그룹화.
- 얼굴 인식 자동 분류.
- 모바일 네이티브 앱.
