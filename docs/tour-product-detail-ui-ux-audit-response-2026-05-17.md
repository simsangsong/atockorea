# 투어 상세 페이지 UI/UX Audit — Codex 리뷰에 대한 응답 및 통합 실행 플랜

작성일: 2026-05-17
원문: `docs/tour-product-detail-ui-ux-audit.md` (Claude 1차 마스터 플랜)
리뷰: `docs/tour-product-detail-ui-ux-audit-review-2026-05-17.md` (Codex 의견)
대상 페이지: `app/tour-product/[slug]/page.tsx`

---

## §A 상태 대시보드

| Sprint | 상태 | 시작일 | 완료일 | 마지막 커밋 |
|---|---|---|---|---|
| Sprint 1 (컨버전 안전) | ✅ (코드 6/6 + 사용자 묵시 컨펌) | 2026-05-18 | 2026-05-18 | be22e631 |
| Sprint 2 (토큰 + 색상) | ✅ (11/11 + acceptance 통과) | 2026-05-18 | 2026-05-18 | df4bf84e |
| Sprint 3 (콘텐츠 접근성) | ✅ (9/9 + §B-P2 partial reversal Fit/Support) | 2026-05-18 | 2026-05-18 | c2e72479 |
| Sprint 4 (Hero / Gallery) | ✅ (12/12 + 자동 검증 통과, 사용자 시각 검증 대기) | 2026-05-18 | 2026-05-18 | e37dd081 |
| **Sprint 5 (정보 과밀 reversal + Apple/Airbnb 럭셔리 미니멀 — §B-P4/P5/P6 가드)** | 🔄 (5.1-5.7 ✅ + §B-P7/P8/P9/P10 follow-ups / 5.5b ✅ busan-cruise 6 locale + refund/민감사항 가드 / 다른 tour 확장 대기 / 5.8 conditional / **5.9 ✅ pilot + 확장 #1-5 모두 ✅ — 모든 reveal pattern에 book-cascade 적용 완료** (Booking Support / Included / Reviews / Fit 3 reveals / Pickup per-row / Practical FAQ per-item)) | 2026-05-18 | — | (다음 커밋) |
| Sprint 6+ (장기 polish) | 📦 | — | — | — |

## §B 결정 로그 (binding)

| 날짜 | 결정 | 이유 |
|---|---|---|
| 2026-05-17 | §1.1 — Phase 1 묶음 분리 (Codex 채택) | 컨버전/회귀 측정 단위 ↓, QA 회귀 70 → 10 미만 |
| 2026-05-17 | §1.2 — Hero 60vh 금지, max 360 → 420 데스크탑만 | 상세는 booking info first-fold 필수 |
| 2026-05-17 | §1.3 — Radius role-based 4-tier (chip 8 / control 10-12 / card 12-16 / booking 18-20 / modal 20) | 기계적 3단계 → 역할별 강제 |
| 2026-05-17 | §1.4 — Trust strip 위치 유지, 단색화 + 반복 5→2회 | 첫 fold ≠ booking card인 사용자에게 reassurance 신호 |
| 2026-05-17 | §1.5 — 토큰 정의는 해당 PR 안에서 즉시 사용 | "토큰 후 적용" 분리 = dead token |
| 2026-05-17 | §1.7 — Watermark 정책 단계: lightbox 우선, hero/gallery 정책 확인 후 | 저작권 검토 의존 |
| 2026-05-17 | §2.1 — 색상 17 → 5 (brand/accent/success/danger/neutral) 강제 | "premium = 색의 의미 1:1 매핑" 양보 X |
| 2026-05-17 | §2.2 — Type scale 정의 + ESLint enforcement + PR template gate | 토큰만 정의해도 dead, 강제 필요 |
| 2026-05-17 | §2.3 — Accordion 8 → 2 (FAQ + Practical만) | Included/Fit/Support/Pickup accordion 폐기, first-fold 정보량 +60% |
| 2026-05-17 | §2.4 — CTA + total price 통합 (Airbnb 패턴) | 가격 인지 분산 (3군데 등장) 제거 |
| 2026-05-17 | §2.5 — At-A-Glance text pill (Easy/Moderate/Vigorous) | 6색 무지개 폐기, 텍스트 명확성 |
| 2026-05-17 | §6.1 — 토큰 enforcement: ESLint warn + PR template + single source of truth | dead token 방지 가드 |
| 2026-05-17 | §6.3 — 다국어 5종 LCP 회귀 가드 (CTA/Hero overlay PR) | 일/한자 폭 vs 영문 mismatch |
| 2026-05-17 | §6.8 — Scroll freeze 가드: 새 motion 추가 금지, backdrop blur stack 금지, IntersectionObserver layout read 금지 | 사용자 보고 freeze 재발 방지 |
| 2026-05-18 | **§B-P1 — Premium feel은 항상 위로만, 절대 downgrade 금지** | User 직접 지시 2026-05-18. **모든 권고/실행은 "more premium" 방향이어야 함. 절제(restraint)는 premium의 표현이지 cheap의 표현이 아님 — 단순화·통일·flat 변경도 Apple/Airbnb/Hermès 같은 글로벌 premium 수준에서 합리화 가능해야 적용. "단순해졌다 = 가난해졌다"로 읽히면 거부.** 회색 단색 권고가 premium-cheaper 회색이 아닌 premium-disciplined slate-900인지 매 변경마다 자체 검증. 색을 빼는 변경은 그 자리에 *더 정확한 시각 가중치* (typography hierarchy / spacing / photo size / shadow tier)가 들어가야 함. |
| 2026-05-18 | **§B-P2 — 정보 과밀 회피 (1차 정보만 default 펼침, 2차는 점진 노출)** | User 직접 지시 2026-05-18 ("정보 과잉이라서 어떤 부분은 접어 놓은 상태였다 - 일괄로 펼치면 고객 입장에서는 읽고싶은 마음이 뚝 떨어진다"). **§B accordion 8→2 binding의 "fewer clicks = premium" 해석은 1차 정보에만 적용. 2차/3차 정보 (Less Ideal · Route Logic · Support step detail · 긴 nested 설명)는 default 접힘 OR "Show more" link로 복귀.** §B-P1과 모순 없음 — "fewer clicks"는 "read more 1 click"을 의미하지 "항상 펼쳐서 정보 과부하"를 의미하지 않음. Klook/Airbnb도 detail은 default closed (사용자 선택). 모든 "accordion 폐기 → 항상 펼침" 권고는 1차 정보 기준에서 우선순위 분류: 1차 (always visible) vs 2차 (default closed + on-demand reveal). **이 결정은 Sprint 3 partial reversal (Fit Less Ideal + Fit Route Logic 접힘 복귀) + Sprint 4-5 가드로 적용.** |
| 2026-05-18 | **§B-P3 — 색 단순화 OK, 그러나 premium layout (elevation / shadow tier / spacing / material hierarchy) 절대 손상 금지** | User 직접 지시 2026-05-18 ("색상 단일화, 미니멀리즘 등은 좋은데 절대 프리미엄 디자인 느낌을 버리고 flat만 추구하는 오류를 범하지 말 것. 고급스러운 레이아웃은 그대로 유지"). **flat-only는 cheap-flat이지 premium-restraint이 아님.** Apple/Hermès/Airbnb premium = *정밀한 단일 elevation + 절제된 shadow tier + generous spacing + photo prominence + typography hierarchy*. 색 빼는 변경은 OK, 단 그 자리에 *반드시* layout weight (single shadow tier / ring discipline / spacing) 들어가야 함. shadow 전체 제거 = cheap. "shadow-hero 제거" 같은 일괄 폐기 권고는 §B-P3로 차단 — single soft elevation tier로 복귀. radius role-based scale (§1.3 binding) + shadow tier는 단일/이중까지 유지. 이 결정은 Sprint 4 partial reversal (Hero shadow + pill elevation 복귀) + 모든 향후 변경 가드. |
| 2026-05-18 | **§B-P4 — 1차 visible scope 재정의 (Sprint 3 over-expansion 회복, 정보 과밀 절대 금지)** | User 직접 지시 2026-05-18 ("아코디언을 다 펼쳐버리니까 페이지가 너무 복잡해졌어, 그냥 텍스트 덩어리가 돼 버렸어… 정보 과부하 절대 금지"). **§B accordion 8→2 binding과 §B-P2 "1차만 default 펼침" binding이 일부 over-expand 됐다 — Sprint 3에서 Included 5+excluded all visible, Pickup notes inline, Booking Support 6-step default open이 cumulative cognitive load → "텍스트 덩어리" 인식 발생.** 1차/2차/3차 scope을 다음과 같이 *엄격하게* 재정의: **1차 (always visible, 100% 사용자가 봐야 함)** = Hero · Trust strip · Tabs · At-A-Glance · Day Flow · Timeline stop cards 사진+이름+1줄 meta · Pickup HEADER+첫 1줄 미리보기 · Included CORE (첫 3개) + Excluded inline prose 1줄 · Practical Weather strip · Booking Support **Trust 3-grid only** · FAQ headers · Reviews summary · Recommendations. **2차 (default closed, on-demand reveal)** = Pickup notes (per-row chevron) · Included full list (Show all) · Excluded grid (Show all 안에 포함) · **Booking Support 6-step timeline (default closed, "View 6-step support →" link)** · Fit Less Ideal (이미) · Fit Route Logic (이미) · Practical accordion content (이미) · FAQ answers (이미) · Reviews 4+ (이미). §B-P2와 모순 없음 — 정보 과밀 회피 방향성 강화. "fewer clicks = premium" 해석은 **default visible**에만 적용; reveal은 **1 click + 즉시 펼쳐짐 + 미리보기 텍스트 동반**이면 premium. Klook/Airbnb 표준. **이 결정은 Sprint 5 (정보 과밀 reversal) 작업 가드로 적용.** |
| 2026-05-18 | **§B-P5 — 2차 정보 reveal은 premium 질감 유지 필수 (flat-cheap toggle 금지)** | User 직접 지시 2026-05-18 ("프리미엄 질감 절대 다운그레이드 금지"). **§B-P4의 "2차 default closed"는 단순 accordion으로 회귀하라는 게 아님.** 2차 reveal은 다음 4 조건 모두 만족해야 §B-P5 통과: (1) **미리보기 1줄 항상 노출** — 닫혀도 정보 단절 없음 ("Confirmation → Reminder → Pickup → Tour → Follow-up" 식 1줄 prose, 또는 count + summary). (2) **Reveal trigger는 underlined link** (Klook 표준 `text-[var(--primary)] underline decoration-[1.5px] underline-offset-[3px]`) — 큰 chevron button + bg-slate-100 wash 같은 flat-cheap UI 금지. (3) **Single shadow tier 유지** — 닫힌 상태 카드도 premium card feel (§B-P3 binding 유지). (4) **펼침 transition smooth** — Sprint 1.1 0.30s easing 표준 적용, jarring jump 금지. Klook/Airbnb 표준 = "닫힌 상태도 정보 있고 예쁘다, 열면 더 많은 정보". 닫힌 상태가 빈 button-only 컴포넌트가 되는 순간 cheap. **이 결정은 Sprint 5 모든 sub-task에 적용 + 모든 향후 reveal pattern 가드.** |
| 2026-05-18 | **§B-P6 — Apple/Airbnb level 미니멀 + 프리미엄/럭셔리 양립 (flat-cheap 절대 금지, editorial richness 필수)** | User 직접 지시 2026-05-18 ("너무 flat하고 밋밋한 페이지 만들지 말고, 무조건 Apple, Airbnb level의 미니멀을 추구하면서도 프리미엄, 럭셔리 디자인은 포기하지 않는 방향으로"). **§B-P1/P2/P3/P4/P5는 "안전판"이었으나 cumulative하게 적용하면 flat-cheap로 귀결될 위험이 있음.** Apple 제품 페이지 / Airbnb 호텔 페이지의 본질: *항목 수 절제 + 항목 하나하나의 editorial richness*. 미니멀 ≠ flat. **모든 visible element (특히 닫힌 카드 / 미리보기 / reveal trigger)는 다음 6 조건 만족해야 §B-P6 통과**: (1) **Typography 3+ layer hierarchy** — eyebrow (text-eyebrow muted) + title (text-base or text-[15px] font-semibold) + meta (text-[12.5px] muted) + (optional) accent badge. 단일 muted 12px line 금지. (2) **Generous spacing** — 카드 padding ≥ 16px (모바일) / 20-24px (sm+); inner gap ≥ 10px. cramped/dense 금지. (3) **Material depth** — `bg-white + ring-slate-200/70 + shadow-card (single soft tier) + inner top highlight (top 1/3 white/65 gradient)` 표준 — Sprint 2.9 SEASON_THEME_SHARED 패턴 = 정답. ring-only or shadow-only 카드 금지. (4) **Photo/icon prominence** — 가능한 경우 카드 안에 작은 thumbnail (Apple Photos chip, 36-48px) 또는 phase icon row (compass/stars/etc 미세 18px ring-1). 카드 전체 텍스트만 = cheap. (5) **Micro-hover lift** — `-translate-y-[1px] + shadow-elevated transition-[transform,box-shadow] duration-300 ease-out` 표준. hover 없는 카드는 미니멀이 아니라 dead UI. (6) **Editorial copy** — UI string은 parallel structure + 1 highlighted phrase + count badge 형태. "3 items · pickup, drop-off, what to bring" 같은 utility-list 금지 → "Pickup zones · drop-off bands · what to pack" (parallel + premium copy). Apple/Airbnb는 모든 copy가 *작은 카피라이팅*. **이 결정은 Sprint 5 모든 sub-task에 §B-P6 spec 추가 + 5.7 (Card material 통일) + 5.8 (Section heading luxury 검토) 신규 sub-task로 적용. §B-P4의 "정보 줄이기"와 §B-P6의 "남은 정보 editorial richness"는 한 짝.** |
| 2026-05-18 | **§B-P7 — Practical Weather + Seasonal cards는 마스터플랜 시작 전 (pre-Sprint 2.8/2.9 + §B-P3 follow-up) baseline 카드 스타일 유지 (per-season 4색 gradient + weather 4-layer gradient)** | User 직접 지시 2026-05-18 (스크린샷 동반 "이 두 섹션 카드 스타일은 마스터 플랜 시작전 카드 스타일로 회귀 시켜"). **Sprint 2.8 (weather 4-layer → bg-white flat) + Sprint 2.9 (seasonal 4색 → SEASON_THEME_SHARED neutral) + §B-P3 follow-up (shadow tier 추가) 모두 partial reversal.** Weather strip은 amber-tinted 4-layer outer gradient + per-day (sky/amber) sub-card gradient + inner highlight 4중 layer 복원 (commit 111ef096 baseline). Seasonal cards는 spring(rose) / summer(amber) / autumn(orange) / winter(sky) 4색 per-season gradient theme 복원. **§2.1 색상 17→5 binding 부분 양보** — Weather + Seasonal 2 영역만 예외, "감성 + 첫인상 카드" 성격으로 색 다양성이 premium feel을 강화한다는 사용자 판단. 나머지 카드 (Hero / Trust strip / Pickup / Included / Fit / Booking Support / Reviews)는 §2.1 5색 유지. §B-P3 (premium layout > flat-cheap)와 동일 정신 — "단순화가 cheap로 보이면 거부". **이 결정은 Sprint 2.8 + 2.9 + §B-P3 follow-up Seasonal 일부 reversal로 적용 + 향후 weather/seasonal 카드는 baseline 보존 가드.** |
| 2026-05-18 | **§B-P8 — 노랑/빨강/파랑 강한 색 카드 금지 + 실험 카드는 subtle premium pastel (mint/rose) + modern metal + sci-fi 科技感 — 섹션 한 곳에만 적용** | User 직접 지시 2026-05-18 ("fit 섹션 amber색 적용 롤백해, 노랑 빨강, 파랑 이런 색은 싫어" + "rose 같은 크게 티는 안 나지만 고급감을 끌어 올릴수 있는 색상, 예를 들어 연한 민트, 연한 로즈 등등에 모던 메탈 디지털 科技感들어간 카드 스타일 섹션 하나만 골라서 적용해봐"). **§B-P7 정신 확장 시도 중 amber(Fit Best For) + orange(Fit Route Logic) + sky(Reviews summary) 적용한 것 전면 reversal — 너무 강한 색은 cheap-saturated 느낌, 사용자가 거부.** **허용 색**: rose (AtAGlance 검증됨), mint/emerald-50/teal (Booking Support Trust 적용), 향후 추가는 user explicit confirm 후. **금지 색**: amber/yellow, orange/red, sky/blue — too vivid. **실험 카드 spec**: (1) pastel gradient base (X-50 via white to X-100/40), (2) ring X-100/55, (3) 4-layer 메탈 sheen (inner top white/80 + diagonal white/40→X-200/10 + bottom X-200/14 + hairline white/85 edge), (4) **sci-fi 科技感 element 필수** — corner cyan halo blur (bg-cyan-200/22 blur-2xl) OR diagonal precision blade hairline (h-px via-X-300/30 inset). (5) shadow에 X-tinted tier 추가. **섹션 한 곳에만 적용 (현재 = Booking Support Trust 3-grid).** 추가 적용은 사용자 명시 후. AtAGlance rose는 baseline = 유지. |
| 2026-05-19 | **§B-P9 — Preview-field editorial rewrite는 memory rule "additive-only" 범위 외 (단 content[] 배열은 절대 변경 금지)** | User context 노트로 "Sprint 5.5 editorial 강화" redirective intent 명시 (2026-05-19). 기존 memory rule "Bulk content edits must be additive-only" (2026-05-14)와의 충돌 해석: 룰의 보호 대상은 **hand-authored content (description / itinerary / content[] 등 사용자가 1차로 작성한 multilingual tour copy)**. **`practicalAccordionItems[i].preview` 필드는 auto-derived first-line truncation** (코드 reality 확인: 8 preview 모두 content[0] 의 truncation/exact match 형태)로 §B-P6 6 spec의 utility-list 안티패턴에 정확히 해당 — 즉 룰의 진정한 보호 대상이 아닌 UI-helper 필드. **결정:** preview 필드만 editorial parallel 재편 허용 (content[] 배열은 자료 그대로 유지). 적용 범위: Sprint 5.5b 작업으로 한정. 검증 방식: round-trip — 변경 후 content[] 배열은 byte-for-byte 동일성 보장. 추후 다른 필드로 확장 시 §B 신규 row 필수. |
| 2026-05-19 | **§B-P10 — Preview editorial 작업 시 refund / cancellation / weather-emergency 등 민감 비즈니스 룰은 임의 변경 금지 (원본 카피 또는 일반론 유지)** | User 직접 지시 2026-05-19 ("refund나 민감사항에 관한 내용은 함부로 바꾸지마 크루즈는 태풍이 와서 접안을 못하면 환불 되지만 일반 버스투어 스몰그룹투어는 손님이 원함녀 태풍이 와도 나가야돼, 고객이 싫어서 안 나가는건 환불 안 되고, 그리고 이런건 명시 안 해도 돼"). **§B-P9의 preview editorial 허용을 부분 제약**: tour type별 정책 차이가 큰 영역은 preview에서 **명시 회피**. (1) **금지**: 환불 비율 명시 ("50% inside 24h"), tour-specific edge case 환불 처리 ("port-skip refunds in full"), 태풍/기상 emergency 결정 명시 ("typhoon-level closure refunded"). (2) **허용**: 표준 OTA 1-line cancellation cutoff ("Free cancellation up to 24 hours before pickup."), 기상 자체 표현 ("year-round runs · weather-flexed routing day-of"), 가이드 운영 조정 표현. (3) **이유**: cruise는 태풍 → 접안 불가 → 환불 OK, 그러나 일반 버스/스몰그룹 투어는 손님 의지 기준 (싫어서 안 나가면 환불 X). preview에서 환불 정책을 강하게 명시하면 tour type 간 일관성/오해 위험. **이 결정은 모든 향후 preview editorial 작업 가드 — busan-cruise + 다른 tour 확장 시 적용. content[]는 tour-specific 정책 상세 유지 OK.** |
| 2026-05-19 | **§B-P11 — Book-page cascade reveal (§B-P5 (4) "smooth 0.30s" 확장; reveal 인터랙션을 "촤르륵 펼쳐지는 책 페이지" 메타포로 격상)** | User 직접 지시 2026-05-19 ("아코디언을 책처럼 접어두는거 + 카드들이 접혀있는거처럼 있다가 누르면 카드가 천천히 부드럽게 촤르륵 펼쳐지는 스타일을 최대한 고급스럽게"). Sprint 5 목표 line 442의 "닫혀도 작은 책 한 페이지처럼" 메타포를 **시각 정적 차원에서 모션 차원으로 확장**. §B-P5 (4)의 "grid-rows-[0fr→1fr] easing 0.30s smooth"는 *컨테이너 opening*에만 적용 (유지) — 그 안의 *children stagger reveal*에 신규 spec 7조건 부여. **모든 reveal pattern에 적용 (Booking Support 6-step, Included Show all, Fit Show all, Reviews Show all, Pickup per-row notes, Practical FAQ accordion 등) — Sprint 5.9가 reference 케이스, 향후 모든 신규 reveal에 §B-P11 가드 통과 필수.**

**§B-P11 7조건 (모두 만족해야 통과)**:

(1) **Easing curve = `cubic-bezier(0.22, 1, 0.36, 1)`** (ease-out-quint, Apple HIG decoration 표준). 초기 강한 release 후 미세한 settle — "종이 펴짐" 물리감. 대안 금지: `ease-in-out` (가운데가 빠름, 종이 아님), `cubic-bezier(0.4, 0, 0.2, 1)` (Material default, 너무 mechanical), spring/bounce (overshoot — Pinterest 2015 cliché).

(2) **Container opening = 360ms** (§6.4 "deliberate" tempo 그대로). grid-rows-[0fr→1fr] + overflow-hidden + opacity 0→1. children stagger는 이 360ms와 *겹쳐서* 시작 (container 50% open 시점에 첫 child 등장 = ~180ms 지연 후 stagger 시작) — children이 닫힌 컨테이너 안에서 등장해서 자연스럽게 펼쳐지는 느낌.

(3) **Per-child reveal = 480ms** + **stagger interval** = catalog 크기별 가이드:
- N ≤ 3: stagger 0ms (모두 동시, "촤르륵" 인식 안 됨)
- N 4-6: **stagger 60ms** (sweet spot, 6개 = 5×60 = 300ms 누적 + 480ms 마지막 = ~780ms 총)
- N 7-10: **stagger 40ms** (10개 = 9×40 = 360ms 누적 + 480ms = ~840ms 총)
- N > 10: **stagger 28ms with auto-cap** (누적 stagger ≤ 300ms 강제, 즉 11번째부터는 simultaneous)

(4) **Per-child initial state** = `opacity: 0; transform: translateY(-4px) rotateX(-6deg); transform-origin: top center;` → final `opacity: 1; transform: translateY(0) rotateX(0);`. 부모 컨테이너에 `perspective: 1400px` 부여 (멀리 떨어진 책 페이지 시점). **rotateX 범위 -8deg ~ -4deg만 허용** — > -10deg는 카드 flip 느낌 cheap, < -3deg는 인식 불가. translateY는 -6px ~ -3px만. **skew/scale/rotateZ 금지** (각각 print poster cliché / Medium 2015 / 꽃잎 cliché).

(5) **Total reveal cap = 900ms 절대 상한, 모든 catalog 크기에서 750ms 이내가 목표.** Stagger × N + per-child duration ≤ 900ms 강제. 초과 시 stagger interval 자동 축소 (3번 가이드의 "auto-cap"). 사용자가 "느리다"고 느끼는 임계점은 ~700ms — 그 안에서 "촤르륵 + premium"을 모두 챙기는 게 §B-P11 핵심.

(6) **Material/shadow 무변화 (§B-P3 강제 유지)**. children이 받는 shadow tier는 *최종 상태에서만* 적용 (opacity와 함께 fade in). 이행 중 (mid-transition) shadow 펄스/추가 tier 금지. 컨테이너 자체 shadow는 reveal 전·중·후 동일 single tier. children의 hover lift (-translate-y-[1px])는 reveal 완료 *후*에만 활성화 (transition delay로 강제). **결과: 정적 캡처 = §B-P5/P6 그대로, 모션 캡처 = 종이 펴짐 1회.**

(7) **`prefers-reduced-motion: reduce` 필수 fallback** (a11y MUST, JS 없이 CSS로 강제). reduce 시: container opening = opacity 0→1 fade 150ms only (no grid-rows transition), children = stagger 0ms + transform 무 (opacity 0→1 only, duration 180ms simultaneous). rotateX/translateY/perspective 모두 제거. CSS `@media (prefers-reduced-motion: reduce)` 안에 명시 — JS 분기 X, props 분기 X (단일 컴포넌트 동일 markup으로 OS 설정 자동 반영).

**구현 메커니즘 가드 (§6.8 scroll-freeze 보존)**: (a) CSS-only (`data-state="open|closed"` attribute 토글 + scope CSS `[data-state="open"] > *:nth-child(N) { animation-delay: calc(var(--stagger) * (N-1)); }`). (b) framer-motion `<AnimatePresence>` 사용 금지 (§6.8). (c) IntersectionObserver per-child stagger 금지 (§6.8 layout read 가드). (d) 신규 라이브러리 X. (e) `transform` + `opacity`만 사용 (composite property, GPU paint, scroll-thread 안 건드림). (f) `will-change` 적용은 reveal 시작 trigger에만 (애니메이션 끝나면 즉시 제거 — 영구 `will-change` 적용 시 메모리 누수).

**Anti-pattern (§B-P11 refuse)**:
- ❌ 꽃잎/petal-falling cascade (rotateZ + lateral drift) — Bootstrap template cliché
- ❌ 오리가미/origami fold-out (multi-axis 3D unfold) — 너무 theatrical, 컨텐츠 가독성 방해
- ❌ Bouncy spring overshoot (scale 1.05 then settle) — Pinterest/Medium 2015 cliché
- ❌ rotateX > 10deg — card-flip 느낌 cheap
- ❌ Per-child shadow tier 변화 (§B-P3 위반)
- ❌ Stagger > 80ms per child — 총 시간 900ms 초과 → 느림
- ❌ reduced-motion fallback 누락 — a11y 자동 fail
- ❌ Scroll-linked stagger (각 child IntersectionObserver) — §6.8 위반
- ❌ Sequential text-fade per character — 타자기 cliché
- ❌ Backdrop blur during transit — §6.8 stack 위반
- ❌ framer-motion / 신규 라이브러리 도입 — §6.8 위반
- ❌ "Apple HIG보다 더 화려하게" 권고 — §B-P6 미니멀 럭셔리 정신 위반 (Apple/Airbnb 자체가 ceiling, 그 위는 cheap-theatrical)

**§6.4 4-step tempo 관계**: §B-P11은 §6.4 "deliberate (360ms)" tier의 *reveal 전용 sub-spec*. §D parked "Animation tempo 4-step scale 통일"은 페이지 전체 transition 통일 작업 (Sprint 6+) — §B-P11과 *별개* (5.9가 4-step scale을 정의하는 것 아님, 그 안의 1개 layer만 정의). |

## §C 변경 로그

| 날짜 | 작업 | 커밋 | 비고 |
|---|---|---|---|
| 2026-05-17 | 마스터 플랜 v1 작성 (1차 Claude audit + Codex review 통합) | 초기 | 16개 결정, Sprint 1-4 정의 |
| 2026-05-18 | §A 상태 대시보드 + §B 결정 로그 + §C 변경 로그 + §D parked + §8 세계최고 디자이너 audit 추가 | (이 커밋) | User 요청으로 픽셀단위 review 진행. 16 section + Drawer 분석. §B-P1 premium up-only 결정 신규. Sprint 1-4 작업 시작 전 단계. |
| 2026-05-18 | Sprint 1 started — 컨버전 안전 PR group 진입 (drawer 속도 / CTA bg+price / 중복 제거 / drag handle) | (이 커밋) | §A Sprint 1 → 🔄. §1.8 사실 수정 1건 동반 (sticky bar / desktop booking card 파일 경로 + drawer animation 라인 2곳). |
| 2026-05-18 | Sprint 1.1 — drawer animation 단축 (backdrop 0.55→0.24s, panel 0.78→0.30s) | a71fad35 | drawerEase 유지. L407 calendar reveal (delay 0.48s + duration 0.85s) 부정합 잔존 — Sprint 1 후속 candidate (drawer 본체 0.30s에 끝나는데 calendar는 1.33s에 표시됨). |
| 2026-05-18 | Sprint 1.2 — CTA bg-foreground → bg-primary (sticky + desktop) | e10e4942 | text-white → text-primary-foreground 동반 정렬. Pill/segment toggle (L361/L439) 별개 → 유지. §B binding "CTA = bg-primary #2e5c8a" 적용. |
| 2026-05-18 | Sprint 1.3 — CTA label에 total price 통합 (Airbnb pattern) | 603be210 | Desktop/in-drawer = "Reserve · {total\|unit}"; pre-drawer = "Check Availability · {From} {unit}". 기존 i18n 키 (reserve, checkAvailability, stickyPriceFrom) 재활용. 5-locale 폭 QA는 acceptance step. |
| 2026-05-18 | Sprint 1.4 — desktop pricing-tier 본문 중복 제거 (lg:hidden) | fefd9cce | Desktop에서만 본문 matrix hide (booking card에 동일 데이터 있음). 모바일은 유지 (drawer 닫힌 상태에서도 group size 비교 가능, §B-P1 정보 손실 방지 가드). |
| 2026-05-18 | Sprint 1.5 — drawer 안 reassurance row 제거 (5 instance → 2 위치) | db2a0b73 | sticky bar drawer 안 freeCancellation+payLater 줄 제거. Trust strip + desktop card 유지. ShieldCheck/Wallet unused imports 정리. 모바일 reassurance 부족하면 sticky bar 좌측 가격 라벨에 1줄 후속 추가 후보. |
| 2026-05-18 | Sprint 1.6 — drawer drag handle + swipe-down dismiss | be22e631 | useDragControls 패턴 (handle만 drag-trigger, 내부 스크롤과 충돌 안 함). dragConstraints {top:0, bottom:0}, dragElastic bottom 0.6, dismiss threshold offset>80 또는 velocity>500. §6.8 scroll-freeze 가드 통과 (pointer event = transform, layout trigger 없음). |
| 2026-05-18 | Sprint 1 acceptance — 자동 검증 통과 / 사용자 검증 대기 | — | ✅ Typecheck (npx tsc --noEmit) clean. ✅ Drawer 본체 ≤0.34s (0.30s 측정값, code-level 확정). ⏳ 사용자 확인 필요: (a) booking checkout flow 5종 QA (date / guest / duration / available / unavailable / 결제 진입), (b) 5-locale CTA 폭 (ko/en/ja/zh/es) — 특히 Spanish "Ver disponibilidad · Desde $X" 모바일 sticky bar 좌측 가격 라벨과 함께 폭 확인, (c) drag handle 모바일 swipe-down 작동 (PID 85744 dev server 사용 — preview MCP 시작 불가). 사용자 검증 통과 시 Sprint 1 ✅로 전환. |
| 2026-05-18 | Sprint 1 ✅ — 사용자 묵시 컨펌 ("다음스텝") | be22e631 | 6/6 코드 완료 + 자동 검증 통과. 다음스텝 지시로 Sprint 2 진입. 실제 booking flow 5종 / 5-locale / swipe-down 회귀 발견 시 §C에 reversal 한 줄 + revert. |
| 2026-05-18 | Sprint 2 started — 토큰 + 색상 다이어트 (12 sub-task 압축, 섹션별 점진 PR) | (이 커밋) | §A Sprint 2 → 🔄. §1.5 binding 준수 — 토큰 정의는 첫 적용 PR 안에 동봉 (dead token 방지). 시작 작업: scope CSS color tokens (5색) + type scale (6단계) 정의 + Hero star copper → amber 첫 적용 (가장 작은 영향). |
| 2026-05-18 | Sprint 2.0+2.1 — scope CSS color tokens + type scale + Hero star copper → amber (foundation) | 2f026652 | §2.1 5색 토큰 (success/danger/star-color 신규 + brand/accent 유지). §2.2 type scale 6단계 utility class (clamp() responsive). Hero star #C8956C → var(--star-color). §1.5 binding 통과 (토큰 + 첫 적용 동시). |
| 2026-05-18 | Sprint 2.3 — trust strip 3색 → success monochrome + 폰트 13px | c5af470f | ShieldCheck/Zap/Headphones 모두 var(--success). 폰트 11.5→13px (§1.4 binding "단색화 + 폰트 13-14px"). decoration overuse 누적 제거: copper 1 + amber 1. |
| 2026-05-18 | Sprint 2.4 — Hero rose 분산 → neutral + region eyebrow accent 1회 | 32f89419 | rose 5+곳 (region/pills/메타 strip) → var(--accent) 1곳 + slate-700/200 neutral. Heart는 Sprint 4 binding 보류 ("rose-500 → brand red"). Pills 3중 효과 색만 변경, 구조는 Sprint 4 "flat chip" binding. |
| 2026-05-18 | Sprint 2.5 — Pickup copper gradient + Dropoff dark strip → white cards | 2bf0ba22 | Pickup 5곳 copper (marker/row number gradient + 3 icon) + Dropoff dark slate-950 gradient → bg-foreground/bg-white + slate text. 두 카드 동일 형태 통일 (§8.7 geographic clarity). |
| 2026-05-18 | Sprint 2.6 — Included emerald/rose wash → white + semantic icon (§2.1 success/danger token) | ae5ba674 | 카드 wash 3종 (#f6fcf8/#f0faf4/#fff5f5) → bg-white. Included: emerald-500/600 + emerald-50/100 → var(--success) + var(--success-soft-bg). Excluded: rose-500/600 → var(--danger). |
| 2026-05-18 | Sprint 2.7 — Fit amber/copper wash → white + neutral container | d14a4789 | amber/copper 8 인스턴스 (#fdf8f2 bg + rgba(200,149,108) hover/ring/border/icon/note) → bg-white + slate-50/200. inline mouseenter handler 제거 (className hover 대체). 3중 nested accordion 폐기는 Sprint 3 별개. |
| 2026-05-18 | Sprint 2.8+2.9 — Practical weather 4-layer + Seasonal 4계절 4색 → neutral | 5507d91f | 4-layer gradient (3-stop bg + 4 shadow layers + sky/amber sub-card gradients) → bg-white + 1 elevation. SEASON_THEMES rose/amber/orange/sky → SEASON_THEME_SHARED (bg-white + var(--accent) icon). today/tomorrow icon class sky/amber → muted/var(--star-color). 차별화 = icon shape (Flower2/Sun/Leaf/Snowflake). |
| 2026-05-18 | Sprint 2.10 — Booking Support 5색 trust + 6색 steps → 1색 (Apple Card pattern) | f4980053 | TRUST_THEMES 5 variants (emerald/sky/amber/orange/rose grad) → TRUST_THEME_SHARED (bg-white + slate ring). pickStepTheme 6 variants (emerald/amber/indigo/orange/sky/rose) → STEP_NEUTRAL (slate-50 ring + foreground/80 icon). 차별화 = icon shape (TRUST_ICONS / MailCheck/BellRing/Moon/Sunrise/Compass/Sparkles). |
| 2026-05-18 | Sprint 2.11 — Reviews summary 3% ghost gradient → solid pale + star token | 78559314 | rgba(46,92,138,0.03→200,149,108,0.02) ghost → bg-slate-50/70 + ring-slate-200/80. amber-400/500 (stars + progress bar) → var(--star-color) token. 통합 헤더 / 카테고리 bar는 Sprint 3+ 별개. |
| 2026-05-18 | Sprint 2 acceptance — token화 residuals + ✅ closure | df4bf84e | matched-pax row amber-50/70 → var(--star-color)/[0.08]. unavailable badge rose-50/700 (Desktop + Sticky drawer) → var(--danger-soft-bg)/text. Recommendations star amber-400 + focus ring rose-300/60 → var(--star-color) + var(--ring)/40. ✅ typecheck clean. ✅ decoration usage in tour-detail-sections near-zero (남은 6 인스턴스는 모두 Sprint 3 binding At-A-Glance 6색 5개 + Sprint 4 binding Hero heart 1개). ✅ token count: 5 binding (brand/accent/success/danger/neutral) + 1 universal star = 6. Sprint 2 ✅. |
| 2026-05-18 | Sprint 3 started — 콘텐츠 접근성 (accordion 다이어트 + At-A-Glance text pill + Subnav + eyebrow 단일화) | (이 커밋) | §A Sprint 3 → 🔄. 9 sub-task. accordion 8 → 2 (FAQ + Practical) binding 실행. 시작 작업: At-A-Glance 6색 → text pill (Sprint 2 남은 last decoration). |
| 2026-05-18 | Sprint 3.1 — At-A-Glance 6색 무지개 dots → text pill | 161b751e | ROW_ACCENT_COLORS 배열 폐기. left cycling dot 폐기 (typography weight + spacing이 row 시작점). right 5-dot progress → text pill (bg-slate-50 + ring + font-bold tracking-wide). rounded-[26px] → rounded-2xl (role-based card scale). |
| 2026-05-18 | Sprint 3.8+3.9 — Subnav pill → underline 2px + 양쪽 fade + IO top-most | a1b30662 | filled pill → border-b-2 var(--primary). showLeftFade 신규 state + 좌측 gradient. IO: visible Map<id, top> 유지, top-most ID 선택 (oscillation 방지). |
| 2026-05-18 | Sprint 3.4 — Pickup row expand 폐기 → note 있는 행만 항상 표시 | 4924512e | expandedOrder state + ChevronDown 제거. row = div (no toggle). note 있는 point는 row 아래 inline (icon + note). accordion count 8→7. |
| 2026-05-18 | Sprint 3.3 — Included accordion 해제 → 5 always visible + Show all | 4e704fb7 | open state + ChevronDown 폐기. 카드 항상 펼침. includedItems 첫 5개 visible, overflow 시 brand color underlined link toggle. excluded 항상 노출. accordion count 7→6. |
| 2026-05-18 | Sprint 3.2 — Fit 3중 nested 해제 → 2-col flat + Route Logic 펼침 | 6fda4d78 | open / showLessIdeal / showLogic 3 state + 3 ChevronDown 폐기. Best For + Less Ideal 2-col grid (sm:grid-cols-2) + eyebrow per column. Route Logic 별개 card 항상 펼침. accordion count 6→3. |
| 2026-05-18 | Sprint 3.5 — Support default-open accordion 폐기 → 항상 펼친 timeline | addff9d8 | showTimeline state + button + ChevronDown 폐기. card header (h3 + subtitle) + border-t로 분리된 timeline 영역. Mobile vertical + Desktop horizontal 유지. accordion count 3→2 (FAQ + Practical만 남음 ✅ binding). |
| 2026-05-18 | Sprint 3.6+3.7 — section heading + eyebrow token 통일 (12 sections) | 51d586ac | 12 section heading variants → text-title (단일). subtitle 변이 → mt-1.5 text-sm muted leading-relaxed. eyebrow 10 인스턴스 (6 spec variants) → .text-eyebrow utility + color class 분리. Sprint 3 acceptance: ✅ typecheck clean / ✅ accordion count = 2 / ✅ eyebrow class count = 1. |
| 2026-05-18 | Sprint 3 ✅ (first attempt) — 9/9 + acceptance 통과 | 29e42cde | accordion 8→2 binding 달성. 단 §B-P2 reversal 동반 (다음 row). |
| 2026-05-18 | §B-P2 신규 + Sprint 3.2 partial reversal (Fit Less Ideal + Route Logic 접힘 복귀) | a549c540 | User 직접 지시 ("정보 과잉이라서 어떤 부분은 접어 놓은 상태였다 - 일괄로 펼치면 고객 입장에서는 읽고싶은 마음이 뚝 떨어진다"). §B-P2 binding: "1차 정보만 default 펼침, 2차/3차는 점진 노출". Less Ideal (negative) default closed nested + Route Logic (deep dive) default closed accordion 복귀. Best For는 1차로 default visible 유지. |
| 2026-05-18 | Sprint 3.5 partial reversal — Support timeline default-open accordion 복귀 (§B-P2) | c2e72479 | 1차 신뢰 신호 default visible 유지하되 사용자 toggle escape 제공 (showTimeline default true). useState/ChevronDown import 복귀. Klook/Airbnb 표준 — default open + 사용자 선택형 토글. |
| 2026-05-18 | Sprint 4 started — Hero / Gallery 안전 개선 (§B-P2 가드 적용, 정보 과밀 회피) | (이 커밋) | §A Sprint 4 → 🔄. 12 sub-task. Hero overlay (title+price)는 §D parked 유지 — 정보 과밀 위험. 시각 단순화 (autoplay OFF, pill 3중→flat, gutter white, gradient 약화) + 사진 크기 향상 (day-flow 80px, max-h 420) 위주. 한 번에 X — 작은 묶음 별 별도 PR + scroll-freeze 가드. |
| 2026-05-18 | Sprint 4.1+4.2+4.3+4.5 — Hero autoplay OFF + edge-to-edge + max-h 420 + heart token | 80d427b6 | 4 묶음: 6.5s setInterval autoplay 폐기 (reduce-motion 친화, scroll-freeze 안전), sm:max-h-[360px] + lg:max-h-[420px] (desktop only), rounded-b-2xl + shadow-hero 제거 (edge-to-edge), fill-rose-500 → fill-[var(--danger)] (Sprint 2 acceptance 마지막 decoration 해소). |
| 2026-05-18 | Sprint 4.4 — Hero pill 3중 효과 → flat chip | 1bbb42dc | gradient + ring + shadow + backdrop-blur 3중 → bg-white + ring-slate-200 + hover ring-300 1중. typography (font-semibold) + ring discipline. |
| 2026-05-18 | Sprint 4.6+4.7+4.8 — Gallery white gutter + thumb strip 폐기 + lightbox bg-black | cd381a1f | bento collage bg #e8e2d9 cream → white, gap 4→2 (Apple Photos 표준). thumb strip 60+ lines 폐기 (collage와 정보 중복). lightbox #1A2332/96 + backdrop-blur → bg-black (사진 = 메인). close/nav button bg-white/15 → bg-white/85 + text-white → text-foreground (가시성 ↑). stripRef + scrollStrip + useRef import 정리. |
| 2026-05-18 | Sprint 4.10 — Recommendations 2-layer dark gradient 약화 | 1efb2450 | 2-layer (55% bottom + 15% corner) → single 25% bottom vignette. 사진이 메인. |
| 2026-05-18 | Sprint 4.11 — Day flow 48→80px photo + ArrowRight connector | 399712b0 | h-12 w-12 → h-20 w-20 (V2 빌더 게이트 통과). 3중 ring+shadow → single elevation shadow. 3-dot connector → ArrowRight (Klook/Airbnb timeline 표준). typography 11.5→13px font-bold (premium up). |
| 2026-05-18 | Sprint 4.12 — Stop card photo strip → 1장 cover 16:9 | e37dd081 | gap-1.5 strip carousel (80×56 thumb) → 1장 풀너비 16:9 (편집격 magazine spread). 카드 클릭만 → drawer로 모든 사진 진입. inner-scroll zone 충돌 제거. |
| 2026-05-18 | Sprint 4 ✅ — 12/12 + 자동 검증 통과 | (이 커밋) | typecheck clean. Hero overlay (title+price)는 §D parked 유지. Lightbox watermark는 정책 확정 대기 (§D). 사용자 시각 검증 필요: scroll-freeze 재테스트 + 5-locale LCP + 모바일 hero/gallery 회귀. |
| 2026-05-18 | §B-P3 신규 + Sprint 4.3/4.4 partial reversal (Hero shadow-hero + pill 2-step shadow tier 복귀) | 6824bc58 | User 직접 지시 ("색상 단일화, 미니멀리즘 OK, 그러나 premium 디자인 느낌 버리고 flat만 추구하는 오류 금지, 고급스러운 레이아웃 유지"). §B-P3 binding: 색 단순화는 OK, layout premium (elevation/shadow/spacing) 절대 손상 금지. flat-only = cheap-flat ≠ premium-restraint. Hero shadow-hero 복귀 + pill에 single shadow tier 복귀. |
| 2026-05-18 | §B-P3 follow-up — Seasonal + Reviews summary + Stop card 사진 frame elevation 보강 | ba3c712a | 3 영역 추가 보강: SEASON_THEME_SHARED + FALLBACK에 single shadow tier (premium card feel), Reviews summary card (reviews section hero block)에 single shadow tier, Stop card 1장 cover 사진 영역에 inner ring frame (gallery bento와 동일). 색 변경 0, elevation/frame만. |
| 2026-05-18 | Hero region eyebrow dot+line 복구 + section heading 22-26→18-20px (density 회복) | fe8eaba6 | User 직접 지시 — "hero 밑 금색 글씨 앞 선이 사라져서 글씨만 오른쪽에 둥둥 떠 있다 + 다 펼쳐서 페이지가 복잡해진 부분 복구". 1) Hero region eyebrow dot h-1.5→h-2 + halo, line h-px→h-[2px] + rounded, opacity 강화 (3-piece editorial eyebrow 가시성 회복). 2) scope CSS .text-title clamp 22-26px → 18-20px (이전 text-lg 격, hero h1만 큰 typography로 강조). text-section도 16-18로 재정렬. 12 section heading 자동 적용, 모바일 vertical density ↓. |
| 2026-05-18 | §8.6 — TourStopDetailDrawer premium 보강 (close + name + selector + bullet + category + link) | c9f6c507 | User 지시 ("후속 스텝 + 다운그레이드 절대 금지 + premium 질감 유지"). 6개 동시 premium up: 1) close bg-white/15→white/95 + ring + shadow tier (가시성=premium), 2) stop name 20px→24-26px (modal hero voice), 3) category badge UI → text-eyebrow muted (typography only, Apple/Klook), 4) highlights bullet bg-accent(copper) → bg-[var(--star-color)] (V2 identity 통일), 5) photo selector ring 4중 → ring + scale 1.02 + single shadow tier (Apple Photos minimal-yet-clear), 6) "Full description" pill+icon → underlined text-link (Klook 패턴, UI noise 0). 모두 §B-P3 가드 통과 (flat-cheap 위험 0). BookOpen unused import 정리. |
| 2026-05-18 | Sprint 5 started — Sprint 5.1 (Booking Support 6-step default closed + §B-P6 4-layer hierarchy + 6 phase icon row + underlined reveal) 진입 | (이 커밋) | §A → 🔄. §B-P4 첫 적용 + §B-P5/P6 reference 케이스 확립. |
| 2026-05-18 | Sprint 5.1 — Booking Support 6-step `default open → closed` + 4-layer hierarchy (title + subtitle prose + 6 phase icon row inline + underlined chevron) + outer card wrapper (single shadow tier + inner top highlight + hover lift) + button(header only)/reveal-area 분리 (timeline text selection 안전) | 14b6faf2 | `TourBookingSupportSection.tsx`. §B-P5 4조건 (preview prose subtitle / underlined link affordance / single shadow tier / smooth 0.30s grid-rows transition) + §B-P6 6조건 (typography 3+ layer hierarchy / generous p-5 sm:p-6 spacing / bg-white + ring + shadow + inner top white/65 gradient / 6 phase icon row + ChevronRight separators / hover -translate-y-[1px] + shadow-elevated / editorial title+subtitle copy 유지) 모두 통과. i18n 키 추가 0 (sectionUi.bookingAfterTitle + bookingAfterSubtitle 기존 활용, underlined reveal은 text-less chevron). AlarmClock/Heart/MapPin unused imports 정리. typecheck clean. 사용자 묵시 컨펌 ("ok") → Sprint 5.2 진입. |
| 2026-05-18 | Sprint 5.2 started — Included 5 visible + Excluded grid → core 3 + 미리보기 prose + "Show all X" + Excluded inline prose 1줄 + 카드 frame premium (Inner top highlight + hover lift 신규 적용) | (이전 커밋) | `TourIncludedSection.tsx`. §B-P6 6조건 적용 — 단조롭게 늘어진 grid wash → editorial card. |
| 2026-05-18 | Sprint 5.2 — VISIBLE_LIMIT 5→3 + Excluded grid → inline prose + 카드 wrapper §B-P6 premium frame (group/relative + ring + shadow-card + inner top white/65 highlight + hover -translate-y-[1px] + shadow-elevated) + "Show all X" link을 Included 헤더 row 우측으로 (eyebrow 같은 라인) | c8161466 | `TourIncludedSection.tsx`. cn import 추가. typecheck clean. Excluded 정보 100% 보존 (grid 폐기 + inline prose). §B-P6 모두 통과. 사용자 묵시 컨펌 ("ok") → Sprint 5.3 진입. |
| 2026-05-18 | Sprint 5.3 started — Pickup notes inline → per-row underlined "Details" reveal (note 있는 row만 button, default closed) + 닫힌 row 자체가 4-layer hierarchy preview | (이전 커밋) | `TourPickupDropoffSection.tsx`. 5.1 reveal pattern을 row-level로 확장. |
| 2026-05-18 | Sprint 5.3 — expandedOrders `Set<number>` state + toggleRow + note 있는 row만 `<button>` wrap (ChevronDown brand color rotate 180 when open + hover bg-stone-50/60 + aria) / note 없는 row는 div 유지 + 클릭 시 note card grid-rows 0.30s transition reveal | 3a938607 | `TourPickupDropoffSection.tsx`. ChevronDown import 추가. typecheck clean. row 자체가 4-layer preview (number badge premium tier + name + type uppercase eyebrow + time tabular) — 닫혀도 정보 단절 0. §B-P5 4조건 + §B-P6 5조건 통과 (editorial copy는 data 자체가 editorial). 사용자 묵시 컨펌 후 5.4 진입 예정. |
| 2026-05-18 | Sprint 5.4 — Fit Best For 5+개 시 첫 4 visible + "Show all X" underlined link (conditional, 4 이하면 그대로) | cdbbf1a5 | `TourFitSection.tsx`. `BEST_FOR_VISIBLE_LIMIT = 4` 상수 + `showAllBestFor` state + `overflowBestFor` 계산 + `visibleBestFor` slice. Best For 헤더 row를 `flex justify-between` 으로 변환, 우측에 conditional underlined link (Sprint 5.2 Included "Show all X" 패턴 그대로 — `text-[12.5px] font-semibold text-[var(--primary)] underline decoration-[1.5px] underline-offset-[3px]`). 4 visible item grid (bg-slate-50 + ring + persona icon) 변경 0 → §B-P6 통과 유지. §B-P5 4조건 (preview = 카드 meta line의 "{n} traveler types" count + underlined link affordance + single shadow tier 유지 + smooth 0.30s 불필요 — instant toggle). typecheck clean. **테스트:** 6-item tour (busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju) DOM 검증 — "Show all 6" 버튼 렌더링 ✓, 닫힌 상태 4 visible ✓. preview tooling은 layout 계산 환경 제약으로 click toggle 시각 검증 못함 (offsetParent null), 그러나 패턴은 5.2와 동일하므로 코드 안전. 사용자 묵시 컨펌 ("좋아 이제 다음 스텝") → Sprint 5.5 진입. |
| 2026-05-18 | Sprint 5.5 — Practical accordion 2-layer typography (title font-semibold/text-foreground + preview text-[12.5px] line-clamp-2 muted leading-relaxed + conditional render) | 59cf1bfb | `TourPracticalDetails.tsx`. **scope narrowed**: spec의 "preview text utility-list → editorial parallel rewrite" 부분은 memory rule "Bulk content edits must be additive-only" 가드로 데이터 변경 없이 component typography만. 변경: (1) h3 `font-bold/text-slate-900` → `font-semibold/text-foreground` (§B-P6 1 token + consistency), (2) preview p `text-[12px]/truncate/text-slate-500/leading-snug/mt-1` → `text-[12.5px]/line-clamp-2/text-muted-foreground/leading-relaxed/mt-0.5` (2-layer hierarchy 명확 + 1줄 truncate→2줄 line-clamp으로 더 많은 context + token), (3) `item.preview` undefined 시 `<p>` conditional omit (empty whitespace 제거). typecheck clean. DOM 검증 (busan-cruise-shore-excursion-bus-tour): 15 h3 + 14 preview p (1개 omit) ✓ + Korean ellipsis truncation 동작 ✓. preview tooling click toggle은 환경 제약 그대로. 사용자 묵시 컨펌 ("그냥 진행해 나중에 한번에 보고 수정하게") → Sprint 5.6 진입. |
| 2026-05-18 | Sprint 5.6 — Reviews summary prose 1줄 (rating + N reviews + top2 highlights, hero data 외 editorial 1줄) + Show all 버튼 prominence ↑ (text-sm/font-medium → text-[15px]/font-semibold + single shadow tier + hover lift §B-P6 5) | 91a8caf1 | `TourReviewsSection.tsx`. **(1)** highlights 영역 `flex inline` → `space-y-2`로 재구성, chips 위에 editorial prose 1줄 신규: `{rating}★ · {Based on N reviews} · {Guests mention} {top2highlights}` (기존 i18n 키 `reviewsBasedOnTemplate` + `reviewsGuestsMention` 재활용 — 신규 키 0, "★"/"·" universal symbol). prose typography `text-[12.5px] leading-relaxed text-muted-foreground` + rating은 `font-semibold text-foreground tabular-nums` accent. chips는 detail count layer로 유지. **(2)** Show all 버튼: `text-sm/font-medium/border-border/py-3/hover:bg-muted/30` → `text-[15px]/font-semibold/border-slate-200/80/py-3.5/shadow-card + hover:-translate-y-[1px] + shadow-elevated` (§B-P6 5 micro-hover lift). aria-expanded 추가. typecheck clean (admin route 2 unrelated errors는 별개). 사용자 묵시 컨펌 ("그냥 진행해 나중에 한번에 보고 수정하게") → Sprint 5.7 진입. |
| 2026-05-18 | Sprint 5.7 — Card material 통일 4-pack (AtAGlance + Fit Best For + Fit Route Logic + Reviews summary) — ring + single shadow tier upgrade + inner top white highlight + micro-hover lift | f176b26b | `TourAtAGlance.tsx`, `TourFitSection.tsx`, `TourReviewsSection.tsx`. SEASON_THEME_SHARED pattern (Sprint 2.9): `ring-1 ring-slate-200/70` + `shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.10)]` + `<span absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent pointer-events-none>` + `transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_20px_-4px_rgba(15,23,42,0.12)]`. Reviews summary card bg-slate-50/70 유지 (Sprint 2.11 binding) → highlight alpha `from-white/55` (tinted bg에 어울리는 subtle). 모든 카드 sibling divs에 `relative` 추가 (gradient `<span absolute>`가 static siblings 위에 paint되므로 자식들이 `relative`로 stacking order 위 가져야 함). typecheck clean (admin 2 unrelated errors는 별개). |
| 2026-05-18 | §B-P7 신규 + Sprint 2.8 + 2.9 + §B-P3 follow-up Seasonal partial reversal — Weather strip + Seasonal cards 마스터플랜 시작 전 baseline 복원 | f8dd2ee2 | User 직접 지시 ("이 두 섹션 카드 스타일은 마스터 플랜 시작전 카드 스타일로 회귀 시켜" + 스크린샷). `TourPracticalDetails.tsx`. **(1)** SEASON_THEMES — SEASON_THEME_SHARED neutral → per-season 4색 gradient 복원 (flower=rose, sun=amber, leaf=orange, snow=sky; commit 111ef096 baseline 정확 일치). SEASON_THEME_FALLBACK도 slate gradient 복원. **(2)** Weather strip 4-layer — bg-white + single shadow → amber-tinted outer gradient `from-[#fcf9f4] via-[#fefcf8] to-[#f8f4ec]` + 4-layer shadow stack + inner highlight + per-day sub-card gradients (sky-50/sky-100 if rain, amber-50/amber-100 if sun) + per-day icon ring gradient + inner highlight on sub-cards. **(3)** today/tomorrow icon class — `text-muted-foreground / text-[var(--star-color)]` → `text-sky-500 / text-amber-500` 복원. **§2.1 색상 5-color binding 일부 양보** (§B-P7 row 명시): Weather + Seasonal 2 영역만 예외. typecheck clean. DOM 검증: weatherOuter found ✓ + 4 sub-cards ✓ + seasonal 봄=rose / 여름=amber 등 4색 매핑 ✓. |
| 2026-05-18 | AtAGlance 카드 spring rose gradient + 메탈 4-layer sheen 적용 (Sprint 5.7 neutral SEASON_THEME_SHARED → §B-P7 정신 확장 첫 적용) | 989bfe04 | User 직접 지시 ("at a glance 카드도 시즈널카드 spring 의 rose 스타일에 메탈 느낌을 추가해봐"). `TourAtAGlance.tsx`. **(1)** 카드 outer bg `bg-white` → `bg-gradient-to-br from-rose-50 via-white to-rose-100/50` + ring `ring-slate-200/70` → `ring-rose-100/70` (spring seasonal 정확 일치). **(2)** Shadow에 rose-pink tint 추가 (`0_10px_28px_-12px_rgba(244,114,182,0.22)` resting + hover `0_18px_36px_-14px_rgba(244,114,182,0.32)`) — 메탈 floating 느낌. **(3)** 메탈 sheen 4-layer 추가: (i) inner top `from-white/75 to-transparent h-1/3` (polished edge), (ii) `inset-0 from-white/35 via-transparent to-rose-200/12` diagonal (reflection), (iii) bottom `from-rose-200/18 to-transparent h-1/4` (curve illusion), (iv) `top-0 inset-x-[8%] h-px from-transparent via-white/85 to-transparent` (hairline polished edge). **(4)** divide-slate-100 → divide-rose-100/60. **(5)** Pills `bg-slate-50/ring-slate-200` → `bg-white/85 + ring-rose-200/60 + shadow [0_1px_1.5px_rgba(244,114,182,0.10),inset_0_1px_0_rgba(255,255,255,0.85)]` (metal chip = 반투명 white + inner top highlight + 미세 rose drop). typecheck clean. DOM 검증: 메탈 sheen 4-layer 모두 적용 ✓ + 7 metal chip pills ✓. **§B-P7 정신 확장 trigger** — AtAGlance도 "첫인상 카드" 성격으로 색 다양성 허용. |
| 2026-05-18 | Fit Best For (amber) + Fit Route Logic (orange) + Reviews summary (sky) 메탈 적용 → 전면 reversal (사용자 지시 "노랑 빨강 파랑 색은 싫어") | (이 커밋) | `TourFitSection.tsx` + `TourReviewsSection.tsx`. 직전 commit에서 적용한 amber/orange/sky 4-layer 메탈 sheen + 컬러 ring/shadow/divider 전부 Sprint 5.7 SEASON_THEME_SHARED neutral 패턴으로 복원 (`bg-white` or `bg-slate-50/70` + `ring-slate-200/70-80` + 1 inner top white/65 highlight + single shadow tier + hover lift). AtAGlance rose는 유지 (사용자 명시 승인 = baseline). 새 binding §B-P8: 노랑/빨강/파랑 색 카드 금지 — pastel mint/rose 같은 "subtle premium" 톤만 허용. |
| 2026-05-19 | Sprint 5.5b started — §B-P9 binding 신규 + practicalAccordionItems[i].preview editorial parallel rewrite (busan-cruise en pilot 1 tour × 1 locale × 5 thin preview) | e8e2c805 | **사실 확인 결과** preview 필드 8개 모두 content[0] 의 auto-derived truncation ("Direct cruise terminal pickup at…" = content[0] 앞부분 + "…") 또는 exact-match ("Challenging." = content[0] 전체) — hand-authored UX copy ≠ §B-P6 6 spec의 utility-list 안티패턴 적용 대상. §B-P9 신규 binding으로 preview 필드 editorial rewrite 허용 (content[] 배열은 byte-for-byte 동일성 보장 — round-trip verified). 5 thin preview 식별: `weather-policy` ("Year-round operation, port-call dependent."), `inclusions` (utility-list 안티패턴: "pickup, coach, guide"), `language` ("Primary tour language: English."), `walking` ("Challenging."), `cancellation` ("Free cancellation up to 24 hours before pickup."). 3 strong preview (`pickup`, `what-to-bring`, `sail-away`) 유지. Git split: 첫 시도에서 사용자 pre-existing WIP (Nampo consolidation 70/128 lines) 같이 commit돼 backup→reset→재적용→commit→복원 순으로 분리. |
| 2026-05-19 | Sprint 5.5b 확장 + §B-P10 신규 (refund/민감사항 preview 가드) — busan-cruise 5 locale (ko/ja/zh/zh-TW/es) editorial parallel 적용 + en 2 preview 보정 (`weather-policy` "typhoon-level closure refunded" 표현 제거 → "weather-flexed routing day-of" / `cancellation` "Free up to 24 hours · 50% inside 24h · port-skip refunds in full" → 원본 "Free cancellation up to 24 hours before pickup." 복귀) | (이 커밋) | **User 가드 명시 (§B-P10)**: refund/cancellation/weather-emergency 명시 회피 — cruise vs 일반 버스/스몰그룹 투어 정책 차이로 인한 일관성 위험. 5 locale × 4 preview (weather-policy/inclusions/language/walking) = 20 edits + en 2 보정 = 22 surgical edits. cancellation 5 locale은 모두 원본 유지. content[] 배열 6 locale 모두 byte-for-byte 무변경 (round-trip). |
| 2026-05-19 | Sprint 5.9 코드 적용 (§B-P11 pilot — TourBookingSupportSection 6-step book-page cascade) | (다음 커밋) | scope CSS에 `.book-cascade` parent + `.book-cascade-list` stagger + nth-child 1~10 delay + nth-child(n+11) auto-cap + reduced-motion fallback 신규. `TourBookingSupportSection.tsx`에서 reveal container를 `grid-rows-[0fr|1fr] transition-[grid-template-rows] duration-300 ease-out` Tailwind class + overflow-hidden inner wrapper 폐기 → `book-cascade` class + `data-state={showTimeline ? "open" : "closed"}` attribute로 교체. mobile vertical list + desktop horizontal flex 양쪽에 `book-cascade-list` className 추가. JS logic 0 변경 (showTimeline state 그대로). will-change 의도적 생략 (tour-hero-slide와 동일 정신). typecheck clean. 정적 캡처 변경 0 (open 상태 = 기존과 동일). i18n 영향 0. |
| 2026-05-19 | Timeline StopCard 번호 뱃지 vs 카드 좌측 모서리 시각 overlap fix (모바일 스크린샷 보고) | (다음 커밋) | `TourTimelineSection.tsx:49` `pl-9` (36px) + badge `w-9 left-0` (36px) → badge ring/shadow가 카드 좌측 rounded 모서리 위에 겹쳐 보임. `pl-9` → `pl-11` (44px = 36 badge + 8 gap), spine line `left-[18px]` → `left-[22px]` (pl-11 중앙). `PortSelectorTimeline.tsx`의 `VariantStopCard`는 이미 pl-11 spec이라 spec 통일 동반. 사진 카드 + 텍스트 카드 모두 영향 (busan-cruise 시각 검증 직후 fix). |
| 2026-05-19 | Timeline 번호 뱃지 미세 좌측 시프트 (-4px) + spine 위치 보정 (사용자 "조금만 왼쪽" 직접 지시) | (다음 커밋) | `TourTimelineSection.tsx` badge `absolute left-0` → `absolute -left-1` (-4px) — 뱃지가 살짝 viewport 좌측으로 떠 보이는 floating premium 표현. spine line은 이전 commit에서 `left-[22px]` (pl-11 중앙)였으나 badge 중앙(18px)과 4px misalignment였음 → `left-[14px]` (이동된 badge 중앙: -4 + w-9/2 = 14)로 정렬 보정. typecheck clean. |
| 2026-05-19 | Sprint 5.9 확장 #1 ✅ — TourIncludedSection "Show all" reveal에 book-page cascade 적용 | (다음 커밋) | `TourIncludedSection.tsx`. Core 3 (1차 visible)은 standalone `<ul>` 유지. Overflow extras를 `.book-cascade` parent + `data-state={showAll ? "open" : "closed"}` + inner `<ul className="book-cascade-list">`로 감쌈. `--book-stagger` inline style 동적 조정 (§B-P11 (3) catalog-size 가이드: N≤3=0ms / N4-6=60ms / N7-10=40ms / N>10=28ms). 기존 `visibleIncluded` slice 로직 폐기 → `coreIncluded`/`extraIncluded` 분리. 정적 캡처 (open 상태) 변경 0. typecheck clean. §B-P5 4조건 + §B-P6 6조건 + §B-P11 7조건 모두 통과. i18n 영향 0. |
| 2026-05-19 | Sprint 5.9 확장 #2-5 ✅ batch — Reviews / Fit (3 reveals) / Pickup / Practical FAQ 모두 book-cascade 통일 | (다음 커밋) | 4 파일 동시 적용. **#2 Reviews** (`TourReviewsSection.tsx`): core 3 + extras book-cascade; stagger 동적. **#3 Fit** (`TourFitSection.tsx`): 3 reveals 모두 통일 — (3a) BestFor extras (core 4 + cascade), (3b) Less Ideal cascade (mt-2.5 → inner pt-2.5 변환으로 transition smooth), (3c) Route Logic cascade (각 section block이 cascade child). `stagger(n)` helper로 reveal target별 동적 stagger. **#4 Pickup** (`TourPickupDropoffSection.tsx`): per-row note reveal, N=1 fallback (stagger 무의미, 단일 카드 unfold 모션만 — "single page peel"). **#5 Practical FAQ** (`TourPracticalDetails.tsx`): per-item accordion content, contentCount 기반 dynamic stagger. 모든 기존 `grid transition-[grid-template-rows] duration-300 ease-out` Tailwind class + `overflow-hidden` inner wrapper 폐기 → `book-cascade` class + `data-state` attribute로 통일. JS logic 0 변경 (showAll/showLessIdeal/showLogic/expandedOrders/expandedItems state 그대로). typecheck clean. 정적 캡처 변경 0. i18n 영향 0. §B-P5 + §B-P6 + §B-P11 모두 통과. **Sprint 5.9 확장 priority list 5개 모두 ✅** — 향후 신규 reveal 패턴은 §B-P11 가드 적용 default. |
| 2026-05-19 | **§B-P11 신규 + Sprint 5.9 신규 (book-page cascade reveal pilot) — 플랜 문서 박힘, 코드 미실행** | (이 plan-only 커밋) | User 직접 지시 ("아코디언을 책처럼 접어두는거 + 카드들이 접혀있다가 누르면 천천히 부드럽게 촤르륵 펼쳐지는 스타일을 최대한 고급스럽게"). **§B-P11 binding** = §B-P5 (4) "smooth 0.30s" 확장 (덮어쓰기 X) — 7조건 (easing `cubic-bezier(0.22, 1, 0.36, 1)` / container 360ms + per-child 480ms / catalog 크기별 stagger 가이드 / `translateY(-4px) rotateX(-6deg) → 0` + `perspective: 1400px` / 총 900ms cap + 750ms 목표 / material 무변화 §B-P3 유지 / `prefers-reduced-motion: reduce` 필수 fallback) + 구현 가드 (CSS-only data-state 토글, framer-motion/IO/신규 라이브러리 금지 §6.8) + anti-pattern (꽃잎/오리가미/spring overshoot/rotateX>10deg/skew/rotateZ 금지). **Sprint 5.9 task** = `TourBookingSupportSection.tsx` 6-step reveal에 `.book-cascade` CSS class + `@keyframes book-page-unfold` 적용 (busan-cruise 기준 reference 케이스). 확장 priority: ①5.2 Included ②5.6 Reviews ③5.4 Fit ④5.3 Pickup ⑤5.5 Practical FAQ. **§A Sprint 5 row updated**: 5.9 🔄 (plan only). **§D Animation tempo 통일과의 관계 명시** (5.9는 4-step 중 deliberate tier의 reveal layer 정의, 페이지 전체 통일은 §D Sprint 6+ 별개 유지). 5.5b 다국어 확장과 의존성 충돌 0 (별개 영역). 코드 변경 0 — 이번 턴은 plan-only. |
| 2026-05-18 | Timeline stop card number badge 모바일 viewport 왼쪽 짤림 fix + Booking Support Trust 3-grid에 mint + 메탈 + sci-fi 科技感 실험 적용 (§B-P8 신규) | (이 커밋) | **(1) Timeline fix**: `TourTimelineSection.tsx:48` `<div className="relative -ml-2 pl-9">` → `<div className="relative pl-9">` (-ml-2 negative margin이 badge를 viewport 좌측 -8px로 밀어내 모바일 짤림 유발). spine line `left-[16px]` → `left-[18px]` (badge 중심 정렬 조정). badge에 `z-10` 추가 (card 위로 stacking). **(2) Booking Support Trust mint+tech**: `TourBookingSupportSection.tsx` TRUST_THEME_SHARED bg `bg-white` → `bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40` (연한 민트 gradient) + ring `ring-slate-200/70` → `ring-teal-100/55` + iconRing `bg-slate-50/ring-slate-200/70` → `bg-white/80/ring-teal-200/50 + inset top highlight`. Card wrapper에 6-layer 효과 추가: (i) inner top white sheen h-1/3, (ii) diagonal `from-white/40 via-transparent to-teal-200/10`, (iii) bottom teal h-1/4 curve, (iv) top hairline edge, **(v) sci-fi cyan halo blur** (`-bottom-6 -right-6 h-16 w-16 rounded-full bg-cyan-200/22 blur-2xl` = 科技 holographic depth), **(vi) sci-fi precision blade hairline** (`top-[58%] inset-x-[12%] h-px via-teal-300/30` = digital tech accent). Shadow에 cyan tint 추가 (`rgba(20,184,166,0.18)` resting + 0.30 hover). **§B-P8 신규 (binding):** "노랑 빨강 파랑 강한 색 금지 — 실험 카드는 mint/rose 같은 subtle premium pastel + modern metal + sci-fi 科技感 element (corner halo blur + hairline accent)만 허용. 섹션 하나에만 적용 (현재 = Booking Support Trust 3-grid)." typecheck clean. |
| 2026-05-18 | **Apple/Airbnb 미니멀 + 럭셔리 audit + §B-P6 신규 + Sprint 5 plan v2 업그레이드 (editorial richness spec + 5.7 + 5.8 신규)** | (이전 커밋) | User 직접 지시 ("너무 flat하고 밋밋한 페이지 만들지 말고, 무조건 Apple/Airbnb level 미니멀 추구하면서 프리미엄/럭셔리 포기 X"). **§B-P1~P5 cumulative 적용 시 flat-cheap 위험 = 미니멀이 줄어든 정보 양만 챙기고 남은 정보의 editorial richness를 챙기지 않는 상태.** Apple 제품 페이지 / Airbnb 호텔 페이지의 본질 = "항목 수는 적지만 항목 하나하나가 작은 책 한 페이지처럼 정성스러움". **§B-P6 (Apple/Airbnb 미니멀 + 럭셔리 양립) 신규 binding 추가** — 6 조건 (typography 3+ layer / generous spacing / material depth + inner highlight / photo·icon prominence / micro-hover lift / editorial copy). Sprint 5 sub-task 5.1-5.6에 §B-P6 spec 보강, 5.7 (Card material 통일 — Inner highlight + hover lift 누락된 카드 보완) + 5.8 (Section heading luxury typography 검토, fe8eaba6 18-20px → conditional 22-28px Apple pattern 복원) 신규 추가. |
| 2026-05-18 | **정보 과밀 audit + §B-P4/P5 신규 + Sprint 5 plan 작성** | (이전 커밋) | User 직접 지시 ("아코디언을 다 펼쳐버리니까 페이지가 너무 복잡해졌어… 정보 과부하 절대 금지 + 프리미엄 질감 절대 다운그레이드 금지"). **16 section + Drawer 코드 reality 재검증 → 정보 덩어리 핵심 4곳 식별**: ①Booking Support 6-step timeline default open (§B-P2 partial reversal로 default true 됐는데 mobile vertical 6 step = 600px+ text wall, 가장 큰 elephant), ②Included 5 visible + Excluded grid all visible + Show all link (default 9 items + show all로 16+ rendered 가능), ③Pickup 5 row + notes inline if has note (per-row visible note → 단조롭게 늘어진 텍스트), ④Fit Best For 2-col grid 4-8 items (1차이지만 6+이면 overload). **§B-P4 (1차 visible scope 재정의) + §B-P5 (2차 reveal premium 유지) 신규 binding 추가. Sprint 5 (정보 과밀 reversal) 6 sub-task 작성.** Sprint 3 §B accordion 8→2 binding은 유지하되, 1차/2차 분류를 엄격화 — "다 펼침 ≠ premium" 인식 교정. |

