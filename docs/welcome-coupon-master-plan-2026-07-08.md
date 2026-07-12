# 웰컴 쿠폰 + 전환 팝업 — 개정 마스터 플랜 (2026-07-08)

> 원본 핸드오프 스펙을 Phase 0 Discovery(라이브 DB + 코드베이스 3방향 조사) 결과로 개정한 **실행 기준 문서**.
> 원칙 유지: 공개가 = OTA가, 할인은 로그인 후 결제 단계에서만 실체화, 서버 권위 가격, OTA 가격 비교 문구 금지.

---

## §0. 환경/상태

- **Supabase 대상 검증 완료**: `cghyvbwmijqpahnoduyv` (AtoC). Kursoflow 아님.
- **브랜치/워크트리**: `worktree-welcome-coupon` @ `.claude/worktrees/welcome-coupon` (main 기준).
- 라이브 규모: auth.users 12명(확인 10명), bookings 42건 — 마이그레이션 리스크 낮음.
- **진행 상태 (2026-07-08)**: Phase 0~4 완료. DB 마이그레이션 2건 라이브 적용(`welcome_coupon_grants_core`, `welcome_coupon_trigger_fn_revoke_exec`) + 트리거 검증 + 어드바이저 신규 이슈 0. 유닛 27개(`__tests__/lib/coupons/*`) + 라이브 스모크 15체크(`scripts/coupon-live-smoke.ts`) 그린. jest 전체: 기존 실패 5스위트(베이스 main에서 재현 확인, 본 트랙 무관) 외 전부 그린.
- **런치 스위치**: `WELCOME10.is_active` = false 시딩 → 머지·배포 후 `update promo_codes set is_active=true where code='WELCOME10'`. 팝업은 `lib/welcome-coupon/config.ts`의 `WELCOME_POPUP_ENABLED`.
- **사용자 액션 잔여**: Stripe Radar 활성 확인, Klook 계약 parity 조항 확인, (선택) 기존 확인유저 10명 백필 여부.

---

## §A. 원 스펙 대비 확정 차이 (Discovery 결과)

