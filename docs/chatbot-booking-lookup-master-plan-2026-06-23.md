# 챗봇 "내 예약 조회" (읽기 전용) — 마스터 플랜

작성일: 2026-06-23 · 상태: 플랜(승인 대기) · 소유: simsangsong

---

## 0. 한 줄 요약

현재 챗봇은 `booking_specific` 인텐트(예약 관련 개인 문의)를 **무조건 사람에게 핸드오프**한다. 이 플랜은 **이메일 + 예약번호로 본인확인**한 뒤 **읽기 전용**으로 예약 사실(투어 일시·인원·결제/환불 상태 등)을 봇이 직접 답하게 만들어, CS 문의의 가장 큰 구멍을 메운다. **변경·취소·환불 같은 쓰기성 요청은 계속 사람에게 넘긴다.**

---

## 1. 배경 / 현재 상태 (검증된 사실)

- 프로덕션 챗봇(`origin/main`, HEAD `be84b80c`)은 **이미 풀 RAG 버전**: Gemini 2.5 Flash(temp 0.35, 비스트리밍) + 하이브리드 검색(OpenAI `text-embedding-3-small` 1536d, RRF top-8, 유사도≥0.18) + 자동 Q&A 학습 + 👍👎 피드백 + `/admin/chatbot-analytics`.
- 답변 경로: `app/api/tour-product/assistant/route.ts`. 의도분류는 **룰 기반 키워드**(`lib/chatbot/queryIntent.ts`), 9개 인텐트. `booking_specific` / `support` → 즉시 지원티켓 + 텔레그램 알림.
- 대화는 **무상태**(히스토리 24개 전달), 세션 토큰은 감사/에스컬레이션용.
- 예약 데이터: **이 Supabase DB의 `public.bookings`**(47컬럼). 검증(2026-06-23):
  - 총 7건(초기/테스트). `booking_reference` 100% 채워짐·유니크, `contact_email` 100%, `status` 100%.
  - ⚠ `pickup_point_id` 0건 — 예약별 픽업 미설정. 픽업 시각/장소는 **투어 단위 데이터**에서 끌어와야 함.

### 활용 가능한 `bookings` 필드
| 용도 | 컬럼 |
|---|---|
| 본인확인 키 | `booking_reference`, `contact_email` |
| 투어 일시/인원 | `tour_date`, `tour_time`, `number_of_guests` |
| 상태 | `status`, `payment_status`, `settlement_status`, `payment_intent_status` |
| 환불 | `refund_eligible`, `refund_processed`, `refund_amount`, `cancelled_at`, `cancellation_reason` |
| 금액 | `final_price`, `currency` |
| 기타 | `special_requests`, `contact_name`, `preferred_language`, `tour_id`(→`tours` 조인) |
| 노출 금지 | `user_id`, `merchant_id`, `stripe_customer_id`, `stripe_payment_method_id`, `payment_intent_id`, `setup_intent_id`, `payment_reference`, `contact_phone`(타인 보호) |

---

## 2. 바인딩 결정 (사용자 확정 — 변경 시 재승인)

- **B1. 범위 = 읽기 전용 조회.** 변경/취소/환불 *처리*는 봇이 하지 않는다. 그런 요청은 조회 후에도 사람 핸드오프.
- **B2. 본인확인 = 이메일 + 예약번호 동시 일치.** 로그인 불필요(게스트 예약 커버). 둘 다 정규화 후 정확 일치.
- **B3. 데이터 소스 = 이 Supabase `public.bookings`.** 외부 PG/예약엔진 연동 없음.
- **B4. 안전 필드 화이트리스트 방식.** 명시된 필드만 반환. 결제수단·stripe·내부 id는 절대 미반환.
- **B5. 결정론적 구현(모델 함수호출 X).** 서버가 인증·조회·주입을 수행하고, 검증된 사실만 컨텍스트로 모델에 넘긴다. (현재 룰 기반 아키텍처와 일관 + PII 안전 + 비용 0)
- **B6. 6개 로케일(en/ko/ja/zh/zh-TW/es) 응답 지원.**

---

## 3. 아키텍처

### 3.1 대화 흐름 (결정론적 게이트)
```
사용자 메시지
  → 인텐트 분류 (기존 classifyChatbotQuery)
  → booking_specific?
       ├─ 메시지에 예약번호+이메일 둘 다 포함? 
       │     ├─ 예 → verifyAndFetchBooking()
       │     │        ├─ 일치 → 안전 필드 주입 → 모델이 답변 (읽기 전용 가드 프롬프트)
       │     │        └─ 불일치/없음 → 정중한 실패 + 재시도 안내 / N회 실패 시 핸드오프
       │     └─ 아니오 → 봇이 "예약번호와 예약 이메일을 알려주세요" 요청 (로케일별)
       └─ 쓰기성 의도(취소/변경/환불해줘)인가? → 조회는 제공하되 처리는 사람 핸드오프 안내
```

### 3.2 신규/수정 파일
- `lib/chatbot/bookingLookup.ts` (신규)
  - `extractBookingCredentials(text)` — 메시지에서 예약번호/이메일 패턴 추출
  - `verifyAndFetchBooking({ reference, email })` — 정규화 + `bookings` 조회(서비스롤) + `tours` 조인 + 화이트리스트 매핑 → `SafeBookingView | null`
  - `formatBookingAnswerContext(view, locale)` — 모델 주입용 사실 블록(로케일 라벨)
  - `isWriteIntent(text, locale)` — 취소/변경/환불 *처리* 요청 감지
- `app/api/tour-product/assistant/route.ts` (수정)
  - `booking_specific` 분기에서 즉시 핸드오프 → 위 게이트로 교체
