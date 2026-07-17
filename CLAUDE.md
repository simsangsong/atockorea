# CLAUDE.md — 프로젝트 메모리

## 완료: 투어룸 UI/UX 글로벌 리디자인 v1 (프레젠테이션 전용, U0~U8)

**마스터 플랜(단일 기준):** `docs/tour-room-ui-redesign-master-plan-2026-07-15.md` (§A 진단 → §C 바인딩 결정 U-D1~12 → §K WBS 8웨이브/46티켓)
**상태:** Wave U0~U8 전체 구현 완료 + main 머지 완료(2026-07-15). 토큰 시스템·메신저 레이아웃·버블 시스템·컴포저·카드 리스킨·탭 개편 배포, 테스트 228개 green. **단, U-D2(카카오 옐로 버블)는 아래 v2에서 개정됨 — 이 문서의 색 토큰 표는 더 이상 유효하지 않고 구조 결정(레이아웃·그룹핑·꼬리·FAB 등)만 유효.**

## 진행 중: 스마트 가이드 프라이빗 모드 (W0 완료)

**마스터 플랜(단일 기준):** `docs/smart-guide-private-mode-master-plan-v2-2026-07-16.md` — v1 초안을 2026-07-16 코드 전수 감사로 검증·완성한 SoT. 8-프리미티브(PIN/TIMER/SIGNAL/MUTATE/LEDGER/CARD/ESCALATE/BRIDGE) 조합으로 79+1 시나리오 해결. §A 코드 리얼리티 감사(재사용✅/확장🔶/부재❌) → §B 바인딩 결정 P-D1~14(오픈퀘스천 4개 확정: POI 이원 유지·**정산=당일 가이드 현금 직불(사용자 확정 2026-07-16, LEDGER는 기록·투명성 장치, Stripe 미개입)**·드라이버=신규 scope+차량PIN·다일=tour_date 키만) → §I WBS W0~W5(MVP=W0→W3). **상태: W0+W3(보이스 브릿지)+W1.5(자동 콘텐츠)+복귀타이머 완료·main 머지 — "한국어만 하는 기사 단독 투어" MVP 코어 배포됨.** ① **W0**(PR #323): 스키마 4테이블+역할확장 라이브, `dayPlan.ts` 4단 리졸버(소비처 3곳), `events.ts` idempotent 로그 ② **W3**(PR #325): `/tour-mode/driver` 기사 콘솔 — 원탭 녹음→자동송신(3초 취소창, messages 라우트 audio multipart 재사용)→손님 언어 말풍선, 수신 손님메시지 자동 한국어 TTS(운행시작 탭으로 오디오 언락), 수동 도착 트리거(§O-8 첫 구현 `manual-arrival` — 손님 언어 콘텐츠 카드 발사), 원탭 시그널 4종(`driver-signal`: 지연/주차핀(tour_room_pins)/차량도착/차량문제→ops푸시), driver 토큰 scope+차량번호 뒤4자리 PIN 게이트(join, `driver.ts` fail-open), PII-미니멀 `driver/overview`(리졸버 일정+match_pois 좌표), 링크 발급 `POST /api/tour-mode/driver/link`(admin 로그인 or 가이드 토큰), 내비 딥링크 `nav-links.ts`(카카오/티맵/네이버/구글), sender_role 'driver' 마이그레이션, broadcast·guide overview는 role guide 명시 제한 ③ **W1.5**(PR #326): P-D16 자동 POI 콘텐츠 — `generatedContent.ts`(Places 사실→batch 레더 LLM 서사→비평가 패스→`generated_spot_content` upsert, 컨시어지 일일예산 편승), 서빙 curated→poi_kb→**generated**→null + AI 배지(SpotArrivalCard), 트리거 2종(도착 온디맨드 후속카드 + `plan` 라우트 confirm), **`/api/tour-rooms/[bookingId]/plan` GET/PUT = W1.4 서버 슬라이스**(가이드/드라이버/admin이 일정 작성·confirm 가능 — /plan 손님 UI는 미구현) ④ **복귀타이머**(PR #327): driver-signal 'return_time' = 기존 free_time_timer 메타데이터 계약 재사용 → 손님 카운트다운 배너+Tier0 즉답 무변경 동작, 콘솔 [복귀시간] +30/45/60/90 칩. **테스트 위생: access/voice/routes 픽스처 날짜부패(2026-07-15 토큰 만료) 동적 미래날짜로 수정 + web-push/qrcode/@playwright 로컬 설치로 4개 스위트 치유 — 투어룸+api 327 green, tsc 0.** ⑤ **W1**(PR #328, 2026-07-17): 손님 /plan D-1 에디터 — `/tour-mode/plan/[bookingId]` 5로케일 3탭(추천 course_templates 31종 시딩·직접 고르기 match_pois 피커+Places 폴백 ~120m poi_key 스냅·가이드에게 맡기기=itinerary.guide_curated), A10 니즈 체크리스트→needs, A2 자동저장, W1.3 실행가능성 v1(`feasibility.ts` 총합·휴무(poi_key 포함 키워드)·권역 — 경고만) PUT마다 저장, P-D13 lead guest(첫 customer join is_lead·owner 승계·draft만 편집·confirm 불가·확정 후 409), submit/delegate 캡슐 팬아웃, `plan/templates` 라우트. **+🔴 핫픽스: verifyRoomSession이 driver role 거부 → W3 기사 콘솔 후속 호출 전부 403이던 라이브 버그 1줄 수정+회귀 테스트.** ⑥ **W2 코어**(PR #329+#330, 2026-07-17): 가이드 콘솔 `GuidePlanPanel` — 룸 카드별 초안 검토(§G diff `planReview.ts` 신규 배지·니즈 요약·경고)→원탭 확정, 확정 후 MUTATE(reorder/추가/skip+reason — plan 라우트 status/skip_reason 화이트리스트, skip 시 동일 category 반경 20km 교체 추천), 스톱별 [도착](§O-8 manual-arrival 재사용) + **rally 사다리**(`rallyStage()` 순수 시간파생 set→remind→due→overdue→contact, NoticeBanner overdue "일행 대기"·contact 전화 칩, T+5 크로싱 idempotent `rally_overdue` — UNIQUE subject_key 디듀프 라이브 검증) + **손님 SIGNAL 라우트** `/signals`(running_late·rest_stop·lost=lost_me 핀 TTL30분·rally_overdue, 5로케일 `guestSignals.ts`). **워크트리** `C:\Users\sangsong\atockorea-private`(.env.local에 플래그 ON, dev 포트 3160 `private-dev`). ⑦ **W2 완결**(PR #331+#332): LEDGER — `extras` GET/POST/PATCH(`ledger.ts` §C-3 전이 화이트리스트, 전이마다 5로케일 캡슐=감사추적) + 피드 `ExtraLedgerCard`(최신 캡슐만 라이브 상태+손님 [확인]) + 가이드 `GuideLedgerPanel`(미수취 합계·기록·수취완료/취소) + 손님 `QuickSignalBar`(늦어요/잠깐 정차/길잃음→lost_me 위치 1회 공유) + W2.5 `activeCard.ts` 보조 카드 리졸버(지연 ETA 45분 TTL>차량핀 60분 TTL>정산 대기, `SecondaryCardBanner`는 rally 공지 활성 시 전면 억제=P-D8 1장 불변식). **잔여**: W1 A1 D-1 이메일 리마인드 / W4 가드레일(오프라인 스냅샷·CARD 세트·손님 웹푸시 UI·G4 정산 종합 카드+G7 ATM·post_tour 윈도우) / W5 플라이휠 배치 / **사람 게이트: 실기기 리허설(기사 콘솔 마이크·TTS 자동재생 iOS Safari + /plan·가이드 일정 패널 시각 QA — MCP 브라우저 hidden-tab으로 픽셀 검증 미완), 플래그 `NEXT_PUBLIC_TOUR_MODE_V1` ON 결정, §L 4건(연장 단가·open_hours·poi_kb 필드·파일럿 대상)**. ⚠사전존재: TourRoomClient.tsx L285 react-hooks/refs lint 에러(main에도 있음).

## 완료: 투어룸 AI 컨시어지 + UI/UX 엘레강스 리파인 v2 (V0~V6 전부)

**마스터 플랜(단일 기준):** `docs/tour-room-concierge-uiux-v2-master-plan-2026-07-15.md` (§A 라이브 시뮬 진단 → §B 외부 전략메모 채택맵 → §C 색 개정(U-D2→U2-D1) → §D AI 컨시어지 Tier0/1/2 → §G WBS)
**부트스트랩:** `docs/NEXT-SESSION-CONCIERGE-UIUX-V2-2026-07-16.md` ← **이 트랙 이어받으면 이걸 먼저**(잔여 V1·V4·V5·V6 티켓 상세 + 자산 인벤토리 + gotcha)
**개발 브랜치:** `claude/tour-mode-uiux-concierge-p7k2vm` (워크트리 `C:\Users\sangsong\atockorea-tourmode-uiux`, node_modules는 `atockorea-tourmode`에서 정션)
**상태:** Wave V0~V6 **전부 완료**(V0+V2+V3는 PR #317 `23e54f5c` main 머지; V1·V4·V5·V6은 브랜치 `claude/tour-mode-uiux-concierge-p7k2vm`에 커밋 — **PR/머지 대기**). ① V0: 전역 챗봇 위젯 `/tour-mode` 누수 수정 + 카카오 옐로→아이보리·앤틱브라스 팔레트(SOS 레드 유지) ② V1(`19f2bc58`): PresenceBar·LocationShareCard·SosButton "connected" 잔여 emerald 점→`--tr-safe`(SOS 레드 무변경) ③ V2: 스마트 가이드 시트, 퀵칩 4종+5로케일 키워드 Tier 0(네트워크 0회) ④ V3: `/concierge` 엔드포인트+가드레일 4종+피드 에스컬레이션+관제 어텐션+`rag:harvest` 플라이휠+3중 예산 ⑤ V4(`fc7f3f89`): Travel Timeline(spot_arrival+vision_answer 재집계, 신규 스키마·LLM 0) 시트 + `POST /timeline-coupon`(멱등 `coupon_grants`, 정직 폴백) + `TIMELINE10` 프로모 런치게이트 + "리뷰 남기기"는 쿠폰과 분리(AI 초안 없음) ⑥ V5(`beb6d7a1`): "AI concierge 24/7" 문장 내부 모순 교정 5로케일 ⑦ V6: §J QA 체크리스트 통과. 투어 스위트 307 green, tsc 0, 라이트/다크×en/ko 시뮬 실구동 검증(콘솔 에러 0). ⚠ 전체 `npm test`의 5스위트 실패는 사전존재 환경 이슈(Node/undici, 이 트랙 무관). **남은 것: (a) 브랜치 PR·머지 (b) 사람 게이트 — `TIMELINE10` 활성화(is_active=true)+할인율 결정, 마이그레이션 라이브 적용.** 시뮬 재현: `sim-tour-day.ts`→`sim-populate.ts`→`sim-concierge-screens.mjs`/`sim-timeline-screens.mjs`.

## 완료: 투어모드(Tour Mode) 개발 — 실시간 투어룸 (코드 트랙 종결)

**마스터 플랜(단일 기준):** `docs/tour-mode-master-plan-2026-07-14.md` (§A~§O, T0~T8.1 전부 ✅)
**후속 트랙:** `docs/NEXT-SESSION-OPS-CENTER-APP-2026-07-15.md` — 관제센터 앱화/PWA W1~W7 전부 ✅(PR #312~#316)
**상태:** 기능 코드 트랙(T0~T8.1) + 관제 PWA 트랙(W1~W7) 전부 main 머지 완료, 플래그 `NEXT_PUBLIC_TOUR_MODE_V1` OFF. 테스트 290+ green, tsc 0, advisors 신규 0(2026-07-15 재확인). **남은 건 전부 사람 게이트(코드 작업 없음):** ① §I-4 실기기 리허설(iOS Safari/Android Chrome — 녹음·TTS·PWA 설치·SOS 수신) ② 파일럿 스팟 좌표 검수(`docs/tour-mode-pilot-spot-checklist-2026-07-14.md`) ③ T8.2 런칭: 남은 env 체크(`docs/tour-mode-hardening-T8-2026-07-15.md` §5 — 플래그 ON 시점 결정, `NEXT_PUBLIC_TOUR_OPS_PHONE`, SOS 수신 이메일, 파일럿 메트릭 쿼리 등록). `TOUR_ROOM_TOKEN_SECRET`·VAPID·cron은 이미 설정 확인됨. 다음 세션은 사람이 위 3게이트를 통과시킨 뒤 파일럿 오픈으로 재개.

## 진행 중인 대규모 작업: 어드민 대시보드 전면 개편

**마스터 플랜(단일 기준):** `docs/admin-dashboard-upgrade-master-plan-2026-06-24.md`
**모바일 설계 상세:** `docs/admin-premium-mobile-design-spec-2026-06-24.md`
**다음 세션 실행 프롬프트:** `docs/NEXT-SESSION-EXECUTION-PROMPT-2026-06-25-wave4.md` ← **구현 이어받으면 이걸 먼저**(Wave 4 페이지 개편 + 원격 Linux 환경 인수인계, 최신)
**개발 브랜치:** 환경별 상이 — 원격 Linux(web) 세션은 `claude/next-session-execution-ysuww9`(매 스텝 main 머지), 플랜 표준은 `claude/admin-dashboard-upgrade-yvb88c`. 부트스트랩 문서의 §1 확인.

**상태: 진단·플랜(Phase 0~0.13) 완료 → Wave 0/1/3/9 + D-15 + W5.7 머지. 현재 Wave 4(페이지별 프리미엄 모바일 개편) 진행 중 — 대시보드·주문목록·분석허브·챗봇분석·머천트(목록·생성·상세) 완료(PR #182~187). 다음 = 분석 엔진 페이지 §8.4.**

이어받을 때 읽기 순서:
- `docs/NEXT-SESSION-EXECUTION-PROMPT.md` (구현 부트스트랩)
- 플랜 **§L 인수인계 → §A 상태 → §R 실행 WBS(웨이브·티켓)** → 착수 티켓 관련 섹션(§T 보안·§G-6 정산·§U/컴패니언 모바일)

### 핵심 규칙 (이 작업 한정)
1. **브랜치는 로컬 부재 가능 → `git fetch origin` 후 워크트리 `C:\Users\sangsong\atockorea-admin`에서 작업.** 메인 dir은 타 세션 경합.
2. **라이브 DB는 `mcp__atockorea__*`로 연결됨**(`cghyvbwmijqpahnoduyv`). DDL은 additive + 적용 후 `get_advisors` 재실행.
3. **🔴 W0.1 P1 권한상승(고객→admin RLS WITH CHECK 부재)이 단일 최우선** — 라이브 확정, 마이그레이션 1줄.
4. **세무(Wave 8)는 자율 제출 금지** — CPA/세무변호사 SIGN-OFF + §J #2/#3 게이트 후에만.
5. 병렬 감사 에이전트에는 **"하위 에이전트 spawn 금지 + 최종 메시지로 직접 반환"** 항상 명시.
6. **커밋 푸터에 모델 식별자 절대 금지**(`Co-Authored-By: Claude <noreply@anthropic.com>`만). 커밋/푸시는 위 브랜치.
7. 진행 보고는 **한국어**(코드·커밋은 영어).

**다음 착수 지점:** §R Wave 0 → **W0.1 P1 권한상승 차단**(사용자 승인 즉시).