## §D 보류 / parked

| 항목 | 이유 | 재검토 시점 |
|---|---|---|
| Hero overlay (title + price) | 다국어 폭 측정 필요, LCP 회귀 위험 | Sprint 4 acceptance 후 |
| Hero/Gallery watermark 일괄 제거 | 정책팀 컨펌 대기 | 정책 확정 후 |
| Interactive map (Mapbox/Google JS) | 성능·비용·scroll-freeze 가드 충돌 가능 | Sprint 6+ |
| Dark mode | app-shell-uiux 트랙과 통합 검토 | app-shell Sprint 진행 시 |
| Reviews avatar hash-based hue | Sprint 6+ polish | 분기별 |
| Loading skeleton 통일 | Sprint 6+ | 분기별 |
| Focus ring 통일 (현재 4가지) | Sprint 6+ | 분기별 |
| Animation tempo 4-step scale 통일 (§6.4: quick 150 / default 240 / deliberate 360 / slow 520ms) | Sprint 6+ — 페이지 전체 transition duration 10가지를 4-step으로 통일하는 작업. **§B-P11 (Sprint 5.9)는 별개** — 5.9는 4-step 중 "deliberate (360ms) container + 480ms per-child" reveal layer만 정의하는 spec, 페이지 전체 통일 작업과 독립. 5.9 적용 후에도 §D Sprint 6+ 통일 작업은 그대로 남음. | 분기별 |
| Drawer 내부 DatePicker reveal animation (delay 0.48s + duration 0.85s) | Sprint 1.1 drawer 본체 0.30s와 부정합 — drawer 슬라이드 0.30s 끝, calendar 1.33s에 표시 | Sprint 1 acceptance 후 |
| 모바일 sticky bar 좌측 가격 라벨 옆 1줄 reassurance (free cancellation) | Sprint 1.5에서 drawer 안 reassurance 제거함에 따라 모바일 결제 직전 reassurance 약함 가능 | acceptance QA 후 필요 시 |
| Sticky bar 좌측 가격 vs CTA 가격 중복 (Sprint 1.3 결과) | Pre-drawer 상태 좌측 가격 + CTA 라벨 가격 = 2회. Spanish/일본어 폭 검증 후 좌측 가격 강등 가능 | 5-locale QA 후 |

