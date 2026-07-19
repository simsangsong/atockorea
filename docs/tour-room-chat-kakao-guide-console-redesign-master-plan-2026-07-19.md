# Tour Room — Kakao-grade Chat + Guide Console Redesign (Master Plan)

- 작성일: 2026-07-19
- 트랙: 스마트 가이드 프라이빗 모드 후속 (SoT 계열 `docs/smart-guide-private-mode-master-plan-v2-2026-07-16.md`)
- 상태: **리뷰·감사·설계·플랜 (구현 전).** 사용자 승인 후 Phase 1부터.
- 요청 원문: ① 가이드 콘솔 UI 위계 정리 + 예쁘고 컴팩트, ② 들어온 메시지 탭 → 채팅 이동 + 해당 메시지 **인용 답장**, ③ 고객 채팅에 **파일·사진 첨부** 등 왓츠앱/카톡 기능, ④ 고객 채팅 = **자동번역 내장 카톡화**.

---

## §A. 코드 리얼리티 감사 (재사용 ✅ / 확장 🔶 / 부재 ❌)

### A-1. 고객 채팅 스택
- ✅ `components/tour-mode/RoomShell.tsx` — 슬림 헤더 + 탭(홈/채팅/지도/오늘/설정) + 하단 탭바. 채팅 탭 = `chat` prop(피드+컴포저). 이미 메신저 문법.
- ✅ `components/tour-mode/ChatFeed.tsx` — 말풍선 그룹핑, **뷰어 로케일 자동번역 표시 + 탭하면 원문 토글**, 시스템 캡슐, 날짜 구분선, 읽음 divider, TTS 듣기 버튼, 보냄/실패 상태, 윈도잉. **자동번역은 이미 코어.**
- ✅ `components/tour-mode/Composer.tsx` — 자동성장 입력 + 퀵리플라이 칩 + 음성(STT, device 우선) + **카메라 버튼(=vision Q&A, 첨부 아님)**.
- 🔶 `lib/tour-room/messageGroups.ts` — `system`은 `sender_role==='system'`만. 이미지/파일/인용 렌더 분기 없음.
- ❌ **인용 답장(reply/quote)**: UI·스키마 전무.
- ❌ **첨부(내 메시지로 사진/파일 전송)**: 전무. 사진은 vision "share=true" 시 **system 메시지**(`metadata.kind='vision_answer'`, `image_url`)로만 존재하고 **ChatFeed는 그 이미지를 렌더조차 안 함**(system 분기=텍스트 캡슐).
- ❌ **이미지 버블 + 라이트박스**, ❌ **롱프레스 메시지 액션 메뉴**(현재 탭=번역토글 1개만).

### A-2. 메시지 스키마 (`tour_room_messages`, 마이그레이션 `20260515133521` + `20260717…`)
```
id, room_id, booking_id, sender_user_id,
sender_role  CHECK ('customer','guide','admin','system','driver')   -- driver는 20260717 추가
input_kind   text DEFAULT 'text' CHECK ('text','audio')             -- 🔶 'image','file' 추가 필요
source_text, source_locale,
translations jsonb, target_locales text[],
metadata jsonb,                                                     -- kind/image_url 등 자유 필드
created_at
```
- 🔶 `input_kind` CHECK 확장 필요('image','file'). ❌ `reply_to_message_id` 컬럼 없음.
- ✅ 스토리지 버킷 `tour-room-photos` 존재(vision-ask가 생성·업로드, `SUPABASE_TOUR_ROOM_PHOTOS_BUCKET`), 공개 URL 발급 패턴 있음. → **첨부 업로드 재사용 가능.**

### A-3. 메시지 송신/번역 파이프
- ✅ `POST /api/tour-rooms/[bookingId]/messages` — 텍스트 JSON / 오디오 multipart 수용, `resolveRoomActor` 인증, `translateTextForLocales`(Gemini→OpenAI)로 룸 타깃 로케일 번역, insert + `broadcastToRoom`. **input_kind는 text/audio만.**
- ✅ 번역 타깃 = `getRoomTranslationTargets`(룸 로케일 + 손님이 실제로 쓴 chat_locale) → **언어 무제한 브릿지 이미 있음.**
- 🔶 첨부 캡션 번역: messages 라우트에 image/file 멀티파트 분기 추가 필요(캡션은 text와 동일 경로로 번역).

