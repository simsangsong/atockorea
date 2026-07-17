# 스마트 가이드 프라이빗 모드 — 하이엔드 마스터플랜 v2 (완성판, 단일 기준)

> **문서 지위**: v1(채팅 초안)을 2026-07-16 코드베이스 전수 감사(탐색 에이전트 3개 병렬)로 검증·정정한 **실행 가능한 단일 기준(SoT)**. v1의 8-프리미티브 철학과 79-시나리오 카탈로그는 유지하되, ① 코드에 없는 전제를 전부 식별하고 ② 오픈 퀘스천 4개를 바인딩 결정으로 확정하고 ③ 웨이브를 티켓 단위 WBS로 재구성했다.
>
> **목적**: 프라이빗 투어 전 과정(D-1 사전선택 → 픽업 → 이동 → 스팟 → 자유시간 → 식사 → 정산 → 드롭오프 → 사후 48h)의 문제를 **8개 원자 기능(프리미티브)의 조합**으로 해결하는, 세계 최초·최고 수준의 프라이빗 투어 스마트 가이드.
>
> **선행 트랙 관계**: 투어모드 v1(T0~T8.1)·컨시어지 v2(V0/V2/V3, PR #317) 위에 쌓는다. 컨시어지 잔여(V1·V4·V5·V6)와 독립 — 단 V4(투어종료 타임라인+리뷰쿠폰)는 본 플랜 W5와 병합 실행이 효율적(§I W5 참조).

---

## §A. 코드 리얼리티 감사 — v1 전제 vs 실제 (2026-07-16 검증)

v1이 "기존 자산 재사용"이라 부른 것들의 실존 여부. **이 표가 웨이브 규모 산정의 근거다.**

### A-1. 그대로 재사용 가능 ✅

| 자산 | 실체 (repo-relative) | 본 플랜에서의 용도 |
|---|---|---|
| 매직링크 토큰 민트/검증 | `lib/tour-room/token.ts` (HMAC, `TOUR_ROOM_TOKEN_SECRET`, 로테이션 지원) + `tour_room_invites`(token_hash sha256) | /plan 링크, 드라이버 링크 |
| 룸 인가 게이트 | `lib/tour-room/access.ts` `resolveRoomActor()` (admin > token > session > owner > merchant-guide > guest) | 전 신규 API 인가 |
| 가이드 팬아웃 | `app/api/tour-rooms/broadcast/route.ts` (tour-date 전 룸 insert+broadcast, 무LLM 템플릿 지원) | SIGNAL·MUTATE·rally 팬아웃 |
| 미팅 공지 + 자유시간 타이머 | `lib/tour-room/notices.ts` `activeNotice()` (T-10/T-5 경고, 카운트다운) + `NoticeBanner.tsx` + 가이드 콘솔 발송 UI | **TIMER 프리미티브의 뼈대 — rally는 이것의 확장** |
| idempotent 이벤트 패턴 | `tour_room_spot_events` `UNIQUE(booking_id, spot_id, event_type)` | ESCALATE 단계 이벤트 중복 방지 |
| SOS 파이프라인 | `app/api/tour-rooms/[bookingId]/sos/route.ts` (원샷 위치 + 5로케일 템플릿 + ops 이메일 + ops 푸시 + 관제 핀) | H-시리즈 전부의 기반 |
| 컨시어지 3티어 + 가드레일 | `lib/tour-room/concierge.ts` + `app/api/tour-rooms/[bookingId]/concierge/route.ts` (Tier0 무네트워크, gemini→openai, 3중 예산) | E7·C3·F5·G5·G6·J-시리즈 즉답 |
| spotContent 3층 폴백 | `lib/tour-room/spotContent.ts` `resolveSpotContent()` (curated → poi_kb → null) | D2·free 스톱 정직 폴백 |
| POI KB 82 | `data/poi_kb/poi_knowledge_base_v1.29.json` (visitBasics/convenience/smartNotes, poi_key 키) | CARD·즉답·D8 현금힌트의 저장처 |
| 지오펜스 상태머신 | `hooks/useSpotGeofence.ts` + `lib/tour-room/spotWatcher.ts` (진입/이탈 히스테리시스, 60s dwell, 120s 쿨다운, nearest-only) | D1 보조 경로 |
| 실행가능성 엔진 원재료 | `lib/itinerary-match-engine/sequence.ts` (tspRoute·trimToBudget·tourTotalMin) + `lib/itinerary-builder/distance.ts` (`driveMinutes`: haversine×**1.55**, **38km/h** — v1의 "×1.4"는 오기) + `lib/geo/jeju-routing-constants.ts` | §C-4 실행가능성 v2 |
| 휴무 캘린더 | `lib/constants/place-operating-rules.ts` (약 30곳 요일휴무+영구폐쇄, `isPlaceUnavailable(name, date)`) — **이름 키워드 기반, poi_key 미연결** | A4 휴무 경고 v1 |
| Google Places Autocomplete | `components/itinerary-builder/HotelZoneAutocomplete.tsx`·`components/maps/PickupPointSelector.tsx`, 로더 `lib/google-maps.ts` | /plan 탭② 직접 고르기, A9 픽업핀 |
| 코스 원재료 | `match_itinerary_stops` DB 테이블(tour_slug·stop_index·poi_key·title, `scripts/import-match-v18.mjs`가 생성) + 정적 JSON `components/product-tour-static/<slug>/*.json`의 `itineraryStops[]`(`_poi_meta.poi_key` 링크) | **course_templates 변환 작업의 대부분이 이미 끝나 있음** |
| off-session 결제 패턴 | `app/api/cron/recapture-holds/route.ts`의 `paymentIntents.create({confirm:true, off_session:true})` + `bookings.stripe_customer_id`/`stripe_payment_method_id` 저장됨 | (v2 백로그 — P-D2가 현금 직불로 확정되어 본 트랙에서는 미사용, 존재 사실만 기록) |
| 쿠폰 grant 시스템 | `promo_codes`+`coupon_grants`+`coupon_redemptions` (`lib/coupons/*`) | I5 리뷰 재방문 쿠폰 |
| STT | `app/api/tour-rooms/[bookingId]/stt/route.ts` (녹음→Whisper→확인→송신) + caption 이벤트/`CaptionBanner.tsx`(스켈레톤) | BRIDGE 딥링크 타깃 |
| RAG 하베스트 플라이휠 | `logChatTurn`(`lib/support/chat-logger.ts`) → `chat_messages` → `lib/rag/harvest.ts` → `qa_pairs` draft → `/admin/qa-review` 승격 (⚠ v1이 말한 knowledge_chunks 직행이 아님) | I7·플라이휠 ④ |
| 크론 패턴 | `vercel.json` + `lib/cron-auth.ts` (`CRON_SECRET` Bearer), 시간게이트+idempotency 모범 = `capture-tour-day-payments` | 플라이휠 배치 |
| 룸 라이프사이클 | `lib/tour-room/time.ts` lobby→live→ended(+24h grace), 닫힘은 다음 /join에서 lazy | I-시리즈 사후 윈도우의 기준점 |

### A-2. 부분 존재 — 확장 필요 🔶

| v1 전제 | 실제 | 필요한 확장 |
|---|---|---|
| "Tier0 카드 스택" 우선순위 사다리 | 피드는 순수 시간순(`ChatFeed.tsx`); 부유 배너는 `activeNotice()` 단일 선택뿐 | `notices.ts`를 `activeCard()` 우선순위 리졸버로 확장 (§C-6) — 신규 컴포넌트가 아니라 기존 배너 존의 선택 로직 교체 |
| §O-8 가이드 수동 스팟 트리거 | **미구현** (투어모드 플랜에서도 백로그로 명시). 도착은 클라 지오펜스 자동뿐 | W2에서 신규 빌드 — "승격"이 아니라 신규 티켓 |
| 룸 이벤트 로그 | 범용 append-only 로그 없음. `tour_room_messages.metadata.kind`가 사실상의 이벤트 버스, `tour_room_spot_events`는 3종 한정 | 신규 `tour_room_events` 테이블 (§B P-D5) |
| 일정 소스 | 룸은 `tours.schedule` jsonb 단일 소스만 읽음(`lib/tour-room/snapshot.ts`, 컨시어지 ctx.schedule 동일). `bookings.itinerary.poi_keys`는 존재하나 룸이 안 읽음. **day_plans·리졸버 체인 없음** | W0 = 리졸버 체인 신설 + 소비처 3곳 교체(snapshot·concierge ctx·guide overview) |
| 손님 니즈(A10) 저장처 | bookings에 인원 분리(성인/아동)·아동 나이·식이 필드 **없음** — `number_of_guests`+`itinerary.pax`(정수)+자유텍스트 `special_requests`뿐. lead booker 개념도 없음 | `day_plans.needs` jsonb로 신설 (§B P-D11) — bookings 스키마 불변 |
| 웹푸시 | `push_subscriptions`는 `role CHECK IN ('admin','guide')` — **여행자 푸시 없음**. 여행자는 Broadcast+SSE+이메일뿐 | role에 'customer' 추가 마이그레이션 + 룸 페이지 구독 UI (§B P-D7) |
| STT 실시간 번역 | 연속 통역 모드는 스켈레톤(caption 이벤트+배너)만; 주 경로는 녹음→확인→송신 | BRIDGE는 정형 문구가 주력, STT 딥링크는 기존 컴포저 보이스 모드로 연결 (연속통역 확장은 안티스코프 유지) |
| 6개 국어 CARD | 룸 런타임 로케일은 **5개**(`ROOM_LOCALES = en/ko/zh/ja/es`, zh-TW→zh 폴딩; 사이트 next-intl 6로케일과 별개) | 본 플랜의 모든 정형 카피는 **룸 5로케일 규약**을 따른다 (§B P-D10) |

### A-3. 부재 — v1이 존재를 가정했으나 없음 ❌

| v1 가정 | 사실 | 결정 |
|---|---|---|
| driver / lead 역할 | 역할은 customer/guide/admin/system뿐. 토큰 scope는 booking(customer)·tour-date(guide) 2종 | 신규 driver scope (§B P-D3), lead는 플래그로 |
| WhatsApp/LINE 미러 | 코드베이스에 WhatsApp·LINE·Kakao·Twilio·SMS 연동 일체 없음 (`sent_via='sms'` enum만 미사용 상태로 존재) | **안티스코프로 강등** (§K) — 크리티컬 폴백은 손님 웹푸시+이메일 재사용 |
| 네이버·카카오 길찾기 딥링크 | 지도는 100% Google. `nmap://`·`kakaomap://` 헬퍼 없음 | W3에서 신규 `lib/tour-room/nav-links.ts` (순수 URL 빌더, 소규모) |
| Stripe 증액/Payment Link | `incrementAuthorization`·Payment Link·ad-hoc charge 전부 없음. 홀드 금액은 PI 생성 시 고정, 초과 캡처 불가 | 연장·대납 정산 = **신규 off-session PI** (§B P-D2) |
| poi_travel_matrix / Distance Matrix API | 없음 — 전부 합성(haversine×1.55) | W5 플라이휠로 신설, 초기값 합성 유지 |
| open_hours 정형 컬럼 | `match_pois.visit_basics.hours`는 자유텍스트("Daily 04:30–19:20…") — 기계 검사 불가 | A5 영업시간 충돌 검사는 v1.5로 강등, W1은 휴무(A4)+총합(A3)만 (§B P-D9) |
| 투어룸 크론/48h 보존잡 | 투어룸 관련 크론 0개, R-17 퍼지잡 미구현, 룸 닫힘은 lazy | ESCALATE는 크론 없이 시간파생 (§B P-D6); 사후 48h는 grace 상수 확장 (§B P-D12) |
| Supabase Edge Functions | `supabase/functions/` 없음 — 전부 Next 라우트+Vercel Cron | v1 §1의 "edge cron" 표기 정정: 배치는 Vercel Cron으로 |
| 예산 통합(§H-6) | `TOUR_ROOM_DAILY_AI_BUDGET`/`tour_ai_cost`는 문서에만 존재, 컨시어지는 독립 카운터(`TOUR_ROOM_CONCIERGE_DAILY_CAP`, 기본 300, fail-open) 사용 | 위생 티켓으로 W4에 편입 (선택) |

---

## §B. 바인딩 결정 P-D1 ~ P-D14 (오픈 퀘스천 4개 포함 확정)

| # | 결정 | 근거 |
|---|---|---|
| **P-D1** | **match_pois ↔ POI KB(82)는 이원 유지, poi_key가 조인 키.** /plan 피커·지도·이동시간은 match_pois(lat/lng·images·content_locales 보유)를 읽고, 룸 내 콘텐츠·즉답은 poi_kb JSON을 읽는다. 단일화하지 않는다 — 두 저장소는 갱신 주기·소비자·배포 방식(DB vs 빌드타임 JSON)이 다르다. poi_travel_matrix는 poi_key 기준이라 양쪽을 다 서빙 | 오픈퀘스천 #1. `tour_guide_spots.poi_key`는 이미 JSON 쪽을 키잉, match_pois만 lat/lng 보유 — 억지 단일화는 두 파이프라인(import-match-v18, spotContent)을 동시에 부순다 |
| **P-D2** | **연장·대납 정산 = 당일 가이드에게 현금 직불 (사용자 확정 2026-07-16).** Stripe는 개입하지 않는다 — LEDGER는 결제 장치가 아니라 **투명성·기록 장치**다: 항목·금액(KRW, 참고 환산 병기)·영수증 사진을 룸에 남기고, 손님이 [확인] 원탭 → confirmed, 현금 수취 시 가이드가 [수취 완료] → settled. 분쟁 예방(금액 합의 증거)과 운영 정산(가이드↔본사) 근거가 목적. off-session PI 레일은 v2 백로그(현금 없는 손님 케이스가 실제로 누적되면 재평가) | 오픈퀘스천 #2 확정. 현금 직불이 운영 현실 — Stripe 레일(증액 불가, off-session 신규 PI 필요)은 개발·수수료·3DS 실패 대응 비용 대비 가치 없음 |
| **P-D3** | **드라이버 = 신규 토큰 scope `{scope:'tour-date', role:'driver', tourId, tourDate}` + 입장 시 차량번호 뒤 4자리 PIN 확인.** PIN은 `tour_bus_details`(기존 테이블) 참조. ~~손님 채팅 접근 없음~~ → **P-D15로 개정(2026-07-17)**: 채팅은 음성 브릿지 레인으로 허용, PII 차단은 유지(표시 이름만 — 연락처·예약 상세·정산 접근 없음). 링크 유출 시 노출 = 일정+익명화된 대화이므로 PIN 수준 유지 | 오픈퀘스천 #3. 위험 표면 분석 결과 + 사용자 방향 확정 |
| **P-D4** | **다일 대비는 `day_plans.tour_date` 키만 지금 넣는다(무비용).** 다일 UI·룸 분할은 전부 v2 | 오픈퀘스천 #4. 합의 유지 |
| **P-D5** | **`tour_room_events` 신규 테이블 = 프리미티브 공통 이벤트 로그.** `tour_room_messages`를 오염시키지 않는다(피드는 사용자 가시 평면 유지). 사용자에게 보여야 하는 이벤트만 message 캡슐을 **병행 insert**(기존 `metadata.kind` 패턴). 단계 이벤트(ESCALATE)는 `UNIQUE(room_id, subject_key, type)` 부분 유니크로 idempotent | spot_events 패턴의 일반화. 피드 오염 방지 + 재계산·감사추적 원천 확보 |
| **P-D6** | **ESCALATE는 크론 없이 순수 시간파생 상태로 구현.** rally 상태(remind/due/overdue/contact)는 `set_at`+`due_at`+now의 순수 함수(= `activeNotice()`의 기존 방식). 단계 진입 시점의 부수효과(가이드 알림 등)는 클라이언트(손님 룸·가이드 콘솔 15s 폴)가 임계 통과를 감지해 idempotent 이벤트 insert → 서버가 UNIQUE 충돌로 중복 차단 후 1회만 팬아웃. 크론은 만들지 않는다 | Vercel Cron은 일 단위 운용 중, 분 단위 에스컬레이션에 부적합. notices.ts가 이미 이 패턴의 증명 |
| **P-D7** | **손님 크리티컬 알림 = 웹푸시 확장(신규) + 이메일 폴백(기존).** `push_subscriptions.role`에 'customer' 추가, 룸 최초 진입 시 집합·지연 2종에 한해 푸시 옵트인 유도. WhatsApp/LINE 미러는 연동 자산이 0이므로 **v1 범위에서 제외**(§K 안티스코프, v2 재평가) | v1 §2.1의 미러 옵션은 코드 현실과 괴리. 푸시 인프라(VAPID·SW)는 ops용이 이미 있어 role 확장이 최소 경로 |
| **P-D8** | **Tier0 우선순위 사다리 = `notices.ts` → `activeCard()` 리졸버 확장.** `SOS > 집합(활성 rally) > 지연 > 차량찾기(핀 활성) > 다음 스팟 ETA > 도착 콘텐츠 > 정산(대기) > 사후`. 부유 배너 존(RoomShell 기존)에 최상위 1장 + 시트에 전체 스택 | 신규 카드스택 컴포넌트를 만들지 않고 기존 배너 인프라의 선택 로직만 교체 |
| **P-D9** | **실행가능성 v1 범위 = ① 총합 검사(Σ체류+이동 vs 예약시간, `driveMinutes` ×1.55/38km/h 재사용) ② 휴무 검사(`place-operating-rules.ts` 재사용 + poi_key 매핑 레이어 추가) ③ 권역 검사(반경).** 영업시간 정밀 충돌(A5)은 open_hours 정형화가 선행돼야 하므로 v1.5. 전부 경고만, 차단 없음 | visit_basics.hours가 자유텍스트라는 코드 사실 |
| **P-D10** | **본 플랜의 모든 정형 카피(SIGNAL 라벨·CARD·phrase_templates)는 룸 5로케일(en/ko/zh/ja/es) 규약**, 컨시어지 `CONCIERGE_COPY` 하드코딩 패턴 준용(무LLM). 드라이버 뷰는 KO 단일 | zh-TW 폴딩은 기존 규약 |
| **P-D11** | **A10 니즈(인원구성·아동나이·유모차/휠체어·짐·식이·페이스)는 `day_plans.needs` jsonb에 저장.** bookings 스키마 불변(과거 additive-only 원칙과 일관). 알레르기 등 민감정보는 룸 종료+30일 후 퍼지 대상(§C-7) | bookings에 필드 없음이 코드 사실. day_plan이 booking-scoped라 자연스러운 귀속처 |
| **P-D12** | **사후 48h 윈도우 = `ROOM_GRACE_MS` 24h→48h 확장이 아니라, `ended` 상태에서 '분실물·정산·리뷰' 3개 액션만 허용하는 `post_tour` 서브윈도우(tour-day-end +48h)를 time.ts에 추가.** 채팅 재개는 아님 | 룸 read-only 원칙 유지하면서 I3/G4/I5만 통과 |
| **P-D13** | **/plan 편집권 = lead guest 단독.** lead = 룸 최초 join한 customer participant에 `is_lead` 플래그(신규 컬럼) — 별도 초대 체계를 만들지 않음. booking의 contact_email 소유자가 세션 로그인 시 lead 승계 가능 | lead booker 개념 부재가 코드 사실. 최소 침습 |
| **P-D14** | **course_templates는 신규 테이블이 아니라 `match_itinerary_stops` + 정적 JSON `itineraryStops`를 읽는 변환 스크립트 → `course_templates` 테이블 1회 시딩.** 변환의 대부분(poi_key 링크)은 import-match-v18이 이미 해놓음 — 남은 작업은 duration/시각 파싱과 지역 필터 메타뿐 | v1이 "매핑 검증이 작업의 대부분"이라 한 우려는 이미 해소된 상태 |
| **P-D15** (2026-07-17 사용자 확정) | **드라이버 보이스 브릿지 = 프라이빗 모드의 1순위 기능.** 기사↔손님 실시간 소통을 기존 채팅 파이프라인(STT→번역→브로드캐스트 말풍선, 번역캐시, D-8 로케일 타깃팅) 위에 얹는다. 기사 전용 확장 4가지: ① **핸즈프리 송신** — 원탭 녹음→STT→자동 송신(확인 단계 제거, 3초 실행취소), ② **운전 UI** — 초대형 마이크 버튼+대형 버블, 타이핑 없음, ③ **수신 자동 TTS** — 손님 메시지를 한국어 번역으로 자동 음성 재생(기존 `tour_room_tts_cache` 재사용; 운전 중 화면 읽기 금지 원칙), ④ `tour_room_messages.sender_role`에 'driver' 추가(마이그레이션). 손님 쪽은 기존 컴포저 그대로(타이핑+음성 양방). **연속 동시통역이 아니라 메시지 단위 브릿지** — caption 스켈레톤 확장은 여전히 안티스코프. phrase_templates 정형 문구는 폴백/보조로 유지 | 사용자: "가장 중요한 건 기사↔손님 실시간 소통". 코어 파이프라인(STT·번역·브로드캐스트·TTS)이 전부 프로덕션 가동 중 — 신규는 기사용 셸뿐 |
| **P-D16** (2026-07-17 사용자 확정) | **비등록 스팟 자동 POI 콘텐츠 파이프라인 — "사실은 Places, 서사만 LLM".** 트리거 = day_plan `guide_confirmed`(비동기, 전날 저녁): poi_kb에 없는 스톱(구글·free)만 잡 생성 → ① 사실 소스 = **Google Places Details**(`place_id`는 /plan 탭②에서 기확보; 영업시간·주소·좌표·평점) ② LLM(gemini, low temp)은 Places 사실 위에 서사(스토리·팁·에티켓)만 생성 ③ **비평가 2패스**가 사실성 주장(가격·시간 등)을 Places 데이터와 대조, 검증 불가 주장 제거 — 실패 시 기존 tier-3 정직 null 폴백 ④ 서빙 = spotContent 폴백에 'generated' 티어 삽입(`curated → poi_kb → generated → null`) — 도착 카드·컨시어지 즉답 자동 수혜, **"AI 생성 안내" 출처 배지 필수**, 손님 로케일만 생성(D-8) ⑤ 가이드 콘솔 검토·수정 가능하되 미검토여도 배지 달고 자동 라이브 ⑥ 반복 생성 스팟은 플라이휠 ④로 poi_kb 승격. 비용 = 스톱당 LLM 2~3콜, 기존 컨시어지 일일 예산 카운터 편승. 저장 = 신규 `generated_spot_content`(booking 스코프, 로케일별 jsonb) | 사용자 확정. 환각 방지의 핵심은 "LLM이 검색"이 아니라 사실/서사 분리 + 비평가 패스 + 정직 폴백. free 스톱(place_id 없음)은 이름만으로 생성하되 사실성 주장 전면 금지 프롬프트 |

---

## §C. 데이터 레이어 v2

### C-1. 신규 테이블 (마이그레이션 4본, 전부 additive)

```sql
-- ① 20260717_smart_guide_core.sql
day_plans (
  id uuid PK, booking_id uuid FK, room_id uuid FK NULL,   -- 룸 미개설 시점(D-1)에도 생성 가능
  tour_date date NOT NULL,                                 -- P-D4 다일 대비 키
  status text CHECK IN ('guest_draft','guide_confirmed','live','done') DEFAULT 'guest_draft',
  stops jsonb NOT NULL DEFAULT '[]',                       -- §C-2 stop 스키마
  needs jsonb,                                             -- P-D11: A10 니즈 체크리스트
  feasibility jsonb,                                       -- 경고 스냅샷 (엔진 출력 캐시)
  version int NOT NULL DEFAULT 1,
  updated_by text, updated_at, created_at,
  UNIQUE (booking_id, tour_date)
)

tour_room_events (                                         -- P-D5 프리미티브 공통 이벤트 로그
  id uuid PK, room_id uuid FK, booking_id uuid,
  type text NOT NULL,        -- 'pin_dropped','rally_set','rally_stage','signal','plan_mutated',
                             -- 'extra_logged','extra_confirmed','settled','snapshot_saved' ...
  actor_role text CHECK IN ('customer','guide','driver','admin','system'),
  actor_participant_id uuid NULL,
  subject_key text,          -- idempotency 스코프 키 (예: 'rally:{rallyId}:overdue')
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
)
CREATE UNIQUE INDEX ON tour_room_events (room_id, subject_key, type) WHERE subject_key IS NOT NULL;

pins (
  id uuid PK, room_id uuid FK,
  kind text CHECK IN ('parking','rally','pickup','vehicle_arrived','lost_me'),
  lat numeric NOT NULL, lng numeric NOT NULL,
  label text, photo_url text,
  expires_at timestamptz,                                  -- 원샷 TTL. lost_me 기본 30분
  created_by_role text, created_by_participant_id uuid, created_at
)

extras_ledger (
  id uuid PK, room_id uuid FK, booking_id uuid FK,
  item text NOT NULL, amount_krw int NOT NULL,
  payer text CHECK IN ('guide','driver'),
  kind text CHECK IN ('advance','extension','parking','other'),
  receipt_photo_url text,
  status text CHECK IN ('logged','confirmed','settled','voided') DEFAULT 'logged',
  settled_via text CHECK IN ('cash') NULL,                 -- P-D2: 현금 직불 단일. 'stripe'는 v2 백로그 시 enum 확장
  created_at, updated_at
)

-- ② 20260717_smart_guide_driver_lead.sql
ALTER tour_room_invites: role CHECK에 'driver' 추가 (P-D3)
ALTER tour_room_participants: role CHECK에 'driver' 추가, is_lead boolean DEFAULT false (P-D13)
ALTER push_subscriptions: role CHECK에 'customer' 추가 (P-D7)

-- ③ 20260717_smart_guide_templates.sql
course_templates (region, title_i18n jsonb, stops jsonb, total_hours numeric,
                  origin_tour_slug text, created_at)       -- P-D14 시딩 대상
hotel_pickup_notes (id, place_ref text, place_id text NULL, notes_ko text,
                    notes_i18n jsonb, best_spot_lat/lng numeric NULL,
                    harvested_from_booking uuid NULL, created_at, updated_at)
phrase_templates (key text PK, audience text CHECK IN ('driver','staff'),
                  ko, en, zh, ja, es text)                  -- P-D10 5로케일

-- ④ 20260717_smart_guide_travel_matrix.sql  (W5 시점)
poi_travel_matrix (from_key text, to_key text, daypart text CHECK IN ('am','midday','pm','evening'),
                   minutes_p50 numeric, samples int, updated_at,
                   PRIMARY KEY (from_key, to_key, daypart))
```

RLS: 전 테이블 service-role 전용(기존 tour_room 계열과 동일 — API 라우트가 `resolveRoomActor()`로 인가). `get_advisors` 재실행 필수.

### C-2. stop jsonb 스키마 (v1 유지 + 정정)

```jsonc
{
  "id": "uuid", "seq": 1,
  "source": "poi | google | free",
  "poi_key": "haedong_yonggungsa",        // source=poi. match_pois·poi_kb 조인 키 (P-D1)
  "place_id": "ChIJ...",                  // source=google
  "name_i18n": { "en": "...", "ko": "..." },
  "stop_type": "pickup | sight | meal | shop | rest | dropoff",
  "arrival_planned": "09:30", "duration_min": 60,
  "meta": { "indoor": null, "tickets_included": false, "meal_included": false,
            "cash_hint_krw": null, "stroller_ok": null, "wheelchair_ok": null,
            "signal_weak": false, "dietary_tags": [] },
  // ⚠ meta는 poi_kb/visit_basics에서 자동 채움 시도 → 없으면 null 정직 유지 (A-3 open_hours 참조)
  "status": "pending | en_route | arrived | free_time | regrouped | done | skipped",
  "skip_reason": "closed | weather | crowd | guest_request | time",
  "actual": { "arrived_at": null, "left_at": null },
  "memo_guest": "", "memo_guide": ""
}
```

### C-3. 상태머신 4종 (v1 유지)

```
day_plan : guest_draft → guide_confirmed → live → done
           (편집권: draft = lead guest / confirmed 이후 = guide 단독)
stop     : pending → en_route → arrived → free_time → regrouped → done  ↘ skipped(reason)
rally    : set → remind(T-10) → due(T0) → overdue(T+5) → contact(T+10) → resolved
           (P-D6: 상태는 시간파생 순수 함수, 부수효과만 idempotent 이벤트)
extra    : logged → confirmed(guest ack) → settled(현금 수취, guide ack) | voided
```

### C-4. 일정 리졸버 — 4단 체인 (신설, W0의 본체)

`lib/tour-room/dayPlan.ts` (신규):
`① day_plans(status IN confirmed/live/done, tour_date=오늘) → ② bookings.itinerary.poi_keys → ③ tours.schedule → ④ null(정직 폴백)`

**소비처 교체 3곳(전부 기존 파일):** `lib/tour-room/snapshot.ts`의 schedule 소스, 컨시어지 라우트의 `ctx.schedule` 조립부, `app/api/tour-mode/guide/overview/route.ts`. 셋 다 이 체인 하나만 읽도록 수렴 — 이게 W0의 수용 기준이다.

### C-5. 실행가능성 엔진 v2 (전부 경고, 차단 없음 — P-D9)

| 검사 | v1 웨이브 | 구현 |
|---|---|---|
| 총합 (Σ체류+이동 vs 예약시간) | **W1** | `driveMinutes()`(×1.55, 38km/h) 재사용, poi_travel_matrix 보유 쌍은 p50 우선 (W5 이후) |
| 휴무 | **W1** | `place-operating-rules.ts` 재사용 + `POI_KEY_OPERATING_MAP`(poi_key→룰 키워드 매핑 레이어) 신규 |
| 권역 (서비스 반경 밖) | **W1** | region centroid 반경 검사 → "가이드 확인 필요" 플래그 |
| 영업시간 정밀 충돌 (A5) | v1.5 | visit_basics.hours 파싱기 또는 poi_kb 정형 필드 추가가 선행 (§L-2) |

### C-6. Tier0 카드 우선순위 (P-D8)

`lib/tour-room/notices.ts` → `activeCard(events, pins, rally, plan, now)` 확장.
`SOS > 집합(활성 rally 카운트다운) > 지연(ETA) > 차량찾기(활성 pin) > 다음 스팟 ETA > 도착 콘텐츠 > 정산(대기 extras) > 사후 카드`
렌더는 기존 부유 배너 존(RoomShell) 최상위 1장 + 탭/시트에서 전체 스택.

### C-7. 프라이버시·보존

- 위치는 **원샷 핀만**(pins.expires_at TTL). 상시 추적 없음 — 기존 원칙 유지. lost_me 핀 기본 TTL 30분.
- `day_plans.needs`(식이·알레르기·아동 나이)는 민감정보 — 투어 종료 +30일 퍼지 배치(W5, R-17 미구현 퍼지잡과 묶어 신설).
- 드라이버는 손님 이름·연락처·채팅에 접근 불가(전용 라우트가 스톱명·시각·핀만 반환).
- extras_ledger 영수증 사진은 Storage private 버킷.

### C-8. 역할·권한 (v1 유지 + P-D3/P-D13 반영)

| 역할 | 권한 | 인증 |
|---|---|---|
| lead guest | /plan 편집(확정 전), SIGNAL 전종, 정산 확인 | 매직링크 (기존 customer scope) + is_lead |
| member guest | 열람 + SIGNAL(길잃음·도움요청) | 매직링크 |
| guide | 전권: confirm, MUTATE, rally, LEDGER, 수동 도착 트리거 | 기존 tour-date guide scope |
| driver | KO 5버튼 뷰 + **보이스 브릿지 채팅(P-D15)**. PII 접근 없음(표시 이름만 — 연락처·예약 상세·정산 불가) | 신규 driver scope + 차량번호 뒤 4자리 PIN |

---

## §D. 프리미티브 8개 → 구현 매핑

| 코드 | 프리미티브 | 재사용 | 신규 |
|---|---|---|---|
| **PIN** | 위치핀 (parking/rally/pickup/vehicle_arrived/lost_me, 원샷+TTL) | SOS의 원샷 위치 패턴, broadcast | `pins` 테이블, drop/expire API, 지도탭 핀 렌더 |
| **TIMER** | 집합·지연ETA·자유시간 | **`notices.ts` activeNotice + NoticeBanner + 가이드 콘솔 발송 UI가 이미 80%** | rally에 PIN 연결, activeCard 승격 |
| **SIGNAL** | 역할별 원탭 정형 신호 (자유텍스트 없음) | broadcast 라우트의 무LLM 템플릿(quickReplies 패턴), 5로케일 카피 규약 | 손님 3버튼([늦어요][잠깐 서고 싶어요][길을 잃었어요])·가이드([도착했어요])·드라이버 5버튼, `tour_room_events` 기록 |
| **MUTATE** | skip/swap/reorder/insert + reason_code | 팬아웃, day_plan version | mutate API + 가이드 콘솔 UI + 교체 추천(동일 category·반경 N km — match_pois lat/lng·category 컬럼 재사용) |
| **LEDGER** | 지출 기록 → 현금 직불 확인 (P-D2: 투명성 장치, 결제 장치 아님) | broadcast, Storage(영수증) | `extras_ledger`, 기록/확인/수취완료 API, 정산 카드(내역+KRW+참고 환산) |
| **CARD** | 정적 지식 카드 (비상/대사관/에티켓/호텔픽업/차량/알레르기) | poi_kb JSON, SOS 5로케일 템플릿 패턴, `tour_bus_details` | 정적 카드 세트(코드 상수, P-D10), 알레르기 카드 생성기(needs→KO 카드) |
| **ESCALATE** | 시간 상태머신 (rally 사다리) | **spot_events UNIQUE 패턴 + activeNotice 시간파생 패턴** (P-D6) | `rallyStage()` 순수 함수 + 임계 통과 이벤트 insert 훅 |
| **BRIDGE** | **드라이버 보이스 브릿지(P-D15 승격)** — 기사↔손님 메시지 단위 실시간 소통 + 정형 문구 폴백 | STT 라우트, 메시지 번역+`tour_translation_cache`, D-8 로케일 타깃팅, broadcast 말풍선, `tour_room_tts_cache`, Composer 보이스 모드(손님 쪽 그대로) | 기사 핸즈프리 송신(원탭·자동송신·3초 취소), 운전 UI(대형 마이크+대형 버블), 수신 자동 한국어 TTS, sender_role 'driver' 마이그레이션, `phrase_templates` 폴백 시딩 |

---

## §E. 알림 매트릭스 (P-D7 반영 개정)

| 이벤트 | 손님 | 가이드 | 드라이버 |
|---|---|---|---|
| rally_set | **인앱 배너(activeCard) + 웹푸시(옵트인 시)** | — | 복귀시간 카드 |
| rally T-10 / T+5 | 배너 리마인드 / "일행 대기 중" 전환 | — / 콘솔 어텐션 | — |
| delay (driver) | 새 ETA 카드 + 웹푸시 | 콘솔 알림 | (발신자) |
| plan MUTATE | 일정 카드 재발송(피드 캡슐) | (발신자) | 뷰 갱신 |
| parking_pin / vehicle_arrived | 차량찾기 카드 | — | (발신자) |
| SOS / vehicle_issue | 상태 카드 | **기존 SOS 파이프(이메일+ops푸시+관제핀)** | 강알림 |
| extra logged | — | 확인 요청 | — |
| settlement | 정산 카드(현금 직불 안내+내역) | 수취 완료 확인 | — |

- 손님 푸시는 **집합·지연 2종 크리티컬만** 발송(옵트인). 미옵트인 손님 = 인앱 배너 + (rally overdue 시) 기존 이메일 레일.
- WhatsApp/LINE 미러: **v1 제외** (§K).

**운영 원칙 3줄 (v1 유지):** ① 손님의 모든 문제는 즉답 아니면 원탭 인간 에스컬레이션 ② 가이드·드라이버의 모든 액션은 2탭 이내 ③ 위치는 원샷 핀만.

---

## §F. 나노 시나리오 카탈로그 — 79건 (v1 유지, ✏️ = 코드 감사 반영 정정)

등급: ★ MVP필수 · ◆ v1.5 · ▽ v2 · BL 백로그. 해결 열의 대문자는 §D 프리미티브.

### A. D-1 사전선택 링크 /plan — 12건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| A1 | 링크를 안 엶 | D-1 20:00 리마인드 1회(기존 이메일 reminders 크론에 편승) → 미제출 시 아침 확정 플로우 폴백 | ★ |
| A2 | 작성 중 이탈 | 자동저장(draft) + "이어서 완성" 배너 | ★ |
| A3 | 물리적 불가능 코스 | 총합 경고 배지(차단X) + 대안 힌트 ✏️(driveMinutes ×1.55 재사용) | ★ |
| A4 | 휴무일 POI 선택 | ✏️ `place-operating-rules.ts` + poi_key 매핑으로 "월요일 휴관" 배지 | ★ (◆→★ 승급: 자산이 이미 있어 비용 소) |
| A5 | 영업시간 충돌 | "17:40 도착·18:00 폐장" 경고 ✏️ open_hours 정형화 선행 필요 | ◆→**v1.5 확정** |
| A6 | 서비스 권역 밖 | 거리 플래그 + "가이드 확인 필요" 상태 | ★ |
| A7 | 일행 간 편집 충돌 | lead guest 단독 편집(P-D13 is_lead), version 필드 | ★ |
| A8 | 확정 후 변심 | 읽기전용 전환 + "변경 요청" SIGNAL → 가이드 diff 검토 | ◆ |
| A9 | 픽업 위치 모호 | 픽업핀 확정 카드: 핀 드롭 or 장소 검색 → PIN(pickup) ✏️(PickupPointSelector·HotelMapPicker 재사용) | ★ |
| A10 | 니즈 미수집 | /plan 필수 스텝 → `day_plans.needs` (P-D11) → 전 구간 재사용 | ★ |
| A11 | 시차 착오 | 모든 시각 "KST" 라벨 + 기기 로컬시간 병기 ✏️(time.ts KST 유틸 재사용) | ◆ |
| A12 | 데이터 요금제 없음 | D-1 CARD: eSIM/와이파이 안내 | ◆ |

### B. 픽업 (T-30 ~ T+15) — 8건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| B1 | 차를 못 찾음 | 차량 카드(차종·색·번호판·기사 사진 — ✏️`tour_bus_details` 재사용) + vehicle_arrived PIN | ★ |
| B2 | 손님이 안 내려옴 | [도착했어요] SIGNAL → 룸 푸시 ✏️2회째 미러는 이메일 레일(WhatsApp 아님) | ★ |
| B3 | 드라이버 지연 | 드라이버 [지연] +5/+10/+20 → SIGNAL+TIMER → 새 ETA 카드 | ★ |
| B4 | 만남 지점 혼선 | hotel_pickup_notes CARD (플라이휠 ②로 축적) | ◆ |
| B5 | 신원·신뢰 불안 | 그리팅 CARD: 가이드 사진 + 관광통역안내사 자격 배지 + 차량번호 | ★ |
| B6 | 항공·크루즈 지연 | 손님 [늦어요] SIGNAL → 가이드 승인 시 전체 시간 시프트(MUTATE) | ◆ |
| B7 | 차량 편의 궁금 | 어메니티 표기 | ▽ |
| B8 | 탑승 직후 브리핑 | 확정 일정 카드 재발송 + "오늘의 흐름" 요약 | ◆ |

### C. 이동 중 — 7건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| C1 | "얼마나 걸려요?" | 다음 스팟 ETA — ✏️초기 합성(×1.55), poi_travel_matrix 실측으로 정교화(W5) | ★ |
| C2 | 급한 화장실·휴게 | [잠깐 서고 싶어요] SIGNAL → 가이드+드라이버 동시 수신 | ★ |
| C3 | 멀미 | 컨시어지 즉답 + C2 연결 | ▽ |
| C4 | 이동 중 지루함(아이) | "가는 길 티저" 카드: 다음 POI KB 스토리 ✏️stories 필드는 신규(§L-3) | ◆ |
| C5 | 이동 중 목적지 변경 요청 | 가이드 유도 고정 — 수정은 가이드 MUTATE 단일화 | ★ |
| C6 | 장거리 구간 | 90분+ 구간 → 가이드 콘솔 "휴게 삽입 제안" 힌트 | ▽ |
| C7 | 드라이버↔손님 소통(운전 중 포함) | ✏️**P-D15 보이스 브릿지**: 기사 원탭 녹음→자동 송신→손님 언어 말풍선 / 손님 답장(타이핑·음성)→기사에게 자동 한국어 TTS. 정형 문구는 폴백 | **★ (◆→★ 승급, 1순위)** |

### D. 스팟 도착 — 8건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| D1 | 지오펜스 미발화 | ✏️프라이빗 기본 = 가이드 [도착] 수동 — **§O-8은 미구현이므로 W2 신규 빌드**, 지오펜스는 보조 | ★ |
| D2 | free·구글 스톱 콘텐츠 없음 | ✏️**P-D16 자동 생성 파이프라인**(confirm 시 Places 사실+LLM 서사+비평가 검증 → 'generated' 티어, AI 배지). 생성 실패 시 tier-3 null 정직 폴백(기존) + harvest 큐 적재 | ★ |
| D3 | 주차장이 입구에서 멂 | 드라이버 [주차핀] → parking PIN·집합 PIN 분리 + 도보 링크 | ★ |
| D4 | 티켓·줄 혼선 | 스톱 meta 표기 + 가이드 퀵노트 | ◆ |
| D5 | 예상 밖 휴무 | [교체] MUTATE: 동일 category·반경 N km 추천(match_pois) → 원탭 스왑, reason=closed | ★ |
| D6 | 우천(야외 스팟) | D5 + indoor 필터 ✏️indoor는 matching_profile jsonb 추론(poi-taxonomy.ts) 재사용, 정형 컬럼은 없음 | ★ |
| D7 | 인파·대기 과다 | [순서 변경] MUTATE, reason=crowd | ◆ |
| D8 | 현금 필요 스팟 | "현금 ~₩OO 권장" ✏️visit_basics.admission 텍스트 표기로 v1, 정형 cash_hint는 §L-3 | ◆ |

### E. 자유시간·집합 — 8건 (프라이빗 최대 페인포인트)

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| E1 | "몇 시까지 어디로?" | ✏️기존 meeting_notice+free_time_timer 확장: rally PIN+TIMER → activeCard 최상단, 드라이버 전파 | ★ |
| E2 | 미복귀 | ESCALATE 사다리 (P-D6 시간파생): T-10 리마인드 → T0 → T+5 가이드 알림+"일행 대기 중"+길찾기 → T+10 상호 원탭 전화 카드 | ★ |
| E3 | 길 잃음 | [길을 잃었어요] → lost_me 원샷 PIN(TTL 30분) + 집합점 도보 링크(J1) | ★ |
| E4 | 일행 분산 | 집합은 파티 단위 유지. 멤버별 개별 집합은 v2 | BL |
| E5 | 폰 배터리 사망 | 집합 카드 "스크린샷 권장" 배너 + 버디 룰. 가이드는 예약 연락처 보유 | ◆ |
| E6 | 무신호 지역 | POI signal_weak 플래그 → 도착 전 로컬 스냅샷(day_plan+핀+연락처) + "지금 저장" 배너 | ◆ |
| E7 | "화장실·포토스팟?" | poi 스톱 = Tier0 즉답(기존 그대로), free 스톱 = 프라이빗 완화 프롬프트(일반지식 허용) | ★ |
| E8 | 자유시간 연장·단축 | TIMER 갱신 → 재팬아웃 ✏️(가이드 콘솔 타이머 UI 기존) | ★ |

### F. 식사 — 6건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| F1 | 알레르기·식이 | needs → 식사 스톱 카드 자동 표기 + **한국어 알레르기 카드 생성**(BRIDGE+CARD) | ★ |
| F2 | 할랄·채식 | POI meal 태그 필터 + 추천 코스 반영 | ◆ |
| F3 | 식당 만석·휴무 | D5 스왑 + dietary_tags 유지 필터 | ★ |
| F4 | 포함/불포함 혼선 | meal_included 명시 카드 | ★ |
| F5 | 메뉴 해석 | 대표 메뉴 KB 즉답 ✏️venue_recommendation 가드레일과 충돌 없음(추천이 아닌 해석) — 프롬프트에 구분 명시 | ▽ |
| F6 | 현금/카드 가능 여부 | 스톱 meta 표기 | ◆ |

### G. 비용·정산 — 6건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| G1 | 연장 요청 | 가이드 [연장 견적](KRW+참고 환산) → 손님 룸 수락 → LEDGER(kind=extension), **당일 현금 직불(P-D2)** | ★ |
| G2 | 가이드 대납 | [지출 기록] 영수증+금액 → LEDGER → 손님 [확인] | ★ |
| G3 | 주차비 | 드라이버 [주차비] → LEDGER | ◆ |
| G4 | 종료 정산 | 정산 카드: 항목 내역+합계(KRW, 참고 환산 병기)+"가이드에게 현금으로" 안내 → 가이드 [수취 완료] → settled. ✏️Stripe 개입 없음(P-D2) | ★ |
| G5 | 팁 문화 질문 | 시장별 캔드 답변 KB | ◆ |
| G6 | 택스 리펀 | 즉시환급·공항 절차 KB(최신 기준 재확인 후 카드화) | ◆ |
| +G7 ✏️재정의 | 손님 현금 부족 | 정산 카드에 인근 ATM 안내(글로벌 카드 가능 ATM — 컨시어지 KB) + 가이드와 금액·시점 협의 캡슐. 미수취 extras는 관제 어텐션으로 표면화 | ★ |

### H. 안전·비상 — 7건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| H1 | 부상·급환 | ✏️기존 SOS 파이프 재사용 + SOS CARD 확장: 119·112·**1330(3자 통역)** 원탭 + 현좌표 응급실·약국 검색 딥링크 | ★ |
| H2 | 여권 분실 | 예약 로케일 기반 대사관 CARD + 신고 절차 | ◆ |
| H3 | 아동 일시 실종 | 가이드 강알림 + rally PIN + 안내데스크 + 112. 절제된 단일 카드 | ◆ |
| H4 | 태풍·대설 일 단위 붕괴 | 전면 재편 MUTATE(reason=weather) + 환불 정책 카드 훅 | ◆ |
| H5 | 차량 고장·사고 | 드라이버 [차량 문제] → 가이드+운영 강알림(기존 SOS 레일), 정직한 상태 카드 | ★ |
| H6 | 여행자보험 정보 | needs 선택 입력 → SOS 카드 병기 | ▽ |
| H7 | 통역 필요한 신고 | 1330 3자 통역 안내 SOS CARD 고정 노출 | ★ |

### I. 종료·사후 48h — 7건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| I1 | 드롭오프 ≠ 픽업 | dropoff 스톱 타입, 당일 수정 가능 | ★ |
| I2 | 중간 이탈 | mid dropoff 스톱 insert(MUTATE) | ◆ |
| I3 | 차량 분실물 | ✏️post_tour 48h 윈도우(P-D12): [분실물] → 드라이버 알림 → [찾았어요]+사진 → 회수 조율 | ★ |
| I4 | 사진 공유 | 가이드 앨범 링크 사후 CARD | ◆ |
| I5 | 리뷰 요청 | 채널별 링크 + ✏️**coupon_grants 재사용** 재방문 쿠폰(리뷰 제출 훅에 grant insert — 컨시어지 V4와 병합 실행) | ◆ |
| I6 | 법인 영수증 | PDF 다운로드 | ▽ |
| I7 | 데이터 수확 | ✏️기존 chat_messages→qa_pairs 하베스트에 편승 + free/구글 스톱 로그는 tour_room_events에서 주간 리뷰 잡 | ★ |

### J. 한국 특화 & 페르소나 — 10건

| # | 상황 | 해결 | 등급 |
|---|---|---|---|
| J1 | 도보 길찾기 | 손님 = ✏️**신규 `nav-links.ts`**: 네이버 우선 + 구글 병기 / 드라이버 = 카카오내비·티맵 딥링크 | ★ |
| J2 | 고궁 한복 무료입장·촬영 규정 | POI meta + 컨시어지 KB | ◆ |
| J3 | 사찰 예절 | 도착 카드 에티켓 한 줄 ✏️smartNotes.tip에 이미 일부 존재, 정형 etiquette 필드는 §L-3 | ◆ |
| J4 | 쓰레기통 없음 | 컨시어지 캔드 답변 | ▽ |
| J5 | 드론 금지 구역 | POI meta | ▽ |
| J6 | 설·추석 인파·휴무 | ✏️place-operating-rules에 공휴일 레이어 추가 | ◆ |
| J7 | 미세먼지·폭염·한파 | 날씨 매트릭스: 등급별 실내 스왑 제안 + 준비물 카드 | ◆ |
| J8 | 시니어 페이스 | needs.pace=relaxed → 체류 +20% + 휴게 힌트 | ◆ |
| J9 | 유모차·휠체어 | POI meta 필터 ✏️정형 컬럼 없음 — matching_profile 추론 + 수동 보강 | ◆ |
| J10 | 쇼핑 배송 | 컨시어지 KB | ▽ |

**집계: ★ 33 · ◆ 28 · ▽ 10 · BL 1 · v1.5 확정 1 (+신규 G7)** — MVP는 ★만, v1.5는 ◆에서 선별.

---

## §G. 사전선택 링크 /plan 상세 (W1의 본체)

- 룸 매직링크 인프라 재사용(`token.ts`에 `plan` 용도 플래그 또는 기존 customer scope 그대로 — 링크 하나로 /plan과 룸 모두 진입, 라우팅만 시점 분기), 경로 `/tour-mode/plan/[bookingId]`, 로그인 불요, lead guest 단독 편집(P-D13)
- **탭 ① 추천 코스**: `course_templates` — P-D14 변환 스크립트로 30개 투어 itinerary 시딩(poi_key는 이미 링크됨). 예약 지역 필터, "8h 코스" 배지. "이 코스로" 원탭 후 스톱 빼기/넣기
- **탭 ② 직접 고르기**: match_pois 피커(region·category·images 컬럼 재사용) + Google Places Autocomplete(기존 로더). 구글 선택 시 기존 POI 반경 ~100m + 이름 유사 매칭이면 poi_key 스냅, 아니면 free 스톱
- **탭 ③ 가이드에게 맡기기**: guide_curated 플래그(bookings.itinerary에 기존 존재) + 로비 안내 한 줄
- 스톱별 손님 메모 · A10 니즈 체크리스트(→ needs jsonb) · A9 픽업핀 확정(기존 지도 피커 재사용) · 실행가능성 v1 경고 → 제출 = guest_draft + 가이드 팬아웃
- 가이드 confirm 화면: draft 스톱 diff + 경고 목록 + 원탭 확정(→ guide_confirmed) — 가이드 콘솔에 신설

## §H. 플라이휠 5종 (v1 유지 + 구현처 명시)

1. **실측 이동시간 매트릭스**: stop.actual(arrived_at/left_at) 이벤트에서 (from, to, 분, daypart) 축적 → `poi_travel_matrix` upsert 배치(주간 크론). 초기값 합성(×1.55) 유지, 82×82 사전계산은 불필요(온디맨드 폴백)
2. **호텔 픽업 노트**: 픽업 완료 시 가이드 콘솔 한 줄 입력 → `hotel_pickup_notes` upsert → B4 자동화
3. **휴무 학습**: reason=closed 스왑 이벤트 → 주간 리뷰 큐 → `place-operating-rules.ts` PR 제안(정적 파일이므로 자동 반영이 아닌 제보)
4. **POI 승격**: free·구글 스톱 반복 + 컨시어지 미스 → 기존 qa_pairs 하베스트 + tour_room_events 주간 리뷰 → match_pois/poi_kb 승격
5. **수요 역류**: 손님의 구글 선택 로그(tour_room_events type=plan_mutated·stop source=google) = 신상품 기획 센서

## §I. 빌드 웨이브 WBS (재산정)

**체감 MVP = W0→W3.** 각 웨이브는 티켓·수용 기준·터치 포인트까지 명시. 워크트리 분리 원칙 유지(메인 dir 경합).

### W0 — 스키마 + 리졸버 (규모: 소중)
| 티켓 | 내용 | 수용 기준 |
|---|---|---|
| W0.1 | 마이그레이션 ①② (day_plans·tour_room_events·pins·extras_ledger·driver/lead/customer-push role 확장) | 적용 후 advisors 신규 0 |
| W0.2 | `lib/tour-room/dayPlan.ts` 4단 리졸버 + 소비처 3곳 교체(snapshot.ts·concierge ctx·guide overview) | day_plans 없는 기존 예약이 기존과 동일 동작(회귀 0) — **이게 게이트** |
| W0.3 | tour_room_events 기록/조회 헬퍼 + broadcast 연동 | idempotent insert 유닛 테스트 |

### W1 — /plan 3탭 (규모: 중대)
| 티켓 | 내용 |
|---|---|
| W1.1 | course_templates 변환 스크립트(match_itinerary_stops+정적 JSON → 시딩) + 마이그레이션 ③ |
| W1.2 | /plan UI: 탭 3종 + 스톱 편집 + 니즈 체크리스트 + 픽업핀(A9) + KST 병기(A11) |
| W1.3 | 실행가능성 v1: 총합+휴무(poi_key 매핑 레이어)+권역 — 경고 배지만 |
| W1.4 | draft 제출→가이드 팬아웃 / 가이드 confirm 화면(diff) + A1 리마인드(이메일 크론 편승) |
| W1.5 | **P-D16 자동 POI 콘텐츠 파이프라인**: `generated_spot_content` 테이블 + confirm 훅 잡(Places Details→LLM 생성→비평가 패스→로케일별 저장) + spotContent 'generated' 티어 삽입 + AI 배지 렌더 + 가이드 콘솔 검토 뷰 |

### W2 — 가이드 라이브 콘솔 (규모: 중)
| 티켓 | 내용 |
|---|---|
| W2.1 | **수동 도착 트리거(§O-8 신규 빌드)** — 콘솔 [도착] → spot_arrival 팬아웃(기존 카드 재사용), 지오펜스는 보조로 유지 |
| W2.2 | MUTATE: skip/swap/reorder/insert + reason + 교체 추천(category·반경) + 드라이버 뷰 갱신 |
| W2.3 | rally: 기존 meeting_notice 확장(PIN 연결 + ESCALATE 시간파생) + E8 타이머 갱신 |
| W2.4 | SIGNAL 세트: 손님 3버튼·가이드 [도착했어요]·[지연] + LEDGER 기록 UI(G1/G2) |
| W2.5 | activeCard 우선순위 리졸버(P-D8) + 배너 존 교체 |

### W3 — 드라이버 뷰 (규모: 소중)
| 티켓 | 내용 |
|---|---|
| W3.1 | driver 토큰 scope + 차량번호 PIN 게이트 + 초경량 KO 뷰([다음 목적지+내비][주차핀][지연][도착][차량문제]) |
| W3.2 | `lib/tour-room/nav-links.ts` — 네이버/구글(손님)·카카오내비/티맵(드라이버) URL 빌더 + 유닛 테스트 |
| W3.3 | **P-D15 드라이버 보이스 브릿지**: sender_role 'driver' 마이그레이션 + 기사 핸즈프리 송신(원탭 녹음→STT→자동 송신, 3초 취소) + 운전 UI(대형 마이크·대형 버블) + 수신 메시지 자동 한국어 TTS 재생 + 손님 피드에 driver 버블 스타일. **W3의 본체 — 규모 소중→중 상향** |

### W4 — 가드레일 + 정산 레일 (규모: 중)
| 티켓 | 내용 |
|---|---|
| W4.1 | E2 사다리 완성(전화 카드·이메일 폴백) + 손님 웹푸시 옵트인(집합·지연 2종) |
| W4.2 | E6 오프라인 스냅샷 + E5 스크린샷 배너 |
| W4.3 | CARD 세트: SOS 확장(1330·응급실 딥링크)·대사관·알레르기 생성기·그리팅(B5)·차량(B1) |
| W4.4 | **G4 정산 카드**: 내역 합산+현금 직불 확인 플로우(confirm→settled)+G7 ATM 안내+post_tour 윈도우(P-D12). ✏️Stripe 레일 제거로 규모 축소(중→소) |
| W4.5 (선택) | 컨시어지 예산을 µ$ 가중 통합 카운터로 승격(§A-3 위생) |

### W5 — 플라이휠 + 사후 (규모: 소중)
| 티켓 | 내용 |
|---|---|
| W5.1 | 마이그레이션 ④ + 매트릭스 학습 배치 + 호텔노트 + 휴무학습 리뷰 큐 + POI 승격 잡 |
| W5.2 | I3 분실물 플로우 + I5 리뷰 쿠폰(coupon_grants 훅 — **컨시어지 V4와 병합 실행 권장**) |
| W5.3 | needs 민감정보 퍼지 배치(+R-17 위치 퍼지 동반 구현) |

## §J. KPI·QA 게이트

**북극성**: "가이드가 종이·카톡·구두로 하던 조율이 룸 안에서 끝나는가."

| 지표 | 목표(파일럿) |
|---|---|
| /plan 제출률 (D-1 링크 오픈 대비) | ≥ 60% |
| rally 사용률 (자유시간 있는 투어 대비) | ≥ 80% |
| rally overdue → contact 도달률 | < 10% (사다리가 그 전에 해소) |
| 컨시어지 즉답 비율(Tier0+가드레일/전체) | ≥ 60% (기존 시뮬 기준선 대비) |
| extras logged → settled(현금 수취 확인) 당일 완료율 | ≥ 90% |
| 드라이버 뷰 액션당 탭 수 | ≤ 2 (설계 원칙 준수 검증) |

**QA 게이트**: ① 각 웨이브 tsc 0 + 투어 스위트 green + advisors 신규 0 ② W0.2 회귀 게이트(리졸버 교체 후 기존 룸 무변화) ③ W3 후 실기기 리허설(기존 §I-4 리허설에 드라이버 PIN·핀 드롭·rally 항목 추가) ④ 시뮬 재현 스크립트에 day_plan 시딩 추가(`sim-tour-day.ts` 확장).

## §K. 안티스코프 — 의도적으로 안 만드는 것

상시 위치 추적 · 룸 내 손님 간 채팅 · 환불 자동화 · 멤버별 개별 집합(v2) · 메뉴 사진 OCR · 연장요금 동적 가격 · **연장·대납 온라인 결제 레일(신규 강등 — P-D2 현금 직불 확정, off-session PI는 v2 백로그)** · **WhatsApp/LINE 미러(신규 강등 — 연동 자산 0, P-D7 웹푸시+이메일로 대체, v2 재평가)** · **연속 STT 통역 모드 확장(caption 스켈레톤 유지만)** · Google Distance Matrix API 과금 연동(합성+실측 플라이휠로 충분).

## §L. 잔여 오픈 퀘스천 (사람 결정 필요)

1. **연장요금 단가표** — G1 시간당 단가(언어·차종별?)는 운영 결정. `pricing-policy.ts`에 상수로 넣을지, 가이드 자유 입력으로 시작할지. **권고: v1은 가이드 자유 입력 + 상한 가드.**
2. **open_hours 정형화 시점** — A5를 v1.5로 미뤘으나, poi_kb 82개에 정형 hours 필드를 수동 보강하는 반나절 작업으로 앞당길 수 있음. 콘텐츠 작업 우선순위 결정 필요.
3. **poi_kb 필드 확장(stories·etiquette·cash_hint)** — C4·J3·D8의 품질을 좌우. 82개 × 3필드 콘텐츠 작업 — AI 초안+사람 검수 파이프라인(기존 generate-poi-locales.mjs 패턴)으로 별도 콘텐츠 트랙 권장.
4. **파일럿 대상** — 프라이빗 모드 첫 적용 투어(제주 charter?)와 가이드 1명 지정. 플래그는 기존 `NEXT_PUBLIC_TOUR_MODE_V1` 하위에 `TOUR_ROOM_PRIVATE_MODE` 신설 권장.

## §M. 부록 — API/RPC 목록 (라우트 초안)

기존 `app/api/tour-rooms/[bookingId]/*` 네임스페이스에 증설, 전부 `resolveRoomActor()` 인가:
`plan` (GET draft/confirmed · POST submit_draft · PATCH mutate — 역할 검사 내장) · `plan/confirm` (guide) · `pins` (POST drop · GET active) · `rally` (POST set/update/resolve) · `signals` (POST — 역할별 허용 타입 화이트리스트) · `extras` (POST log · PATCH confirm[guest]/settle[guide, 현금 수취 확인]) · `snapshot` (GET 오프라인 번들) · 드라이버 전용: `app/api/tour-mode/driver/overview`·`driver/signal`.
