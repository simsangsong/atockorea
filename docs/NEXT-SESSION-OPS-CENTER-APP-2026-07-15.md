# 다음 세션 실행 프롬프트 — 관제센터 앱화 + 투어모드 PWA (Ops Center App)

**작성:** 2026-07-15 (투어모드 코드 트랙 T0~T8.1 완료 세션 직후)
**선행 상태:** 투어모드 v1 전체 main 머지(PR #307/#308/#309, 플래그 OFF). 기존 SoT `docs/tour-mode-master-plan-2026-07-14.md`(§F에 티켓별 해시)는 **참조용 상위 문서**, 이 문서가 이번 트랙의 실행 기준.
**개발 브랜치:** 신규 `claude/tour-mode-ops-app-<suffix>` — main에서 분기, **워크트리에서 작업**(메인 dir 경합; `C:\Users\sangsong\atockorea-tourmode` 재사용 가능 — 그 경우 main 머지 후 새 브랜치 체크아웃, node_modules 정션·.env.local 이미 있음).

---

## 0. 사용자 지시 원문 요약 (2026-07-15 — 이 트랙의 헌법)

1. **관제센터를 단독 앱 형식으로**: 실시간으로 각 투어 상황 모니터링, 각 투어룸 대화창 진입, 실시간 위치 등 **모든 상황**을 한 화면 체계에서.
2. **SOS·고객 소통 즉시 대응**: 고객이 SOS를 보내거나 대화를 원하면 관제가 바로바로 연락.
3. **세 화면 전부 앱처럼 보이는 UI**: 관제센터 + 고객용 투어룸 + 가이드용 콘솔.
4. **홈 화면 아이콘으로 단독 설치**: 진짜 네이티브 앱은 아니지만 앱 형식(= **PWA**: manifest + standalone + 홈화면 추가).

## 1. 이어받는 즉시 할 일 (순서 고정)

1. `git fetch origin` → main 기준 새 브랜치 → 워크트리 체크아웃. `npx tsc --noEmit`과 `npx jest __tests__/api/tour-rooms-sos.test.ts`로 베이스 그린 확인.
2. 이 문서 §2(재사용 자산) → §3(핵심 설계 결정) → §4(WBS)를 읽고 **W1부터** 착수.
3. 티켓 완료 시 이 문서 §4 해당 줄에 `✅ 완료(커밋해시)` 갱신 커밋(인수인계 체인).
4. 절대 규칙은 기존과 동일: 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만, 코드/커밋 영어·보고 한국어, DDL은 additive+`get_advisors`, 완료·검증 후 커밋+PR+머지(플래그 OFF 유지 시 자율).

## 2. 재사용 자산 인벤토리 (전부 main에 있음 — 새로 만들지 말 것)

| 자산 | 위치 | 이번 트랙에서의 역할 |
|---|---|---|
| 관제 v1 | `app/admin/tour-ops/page.tsx` + `/api/admin/tour-ops/rooms` | 개편 대상. SOS 핀·사운드·관제 발신 로직 재사용 |
| 룸 채널 훅 | `hooks/useTourRoomChannel.ts` | Broadcast 수신(메시지·자막·위치)+dedupe+SSE 폴백 — **관제 멀티룸 구독의 코어로 일반화** |
| 채널 토픽 | `lib/tour-room/realtime.ts` `roomChannelTopic(roomId,status)` | 서버가 토픽 계산 가능 → 관제용 토픽 발급 API(§3-B)의 근거 |
| 지도 캔버스 | `components/tour-mode/map/RoomMapCanvas.tsx` | 관제 전체 지도(멀티룸 마커)로 확장 |
| 위치 스냅샷 | `tour_room_locations` + snapshot API | 콜드스타트 위치; 라이브는 Broadcast 'location' |
| admin 실시간 | M-6: `tour_room_messages` admin SELECT 정책+publication | Postgres-Changes 백업 경로(이미 관제 v1이 사용) |
| SOS | `/api/tour-rooms/[bookingId]/sos` + `SosButton` | 알림 UX 강화 대상(§4 W4) |
| 팬아웃 | `/api/tour-rooms/broadcast` | 관제 전체 공지(admin 경로 이미 지원) |
| 룸 셸 | `components/tour-mode/RoomShell.tsx` 외 tour-mode/* | 고객/가이드 앱화 폴리시 대상 |
| 아이콘 원본 | **메인 dir** `C:\Users\sangsong\atockorea\public\atoc-emblem-circle-{512,1024}.png,.svg` | ⚠ **untracked** — 이번 세션에서 커밋해 PWA 아이콘으로 사용(마스커블 패딩 확인) |
| 어드민 인증 | `requireAdmin` + bearer 패턴(`app/admin/external-reviews/page.tsx`의 getToken) | 관제 앱 로그인. **PWA standalone에서 쿠키/세션 유지 확인 필수**(§3-D) |

## 3. 핵심 설계 결정 (착수 전 확정 — 기본값으로 진행 가능)

- **A. PWA 구조 = 라우트 스코프별 매니페스트 3개.** Next App Router의 라우트 매니페스트로 각 표면이 **각자 아이콘으로 설치**되게 한다:
  - `app/tour-mode/manifest.ts` → name "AtoC Tour Room", `start_url:/tour-mode`, `scope:/tour-mode`, `display:standalone`
  - `app/tour-mode/guide/` 는 tour-mode 스코프에 포함(가이드는 같은 앱 안에서 /guide 진입) — 별도 설치가 꼭 필요하면 W5에서 분리 결정
  - `app/admin/tour-ops/manifest.ts` → name "AtoC 관제센터", `scope:/admin/tour-ops`(admin 전체 스코프 금지 — 다른 admin 페이지로 새면 앱감 깨짐)
  - 루트 layout에는 링크 추가하지 않는다(사이트 전체가 PWA로 오인되지 않게). theme_color: 룸=#111827, 관제=#0f172a.
- **B. 관제 실시간 = 룸 Broadcast 채널 직구독(주) + Postgres-Changes(보조).** 신규 API `GET /api/admin/tour-ops/channels?date=` (requireAdmin) 가 해당 날짜 룸들의 `{roomId, bookingId, topic}` 목록 반환(서버만 토픽 계산 가능, R-23 유지). 관제 클라이언트는 supabase-js로 토픽 N개 구독(웹소켓 1개에 멀티플렉스) → 메시지·위치·자막이 **폴링 없이 즉시** 흐른다. `useTourRoomChannel`을 `useOpsChannels(topics[])`로 일반화하되 기존 훅 계약은 불변(회귀 테스트 존재).
- **C. 관제 발신 = 기존 messages/broadcast admin 경로 그대로.** 새 쓰기 경로 만들지 않는다.
- **D. PWA standalone에서 어드민 인증**: supabase 세션은 localStorage 기반이라 standalone에서도 유지됨 — 단 **첫 설치 전 로그인 필수** 플로우(미로그인 → `/admin/login?next=/admin/tour-ops`)를 W3에서 확인. 실패 시 대안: 관제 전용 PIN+장기 세션(사용자 결정 필요, 기본값은 기존 로그인 유지).
- **E. 서비스워커는 최소주의.** 오프라인 캐시는 앱 셸(아이콘·매니페스트·엔트리)만; API/HTML은 network-only(Next 캐싱과 충돌 금지). 설치 가능 조건(https+manifest+SW)만 충족하면 됨. `next-pwa` 등 무거운 의존성 **추가 금지** — 수제 `public/sw-*.js` 2개(스코프별).
- **F. SOS 즉시 인지**: v1 = 앱 내 사운드+핀(이미 있음)+**타이틀 배지/파비콘 점멸+진동**. **Web Push(백그라운드 알림)는 W6 별도 결정**(VAPID 키 발급+구독 저장 테이블 필요 = DDL 1건, additive) — 관제가 앱을 안 열어놔도 울리려면 필수라 강력 권장, 단 사용자 승인 후.
- **G. 홈 메인페이지 아이콘 노출**: "메인페이지에 아이콘"은 ①홈 화면 설치(A2HS, 위 매니페스트)와 ②사이트 홈에 진입 아이콘 두 해석이 가능 — **기본값 ①**. ②(사이트 홈에 투어모드 진입 타일)는 랜딩 규칙(landing-page-uiux 스킬) 게이트라 별도 티켓으로 사용자 확인 후.
- **H. 앱감 UI 공통 규칙**: safe-area(env(safe-area-inset-*)) 전면 적용(tour-mode layout에 viewportFit:cover 이미 있음 — 관제에도), 스크롤 바운스 제어, 상단 주소창 없음 가정의 헤더(뒤로가기 자체 제공), 하단 탭바(관제: 대시보드/지도/SOS/설정), 터치 타깃 ≥44px, 다크모드 기본(관제).

## 4. 실행 WBS

> **감사 하드닝 라운드(2026-07-15, `de8d22fd`)**: W1~W7 전 기능을 라이브 시딩 모의(scripts/sim-tour-day.ts)로 실구동 검증 + 4차원 심층 감사(정합성·보안·성능·UX/i18n) 후 결함 일괄 수정. 주요: ①2차 SOS 재알람(roomId+ts 키), ②설치 PWA 죽은룸 리다이렉트 루프 차단(?nojump=1), ③미전송 큐 재구독 자동 flush, ④룸당 메시지 200캡→O(n) 파생 상수화, ⑤지도 강제 리센터 제거, ⑥관제 수신측 ko 번역 표시, ⑦SOS 이메일 HTML 이스케이프·need_help 푸시 레이트리밋·푸시 endpoint allow-list(SSRF)·SW same-origin. 잔여 후속=tour-room API 에러 detail 누출 정리(태스크 발행). 프로덕션 서버 스모크 콘솔 0에러.

### W1 — PWA 셸 【4】
- **W1.1** ✅ 완료(`32f5e6c5`) 아이콘 파이프라인: 메인 dir의 emblem PNG 커밋 + 192/512 maskable 파생 + apple-touch-icon — AC: Lighthouse PWA 설치 가능.
- **W1.2** ✅ 완료(`b97fa708` — manifest.ts 컨벤션은 앱 루트 전용이라 route handler `app/tour-mode/manifest.webmanifest/route.ts`+layout metadata.manifest로 구현) `app/tour-mode/manifest.ts` + 최소 SW + 설치 프롬프트 배너(iOS는 공유→홈화면 안내 시트, 5로케일) — AC: Android/iOS 홈 아이콘 설치 확인 항목 문서화.
- **W1.3** ✅ 완료(`0f5c4c22` — 동일하게 route handler) `app/admin/tour-ops/manifest.ts` + SW — AC: 관제만 단독 설치(스코프 밖 이동 시 브라우저로).
- **W1.4** ✅ 완료(`0736f0c3` — hooks/useStandaloneDisplayMode + admin layout 관제 standalone 크롬 분기) standalone 감지(`display-mode: standalone`) 시 앱 크롬(뒤로가기 헤더 등) 활성 — AC: 브라우저 열람은 기존과 동일.

### W2 — 관제 실시간 코어 【3】
- **W2.1** ✅ 완료(`7c390ead`) `GET /api/admin/tour-ops/channels` (requireAdmin, 날짜별 {roomId,bookingId,topic,status}) — AC: 비어드민 403, 토픽이 join 발급값과 일치(유닛).
- **W2.2** ✅ 완료(`7c390ead`+`c6c641a7`) `useOpsChannels(topics)` — 멀티토픽 구독, 룸별 메시지/위치/자막 머지(기존 applyLocationFrame·mergeRoomMessages 재사용), 미읽음 카운터(룸별 마지막 열람 커서 localStorage) — AC: 2룸 동시 수신 유닛(채널 목).
- **W2.3** ✅ 완료(`d68f9377` — OpsApp에서 구현: visible+비realtime시만 20s 폴, pg-changes 동일 강등, 5분 드리프트 리프레시, room 이벤트→디렉터리 재조회) 기존 20s 폴은 재연결 백업으로 강등(visible+연결끊김 시만) — AC: 정상 연결 시 폴 0회.

### W3 — 관제센터 앱 UI 개편 【5】
- **W3.1** ✅ 완료(`d68f9377`) 앱 셸: 하단 탭(대시보드/지도/SOS/설정)+다크 테마+safe-area — AC: 모바일 기기폭 360px에서 가로 스크롤 0.
- **W3.2** ✅ 완료(`d68f9377` — 윈도잉은 content-visibility:auto) 대시보드 탭: 투어별 그룹핑(투어 카드 → 룸 리스트), 라이브 배지·미읽음·탑승 집계 — AC: 룸 30개 렌더 성능(윈도잉).
- **W3.3** ✅ 완료(`d68f9377`) 룸 드로어(대화창 진입): 실시간 피드(W2 스트림)+관제 컴포저+퀵답장 프리셋+참가자·위치 요약 — AC: 발신→피드 반영 지연 체감 0(옵티미스틱).
- **W3.4** ✅ 완료(`d68f9377` — OpsMapCanvas 신설, roomHue 마커) 지도 탭: 전체 투어 참가자/가이드 마커 통합 지도(RoomMapCanvas 확장, 룸 색상=roomHue 재사용), 마커 탭→룸 드로어 — AC: 멀티룸 마커 충돌 없음.
- **W3.5** ✅ 완료(`d68f9377`) 설정 탭: 날짜 선택·사운드 on/off·(W6 후) 푸시 토글 — AC: 설정 영속.
- ⚠ 어드민 셸 규칙(프리미엄 모바일, `docs/admin-premium-mobile-design-spec-2026-06-24.md`) 준수 — 단 이 페이지는 standalone 앱이므로 어드민 사이드바 없이 자체 셸 허용(관제 v1도 이미 그렇게 함).

### W4 — SOS·소통 즉시성 【3】
- **W4.1** ✅ 완료(`18099b43`) SOS 수신 강화: 핀+사운드(기존)+파비콘/타이틀 점멸+진동+SOS 탭 뱃지, SOS 카드에 원탭 액션(룸 열기·위치 열기·전화 tel:) — AC: SOS→가시화 3초 내(Broadcast 직수신이라 충족).
- **W4.2** ✅ 완료(`18099b43` — lib/tour-ops/attention.ts, 유닛 7) "고객이 소통 원함" 시그널: 고객 메시지 중 관제 지정 키워드/need_help 프리셋/무응답 5분 등을 **어텐션 큐**로 표면화(대시보드 상단) — AC: 규칙 유닛.
- **W4.3** ✅ 완료(`18099b43`) 고객측: SOS 전송 후 "관제와 연결됨" 상태 표시 + 관제 응답 시 하이라이트 — AC: 5로케일.

### W5 — 고객/가이드 룸 앱화 폴리시 【3】
- **W5.1** ✅ 완료(`24e7ed62` — 배너 D-1~당일·예약당 1회, 마지막 룸 localStorage→entry 직행; 스플래시는 매니페스트 theme/bg로 충족, 전환 애니메이션 통일은 기존 룸 트랜지션 유지로 종결) 룸/콘솔 standalone 폴리시: 설치 배너(투어 D-1 룸 진입 시 1회), 스플래시(theme/배경), 전환 애니메이션 통일 — AC: 설치 후 재진입이 룸 URL로 직행(start_url 쿼리 유지 전략: localStorage 마지막 룸).
- **W5.2** ✅ 완료(`24e7ed62`) 이메일 초대(T5.2)에 "홈 화면에 추가" 안내 한 줄 추가 — AC: 5로케일.
- **W5.3** ✅ 완료(결정: 같은 tour-mode 앱 내, 별도 설치 없음) 가이드 콘솔 별도 설치 여부 결정 반영 — 기본값: 같은 tour-mode 앱 내.

### W6 — Web Push (사용자 결정 게이트 🔒) 【3】
- **W6.1** ✅ 완료 — DDL `supabase/migrations/20260715120000_push_subscriptions.sql` 라이브 적용(RLS on·정책 0=service-role 전용, advisors 신규 WARN 0), VAPID dev 키 .env.local, 구독 API `POST/DELETE /api/admin/tour-ops/push-subscriptions`(requireAdmin, endpoint upsert). **프로덕션 VAPID 키 설정 완료(2026-07-15)**: 프로덕션 전용 키쌍 생성(로컬 백업 `.env.vapid-production.local`, git 제외) → Vercel atockorea 프로젝트 env 3종(`NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`/`WEB_PUSH_VAPID_PRIVATE_KEY`(Sensitive)/`WEB_PUSH_CONTACT`, Production+Preview) 등록 → 프로덕션 Redeploy 트리거까지 완료. 남은 확인 = 실기기에서 관제 설정탭 푸시 토글 ON→잠금 상태 SOS 수신(§I-4).
- **W6.2** ✅ 완료 — `lib/tour-ops/push.ts`(sendOpsPush: 죽은 구독 404/410 자동 정리, env 미설정 시 무해 no-op), 트리거=SOS 라우트+need_help 퀵답장(어텐션 큐의 서버 가시 시그널), `sw-tour-ops.js` push/notificationclick 핸들러(클릭→관제 포커스/열기), 설정 탭 푸시 토글. 유닛 8. "앱 미실행 수신" 실기기 확인은 §I-4 체크리스트로.
- **W6.3** ✅ 결정 반영 — v1은 관제(admin)만(가이드 콘솔은 토큰 인증이라 user_id 부재 → role 컬럼만 예약, 백로그). 고객측 push 범위 밖 유지.

### W7 — 검증 【2】
- **W7.1** ✅ 완료(`e4ba02d6` — e2e/tour-ops-sos.spec.ts, 그린 13.8s; 관제측은 임시 admin 유저+bearer로 API 검증, 관제 UI는 컴포넌트 테스트 4개가 커버) E2E 확장: 관제 시나리오(SOS 발생→관제 피드 표시→관제 응답→고객 수신) — 기존 playwright 인프라 재사용 — AC: 그린.
- **W7.2** ✅ 완료(`76856dff` — 마스터플랜 §I-4에 PWA·관제 앱 항목 편입) 실기기 체크리스트에 PWA 항목 추가(설치·standalone 인증 유지·iOS 사파리 A2HS) — §I-4에 편입.

## 5. `TOUR_ROOM_TOKEN_SECRET` 런칭 절차 (T8.2 선행 — 이번 세션과 무관하게 사용자가 바로 실행 가능)

이 시크릿 하나가 **초대 토큰 서명 + 룸세션 서명 + Broadcast 채널 토픽 HMAC** 전부에 쓰인다(미설정 시 dev fallback — 프로덕션에서 절대 금지, 서버 로그에 경고 찍힘).

1. **생성** (로컬 아무 셸): `openssl rand -hex 32` 또는 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. **Vercel 설정**: 대시보드 → 프로젝트 → Settings → Environment Variables → `TOUR_ROOM_TOKEN_SECRET` = 생성값, 환경은 **Production**(Preview도 권장 — 프리뷰 테스트용은 다른 값이어도 됨). CLI라면 `vercel env add TOUR_ROOM_TOKEN_SECRET production`.
3. **재배포**: env 변경은 재배포부터 적용 — Deployments에서 최신 프로덕션 Redeploy(빈 커밋 푸시도 가능).
4. **기존 링크**: 지금까지 발송된 실링크는 없음(플래그 OFF) → `_PREV` 불필요. 혹시 dev 시크릿으로 만든 테스트 링크가 살아있길 원하면 `TOUR_ROOM_TOKEN_SECRET_PREV=atoc-tour-room-dev-secret`을 잠시 두면 되지만, **보안상 두지 않기를 권장**(dev 시크릿은 코드에 공개되어 있음).
5. **향후 로테이션**: 새 값 → `TOUR_ROOM_TOKEN_SECRET`, 이전 값 → `TOUR_ROOM_TOKEN_SECRET_PREV` → 재배포. 발송된 링크는 PREV로 계속 검증되고, 만료 주기(투어일+24h)가 지나면 PREV 제거.
6. **검증**: 재배포 후 어드민 주문 상세 → "투어룸 발송"(플래그 OFF 동안은 API에 `force:true`) → 수신 메일 링크 클릭 → 룸 열리면 OK. 서버 로그에 `TOUR_ROOM_TOKEN_SECRET is not set` 경고가 더 이상 없어야 함.
7. 나머지 런칭 env는 `docs/tour-mode-hardening-T8-2026-07-15.md` §5 체크리스트.