---

## 0. 한 줄 입장

> **Codex의 리뷰는 70% 맞다. 나머지 30%는 안전 우선 관점이라 옳은 견제이지만, "디자인 시스템 부채"의 본질을 약간 완화해서 본다.**
>
> 나의 1차 플랜은 진단은 정확했으나, **실행 순서가 위험했다.** Codex의 conversion-first 순서를 받아들이되, 디자인 시스템 통일의 강도는 양보하지 않는다.

요약 입장:

```
방향: 그대로 유지 (색상·타이포·shadow·radius·accordion 다이어트)
순서: Codex의 Phase A (conversion 안전 항목 먼저) 채택
강도: 색상 다이어트는 양보 X — 한 페이지 17색은 premium의 가장 큰 적
범위: Hero 대수술과 interactive map은 Phase E/F로 미룸
가드: 모든 변경은 섹션 단위 feature flag + 다국어 QA 통과 후 머지
```

---

## 1. Codex 평가 중 내가 수용하는 부분 (= 내가 틀렸음)

### 1.1 Phase 1에 13개 변경을 한 번에 묶은 것 — 잘못

원문 Phase 1은 `Hero 자동슬라이드 OFF + Hero overlay + Hero edge-to-edge + Trust strip 단색 + Sub-nav 변경 + At-A-Glance 변경 + Gallery gutter + Pickup gradient 제거 + Drop-off dark 제거 + 배경 그라데이션 제거 + CTA 색 + Drawer 0.78s → 0.30s + Watermark 제거` 13항목.

