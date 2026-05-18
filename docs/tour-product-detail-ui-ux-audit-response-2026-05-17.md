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
| Sprint 3 (콘텐츠 접근성) | ✅ (9/9 + acceptance 통과) | 2026-05-18 | 2026-05-18 | 51d586ac |
| Sprint 4 (Hero / Gallery) | ⏳ | — | — | — |
| Sprint 5+ (장기 polish) | 📦 | — | — | — |

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
| 2026-05-18 | Sprint 3 ✅ — 9/9 + acceptance 통과 | 29e42cde | accordion 8→2 binding 달성 (Pickup/Included/Fit Best+Less+Route/Support 5 폐기). eyebrow 10→1 spec. section heading 12 통일. At-A-Glance 6색 text pill. Subnav underline + 양쪽 fade + IO top-most. |

## §D 보류 / parked

| 항목 | 이유 | 재검토 시점 |
|---|---|---|
| Hero overlay (title + price) | 다국어 폭 측정 필요, LCP 회귀 위험 | Sprint 4 acceptance 후 |
| Hero/Gallery watermark 일괄 제거 | 정책팀 컨펌 대기 | 정책 확정 후 |
| Interactive map (Mapbox/Google JS) | 성능·비용·scroll-freeze 가드 충돌 가능 | Sprint 5+ |
| Dark mode | app-shell-uiux 트랙과 통합 검토 | app-shell Sprint 진행 시 |
| Reviews avatar hash-based hue | Sprint 5+ polish | 분기별 |
| Loading skeleton 통일 | Sprint 5+ | 분기별 |
| Focus ring 통일 (현재 4가지) | Sprint 5+ | 분기별 |
| Animation tempo 4-step scale 통일 | Sprint 5+ | 분기별 |
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
| Hero autoplay 6.5s → OFF, dot 인디케이터 + swipe만 | 즉시 |
| Hero `max-h-[360px]` → `max-h-[420px]` (데스크탑만), 모바일 유지 | QA 후 |
| Hero `rounded-b-2xl` 제거, edge-to-edge | 즉시 |
| Hero `shadow-hero` 제거 | 즉시 |
| Hero pill 그라데이션 + ring + shadow 3중 → flat chip | 즉시 |
| Save heart active state: rose-500 → brand red 통일 | 즉시 |
| Hero overlay (location + ★) — 다국어 QA 후 결정 | 보류 |
| Gallery cream gutter `#e8e2d9` → `#ffffff`, gap 4 → 2 | 즉시 |
| Gallery 썸네일 strip 제거 (collage 와 중복) | 즉시 |
| Lightbox bg `#1A2332/96` → `#000` | 즉시 |
| Lightbox 좌우 nav arrow: hover bg 25% → 85% | 즉시 |
| Lightbox watermark — 정책 확인 후 제거 | 보류 |
| Recommendations 사진 위 2-layer dark gradient → 약하게 (20%) | 즉시 |
| Day flow chip 48 → 80px photo | 즉시 |
| Day flow dot connector 3×3px → arrow icon | 즉시 |
| Stop card 사진 strip → 1장 cover (16:9 풀너비) | 중간 |

**완료 기준:** Hero/gallery 시각 회귀 0, 다국어 5종 LCP 회귀 없음, 모바일 스크롤 freeze 재발 없음.

---

### Sprint 5+ — 장기 polish (보류, 분기별 검토)

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