- `lib/chatbot/bookingLookupRateLimit.ts` (신규 또는 기존 rate-limit 유틸 재사용)
  - 세션+IP 기준 시도 카운트, 실패 임계 초과 시 잠금
- 감사 로깅: 조회 시도(성공/실패, 세션, ip_hash, 사유)를 기존 로깅 패턴으로 기록 — **이메일/예약번호 원문은 로깅 금지(해시 또는 마스킹)**

### 3.3 데이터 계약 — `SafeBookingView`
```ts
type SafeBookingView = {
  bookingReference: string;
  tourName: string;          // tours 조인
  tourDate: string;          // YYYY-MM-DD
  tourTime: string | null;   // HH:mm, null이면 "담당자 확정"
  guests: number;
  status: string;            // 친화 라벨로 매핑(confirmed/pending/cancelled…)
  paymentStatus: string;     // 친화 라벨
  amount: { value: number; currency: string } | null;
  refund: { eligible: boolean; processed: boolean; amount: number | null } | null;
  cancellation: { cancelledAt: string; reason: string | null } | null;
  specialRequests: string | null;
  pickup: { note: "tour_level" };   // 예약별 픽업 없음 → 투어 안내 + 담당자 확정 문구
};
```
화이트리스트 외 컬럼은 이 타입에 **존재하지 않음** → 실수로도 노출 불가.

---

## 4. 보안 (게이트 — 미충족 시 출시 불가)

- **S1. 열거(enumeration) 방지.** 세션/IP당 시도 제한(예: 분당 5회, 시간당 20회), 실패 5회 후 일시 잠금. 응답은 성공/실패 시간차 최소화(상수시간 지향).
- **S2. 메시지 정규화.** 예약번호·이메일 trim + 대소문자 무시 일치. 이메일 형식 1차 검증.
- **S3. 화이트리스트 반환만.** §3.3 외 필드 절대 미반환(특히 stripe/payment_intent/user_id/phone).
- **S4. 쓰기 차단.** `isWriteIntent` true면 조회 답변 + "변경/취소/환불은 담당자가 처리합니다" + 핸드오프.
- **S5. PII 로깅 금지.** 자격증명 원문 로깅 금지(해시/마스킹). 답변 본문에도 타인 정보 미포함.
- **S6. RLS/권한.** 조회는 서비스롤 서버 경로에서만. 클라이언트 직접 쿼리 불가.
- **S7. 프롬프트 가드.** 주입 컨텍스트에 "이 예약 사실만 사용, 추측 금지, 결제수단/내부ID 언급 금지, 처리 요청은 담당자 안내" 명시.

---

## 5. 단계 (순차 진행)

- **Phase 0 — 게이트/준비**: 워크트리를 `origin/main` 기준으로 격리 생성(로컬 main stale 주의). `tours` 조인 키·상태 enum 값·로케일 라벨 소스 확인. 이 플랜 승인.
- **Phase 1 — 조회 코어**: `bookingLookup.ts`(추출·검증·화이트리스트·포맷터) + 유닛테스트(일치/불일치/대소문자/누락/화이트리스트 누출 0).
- **Phase 2 — 라우트 통합**: assistant route `booking_specific` 게이트 교체 + 자격증명 요청 카피(6로케일) + 쓰기 차단 + 핸드오프 폴백.
- **Phase 3 — 보안 하드닝**: rate-limit/잠금 + 감사 로깅(마스킹) + 상수시간 + 프롬프트 가드.
- **Phase 4 — 검증**: `rag:pressure` 하니스에 예약조회 케이스 추가(정상조회/오인증/쓰기차단/PII누출/타로케일). 빌드·타입·테스트 그린.
- **Phase 5 — 출시**: PR → 머지 → 프로덕션. `/admin/chatbot-analytics`에 조회 성공률/실패율 노출(후속).

---

## 6. 테스트 매트릭스 (Phase 4 통과 기준)

| 케이스 | 기대 |
|---|---|
| 정확 일치(예약번호+이메일) | 안전 필드로 정확 답변, 로케일 일치 |
| 이메일만/번호만 | 나머지 요청, 조회 안 함 |
| 번호 맞고 이메일 틀림 | 실패 안내(어느 쪽 틀렸는지 미노출) |
| 대소문자/공백 변형 | 정상 일치 |
| 5회 연속 실패 | 잠금 + 핸드오프 |
| "환불 처리해줘"(쓰기) | 조회는 하되 처리는 핸드오프 |
| PII 누출 점검 | stripe/payment_intent/user_id/phone 응답에 0건 |
| 픽업 시각 질문 | 투어 안내 + "담당자 확정" 문구(예약별 픽업 없음) |
| 6개 로케일 | 각 언어로 자연 응답 |

---

## 7. 비범위 / 후속 트랙 (이번 플랜 밖)

- 예약 변경/취소/환불 **처리**(쓰기) — 정책·승인 게이트 별도 설계 필요.
- 실시간 가용성·견적 조회 툴.
- 스트리밍 응답, 세션 간 메모리, 자동 재인덱싱(pg_cron), 해결률/CSAT 대시보드 고도화.
- 로그인 세션 기반 무인증 조회(현재 게스트 이메일+번호 우선).

---

## 8. 리스크 / 주의

- 데이터 7건(소량)이라 실전 변형(이메일 표기 차이, 번호 포맷)은 출시 후 모니터링 필요.
- `pickup_point_id` 비어있음 — 픽업 정확도 한계를 카피로 정직하게 처리.
- 로컬 main stale(origin보다 뒤) → **작업은 반드시 `origin/main` 기준 워크트리에서**.
- 답변 변동성(Gemini) — 사실 주입 + 저온도(0.35)로 억제하되, 핵심 사실은 결정론적 포맷터가 보장.