### A-4. 가이드 콘솔 (`components/tour-mode/guide/GuideConsole.tsx`) — 스크린샷 대상
현재 세로 스택(동일 위계 카드 난립):
1. 히어로(다크) — 상태 칩들.
2. **손님(룸)** — 카드마다 [식별정보 + 마지막 메시지(손님 원문 언어) + 채팅/일정/정산 3버튼 + 운전 모드 + **인라인 확장 플랜 에디터** + **인라인 정산 패널**]. → **과적재.**
3. **전체 안내** — 전체공지 + 집합공지 + 자유시간 **3개 카드가 항상 펼쳐진 채** 큰 세로 공간 점유.
4. **최근 메시지** — source_text(손님 원문 언어) 나열.
- 문제: (a) 위계 없음(모두 동일 무게 카드), (b) 룸 카드 과부하(플랜/정산 인라인), (c) 프라이빗 1-파티 데이엔 "전체 안내" 팬아웃이 과잉, (d) 미리보기/피드가 **손님 언어**(가이드 한국어 아님), (e) 컴팩트하지 않음.

### A-5. 탭→채팅→답장 딥링크
- ✅ 가이드 "채팅" = `/tour-mode/room/{bookingId}?rt=<token>`(RoomShell).
- ❌ 특정 **메시지로 스크롤/하이라이트** 딥링크 없음(ChatFeed는 `?message=` 미지원).
- ❌ 채팅 진입 시 **인용 컨텍스트 프리필** 없음.

---

## §B. 바인딩 설계 결정 (승인 대상)

- **D1 — 자동번역은 불변식.** 고객 채팅의 모든 대화 말풍선은 뷰어 언어로 자동 표시, 탭=원문 토글 유지. 첨부 캡션도 동일 번역. (이미 코어 → 강화·유지.)
- **D2 — 인용 답장 = metadata 스냅샷 + 앵커.** `reply_to_message_id`(FK, 스크롤 앵커)와 `metadata.reply_to = { id, sender_role, excerpt, kind }`(윈도잉돼도 표시할 스냅샷) 둘 다 저장. 카톡/왓츠앱처럼 **인용 스니펫이 말풍선 위에** 뜨고, 탭하면 원본으로 스크롤+하이라이트.
- **D3 — 첨부 = 1급 메시지, vision과 분리.** `input_kind`에 `'image'`·`'file'` 추가. 첨부는 `metadata.attachment = { url, mime, name, size, w, h }`. **캡션(선택) = source_text**(자동번역). vision "이게 뭐야?"(Q&A)는 별개 기능으로 존치. 카메라 버튼은 **"사진 보내기"(첨부) vs "이게 뭐야?"(vision)** 두 동작으로 분기(첨부가 기본, vision은 보조 액션).
- **D4 — 이미지 버블 + 라이트박스.** ChatFeed에 image 렌더 분기(썸네일 버블 → 전체화면 뷰어), file은 칩(아이콘+파일명+크기 → 다운로드). vision_answer의 `image_url`도 이 렌더를 재사용해 사진이 실제로 보이게.
- **D5 — 롱프레스/스와이프 액션.** 말풍선 롱프레스(또는 우스와이프) → 액션 시트(**답장 인용 / 복사 / 원문·번역 토글 / (내 것)삭제**). 탭=번역토글 유지(충돌 없음). 접근성: 메타열에 작은 "답장" 아이콘도 병행.
- **D6 — 가이드 콘솔 위계 = "룸 우선, 도구는 접기".**
  - 프라이빗 기본(1 파티)에선 **룸 카드가 히어로 바로 아래 주역**, 1차 액션 = **채팅** / **운전 모드**(큼직·명확). 플랜·정산은 **인라인 제거 → 시트/드로어**로 온디맨드.
  - 날짜-전역 도구(전체공지/집합/자유시간)는 **단일 "전체 안내" 접이식**(기본 접힘) 또는 컴팩트 툴바로 강등. 다-파티 데이에만 확장 가치.
  - 미리보기·최근 메시지 = **한국어 번역**(`translations.ko`)로 표시(가이드 이해).
  - 비주얼: `tr-*` 토큰 일관, 단일 accent, 섹션 헤더 위계, 여백 규율, 컴팩트 컨트롤(직전 콕핏 컴팩트화와 동일 결).
