# 투어모드(Tour Mode) 마스터 플랜 — 실시간 투어룸 v1

**작성일:** 2026-07-14
**브랜치:** `claude/tour-mode-dev-iaa0b8`
**상태:** 플랜 확정 대기 (§K 오픈 퀘스천 사용자 결정 후 Wave T0 착수)
**단일 기준 문서:** 이 파일. 투어모드 관련 모든 작업은 이 문서의 웨이브·티켓 번호를 기준으로 진행/보고한다.

---

## §0. 한 줄 요약 — "가능한가?"

**가능하다.** kursoflow 투어룸에서 이식된 코드가 이미 이 레포에 존재한다:
DB 테이블 9개, API 라우트 6개, STT(폴백 체인)·다국어 번역(TTT)·TTS 서버 함수가 모두 동작 상태다.
**없는 것**은 (1) 손님/가이드가 실제로 보는 투어룸 화면, (2) 실시간 위치공유, (3) 토큰 기반 룸 초대 링크,
(4) 지오펜스 → 관광지 풀 설명 자동 게시, (5) 관제센터(admin) 콘솔, (6) 확장 가능한 실시간 전송 계층이다.
즉 **"밑바닥부터"가 아니라 "골격 위에 살 붙이기"** 프로젝트이며, 아래 8개 웨이브 / 55개 나노 티켓으로 오류 없이 완성한다.
AI 비용은 §M 저비용 모델 전략(Gemini Flash-Lite/DeepSeek 중심 + 기기 내장 TTS + 템플릿 사전번역)으로 **투어 1건당 $0.1 미만**을 목표로 한다. 실시간 통역 방식은 §N.

---

## §A. 현황 자산 인벤토리 (2026-07-14 코드 실사 결과)

### A-1. 이미 있는 것 (kursoflow 이식분 — 재사용)

| 자산 | 위치 | 상태 |
|---|---|---|
| `tour_rooms` (booking당 1룸, active/closed) | `supabase/migrations/20260515133521` | 라이브 |
| `tour_room_messages` (source_text + translations jsonb + target_locales + metadata) | 동일 | 라이브 |
| `tour_room_spot_events` (arrived/audio_played/meeting_notice_sent, UNIQUE 중복방지) | `20260515142056` | 라이브 |
| `tour_guide_spots` (lat/lng + trigger_radius_m + description + audio_url) | `20260515133521` | 라이브 |
| `tour_facilities` (화장실/매표소/편의점/식당 POI) | 동일 | 라이브 |
| `tour_bus_details` (투어일별 버스 정보 payload) | 동일 | 라이브 |
| `tour_content_jobs` / `tour_generated_courses` / `tour_audio_assets` (코스·오디오 생성 파이프라인) | 동일 | 라이브 |
| `bookings.booking_reference` UNIQUE 컬럼 | 동일 | 라이브 |
| 메시지 API GET/POST (텍스트+음성 업로드 → STT → 5개 로케일 번역 → insert) | `app/api/tour-rooms/[bookingId]/messages/route.ts` | 동작 |
| SSE 스트림 (2초 폴링 릴레이 + heartbeat) | `app/api/tour-rooms/[bookingId]/events/route.ts` | 동작 |
| 스팟 이벤트 API (지오펜스 도착/오디오재생/집합공지 + 반경검증 + 중복방지) | `app/api/tour-rooms/[bookingId]/spot-events/route.ts` | 동작 |
| 투어모드 예약 목록 API (로그인 고객의 confirmed 예약) | `app/api/tour-mode/bookings/route.ts` | 동작 |
| 투어모드 콘텐츠 API (스팟+시설+버스+일정 통합 응답) | `app/api/tour-mode/booking/[id]/content/route.ts` | 동작 |
| 어드민 스팟/시설 CRUD | `app/api/admin/tours/[id]/tour-mode/route.ts` | 동작 |
| STT (폴백 체인 + 품질 메타데이터) | `lib/openai-server.ts` → `lib/stt-router.ts` | 동작 |
| TTT 번역 (`translateTextForLocales`, gpt-5-mini, JSON schema 강제) | `lib/openai-server.ts:55` | 동작 |
| TTS (`generateSpeechMp3`, gpt-4o-mini-tts) | `lib/openai-server.ts:101` | 동작 |
| 게스트 이메일 매칭 인증 + PA-4 IP 레이트리밋 | events/spot-events 라우트 내장 | 동작 |
| HMAC 서명 토큰 패턴 (구현 참조용) | `lib/agent/quoteToken.ts` | 재사용 |
| 이메일 발송 인프라 (`sendEmail` + 템플릿 8종) | `lib/email.ts`, `lib/email-templates/` | 재사용 |
| Google Maps (`@react-google-maps/api` + markerclusterer) | package.json | 재사용 |
| Supabase Realtime 클라이언트 훅 패턴 | `lib/admin/useRealtimeActivity.ts` | 재사용 |
| Realtime publication 추가 마이그레이션 패턴 | `20260626000000_realtime_enable_...` | 재사용 |
| 내구성 레이트리밋 (`requestGate`, `clientIpKey`) | `lib/durable-rate-limit.ts` | 재사용 |
| POI 지식베이스 (부산/경주 등 visitBasics·convenience·smartNotes) | `data/poi_kb/poi_knowledge_base_v1.29.json` | 재사용 |
| 상품상세 스톱 드로어 (풀 설명 UI + `TourStopDrawerStop` 타입) | `components/product-tour-static/_shared/TourStopDetailDrawer.tsx` | 재사용 |
| 지원 로케일 5종 (en/ko/ja/es/zh-TW) | `messages/` | 재사용 |

### A-2. 없는 것 (이번에 만드는 것)

1. **프론트엔드 전부** — `/tour-mode` 진입 페이지, `/tour-mode/room/[bookingId]` 룸 화면, 가이드 콘솔, 관제센터.
2. **룸 초대 토큰** — 가이드/손님용 서명 링크 발송·검증.
3. **실시간 위치공유** — 테이블·API·지도 UI 전부 부재 (`watchPosition` 사용처 0건).
4. **지오펜스 → 풀 설명 자동 게시** — 도착 이벤트는 있으나 "한 줄 시스템 메시지"만 생성. 드로어급 풀 콘텐츠 연결 없음 (`tour_guide_spots.description`은 단문, 스톱 풀 데이터는 정적 컴포넌트 안에만 존재).
5. **룸 메시지용 TTS 재생 엔드포인트** — `generateSpeechMp3`는 있으나 룸 메시지에 연결·캐싱하는 API 없음.
6. **관제센터** — 어드민이 오늘의 활성 룸을 모아보고 개입/공지하는 화면·API 없음.
7. **확장 실시간 계층** — 현 SSE는 참가자 1명당 2초 간격 DB 폴링. 참가자 늘면 DB 부하 선형 증가 + Vercel 함수 실행시간 한계.
8. **tour_rooms/tour_room_messages/tour_room_spot_events RLS 정책** — RLS는 켜져 있으나 정책 0개 (= service-role API 경유만 가능; 클라이언트 직접 Realtime 구독 불가 상태).
9. **가이드 신원 모델** — 현재 guide 판정은 `merchant` 계정 == booking.merchant_id 뿐. 실제 현장 가이드는 계정이 없는 경우가 대부분.

---

## §B. 아키텍처 결정 (D-1 ~ D-10)