| # | 스펙 가정 | 실제 | 개정 |
|---|---|---|---|
| A1 | 결제 시 PI 생성 → PI 생성 시 grant 점유 | **카드온파일 홀드 모델.** 투어 ≤7일: `/api/stripe/checkout`이 manual-capture PI 생성. **>7일: SetupIntent만(카드 저장), PI는 `recapture-holds` 크론이 투어 6일 전 생성.** PI 금액 = `bookings.final_price`에서 파생 | **grant 점유 = 예약 생성 시점**(final_price 확정 시). 쿠폰 라이프사이클은 PI가 아니라 **예약 라이프사이클**에 결속. PI id는 생기는 시점에 redemption에 기록 |
| A2 | `coupons` 테이블 신설 | **`promo_codes` + `promo_code_usage` 이미 존재**(0 rows, admin CRUD API + public validate API 있음, cart 경로만 반쯤 배선·사실상 미사용) | 정의 계층 = **`promo_codes` 재사용 + additive 컬럼**. `coupon_grants`/`coupon_redemptions` 신설. `promo_code_usage`는 그대로 둠(레거시) |
| A3 | `/api/checkout/create-intent` | 실제는 `app/api/stripe/checkout/route.ts` (metadata 훅 포인트 L218–246), 금액은 이미 서버 권위(`booking.final_price`) | 할인은 **예약 생성 API**(`/api/bookings`, `/api/itinerary/book`)에서 반영 → PI는 자동으로 할인가 홀드 |
| A4 | `/api/me/coupons` | mypage API 컨벤션은 **`/api/mypage/*`** (Bearer 토큰 패턴) | **`GET /api/mypage/coupons`** |
| A5 | OTP 또는 매직링크 신설 | **네이티브 Supabase 이메일 OTP 이미 가입 플로우**(`signInWithOtp` shouldCreateUser + `verifyOtp type:'email'`, `app/signup/page.tsx`). 별도 `verification_codes` 테이블은 가입과 무관한 병렬 시스템 | 팝업은 기존 네이티브 OTP 재사용 → `email_confirmed_at` 전이 트리거(방법 A) 유효 |
| A6 | zero-decimal 헬퍼 존재 가정 | `minorToMajor`/`zeroDecimal` 헬퍼 **없음** — `currency === 'krw'` 인라인 체크가 3곳에 산재 | 쿠폰 계산은 **major 단위**(bookings가 major 저장)로 하고 통화별 라운딩 헬퍼 1개 신설(`lib/coupons/discount.ts`) |
| A7 | i18n 6로케일 | `messages/{en,ko,zh,zh-TW,ja,es}.json` — 내부 `zh` = zh-CN(미들웨어가 매핑). 커스텀 `useTranslations()` 훅. **로케일 파일은 손편집**(스크립트가 EN 키 드랍 이력) | `welcomeCoupon.*` + `mypage.coupons.*` 네임스페이스 6파일 손편집 |
| A8 | 팝업 신설 | 마케팅 팝업 시스템 없음. UI 프리미티브 = **Base UI** `dialog.tsx`/`sheet.tsx`(`side="bottom"` 바텀시트 기성품), `use-media-query.ts`로 데스크톱/모바일 분기 선례(`MatcherBottomSheet`) | 그대로 재사용 |
| A9 | 레이트리밋 신설 | `lib/durable-rate-limit.ts` `requestGate`+`clientIpKey`(Upstash) — `send-verification-code`가 3/min·10/h 선례 | 재사용 |
| A10 | SSR 정가 게이팅 필요 | 가격은 전부 클라이언트 `formatPrice(USD major)`로 렌더, 퍼스널라이즈 입력 없음. 위험 표면은 `/`(ISR 600s)와 `/llms.txt`(3600s)뿐 | 할인 값을 카탈로그/상세 렌더 경로에 절대 주입하지 않으면 자동 충족. 검증만 수행 |
| A11 | 통화 | 예약 통화 2종: tour_product=**USD**, itinerary_builder=**KRW**(빌더는 현재 `ITINERARY_BUILDER_ENABLED=false`로 비활성) | 할인 로직은 양 통화 지원하되 1차 실전 표면은 USD(tour_product) |

**어댑테이션 외 발견된 기존 버그(본 트랙 범위 밖, 별도 처리):**
- `app/cart/page.tsx` L262가 validate 라우트를 GET으로 호출하는데 라우트는 POST — 죽은 경로.
- webhook `charge.refunded` 핸들러가 `refund_amount = minor/100` 하드코딩 — KRW 예약이면 오기록.

---

## §B. 확정 설계 결정