**Codex 지적이 옳다:** 이건 quick-win이 아니라 **전면 리스킨**. 한 번에 머지하면:

- 어떤 변경이 컨버전을 끌어올렸는지/떨어뜨렸는지 측정 불가
- 시각 회귀(QA)가 한 PR에 14개 섹션 동시 발생
- 롤백 단위가 너무 큼 → 작은 버그도 통째로 revert
- 다국어 5종 × 14 섹션 = 70개 회귀 케이스

**수정:** Phase 1은 두 트랙으로 분리.

```
트랙 1 (컨버전 안전): drawer 속도 + CTA 색 + booking card 슬림화
트랙 2 (시각 시스템): 토큰 정의만, 적용은 섹션별 점진
```

### 1.2 Hero 60vh 확대 — 후회

원문은 "Hero 60vh + 풀스크린 swipe gallery (Airbnb-style)" 을 Phase 3 권장. **이건 상세페이지 컨버전 본능에 반한다.**

- 상세페이지 ≠ 랜딩 페이지. 상세는 "가격·일정·예약 가능" 확인이 목적.
- 60vh hero = 모바일에서 가격/CTA 정보가 첫 fold 아래로 밀림
- Airbnb는 호텔/숙소가 본질적으로 시각 의존도 99% (사진이 곧 상품). 투어는 일정 + 포함 + 가이드 신뢰가 본질의 60%