- **D7 — 탭→채팅→인용.** 가이드 콘솔의 룸 카드 미리보기 & 최근 메시지 항목 탭 → `/tour-mode/room/{id}?rt=…&message=<id>&reply=1` → RoomShell이 채팅 탭으로 열고 그 메시지로 스크롤+하이라이트 + 컴포저에 인용 컨텍스트 프리필.
- **D8 — 첨부 보안/한도.** 이미지 ≤8MB(기존 vision과 동일), 파일 ≤20MB·확장자 화이트리스트(pdf/이미지/일반 문서), per-participant + per-room 레이트 게이트(기존 durable-rate-limit 재사용). 공개 버킷이므로 URL은 추측 불가 UUID 경로. EXIF는 v1 보류(파킹).
- **D9 — 범위 = 풀 카톡 패리티 (사용자 확정 2026-07-19).** v1에 인용·첨부·자동번역 + **읽음표시(1/N)·타이핑 인디케이터·이모지 리액션**까지 포함.
  - **읽음(D9a)**: `tour_room_participants.last_read_at` + `POST /read`(내 커서 갱신+broadcast) → 내 마지막 말풍선에 "읽음"/미읽음 N 표시(소규모 룸 = 나 외 전원이 지나가면 읽음).
  - **타이핑(D9b)**: 비영속 — 실시간 채널 `typing` 이벤트(`broadcastToRoom`)로 핑, 헤더/피드 하단 "○○ 입력 중…" 3s TTL. 스키마 없음.
  - **리액션(D9c)**: `tour_room_message_reactions` 테이블(message_id, participant_id, role, emoji, UNIQUE) + `POST /reactions`(토글) + broadcast. 롱프레스 → 이모지 픽커, 말풍선 하단 리액션 칩.
  - 음성 파형 첨부·EXIF 스트립만 v2 파킹.

---

## §C. 스키마 변경 (additive, `mcp__atockorea__apply_migration` + 파일 + get_advisors)

```sql
-- 1) 첨부 종류
ALTER TABLE public.tour_room_messages
  DROP CONSTRAINT IF EXISTS tour_room_messages_input_kind_check;
ALTER TABLE public.tour_room_messages
  ADD CONSTRAINT tour_room_messages_input_kind_check
  CHECK (input_kind IN ('text','audio','image','file'));

-- 2) 인용 앵커 (스냅샷은 metadata.reply_to에 별도 저장)
ALTER TABLE public.tour_room_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid
  REFERENCES public.tour_room_messages(id) ON DELETE SET NULL;

-- 3) 읽음 커서 (per-participant)
ALTER TABLE public.tour_room_participants
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- 4) 이모지 리액션
CREATE TABLE IF NOT EXISTS public.tour_room_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.tour_room_messages(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.tour_rooms(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.tour_room_participants(id) ON DELETE SET NULL,
  role text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, participant_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_trm_reactions_message ON public.tour_room_message_reactions(message_id);
```
(타이핑은 비영속 — 실시간 채널 이벤트만, 스키마 없음.)
- RLS는 기존 정책 상속(같은 테이블). 인덱스 추가 불필요(reply는 metadata 스냅샷으로 렌더, 앵커는 클라 스크롤용).

---

## §D. API 변경

- **`POST /messages` 확장**: multipart에 `attachment`(File) + 선택 `caption` 수용 → 버킷 업로드 → `input_kind='image'|'file'` + `metadata.attachment` + (캡션 있으면) source_text=caption 번역. body/multipart 공통으로 `replyToId` 수용 → `reply_to_message_id` + `metadata.reply_to` 스냅샷 구성(서버가 원본 조회해 excerpt 생성, 위조 방지).
- **업로드 헬퍼 추출**: vision-ask의 `ensurePhotosBucket`+업로드를 `lib/tour-room/attachments.ts`로 공용화(경로 `att/{room}/{uuid}.{ext}`).
- **역할 허용**: 첨부·인용은 customer/guide/driver/admin 모두(기존 messages 인증 그대로).
- **레이트 게이트**: `tour_room_attachment`(per participant/room) 신설, 유료작업(번역) 전에 게이트.

---

## §E. 가이드 콘솔 재설계 (위계·컴팩트·예쁘게)

목표 레이아웃(위→아래):
1. **히어로(컴팩트)** — 투어명 + 상태 1줄, 칩 최소화(날짜·탑승만), 새로고침 아이콘.
2. **룸(주역)** — 프라이빗 1파티면 카드 1개가 크게:
   - 상단: 아바타 + 이름 + 인원/언어 + **한국어로 번역된 마지막 메시지** + "답장 필요" 배지.
   - 1차 액션(큼직): **채팅** · **운전 모드**.
   - 2차(작게, 아이콘): **일정**(시트로) · **정산**(시트로). 인라인 패널 제거.
   - 다-파티면 같은 카드의 컴팩트 리스트.
3. **전체 안내(접이식, 기본 접힘)** — 헤더 탭으로 펼침. 안엔 공지(음성+텍스트)/집합/자유시간을 **탭 세그먼트**로 하나씩(3카드 동시 노출 제거).
4. **최근 메시지(한국어)** — 룸색+이름+한국어 번역, **탭 → 해당 채팅으로 이동+인용**.
- 비주얼 규율: 카드 그림자/보더 1레벨, 섹션 헤더 `tr-label` 통일, 한 화면에 1차 액션이 즉시 보이도록 세로 예산 축소.

---

## §F. 고객 채팅 카톡화 (핵심)

