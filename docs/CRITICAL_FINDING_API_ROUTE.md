# 🚨 중요 발견: `/api/tours/[id]` 라우트만 HTML 404 반환

## 테스트 결과

### ✅ 작동하는 API
- `/api/tours` → 200 JSON ✅
- `/api/admin/merchants` → 403 JSON (인증 에러지만 JSON 반환) ✅

### ❌ 작동하지 않는 API
- `/api/tours/[id]` → 404 HTML (Next.js 404 페이지) ❌

## 문제 분석

다른 API 라우트들은 정상 작동하지만, `/api/tours/[id]`만 HTML 404를 반환합니다.

이것은 **Next.js가 동적 라우트 `[id]`를 인식하지 못하고 있다**는 의미입니다.

## 가능한 원인

### 1. 파일 구조 문제
현재 구조:
```
app/api/tours/[id]/route.ts
```

다른 동적 라우트와 비교 필요:
- `/app/tour/[id]/page.tsx` (페이지 라우트) - 빌드 로그에 ƒ 표시됨

### 2. 빌드 시 동적 라우트 미포함
- Vercel 빌드 로그에서 API 라우트 확인 필요
- `.next/server/app/api/tours/[id]/route.js` 파일 생성 여부 확인

### 3. Next.js App Router 버전/설정 문제
- `next.config.js` 확인
- Next.js 버전 확인

## 해결 방법

### 즉시 확인 사항

1. **빌드 로그 확인**
   - Vercel Dashboard → Deployments → Build Logs
   - API 라우트 빌드 관련 메시지 확인

2. **로컬 빌드 테스트**
   ```bash
   npm run build
   ```
   - `.next/server/app/api/tours/[id]/route.js` 파일 생성 여부 확인

3. **다른 동적 API 라우트 확인**
   - `/app/api/tours/[id]/availability/route.ts` 등이 작동하는지 확인

### 해결 시도

1. **파일명/구조 재확인**
   - `app/api/tours/[id]/route.ts` 파일이 정확히 존재하는지
   - 대소문자 확인

2. **빌드 캐시 클리어**
   - Vercel에서 재배포 (캐시 없이)

3. **파일 재생성**
   - 파일을 임시로 삭제 후 재생성

## 관련 파일

- `app/api/tours/[id]/route.ts` - 문제의 API 라우트
- `app/api/tours/route.ts` - 정상 작동하는 목록 API (비교용)
- `scripts/test-all-production-apis.js` - 테스트 스크립트

