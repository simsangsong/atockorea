# 전체 404 문제 종합 리뷰

## 📋 문제 현황

**증상:**
- ✅ localhost:3000 - 투어 상세 페이지 정상 작동
- ❌ atockorea.com (프로덕션) - "Tour not found" 404 에러
- API 엔드포인트 `/api/tours/[id]`가 HTML 404 페이지 반환 (JSON 아님)

## 🔍 확인한 사항들

### ✅ 정상 확인된 것들

1. **파일 구조**
   - `app/api/tours/[id]/route.ts` 존재 확인
   - Git에 정상 커밋됨
   - 로컬 빌드에서 정상 인식: `??? /api/tours/[id] 0 B 0 B`

2. **코드 패턴**
   - 다른 동적 API 라우트(`/api/bookings/[id]`, `/api/reviews/[id]`)와 동일한 패턴
   - params 타입: `{ params: { id: string } }` (올바름)
   - `export const dynamic = 'force-dynamic'` 설정
   - `export const runtime = 'nodejs'` 추가

3. **프론트엔드 연결**
   - `components/tours/DetailedTourCard.tsx`: `<Link href={`/tour/${tour.id}`}>`
   - `app/tour/[id]/page.tsx`: `${window.location.origin}/api/tours/${encodeURIComponent(tourId)}`
   - URL 구성 정상

4. **로컬 빌드**
   - `npm run build` 성공
   - `/api/tours/[id]` 라우트 빌드 로그에 나타남

### ❌ 놓쳤거나 확인 안 된 것들

1. **중요한 발견: 다른 동적 API 라우트도 404!**
   ```
   ❌ /api/tours/[id] => 404 (HTML)
   ❌ /api/tours/[id]/availability => 404 (HTML)
   ❌ /api/bookings/[id] => 404 (HTML)
   ❌ /api/reviews/[id] => 404 (HTML)
   ```
   → **모든 동적 API 라우트가 프로덕션에서 작동하지 않음!**

2. **Vercel Functions 로그 미확인**
   - Vercel Dashboard에서 실제 Function 로그 확인 필요
   - 에러 메시지나 타임아웃 확인 필요

3. **실제 배포된 파일 확인 안 함**
   - Vercel 빌드 아티팩트에서 파일이 실제로 포함되었는지 확인 안 함
   - 빌드 로그에는 나타나지만 실제 배포에 포함 안 될 수 있음

4. **Next.js 버전 호환성**
   - `package.json`에서 Next.js 버전 확인 필요
   - Vercel의 Next.js 런타임 버전 확인 필요

5. **중첩 라우트 구조**
   - `app/api/tours/[id]/availability/route.ts` 같은 중첩 라우트도 404
   - 같은 `[id]` 폴더 내의 모든 라우트가 영향받음

6. **정적 라우트는 작동함**
   - ✅ `/api/tours` (정적) => 200 OK
   - ✅ `/api/admin/merchants` (정적) => 403 (인증 오류지만 JSON 반환)

## 🎯 핵심 문제

**모든 동적 API 라우트(`[id]`, `[...nextauth]` 등)가 프로덕션에서 404를 반환**

이는 다음을 의미할 수 있습니다:
1. **Vercel의 동적 라우트 인식 문제**
2. **빌드 시 동적 라우트가 Serverless Function으로 생성되지 않음**
3. **Next.js 빌드 출력과 Vercel 배포 간 불일치**

## 🔧 시도한 해결책들

1. ✅ 파일 재생성 (삭제 후 재생성)
2. ✅ params 타입 수정 (Promise 제거)
3. ✅ `runtime = 'nodejs'` 명시적 설정
4. ✅ `dynamic = 'force-dynamic'` 설정
5. ✅ 다양한 디버깅 로그 추가

**하지만 모두 실패!**

## 💡 다음 단계 제안

### 1. Vercel Functions 로그 확인 (최우선)
```
Vercel Dashboard → Project → Deployments → Latest → Functions 탭
또는
Vercel Dashboard → Project → Functions 탭
```
- `/api/tours/[id]` Function이 실제로 생성되었는지 확인
- 호출 시 에러 로그 확인

### 2. Vercel 빌드 캐시 삭제
```
Vercel Dashboard → Project → Settings → General → Clear Build Cache
```

### 3. Next.js 버전 확인
```bash
cat package.json | grep '"next"'
```
- Next.js 14 이상인지 확인
- Vercel이 지원하는 버전인지 확인

### 4. vercel.json 설정 확인
- 현재 `vercel.json`에는 cron 작업만 있음
- 라우팅 규칙 추가 필요할 수 있음

### 5. Vercel 재배포 (캐시 없이)
- 강제 재배포로 빌드 캐시 무시

### 6. 대안: 다른 라우트 구조 사용
만약 Vercel이 특정 동적 라우트 구조를 인식하지 못한다면:
- Query parameter 방식: `/api/tours?id=xxx`
- 또는 다른 동적 라우트 명명 규칙 시도

## 📊 현재 테스트 결과 요약

```
✅ /api/tours (정적 라우트)
   Status: 200, Type: JSON

❌ /api/tours/[id] (동적 라우트)
   Status: 404, Type: HTML (Next.js 404 페이지)
   
❌ /api/tours/[id]/availability (중첩 동적 라우트)
   Status: 404, Type: HTML

✅ /api/admin/merchants (정적 라우트, 인증 필요)
   Status: 403, Type: JSON (라우트는 작동, 인증만 실패)
```

## 🚨 결론

**문제의 근본 원인:**
- 코드나 파일 구조 문제가 아님
- **Vercel이 프로덕션 환경에서 동적 API 라우트를 인식하지 못함**
- 로컬 빌드에서는 정상이지만 배포 시 Serverless Function 생성 실패

**다음 조치:**
1. Vercel Functions 탭에서 실제 Function 생성 여부 확인
2. Vercel 지원팀에 문의 또는 커뮤니티 포럼 검색
3. 필요 시 Vercel 대안 고려 (다른 호스팅 플랫폼 테스트)

