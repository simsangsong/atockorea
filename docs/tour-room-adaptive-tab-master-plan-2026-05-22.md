# 적응형 Tour Room 탭 (BottomNav 3번째 슬롯) 마스터 플랜

작성일: 2026-05-22
문서 상태: **표준 마스터 플랜 (유일한 실행 기준)**
대상: `components/BottomNav.tsx` 3번째 슬롯 + 신규 `app/tour-room/` 소비자 페이지 + 기존 tour-room 백엔드(`/api/tour-rooms/*`, `tour_rooms`/`tour_room_messages`/…)
관련: `lib/tour-room/use-tour-room-booking.ts`(예약 리졸버), `middleware.ts`(라우팅), `messages/{6}.json`(i18n), `docs/bottom-nav-uiux-master-plan-2026-05-20.md`(N1–N12 — 본 플랜이 N4를 갱신)

작성 배경:
- tour-room 백엔드(2026-05-15)는 번역 채팅·GPS 오디오 가이드·시설 핀·버스 정보·AI 다국어 코스까지 **상당히 구축돼 있으나 소비자 UI가 0** — "문 없는 방".
- 사용자 결정(2026-05-22): 보텀내비 Cart 탭을 **적응형 Tour Room**으로. "전날부터 거기로 모든 투어 디테일", 일부 기능은 kurso에서 이식.
- 옵션 A(적응형) 채택: 활성 투어가 있으면 Cart→Tour Room으로 변신, 없으면 Cart 유지(커머스 무손상).

---

## §A. 상태 대시보드

| Phase | 상태 | 비고 |
|---|---|---|
| 0 — 게이트 (코드 실사 + 결정 로그 + 데이터 소스 확인) | ✅ 완료 (2026-05-22) | 소스 = `/api/tour-mode/bookings`. cart/Header/i18n/미들웨어 실사 완료 |
| 1 — 적응형 탭 + 룸 스캐폴딩 (브리핑 + 가이드 번역 채팅) + i18n 6로케일 + 미들웨어 수정 | ✅ 코드 완료 (branch `feat/tour-room-adaptive-tab`) | type-check 0 에러. 로그아웃 기준선·신규 라우트·하이드레이션 브라우저 QA 통과 |
| 2 — 인증 QA (시드 예약으로 변신·룸 접근·채팅 전송 검증) + kurso 이식(오디오 가이드·시설 지도·버스 정보·AI 코스) | ⏳ 대기 | 헤드라인 "변신"은 today/tomorrow 예약 가진 로그인 유저 필요 |

**현재: Phase 1 코드 완료 → Phase 2(인증 시드 QA) 진입 전, 사용자 방향 확인 대기.**

---

## §B. 결정 로그 (binding)

| # | 결정 | 이유 |
|---|---|---|
| TR1 | **3번째 탭 적응형 (Cart ↔ Tour Room).** 폴백 = **Cart**. → bottom-nav **N4(정적 4탭/정적 Cart) 갱신** | 활성 투어 있는 ~10% 세션에만 룸 노출, 나머지는 회귀 0 + 커머스 유지 |
| TR2 | **룸 오픈 = "전날부터".** 투어가 오늘/내일이면 활성 (`ROOM_OPEN_DAYS_BEFORE=1`, 로컬 시간) | 사용자 지시("전날부터"); 스키마(`tour_bus_details` 날짜별)와 정합 |
| TR3 | **데이터 소스 = `/api/tour-mode/bookings`** (confirmed + tour_date≥today, 오름차순 → `[0]`=최근접). 신규 엔드포인트 없음 | 이미 존재·정확. 중복 API 금지 |
| TR4 | **변신 mounted-gated (하이드레이션 안전)** + 모듈 캐시 TTL 60s + 단일 in-flight | BottomNav는 네비마다 remount → 분당 1회 이하 fetch, SSR=Cart 일치 |
| TR5 | **소비자 페이지 = `app/tour-room/`(루트, locale 무접두 — `/cart`와 동일).** `middleware.ts` `RESERVED_ROOT_SEGMENTS += 'tour-room'` | 미들웨어가 `tour-room`을 투어 슬러그로 오인해 `/tour/tour-room` 리다이렉트하던 버그 수정 |
| TR6 | **Phase 1 kurso 이식 = 가이드↔고객 번역 채팅**(`/api/tour-rooms/[bookingId]/messages`, STT+번역) **+ 데이-오브 브리핑.** GPS 오디오·시설 지도·버스 정보·AI 코스 = Phase 2+ | 백엔드가 가장 완성된 채팅부터; 단계적 위험 분산 |
| TR7 | **room 카피 6로케일 동시(en/ko/zh/zh-TW/es/ja).** `nav.tourRoom` + `tourRoom.*` | 사이트 전역 i18n 규칙 |
| TR8 | **amber "live" 펄스 = 의미 있음(룸 지금 열림).** bottom-nav **N6(가짜 숫자 금지) 준수** | 동작하는 신호만 |
| TR9 | **커머스 무손상.** cart 진입점은 Header `/cart` 링크 + Cart 폴백 탭에 유지. checkout 경로 변경 없음 | 구매 funnel 보호 |
| TR10 | **reduce-motion 가드** (live 펄스·탭) — bottom-nav N8 상속 | 모션 정책 일치 |

---

## §C. 변경 로그

| 날짜 | 항목 | 비고 |
|---|---|---|
| 2026-05-22 | Phase 0+1 — 적응형 탭 + 룸 페이지 2종 + 리졸버 훅 + i18n 6로케일 + 미들웨어 수정 + 플랜 | branch `feat/tour-room-adaptive-tab` (worktree `atockorea-tour-room`). type-check 0, 로그아웃 QA 통과 |

---

## §1. 파일 맵

- **신규**: `lib/tour-room/use-tour-room-booking.ts`, `app/tour-room/page.tsx`, `app/tour-room/[bookingId]/page.tsx`, `scripts/add-tour-room-i18n.mjs`(일회성), 본 문서
- **수정**: `components/BottomNav.tsx`(적응형 3슬롯 + live 펄스), `middleware.ts`(`tour-room` 예약), `messages/{6}.json`(nav.tourRoom + tourRoom.*)
- **의존(읽기)**: `/api/tour-mode/bookings`, `/api/tour-rooms/[bookingId]/messages`, `src/components/layout/SitePageShell`, `lib/i18n`, `lib/supabase`
- **Out of scope**: `/cart`·`/checkout`(미변경), tours-list `CatalogueHero`(기존 하이드레이션 경고 — 별도)

## §2. 안티 다운그레이드 가드
- ❌ 커머스 경로 손상 (TR9) / ❌ 가짜 live 신호 (TR8) / ❌ 하이드레이션 미스매치 (TR4) / ❌ 빈 Tour Room 노출 (TR1 폴백) / ❌ 하드코딩 영어 (TR7)
- ✅ Cart 폴백으로 회귀 0 / ✅ mounted-gate / ✅ 6로케일 / ✅ reduce-motion

## §3. Phase 2 진입 체크리스트 (다음)
1. today/tomorrow `confirmed` 예약을 가진 로그인 유저로 모바일에서 3번째 탭 = Tour Room(amber 펄스) + 딥링크 확인
2. `/tour-room/[bookingId]` 브리핑 정확 + 가이드 채팅 GET/POST(번역) 동작 (OpenAI 키 의존 — 전송 실패 시 graceful 확인)
3. 룸 접근 권한(타인 예약 403) 확인
4. kurso 이식 범위 확정 후 단계 분할 (오디오 가이드 → 시설 지도 → 버스 정보 → AI 코스)

**문서 끝.**