### D-1. 전송 계층: Supabase Realtime Broadcast(1차) + 기존 SSE(폴백) — 자체 소켓 서버 없음
- Next.js on Vercel은 상시 WebSocket 서버를 호스팅할 수 없다(서버리스 함수 수명 한계). 별도 socket.io 서버(Fly/Railway)는 인프라·인증·운영 비용이 크고 "한방에 오류 없이"와 상충.
- Supabase Realtime은 이미 스택에 있고(admin에서 사용 중), WebSocket 기반 Broadcast/Presence/Postgres-Changes를 제공한다. **사용자가 말한 "양방향 소통 소켓" = Supabase Realtime WebSocket 채널**로 충족.
- 패턴: **서버 API가 쓰기(insert)를 담당하고, insert 직후 같은 서버 코드가 service-role로 `channel.send(broadcast)`를 쏜다.** 클라이언트는 anon key로 `tour-room:{roomId}` 채널만 구독(수신 전용). 쓰기는 항상 API 경유 → 기존 인증·번역·레이트리밋 로직 그대로 유지, RLS 문제 회피.
- 게스트(비로그인) 참가자는 Postgres-Changes 구독 인가가 불가능하므로(auth.uid 없음) Broadcast 채널 방식이 유일한 정합 해법. 채널명은 `roomId`(uuid) + 토큰 검증 후 서버가 내려주는 값만 사용.
- 기존 SSE 엔드포인트는 **삭제하지 않고 폴백으로 유지**하되 폴링 간격 2s → 4s + `after` 커서 유지. Realtime 연결 실패(방화벽/구형 브라우저) 시 자동 강등.