- **D1 정의 계층**: `promo_codes`에 additive 컬럼 추가 — `requires_login boolean default false`, `first_purchase_only boolean default false`, `usage_limit_per_user int`, `auto_grant_on_email_confirm boolean default false`, `grant_validity_days int`. 기존 컬럼(discount_type `'percentage'`, `max_discount_amount`, `min_purchase_amount`, `is_active`, `valid_from/until`) 그대로 활용. **admin CRUD API 공짜로 확보.**
- **D2 grant 점유 지점 = 예약 생성**: `/api/bookings`(USD)·`/api/itinerary/book`(KRW)에서 인증 유저 + active grant + first-purchase 조건 충족 시 원자적 UPDATE로 lock → 서버 계산 할인 → `bookings.final_price/discount_amount/promo_code`(기존 컬럼!)에 반영 → `coupon_redemptions` pending insert.
- **D3 상태머신은 예약 결속** (§D). PI id는 PI 생성 시점(체크아웃 or 크론)에 redemption에 채움.
- **D4 방치 예약 스윕**: 예약만 만들고 체크아웃 안 하면 grant가 영구 lock → `recapture-holds` 크론에 스윕 추가: `locked` grant 중 예약이 24h 넘게 `payment_status='pending'` && PI 미승인 → grant `active` 복원 + redemption `released`.
- **D5 통화 라운딩**: major 단위 계산, KRW=정수 반올림, USD=센트(2자리) 반올림. `lib/coupons/discount.ts` 헬퍼 1개. redemption에는 minor 단위 정수도 함께 기록(`amount_minor` 컨벤션은 `tour_product_offers` 선례).
- **D6 first_purchase 판정**: 동일 유저의 기존 예약 중 `payment_status in ('authorized','paid')`가 1건이라도 있으면 불가.
- **D7 팝업 OTP = 기존 가입 플로우 재사용**: `signInWithOtp({shouldCreateUser:true})` → `verifyOtp(type:'email')`. 성공 시 로그인 상태가 되고 `email_confirmed_at` 전이 → DB 트리거가 grant 발급. 기존 유저가 팝업에 이메일 입력해도 전이가 없으므로 grant 미발급(신규 전용 보장).
- **D8 기존 확인 유저 10명 백필 없음** (신규 고객 전용). 원하면 1줄 SQL로 추후 가능.
- **D9 롤아웃 안전장치**: `WELCOME10`을 `is_active=false`로 시딩 → 코드 머지·배포 후 활성화(트리거·예약 적용 모두 `is_active` 체크). 팝업은 `lib/welcome-coupon/config.ts`의 `WELCOME_POPUP_ENABLED` 상수(builder-visibility 패턴).
- **D10 validate 라우트 가드**: 공개 `POST /api/promo-codes/validate`가 `requires_login=true` 코드를 계산해주지 않도록 필터 1줄(레거시 cart 경로로 WELCOME10 우회 방지).

---

## §C. 데이터 모델 (확정 SQL 요지)

```sql
-- 1) promo_codes additive 확장
alter table promo_codes
  add column if not exists requires_login boolean not null default false,
  add column if not exists first_purchase_only boolean not null default false,
  add column if not exists usage_limit_per_user int,
  add column if not exists auto_grant_on_email_confirm boolean not null default false,
  add column if not exists grant_validity_days int;

-- 2) 유저별 지급
create table coupon_grants (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references promo_codes(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active','locked','redeemed','expired','revoked')),
  expires_at timestamptz,
  locked_booking_id uuid references bookings(id),
  granted_at timestamptz not null default now(),
  redeemed_at timestamptz,
  unique (promo_code_id, user_id)
);
create index on coupon_grants (user_id, status);

-- 3) 사용 원장 (예약 결속, PI는 나중에 채움)
create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references coupon_grants(id),
  promo_code_id uuid not null references promo_codes(id),
  user_id uuid not null references auth.users(id),
  booking_id uuid not null unique references bookings(id),
  payment_intent_id text unique,          -- ≤7d: 체크아웃 시 / >7d: 크론 시
  subtotal_major numeric not null,
  discount_major numeric not null,
  final_major numeric not null,
  subtotal_minor bigint not null,
  discount_minor bigint not null,
  final_minor bigint not null,
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending','captured','released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
```

- RLS: grants/redemptions — 본인 row SELECT만(`auth.uid() = user_id`), 쓰기 정책 없음(service role 전용). admin은 기존 role='admin' 패턴 SELECT 허용.
- 지급 트리거: `auth.users` `AFTER INSERT OR UPDATE OF email_confirmed_at` → `email_confirmed_at`이 null→값 전이(또는 INSERT부터 값)일 때 `auto_grant_on_email_confirm=true`인 active 코드 전부 grant insert(`on conflict do nothing`, `expires_at = now() + grant_validity_days`). `handle_new_user()`와 동일하게 SECURITY DEFINER + `set search_path to ''`.
- 시딩: `WELCOME10` — percentage 10, requires_login=true, first_purchase_only=true, usage_limit_per_user=1, auto_grant_on_email_confirm=true, grant_validity_days=30, **is_active=false(런치 시 true 전환)**.

## §D. 상태머신 (예약 라이프사이클 결속)

