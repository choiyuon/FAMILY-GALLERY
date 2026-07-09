# Neon DB 연결 설정 가이드

이 프로젝트는 **Neon Postgres** (무료 티어)를 DB로 사용합니다. 지금은 `.env.local`에 `DATABASE_URL`이 비어 있어서 로컬 인메모리 DB(PGlite)로 임시 동작 중입니다. 이 문서를 따라 하면 실제 Neon DB에 연결됩니다.

## 1. Neon 계정 만들고 프로젝트 생성

1. https://console.neon.tech 접속 후 GitHub/Google 계정으로 가입 (무료).
2. "Create a project" 클릭.
   - Project name: `family-gallery` (아무 이름이나 상관없음)
   - Postgres version: 기본값 그대로 (16 이상)
   - Region: `Asia Pacific (Singapore)` 등 한국과 가까운 리전 추천
3. 프로젝트가 생성되면 대시보드에 "Connection string"이 바로 보입니다.

## 2. Pooled 커넥션 스트링 복사

- Neon 대시보드에서 **Connection string** 드롭다운을 **"Pooled connection"**으로 선택 (기본이 pooled인 경우도 있음). Serverless 환경(Vercel)에서는 반드시 pooled를 써야 합니다.
- `postgresql://...`로 시작하는 문자열 전체를 복사합니다. 예시 형태:
  ```
  postgresql://neondb_owner:xxxxxxxx@ep-xxx-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
  ```

## 3. `.env.local`에 붙여넣기

`C:\Projects\family-gallery\.env.local` 파일을 열어서:

```diff
- # DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require
+ DATABASE_URL=postgresql://neondb_owner:xxxxxxxx@ep-xxx-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

- 맨 앞 `#` 주석을 지우고, 복사한 값으로 교체합니다.
- 나머지 값(`AUTH_SECRET`, `ADMIN_EMAIL` 등)은 그대로 둬도 됩니다.

## 4. 마이그레이션 적용 (테이블 생성)

터미널에서 프로젝트 폴더 기준으로 실행:

```bash
npm run db:migrate
```

- 성공하면 Neon에 `users`, `invites`, `audit_log` 등 테이블이 생깁니다.
- 만약 `DATABASE_URL is not set` 에러가 뜨면 → 3단계에서 `.env.local` 저장이 안 된 것이니 다시 확인.

## 5. 관리자 계정 시딩 (최초 1회)

```bash
npm run seed:admin
```

- `.env.local`의 `ADMIN_EMAIL` / `ADMIN_PASSWORD`로 첫 관리자 계정이 만들어집니다.

## 6. 확인

```bash
npm run dev
```

- http://localhost:3000 에서 로그인 화면이 뜨면, 3~5단계에서 만든 관리자 계정으로 로그인해봅니다.
- Neon 대시보드 → 해당 프로젝트 → **Tables** 탭에서 데이터가 실제로 쌓이는지 확인하면 확실합니다.

## 참고: Vercel에 배포할 때

Vercel 프로젝트를 연결한 뒤에는, 같은 `DATABASE_URL` 값을 Vercel 프로젝트의 **Settings → Environment Variables**에도 등록해야 합니다 (Production/Preview 둘 다). 로컬 `.env.local`은 Vercel에 자동으로 올라가지 않습니다.

## 트러블슈팅

| 증상                             | 원인                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL is not set`      | `.env.local`에서 주석(`#`)을 안 지웠거나 오타                                                      |
| 연결은 되는데 타임아웃           | pooled 커넥션이 아니라 direct 커넥션을 넣었을 가능성 → 다시 "Pooled connection" 확인                  |
| 마이그레이션 후 테이블이 안 보임 | Neon 대시보드에서 브랜치(branch)가 여러 개일 때 다른 브랜치 보는 중일 수 있음 → 상단 브랜치 선택 확인 |
