# 저장소(Vercel Blob) 설정 가이드

> 최종 확인: 2026-08-20 · `@vercel/blob` 2.8.0 · Vercel CLI 59.x

사진/영상은 **Vercel Blob private store**에 저장합니다. 브라우저가 서명된 PUT URL로 스토어에
직접 올리고, 서버는 그걸 읽어 WebP 변형을 만든 뒤 DB에 행을 씁니다.

> Cloudflare R2에서 옮겨왔습니다. S3 SDK(`@aws-sdk/*`)는 제거됐으니 다시 쓰지 마세요.

---

## 이미 끝나 있는 것 ✅

이 저장소에서는 아래가 **이미 완료**되어 있습니다. 새로 세팅할 일이 없으면 이 절은 건너뛰세요.

- 스토어 생성: `family-gallery-media` (private, **sin1**) — `store_OYNQoRxhWXyu71Ay`
- 프로젝트 연결: `yuon/family-gallery`
- 환경변수: `BLOB_READ_WRITE_TOKEN` (Production / Preview / Development + 로컬 `.env.local`)

동작 확인만 하려면:

```bash
npm run dev
```

로그인 → 사진 업로드 → Vercel 대시보드 **Storage → family-gallery-media**에 다음이 보이면 정상입니다.

```
original/<uuid>.jpg     원본 (덮어쓰기 불가)
medium/<uuid>.webp      1280px WebP
thumb/<uuid>.webp       200px WebP
```

---

## 처음부터 다시 세팅할 때

새 Vercel 프로젝트나 다른 팀에서 만들 경우:

```bash
# 1) private 스토어 생성 + 프로젝트 연결 + .env.local 갱신까지 한 번에
vercel blob create-store family-gallery-media --access private --region sin1 --yes

# 2) 나중에 토큰만 다시 받고 싶을 때
vercel env pull .env.local
```

대시보드로 하려면 **프로젝트 → Storage → Create Database → Blob → Access: Private**.

`--region`은 함수·DB 리전과 맞추세요. 이 프로젝트는 **`sin1`(싱가포르)** 로 통일돼 있습니다
— Neon이 `ap-southeast-1`이고 `vercel.json`의 `regions`도 `sin1`입니다. 조회는 CDN을 타므로
사용자 위치와는 무관합니다.

---

## 인증이 동작하는 방식

| 실행 위치 | 사용하는 자격증명 |
|---|---|
| Vercel (배포본) | **OIDC** — 자동 회전되는 단기 토큰. 아무 설정도 필요 없음 |
| 로컬 `npm run dev` | `.env.local`의 `BLOB_READ_WRITE_TOKEN` |
| 테스트 / 스크립트 | 같은 `BLOB_READ_WRITE_TOKEN` |

`src/lib/storage/blob.ts`의 `isStorageConfigured()`가 둘 다 없으면 갤러리는
picsum 더미 이미지로 폴백합니다. **갤러리에 모르는 사진이 뜬다면 토큰이 없는 것입니다.**

---

## 서명 URL 규칙 (spec §13 — 임의로 늘리지 말 것)

| 용도 | TTL | 강제 방식 |
|---|---|---|
| 업로드 (PUT) | **5분** | `UPLOAD_URL_TTL_MS` + 발급 시 content-type / 최대 크기까지 토큰에 각인 |
| 조회 (GET) | **24시간** | `VIEW_URL_TTL_MS` |

조회 URL은 스토어 전체를 덮는 위임 토큰 하나를 캐시해서 서명합니다. 갤러리 한 페이지에
30장이 있어도 컨트롤 API 왕복은 0회입니다. 위임 토큰만으로는 서명이 불가능하고
(`clientSigningToken`이 필요) 그 값은 서버 밖으로 나가지 않습니다.

**원본 덮어쓰기 방지**는 `allowOverwrite: false`로 스토어가 직접 막습니다 (spec §3.1).
같은 `original/` 키로 다시 PUT하면 400이 납니다.

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| 갤러리에 낯선 풍경 사진이 뜸 | `BLOB_READ_WRITE_TOKEN`이 없어 목업 폴백 중. `vercel env pull .env.local` 후 dev 재시작 |
| `Vercel Blob is not configured` | 위와 동일. `.env.local` 확인 |
| 업로드 PUT이 **403** | 서명 URL 만료(5분 초과) 또는 content-type이 발급 때와 다름 |
| 업로드 PUT이 **400** | 같은 `original/` 키가 이미 존재 (덮어쓰기 금지). mediaId는 매번 새로 발급되므로 재시도하면 해결 |
| 업로드 PUT이 **413** | `maximumSizeInBytes` 초과 — 사진 25MB / 영상 100MB |
| 조회 이미지가 **403** | 24시간이 지난 URL. 페이지를 새로고침하면 새 URL을 받습니다 |

---

## 무료 한도

Hobby 플랜 Blob 무료 제공량은 **약 1 GB 저장 + 10 GB 전송/월**입니다.
초과하면 요금이 붙는 게 아니라 **30일간 Blob 접근이 차단**되니, AGENTS.md §6대로
**0.8 GB를 경고선**으로 봅니다.

WebP 변형 덕분에 장당 실사용량은 원본 + 약 125 KB 수준입니다. 원본까지 합쳐
사진 1장당 3 MB로 잡으면 **약 330장**이 한도입니다. 더 필요하면:

1. 원본을 medium WebP로 대체 (spec §3.1 위배 — 편집 기능 포기해야 함)
2. Pro 플랜으로 업그레이드
3. Cloudflare R2로 이전 (무료 10 GB)
