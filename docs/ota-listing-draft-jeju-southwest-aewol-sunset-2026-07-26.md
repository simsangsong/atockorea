# OTA 리스팅 초안 — Jeju Southwest & Aewol Sunset (기사+스마트앱)

> 상태: **초안** — 스팟 구성은 사장 확정 대기 (전부 `match_pois`에 좌표·데이터가 이미 있는 스팟만 사용).
> 표기 원칙: "guided tour"라 쓰지 않는다. **Private Driver + Live Smart Guide App**으로 정직하게 판다.

---

## 1. 제안 코스 (v1 — 사장 검토용)

전 스팟이 `match_pois` 기존 데이터 재사용 → 콘텐츠 파이프라인 즉시 가동 가능.

| # | 스팟 | poi_key | 체류(안) | 비고 |
|---|---|---|---|---|
| 1 | 오설록 티뮤지엄 | `osulloc_tea_museum` | 50분 | 오전 시작, 실내+야외 혼합 |
| 2 | 산방산 + 용머리해안 | `sanbangsan_mountain` / `yongmeori_coast` | 70분 | 용머리는 물때 따라 산방산 전망으로 대체 (앱 날씨 자동 삽입과 궁합) |
| 3 | 사계해변 (형제섬 뷰) | `sagye_beach` | 30분 | 포토 스팟 |
| 4 | 송악산 둘레길 | `songaksan` | 60분 | 가벼운 워킹 (서양 손님 오름 회피 성향 고려 — 정상 등반 아님을 명기) |
| 5 | 점심 (모슬포/사계 흑돼지 or 해물) | — | 70분 | 앱 맛집 핀으로 선택지 제공 |
| 6 | 카멜리아힐 **or** 헬로키티(가족) | `camellia_hill` | 60분 | 시즌 스왑 슬롯 (겨울 동백/봄 수국) |
| 7 | 협재해변 | `hyeopjae_beach` | 40분 | 비양도 뷰 |
| 8 | 애월 카페거리 + 일몰 | `aewol_cafe_street` | 60분 | 피날레. 일몰 시각 따라 7↔8 순서 유동 |

- 시즌 변형: 봄 = 산방산 유채(`sanbangsan_canola_field`) 삽입 / 겨울 = 카멜리아힐 고정
- 집합~해산 대략 09:00~19:30 (동절기) · ~20:30 (하절기) — **자정 엣지 무관 확인됨**
- ⚠ 신규 콘텐츠 필요분: 위 8스팟 중 curated 카드 없는 스팟 → 기존 파이프라인으로 6로케일 생성 (Claude 작업, 사장 확정 후 반나절)

## 2. 리스팅 카피 (영문 초안)

**Title (GYG/Viator 스타일):**
> Jeju South-West Highlights & Aewol Sunset — Private Van, Driver & Live Smart-Guide App

**Short description:**
> See Jeju's dramatic south-west coast — O'sulloc green tea fields, Sanbangsan, Songaksan cliff walk, Hyeopjae's turquoise water — and end with sunset at Aewol. Travel in a private van with a professional local driver, guided stop-by-stop by our Smart Guide app: live-translated chat with your driver in YOUR language, auto-arriving spot guides, restaurant & restroom pins, and a 24/7 human concierge behind the screen.

**Highlights (불릿 5):**
- Private van + professional driver — no strangers, your own pace
- Smart Guide app: chat with your driver in any language, translated live
- Rich spot guides arrive on your phone the moment you arrive
- Curated lunch & café picks with ratings, on a map
- Licensed tour operator (Korea reg. 277-01-03977) with live ops support

**What's included / not included:**
- ✅ Private van + fuel + driver, Smart Guide app access, live ops support
- ❌ Meals, entrance fees (O'sulloc free grounds / Camellia Hill ₩10,000 등 명기), gratuities
- ❌ **Optional add-ons and time extensions arranged during the tour — these are paid in cash to your guide on the day.** ← **L1 필수 줄. 빼지 말 것.**

> 🔴 **왜 이 줄이 필수인가 (L1).** 앱이 투어 중에 **실제 현금 청구를 만든다** — `/extend`(시간당 연장)와
> `/extras`(가이드가 기록하고 손님이 앱에서 확인한 뒤 현금 수취). 그런데 2026-07-28까지
> **어떤 리스팅에도 그 말이 없었다.** 그리고 예방 차원이 아니다: `/extend`는 전세 상품
> (`price_type='vehicle'`)에서만 열리는데, 그 상품군의 라이브 예약은 **GYG 3 · Klook 2 · Viator 1 ·
> test 1 · 자사 직판 0** — 그 기능을 쓸 수 있는 사람 **전원이 OTA 손님**이었다.
> 선택적 현장 결제 자체는 대체로 허용되지만 **고지 없이 발생하면 심사에서 질문이 나온다.**
> 자사 상품 페이지에서는 이 문장이 코드로 자동 삽입된다(`lib/tour-product/cashExtrasNotice.ts`) —
> OTA 리스팅은 사람이 붙여넣으므로 **여기 템플릿이 정본**이다.

**Important information (표기 리스크 방어 — 반드시 포함):**
> Your driver ensures safe, comfortable travel and speaks Korean (basic English greetings). All sightseeing guidance is delivered through the Smart Guide app in your language, monitored live by our licensed multilingual operations team. This is not a walking-guide tour — it's better for travelers who want freedom at each stop without a guide hovering.

## 3. 가격 (초안 — 사장 확정)

| 구성 | 런치 가격 | 정상 가격 |
|---|---|---|
| 프라이빗 밴 1–4인 | $259/차 | $319/차 |
| 프라이빗 밴 5–7인 | $299/차 | $369/차 |
| (옵션) 스몰그룹 조인 좌석 | $59/인 (min 4) | $69/인 |

- 런치 구간: 첫 4–6주 or 리뷰 10개 도달 시까지
- OTA 수수료 20–25% 감안한 순액 검증 필요 (기사 일비 + 유류 + 마진)

## 4. 출시 체크리스트

- [ ] 사장: 스팟 확정 (위 표에서 가감)
- [ ] Claude: 확정 스팟 curated 콘텐츠 6로케일 생성 + 시설핀 수집(Kakao 쿼터 리셋 후)
- [ ] 사장: 신규 스팟 시설핀 검수 (~30분)
- [ ] Claude: 사진 세트 구성안 (기존 D:\Atoc Photos 자산 매핑)
- [ ] 사장: GYG → Viator → Klook 순 업로드 (GYG가 신규 리스팅 부스트 체감 가장 큼)
- [ ] 공통: 자사 사이트 tour-product 페이지 동시 오픈 (OTA보다 $ 약간 낮게 — 소매 패리티 조항 없음 확인됨, 자사쿠폰 OK)