### D-2. 룸 접근 모델: 3-트랙 (토큰 링크 / 로그인 회원 / 게스트 이메일 매칭)
- **트랙 1 — 서명 토큰 링크(신규, 주 경로):** `lib/tour-room/token.ts` — `quoteToken.ts` 패턴 복제.
  - payload: `{ bookingId, role: 'guide'|'customer', displayName, iat, exp }`, `exp = tour_date 23:59 KST + 24h`.
  - URL: `/tour-mode/room/{bookingId}?rt={token}`. 가이드용은 `role=guide` — **계정 없는 현장 가이드 문제(§A-2 #9)를 토큰으로 해결.**
  - 발송 기록·폐기(revoke)를 위해 `tour_room_invites` 테이블에 token_hash 저장.
- **트랙 2 — 로그인 회원(기존):** atockorea 로그인 → `/tour-mode` → `GET /api/tour-mode/bookings`(이미 존재)로 오늘·향후 confirmed 예약 리스트 → 룸 입장. 세션 인증 그대로.
- **트랙 3 — 게스트 이메일 매칭(기존 유지):** contact_email 매칭 + PA-4 IP 레이트리밋. 토큰 분실 시 최후 수단.
- 서버 인가 우선순위: admin > 유효 토큰 > booking owner > merchant guide > 게스트 매칭. 기존 3개 라우트에 중복된 `getBookingForRoom/ensureRoom/isMerchantGuideForBooking`을 `lib/tour-room/access.ts`로 **단일화**하고 토큰 검증을 여기에만 추가한다(중복 3벌 수정 금지).

### D-3. 룸 단위: booking당 1룸 유지 + 가이드 "투어일 콘솔"에서 팬아웃
- 스키마가 `tour_rooms.booking_id UNIQUE`(1예약 1룸)로 이미 라이브. 실제 투어버스는 여러 예약이 한 차에 타므로, 가이드가 예약별 룸에 일일이 들어가는 것은 비현실적.
- 해법: **가이드 콘솔 `/tour-mode/guide`** — 같은 tour_id + tour_date의 모든 룸을 한 화면에 통합 피드로 표시, 가이드 발신은 `POST /api/tour-rooms/broadcast`가 해당 투어일의 모든 룸에 팬아웃 insert(+각 룸 Broadcast). 스키마 변경 없이 그룹 소통 달성. (per-tour-date 단일 룸으로의 개편은 v2 과제로 §K-1에 기록.)

### D-4. 위치공유: Broadcast(고빈도, 무저장) + 스냅샷 영속화(저빈도)
- 위치 핑을 전부 DB에 쓰면 참가자 20명 × 10초 간격 = 재난. **핑은 Broadcast 채널로만** 흘리고(DB 무접촉), **30초마다 1회**만 `tour_room_locations`에 upsert(참가자당 마지막 위치 1행) — 관제센터·재접속 시 초기 상태 복원용.
- 가이드 위치는 룸 전체 공개(기본 ON), 손님 위치는 **옵트인**(기본 OFF, 토글 시 동의 문구). 정확도(accuracy) > 100m 샘플은 폐기.
- 지도: `@react-google-maps/api` 재사용. 가이드=버스 아이콘, 손님=이니셜 마커, 스팟=번호 핀, 시설=아이콘 핀.

### D-5. 지오펜스 자동 풀 설명: 스팟 ↔ 콘텐츠 연결 계층 신설
- 트리거는 기존 그대로: 클라이언트 `watchPosition` → 하버사인 거리 ≤ `trigger_radius_m` → `POST spot-events(arrived)` (UNIQUE로 중복 차단, 서버 반경 재검증 이미 있음).
- **콘텐츠가 문제**: 상품상세 드로어의 풀 설명(`TourStopDrawerStop`: description, highlights, visitBasics, convenience, smartNotes, images…)은 정적 컴포넌트 코드 안에 하드코딩돼 있어 런타임 조회 불가.
- 해법 (3층):
  1. `tour_guide_spots`에 `content jsonb`(TourStopDrawerStop 호환 구조, 로케일별 `{ en: {...}, ko: {...} }`) + `poi_key text`(POI KB 키) 컬럼 추가.
  2. **추출 스크립트** `scripts/extract-tour-stop-content.ts`: 정적 타임라인 컴포넌트의 스톱 배열을 파싱해 slug→stops JSON 생성 → 어드민이 검수 후 스팟에 연결(완전 자동 밀어넣기 금지 — 좌표 매칭 오류 방지).
  3. `content`가 비면 `poi_key`로 POI KB(visitBasics/convenience/smartNotes)를 폴백, 그것도 없으면 기존 `description` 단문.
- 도착 시 룸에 `metadata.kind='spot_arrival'` 시스템 메시지(이미 존재) + **룸 UI가 이 메시지를 풀 설명 카드(드로어 축약판)로 렌더** + "오디오 가이드 듣기" 버튼(TTS 또는 사전 생성 audio_url).

### D-6. TTS: 기기 내장 speechSynthesis(기본, $0) + 서버 TTS는 캐시 전용 (§M-3 참조)
- **1차: 브라우저 `speechSynthesis`(Web Speech API)** — 온디바이스, 무료, 5개 로케일 음성 모두 iOS/Android 기본 탑재. 일반 메시지 낭독은 전부 이걸로 처리(서버 호출 0).
- **2차(서버 TTS, 캐시 전용):** 스팟 오디오 가이드·가이드 공지 등 "품질이 중요한 고정 콘텐츠"만 `GET /api/tour-rooms/[bookingId]/tts?messageId=&locale=` → 캐시 테이블 조회 → 있으면 Storage 서명 URL 302 → 없으면 생성 → Supabase Storage `tour-room-audio/` 업로드 → 캐시 기록 → URL 반환.
- 같은 메시지·로케일 재생성 0회 보장(비용 통제). 메시지 1,000자 초과분은 TTS 생략(§G R-18).

### D-7. 관제센터: `/admin/tour-ops` (기존 어드민 셸에 탑재)
- 오늘(KST) 활성 룸 목록(투어×날짜 그룹핑, 미읽음·SOS 배지) → 룸 상세(메시지 피드 + 지도 + 참가자 presence) → admin 발신(기존 sender_role='admin' 그대로) → 전체 공지(투어일 단위 팬아웃, D-3 API 공유).
- SOS: 손님이 룸에서 SOS 버튼 → `metadata.kind='sos'` 메시지 + 관제 목록 최상단 고정 + (v1.1) 어드민 이메일/푸시.
- admin 실시간 수신은 `useRealtimeActivity` 패턴 재사용(tour_room_messages를 realtime publication에 추가, admin은 authenticated이므로 admin-read RLS 정책으로 Postgres-Changes 구독 가능).

### D-8. 번역 대상 로케일: "참가자 실제 로케일"로 축소 + 저비용 프로바이더 라우팅(§M)
- 현재 기본 5로케일 전체 번역 → 비용·지연 낭비. `tour_room_participants`에 참가자별 locale 저장, 발신 시 **룸의 실제 참가자 로케일 합집합**만 번역. 참가자 1명(en)이면 1로케일만. 실패 시 원문 즉시 게시 + 번역 비동기 재시도(§G R-6).
- 번역 모델은 §M-1의 프로바이더 라우터(Gemini 2.5 Flash-Lite 기본)를 사용 — 기존 gpt-5-mini 고정 호출을 대체한다.

### D-9. 시간대: 모든 "오늘/룸 활성" 판정은 Asia/Seoul 고정
- 기존 `todayYmd()`가 UTC 기준 — 한국 투어는 KST 00:00~09:00 사이에 "오늘 투어"가 안 보이는 라이브 결함. `lib/tour-room/time.ts`의 `kstToday()`로 교체(투어모드 신규 코드 + 기존 `tour-mode/bookings` 라우트 수정).

### D-10. 기능 플래그: `NEXT_PUBLIC_TOUR_MODE_V1`
- 미설정 시 `/tour-mode`는 안내 페이지만. 파일럿 투어 1개(부산 시그니처 추천)로 베타 → 전체 오픈. 마이그레이션은 전부 additive라 플래그 OFF 상태에서 무해.

---

## §C. 데이터 모델 (신규 마이그레이션 — 전부 additive)

**M-1 `tour_room_participants`** — presence·로케일 타게팅·초대 추적의 기준
```sql
CREATE TABLE tour_room_participants (
  id uuid PK DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES tour_rooms(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer','guide','admin')),
  user_id uuid NULL REFERENCES auth.users(id),
  display_name text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  invite_id uuid NULL REFERENCES tour_room_invites(id),
  location_sharing boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_at/updated_at,
  UNIQUE(room_id, role, display_name)
);
```

**M-2 `tour_room_invites`** — 토큰 발송·폐기 대장
```sql
CREATE TABLE tour_room_invites (
  id uuid PK, booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('guide','customer')),
  token_hash text NOT NULL UNIQUE,          -- sha256(token), 원문 미저장
  display_name text, sent_to text, sent_via text CHECK (sent_via IN ('email','sms','manual')),
  expires_at timestamptz NOT NULL, revoked_at timestamptz, created_by uuid, created_at
);
```

**M-3 `tour_room_locations`** — 참가자당 최종 위치 1행 (스냅샷)
```sql
CREATE TABLE tour_room_locations (
  id uuid PK, room_id uuid NOT NULL, booking_id uuid NOT NULL,
  participant_id uuid NOT NULL REFERENCES tour_room_participants(id) ON DELETE CASCADE UNIQUE,
  role text NOT NULL, latitude numeric(10,8) NOT NULL, longitude numeric(11,8) NOT NULL,
  accuracy_m integer, heading numeric, speed_mps numeric, recorded_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);
-- 보존: 투어일 +7일 후 삭제 (pg_cron 또는 관리 잡, §G R-17)
```

**M-4 `tour_guide_spots` 확장**
```sql
ALTER TABLE tour_guide_spots
  ADD COLUMN IF NOT EXISTS poi_key text,
  ADD COLUMN IF NOT EXISTS content jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {locale: TourStopDrawerStop}
  ADD COLUMN IF NOT EXISTS exit_radius_m integer;                       -- 히스테리시스(§G R-9), NULL=trigger*1.5
```

**M-5 `tour_room_tts_cache`**
```sql
CREATE TABLE tour_room_tts_cache (
  id uuid PK, message_id uuid NOT NULL REFERENCES tour_room_messages(id) ON DELETE CASCADE,
  locale text NOT NULL, storage_path text NOT NULL, duration_ms integer, created_at,
  UNIQUE(message_id, locale)
);
```

**M-6 RLS + Realtime**
- 신규 4테이블 RLS ENABLE + admin-all 정책 + (participants/locations) merchant-guide read 정책. 게스트/토큰 경로는 전부 service-role API 경유이므로 anon 정책 불필요 — **anon 정책을 만들지 않는 것이 보안 설계**다.
- `ALTER PUBLICATION supabase_realtime ADD TABLE tour_room_messages;` + `tour_room_messages`에 admin-read RLS 정책(관제센터 Postgres-Changes용). 고객/게스트 실시간은 D-1 Broadcast라 publication 불필요.
- 각 마이그레이션 적용 후 `get_advisors` 재실행(CLAUDE.md 규칙 2).

---

## §D. API 설계 (신규 ★ / 변경 ~)

| 메서드·경로 | 역할 | 비고 |
|---|---|---|
| ★ `POST /api/tour-rooms/[bookingId]/join` | 토큰/세션/게스트 → 참가자 등록(upsert) + 룸·참가자·채널명·초기 스냅샷 반환 | 모든 입장의 단일 관문. 이후 요청은 짧은 세션 서명(`x-tour-room-auth`) 헤더로 인가 |
| ~ `POST /api/tour-rooms/[bookingId]/messages` | 기존 + 토큰 인가 + 참가자 로케일 타게팅(D-8) + insert 후 Broadcast 송출 + 번역실패 시 원문 선게시 | `lib/tour-room/access.ts`로 인가 교체 |
| ~ `GET /api/tour-rooms/[bookingId]/events` | SSE 폴백 유지, 4s 간격, 토큰 인가 추가 | Realtime 실패 시만 사용 |
| ~ `POST /api/tour-rooms/[bookingId]/spot-events` | 기존 + 도착 시 스팟 `content` 로케일 해석본을 metadata에 동봉 + Broadcast | UNIQUE 중복방지 그대로 |
| ★ `POST /api/tour-rooms/[bookingId]/location` | 30초 스냅샷 upsert (Broadcast 핑은 클라→클라 채널 직송이 아니라 이 API가 rebroadcast — 위조 위치 차단, §G R-13) | 레이트리밋 participant당 4/min |
| ★ `GET /api/tour-rooms/[bookingId]/tts` | 메시지·로케일 TTS 캐시 or 생성 → 오디오 URL | D-6 |
| ★ `POST /api/tour-rooms/dispatch` | (admin/merchant) booking 선택 → 가이드/손님 토큰 생성 + invites 기록 + 이메일 발송 | `lib/email.ts` 템플릿 신규 2종 |
| ★ `POST /api/tour-rooms/broadcast` | (admin/guide토큰) tour_id+date의 전 룸 팬아웃 발신 | D-3 |
| ★ `GET /api/admin/tour-ops/rooms?date=` | 관제: 활성 룸 목록 + 미읽음/SOS/참가자 수 | D-7 |
| ★ `GET /api/tour-mode/room/[bookingId]/snapshot` | 입장 직후 초기화 번들: room, messages(최근 100), participants, locations, spots(+content), facilities, bus_detail | 기존 content API 확장판. 왕복 1회로 콜드스타트 |

**공용 라이브러리(신규):**
- `lib/tour-room/access.ts` — booking 조회·ensureRoom·역할판정·토큰검증·룸세션서명 단일화 (기존 3개 라우트의 중복 제거)
- `lib/tour-room/token.ts` — 초대 토큰 sign/verify (HMAC-SHA256, `TOUR_ROOM_TOKEN_SECRET` env)
- `lib/tour-room/realtime.ts` — 서버측 Broadcast 송출 헬퍼 (`broadcastToRoom(roomId, event, payload)`)
- `lib/tour-room/geo.ts` — haversine, 히스테리시스, accuracy 필터, 스로틀 (클라·서버 공용, 순수함수 → 유닛테스트)
- `lib/tour-room/time.ts` — `kstToday()`, 룸 활성 판정

---

## §E. 프론트엔드 구조

```
app/tour-mode/page.tsx                     ← 진입: 로그인시 예약 리스트 / 비로그인시 토큰·예약번호+이메일 입력
app/tour-mode/room/[bookingId]/page.tsx    ← 룸 (?rt= 토큰 소비)
app/tour-mode/guide/page.tsx               ← 가이드 콘솔 (투어일 통합 피드, 가이드 토큰 필수)
app/admin/tour-ops/page.tsx                ← 관제센터
components/tour-mode/
  RoomShell.tsx            ← 탭: [채팅] [지도] [오늘 일정] / 헤더: 투어명·D-day·집합 카운트다운
  ChatFeed.tsx             ← 메시지 목록, 뷰어 로케일 번역 우선 표시(원문 토글), 시스템/도착/공지 카드 분기
  SpotArrivalCard.tsx      ← 지오펜스 풀 설명 카드 (TourStopDetailDrawer 콘텐츠 축약 재사용) + 오디오 버튼
  Composer.tsx             ← 텍스트 입력 + 푸시투토크 녹음(MediaRecorder) + 퀵답장 프리셋
  AudioButton.tsx          ← TTS 재생 (첫 탭에서 AudioContext 프라이밍, §G R-2)
  RoomMap.tsx              ← Google Map: 가이드/손님/스팟/시설/집합지 마커 + 위치공유 토글
  PresenceBar.tsx          ← 접속중 참가자 (Realtime Presence)
  SosButton.tsx            ← 2단 확인 후 SOS 발신
hooks/
  useTourRoomChannel.ts    ← Realtime 구독 + SSE 폴백 강등 + 재연결(지수 백오프) + 미전송 큐
  useGeoWatcher.ts         ← watchPosition + 필터/스로틀/히스테리시스 + 지오펜스 판정 → spot-events
  useTourRoomSession.ts    ← join 호출, 룸세션 서명 보관(sessionStorage), 만료 갱신
```
- 모바일 퍼스트(투어 현장 = 100% 폰). 다크모드·큰 글씨 토글(시니어 관광객).
- i18n: 기존 `messages/{en,ko,ja,es,zh-TW}.json`에 `tourMode.*` 네임스페이스 추가. UI 언어 = 참가자 locale.

---

## §F. 실행 WBS — 웨이브 · 나노 티켓 (총 55)

> 표기: `[티켓] 작업 — 산출물 — 완료 기준(AC)`. 웨이브 내 티켓은 위→아래 순서 의존. 각 웨이브 종료 시 커밋+푸시.

### Wave T0 — 기반 공사 (마이그레이션·공용 lib) 【9티켓】
- **T0.1** M-1~M-5 마이그레이션 작성(`supabase/migrations/`) — AC: 로컬 SQL 린트 통과, 전부 IF NOT EXISTS/additive.
- **T0.2** M-6 RLS·publication 마이그레이션 — AC: anon 정책 0개 유지 확인 주석 포함.
- **T0.3** 라이브 적용(`mcp apply_migration`, 사용자 승인 후) + `get_advisors` 재실행 — AC: 신규 advisor 경고 0.
- **T0.4** `lib/tour-room/token.ts` — sign/verify/revoke-check, exp=투어일+24h — AC: 유닛테스트(만료·변조·역할) 통과.
- **T0.5** `lib/tour-room/access.ts` — `resolveRoomActor(req, bookingId)` 단일 인가 함수 + 룸세션 서명 발급/검증 — AC: admin/owner/merchant/토큰/게스트 5경로 유닛테스트.
- **T0.6** `lib/tour-room/geo.ts` — haversine·히스테리시스·accuracy필터 순수함수 — AC: 경계값 테스트(반경±1m, 정확도 100m).
- **T0.7** `lib/tour-room/realtime.ts` + `time.ts` — AC: broadcast 헬퍼 타입 안전, kstToday 테스트.
- **T0.8** 기존 3개 라우트(messages/events/spot-events)를 access.ts로 리팩터(동작 불변) + `tour-mode/bookings`의 UTC→KST 수정 — AC: 기존 요청 계약 무변경(회귀 테스트).
- **T0.9** `lib/ai/router.ts` 프로바이더 라우터(§M-1) — OpenAI 호환 chat-completions 클라이언트에 base_url/model/key를 env로 주입(Gemini/DeepSeek/OpenAI 3사 스위칭), `translateTextForLocales`를 라우터 경유로 교체 + 번역 메모리 캐시(§M-2 ④) — AC: env만 바꿔 3사 전환 유닛테스트, 캐시 히트 시 LLM 호출 0.

### Wave T1 — 입장·룸 셸·텍스트 채팅 【10티켓】
- **T1.1** `POST join` API — 참가자 upsert + 스냅샷 — AC: 5개 인가 경로 통합테스트.
- **T1.2** `GET snapshot` API — AC: 1왕복으로 룸 초기화 데이터 완결.
- **T1.3** messages POST 확장: 룸세션 인가 + D-8 로케일 타게팅 + insert 후 Broadcast + 번역실패 시 원문 선게시(`translations={}` + `metadata.translation_status='pending'`) — AC: 번역 API 강제 실패 시에도 201.
- **T1.4** `useTourRoomSession` + `/tour-mode` 진입 페이지(회원 리스트/토큰/게스트 3트랙) — AC: 플래그 OFF 시 안내만.
- **T1.5** `useTourRoomChannel` — Realtime 구독, 끊김 감지 → SSE 강등, 재연결 시 `after` 커서로 갭 메움, 발신 실패 큐(localStorage) — AC: 네트워크 차단→복구 시 메시지 무손실 수동 시나리오.
- **T1.6** `RoomShell` + `ChatFeed` — 뷰어 로케일 우선 표시 + 원문 토글, 가상 스크롤(200+ 메시지) — AC: 5로케일 렌더 스냅샷.
- **T1.7** `Composer` 텍스트 + 퀵답장 프리셋 8종(사전 번역 상수 → 번역 API 0회) — AC: 연타 시 낙관적 UI + 중복 발신 방지.
- **T1.8** i18n `tourMode.*` 5로케일 키 일괄 추가 — AC: 키 누락 lint 0.
- **T1.9** E2E: 브라우저 컨텍스트 2개(가이드 토큰/손님)로 왕복 채팅 — AC: playwright 통과.
- **T1.10** 긴급 정보 카드 — 119·1330(관광공사 24h 통역 핫라인)·주요 대사관·관제센터 연락처를 룸 헤더 접이식 카드로 고정, `tel:` 딥링크, 5로케일 문구(정적 상수 — LLM 0회) — AC: 오프라인에서도 표시(스냅샷에 포함), 원탭 발신.

### Wave T2 — 음성 (STT 발신 · TTS 수신 · 실시간 통역) 【8티켓】
- **T2.1** `Composer` 푸시투토크 — MediaRecorder(webm/opus, iOS는 mp4/aac 분기), 최대 60초, 파형 표시 — AC: iOS Safari·Android Chrome 실기 확인 항목 문서화.
- **T2.2** 음성 발신 플로우 — 기존 multipart POST 그대로, 업로드 중 진행 표시, STT 품질 낮음(`metadata.stt.quality`) 시 "인식 결과 확인" 인라인 편집 — AC: 오탐 시 사용자가 수정 후 발신 가능.
- **T2.3** M-5 캐시 + `GET tts` API — AC: 동일 메시지·로케일 2회 요청 시 생성 1회(로그 검증).
- **T2.4** `AudioButton` + 오디오 프라이밍(첫 사용자 제스처에서 무음 재생으로 unlock) — AC: iOS 자동재생 차단 상황에서 안내 토스트.
- **T2.5** 수신 자동 낭독 모드(옵션, 가이드 공지만) — 기기 내장 `speechSynthesis` 사용(서버 TTS 0회) — AC: 기본 OFF, 화면 꺼짐 시 미동작 명시.
- **T2.6** 가이드 자막 방송 — 클라이언트 발화 청크화: WebAudio 에너지 기반 VAD(라이브러리 무추가)로 3~8초 발화 단위 분할 → webm/opus 업로드, Tier A(Web Speech API 지원 기기)는 온디바이스 STT 텍스트만 전송 — AC: 무음 구간 업로드 0, iOS(오디오 청크)/Android(Web Speech) 분기 동작.
- **T2.7** `POST /api/tour-rooms/[bookingId]/captions` — Tier A: 텍스트 → 번역 1콜 / Tier B: 오디오 청크 → Gemini Flash-Lite 멀티모달 1콜(전사+번역 동시, §N) → Broadcast로 자막 push(기본 DB 미저장, "기록 남기기" 토글 시만 메시지로 저장) — AC: 청크 종료→자막 표시 p95 ≤ 2.5s, 프로바이더 장애 시 기존 stt-router+번역 폴백.
- **T2.8** 손님측 자막 UI — 룸 상단 라이브 자막 배너(뷰어 로케일) + 원문 토글 + `speechSynthesis` 자동 낭독 옵션 — AC: 자막 유실 시(재연결) 마지막 문장부터 재개, 5로케일 렌더.

### Wave T3 — 위치공유 · 지도 【7티켓】
- **T3.1** `location` API — 서버 경유 rebroadcast + 30s 스냅샷 upsert + 레이트리밋 — AC: 위조 participant_id 403.
- **T3.2** `useGeoWatcher` — watchPosition, accuracy>100m 폐기, 이동<10m 스킵, 포그라운드 전용 명시 — AC: geo.ts 순수함수만 사용.
- **T3.3** `RoomMap` — 참가자·스팟·시설·픽업 마커, 팔로우 모드(가이드 따라가기) — AC: 마커 20개 60fps.
- **T3.4** 위치공유 토글 + 동의 문구 + 권한거부 UX(설정 안내 딥링크) — AC: 거부 후 재요청 루프 없음.
- **T3.5** `PresenceBar` (Realtime Presence: join/leave/last_seen) — AC: 탭 종료 30초 내 오프라인 표시.
- **T3.6** Wake Lock API(지원 기기) + "화면 켜두세요" 배너 — AC: 미지원 브라우저 무해.
- **T3.7** 픽업 임박 보드 — 투어 아침(픽업 시작~버스 출발) 룸 상단에 "내 픽업: N번째 정차 · 약 X분" 표시. 가이드(버스) 위치 × 같은 tour_id+date 픽업포인트 `pickup_time` 순번으로 계산(v1은 직선거리 기반 추정 — Directions API 미사용, 비용 0) + 버스 실시간 지도 링크. 손님 버튼 "도착했어요 / 조금 늦어요" → `metadata.kind='pickup_status'` 메시지로 가이드 콘솔 집계 — AC: 가이드 위치공유 OFF 시 보드 자동 숨김 + 픽업 시간 정적 안내로 강등, 픽업 완료 순차 갱신.

### Wave T4 — 지오펜스 자동 풀 설명 · 비전 Q&A 【7티켓】
- **T4.1** `scripts/extract-tour-stop-content.ts` — 정적 스톱 배열 → `data/tour-stop-content/{slug}.json` — AC: 파일럿 투어 1개 무손실 추출.
- **T4.2** 어드민 스팟 편집 확장(`/admin/products` 내 기존 tour-mode 편집 화면): content jsonb 에디터 + poi_key 셀렉터 + 추출 JSON 가져오기 — AC: 저장 후 스냅샷 API에 반영.
- **T4.3** spot-events 확장: 도착 metadata에 로케일 해석 content 동봉 + Broadcast + **도착/공지 템플릿 문구의 런타임 LLM 번역 제거(§M-2 ① 사전번역 상수로 대체)** — AC: content 없으면 poi_key 폴백, 그것도 없으면 기존 단문(3층 폴백 테스트), 도착 이벤트 처리 중 LLM 호출 0회.
- **T4.4** `useGeoWatcher` 지오펜스 — 진입 반경 trigger_radius_m / 이탈 exit_radius_m 히스테리시스 + 60초 dwell 최소 — AC: GPS 지터 시뮬레이션(모의 좌표 시퀀스)에서 이벤트 1회.
- **T4.5** `SpotArrivalCard` — 풀 설명 카드(이미지·하이라이트·visitBasics·convenience·smartNotes) + TTS/사전 audio_url 재생 — AC: 드로어와 시각 일관.
- **T4.6** 파일럿 투어 스팟 데이터 시딩(스팟 좌표+반경+content, 어드민 검수) — AC: 실좌표 검증 체크리스트.
- **T4.7** "이게 뭐예요?" 사진 질문 — Composer 카메라/앨범 첨부 → Storage `tour-room-photos/` 업로드 → `POST /api/tour-rooms/[bookingId]/vision-ask` → §M-1 라우터 비전 1콜(Gemini Flash-Lite 이미지 입력)로 손님 로케일 답변 게시. 기본 "나만 보기"(룸 공유 토글), 레이트리밋 participant당 10회/일, 위치 컨텍스트(현재 스팟명) 프롬프트 주입 — AC: 음식·간판·문화재 3케이스 수동 검증, 예산 가드 연동. *메뉴판 번역(§H P2 #11)은 이 라우트에 프리셋 프롬프트만 추가.*

### Wave T5 — 발송(디스패치) · 이메일 【4티켓】
- **T5.1** `dispatch` API — booking→가이드/손님 토큰 생성+invites 기록 — AC: 재발송 시 기존 토큰 revoke.
- **T5.2** 이메일 템플릿 2종(손님: 투어 전날 룸 링크+사용법 / 가이드: 콘솔 링크) `lib/email-templates/` — AC: 5로케일, 다크모드 클라이언트 렌더 확인.
- **T5.3** 어드민 주문 상세에 "투어룸 발송" 액션(기존 `/admin/orders` 확장) — AC: 발송 이력 표시.
- **T5.4** (자동화) 투어 D-1 18:00 KST 자동 발송 잡 — 기존 `sendBookingReminderEmail` 스케줄 경로에 편승 — AC: 중복 발송 방지(invites 존재 체크).

### Wave T6 — 가이드 콘솔 · 팬아웃 【5티켓】
- **T6.1** `broadcast` API (tour_id+date 전 룸 팬아웃, 트랜잭션 실패 시 부분성공 보고) — AC: 룸 10개 팬아웃 통합테스트.
- **T6.2** `/tour-mode/guide` — 예약 그룹 통합 피드(룸별 색 태그), 개별/전체 발신 전환 — AC: 가이드 토큰만 접근.
- **T6.3** 집합 공지 UI — 시간·장소 입력 → 기존 `meeting_notice_sent` 재사용 + 손님측 카운트다운 배너 — AC: 로케일별 시간 포맷.
- **T6.4** 인원 체크(탑승 확인) — 손님 "탑승했어요" 버튼 → 가이드 콘솔 집계 — AC: `metadata.kind='onboard_ack'` 메시지로 구현(스키마 무변경).
- **T6.5** 자유시간 타이머 — 가이드 "자유시간 N분 / 집합 HH:MM · 장소" 설정(T6.3 집합공지 확장, `metadata.kind='free_time_timer'`) → 손님 카운트다운 배너 + 10분/5분 전 인앱 알림(배너+진동+`speechSynthesis` 낭독 옵션) → 미복귀자(탑승 ack 없음) 리스트를 가이드 콘솔에 표시 — AC: KST 고정, 화면 복귀 시 서버 기준으로 남은 시간 재동기화, 타이머 취소/연장 가능.

### Wave T7 — 관제센터 【3티켓】
- **T7.1** `tour-ops/rooms` API + admin Postgres-Changes 구독 — AC: 활성 룸·미읽음·SOS 집계 정확.
- **T7.2** `/admin/tour-ops` — 룸 목록→상세(피드+지도+참가자), admin 발신, 전체 공지 — AC: 어드민 셸 규칙(프리미엄 모바일) 준수.
- **T7.3** `SosButton` + 관제 SOS 파이프라인(목록 고정+사운드) + 어드민 알림 이메일 — AC: SOS→관제 표시 3초 이내.

### Wave T8 — 하드닝 · 검증 · 롤아웃 【2티켓】
- **T8.1** 하드닝 스윕 — §G 리스크 카탈로그 전 항목 재점검 체크리스트 실행, 레이트리밋 튜닝, 로드 리뷰(룸 30개×참가자 10명 시뮬), `get_advisors` 최종 — AC: 체크리스트 100%.
- **T8.2** 파일럿 롤아웃 — 플래그 ON(파일럿 투어 한정), 실기기 필드 테스트 스크립트, 메트릭(입장률·메시지량·STT 실패율·번역 지연 p95) 대시보드 쿼리 — AC: 파일럿 리허설 1회 완료 보고.

---

## §G. 실사용 리스크 · 결함 카탈로그 (R-1 ~ R-24) — 전수 완화 매핑

| # | 리스크/결함 | 완화 | 티켓 |
|---|---|---|---|
| R-1 | **iOS 화면잠금 시 watchPosition 중단** — 백그라운드 위치는 웹에서 불가 | 포그라운드 전용임을 UI에 명시 + Wake Lock + "화면 켜두기" 배너. 기대치 설계(가이드 위치가 주, 손님 위치는 보조) | T3.2/T3.6 |
| R-2 | **오디오 자동재생 차단**(iOS/Chrome 정책) | 첫 제스처에서 AudioContext unlock, 차단 시 수동재생 토스트 | T2.4 |
| R-3 | **SSE 2초 폴링 × N명 = DB 부하 + Vercel 함수 시간 한계**(현 구조 그대로 오픈 시 장애) | Realtime Broadcast 1차 전환, SSE는 4s 폴백 강등 | D-1, T1.5 |
| R-4 | **RLS 정책 0개 상태에서 클라 직접 구독 시도 → 아무것도 안 옴**(조용한 실패) | 클라 구독은 Broadcast만, Postgres-Changes는 admin 한정 + 정책 명시 | T0.2 |
| R-5 | **네트워크 단절(터널·산간)** — 발신 유실, 수신 갭 | 미전송 큐 + 재연결 시 after 커서 갭 복구 + 낙관적 UI 상태(전송중/실패/재시도) | T1.5 |
| R-6 | **번역 API 실패/지연 시 메시지 자체가 안 감**(현 코드: 번역 실패 = 500) | 원문 선게시 + `translation_status='pending'` 비동기 보정 | T1.3 |
| R-7 | **UTC `todayYmd()` — KST 자정~09시 사이 오늘 투어 미표시**(라이브 결함) | kstToday()로 교체 | T0.8, D-9 |
| R-8 | **토큰 링크 전달/유출** — 링크 포워딩으로 제3자 입장 | 만료(투어+24h)·역할 분리·재발송 시 구토큰 revoke·invites 대장·룸 closed 시 전면 차단 | T0.4/T5.1 |
| R-9 | **GPS 지터로 도착 이벤트 연발/오발** | accuracy 필터 + 진입/이탈 반경 히스테리시스 + 60s dwell + 서버 UNIQUE(이미 있음) + 서버 반경 재검증(이미 있음) | T4.4 |
| R-10 | **버스 이동 중 스팟 옆 통과 시 오발**(정차 아님) | dwell 최소 60초 + speed_mps > 6 이면 판정 보류 | T4.4 |
| R-11 | **한 예약 다인원 다기기** — 같은 booking으로 여러 폰 입장 | participants가 기기·이름 단위, 도착 이벤트는 booking 단위 UNIQUE라 중복 카드 없음(의도 동작으로 문서화) | T1.1 |
| R-12 | **가이드 계정 부재** — merchant 로그인 없는 프리랜서 가이드 | role=guide 토큰 트랙(D-2)으로 해결 | T0.4 |
| R-13 | **위치 위조/스푸핑** — 클라가 임의 좌표 브로드캐스트 | 위치는 반드시 서버 API 경유 rebroadcast(참가자 서명 검증) | T3.1 |
| R-14 | **배터리 급감** — 고빈도 GPS+지도+소켓 | 10초 스로틀+이동 10m 필터+지도 탭 비활성 시 렌더 정지 | T3.2/T3.3 |
| R-15 | **메시지 스팸/남용** | participant당 발신 레이트리밋(10/min) + 메시지 2,000자 캡 + 기존 PA-4 유지 | T8.1 |
| R-16 | **STT 오인식(버스 소음)** — 엉뚱한 번역 전파 | 기존 품질 메타 활용해 저품질 시 발신 전 확인 편집 UI | T2.2 |
| R-17 | **위치 데이터 프라이버시/보존**(GDPR류) | 옵트인 동의 문구 + 스냅샷만 저장 + 투어+7일 삭제 잡 + 개인정보처리방침 문구 추가 | T3.4/M-3 |
| R-18 | **OpenAI 비용 폭주**(전 메시지 5로케일 번역+TTS) | 참가자 로케일만 번역(D-8), TTS 캐시(D-6)+1,000자 캡, 퀵답장 프리셋 무번역, 일일 비용 로그 | T1.3/T2.3 |
| R-19 | **룸이 투어 끝나고 영구 active** — 다음날에도 채팅·위치 노출 | 투어일+24h 경과 시 join에서 status='closed' 자동 전환 + 읽기전용 모드 | T1.1 |
| R-20 | **iOS MediaRecorder 포맷 비호환**(webm 미지원 기기) | mimeType 협상(webm→mp4 폴백), STT 라우터는 파일 확장자 무관 | T2.1 |
| R-21 | **집합시간 놓침**(앱 안 보는 손님) | 카운트다운 배너 + TTS 자동낭독 옵션 + (v1.1) Web Push — §H P2로 명시 | T6.3 |
| R-22 | **어드민 없는 새벽 시간 SOS 무응답** | SOS 시 어드민 이메일 즉발 + 관제 미확인 5분 시 재알림, 운영 SLA 문서화 | T7.3 |
| R-23 | **Broadcast 채널명 추측 입장**(roomId 노출 시 수신 도청) | 채널명 = `tour-room:{roomId}:{서버발급 채널시크릿 8자}` — join 응답으로만 전달, 룸 closed 시 로테이트 | T0.7/T1.1 |
| R-24 | **동시 편집 경합** — 같은 booking을 어드민 발송/가이드 발신이 동시 조작 | ensureRoom upsert(이미 idempotent) + invites 재발송 revoke 순서 트랜잭션 | T5.1 |

---

## §H. 고객가치 추가 기능 백로그 (v1 범위 밖 → 우선순위만 확정)

**P1 (v1 직후):**
1. 사진 공유(손님→룸, 가이드 베스트샷 공유) — Storage + 메시지 attachment metadata.
2. Web Push(집합시간·가이드 공지) — 서비스워커, R-21 근본 해결.
3. 투어 종료 요약 카드(방문 스팟 타임라인 + 리뷰 유도 딥링크) — 리뷰 전환율 자산.

**P2:**
4. 오디오 가이드 사전 다운로드(오프라인 대비, tour_audio_assets 활용).
5. "버스로 돌아가기" 도보 안내(가이드 최종 위치 → Google Maps 도보 딥링크).
6. 날씨 스트립(기존 상품상세 practical details 재사용) + 환율 위젯.
7. 다음 스팟 예고("15분 후 도착: 해동용궁사") — 버스 위치 × 스팟 순서 추정.
8. **가이드 프로필 카드 + 전날 인사** — D-1 룸 오픈 시 자동 게시. **사진은 게재하지 않는다(사용자 결정 2026-07-14)** — 이름·구사 언어·인사말 텍스트만. 인사말은 가이드 토큰 첫 입장 시 입력 유도.
9. **분실물 신고** — 룸 `closed` 후에도 읽기전용 화면에 "분실물 신고" 버튼만 유지 → `metadata.kind='lost_item'` 메시지로 관제(tour-ops) 라우팅 + 어드민 이메일. 실제 운영 민원 1순위 대응.
10. **날씨 기반 준비물 안내** — T5.4 D-1 자동 발송 메일에 "내일 비 예보 — 우산 필수" 등 준비물 블록 자동 삽입(상품상세 practical details + 기상 API, LLM 0회 템플릿).
11. **메뉴판 번역** — T4.7 `vision-ask` 라우트에 프리셋 프롬프트("메뉴판 항목·가격을 표로 번역") 추가만. 신규 인프라 0.
12. **투어 종료 운영 리포트** — 룸 활동 집계(메시지량·지연·SOS·pickup_status·미복귀 이력)를 투어 종료 시 머천트/관제에 자동 리포트. 어드민 대시보드 개편(마스터 플랜 §8)과 시너지.

**P3:**
8. 투어일 단일 그룹룸으로 구조 개편(§K-1 결정 후).
9. 가이드 평점/피드백 수집.
10. 관제 자동 이상감지(장시간 정차, 경로 이탈 알림).

---

## §I. 테스트 · 검증 계획

1. **유닛(vitest 기존 설정):** token(만료/변조/역할), geo(하버사인·히스테리시스·필터 경계값), access(5경로 인가 매트릭스), kstToday.
2. **통합(API):** join/messages/location/spot-events/broadcast/dispatch — 인가 매트릭스 표 그대로 케이스화(admin/owner/merchant/guide토큰/customer토큰/게스트매칭/무권한 7행 × 엔드포인트).
3. **E2E(playwright, 사전 설치 Chromium):** 컨텍스트 2개(가이드/손님) 왕복 채팅, 모의 좌표 시퀀스(`context.setGeolocation`)로 지오펜스 도착 카드, Realtime 차단 시 SSE 강등.
4. **실기기 체크리스트(문서화, 파일럿 전 필수):** iOS Safari(녹음·자동재생·wake lock), Android Chrome, 저속망(3G 스로틀), 화면잠금 복귀.
5. **부하 리뷰:** 룸 30개 × 10명 접속 시 Realtime 채널 수·API rps·번역 호출량 계산서 첨부(T8.1).
6. **보안:** RLS advisors 0경고, anon 정책 부재 확인, 토큰 시크릿 env 체크, PA-4 회귀.

## §J. 롤아웃 · 운영

- 플래그 `NEXT_PUBLIC_TOUR_MODE_V1` + env `TOUR_ROOM_TOKEN_SECRET`(신규, 프로덕션 필수 — quoteToken처럼 dev 폴백 두되 프로덕션 미설정 시 기동 경고) + `GEMINI_API_KEY`/`DEEPSEEK_API_KEY` 및 `TOUR_AI_*` 라우팅 env(§M-1).
- 순서: T0~T2 머지(플래그 OFF) → T3~T5 머지 → 내부 리허설(실기기) → T6~T7 → 파일럿 투어 1개 실전 → 전체 오픈.
- 메트릭: 룸 입장률(발송 대비), 메시지/룸, STT 실패율, 번역 p95, TTS 캐시 히트율, SOS 건수, OpenAI 일비용.
- 비용 가드: 번역·TTS 호출 일일 상한 env(`TOUR_ROOM_DAILY_AI_BUDGET`), 초과 시 원문 게시 모드 강등.

## §M. 저비용 모델 전략 — "토큰 최소, 저렴 모델 우선" (2026-07 단가 실측 기준)

### M-1. 프로바이더 라우터 (`lib/ai/router.ts`, T0.9)
Gemini·DeepSeek 모두 **OpenAI 호환 chat-completions 엔드포인트**를 제공하므로, 코드 경로 1개에 env로 base_url/model/key만 주입해 3사를 스위칭한다. 프로바이더별 신규 SDK 추가 없음.

| 용도 | 1순위 | 2순위(폴백/배치) | 최후 폴백 | env |
|---|---|---|---|---|
| 채팅 번역(TTT) | **Gemini 2.5 Flash-Lite** ($0.10/M in, $0.40/M out) | DeepSeek v4-flash ($0.14/M in, $0.28/M out, 캐시히트 $0.0028/M) | gpt-5-mini(현행) | `TOUR_AI_TRANSLATE_*` |
| 실시간 통역(오디오→전사+번역 1콜) | **Gemini 2.5 Flash-Lite 멀티모달** (오디오 in $0.30/M ≈ **분당 $0.0006**) | 기존 stt-router($0.006/min) + 번역 | — | `TOUR_AI_CAPTION_*` |
| 손님 음성 메시지 STT | Gemini Flash-Lite 오디오(위와 동일, 전사+번역 동시) | 기존 stt-router 폴백 체인 | — | 동일 |
| 배치 생성(스팟 콘텐츠·오디오 스크립트, 비실시간) | **DeepSeek v4-flash**(최저가, 캐시 활용) | Gemini Flash-Lite | — | `TOUR_AI_BATCH_*` |
| 비전 Q&A·메뉴판 번역(T4.7) | **Gemini 2.5 Flash-Lite 이미지 입력** | gpt-5-mini 비전 | — | `TOUR_AI_VISION_*` |
| TTS | **기기 내장 speechSynthesis($0)** | 서버 TTS는 고정 콘텐츠 캐시 전용(D-6) | — | — |

- **DeepSeek 사용 경계(중요):** DeepSeek는 데이터가 중국 리전 서버로 전송된다. **고객 채팅(PII 포함 가능) 번역에는 쓰지 않고**, 비PII 배치 생성(스팟 설명·오디오 스크립트) 전용으로 제한한다. 고객 대화 경로 기본은 Gemini.
- **모델명 주의:** `deepseek-chat` 레거시 명칭은 2026-07-24 폐기 예정 — env 기본값을 `deepseek-v4-flash`로 명시.
- 라우터는 1순위 실패(429/5xx/타임아웃 3s) 시 2순위로 자동 강등, 강등 이벤트 로그.

### M-2. 토큰 자체를 안 쓰는 6가지 장치 (모델 교체보다 절감 폭이 큼)
1. **템플릿 사전번역** — 스팟 도착·집합공지·시스템 문구는 문장이 고정 템플릿인데 **현행 코드는 도착할 때마다 LLM 번역을 호출**한다(spot-events). 5로케일 사전 번역을 스팟 `content`/상수에 저장하고 런타임 LLM 호출을 **0회**로(T4.3에 반영).
2. **퀵답장 프리셋** — 8종 사전 번역 상수, 런타임 번역 0(T1.7 기존 계획).
3. **참가자 로케일만 번역** — 5로케일 → 실참가 로케일 합집합(D-8 기존 계획). 통상 1~2로케일.
4. **번역 메모리** — `tour_translation_cache(source_hash, locale, translated)` 테이블. 같은 문장 재번역 0(반복 인사·짧은 문구 히트율 높음). DeepSeek 사용 시 프리픽스 캐시($0.0028/M)와 이중 절감.
5. **스킵 휴리스틱** — 이모지·숫자만·2자 이하·소스=타깃 로케일 동일 메시지는 번역 호출 생략.
6. **프롬프트 다이어트** — 번역 시스템 프롬프트 ~40토큰으로 축소(현행 유지 수준), max_output_tokens 캡.

### M-3. TTS 0원 원칙
- 일반 메시지·자막 낭독 = 브라우저 `speechSynthesis`(온디바이스, 무료, en/ko/ja/es/zh 음성 기본 탑재).
- 서버 TTS는 "스팟 오디오 가이드·가이드 공지" 등 재사용되는 고정 콘텐츠만 **1회 생성 후 영구 캐시**(D-6). 스팟 가이드는 투어당 1회 생성이므로 한계비용 → 0.

### M-4. 예상 비용 (파일럿 규모: 1투어/일, 손님 20명, 룸 8개)
| 항목 | 산식 | 비용/투어일 |
|---|---|---|
| 채팅 번역 | 룸 8개 × 50msg × (in 60tok + out 2로케일 120tok) | ≈ $0.01 |
| 실시간 통역 Tier B | 실발화 60min = 115k 오디오tok × $0.30/M + 출력 60k tok × $0.40/M | ≈ $0.06 |
| 실시간 통역 Tier A(Web Speech 기기) | STT $0 + 번역 텍스트만 | ≈ $0.02 |
| 손님 음성 메시지 | 40건 × 15초 | ≈ $0.01 |
| TTS | 기기 내장 + 캐시 | ≈ $0 |
| **합계** | | **≈ $0.05~0.08/투어일** (월 30투어 ≈ $2) |
- 가드: `TOUR_ROOM_DAILY_AI_BUDGET`(§J 기존) — 초과 시 번역 원문 게시 모드·자막 Tier A 강제.

## §N. 실시간 통역 설계 — 어떤 방식·어떤 API로 하나

### N-1. 세 가지 통역 경로 (전부 같은 라우터 §M-1 사용)
1. **채팅 메시지 통역(비동기)** — 기존 파이프라인 유지, 모델만 Gemini Flash-Lite로 교체. 텍스트 발신 → 1콜 → 참가자 로케일 번역 jsonb 저장 → Broadcast.
2. **가이드 자막 방송(준실시간, 신규 — T2.6~T2.8)** — 가이드가 말하면 손님 화면에 각자 언어 자막이 흐르는 모드:
   - **Tier A (STT 무료):** 가이드 기기가 Web Speech API 지원(Android Chrome 우수, iOS 14.5+ 온디바이스)이면 **브라우저가 STT를 공짜로 수행** → 확정 문장 텍스트만 서버 전송 → Gemini 번역 1콜 → Broadcast. 오디오 업로드 자체가 없어 데이터·비용 최소.
   - **Tier B (범용):** WebAudio 에너지 VAD로 발화 3~8초 청크 분할(무음 제거) → opus 업로드 → **Gemini 2.5 Flash-Lite 멀티모달 1콜에 "전사 + N로케일 번역" 동시 요청**(JSON 출력) → Broadcast. STT와 번역을 한 호출로 합쳐 비용·지연 절반.
   - 손님 측: 뷰어 로케일 자막 배너 + 원하면 `speechSynthesis`가 자막을 음성으로 낭독(음성→음성 통역 완성, 추가 비용 $0).
   - 자막은 기본 **DB 미저장·휘발**(토큰·스토리지 절약), 가이드가 "기록" 토글 시만 메시지로 영속화.
3. **음성 메시지 통역(왕복)** — 손님 푸시투토크 → Tier B와 동일한 1콜(전사+번역) → 메시지 저장. 기존 stt-router는 폴백으로 유지.

### N-2. 명시적으로 채택하지 않는 것
- **OpenAI Realtime API / Gemini Live API(상시 스트리밍 세션):** 분당 과금이 청크 방식의 수십 배 + 상시 WebSocket 세션 유지가 서버리스와 상충. 투어 자막 용도에는 문장 단위 준실시간(지연 1.5~2.5s)이면 충분.
- **전용 MT API(Google Translate $20/M자, DeepL $25/M자):** 짧은 채팅에서는 LLM 토큰 과금이 문자당 과금보다 오히려 저렴하고 문맥·경어 처리도 우수 → 불채택.
- **전용 스트리밍 STT(Deepgram 등):** 품질은 좋으나 별도 벤더 계약 추가 + Tier A/B 조합 대비 이점 없음 → 불채택.

### N-3. 품질·안정 장치
- 청크 경계 단어 잘림: VAD가 무음 400ms를 문장 경계로 판정 + 직전 청크 마지막 1초 오버랩 전송(중복 전사는 서버에서 dedupe).
- 고유명사(지명·집합장소·시간) 보존: 번역 프롬프트에 기존 규칙("Preserve names, times, pickup points…") 유지 + 스팟명 사전을 시스템 프롬프트에 주입(투어당 고정 → DeepSeek/Gemini 프리픽스 캐시 히트).
- 지연 계측: 청크 업로드→자막 Broadcast까지 서버 타이밍 로그, p95 2.5s 초과 시 청크 길이 자동 축소.

## §K. 오픈 퀘스천 (사용자 결정 필요 — 기본값으로 진행 가능)

- **K-1. 룸 단위:** v1은 booking당 룸 + 가이드 콘솔 팬아웃(D-3, 스키마 무변경)으로 간다. 투어일 단일 그룹룸(모든 손님이 서로 대화 가능)으로 갈지는 v2 결정. **기본값: D-3.**
- **K-2. 손님 간 프라이버시:** 팬아웃 구조상 손님 A는 손님 B의 메시지를 못 본다(각자 룸). 그룹 대화가 꼭 필요하면 K-1을 앞당겨야 함. **기본값: 손님↔가이드/관제 1:1 (프라이버시 우수).**
- **K-3. SMS 발송:** v1은 이메일만(기존 인프라). 카카오/SMS는 별도 사업자 계약 필요 → 백로그. **기본값: 이메일.**
- **K-4. 손님 위치공유 기본값:** OFF(옵트인). **기본값 유지 권장.**
- **K-5. 파일럿 투어 선정:** 스팟 콘텐츠가 가장 충실한 부산 시그니처(POI KB 커버리지 최다)를 권장.

## §L. 인수인계 규칙

- 이어받는 세션은 **이 문서 §A(자산) → §B(결정) → §F(다음 미완 티켓)** 순으로 읽고, 진행 상황을 §F 티켓에 `✅ 완료(커밋 해시)` 형식으로 갱신 커밋한다.
- 마이그레이션 라이브 적용은 반드시 사용자 승인 후(`mcp apply_migration`) + `get_advisors` 재실행.
- 커밋·코드는 영어, 보고는 한국어. 커밋 푸터는 `Co-Authored-By: Claude <noreply@anthropic.com>`만.
- 기존 kursoflow 이식 코드의 요청/응답 계약을 깨는 변경 금지(T0.8은 동작 불변 리팩터만).