**수정:** Hero는 현재 `max-h-[360px]` 캡을 **소폭** 완화 (예: `max-h-[420px]` 데스크탑) 정도만. 모바일은 그대로. 60vh 안 함.

### 1.3 Radius 8/12/16 기계적 3단계 — 너무 좁음

원문은 `sm 8 / md 12 / lg 16` 3단계로 제한. Codex가 옳다: **booking card, drawer, modal은 본문 카드보다 더 큰 radius를 가질 수 있다.**

**수정 (Codex의 role-based scale 채택):**

```
chip / pill:        8px or full
small control:      10-12px
body card / photo:  12-16px
booking / drawer:   18-20px
modal:              20px
```

핵심은 **숫자 단계 수**가 아니라 **역할별 1:1 매핑**. 현재 페이지에 `14, 20, 26, 28` 8단계가 있는 게 문제이지, 4단계로 가도 OK.

### 1.4 Trust strip 완전 제거 — 과한 처방

원문은 "Hero 직후 trust strip은 컨버전 압박만 주고 매력 안 들어옴" → "booking card 안으로 옮기기" 제안. Codex 지적대로 **이건 정보 위치만 보고 가치를 놓침**.

상세페이지 도입부의 신뢰 신호는:
- 결정 fatigue 완화
- 첫 fold ≠ booking card 인 사용자(스크롤 사용자) 에게 reassurance 시그널 제공
- 가격을 먼저 보기 전에 "위험 낮음" 시그널

**수정:**
- Trust strip **위치는 유지**.
- 단색화 + 폰트 13-14px 로 키움.
- 같은 문구(free cancellation, pay later)가 page에 5번 등장하는 중복은 **개수만** 줄임 (5 → 2회: trust strip + booking card 안).

### 1.5 Phase 0 "토큰 먼저, 그 다음 적용" 순서 — 비현실적

원문은 Phase 0 (토큰 정의) → Phase 1 (시각 변경) 순서. Codex 지적: **토큰만 정의해놓고 적용을 미루면 토큰은 영원히 dead code.**

**수정:** Codex의 conversion-first 순서를 채택. **먼저 컨버전 안전 항목(=CTA 계열)을 작은 PR로 처리하면서 동시에 그 PR 안에서 토큰을 함께 정의·사용.** 토큰은 적용과 동시에 태어남.

```
Before (원문):  토큰 → (대기) → 적용
After (수정):   적용 PR 안에서 토큰 정의 + 사용 동시
```

### 1.6 Scroll freeze 리스크 — 안 짚었음

Codex가 추가한 가드: "사용자가 상세페이지 스크롤 도중 멈춤 보고함 → motion 추가에 주의".

원문에는 빠진 중요한 컨텍스트. 결과:
- Hero ken-burns animation: **유지** (이미 IntersectionObserver paused 처리됨)
- Drawer push-spacer: **신중하게** overlay 전환 (한 번에 전환 X, QA 단계)
- Hero overlay: **모바일 first fold 정보가 늘어남** → first paint LCP 영향 측정 필수
- Backdrop blur: 새로 추가 금지, 기존 것도 stack 2개 이상 금지 (이미 sub-nav에서 한 번 제거된 이력)

### 1.7 Watermark 제거 — 정책 확인 필요

원문은 "premium = no watermark" 일방 처방. Codex 지적: **저작권/내부 운영 정책 확인이 선행 조건.**

**수정:**
- Lightbox 안: watermark 제거 우선 (사용자가 가장 크게 보는 순간)
- Hero/gallery 메인: 정책팀 확인 후
- Card thumbnail: 유지해도 OK (작아서 거의 안 보임)

### 1.8 코드 reality 사실 수정 (2026-05-18, Sprint 1 진입 시 검증)

§3 Sprint 1 표에 적힌 파일 경로 / 라인 번호와 실제 코드의 차이:

| 항목 | 마스터 플랜 표기 | 실제 코드 reality | 영향 |
|---|---|---|---|
| Sticky bar 파일 경로 | `_shared/TourStickyBookingBar.tsx` | `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourStickyBookingBar.tsx` | 경로만 다름, scope CSS 영향 X |
| Desktop booking card 경로 | `_shared/TourDesktopBookingCard.tsx` | `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourDesktopBookingCard.tsx` | 동일 |
| Drawer animation 라인 | `L319, L334` (한 라인) | L319 = backdrop fade (`duration 0.55`), L334 = drawer panel slide (`duration 0.78`) — **2곳 동시 단축 필요** | Sprint 1.1 작업 범위 확장 (백드롭도 함께) |
| Sticky CTA bg 라인 | `L291` | L291 = `btnClass` 공용 string에 `bg-foreground` (실제 사용은 다른 라인에서 `btnClass` 통해) | 단일 string 교체로 양쪽 적용 가능 |
| Desktop CTA bg 라인 | `L522` | L522 = `<button className="…bg-foreground…">` 인라인 | 인라인 교체 |
| Trust strip 위치 | `TourProductDetailClient.tsx:77-97` | 동일 (L77-97 = trust strip JSX block) | 일치 |
| Pricing tier 본문 중복 | `TourProductDetailClient.tsx:108-156` | L107-156 = `<section id="pricing">` block | 1행 off-by-one, 정정 |

→ Sprint 1 작업 시 위 reality를 기준으로 진행. 추가로 발견되는 차이가 있으면 같은 표에 1줄 추가.

---

## 2. Codex 평가 중 내가 더 강하게 밀어야 하는 부분

### 2.1 색상 다이어트는 양보 X — 단일 최고 임팩트 변경

Codex도 "찬성"하되 "지나치게 평평해질 수 있으니 accent는 살려두자" 는 단서. **나는 더 강하게 밀어야 한다고 본다.**

이유:
- 현재 페이지의 premium feel 부재 원인 1순위가 색상 분산. (2번째가 typography, 3번째가 shadow)
- "여행 상품 = 감성이라 색이 필요" 라는 주장은 **착각**. Airbnb / Klook 모두 본문은 거의 monochrome + 1 brand color. 감성은 **사진**이 담당. UI 색이 담당 X.
- "accent 완전히 죽이지 말기" 는 동의하지만, 현재 페이지 accent (copper `#c8956c`) 는 **Pickup section + Fit card + Hero star + Trust strip 아이콘 + 일부 ring** 에서 5가지 다른 의미로 쓰임. 이건 "accent" 가 아니라 **secondary brand color 가 의미 없이 흩뿌려진 상태**.

**고집할 룰:**

```
brand:    #2e5c8a          → CTA, focus ring, primary 인터랙티브
accent:   #c8956c           → Hero star + 1-2 hero accent only (예: subnav active underline)
success:  emerald-600        → "available", "verified", "included" 상태 only
danger:   red-500            → "unavailable", "not included" 상태 only
neutral:  slate-900 ~ slate-50 → 나머지 전부
```

→ **rose, amber-as-decoration, sky, violet, orange = 페이지에서 0회 사용.**

### 2.2 Type scale은 "정의"가 아니라 "강제"가 필요

Codex는 "공통 type scale 정의" 만 권장. 나는 **enforcement** 없이는 토큰이 무력하다고 본다.

이유: 현재 코드에서도 `--radius`, `--primary` 같은 토큰은 이미 정의되어 있다 (`tour-product-v2-scope.css:5-25`). 그런데 **거의 모든 섹션이 토큰을 우회하고 인라인 값을 박았다.** 토큰을 정의해도 사용 안 됨 = dead token.

**추가해야 할 가드:**

1. ESLint rule: `text-\[1[0-9](\.[0-9])?px\]` 매칭하는 임의 픽셀 클래스 경고
2. PR template: "이 PR에 새로운 색·radius·shadow 가 들어가는가? 토큰 사용했는가?" 체크박스
3. Storybook (또는 단순 design.tsx 페이지): 페이지 단위로 type / color / elevation 샘플을 보여줌 → 디자이너가 즉흥 결정하기 전에 참조

### 2.3 Accordion 다이어트 — Codex가 약하게 잡음

Codex는 "FAQ + Practical만 accordion 으로 남김" 권장. 동의하지만 **수치를 더 강하게**.

현재 페이지 accordion 패턴 8종 (Included, Fit-BestFor, Fit-LessIdeal nested, Fit-RouteLogic, Practical, FAQ-item, Pickup-row, Support).

**목표: 2종으로 축소.**

```
유지:  FAQ (item-level), Practical (top-level)
폐기:  Included accordion → 첫 5개 always visible + "Show all" link
폐기:  Fit 3중 nested → flat 2-col (best / less ideal) always visible
폐기:  Pickup row expand → 단순 list (note 가 있는 경우 row 아래 항상 노출)
폐기:  Support default-open accordion → flat horizontal timeline mini
```

이거 하나로 **사용자 클릭 -8회**, **first-fold 정보량 +60%**.

### 2.4 CTA 통합 (price + label) — Codex가 약하게 잡음

Codex도 "CTA에 total price 포함" 찬성. 다만 "검토" 라고 약한 표현. **나는 강한 처방.**

근거:
- Airbnb 패턴: `Reserve · $1,247 total` — 한 줄에 액션 + 가격 + 단위
- 현재 페이지: CTA 위에 "From $X" 별도 / CTA "Reserve" / 그 아래 "Total · X guests $Y" 별도 → **가격이 3번 등장, 사용자 인지 분산**
- 모바일 sticky bar 도 마찬가지 — 좌측에 "From $X / per person" + 우측 CTA "Check Availability" → CTA에 가격 신호 0

**처방:**

```
Desktop CTA:        Reserve · {totalFormatted}    (guestCount > 1)
                    Reserve · {unitFormatted}     (guestCount = 1)
Mobile pre-drawer:  Check Availability · from {unit}
Mobile in-drawer:   Reserve · {total}
```

### 2.5 At-A-Glance 6색 무지개 — Codex가 동의했지만 대체안 모호

Codex 찬성: "의미 없는 색상 신호 제거". 그러나 **그 다음 어떤 UI 가 들어가야 하는가** 는 빠짐.

내 처방 (3개 옵션 중 하나):

```
A. Progress bar:    "Walking intensity ████░ "  (단색 brand color)
B. Pill chip:        "Easy" / "Moderate" / "Vigorous"   (text only, brand color tinted)
C. ★ system:         "Walking intensity ★★★☆☆"   (amber, universal)
```

Tour 의 직관에는 **B (text pill)** 이 가장 명확하다. "Easy / Moderate / Hard" 는 추상 도트보다 즉시 이해됨. Klook/Booking 도 이 패턴.

---

## 3. 통합 실행 플랜 (Codex Phase A-F → 압축 4 Sprint)

Codex의 6 Phase는 방향은 옳지만 **너무 길다.** 실제 실행 가능한 단위로 압축:

### Sprint 1 — 컨버전 안전 (1주, 1 PR group)

목표: 예약 흐름 마찰 즉시 감소. 시각 시스템에는 거의 손대지 않음.

| 작업 | 파일 | 리스크 |
|---|---|---|
| ✅ Drawer animation `0.78s → 0.30s` (+ backdrop 0.55s → 0.24s) | `TourStickyBookingBar.tsx:319, 334` | 거의 없음 |
| ✅ Desktop + Mobile CTA `bg-foreground → bg-primary` | `TourDesktopBookingCard.tsx:522`, `TourStickyBookingBar.tsx:291` | 낮음 (visual only) |
| ✅ CTA label에 total price 통합 (위 §2.4) | 동일 파일 | 다국어 5종 QA 필요 |
| ✅ Booking card pricing tier 중복 제거 (lg:hidden — desktop만 중복 제거, 모바일은 유지) | `TourProductDetailClient.tsx:108-156` | 중간 (정보 표시 변경) |
| ✅ Free cancellation / Pay later 반복 5회 → 2 위치 (trust strip + desktop card; sticky drawer 안 reassurance row 제거) | trust strip + booking card 안만 유지 | 낮음 |
| ✅ Drawer drag handle (4px bar at top) + swipe-down dismiss | `TourStickyBookingBar.tsx` | 낮음 |

**완료 기준:** booking checkout flow 5종(date 선택 / guest 변경 / duration / available / unavailable / 결제 진입) QA 통과.

---

### Sprint 2 — 디자인 시스템 토큰 + 색상 다이어트 (2주, 섹션별 점진 PR)

목표: 색상 17개 → 5개 강제. 토큰은 정의 + 즉시 사용.

| 작업 | 영향 섹션 | 방식 |
|---|---|---|
| ✅ Color tokens 정의 (§2.1) | `tour-product-v2-scope.css` | 신규 CSS 변수 추가, 기존 토큰 유지 (호환성) |
| ✅ Type scale 6단계 정의 + utility class (`.text-display, .text-title, .text-section, .text-body, .text-caption, .text-eyebrow`) | scope CSS | 신규 class 추가 |
| ✅ Hero rose → neutral + accent 1회 (region eyebrow만 accent) | `TourHeroSection.tsx` | 1 PR |
| ✅ Pickup copper gradient → flat brand (drop-off dark → light pickup과 동일 카드) | `TourPickupDropoffSection.tsx` | 1 PR |
| ✅ Included emerald/rose split → white card with green/red icon only | `TourIncludedSection.tsx` | 1 PR |
| ✅ Fit amber/copper bg → white card | `TourFitSection.tsx` | 1 PR |
| ✅ Practical weather 4-layer gradient → 단순 row | `TourPracticalDetails.tsx` | 1 PR |
| ✅ Seasonal 4계절 4색 → 단일 카드 + season icon (색은 icon에만) | `TourPracticalDetails.tsx` | 1 PR |
| ✅ Booking Support 5색 trust + 6색 steps → 1색 | `TourBookingSupportSection.tsx` | 1 PR |
| ✅ Reviews summary gradient 3% opacity → solid pale bg | `TourReviewsSection.tsx` | 1 PR |
| ✅ Hero star copper → amber (다른 모든 별과 통일) | `TourHeroSection.tsx` | 1 PR |
| ✅ Trust strip 3색 → emerald-only monochrome | `TourProductDetailClient.tsx:77-97` | 1 PR |

**완료 기준:** 한 페이지에서 사용하는 색군 grep 으로 5개 (brand/accent/success/danger/neutral) 이하 검증.

---

### Sprint 3 — 콘텐츠 접근성 + 정보 위계 (2주)

목표: Accordion 8개 → 2개. 사용자가 "열어야 하는" 정보를 "보이는" 정보로 전환.

| 작업 | 파일 |
|---|---|
| ✅ Included accordion 해제 → 첫 5개 always visible + "Show all" | `TourIncludedSection.tsx` |
| ✅ Fit 3중 nested 해제 → 2-col flat layout (best left / less ideal right) | `TourFitSection.tsx` |
| ✅ Support default-open accordion → 항상 펼친 timeline | `TourBookingSupportSection.tsx` |
| ✅ Pickup row expand 해제 → note 있는 행만 항상 표시 | `TourPickupDropoffSection.tsx` |
| ✅ Section heading + subtitle: 모두 동일 spec (Sprint 2 token 사용) | 12개 섹션 |
| ✅ Eyebrow: page-wide 단일 class (10가지 → 1개) | 페이지 전체 |
| ✅ At-A-Glance 6색 → text pill ("Easy / Moderate / Vigorous") | `TourAtAGlance.tsx` |
| ✅ Subnav active pill → underline 2px brand color | `TourTabsNav.tsx` |
| ✅ Subnav 양쪽 fade + IntersectionObserver entries 정렬 (top-most 선택) | 동일 |

**완료 기준:** Lighthouse 첫 fold 정보 가시성 +30%, 사용자가 "어느 section 이 active 인지" mental model 명확.

---

### Sprint 4 — Hero / Gallery 안전한 개선 (2주, QA 집중)

목표: Hero/Gallery 첫인상 개선, **단 컨버전 흐름은 건드리지 않음**.

| 작업 | 처리 |
|---|---|
| ✅ Hero autoplay 6.5s → OFF, dot 인디케이터 + swipe만 | 즉시 |
| ✅ Hero `max-h-[360px]` → `max-h-[420px]` (데스크탑만), 모바일 유지 | QA 후 |
| ✅ Hero `rounded-b-2xl` 제거, edge-to-edge | 즉시 |
| ✅ Hero `shadow-hero` 제거 | 즉시 |
| ✅ Hero pill 그라데이션 + ring + shadow 3중 → flat chip | 즉시 |
| ✅ Save heart active state: rose-500 → var(--danger) token | 즉시 |
| Hero overlay (location + ★) — 다국어 QA 후 결정 | 보류 (§D parked, §B-P2 정보 과밀 위험) |
| ✅ Gallery cream gutter `#e8e2d9` → `#ffffff`, gap 4 → 2 | 즉시 |
| ✅ Gallery 썸네일 strip 제거 (collage 와 중복) | 즉시 |
| ✅ Lightbox bg `#1A2332/96` → `#000` | 즉시 |
| ✅ Lightbox 좌우 nav arrow: hover bg 25% → 85% | 즉시 |
| Lightbox watermark — 정책 확인 후 제거 | 보류 |
| ✅ Recommendations 사진 위 2-layer dark gradient → 약하게 (25%) | 즉시 |
| ✅ Day flow chip 48 → 80px photo | 즉시 |
| ✅ Day flow dot connector 3×3px → ArrowRight icon | 즉시 |
| ✅ Stop card 사진 strip → 1장 cover (16:9 풀너비) | 중간 |

**완료 기준:** Hero/gallery 시각 회귀 0, 다국어 5종 LCP 회귀 없음, 모바일 스크롤 freeze 재발 없음.

---

### Sprint 5 — 정보 과밀 reversal + Apple/Airbnb 럭셔리 미니멀 (§B-P4/P5/P6 가드, 1-2주, 섹션별 작은 PR)

목표: Sprint 3에서 over-expand된 1차 visible scope를 §B-P4 기준으로 회복하되, **§B-P5 4조건 + §B-P6 6조건 모두 유지**. **"펼쳐서 텍스트 덩어리" → "닫혀도 작은 책 한 페이지처럼 정성스러운 미니멀 카드 + 열면 *촤르륵 종이가 펴지듯* 더 자세히"** 전환 (Sprint 5.9 §B-P11로 모션 차원 추가). 텍스트 부피 ↓, 그러나 *editorial richness · premium material · typography hierarchy · micro-hover · photo prominence · cascade reveal motion* 모두 ↑.

**§B-P4 가드 인지**: 1차 (always visible) = Hero · Trust strip · Tabs · At-A-Glance · Day Flow · Timeline stop cards · Pickup HEADER · Included CORE 3개 · Excluded inline prose · Practical Weather · Booking Support Trust 3-grid · FAQ headers · Reviews summary · Recommendations. 2차 (default closed + on-demand reveal) = Pickup notes · Included full list · Booking Support 6-step · 기타.

**§B-P5 가드 인지** (모든 2차 reveal trigger에 적용):
1. **미리보기 1줄 항상 노출** (닫혀도 정보 단절 X)
2. **Reveal trigger = underlined link** (Klook 표준, `text-[var(--primary)] underline decoration-[1.5px] underline-offset-[3px]`) — NOT 큰 chevron button + bg-slate-100 wash
3. **Single shadow tier 유지** (닫힌 카드도 premium card feel, §B-P3 binding)
4. **Smooth 0.30s transition** (grid-rows-[0fr→1fr] easing)

**§B-P6 가드 인지** (모든 visible element + reveal trigger + 닫힌 카드에 적용):
1. **Typography 3+ layer hierarchy** — eyebrow (text-eyebrow muted) + title (text-base/text-[15px] font-semibold) + meta (text-[12.5px] muted) + (optional) accent badge or count. *단일 muted 12px line 금지.*
2. **Generous spacing** — 카드 padding ≥ 16px (mobile) / 20-24px (sm+); inner gap ≥ 10px. *cramped/dense 금지.*
3. **Material depth** — `bg-white + ring-slate-200/70 + shadow-card (single soft tier) + inner top highlight (top 1/3 white/65 gradient)` 표준 — Sprint 2.9 SEASON_THEME_SHARED 패턴 = 정답. *ring-only or shadow-only 카드 금지.*
4. **Photo/icon prominence** — 가능한 경우 카드 안에 small thumbnail (Apple Photos chip, 36-48px) 또는 phase icon row (compass/stars/etc 미세 18px ring-1). *전체 텍스트만 카드 = cheap.*
5. **Micro-hover lift** — `-translate-y-[1px] + shadow-elevated transition-[transform,box-shadow] duration-300 ease-out` 표준. *hover 없는 카드 금지.*
6. **Editorial copy** — UI string parallel structure + 1 highlighted phrase + count badge 형태. *"3 items · pickup, drop-off, what to bring" 같은 utility-list 금지 → "Pickup zones · drop-off bands · what to pack" (parallel premium copy).*

| # | 작업 | 영향 파일 | §B-P5+P6 spec |
|---|---|---|---|
| **5.1** | **Booking Support 6-step timeline default OPEN → default CLOSED**. 닫힌 카드 4-layer hierarchy: eyebrow "Pre-tour support" + title "Confirmation → Pickup → Tour → Follow-up" (font-semibold, brand 1 highlighted phrase) + meta "6 phases · from booking to Day 1" + 6 phase icon row inline (Mail/Bell/Moon/Sunrise/Compass/Sparkles 미세 18px ring-1 muted) + underlined link "View full timeline" (right-aligned). 펼침 시 기존 timeline 그대로 + smooth 0.30s. | `TourBookingSupportSection.tsx:128, 170-274` | §B-P5 4 + §B-P6 1+2+3+4+5+6 |
| **5.2** | **Included visible 5 + Excluded grid 전체 → Included core 3 + 미리보기 prose + "Show all X" + Excluded inline prose 1줄 + small thumbnail row optional**. 닫힌 카드 4-layer: eyebrow "What's Included" + title 3 core items (font-semibold list) + meta editorial copy ("12 inclusions · all transport · entrance fees · expert guide") + underlined link "Show all 12 included" + bottom border-t에 "**Not included:** international airfare · personal expenses · gratuities" (text-[12.5px] muted inline). Excluded grid 폐기. 카드 frame `bg-white + ring-slate-200/70 + shadow-card + inner top highlight` 신규 적용. | `TourIncludedSection.tsx:17-127` | §B-P5 4 + §B-P6 1+2+3+5+6 |
| **5.3** | **Pickup notes inline → per-row underlined "Details" link (note 있는 row만), default closed**. 닫힌 row hierarchy 유지: number badge (premium tier shadow) + name font-semibold + type uppercase muted eyebrow + time tabular-nums right. note 있는 row 우측에 underlined "Details" link (text-[var(--primary)]). 펼침 시 row 아래 small note card (bg-stone-50/70 + ring 미세 + Icon 동반). | `TourPickupDropoffSection.tsx:190-235` | §B-P5 4 + §B-P6 1+2+3+4 (icon prominence) |
| **5.4 ✅** | **Fit Best For 2-col grid 4-8 items → 첫 4 visible + 5+ 인 경우 "Show all X traveler types" underlined link** (conditional, 4 이하면 그대로). 4 visible item은 기존 grid 유지 — bg-slate-50 + ring + persona icon = §B-P6 통과. | `TourFitSection.tsx:91-110` | §B-P5 4 + §B-P6 1+2+3+4 |
| **5.5 ✅** | **Practical accordion 2-layer typography 강화** (component-level only — preview 데이터 copy는 memory rule "bulk content additive-only" 가드로 보류). title `font-bold/text-slate-900` → `font-semibold/text-foreground` (§B-P6 1 consistency); preview `text-[12px]/truncate/text-slate-500/leading-snug/mt-1` → `text-[12.5px]/line-clamp-2/text-muted-foreground/leading-relaxed/mt-0.5` (2-layer editorial 명확, 1줄 truncate → 2줄 line-clamp 더 많은 context); preview undefined 시 `<p>` conditional omit (empty whitespace gap 제거). | `TourPracticalDetails.tsx:347-356` | §B-P6 1 (typography hierarchy) |
| **5.6 ✅** | **Reviews summary prose 1줄 + Show all 버튼 prominence ↑**. (1) summary 카드 highlights 영역을 `flex inline` → `space-y-2`로 재구성, chips 위에 editorial prose 1줄 추가: `{rating}★ · {Based on N reviews} · {Guests mention} {top2highlights}` (기존 i18n 키 재활용 `reviewsBasedOnTemplate` + `reviewsGuestsMention`, hardcoded "★" + "·"는 universal symbol). prose typography `text-[12.5px] leading-relaxed text-muted-foreground` + rating는 `font-semibold text-foreground tabular-nums` accent. chips는 detail layer로 유지. (2) Show all 버튼 hierarchy: `text-sm/font-medium/border-border/py-3` → `text-[15px]/font-semibold/border-slate-200/80/py-3.5` + single shadow tier + `hover:-translate-y-[1px]` (§B-P6 5 micro-hover lift). aria-expanded 추가. | `TourReviewsSection.tsx:203-228, 246-261` | §B-P5 1+2 + §B-P6 1+5+6 |
| **5.7 ✅** | **Card material 통일 — Inner highlight + hover lift 누락 카드 보완**. Sprint 2.9 SEASON_THEME_SHARED 패턴을 4 카드에 일괄 적용: (1) AtAGlance outer card (rounded-2xl 변경 X) — `ring-1 ring-slate-200/70` 신규 + shadow tier upgrade `(0_4px_12px_-2px_rgba(0,0,0,0.055))` → `(0_4px_12px_-4px_rgba(15,23,42,0.10))` + inner top white/65 highlight gradient + transition + `hover:-translate-y-[1px] + shadow-elevated`. (2) Fit Best For outer card 동일. (3) Fit Route Logic outer card 동일. (4) Reviews summary card — bg-slate-50/70 유지 (Sprint 2.11 binding), shadow upgrade + inner highlight `from-white/55` (tinted bg에 어울리는 subtle alpha) + hover lift. **모든 카드 sibling div에 `relative` 추가** (stacking order — gradient `<span absolute>`는 default stacking에서 static siblings 위에 paint되므로 자식들이 `relative` 가져야 gradient 위에 표시). Included 5.2에서 이미 ✅. Booking Support Trust 3-grid 5.1에서 이미 ✅. | `TourAtAGlance.tsx`, `TourFitSection.tsx`, `TourReviewsSection.tsx` | §B-P6 3+5 |
| **5.8 (신규, conditional)** | **Section heading typography Apple/Airbnb 패턴 검토** — Sprint 3 + fe8eaba6에서 `.text-title` clamp 22-26 → 18-20px로 줄였음 (당시 "다 펼쳐서 복잡, density 회복"). Sprint 5.1-5.7로 정보 과밀 해소 후, Apple 제품 페이지 / Airbnb 호텔 페이지 section heading 패턴 (mobile 22-24px / desktop 26-30px font-bold tracking-tight) 복원 가능한지 측정. 측정 결과 vertical density 회복 충분하면 typography 복원 (단 user 명시적 confirm 후), 부족하면 18-20 유지 (§B-P4 정보 과밀 회피 우선). | `tour-product-v2-scope.css:.text-title` | §B-P6 1 (typography luxury hierarchy) — conditional reversal |
| **5.9 (신규) — Book-page cascade reveal pilot (§B-P11 reference 케이스 확립)** | **`TourBookingSupportSection.tsx` 6-step reveal에 §B-P11 7조건 적용** — 5.1에서 default closed + grid-rows 0.30s smooth로 끝낸 reveal을 *"촤르륵 펼쳐지는 책 페이지"* 모션으로 격상. 6 step = §B-P11 (3) "N 4-6 sweet spot" 정확히 적합 (stagger 60ms × 5 + per-child 480ms = 총 ~780ms < 900ms cap). **구현**: (a) scope CSS (`tour-product-v2-scope.css`)에 `.book-cascade` parent class + `@keyframes book-page-unfold` (translateY(-4px)+rotateX(-6deg)+opacity 0 → 0+0+1, `cubic-bezier(0.22, 1, 0.36, 1)` 480ms forwards) + `.book-cascade[data-state="open"] > *:nth-child(N)` 6개 stagger delay (`--book-stagger: 60ms`; nth-child(1)~(6) = 0/60/120/180/240/300ms). (b) parent에 `perspective: 1400px` + `transform-style: preserve-3d`. (c) `TourBookingSupportSection.tsx` step grid wrapper에 `.book-cascade` class + `data-state={showTimeline ? 'open' : 'closed'}` attribute. (d) container opening (grid-rows-[0fr→1fr])은 5.1의 기존 코드 그대로 유지 (§B-P5 (4) 그대로) — 단 duration 360ms (§6.4 deliberate)로 살짝 늘림 (children stagger와 자연스럽게 겹치도록). (e) `@media (prefers-reduced-motion: reduce) { .book-cascade > * { animation: none !important; opacity: 1 !important; transform: none !important; } .book-cascade { grid-template-rows: 1fr; } }` (a11y 강제). (f) `will-change: transform, opacity`는 reveal 시작 시점에만 적용, `animationend` 이벤트로 즉시 제거 — CSS `animation-fill-mode: forwards`로 최종 상태 유지 + JS는 단순 attribute 토글만. **JS 추가 logic 0 (기존 setShowTimeline state 그대로)**. shared utility hook 안 만듦 — CSS class + data-attribute pattern만, 사용처에서 className만 추가하면 동작. **검증**: (1) Chrome DevTools Performance 60fps mobile 390×844 + 412×915 (composite layer 확인, scroll-thread 깨끗), (2) DevTools Rendering tab "Emulate CSS media feature prefers-reduced-motion" 토글 → fade-only 동작 확인, (3) snapshot diff (정적 캡처) — §B-P5/P6 변경 0, (4) 5-locale (ko/en/ja/zh/zh-TW/es) 시각 동일 (style/motion only, copy 무변경), (5) §B-P3 shadow tier 단일성 유지 확인 (children에 새 tier 0), (6) typecheck clean. **확장 priority list (pilot 검증 통과 후 적용 순서)**: ①Sprint 5.2 Included "Show all X" (5+ items reveal, N 4-6 sweet spot 대부분 적합), ②Sprint 5.6 Reviews "Show all reviews" (4+ items), ③Sprint 5.4 Fit Best For "Show all X traveler types" (5-8 items), ④Sprint 5.3 Pickup per-row notes reveal (단일 child — N=1 fallback: stagger 0, per-child 480ms만 적용, "촤르륵" 인식 X but "종이 펴짐" 유지), ⑤Sprint 5.5 Practical FAQ accordion content (단일 block, N=1 fallback). | `components/product-tour-static/east-signature-nature-core/tour-product-v2-scope.css` + `TourBookingSupportSection.tsx` | §B-P5 4 + §B-P6 1+2+3+4+5+6 + §B-P11 7 (모두 통과 필수) |

