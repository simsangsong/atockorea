# GRAMMAR-GRID — 메신저 동사 격자 (생성물)

> 🔴 **이 파일은 생성물이다.** 손으로 고치지 말 것 — `scripts/gen-grammar-grid.mjs` 를 고치고 재생성한다.
> `__tests__/audit/grammarGrid.test.ts` 가 낡음을 잡는다.
> 플랜: `docs/smartapp-grammar-uiux-sweep-plan-2026-08-04.md` · 판정(왜 없는가)은 원장
> `docs/audit/GRAMMAR-LEDGER-2026-08.md` — 이 격자는 **사실만** 적는다.

✗ 는 결함이 아니라 후보다. 하루짜리 투어 방에서 카톡은 baseline 이지 명세가 아니다.

| 동사 | 판정 | 근거 (소스 probe) |
|---|---|---|
| 답장 (인용 + 원본 점프) | ✅ | `components/tour-mode/ChatFeed.tsx:1055` |
| 반응 이모지 (고정 세트) | ◐ | `components/tour-mode/ChatFeed.tsx:68 — 5종 고정 · 피커 없음` |
| 복사 | ✅ | `components/tour-mode/ChatFeed.tsx:1264` |
| 원문 ↔ 번역 토글 | ✅ | `components/tour-mode/ChatFeed.tsx:612` |
| 삭제 (unsend, 15분 툼스톤) | ✅ | `components/tour-mode/ChatFeed.tsx:1274` |
| 읽음 표시 | ✅ | `components/tour-mode/ChatFeed.tsx:938` |
| 타이핑 표시 | ✅ | `components/tour-mode/ChatFeed.tsx:381` |
| 안읽음 구분선 | ✅ | `components/tour-mode/ChatFeed.tsx:693` |
| 아래로 점프 + 새 메시지 배지 | ✅ | `components/tour-mode/ChatFeed.tsx:440` |
| 음성 메시지 왕복 (STT→번역 / 한국어 TTS) | ✅ | `app/api/tour-rooms/[bookingId]/messages/route.ts:3` |
| 사진·파일·링크 모아보기 + 더 보기 | ✅ | `components/tour-mode/RoomDrawer.tsx:499` |
| 사진 단건 저장 | ✅ | `components/tour-mode/Lightbox.tsx:106` |
| 전달 (forward) | ✗ | `0 hits (components/tour-mode/ChatFeed.tsx · components/tour-mode/Composer.tsx)` |
| 메시지 단위 공유 (방 밖으로) | ✗ | `0 hits (components/tour-mode/ChatFeed.tsx · components/tour-mode/Lightbox.tsx)` |
| 채팅 내 검색 | ✗ | `0 hits (components/tour-mode/ChatFeed.tsx · components/tour-mode/RoomDrawer.tsx)` |
| 컴포저 이모지 피커 | ✗ | `0 hits (components/tour-mode/Composer.tsx)` |
| 이미지 붙여넣기 (클립보드) | ✗ | `0 hits (components/tour-mode/Composer.tsx)` |
| 링크 프리뷰 (OG 카드) | ✗ | `0 hits (components/tour-mode/ChatFeed.tsx)` |
| 사진 일괄 저장 | ✗ | `0 hits (components/tour-mode/RoomDrawer.tsx)` |
| 메시지 → 공지 승격 | ✗ | `0 hits (components/tour-mode/ChatFeed.tsx)` |

집계: 존재 12 / 20