| 이벤트 | 코드 지점 | grant | redemption |
|---|---|---|---|
| 이메일 인증 완료 | DB 트리거 | → `active` 발급(+30d) | — |
| 예약 생성(할인 적용) | `/api/bookings`, `/api/itinerary/book` | `active`→`locked` (원자 UPDATE, locked_booking_id) | insert `pending` |
| PI 생성 | `/api/stripe/checkout`, `recapture-holds` 크론 | — | `payment_intent_id` 기록 + PI metadata에 coupon 필드 |
| capture 성공 `payment_intent.succeeded` | webhook | `locked`→`redeemed` | `captured` (+settled_at) |
| `payment_intent.canceled` / release | webhook + admin settle release | `locked`→`active`* | `released` |
| `payment_intent.payment_failed`(최종) | webhook | 유지(재시도 가능) | 유지 |
| 예약 취소(유저/관리자) | 취소 경로 + webhook 가드 | `locked`→`active`* | `released` |
| 24h 방치(pending 미결제) | 크론 스윕 | `locked`→`active`* | `released` |
| 만료 | 조회 시 lazy + 크론 | `active`→`expired` | — |

\* `expires_at` 미경과 시에만 `active` 복원(경과 시 `expired`). **복원이 기본.**

## §E. 코드 변경 지점

| 파일 | 변경 |
|---|---|
| `lib/coupons/discount.ts` (신설) | 할인 계산 + 통화 라운딩 + minor 변환 |
| `lib/coupons/grant.ts` (신설) | lock/release/redeem service-role 헬퍼 (모든 전이 단일 모듈) |
| `app/api/bookings/route.ts` | 서버 가격 확정 후 grant lock + 할인 반영 + redemption insert |
| `app/api/itinerary/book/route.ts` | 동일 (KRW, quote() 이후) |
| `app/api/stripe/checkout/route.ts` | redemption 있으면 PI metadata에 `promo_code_id/grant_id/discount_minor` + redemption.payment_intent_id 기록 |
| `app/api/cron/recapture-holds/route.ts` | PI 생성 시 동일 metadata/기록 + **방치 grant 스윕** |
| `app/api/stripe/webhook/route.ts` | succeeded→redeem / canceled→release (booking_id 기준, 멱등) |
| `app/api/admin/orders/[id]/settle/route.ts` | release 액션 시 grant release |
| `app/api/promo-codes/validate/route.ts` | `requires_login=true` 제외 필터 |
| `app/api/mypage/coupons/route.ts` (신설) | grant+정의 조인, daysLeft/isExpiringSoon 파생 |
| `app/api/welcome/status/route.ts` (신설, 선택) | 비로그인 억제엔 불필요 — 생략 가능 검토 |
| `components/welcome/WelcomePopup.tsx` (신설) | Dialog/Sheet 분기, 트리거·억제, OTP 2스텝 |
| `app/layout.tsx` | 팝업 마운트(전역, lazy) |
| `app/mypage/coupons/page.tsx` + `app/mypage/layout.tsx` nav | My Coupons 탭 |
| 체크아웃 배지 | `app/tour/[id]/checkout` 요약 + `LivePriceCard`(빌더) 할인 라인 |
| `lib/quote-engine/price-line-labels.ts` | `welcome_coupon` 라인 라벨(빌더 경로) |
| `messages/*.json` ×6 | `welcomeCoupon.*`, `mypage.coupons.*` |

## §F. 팝업 (스펙 §6 유지 + 어댑테이션)