**완료 기준 (Sprint 5 acceptance)**:
- 모바일 viewport (390×844)에서 *first scroll viewport ~3000px* 내 텍스트 덩어리 인식 없음 (사용자 직접 검증)
- 모든 2차 reveal에 **§B-P5 4조건** 통과 (미리보기 1줄 + underlined link + single shadow tier + smooth transition)
- 모든 2차 reveal에 **§B-P11 7조건** 통과 — 5.9 pilot 적용 후 확장 (book-page cascade easing/stagger/transform/duration cap/material 무변화/reduced-motion fallback/CSS-only)
- 모든 visible 카드에 **§B-P6 6조건** 통과 (typography 3+ layer + generous spacing + material depth with inner highlight + photo/icon prominence + micro-hover + editorial copy)
- 모바일 vertical scroll 총 height ≥ -15% 감소 (Booking Support 6-step closed + Excluded grid 폐기 효과)
- typecheck clean
- §B-P3 premium layout 손상 없음 (모든 카드 single shadow tier 유지, 5.9 reveal 모션 중에도 children에 새 shadow tier 0)
- 정보 단절 없음 — 닫힌 상태에서도 사용자가 "여기 X가 있다"는 사실 인식 가능
- **flat-cheap 검증**: 사용자 직접 검증 시 "미니멀이면서도 럭셔리" 인식 확인 (§B-P6 핵심 spec)
- **a11y reduced-motion 검증**: Chrome DevTools "Emulate prefers-reduced-motion: reduce" 토글 시 5.9 reveal이 fade-only로 강등 확인 (§B-P11 (7))
- **scroll-freeze 회귀 0**: Chrome DevTools Performance 모바일 throttle "Slow 4G + 4× CPU" 환경에서 5.9 reveal 작동 중 main thread scroll-thread frame drop 없음 (§6.8 가드)

**Anti-pattern (refuse)**:
- ❌ 큰 chevron button + bg-slate-100 wash로 reveal trigger (§B-P5 (2) 위반 = flat-cheap)
- ❌ 미리보기 없이 그냥 "Click to expand" 한 줄만 (§B-P5 (1) 위반 = 정보 단절)
- ❌ 닫힌 카드를 `bg-white + 1px ring + text` 만으로 (§B-P6 3 위반 = flat-cheap, material depth 없음)
- ❌ 카드 UI string utility-list ("3 items · A, B, C") — §B-P6 6 위반 = robotic copy
- ❌ Excluded 정보 자체 제거 (Sprint 5.2는 grid 폐기 + inline prose 유지, 제거 X)
- ❌ Fit Best For 전부 숨김 (Sprint 5.4는 첫 4 visible 유지, 6+ 인 경우만 truncate)
- ❌ 카드에 photo/icon 한 개도 없는 텍스트-only (§B-P6 4 위반 — minimum 1 icon)
- ❌ Sprint 3 binding 전면 reversal — 1차 visible 원칙은 유지, 단지 1차/2차 분류를 엄격화 + §B-P6 spec 추가
- ❌ 5.9 reveal에 framer-motion `<AnimatePresence>` 또는 신규 라이브러리 도입 (§6.8 + §B-P11 구현 가드 위반)
- ❌ 5.9 reveal에 IntersectionObserver per-child stagger (§6.8 layout read 가드 위반)
- ❌ 5.9 reveal에 spring/bounce overshoot, 꽃잎/petal cascade, 오리가미 multi-axis, rotateX>10deg, skew, rotateZ (§B-P11 anti-pattern 위반 = cheap-theatrical)
- ❌ 5.9 reveal에 reduced-motion fallback 누락 (§B-P11 (7) 자동 fail)
- ❌ 5.9 per-child shadow tier 변화 또는 backdrop blur 추가 (§B-P3 + §6.8 위반)

---

### Sprint 6+ — 장기 polish (보류, 분기별 검토)

- Interactive map (Mapbox/Google JS API) — 성능·비용 검토 후
- Dark mode (`prefers-color-scheme: dark`) — 분기별 우선순위 검토
- Reviews avatar fallback hash-based hue
- Loading skeleton + fade-in
- Focus ring 통일 (현재 4가지)
- Animation tempo 통일 (현재 0.18s / 0.20s / 0.24s / 0.28s / 0.30s / 0.35s / 0.40s / 0.46s / 0.58s / 0.78s)

---

## 4. 1차 플랜 vs Codex 리뷰 vs 통합 플랜 — 핵심 차이

| 영역 | Claude 1차 | Codex 리뷰 | **통합 (현재)** |
|---|---|---|---|
| **순서** | Phase 0 (토큰) → 1 (시각 13항목) → 2-3 | Phase A (CTA/drawer) → B (시스템) → C (콘텐츠) → D-F | **Sprint 1 (CTA) → 2 (토큰+색상) → 3 (콘텐츠) → 4 (Hero/Gallery)** |
| **Hero 크기** | 60vh 권장 | 60vh 반대 | **데스크탑 max 360 → 420 소폭 완화만** |
| **Radius 단계** | 3단계 (8/12/16) 기계적 | role-based 4단계 | **role-based 4단계 채택** |
| **Trust strip** | booking card 안으로 이동 | 위치 유지, 단색화 | **위치 유지, 단색화 + 반복 5회 → 2회** |
| **CTA 색** | brand primary | 찬성 | **유지** |
| **CTA + 가격 통합** | "Reserve · $X" 권장 | 찬성 (검토) | **강한 처방, sprint 1 필수** |
| **Hero overlay** | title + price + location + ★ 다 추가 | 다국어 QA 후 일부만 | **rating + location 만 시범, price/title 보류** |
| **Watermark** | 일괄 제거 | 정책 확인 후 | **lightbox 만 우선 제거, hero/gallery 정책 확인** |
| **At-A-Glance 색** | monochrome dots OR ★ OR progress | 무지개 제거 (대체안 미정) | **text pill (Easy/Moderate/Vigorous) 권장** |
| **Accordion** | 8개 → 2개 (FAQ + Practical) | FAQ + Practical만 | **동일 — 양보 X** |
| **색상 다이어트** | 17 → 3 + 상태 2 | 찬성 (accent 살리기) | **17 → 5 강제 (brand/accent/success/danger/neutral)** |
| **Type scale** | 6단계 정의 | 정의 권장 | **정의 + ESLint enforcement + PR template 가드** |
| **Interactive map** | Phase 3 권장 | Phase 3 이후 보류 | **Sprint 5+ 분기 검토** |
| **Dark mode** | Phase 3 권장 | 보류 | **Sprint 5+ 분기 검토** |
| **Scroll freeze 리스크** | 안 짚음 | 강조 | **모든 motion 추가 PR 에 명시적 체크 포함** |
| **다국어 QA** | 안 짚음 | 강조 | **CTA label / Hero overlay PR 에 5종 QA 필수** |
| **Phase 1 묶음** | 13항목 한 묶음 | 분리 권장 | **Sprint 1 = 6항목 (CTA계열만), 시각 시스템은 Sprint 2-4** |

---

## 5. 즉시 실행 Top 8 (Codex Top 7 + 1개 추가)

Codex의 Top 7 + 내가 추가하는 1개 (Reviews summary 가독성):

| # | 작업 | 리스크 | 임팩트 |
|---|---|---|---|
| 1 | `TourStickyBookingBar` drawer animation 0.78s → 0.30s | 거의 0 | 모바일 체감 큼 |
| 2 | Desktop + Mobile CTA `bg-foreground → bg-primary` | 낮음 | 브랜드성 +1단계 |
| 3 | CTA label 에 total price 통합 (다국어 QA) | 중간 | 의사결정 마찰 ↓ |
| 4 | Trust strip 3색 → emerald monochrome | 낮음 | 노이즈 ↓ |
| 5 | Subnav active pill → underline 2px brand | 낮음 | sticky 영역 가벼움 |
| 6 | At-A-Glance 6색 → text pill (Easy/Moderate/Vigorous) | 낮음 | 정보 명확성 ↑ |
| 7 | Included / Fit / Support accordion 부분 기본 노출 | 중간 | first-fold 정보량 +60% |
| 8 | **(추가)** Reviews summary 3% gradient → solid pale bg + verified badge 강화 | 낮음 | 사회적 증거 +1단계 |

**8번 추가 이유:** Reviews 는 컨버전 직전 마지막 신뢰 신호. 현재 summary card 의 그라데이션은 3% opacity 라 **사실상 안 보임** (있으나마나한 디테일). Verified 표시는 10px 회색으로 **신뢰 신호의 가장 약한 표현**. 이 둘은 컨버전 directly 영향, sprint 1 에 포함할 만한 가치.

---

## 6. Codex가 안 짚은 가드레일 (내가 추가)

### 6.1 토큰 enforcement 메커니즘

토큰 정의해도 안 쓰면 dead. 가드:

