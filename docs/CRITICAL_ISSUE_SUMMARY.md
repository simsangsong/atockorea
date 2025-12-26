# 🔴 Critical Issue Summary: Dynamic API Route 404

## 문제 상황

**증상:** `/api/tours/[id]` 동적 API 라우트가 프로덕션에서 HTML 404 반환

## 확인된 사실

✅ **정상 작동하는 것들:**
- 투어가 데이터베이스에 존재함 (6개 확인)
- `/api/tours` 정적 라우트는 정상 작동 (200 OK)
- Function이 Vercel Dashboard에 생성되어 있음
- 로컬 빌드에서는 라우트가 정상 인식됨

❌ **작동하지 않는 것:**
- `/api/tours/[id]` 동적 라우트가 HTML 404 반환
- `x-matched-path: /404` → Next.js가 라우트를 전혀 인식하지 못함
- UUID와 slug 모두 404
- 다른 모든 동적 API 라우트들도 404 (`/api/bookings/[id]`, `/api/reviews/[id]` 등)

## 근본 원인

**Vercel의 Next.js 라우터가 동적 API 라우트를 인식하지 못함**

- Function은 생성되었지만 요청이 Function으로 전달되지 않음
- Next.js 빌드는 정상이나 Vercel 배포 시 라우팅 실패

## 시도한 해결책들

1. ✅ 파일 재생성
2. ✅ params 타입 수정
3. ✅ runtime export 추가
4. ✅ 코드 리팩토링 (withErrorHandler 사용)
5. ✅ vercel.json에 rewrites 추가 (최종 시도)

**모두 실패**

## 다음 단계

### 1. Vercel 지원팀 문의 (권장)

**증거 자료:**
- Function은 존재하지만 요청이 도달하지 않음
- 모든 동적 API 라우트가 동일한 증상
- 정적 라우트는 정상 작동
- 로컬 빌드는 정상

**문의 내용:**
- Next.js 14 App Router + 동적 API 라우트(`[id]`)가 Vercel에서 인식되지 않음
- Function은 생성되었지만 `x-matched-path: /404` 반환
- 모든 동적 라우트에 동일한 문제 발생

### 2. 대안: Query Parameter 방식 사용

API 설계 변경:
- `/api/tours?id=xxx` 방식으로 변경
- 하지만 프론트엔드 코드도 수정 필요

### 3. 임시 해결책: 프론트엔드에서 `/api/tours`에서 필터링

```typescript
// 프론트엔드에서 모든 투어를 가져와서 필터링
const allTours = await fetch('/api/tours').then(r => r.json());
const tour = allTours.tours.find(t => t.id === tourId);
```

하지만 이것은 성능상 좋지 않음.

## 결론

**이것은 Vercel 플랫폼 레벨의 문제로 보입니다.**

코드, 파일 구조, 빌드 모두 정상입니다. Vercel의 Next.js 라우터가 동적 API 라우트를 인식하지 못하는 것이 문제입니다.

**권장 조치:** Vercel 지원팀에 문의하여 플랫폼 레벨 이슈인지 확인