- 트리거: ~~5s OR 스크롤 30%~~ **3s OR 스크롤 10%(2026-07-12 재튜닝)** 선도착, 데스크톱 exit-intent 추가. ~~세션당 1회(`sessionStorage`)~~ **개정(2026-07-12 사용자 결정): 매 페이지 로드마다 재장전.**
- 억제 **(2026-07-12 개정)**: `useSession()` 세션 존재 / `atoc_welcome_claimed`(발급 완료) / **"오늘 하루 보지 않기" 체크 후 닫기 = `atoc_welcome_hide_today`(로컬 날짜, 자정까지)** / `status==='checking'` 동안 대기. ~~7일 스누즈(`atoc_welcome_dismissed_at`)·세션당 1회 키~~ 폐기 — 체크 안 하면 매 접속마다 표시. 체크박스는 모든 닫기 경로(X·"다음에"·백드롭·ESC)에 적용. QA 오버라이드 `?welcome=1`(로그인·억제 전부 우회, 퍼널 이벤트 미발생). 열림 후 800ms 내 비명시적 닫힘 무시(모바일 제스처 가드).
- UI: 데스크톱 `Dialog`(중앙 카드 480px, 이미지 좌+폼 우), 모바일 `Sheet side="bottom"`. quiet-luxury 톤(§6.1 그대로), 기존 투어 무드컷 재사용. *(이후 개정: v2 티켓 → v3 라이트 → PR #290 중앙 컴팩트 → PR #291 스카이 리톤 — 최신 비주얼은 컴포넌트 헤더 주석 참조.)*
- OTP: 이메일 → `POST` 없이 클라이언트 `signInWithOtp`(가입 페이지와 동일; check-email 사전 중복확인 재사용) → 6자리 코드 → `verifyOtp` → 성공 화면("결제 시 자동 적용") → 세션 갱신은 SessionProvider가 처리.
- disposable email 블록리스트: `lib/coupons/disposable-domains.ts` — 팝업 send 직전 + 서버 check-email에서 차단.
- 카피: 스펙 §6.5 테이블 그대로(zh/zh-TW = 9折).

## §G. 마이페이지 My Coupons (스펙 §7 유지)

- `app/mypage/coupons/page.tsx` — Bearer fetch 패턴(dashboard 선례), 상태 배지 매핑·D-3 앰버 스트립·empty state 스펙 그대로. nav 배열(L100–108)에 탭 추가.

## §H. 패리티·어뷰징 (스펙 §8·§9 유지)

- 가격 렌더 경로(카탈로그/상세/홈 ISR/llms.txt)에 쿠폰 값 주입 금지 — Discovery로 현재 안전 확인, Phase 5에서 curl 검증.
- 팝업 카피에 OTA 비교 문구 없음(멤버 혜택 프레임). Klook 계약 parity 조항 확인 = **사용자 액션**.
- 어뷰징: 인증 후 발급(트리거), disposable 블록, unique(promo_code_id,user_id), first_purchase_only, requestGate 레이트리밋, grant lock. Stripe Radar 확인 = **사용자 액션**.

## §J. 실행 플랜

- **Phase 1** 데이터 계층: 마이그레이션(§C) + 트리거 + 시딩(inactive) + RLS + `get_advisors` 재실행. 검수: 테스트 유저 confirm → grant 발급, 중복 무시.
- **Phase 2** 결제 적용: D2 lock + 할인 반영 + PI metadata + webhook 상태머신 + 스윕 + settle release + validate 가드. 검수: 유닛 테스트(할인 계산·상태 전이) + 3케이스(적용/복원/이중사용).
- **Phase 3** 팝업: §F. 검수: 노출/억제 4종 + 모바일 바텀시트.
- **Phase 4** My Coupons: §G. 검수: 4상태 렌더.
- **Phase 5** 검증·출시: 비로그인 응답 할인 필드 0건, 빌드·기존 테스트 그린, 회귀(манual capture) 확인 → PR·머지 → `WELCOME10 is_active=true` 전환.

## §K. 리스크·후속

- 빌더(KRW) 경로는 현재 기능 플래그 off — 코드는 함께 배선하되 실검증은 USD 경로 우선.
- webhook KRW refund `/100` 버그, cart validate GET/POST 미스매치 — 별도 트랙.
- 다국어 이메일(예약 확인 메일에 할인 라인 표기)은 후속(현 메일 템플릿에 discount 라인 추가는 Phase 2에서 최소 반영 검토).