```
1. ESLint rule (custom): className 에 `text-\[\d+px\]` 매칭 시 warn
2. ESLint rule: className 에 `bg-\[#[0-9a-f]+\]` 매칭 시 warn (인라인 hex)
3. ESLint rule: style={{ background: ... }} 인라인 색상 warn
4. PR template: "신규 색·radius·shadow·font-size 추가됨? 토큰 사용?" 체크박스
5. design tokens 단일 파일: tour-product-v2-scope.css 가 single source of truth
```

### 6.2 Feature flag per section (선택적)

Sprint 2 의 11개 PR 을 한 번에 머지하지 않고 환경변수로 켜고 끄기:

```
TOUR_DETAIL_V3_HERO=on
TOUR_DETAIL_V3_PICKUP=on
TOUR_DETAIL_V3_INCLUDED=off
...
```

→ 어떤 섹션이 컨버전에 영향을 주는지 분리 측정. 문제 발견 시 섹션 단위 즉시 롤백.

### 6.3 다국어 LCP 회귀 측정

특히 Hero overlay / CTA label 변경 PR 은:

```
- 5종 언어 (ko, en, ja, zh, es) LCP 측정
- 가장 긴 텍스트 케이스 시뮬레이션 (독일어가 없지만, 일본어 + 중문 한자 폭)
- text-balance + line-clamp 가 의도대로 작동하는지 시각 회귀
```

### 6.4 Animation tempo 통일 (Sprint 5+)

현재 페이지 transition duration 10가지 (0.18, 0.20, 0.24, 0.28, 0.30, 0.35, 0.40, 0.46, 0.58, 0.78s). Sprint 5+ 에 4-step scale 로 정리:

```
quick:    150ms   (hover, active)
default:  240ms   (toggle, accordion)
deliberate: 360ms (drawer, modal)
slow:     520ms   (hero crossfade, lightbox)
```

---

## 7. 한 줄 결론

**Codex의 안전 우선 순서는 채택한다. 디자인 시스템 통일의 강도는 양보하지 않는다.**

- 1차 플랜의 **진단(diagnosis)** 은 그대로.
- 1차 플랜의 **순서(sequence)** 는 Codex의 conversion-first 로 교체.
- 1차 플랜의 **Hero 60vh, 8/12/16 radius, trust strip 제거** 는 철회.
- 색상 다이어트, accordion 다이어트, CTA 다이어트는 **양보 X**.
- 모든 변경 PR 에 다국어 QA + 컨버전 회귀 측정 + 스크롤 freeze 체크 가드 추가.

가장 좋은 첫 PR (Sprint 1):

```
title: feat(tour-product): conversion-safe booking improvements

scope:
- drawer animation 0.78s → 0.30s
- desktop + mobile CTA bg-foreground → bg-primary
- CTA label에 total price 통합 (5종 다국어 QA)
- booking card pricing-tier 본문 중복 제거
- free cancellation 반복 5회 → 2회
- drawer drag handle + swipe-down dismiss

risk: 낮음 — 시각 시스템 변경 없음, 컨버전 흐름 측정 가능
```

이 PR 머지 + 1주 모니터링 후 Sprint 2 (토큰 + 색상 다이어트) 진입.

---

## 부록: 의사결정 매트릭스

각 항목의 "내가 더 강하게" vs "Codex 가 옳음" 정리:

| 항목 | Codex 우세 | 내가 우세 | 동률 |
|---|---|---|---|
| Phase 1 묶음 분리 | O | | |
| Hero 60vh 보류 | O | | |
| Radius role-based scale | O | | |
| Trust strip 위치 유지 | O | | |
| Scroll freeze 리스크 강조 | O | | |
| 다국어 QA 가드 | O | | |
| Watermark 정책 검토 | O | | |
| 색상 다이어트 강도 | | O | |
| Type scale enforcement | | O | |
| CTA + 가격 통합 강도 | | O | |
| Accordion 2개 축소 강도 | | O | |
| At-A-Glance 대체안 (text pill) | | O | |
| Reviews summary 가독성 추가 | | O | |
| Booking pricing tier 중복 제거 | | | O |
| Drawer animation 단축 | | | O |
| 토큰 정의 자체 | | | O |

총평: Codex 7 / Claude 6 / 동률 3 → 둘 다 비슷한 비중. 좋은 페어 리뷰.

---

## §8 세계최고 디자이너 audit — 섹션별 픽셀 단위 review (2026-05-18)

> User 요청 (2026-05-18): "Apple, Airbnb, Klook 등 글로벌 사이트들과의 거리, 업그레이드 방법, 방향을 한 섹션씩 픽셀 단위로 review." 16 section + TourStopDetailDrawer 모두 커버. **§B-P1 binding 하에 — 모든 권고는 premium up 방향, downgrade 절대 금지.**

### §8.0 한 줄 입장

> "좋은 데이터 + 좋은 사진 + 좋은 의도가 있는데, 시각 언어가 사방으로 흩어져 있어서 페이지가 자기 자신과 싸우고 있다." Apple/Airbnb/Klook 대비 가장 큰 거리는 "어떤 색이 뭘 의미하는지" **시스템이 부재**한다는 것. 픽셀 디테일은 의외로 정성스러운데, 디테일의 모음이 한 페이지 안에서 **7개 디자이너가 따로 작업한 느낌**을 줌.

**글로벌 기준 대비:**
- **Airbnb 숙소 상세**: 자기-억제(self-restraint)가 미덕. 하나의 brand color (rose-500), 80% monochrome, **사진이 감정을 담당**.
- **Apple 제품 페이지**: 흰 배경 + 검은 텍스트 + 1 accent. 색이 product를 leak 못하게 막음.
- **Klook 투어 상세**: 브랜드 orange를 CTA 1군데에만 사용, 나머지는 ink/sub-text grey.
- **atockorea 투어 상세 (현재)**: 한 화면 안에 17색 (rose, copper, amber, emerald, orange, violet, sky, ...). "여행 = 감정 = 색"이라는 **잘못된 가정**.

> **§B-P1 가드 인지**: 색을 줄이는 권고 = monochrome으로 가난해지자는 게 아님. Apple/Hermès 디자인 = 색이 적기 때문에 **typography·spacing·photo·material**의 가중치가 올라가서 premium함. 색을 뺀 자리에 **더 정확한 시각 가중치**가 들어가야 함.

### §8.1 Hero Section (`TourHeroSection.tsx`)

**보이는 것**:
- L108: `h-[29vh] max-h-[360px] rounded-b-2xl shadow-hero` — 모바일 29vh
- L161-169: Region eyebrow `rose-400 dot + rose-300 gradient line + rose-600 text 10px`
- L172-178: H1 `text-[19px] sm:text-[22px] lg:text-[24px]`
- L180-191: Pills — **rose 그라데이션 + rose ring + rose shadow 3중**
- L193-234: 메타 strip — rose-200 border / divider, rose-500 아이콘 × 2, Star **copper #C8956C**

**진단**:
1. **색이 5가지 다른 의미로 분산** — Region(rose-600), Pills(rose-300/400), Clock(rose-500/80), Star(copper), Border(rose-200). rose가 4역할 + copper 별개.
2. **Pills의 3중 효과 (gradient + ring + shadow)** — Airbnb pill: ring 1줄, 끝.
3. **Region eyebrow dot + gradient line + text 3-piece** — Apple eyebrow: 단순 텍스트 1줄.
4. **Star copper #C8956C** vs 다른 별(reviews/recommendations) amber-500 — 별 universal amber 통일 (Sprint 4 binding 동의).
5. **rounded-b-2xl + shadow-hero** — 글로벌 기준: edge-to-edge full bleed (Sprint 4 binding 동의).

**업그레이드 방향 (premium up):**
- Hero pill `gradient + ring + shadow` 3중 → **flat ring-1 + 무광 white + 좀 더 큰 padding (px-3.5 py-1.5)** — 절제로 premium UP
- Region eyebrow 3-piece → **text-only eyebrow** + 위/아래 spacing 늘림 (premium은 breathing room)
- Clock/Footprints rose → slate-700 + 아이콘 strokeWidth 1.5 (얇아짐 = premium)
- Star copper → amber-500 + size ↑ (h-3 → h-3.5)
- Hero edge-to-edge + shadow-hero 제거 + 사진 위 더 큰 dynamic range (가벼운 vignette gradient bottom)

### §8.2 AtAGlance (`TourAtAGlance.tsx`)

**보이는 것**:
- L6-13: `ROW_ACCENT_COLORS = [emerald, amber, orange, rose, violet, sky]` — **6색 무지개**
- L36: `rounded-[26px]` — 마법의 숫자
- L64-77: 5단계 progress dots, 같은 색

**진단**:
1. **6색 무지개는 페이지에서 가장 명확한 디자인 실수.** 색은 의미가 있을 때만 색. Cycling color = decoration as data lie.
2. **`rounded-[26px]`** — role-based scale 위반 (§B §1.3). Body card는 12-16.

**업그레이드 방향 (premium up):**
- 6색 dot → **text pill** "Easy / Moderate / Vigorous" (Sprint 3 binding 동의)
- Pill 디자인: `text-[11.5px] font-bold tracking-wide bg-slate-50 text-slate-900 ring-1 ring-slate-200 px-2.5 py-1` — **모노톤이지만 typography weight + tracking으로 premium 인지**
- `rounded-[26px]` → `rounded-2xl` (16px)
- Section heading + subtitle 위계 강화: heading text-h2 (단일 token), subtitle muted-foreground

### §8.3 Atmosphere Gallery (`TourAtmosphereGallery.tsx`)

**보이는 것**:
- L104: bento — `bg-[#e8e2d9] p-1.5 + gap 4px` cream gutter
- Lightbox: `bg-[#1A2332/96]`, nav hover `bg/25%`

**진단**:
1. **Cream gutter `#e8e2d9`** — "1990년대 갤러리". Airbnb/Klook/Apple Photos = 흰색 1-2px 또는 0 gap.
2. **gap 4px 너무 두꺼움.**
3. **Lightbox bg slate-blue 96%** — 사진 main attraction일 때 배경은 disappear해야 = **순수 검은색**.
4. **Bento 구조 자체는 좋음** (2×2 hero + 1×2 column). 비율 OK.

**업그레이드 방향 (premium up):**
- `bg-[#e8e2d9] p-1.5 + gap-4px` → **bg-white p-0 + gap-1.5px** (또는 완전 edge-to-edge `gap-0`)
- Lightbox bg → **bg-black** (Sprint 4 binding 동의)
- Lightbox nav hover → bg/85% (가시성 ↑)
- Bento 사진 위 hover 시 **scale 1.02 + 100ms ease-out** (premium magazine 느낌)
- Caption은 hover 시에만 fade-up (Apple Photos 패턴)

### §8.4 Day Flow (`TourDayFlowSection.tsx`)

**보이는 것**:
- L44-49: 48×48 round photo + 3중 shadow + ring-slate-900/[0.08]
- L68-72: 11.5px name + 10.5px theme
- L76-80: connector = 3-dot 점점점

**진단**:
1. **48px round photo는 너무 작음** — V2 빌더 게이트에서 검증, 56-64px 임계점.
2. **3-dot connector** — 방향성 부재. Klook/Airbnb timeline = arrow icon.
3. **3중 shadow + ring** = 작은 사진에 과한 디테일.

**업그레이드 방향 (premium up, Sprint 4 binding 동의):**
- 48 → **80px** round photo (Apple/Klook 표준)
- 3중 shadow → **1중 elevated shadow** (단일 elevation tier)
- Ring 제거 → 사진 자체가 main, ring은 unnecessary frame
- 3-dot → **ArrowRight 아이콘** (Lucide, strokeWidth 1.5) + 양쪽 가는 fade
- name 11.5px → **13px font-bold tracking-tight** + theme 11px text-muted-foreground (위계 명확)

### §8.5 Timeline Stop Card (`TourTimelineSection.tsx`)

**보이는 것**:
- L54-62: 번호 원 02 — h-9 흰 배경 + multi-shadow + slate-400
- L80-103: 80×56 photo strip 가로 carousel **카드 안에**
- L119-122: category 10px text-slate-400 — 거의 안 보임

**진단**:
1. **80×56 photo strip carousel + Card 클릭** = 2개 인터랙션 zone 충돌.
2. **번호 02 흰 원 + slate-400** — Apple/Airbnb timeline = single solid color (slate-900 또는 brand) + 흰 number.
3. **Category 10px slate-400** — 정보 있어도 못 읽음. Klook = 13-14px slate-700.
4. **점선 connector `from-slate-200/40 to-transparent`** — fade-out으로 시퀀스 끝이 모호.

**업그레이드 방향 (premium up, Sprint 4 binding 동의):**
- Photo strip carousel → **1장 cover 16:9 풀너비** (편집 격 1단계 UP)
- 번호 02 흰 원 → **slate-900 원 + 흰 02** OR **amber-500 시퀀스** (itinerary-builder V2와 통일)
- Category 10px slate-400 → **eyebrow-style amber-700 12.5px** (premium up: monochrome 아니라 *의미 있는 색*)
- Connector fade → **solid dashed amber-300 1px** (V2 정책 통일)

### §8.6 TourStopDetailDrawer — 사용자가 픽셀 단위 요청

**Hero 영역 (L656-722):**
- 4개 floating elements (Number / Photo counter / Close / Duration) — 224px hero에 과다
- Close `bg-white/15 backdrop-blur-md` — 사진 위 거의 안 보임
- Photo counter `right-16 top-4` close 옆 — Apple Photos / Klook = bottom-center 또는 top-center 표준

**Photo selector strip (L726-763):**
- Active: `ring-2 + ring-offset-2 + shadow + -translate-y-0.5` — 3가지 시각 효과 동시
- Inactive hover scale 1.05 vs active scale 1.04 — active < hover (직관 위반)
- `h-16 w-24` 좁음 — Airbnb 갤러리 썸넬 80×56 또는 96×64

**Body Header (L767-784):**
- H2 stop name `text-xl` (20px) — modal hero에서 24-28px가 표준
- Category badge `bg-muted/80 px-2.5 py-0.5 text-[10.5px]` — Klook = 14px slate-700 텍스트
- Time/duration row text-xs muted — 너무 약함

**Highlights (L787-844):**
- Bullet `bg-accent` (copper) — Hero star도 copper, bullet도 copper, **의미 없는 분산**
- "Full description" pill `bg-primary/[0.08] + BookOpen + 10.5px primary` — 버튼 디테일 과함
- Heading 10.5px uppercase tracking 0.12em — eyebrow spec이 페이지에서 또 다른 변형

**Practical accordion (L437-495):**
- Chevron open state `bg-foreground text-white shadow-md` — 1개 열림이 그렇게 dramatic해야 하나
- 2 shadow tier (`shadow-premium` vs `shadow-premium-elevated`) 동시 운영 = 카드 자체가 premium-feel 메시지를 3가지 방법으로 송신 (자기 자랑)

**업그레이드 방향 (premium up):**

```
✗ Hero 4 floating elements
✓ Number + Close 2개만 + Duration은 body header로 이동
   (Apple Photos / Airbnb listing modal 패턴)

✗ Close bg-white/15 backdrop-blur-md
✓ bg-white/95 + text-slate-900 (가시성 = 사용성, 사용성도 premium)

✗ Photo counter top-right next to close
✓ Bottom-center "1/8" 또는 top-center
   (Apple Photos 패턴)

✗ Photo selector ring-2 + ring-offset + shadow + translate 4중
✓ ring-2 ring-brand + 약한 scale 1.02 + 동일 elevation
   (Apple Photos active = 최소한의 차이로 maximum 인지)

✗ Stop name 20px
✓ 24-26px font-semibold tracking-tight
   (modal hero에서 typography가 voice — premium은 큰 글자)

✗ Category bg-muted px-2.5 py-0.5 text-10.5px badge
✓ text-[12.5px] eyebrow text-amber-700 uppercase tracking-wide
   (badge UI 폐기 → 텍스트 위계로 — Apple/Klook 패턴)

✗ Bullet bg-accent (copper)
✓ bg-amber-500 (단일 brand identity color, V2 itinerary-builder와 통일)

✗ "Full description" pill button with icon
✓ Underlined text-link "Read full description →" 
   (Klook 패턴 — 사이드 텍스트 링크, UI noise 0)

✗ Practical accordion open: bg-foreground chevron, 2 shadow tier
✓ chevron 회전만 + 단일 shadow tier
   (Hermès UI: state change는 가장 작은 신호로)
```

### §8.7 Pickup/Dropoff (`TourPickupDropoffSection.tsx`)

**진단**: Copper marker (#C8956C) 정책 — copper gradient carrier 폐기 (§B §2.1). **Google static map marker도 copper → slate-900 (pickup) + slate-500 (dropoff)** 으로 통일.

**업그레이드 방향**: 흰 카드 + slate text + slate-900 marker icon (geographic clarity). 색은 0개에서 1개로 *추가*되는 게 premium, 5개에서 1개로 *줄어드는* 것도 premium — 핵심은 의미.

### §8.8 Included Section (`TourIncludedSection.tsx`)

**진단**:
1. **2개 다른 emerald tint** (`#f6fcf8` accordion bg, `#f0faf4` inner panel) = 디자이너 결정 부재
2. **Emerald wash 전체** — medical UI 느낌. Klook included = 흰 카드 + emerald checkmark만
3. **accordion 닫힘 default** — critical info hiding (§B §2.3 binding으로 폐기)

**업그레이드 방향 (premium up):**
- 흰 카드 + emerald-600 Check 아이콘 only (색 의미: 검증된 포함)
- "5개 always visible + Show all link" 패턴 (Klook 표준)
- excluded 항목: rose-500 X 아이콘 (semantic only, 카드 전체에 색 없음)

### §8.9 Fit (`TourFitSection.tsx`)

**업그레이드**: amber/copper bg → 흰 카드 + 2-col flat (Best left / Less ideal right). 3중 nested accordion 폐기 (§B binding). **Premium**은 *fewer click required* 통해 표현됨.

### §8.10 Practical (`TourPracticalDetails.tsx`)

**진단**: weather 4-layer gradient (bank UI 수준), seasonal 4계절 4색.
**업그레이드**: 1 row + season icon (색은 icon에만, 카드 전체는 white). Apple weather strip 패턴.

### §8.11 Booking Support (`TourBookingSupportSection.tsx`)

**진단**: 5색 trust + 6색 steps = 11색.
**업그레이드**: 1색 + horizontal timeline mini (Apple Card 패턴) + 단일 elevation.

### §8.12 Reviews (`TourReviewsSection.tsx`)

**진단**: 3% opacity gradient = invisible ghost. Verified 10px 회색 = 신뢰의 가장 약한 표현.
**업그레이드 (premium up)**:
- **Airbnb-style 통합 헤더**: "9.7 · 12,453 reviews · 4.9 ★" 한 줄, font-size 28-32px
- 분류 카테고리 (Communication / Value / Cleanliness 등) **시각 bar with brand color** (단일 색, 의미 있는 색)
- Verified 표시 → **emerald check + 14px 정성 텍스트** (사회적 증거 ↑)

### §8.13 Recommendations (`TourRecommendationsSection.tsx`)

**진단**: 2-layer dark gradient 너무 무거움.
**업그레이드**: 사진 그대로 + Title slide-up on hover (Klook 패턴) + 1-color price chip.

### §8.14 FAQ (`TourFaqSection.tsx`)

**진단**: 유지 (Sprint 3 binding).
**업그레이드**: chevron container dramatic open state 제거 (Practical과 동일 정책).

### §8.15 Tabs Nav (`TourTabsNav.tsx`)

**업그레이드 (Sprint 3 binding)**: pill active → **underline 2px brand color** (Apple TabBar 패턴) + 양쪽 fade + IntersectionObserver top-most 정렬.

### §8.16 Desktop Booking Card + Sticky Bar

**업그레이드 (Sprint 1 binding)**: CTA `bg-foreground → bg-primary`, "Reserve · $1,247 total" 통합, drawer 0.30s, drag handle + swipe-down dismiss.

### §8.17 페이지 전체 anti-pattern 정리

1. **Radius 5종 혼용** (`rounded-[26px]`, `[20px]`, `xl`, `2xl`, `md`) → role-based 4종 (§B §1.3)
2. **`text-[10.5/11.5/12.5/13.5]px` 0.5px granularity** → 6-step type scale 정의 + ESLint 강제 (§B §2.2)
3. **Shadow 6-layer ad-hoc 정의** → 3-tier role-based (flat / elevated / deep)
4. **opacity scaler 7-8개** (`/[0.06]`, `/[0.08]`, `/30`, `/85` ...) → 정의된 step 2-3개
5. **Eyebrow class 10가지 spec** → 단일 `.eyebrow` utility
6. **Icon strokeWidth 1.8 / 2 / 2.25 혼용** → 단일 strokeWidth
7. **transition duration 10가지** (0.18 ~ 0.78) → 4-step scale (Sprint 5+, §6.4)

### §8.18 글로벌 격차 한 줄

| 기준 | 현재 (10점) | Sprint 1-4 완료 후 |
|---|---|---|
| 색상 시스템 | 3 | 8 |
| 타이포 위계 | 4 | 7 |
| Shadow/Elevation | 5 | 7 |
| Radius scale | 4 | 8 |
| Information hierarchy | 5 | 8 |
| 사진 처리 (gallery/drawer) | 6 | 8 |
| 컴포넌트 발견성 | 4 | 8 |
| CTA 통일성 | 5 | 9 |
| **종합** | **B-** | **A-** |

### §8.19 §B-P1 적용 self-check 표

§B-P1 binding ("premium up only, never downgrade")에 위 권고가 위배되지 않는지 self-check:

| 권고 | "더 premium" 으로 읽히는 근거 | downgrade 위험? |
|---|---|---|
| Hero rose 분산 제거 | typography hierarchy + photo가 메인 (Airbnb pattern) | 없음 — 색이 줄어도 위계 정확성 ↑ |
| Gallery cream gutter → white | Apple Photos / Klook 글로벌 표준 | 없음 — 매거진 spread 느낌 ↑ |
| At-A-Glance 6색 → text pill | typography weight + tracking → premium typography | 있음 — *단색 fade 처리하면 cheaper로 읽힘*. 권고: pill의 ring 1px + slate-900 text는 mute가 아니라 *editorial weight* |
| Bullet copper → amber 단일 | identity color 일관 → premium discipline | 없음 — 별 + bullet + ribbon 모두 같은 amber → 시스템 |
| Photo 48 → 80px | 사진 = main → 사진을 더 크게 = 더 premium | 없음 — Klook/Apple 표준 |
| Accordion 폐기 → 펼침 | "숨김"은 cheap, "정성 노출"이 premium | 없음 — first-fold +60% 정보 |
| Practical 4-layer gradient → 1 row | bank UI 그라데이션 = cheap 정성, 통일된 typography = premium | 있음 — 권고: row가 *minimal*이 아니라 *editorial precise* (Apple weather 패턴) |
| Chevron `bg-foreground` open state 제거 | Hermès UI = state change 최소 신호 = 우아함 | 없음 — drama 제거 = premium |
| Drawer Close bg-white/15 → white/95 | usability ↑ = premium experience | 없음 — UI invisible은 cheap, **usable + invisible**이 premium |
| Stop name 20 → 24-26px | modal hero typography weight = premium | 없음 — Airbnb 30px+ |

**자체 검증 결과**: 모든 권고가 §B-P1 binding 통과. 단 2가지 (At-A-Glance text pill, Practical 1 row)는 *실행할 때 특히 typography weight + spacing이 premium editorial 격이도록* 주의 필요.

### §8.20 권고 → Sprint 매핑

§8 audit의 모든 권고가 §3 Sprint 1-4 안에 들어가는지 확인:

- Sprint 1: §8.16 (Booking card / sticky bar / drawer 속도)
- Sprint 2: §8.1 / §8.7 / §8.8 / §8.9 / §8.10 / §8.11 / §8.12 (색상 다이어트)
- Sprint 3: §8.2 / §8.6 (drawer 일부) / §8.14 / §8.15 (콘텐츠 + accordion + tabs)
- Sprint 4: §8.3 / §8.4 / §8.5 / §8.13 (Hero / Gallery / Day Flow / Stop card / Recommendations)
- §8.17 anti-pattern: Sprint 2 (token enforcement) + Sprint 5+ (animation tempo)

신규 항목 없음 — 모두 기존 Sprint scope 안. 추가 §C 변경 로그 1줄 + §A 대시보드 진행 추적만 하면 됨.

---
