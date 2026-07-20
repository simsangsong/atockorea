# 투어모드 실사용 적합성 감사 + 플랜 (2026-07-20)

사용자가 준 **실제 운영 환경**(프라이빗·스몰그룹·버스 3종)에 앱이 맞는지 4트랙 병렬 코드 감사(통역·정산·콘텐츠/핀·역할/콘솔) + 마스터플랜 설계의도 대조로 종합. **이 문서는 리뷰/감사/플랜 — 구현 전 단계.**

---

## 0. 총평 (Executive verdict)

**앱은 "프라이빗 투어(1예약 = 1룸 = 1기사)"를 전제로 매우 잘 설계·구축됐다.** 실시간 통역 브릿지 코어(언어무제한 타깃팅·캐시우선 번역/TTS·zero-LLM 프리셋 폴백·프로바이더 사다리·wake-lock·웹뷰 탈출·핸즈프리 원탭/제로탭)는 견고하다. 정산(LEDGER)·집합(rally)·콘텐츠(4티어 텍스트)·역할 토큰도 프라이빗엔 잘 맞는다.

**세 가지 층위에서 실사용 갭이 있다:**
1. **실시간 통역의 "현장 엣지"** — 코어는 좋으나, **손님 사진/파일이 기사에게 아예 안 보임(P0)**, **번역 실패가 조용히·영구적으로 방치(P0, 플랫한 현장 데이터에서 정확히 발화)**. 통역이 3종 공통 1순위 요구라 이게 최우선.
2. **프라이빗 정산의 실제 돈 규칙** — 오버타임 자동계산 전무, **기사가 자기 정산을 못함**, 제주 픽업비 금액·레일 불일치, 티켓 kind/영수증 미배선.
3. **버스/스몰그룹의 구조적 부적합** — 룸이 예약 단위라 한 차의 여러 예약이 흩어짐; 집합 **지점 맵 핀이 운영자 화면에 없음(텍스트만)**; 기사 신호가 단일 룸 한정; 운영자 타이핑 지명/티켓 텍스트 미번역; **비디오 콘텐츠 전무**.

**한 줄:** 프라이빗은 "엣지 보강"이면 실전 투입 가능. 버스/스몰그룹은 **다예약 룸 모델 + 운영자 맵핀 + 콘텐츠(비디오/지역개요)**라는 신규 설계가 필요.

---

## 1. 시나리오별 요구 → 현재 상태 → 갭

