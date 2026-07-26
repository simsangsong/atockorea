-- TTS 오디오 버킷. 없어서 손님의 [읽어주기]가 500 으로 죽고 있었다.
-- 라이브에는 이미 적용됐다(2026-07-26, MCP). 이 파일은 그 상태를 레포에 고정한다.
--
-- 실측 (적용 전):
--   GET /api/tour-rooms/{id}/tts?messageId=…&locale=ko
--   → 500 {"error":"Internal server error","details":"Bucket not found"}
-- 적용 후:
--   → 200 {"url":"…/tour-audio/tour-room-tts/…-ko.mp3","cached":false}
--     실제 파일 142,464 bytes · audio/mpeg
--
-- `tour_room_tts_cache` 테이블은 마이그레이션이 만들었지만 버킷은 안 만든다
-- (스토리지가 SQL 마이그레이션 대상이 아니라서). 그래서 코드도 스키마도 다 있고
-- 기능만 없는 상태로 배포돼 있었다. 인수인계 문서에 "수동 생성 대상"으로 적혀
-- 있었고, 그 수동 단계가 실행된 적이 없다. 이제 마이그레이션이 갖는다.
--
-- 설정 근거는 코드에 있다 — app/api/tour-rooms/[bookingId]/tts/route.ts 가
-- `getPublicUrl` 을 쓰고 주석이 "the public tour-audio bucket" 이라고 못박는다.
-- 하나의 (message, locale) 오디오를 룸 전체가 공유하므로 서명 URL 이 아니다.
--
-- 🔴 목록 조회 정책은 **일부러 붙이지 않는다.** public 버킷의 오브젝트 서빙은
--    RLS 를 타지 않으므로 SELECT 정책 없이도 재생된다. 정책이 여는 것은 목록 API
--    뿐이고, 같은 날 다른 버킷 3개에서 그게 정확히 노출로 드러났다
--    (마이그레이션 20260801010000). 적용 후 확인: 익명 목록조회 0건.
--
-- 업로드는 서버가 service role 로 하므로 별도 정책이 필요 없다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tour-audio',
  'tour-audio',
  true,
  10485760,                                   -- 10MB. 한 문장 TTS 는 수십~수백 KB 다.
  array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav']
)
on conflict (id) do nothing;