- **F1 인용 답장**: 롱프레스/우스와이프 → "답장" → 컴포저 상단에 인용 바(원 발화자+스니펫, ✕로 취소) → 전송 시 `replyToId` 포함. 수신측 말풍선 위에 인용 스니펫(탭 → 원본 스크롤+하이라이트).
- **F2 첨부**: 컴포저에 **＋(첨부)** 버튼 → 사진(갤러리/카메라)·파일 선택 → 미리보기 + 캡션 입력 → 전송(진행률). 이미지=버블 썸네일→라이트박스, 파일=칩→다운로드. **캡션 자동번역.**
- **F3 카메라 동작 분기**: 기존 카메라 = "이게 뭐야?(vision)"였음 → **＋ 첨부(사진 보내기)** 기본 + vision은 "이게 뭐야?" 보조 버튼으로 유지.
- **F4 롱프레스 메뉴**: 답장/복사/원문·번역 토글/(내 것)삭제.
- **F5 자동번역 카톡 감성 강화**: 수신 말풍선 기본=내 언어, 하단 메타에 🌐(번역됨)/↩(원문) 토글 이미 있음 → 첨부 캡션·인용 스니펫까지 동일 번역 커버.

---

## §G. 탭 → 채팅 이동 + 인용 답장 (딥링크)

- ChatFeed에 `focusMessageId` prop 추가 → 마운트 시 해당 메시지로 스크롤 + 1.5s 하이라이트 링.
- TourRoomClient/page가 `?message=<id>&reply=1` 파싱 → 채팅 탭 강제 + focusMessageId 전달 + reply=1이면 컴포저 인용 컨텍스트 프리필.
- 가이드 콘솔(§E-2·4)의 미리보기/최근 메시지 항목이 이 URL로 링크.

---

## §H. WBS (각 Phase 별도 PR)

- **Phase 1 — 스키마+API 토대**: §C 마이그레이션(첨부·인용·읽음커서·리액션), `attachments.ts` 업로드 헬퍼, `/messages` 첨부·인용 확장, 캡션/인용 번역, `POST /read`(읽음 커서+broadcast), `POST /reactions`(토글+broadcast), 채널 `typing` 이벤트, 레이트 게이트. 단위 테스트.
- **Phase 2 — 채팅 카톡화(고객)**: ChatFeed 이미지/파일 버블 + 라이트박스 + 인용 스니펫 + 롱프레스 액션 + **리액션 칩** + **읽음 표시** + **타이핑 인디케이터**; Composer ＋첨부(미리보기·캡션·진행률) + 인용 바 + 카메라 분기 + 타이핑 핑 + 이모지 픽커. messageGroups 확장. 컴포넌트 테스트.
- **Phase 3 — 탭→채팅→인용 딥링크**: ChatFeed focusMessageId, TourRoomClient `?message&reply` 파싱, 가이드 콘솔 링크. 테스트.
- **Phase 4 — 가이드 콘솔 재설계**: 위계·컴팩트·예쁘게(§E), 플랜/정산 시트화, 전체 안내 접이식+세그먼트, 미리보기/피드 한국어. 콕핏/드라이브 진입 유지. 컴포넌트 테스트.
- **Phase 5 — 폴리시+QA**: 5로케일 카피, 라이트/다크, 접근성(롱프레스 대체 아이콘), 시뮬 스윕(`sim-tour-day`→screens), 회귀 그린.

---

## §I. 게이트 / 범위

- **사람 게이트**: 실기기 첨부(카메라/갤러리/파일 피커, iOS Safari)·라이트박스·롱프레스 제스처 QA; 대용량 파일 업로드 체감; 플래그 `NEXT_PUBLIC_TOUR_MODE_V1`는 이미 ON(프로덕션).
- **DB**: `apply_migration` 후 `get_advisors` 재실행(신규 0 확인).
- **v2 파킹(§D9)**: 리액션/이모티콘, 읽음 카운트, 타이핑 인디케이터, EXIF 스트립, 음성 첨부.
- **불변식 유지**: 자동번역(D1), 원탭 시그널=시스템 카드(대화 아님), 콕핏 한국어+TTS.

---

## §J. 테스트 계획(요지)
- 라우트: 첨부 업로드→image/file 메시지+캡션 번역, 인용 스냅샷 서버 생성(위조 방지), 레이트 게이트, 미인증 403.
- ChatFeed: 이미지 버블/라이트박스, 파일 칩, 인용 스니펫 표시+포커스 스크롤, 롱프레스 액션, 자동번역+원문 토글.
- Composer: 첨부 미리보기·캡션·전송, 인용 바 취소, 카메라 분기.
- 가이드 콘솔: 룸 우선 레이아웃, 시트 열림, 접이식 도구, 한국어 미리보기, 탭→딥링크 URL.
