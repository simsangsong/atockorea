-- 🔴 tour-room-photos / tour-audio → PRIVATE
--
-- 무엇을 고치는가
--   `tour-room-photos` 는 `public=true` 이고 `storage.objects` 정책이 **하나도 없었다**.
--   그 버킷의 `att/` 아래에는 손님이 채팅으로 보낸 사진과 **영수증(손님 금융 데이터)** 이
--   들어간다. 공개 버킷의 객체 URL은 방을 나가도, 초대를 폐기해도, 메시지를 지워도
--   계속 살아 있다 — 추측 불가능한 UUID 경로는 URL이 앱 밖으로 나가는 순간 게이트가 아니다.
--   `tour-audio` 에는 손님·가이드의 대화를 **소리로 읽은** mp3 가 들어간다.
--
-- 왜 지금인가 (실측 2026-07-29~30)
--   저장된 URL **0행**. `public` 스키마의 모든 text/varchar/json/jsonb 컬럼을 훑어
--   두 버킷을 참조하는 행이 하나도 없었다. 즉 **백필이 필요 없다.**
--   실 트래픽이 하루라도 흐르면 이 작업은 0행 변경에서
--   **되돌릴 수 없는 능력(capability) URL의 N행 백필** 로 바뀐다.
--
-- 정책을 하나도 만들지 않는 이유
--   투어룸 핫패스는 **서비스 롤**이다(RLS 우회). 읽기는 전부 서버가 발급하는
--   **단기 서명 URL**로만 나가고, 그 서명은 `resolveRoomActor` 를 통과한 호출자에게만
--   발급된다. 익명 롤에 정책을 열면 그 게이트를 우회하는 두 번째 경로가 생긴다.
--   즉 "정책 0개"가 이 슬라이스에서는 **의도**다 — 공개 버킷이었을 때의 "정책 0개"와
--   글자는 같지만 의미가 정반대다(그때는 정책이 없어도 전부 읽혔다).
--
-- 마케팅 버킷(tour-videos·tour-images·tour-gallery·product-images·email-assets)은
-- **공개 유지** — CDN 콘텐츠이고 비공개로 바꾸면 상품 페이지가 깨진다.
--
-- ⚠ `qr/` 는 같은 버킷 안에 있고 **기사가 초대 메일에서 스캔한다.**
--   메일 클라이언트는 세션 없이 이미지를 가져오므로 버킷을 공개로 되돌리는 대신
--   `qr/` 만 **120일 서명 URL**을 쓴다(경로 단위 분리 — `lib/tour-room/roomMedia.ts`).

update storage.buckets
   set public = false
 where id in ('tour-room-photos', 'tour-audio');

-- 고아 객체 정리는 **여기서 못 한다.**
--   `storage.protect_delete()` 트리거가 `storage.objects` 직접 DELETE 를 막는다
--   ("Direct deletion from storage tables is not allowed. Use the Storage API instead").
--   그래서 정리는 Storage API 를 쓰는 스크립트로 뺐다:
--
--     npx tsx scripts/purge-orphan-room-media.ts --apply
--
--   대상 12개는 전부 QA 산출물이다 — `qa-prod-surfaces.ts` 의 tinyPng()(정확히 70바이트)와
--   Buffer.from('QA voucher')(정확히 10바이트)와 **바이트 단위로 일치**하고, 매달린 룸 6개는
--   전부 존재하지 않는다. 손님 사진이 아니다.
--   애초에 남은 이유는 `sim-tour-day.ts --cleanup` 이 DB만 지우고 스토리지는 안 지웠기
--   때문이며, 그 누수 자체도 같은 커밋에서 막았다.
