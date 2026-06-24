# 리뷰 유입 마스터 플랜 — 출처 표기 임포트 + 자사 후기 수집

> 작성일 2026-06-24 · 브랜치 `claude/cross-platform-review-import-8xn2q7`
> 목표: 상품 상세 페이지의 신뢰성 있는 social proof를 늘려 전환율을 높인다 —
> **합법적이고 위조 없이.**

---

## 0. 스코프 결정 — 무엇을 만들고, 무엇을 안 만드는가

### ❌ 만들지 않는 것 (의도적으로 제외)
- 타 플랫폼 리뷰를 **문장만 살짝 바꿔** "다른 사람이 자발적으로 쓴 자연 리뷰"인 척 게시하는 기능.
- 이유: 자사 후기를 제3자 후기로 위장하는 행위는 아래 규제에 직접 저촉된다.
  - 🇰🇷 **표시·광고의 공정화에 관한 법률** — 기만적 표시·광고(과징금)
  - 🇺🇸 **FTC Fake Review Rule (2024)** — 위조/왜곡 리뷰 건당 최대 $51,744
  - 🇪🇺 **UCPD / Omnibus** — 출처·진위 위장 후기 금지
- "복사 정책 회피용으로 문장을 바꾼다"는 회피 의도는 분쟁 시 불리한 증거가 되며,
  투어 업종은 신뢰가 곧 매출이라 적발 시 타격이 크다. → **빌드 대상에서 영구 제외.**

### ✅ 만드는 것
같은 사업 목표(신뢰 social proof ↑ → 전환율 ↑)를 **정직하게** 달성하는 두 트랙.

| 트랙 | 내용 | 전환 효과 | 리스크 |
|---|---|---|---|
| **A. 출처 표기 임포트** | 타 플랫폼의 **진짜 고객 리뷰를 원문 그대로 + 출처 배지**와 함께 게시 | "외부 검증" 신뢰 ↑ | 재게시 권리/동의 전제 시 0 |
| **B. 자사 후기 수집** | 투어 종료 후 자동 안내 → 실제 고객이 직접 사이트에 작성 | 신선한 1차 리뷰 지속 유입 (최강) | 0 |

권장 우선순위: **B(지속 엔진) → A(초기 재고 채우기)**.

---

## 1. 현재 시스템 사실관계 (코드 검증 완료)

- 테이블 `public.reviews`
  - `id, user_id(FK auth.users), tour_id(FK tours), booking_id, rating(1-5),
     title, comment, images(jsonb), is_anonymous, is_verified, is_visible,
     created_at, updated_at`
  - `is_shadow` = `GENERATED ALWAYS AS (rating <= 3) STORED` (rating 3 이하는 비공개)
  - **출처/외부 작성자 컬럼 없음.**
- 공개 필터: `applyPublicReviewServerFilters` = `is_visible=true AND is_shadow=false`
  (`lib/reviews-queries.server.ts:23`). 서비스 롤은 RLS 우회하므로 임포트 INSERT 가능.
- 조립: `lib/tour-product/assembleTourProductReviews.ts` → 상세페이지 `guestReviews`/`reviewsSummary`.
- 작성 UI: `components/reviews/ReviewWriteWizard.tsx`, 표시: `ReviewDisplayCard.tsx`.
- 미작성 유도: `components/mypage/landing/PendingReviewTeaser.tsx`.
- API: `app/api/reviews/route.ts` (+ `[id]`, `home-summary`, `reactions`, `reports`).
- 평점 정직성: 리뷰 평균은 `assembleTourProductReviews`가 공개 리뷰에서 계산.

---

## 2. 트랙 A — 출처 표기 임포트 (정직 신디케이션)

### A1. DB 마이그레이션 (출처 메타 컬럼 추가)
```sql
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS source_platform text,   -- 'viator' | 'google' | 'tripadvisor' | 'klook' | 'getyourguide' ...
  ADD COLUMN IF NOT EXISTS source_url      text,   -- 원본 리뷰/페이지 링크(가능 시)
  ADD COLUMN IF NOT EXISTS external_author text,   -- 원작성자 표시명(원문 그대로, 이니셜 마스킹 옵션)
  ADD COLUMN IF NOT EXISTS source_captured_at date,-- 원 리뷰 작성일
  ADD COLUMN IF NOT EXISTS imported_at timestamptz DEFAULT now();
-- source_platform IS NOT NULL ⇒ 임포트 리뷰. user_id는 NULL 허용(외부 작성자).
COMMENT ON COLUMN public.reviews.source_platform IS
  'External review platform of origin. NULL = native first-party review.';
```
> 주의: 임포트 리뷰는 `user_id` 가 NULL → 기존 `reviews_user_tour_null_booking_key`
> 유니크 인덱스(`WHERE booking_id IS NULL`)와 충돌하지 않도록 인덱스 조건을
> `WHERE booking_id IS NULL AND user_id IS NOT NULL` 로 보강 필요.