### 시나리오 1 — 프라이빗 (영어불가 택시기사 단독, 실시간 통역)
| 요구 | 현재 상태 | 갭 |
|---|---|---|
| 실시간 통역(양방향, 음성) | ✅ 코어 견고: 원탭 녹음→STT(ko)→번역→손님언어 버블, 손님메시지→자동 한국어 TTS+텍스트. 언어무제한 chat_locale 브릿지 | ⚠️ 손님 사진 안 보임·번역 실패 무복구·audio STT 미검토 전송(§2A) |
| 일정 D-1 확정 | ✅ /plan 편집(프라이빗 전용 #416), 확정→가이드 콘솔 | — |
| 매 장소 집합시간 없음 | ✅ 자유시간/복귀시간(return_time) 카운트다운 | — |
| 제주 9h·부산 8h 기준 | ⚠️ tours.duration 문자열(표시용), LEDGER와 연결 0 | 기준시간 개념 없음 |
| 오버타임 30k/h 현금 | ⚠️ 'extension' 자유입력 총액만 | 자동계산·기준시간·시작/종료시각 캡처 전무(§2B) |
| 제주 티켓 기사선구매→현금 | 🔶 'advance'(대납)로 동작, 손님 확인→현금 | 티켓 kind 없음·영수증 미배선(§2B) |
| 제주시 외 픽업 +5만 | ❌ 예약시 quote에만(+6만·Stripe) | 금액·레일 불일치, 룸에 없음(§2B) |

### 시나리오 2 — 스몰그룹 (기사=현장보조, 중국어가이드가 영어팀, preset 안내)
| 요구 | 현재 상태 | 갭 |
|---|---|---|
| 기사=현장보조 겸직 | ✅ 명시적 설계: guide 링크→콘솔(공지/rally/일정/정산/Q&A) + 룸카드 "운전"→Cockpit(기사 도구 전부) | ⚠️ 콘솔↔Cockpit 별개 화면; Cockpit에선 메시지가 룸단위(팬아웃 아님) |
| 지리·역사·인문+관광지 preset **텍스트/오디오/비디오** | ✅ 텍스트(4티어 5로케일)·오디오(TTS+스팟 mp3) | ❌ **비디오 전무** · ⚠️ 스팟 오디오는 단일 비로케일 mp3 · ❌ 지역 개요(지리/역사/인문) 티어 없음(§2C) |
| 화장실·맛집 맵 핀 | ✅ restroom/photo/**restaurant(맛집)** 핀, 평점×리뷰 랭킹, verified-only | ⚠️ 핀 종류 3개 한정(티켓부스/집합점/ATM 불가) |
| "따라오세요"·"여기서 표 사세요" 등 상황 preset | 🔶 지연/타세요/복귀시간/주차핀/차량문제/도착은 있음 | ❌ **"따라오세요"·"여기서 표 사세요"·"여기서 대기"·"출발합니다" 프리셋 없음**; 지점기반 집합은 가이드 콘솔에만(기사 콕핏 없음)(§2C) |

### 시나리오 3 — 버스 (기사 + 별도 현장보조; 보조가 공지·티켓·집합·핀·Q&A, 영어불가)
| 요구 | 현재 상태 | 갭 |
|---|---|---|
| 실시간 통역 | ✅ (동일 코어) | ⚠️ (§2A 엣지 + 다예약 분산) |
| 별도 현장보조 역할 | 🔶 별도 "assistant" 역할 없음 = **guide 역할이 곧 현장보조**; 이름만 | — (기능은 커버) |
| 기사+보조 2명 동시 | ✅ auth/data 레이어 지원(한 룸에 driver+guide 공존, 링크 각각 발급) | ⚠️ broadcast/rally는 guide만(driver 토큰 거부) |
| 공지 원탭 전체 발송(번역) | ✅ /broadcast 투어일 전체 팬아웃, 손님별 번역 | — |
| 티켓 끊어주기 | 🔶 LEDGER 대납(예약별) | 벌크(한 차 40장) 분배 없음·디지털 티켓 없음 |
| **집합 시간+지점+핀** | ⚠️ 시간+카운트다운 ✅, **지점은 텍스트만** | ❌ **운영자가 "여기 모여" 맵 핀을 못 찍음**(영어불가 보조에게 가장 치명적 — 핀이 언어를 초월하는 유일한 수단)(§2D) |
| 손님 문의 답변 | ✅ 룸 채팅+컨시어지+OperatorAssist, 양방향 번역 | — |
| 다예약 관리 | ⚠️ 공지는 팬아웃, but **손님별 1:1 통역채팅이 N개 룸에 분산** | 다예약 룸 모델 미설계(§2D) |

---

## 2. 교차 주제별 상세 (file:line = 감사 근거)

### A. 실시간 통역 (3종 공통 1순위) — 코어 견고, 엣지 P0
**작동:** `Cockpit.tsx` 원탭 녹음(ko-KR device STT→오디오 폴백)→2.4s 실행취소→auto-send→`/messages`(Whisper 사다리 Groq→OpenAI)→번역(`lib/ai/router.ts` gemini-2.5-flash-lite→OpenAI, `tour_translation_cache` sha256)→손님별 언어 버블. 손님 메시지→`/tts` 자동재생(캐시 mp3)+한국어 텍스트. 언어무제한: `chatLocale.ts`/`deriveChatLocale`/`getRoomTranslationTargets`. zero-LLM 프리셋 폴백(지연/복귀/타세요…). wake-lock·웹뷰 탈출 배너.

**레이턴시:** 턴제 6–12s(순차엔 OK, 겹치는 대화엔 느림). 라이브 동시통역 아님.

**갭:**
- **P0 — 기사가 손님 사진/파일을 못 봄.** Cockpit 피드는 `koText`/위치만 렌더, 이미지/파일 렌더 없음(`Cockpit.tsx:602-631`). 캡션 없는 사진=빈 회색 버블+오디오 없음(`speakableText`=''→`/tts` 422). 손님이 주소/메뉴/분실물/알레르기카드/스크린샷을 보이는 가장 흔한 상황이 깨짐.
- **P0 — 번역 실패가 조용히·영구 방치.** 프로바이더 아웃 시 원문+`metadata.translation_status='pending'`만 남기고 소비자/복구잡 **전무**(grep 확인). 결과: 기사에게 외국어 원문 표시(불가독)+한국어 음성으로 외국어 낭독(깨짐), 손님엔 생 한국어. **플랫한 현장 데이터에서 정확히 발화·자가치유 안 됨.**
- **P1 — audio STT 미검토 전송.** 손님 컴포저는 확인-후-전송인데 Cockpit 오디오 경로는 Whisper 결과를 클라이언트에 안 보여줌 → 오인식이 2.4s 후 자동 팬아웃(Samsung Internet/카톡 웹뷰 세그먼트가 이 경로로 강제됨).
- **P1 — Cockpit에 optimistic echo/전송큐/오프라인 버퍼 없음.** 실패 시 토스트만; 손님측엔 `_local:'sending'|'failed'`+재시도 있으나 운영자측 없음 → 나갔는지 모름.
- **P1 — iOS TTS 자동재생 취약.** pure driver "운행 시작"이 `primeAudio()`/HTMLMediaElement 언락 안 함(`DriverConsole.tsx:210`) → 첫 손님 음성 무음 가능(텍스트로 강등되나 핸즈프리 약속 상실).
- **P2:** Cockpit 최근 8개만(스크롤백 없음, 언마운트 중 도착 메시지 유실 재생)·그룹 다손님 모호(전부 "손님"·이름/답장없음)·TTS 프로바이더 폴백 없음+6/min 제한.
- **P3:** 기사에 카메라/비전 도구 없음(손님이 보인 표지판/메뉴를 못 찍음 — 영어불가 기사에겐 사각)·operator STT ko-KR 하드락(비한국어 보조 음성입력 불가).

### B. 정산/돈 규칙 (프라이빗)
LEDGER = `tour_room_extras`(kind ['advance','extension','parking','other'], 현금전용, logged→confirmed[손님]→settled[가이드/admin]→voided). kind는 **3곳 중복**(SQL·`ledger.ts`·`Cockpit.tsx`) — 신규 kind 3곳 다 안 넣으면 API가 'other'로 강등.

- **오버타임(a) ~15%:** 'extension' 자유입력 총액뿐. 기준시간(제주9/부산8) 개념 0, 30k/h 상수 없음, 시작/종료시각 캡처 없음→원리적으로도 계산 불가. (참고: `pricing-policy.ts` `PER_HOUR_BEYOND_TABLE {en:40000, zh:30000}`는 예약시 12h초과 base-tier, 당일 오버타임 아님.)
- **제주 티켓(b) ~50%:** 'advance'로 동작(가이드 폼 placeholder "입장권 4매"). but **티켓 전용 kind 없음**, `receipt_photo_url` 컬럼은 있으나 **쓰지도 보여주지도 않음**(할인가 vs 청구가 투명성 미포착).
- **제주 픽업비(c) ~40% 어긋남:** `JEXU_PICKUP_SURCHARGE=+₩60,000`(규칙은 5만)·Stripe quote 레일(규칙은 현금)·`classifyJejuHotelZone` 시내/시외 자동감지는 견고. 룸 LEDGER엔 픽업비 kind/브릿지 없음.
- **현금(d) ~75%:** 현금전용 잘 방어. but **수취자가 "가이드"로 하드코딩**(payer='driver'여도 "가이드에게" 문구), **기사가 settle 불가**(`allowedExtraTransition` settle=guide/admin만) → 가이드 없는 기사단독 프라이빗에서 기사대납 항목이 logged/confirmed에 갇힘.

### C. 콘텐츠 & 핀
- **텍스트 ✅:** 4티어(curated→poi_kb→generated[LLM+비평가+AI배지]→null), 5로케일 en폴백, 리치 SpotArrivalCard.
- **오디오 ✅ but 약함:** ①스팟 `audio_url` 단일 mp3(비로케일 — 영어팀도 업로드된 그 파일) ②메시지 TTS 사다리(device→OpenAI mp3 캐시). 다국어 나레이션은 TTS가 **짧은 번역 메시지줄**을 읽는 것(리치 description 본문 아님).
- **비디오 ❌:** 어디에도 없음(필드·플레이어·스토리지 0).
- **지역개요 ⚠️:** POI 단위만. 한국/제주/부산 지리·역사·인문 브리핑 티어 없음(city는 LLM 생성 힌트로만).
- **핀 ✅ 맛집 포함:** restroom/photo/**restaurant**(rating×log10(reviews) 랭킹, verified-only, cap 3/kind, Static Maps 카드). 갭: **종류 3개 한정**(티켓부스/집합점/ATM/약국/버스승차 불가).
- **운영자 상황 프리셋:** 있음(지연/타세요/복귀/주차핀/차량문제/스톱도착; 가이드=meeting_notice 지점+시간). **갭:** "따라오세요"❌·"여기서 표 사세요"❌·"여기 대기/출발합니다/뭉쳐다니세요"❌·지점기반 집합은 가이드 콘솔에만(기사 콕핏엔 복귀시간뿐). OperatorAssist는 초안만(전송 안 함).

### D. 역할 & 구조 (버스/스몰그룹)
- **역할 4종:** customer/guide/driver/admin. **별도 assistant 없음 = guide가 현장보조.** 토큰 scope: customer=예약, guide/driver=투어일. 기사=차량번호 PIN.
- **2운영자 1룸 = 지원**(participants (room_id,device_key), role 유니크 아님; driver+guide 공존; 가이드/admin이 기사링크 발급). but **broadcast/rally는 guide만**(driver 토큰 거부).
- **집합 rally:** 시간+카운트다운 ✅(`meeting_notice` 팬아웃, `NoticeBanner` KST 벽시계, T-10/5 진동+음성, T+5 rally_overdue 디듀프). **but 지점=텍스트만**(`broadcast/route.ts:99-110`, lat/lng·핀 없음). 맵핀은 driver `parking_pin`(per-room, 카운트다운과 분리)뿐.
- **버스 구조 갭:** ①pure driver Cockpit은 `rooms[0]`만(`DriverConsole.tsx:108`)=버스 N예약 중 첫 예약만 도달 ②지점 맵핀 운영자 화면에 없음 ③티켓=예약별 대납만(벌크/디지털 없음) ④**meeting_notice `point`·LEDGER `item` 텍스트가 verbatim 삽입=미번역**(한국어 보조가 한국어 지명 입력→외국 손님에 한국어 표시; 자유텍스트 broadcast는 번역됨).

---

## 3. 우선순위 플랜 (구현 제안 — 승인 후 착수)

### TIER 0 — 실시간 통역 신뢰성 (3종 공통 1순위)
- **T0-1 [P0] 운영자 콕핏에 손님 사진/파일 렌더** — ChatFeed의 이미지/파일 렌더 재사용; 캡션없는 사진도 "사진" 라벨+열기, 비전 "이게 뭐죠?" 연결. (가장 흔한 현장 상황 복구)
- **T0-2 [P0] 번역 실패 복구 경로** — `translation_status='pending'`을 소비: 읽기 시 온디맨드 재번역 or 백그라운드 재시도 잡. 기사가 생 외국어/깨진 TTS를 절대 안 보게. (플랫 데이터 대비)
- **T0-3 [P1] audio STT 확인 스텝** — 콕핏 오디오 경로도 전사 텍스트 표시 후 전송(오인식 자동팬아웃 방지).
- **T0-4 [P1] 콕핏 optimistic echo + 전송큐 + 오프라인 버퍼**(손님측 패리티).
- **T0-5 [P1] iOS TTS 프라이밍** — pure driver "운행 시작" 제스처에서 HTMLMediaElement 언락.
- **T0-6 [P2]** 콕핏 스크롤백·그룹 손님 이름/답장·TTS 프로바이더 폴백+레이트 헤드룸.
- **T0-7 [P3]** 기사 카메라/비전 도구.

### TIER 1 — 프라이빗 정산 (실제 돈 규칙)
- **T1-1** 오버타임: 기준시간(제주9/부산8)+투어 시작/종료시각 캡처+자동 30k/h 계산+오버타임 kind(자유입력 총액 대체). 단가/기준시간 상수화(§L 게이트 해소 — 사용자 확정 필요).
- **T1-2** **기사가 자기 대납을 settle** — `allowedExtraTransition`에 driver(자기 payer 행) 추가 + payer-aware 문구("기사에게" vs "가이드에게").
- **T1-3** 티켓 kind 신설 + `receipt_photo_url` 배선(업로드+표시)로 할인가 투명성.
- **T1-4** 제주 픽업비: 금액(6만→5만) + 레일 결정(현재 Stripe quote vs 규칙 현금) — **사용자 결정**.
- **T1-5** kind enum 3곳 단일화(신규 kind 추가 전 선행).

### TIER 2 — 버스/스몰그룹 구조 (다예약)
- **T2-1** **운영자(가이드) 화면에 집합 지점 맵핀** — meeting_notice에 lat/lng+핀, 팬아웃, 카운트다운과 결합. (영어불가 보조에 최우선 — 핀=언어 초월)
- **T2-2** 운영자 타이핑 지명(meeting_notice point)+LEDGER item 텍스트 번역(현재 verbatim).
- **T2-3** 버스 운영 모델 결정 — 기사 신호 버스전체 vs 예약별(현재 rooms[0])·다예약 룸 통합(투어일 "버스룸" 개념?). **사용자 결정 필요(대형 아키텍처).**
- **T2-4** (선택) 벌크/디지털 티켓 핸드오프.

### TIER 3 — 콘텐츠 깊이 (스몰그룹/버스 안내)
- **T3-1** 비디오 콘텐츠(videoUrl/videoI18n+플레이어+스토리지).
- **T3-2** 다국어 스팟 오디오(per-locale audioI18n or TTS-over-description).
- **T3-3** 지역개요 티어(한국/제주/부산 지리·역사·인문 브리핑).
- **T3-4** 운영자 상황 프리셋 확장("따라오세요"·"여기서 표 사세요"·"대기"·"출발"·기사콕핏 지점집합).
- **T3-5** 핀 "other" kind(티켓부스/집합점/ATM/약국/버스승차).

---

## 4. 사용자 결정 (2026-07-20 확정)
1. **버스 운영 모델(T2-3): "다예약 1룸(버스룸)" 신설** 확정 — 투어일 단위로 한 차의 여러 예약을 하나의 룸으로 통합. 버스/스몰그룹 방향의 기준.
2. **제주 픽업비(T1-4): 금액 ₩60,000 유지, 당일 현금 또는 사이트 결제 선택.** + **제주 프라이빗 투어 상세페이지 잘 보이는 곳에 해당 내용 배치**(신규 요구 — 상세 UI 작업).
3. **오버타임 단가/기준(T1-1): 상수 확정** — 30,000원/h, 기준시간 제주 9h·부산 8h.
4. **착수 순서: TIER 0(통역 엣지)부터 착수** 확정.

## 5. 착수 로그
- **2026-07-20:** 위 결정 확정, TIER 0 구현 착수.
- **T0 P0 완료 (PR #417):** ①운영자 콕핏에 손님 사진/파일 렌더(라이트박스/다운로드 칩·캡션 하단·무캡션도 안 비게) ②번역 실패 복구 라우트 `POST …/messages/[messageId]/retranslate`(`translation_status='pending'` 소비, 재연결 뷰어가 1회 재번역→리브로드캐스트, 콕핏은 복구 전 TTS 보류). 신규 `lib/tour-room/messageView.ts` + 테스트.
- **T0 P1 완료 (PR #418):** ③audio STT 확인(webview 폴백 클립→`/stt` 전사→전송 전 텍스트 표시, 저신뢰 전사는 명시적 [보내기]) ④콕핏 옵티미스틱 에코+전송큐+오프라인 버퍼(훅 `senderRole` 옵션·실패 재전송 배너) ⑤iOS TTS 프라이밍(제스처에서 무음 WAV로 HTMLMediaElement 언락·재사용 엘리먼트). tsc0·608 green.
- **남은 TIER 0:** T0-6 P2(스크롤백·그룹 손님 이름/답장·TTS 프로바이더 폴백) · T0-7 P3(기사 카메라/비전).
- **T1 A 완료 (PR #419):** T1-5 kind 단일화(`ledger.ts` EXTRA_KIND_LABELS·콕핏 피커·GuideLedgerPanel·ExtraLedgerCard 5로케일 파생, 마이그레이션으로 CHECK에 ticket/overtime/pickup 추가·라이브) + T1-2 기사 자기정산(`allowedExtraTransition` payer='driver' settle/void, payer-aware 캡슐 기사님/가이드, 콕핏 "받을 돈·수취완료" 리스트).
- **T1 B 완료 (PR #420):** T1-1 오버타임 자동계산 `lib/tour-room/overtime.ts`(제주9/부산8·30k/h·0.5h 반올림) + 콕핏 "초과근무" 시트(시작=픽업시각·종료=지금·±30분·overtime kind 기록) + city를 overview→Cockpit prop로 전달.
- **T1 C 완료 (PR #421):** T1-3 티켓 영수증 `receipt_photo_url` 배선(extras POST 멀티파트 receipt 업로드·캡슐 메타 전달·손님 ExtraLedgerCard "영수증 보기" 5로케일·콕핏 폼 카메라 첨부+정산리스트 링크).
- **T1-4 상태:** 픽업 상수는 이미 ₩60,000(`pricing-policy.ts JEJU_PICKUP_SURCHARGE` = 사용자 결정과 일치, 변경 불필요). 남은 건 **제주 프라이빗 상세페이지에 픽업비 안내 배치**(tour-detail 서브시스템) + 당일현금 레일(LEDGER 'pickup' kind 존재).
- **T1-4 완료 (PR #422):** 픽업 상수 이미 ₩60,000. 상세페이지 배치=`privateSampleItinerary.ts` JEJU_CONFIG.rules에 emphasis 규칙(부산+70k/서울+50k 동일 패턴). **TIER 1 전체 완료.**
- **주의(§3 vs §4):** §3의 T1-4 초기 분석("6만→5만")은 무효 — §4 사용자 결정(6만 유지·당일현금/사이트결제·상세페이지 배치)이 최종.
- **TIER 2 결정(2026-07-20): 채팅 모델 B**(공지·핀·기사신호=버스 전원, 손님 1:1=비공개) 확정 → **공유 손님룸/스키마 변경 없음**(예약별 룸 유지, 운영자 측만 확장). 플랜 `.claude/plans/peppy-juggling-hippo.md`.
- **T2 Slice 1 완료 (PR #423):** T2-1 집합 지점 맵핀 — broadcast에 lat/lng 수용→`meeting_lat/lng` 메타(배너)+maps URL 텍스트 부착(피드 LocationPreview), NoticeBanner "📍 지도" 링크(5로케일), GuideConsole 📍 GPS 캡처(핀만으로도 전송). broadcast 팬아웃 편승=버스 전원.
- **T2 Slice 2 완료 (PR #424):** T2-2 운영자 텍스트 번역 — 지명(`renderSpotEventTranslations` pointByLocale·broadcast 번역·`meeting_point_i18n` 배너)+LEDGER item(`renderExtraCapsule` itemByLocale·`item_i18n`·ExtraLedgerCard). R-6 폴백(실패 시 verbatim).
- **T2 Slice 3 완료 (PR #425):** 기사 신호 버스전체 — driver-signal이 tours.price_type 조회, 공유(person/group) 투어면 tour-date 전 예약 팬아웃(룸별 pin+message+push+event), 사설(vehicle)은 단일 룸. `delivered` 카운트 반환.
- **TIER 2 완료.** 운영자 통합 인박스는 기존 GuideConsole 집계로 충족. ⚠실기기·픽셀 QA는 사람 게이트.
