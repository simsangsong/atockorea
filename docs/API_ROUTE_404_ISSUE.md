# 🚨 중요 발견: API 라우트가 404 HTML을 반환

## 발견된 문제

프로덕션에서 `/api/tours/[id]` 엔드포인트에 요청했을 때:
- ❌ Status Code: 404
- ❌ Content-Type: `text/html` (JSON이 아님)
- ❌ `x-matched-path: "/404"` 헤더 존재

이것은 **API 라우트가 실행되지 않고 Next.js의 기본 404 페이지가 반환**되고 있다는 의미입니다.

## 가능한 원인

### 1. Next.js App Router API 라우트 구조 문제 (확률 높음)

Next.js 13+ App Router에서는:
- ✅ 올바른 경로: `app/api/tours/[id]/route.ts`
- ✅ 파일 구조 확인 필요

### 2. 빌드 시 API 라우트가 포함되지 않음

빌드 로그를 확인하여 API 라우트가 실제로 빌드되었는지 확인:
```
Build Completed in /vercel/output
```

### 3. Vercel 라우팅 설정 문제

`vercel.json` 또는 Next.js 설정에서 API 라우트가 제대로 인식되지 않을 수 있습니다.

## 해결 방법

### Step 1: 파일 구조 확인

현재 구조 (정상으로 보임):
```
app/
  api/
    tours/
      [id]/
        route.ts  ✅
      route.ts  ✅
```

### Step 2: 빌드 로그 확인

Vercel Dashboard → Deployments → 최신 배포 → Build Logs

다음 내용 확인:
- API 라우트가 빌드에 포함되었는지
- 에러가 없는지

### Step 3: 다른 API 엔드포인트 테스트

다른 API가 작동하는지 확인:
```bash
# 작동하는 API가 있다면 비교
curl https://www.atockorea.com/api/tours
```

### Step 4: 로컬에서 빌드 테스트

```bash
npm run build
```

빌드 후 `.next/server/app/api/tours/[id]/route.js` 파일이 생성되는지 확인

## 즉시 확인해야 할 사항

1. ✅ Vercel 빌드 로그에서 API 라우트 관련 에러 확인
2. ✅ 다른 API 엔드포인트가 작동하는지 테스트
3. ✅ 로컬에서 `npm run build` 실행하여 API 라우트가 빌드되는지 확인