### A2. 표시 규칙 (정직성 핵심 — 타협 불가)
- 임포트 리뷰 카드에 **출처 배지** 필수: 예) `Viator 인증 리뷰 · 2024.05`.
- 본문은 **원문 그대로**. 번역이 필요하면 "번역됨" 라벨 + 원문 토글.
- 평점 평균/카운트 표기 시 임포트 리뷰 포함 여부를 **명시**(혼합 시 "외부 N건 포함").
- `external_author` 는 원문 표시명 또는 이니셜 마스킹(개인정보). 가공·창작 금지.

### A3. 관리자 임포트 도구 (`/admin` 내)
- 입력: ① 캡쳐 이미지 업로드 또는 ② 수동 입력 폼.
- 캡쳐 → 비전/OCR로 `rating·comment·external_author·source_captured_at` **추출만**
  (창작 아님). 관리자가 원문과 대조·검수 후 저장.
- 저장 시 `source_platform` 등 메타 기록, 기본 `is_visible=true`.
- 권리 확인 체크박스: "이 리뷰를 재게시할 권리/동의가 있다"는 확인 게이트.

### A4. 조립/쿼리 반영
- `assembleTourProductReviews` 의 `GuestReview` 매핑에 `sourcePlatform/sourceBadge` 추가.
- 공개 필터는 그대로 사용(임포트도 `is_visible/is_shadow` 규칙 적용).

---

## 3. 트랙 B — 자사 후기 수집 엔진 (전환율 최강, 리스크 0)

### B1. 트리거
- 투어 종료(`bookings` 완료) + N일 후 → 후기 요청 발송.
- 채널: 이메일(기존 Resend 인프라 재사용) + 마이페이지 `PendingReviewTeaser` 강화.

### B2. 작성 플로우
- 기존 `ReviewWriteWizard` 재사용. 원클릭 진입 링크(토큰)로 마찰 최소화.
- 사진 첨부 유도(사진 리뷰가 전환에 가장 강함) — 이미 `images` 지원.

### B3. 인센티브(선택)
- 다음 예약 할인 등. 단 "긍정 리뷰 조건부 보상"은 금지(FTC) → **작성 자체에만** 보상.

### B4. 운영
- 자동 발송 cron, 미작성 리마인드 1회, 작성률/전환 추적(analytics 이벤트).

---

## 4. "리뷰 입력 도우미" 스킬 설계 (캡쳐 활용 — 합법 버전)

사장님이 가진 캡쳐를 살리되 **위조 없이** 돕는 스킬.

- **이름(안)**: `review-import-helper`
- **하는 일**:
  1. 캡쳐 이미지에서 리뷰 텍스트/별점/작성자/날짜를 **원문 그대로 추출**.
  2. 트랙 A 스키마에 맞춰 임포트 초안(draft) 생성 — `source_platform` 등 메타 포함.
  3. 관리자 검수 화면에 올려 사람이 확인 후 게시.
- **하지 않는 일**: 문장 리라이팅, 출처 은닉, 가짜 작성자 생성, 평점 조작.
- **가드레일**: 출처 배지 누락 시 게시 차단. 원문 보존 해시 기록.

---

## 5. 실행 순서 (제안)

| Phase | 내용 | 산출물 | 상태 |
|---|---|---|---|
| 0 | 본 플랜 합의 + 트랙 확정(B+A 권장) | 이 문서 | ⏳ 승인 대기 |
| 1 | A1 DB 마이그레이션 (출처 컬럼) | `supabase/migrations/*` | |
| 2 | A2/A4 표시·조립 반영 (출처 배지) | `ReviewDisplayCard`, `assembleTourProductReviews` | |
| 3 | A3 관리자 임포트 도구 + `review-import-helper` 스킬 | `/admin`, `.claude/skills/` | |
| 4 | B1/B2 자사 수집 자동화(이메일+티저) | cron, `ReviewWriteWizard` 링크 | |
| 5 | 추적/QA | analytics 이벤트, 검수 체크리스트 | |

> DB 마이그레이션과 공개 표시 변경은 되돌리기 어려우므로 Phase 1 진입 전 사용자 승인 필수.

---

## 6. 미해결/확인 필요 사항

1. **재게시 권리** — 타 플랫폼 리뷰 원문 재게시에 대한 권리/동의 근거? (플랫폼 약관·고객 동의)
2. 임포트 리뷰를 **평점 평균에 포함**할지, 별도 "외부 리뷰" 섹션으로 분리할지.
3. 트랙 우선순위: B 먼저(권장) vs A 먼저.
4. 캡쳐 추출 방식: 비전 모델 자동 추출 vs 관리자 수기 입력 보조.
