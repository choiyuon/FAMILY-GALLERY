# Cloudflare R2 연결 설정 가이드

사진/영상 업로드는 브라우저가 **Cloudflare R2에 직접** 파일을 올리는 방식(pre-signed URL)입니다. 지금은 `.env.local`에 R2 관련 값이 없어서 업로드 시 "네트워크 오류"가 납니다. 이 문서를 따라 하면 해결됩니다.

## 1. Cloudflare 계정 & R2 활성화

1. https://dash.cloudflare.com 접속 후 가입/로그인 (무료).
2. 왼쪽 메뉴에서 **R2 Object Storage** 클릭 → 처음이면 "Get started with R2" 화면이 뜹니다. 오른쪽 위 파란 버튼 **"Add R2 subscription to my account"** 를 누르면 활성화됩니다. (예전 UI의 "Enable R2" 버튼이 이 이름으로 바뀌었습니다.)
   - 결제수단 등록이 필요하지만 `Total Due Now`는 $0.00이고, 무료 한도(스토리지 10GB/월, Class A 100만 요청, Class B 1000만 요청)를 넘을 때만 과금됩니다.
   - 이 프로젝트는 AGENTS.md §6에서 8GB를 경고선으로 잡고 있습니다.

## 2. 버킷 생성

1. R2 대시보드 → **Create bucket**
2. Bucket name: `family-gallery` (AGENTS.md 기준 이름, 원하면 다른 이름도 가능하나 3단계 `R2_BUCKET_NAME`과 일치시킬 것)
3. Location: Automatic
4. 생성 완료.

## 3. API 토큰 발급 (Access Key / Secret Key)

1. R2 대시보드 → 오른쪽 위 **"Manage API Tokens"** (또는 R2 홈의 "API" 탭)
2. **Create API Token** 클릭
3. Permissions: **Object Read & Write**
4. 적용 범위(Specify bucket): 방금 만든 `family-gallery` 버킷만 선택 (권장 — 전체 계정 권한 주지 않기)
5. 생성하면 아래 3가지가 한 번만 표시됩니다. **반드시 이 화면에서 바로 복사해두세요** (나중에 다시 못 봄):
   - `Access Key ID`
   - `Secret Access Key`
   - `Account ID` (또는 R2 대시보드 오른쪽 사이드바에 항상 표시됨)

## 4. CORS 설정 (중요 — 이거 빠뜨리면 다시 네트워크 오류 남)

브라우저가 `localhost:3000`에서 R2로 **직접** 업로드하기 때문에, 버킷에 CORS를 열어줘야 합니다.

1. 버킷 → **Settings** 탭 → **CORS Policy** → **Add CORS policy**
2. 아래 JSON을 붙여넣기 (로컬 개발용 + 배포 도메인):
   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:3000",
         "https://family-gallery-delta.vercel.app"
       ],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
3. 저장.

## 5. `.env.local`에 값 채우기

```diff
+ # Cloudflare R2
+ R2_ACCOUNT_ID=<3단계에서 복사한 Account ID>
+ R2_ACCESS_KEY_ID=<3단계에서 복사한 Access Key ID>
+ R2_SECRET_ACCESS_KEY=<3단계에서 복사한 Secret Access Key>
+ R2_BUCKET_NAME=family-gallery
```

- 네 줄 다 `AUTH_URL` 아래쯤에 추가하면 됩니다 (순서는 상관없음).
- `R2_PUBLIC_URL`은 현재 코드에서 쓰이지 않으니 지금은 생략해도 됩니다.

## 6. 확인

```bash
npm run dev
```

- 로그인 후 사진 업로드를 시도합니다.
- 성공하면 R2 대시보드 → `family-gallery` 버킷 → **Objects** 탭에 `original/<uuid>.jpg` 같은 키가 생깁니다.

## 트러블슈팅

| 증상 | 원인 |
|---|---|
| 여전히 "네트워크 오류" | `.env.local` 저장 후 `npm run dev`를 껐다 켰는지 확인 (env 변경은 서버 재시작 필요) |
| 콘솔에 CORS 에러 (`has been blocked by CORS policy`) | 4단계 CORS 설정을 안 했거나 `AllowedOrigins`에 지금 접속 중인 주소(`http://localhost:3000`)가 없음 |
| `R2_ACCOUNT_ID is not set` 에러 그대로 남음 | `.env.local` 오타 또는 서버 재시작 안 함 |
| 업로드는 되는데 사진이 안 보임 | R2 버킷을 public으로 안 열어서 그럴 수 있음 — 이 프로젝트는 pre-signed GET URL(24시간 만료)로 조회하므로 버킷을 public으로 만들 필요는 없음. 안 보이면 `src/lib/r2/client.ts`의 `presignGet` 관련 코드/권한 확인 |

## 참고: Vercel에 배포할 때

Neon DB와 마찬가지로, 이 4개 값을 Vercel 프로젝트에도 등록해야 합니다 (Production/Preview 둘 다). 대시보드의 **Settings → Environment Variables**에서 넣거나, CLI로:

```bash
printf '%s' "<값>" | vercel env add R2_ACCOUNT_ID production
```

배포 도메인은 `https://family-gallery-delta.vercel.app` 이며, 4단계 CORS `AllowedOrigins`에 이미 포함시켜 뒀습니다. 환경변수를 추가한 뒤에는 **새 배포를 만들어야 반영됩니다** (`vercel redeploy <배포 URL>`).
