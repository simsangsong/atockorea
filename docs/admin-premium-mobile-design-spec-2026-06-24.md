# AtoC Korea 어드민 — 프리미엄 모바일 SaaS 설계 스펙 (2026-06-24)

> **위치:** 이 문서는 `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md` **§U의 실행 상세(buildable spec)**. 마스터 플랜이 SoT·결정·WBS이고, 이 문서는 그 위의 컴포넌트/토큰/청사진 구현 디테일. 6개 설계 에이전트(IA·인터랙션·가독성·폼/머니·디자인시스템·페이지청사진) 결과를 통합. **사용 절반+이 모바일 → 모바일 우선.** 벤치마크: Linear · Stripe Dashboard · Vercel · Notion · Mercury.
> **원칙:** 신규 의존성 0 — 전부 기존 자산 위에. tailwind 토큰(`tailwind.config.js`), `globals.css` oklch 토큰, `components/ui/*`(16), `components/mypage/ConfirmDialog`, framer-motion, sonner.

---

## 1. 프리미엄 "필" — 원칙 → 구체 규칙
프리미엄은 *더하는 것*이 아니라 *절제*다. 현재 어드민과 Linear/Stripe의 격차 = 기능이 아니라 **밀도 통제·타입 규율·경쟁하는 결정의 부재**.
1. **간격 리듬 하나** — `4/6/8/12`(16/24/32/48px)만. 카드 내부 패딩은 `p-5`(20px) 단일. 섹션 간 `space-y-6`. `p-3`·`gap-3`·`space-y-5` 금지.
2. **surface 3층** — `--admin-bg`(캔버스)·`--admin-surface`(카드)·`--admin-surface-raised`(시트/팝오버). `bg-gray-50`/raw hex `#eef2f7`(layout.tsx:301) 제거.
3. **elevation 2티어, soft·layered** — `--shadow-admin-card`(=globals `--shadow-1`)·`--shadow-admin-float`(=`--shadow-2`). `shadow-xl/2xl` 금지(사이드바 `shadow-2xl`→float).
4. **color calm** — chrome accent = `brand.blue`(#1E4EDF) 단일, 나머지 chrome는 `slate-*`. status색(success/warning/error)은 **데이터에만**, affordance에 금지. export 버튼 `variant=outline`.
5. **타입 정밀** — 4 역할(아래 §5). 본문 굵게 금지(테이블 primary 컬럼 제외). 콘텐츠 16px 패딩 안에서 `text-2xl` 헤더 금지.
6. **border 통일** — 내부 보더 전부 `border-slate-200`(=`--border`). `/60`·`/80` opacity 금지(스크린별 안티앨리어싱 더러움).

---

## 2. 디자인 토큰 (확정 — `globals.css @layer base`에 `--admin-*` 추가)
| 토큰 | Light | Dark(navy-tinted) | 대체 대상 |
|---|---|---|---|
| `--admin-bg` | `oklch(0.965 0.003 240)` | `oklch(0.115 0.010 250)` | `#eef2f7` |
| `--admin-surface` | `oklch(1 0 0)` | `oklch(0.158 0.010 250)` | `bg-white` 카드 |
| `--admin-surface-hover` | `oklch(0.982 0 0)` | `oklch(0.185 0.010 250)` | `hover:bg-slate-50` |
| `--admin-surface-raised` | `oklch(1 0 0)` | `oklch(0.195 0.012 250)` | 시트/팝오버 |
| `--admin-border` | `oklch(0.922 0 0)` | `oklch(1 0 0 /9%)` | gray-200/slate-200/80 |
| `--admin-border-strong` | `oklch(0.870 0 0)` | `oklch(1 0 0 /16%)` | 테이블 헤더 보더 |
- **shadow:** `--shadow-admin-card`=`--shadow-1` / `--shadow-admin-float`=`--shadow-2` / `--shadow-admin-popover`=`--shadow-3`.
- **radius:** 카드 `rounded-design-md`(12px, *16px `rounded-xl`에서 하향* — 밀도에 16px은 toy같음) / 버튼·입력 `rounded-design-sm`(8px) / 배지 `rounded`(6px).
- **tabular-nums:** `.admin-root`에 `font-feature-settings:"tnum" 1,"kern" 1` — 금액·카운트·ID 정렬(최고 ROI 타이포 1줄).
- **다크모드:** `darkMode:'class'` 이미 활성. navy chroma(`0.010`)가 "프리미엄 다크" 신호(순수 회색=generic). status 배지 다크 변형 oklch 별도. focus ring: light `ring-brand-blue/60`, dark `ring-blue-400/60`(consumer amber와 분리한 `admin-focus-ring`).

---

## 3. 모바일 IA · 내비 · 페이지 크롬
### 3.1 바텀 내비 5슬롯 (현 4슬롯 `layout.tsx:59` 대체)
1 홈(`/admin`) · 2 주문(`/admin/orders`) · 3 **수신함**(contacts+support 통합 `/admin/inbox`, 미처리 unread dot) · 4 챗봇분석 · 5 더보기.
- **더보기 시트 그룹핑:** Operations(상품·업체·업로드) / Content(CMS·POI) / **Intelligence(데이터분석·QA리뷰 ← 현재 nav 부재)** / System(이메일·설정). merchants는 저빈도 셋업 → More로 강등.
- **글로벌 검색:** 헤더 우측 `⌕` → 바텀 검색 시트(autofocus + `adminMenuItems` 퍼지필터 + `/api/admin/search?q=` 주문ref/이름/예약ID + 최근5 localStorage). 데스크톱은 ⌘K.
### 3.2 `AdminPageShell` 공통 크롬 계약 (12개 무반응형 페이지가 1줄로 패리티)
4층: ① sticky 헤더(`min-h-[52px] pt-[env(safe-area-inset-top)]` ← **현재 누락**, back·title·search·primaryAction, 아이콘 44px) ② 필터칩 바(`sticky top-[52px] overflow-x-auto`) ③ 스크롤 main(`pb-[calc(4rem+env(safe-area-inset-bottom))]`) ④ sticky 액션 푸터(옵션). 리스트 루트=back 없음(홈 탭이 앵커), 상세=`backHref`. 필터상태 URL 영속.
### 3.3 thumb-zone
하단 40%(easy): 바텀내비·FAB(`bottom-[calc(4.75rem+safe-area)]`)·full-width sticky CTA. 중앙 30%: 필터칩·카드내 토글·페이지네이션. 상단 30%(hard): back·title·search+액션1개 — **파괴적 액션 배치 금지**(확인 시트 경유). export는 `…` 오버플로로.
### 3.4 우선순위 P1-P6
P1 support·QA를 nav에 추가(Intelligence) · P2 contacts+support→수신함 탭 · P3 헤더 터치타깃 44px(`size-9`/`h-8`→`min-h-11`) · P4 `pt-[env(safe-area-inset-top)]` · P5 `AdminPageShell`로 12페이지 일괄 · P6 헤더 검색 시트.

---

## 4. 인터랙션 · 피드백 시스템 (신규 의존성 0)
### 4.1 시트 vs 풀페이지
바텀시트(`components/ui/sheet` side=bottom, **`max-h-[90dvh] overflow-y-auto rounded-t-2xl` 추가 필수**): 주문/문의 상세·필터·정산 액션·QA 편집. 풀페이지: support 답장(긴 입력)·머천트 생성(필드 多). 확인=`ConfirmDialog`(중앙). 시트 헤더에 드래그 핸들(`w-9 h-1 rounded-full bg-slate-200 mx-auto`).
### 4.2 SwipeRow (framer-motion `drag="x"`, 1 재사용 컴포넌트)
행당 액션 ≤3. 주문: ←[확인/취소] →[보기]. 인박스: ←[읽음/해결] →[보기]. QA: ←거부 →승인(키보드 T/F 대체). threshold 72px 표시·120px 자동발화 + `haptic('light')`. 스프링 복귀(stiffness 500/damping 40).
### 4.3 낙관적 + Undo (비-Stripe 전부)
즉시 패치+`haptic`→toast(**Undo 5초**, 소프트 롤백)→백그라운드 API(실패 시 silent 롤백+error toast). **재fetch 시 stale 유지**(`refreshing` 별도 boolean + 상단 슬림 progress bar, 리스트 미교체) — 현 `setLoading(true)`가 리스트 전체를 스피너로 교체(`orders/page.tsx:53`)하는 게 최대 회귀.
| 가역(Undo toast) | 확인 필요(ConfirmDialog) |
|---|---|
| 읽음·해결·주문확인·QA승인/거부 | 주문취소(사유)·정산 capture/release/no-show·머천트 삭제 |
### 4.4 alert/confirm → toast/ConfirmDialog 전수 마이그레이션
**27 alert + 5 confirm 전부 교체**(상세 줄:대체 맵은 §아래 표). **⚠️ iOS WebView `confirm()`은 다이얼로그 없이 true 반환 → 정산 머니액션이 무확인 발화(돈 버그)** — `orders/[id]:123,173` 최우선. **어드민 layout에 `<Toaster position="top-center" richColors/>` 미마운트 → 추가 필수**(top-center가 바텀탭 회피).
주요 매핑: layout.tsx:217/235/241/249(auth)·orders/page:88·orders/[id]:123(confirm→ConfirmDialog)/131/138/157/161/173(confirm)/210/214·contacts:71/171/175·emails:82/169(인라인)/189/194/198·merchants:82(confirm)/108/112/117(confirm destructive)/141/145·settings:43/46·upload:25/35/69/119·analytics:52·chatbot-analytics:97·cms:66.
### 4.5 마이크로 피드백
haptics `lib/admin/haptics.ts`(light=확인/스와이프, medium=취소/거부/undo, heavy=결제/삭제; iOS는 navigator.vibrate 무반응 no-op). 버튼 `active:scale-[0.97] duration-75`(framer `whileTap`). skeleton shimmer(`admin-shimmer` 1.4s, 스피너 대체 — auth 게이트 스피너만 유지). prefetch `onTouchStart`(모바일 hover 없음 → 300ms 내비 지연 제거). debounced search 300ms. pull-to-refresh(framer `drag="y"` ≥80px).

---

## 5. 가독성 · 타이포 · 차트
### 5.1 모바일 타입 램프 (5역할, 8+ 임의 사이즈 대체)
display `text-2xl font-bold tabular-nums`(KPI 히어로) · title `text-xl font-semibold`(H1 1개/페이지, **현 text-xl~4xl 드리프트 수렴**) · body `text-sm`(한글 leading-6) · caption `text-xs`(날짜/메타) · mono `text-xs font-mono tabular-nums`(ID/금액/타임스탬프) · label `text-xs uppercase tracking-wide font-semibold`(eyebrow/TH). **`text-[9/10/11px]` 44곳 전부 제거.**
### 5.2 DataCard 해부도 (주문 카드 `orders/page.tsx:392`가 템플릿)
primary(투어명 truncate `text-sm font-semibold`) + status pill(우상) + secondary(고객·인원) + meta(날짜·픽업 `text-xs`) + key metric(좌하 `text-base font-bold tabular-nums`) + CTA(우하). **모든 어드민 테이블 → DataCard 폴백**(`md:hidden`/`hidden md:block`). support 9-col 테이블이 최악(폴백 0).
### 5.3 차트 모바일
`MiniBarChart`(90바 ~3.5px) → `data>30`이면 주간버킷 13바. retention 히트맵 → frozen 1열(`position:sticky left-0`)+모바일 4주 기본+`min-w-[44px]` 셀. sessions `grid-cols-12` → SessionCard. CSS `:hover` 툴팁 → `onTouchStart` 포지션 div. **KPI 카드 내 스파크라인**(8pt SVG polyline `viewBox="0 0 56 16"`)으로 별도 차트 패널 3개 제거.
### 5.4 status·money
`BookingStatusBadge` 색단독→**아이콘+pill**(●confirmed ×cancelled ✓completed ◌no-show), `status.*` 토큰 + 다크변형. 색단독 신호에 aria/텍스트 보조. 금액: KRW `₩{toLocaleString('ko-KR')} tabular-nums`, USD `$${toFixed(2)}` — 한 문자열 결합 금지, `lib/format/currency.ts:formatBookingPrice` 통일. 스피너 3종(h-10/h-12/h-11) → `components/admin/Spinner` 단일.

---

## 6. 폼 · 머니패스 ergonomics
### 6.1 프리미엄 폼 계약
label(13px/600 `htmlFor`) 위 / input(**min-h 48px·font 16px**·`rounded-2xl`·`focus:ring-2`) / helper(상시) / error(인라인 `role="alert"` `aria-describedby` — **원격 배너만 금지**). **16px 핵심:** `lib/mypage-ui.ts:143` `AUTH_INPUT`이 `text-[15px]`(iOS 줌 임계 1px 미만) → `text-[16px]`(모든 고객 체크아웃/로그인/QuoteModal 상속). 어드민은 `text-sm`(14px) 동일 수정.
- **inputmode 맵(어드민 전무):** 전화→`type=tel inputmode=tel autocomplete=tel` · 사업자번호/우편번호→`inputmode=numeric` · 이메일→`type=email inputmode=email` · 체인 필드→`enterkeyhint=next`, 마지막→`done/send`.
- **validation:** onBlur(해당 필드)·onChange(유효시 에러클리어)·onSubmit(전체+첫 에러로 스크롤·포커스).
- **sticky 액션바:** `fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur pb-[env(safe-area-inset-bottom)]` + 가격총액 + CTA(idle→loading→success 1.5s). 폼 하단 `pb-20` 스페이서.
### 6.2 머니 확인 시트 (정산)
`orders/[id]:173` `window.confirm`(iOS WebView 차단·금액 미표시·더블탭 무방비) → 바텀시트: 드래그핸들 + "Booking #ATK-xxxx · 고객명" + **금액블록(28px/800, `formatHoldAmount` 재사용)** + 결과문구(amber박스) + CTA(첫탭 후 disable=멱등). 액션별 문구: capture/완료(slate "지금 [금액] 청구·취소불가") · release/현장(slate "hold 취소·현장 paid·미청구") · no-show(red "[금액] 위약금·10시 자동청구 실패시만") · setup_pending(slate "저장카드 제거·미청구").
### 6.3 폼별 권고 (핵심)
- 주문상세: confirm→시트, alert→toast, no-show 트리거 outline로 시각 destructive, hold금액 상단 노출, 임박시 `ring-2 ring-amber-400 animate-pulse`.
- 머천트생성: 멀티스텝(회사→연락처→주소+리뷰, 진행표시·state 보존), sticky CTA(현 우상단 off-screen), 사업자/우편 `inputmode=numeric`, Cancel `router.back` dirty-guard.
- contacts 노트: `text-[16px]`, status select(10px)→세그먼트 컨트롤, blur 자동저장(500ms debounce "저장됨✓"), dirty-guard.
- support 답장: `text-[16px]` + `aria-label`, **`sending` 가드(더블탭 중복발송)**, 에러 인라인(현 페이지 상단=작성시 안보임), Send+Resolve=full green/Send=outline, 글자수.
- 고객 체크아웃: AUTH_INPUT 수정 + **sticky 바텀 CTA**(현 사이드바=모바일 화면밖), enterkeyhint, chatApp inputmode 동적, paymentSession 후 스크롤 인디케이터, **disclosure "약 5일"→"6일"**(settle:67 서버주석 일치).
- QuoteModal: inputmode/enterkeyhint, 409 price_changed→새가격 confirm CTA(dead-end 금지), 422→"가능 투어 보기", 로딩 오버레이(더블서밋 방지), sticky CTA.

---

## 7. 컴포넌트 키트 (components/ui 위에)
**Tier1(전 페이지 블로커):** `AdminPageHeader`·`StatCard`(+`StatCardSkeleton`)·`DataTable`·`FilterBar`·`StatusBadge`(BookingStatusBadge 업그레이드). **Tier2:** `DataCard`·`FilterSheet`·`EmptyState`·`ConfirmSheet`·`ActivityRow`. **Tier3:** `AdminTabs`(border-b 언더라인)·`AdminBadge`·`SearchInput`·`PageLoadingState`(skeleton). **공유(청사진):** `StickyFilterBar`·`ActionQueueChip`·`OrderCard`/`InboxItemCard`·`SettlementBar`·`BottomSheetDetail`·`KpiCardWithSparkline`·`SessionCard`·`FrozenHeatmap`·`SwipeableRow`.

---

## 8. 페이지별 모바일 우선 청사진 (375px)
### 8.1 대시보드 (`app/admin/page.tsx`)
above-fold: sticky 헤더 → **액션 큐 strip(2-up: 대기예약/미처리문의/에스컬, 비0=amber)** → **매출 KPI 2-up(USD/KRW)** → 7일 매출 스파크라인 → 최근활동 카드. 3대 윈: ①액션큐를 KPI 3그리드 위로(운영자는 triage하러 옴) ②floating help 버튼 제거(`:319` 마지막 카드 가림) ③매출 KPI 2열 강제(현 1열 200px씩). `/api/admin/stats`에 `revenueTrend7d` 추가.
### 8.2 주문 목록+상세
목록: **sticky 필터바(`top-[52px]` + 검색input 신규)** + source칩 + 날짜그룹 + DataCard(스와이프 확인/취소). 상세: 상단 compact status+투어/고객/일정 → **sticky 바텀 머니 액션바(hold상태+청구/현장/노쇼, <48h=amber·만료=red)** → 아코디언(주문정보/결제/이티너리 접힘). 3대 윈: ①sticky 필터바(현 1.5카드 후 사라짐, 검색 부재) ②sticky 정산바(현 ~1400px 스크롤 후에야 버튼) ③swipe+시트 확인(현 confirm()).
### 8.3 통합 인박스 (신규 `/admin/inbox`, §E-4)
`/api/admin/inbox`가 contact/email/support UNION(40/page). 카드: unread dot+발신자+카테고리칩+시각 / 제목 / 미리보기 / 예약ref칩. 스와이프 ←보관 →해결. 상세=바텀시트(75dvh, 드래그 dismiss)+답장 컴포저 시트. 3대 윈: ①3개 nav→1(현 contacts/emails/support 각각 방문) ②바텀시트가 1/3+2/3 분할 깨짐 해결 ③swipe-해결(현 탭→읽기→select→저장 4스텝). 바텀탭 unread 배지.
### 8.4 분석 오버뷰 + 세션/리텐션
오버뷰: range칩 → **KPI 2-up(카드 내 스파크라인)** → 통합 일일트렌드 1차트 → 상위이벤트(모바일 5개+"모두보기"). 세션: SessionCard(시작·기간·디바이스·entry·locale·국가·전환). 리텐션: frozen 1열 히트맵+4주 기본. 3대 윈: ①스파크라인이 별도 차트패널 3개(~480px) 제거 ②SessionCard가 grid-cols-12(31px 컬럼) 대체 ③frozen 컬럼(스크롤시 코호트 라벨 유지). stale 공지를 상단으로.

---

## 9. 빌드 순서 (ROI 순)
**기반(R2.0):** Toaster 마운트 + `<AdminPageShell>` + 토큰(`--admin-*`·tabular-nums·radius 12px) + 16px 입력 전역 + 44px 터치 + `100dvh`/safe-area + haptics·Spinner·SwipeRow·skeleton 유틸 + `useUrlFilters`. → **페이지(R3):** 8.1~8.4 청사진 순(+ alert/confirm 마이그레이션·DataCard 폴백·inputmode·sticky CTA·다크모드). 각 페이지 DoD: 반응형·터치44·16px·stale유지·URL필터·toast/ConfirmDialog·dirty가드·a11y.
> 머니 안전 직결(우선): orders/[id] confirm()→머니 확인 시트(iOS WebView 무확인 발화 차단), support 답장 더블탭 가드, AUTH_INPUT 16px(체크아웃 줌).
