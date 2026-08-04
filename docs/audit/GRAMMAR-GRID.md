# GRAMMAR-GRID — 메신저 동사 격자 (생성물)

> 🔴 **이 파일은 생성물이다.** 손으로 고치지 말 것 — `scripts/gen-grammar-grid.mjs` 를 고치고 재생성한다.
> `__tests__/audit/grammarGrid.test.ts` 가 낡음을 잡는다.
> 플랜: `docs/smartapp-grammar-uiux-sweep-plan-2026-08-04.md` · 판정(왜 없는가)은 원장
> `docs/audit/GRAMMAR-LEDGER-2026-08.md` — 이 격자는 **사실만** 적는다.

✗ 는 결함이 아니라 후보다. 하루짜리 투어 방에서 카톡은 baseline 이지 명세가 아니다.

| 동사 | 판정 | 근거 (소스 probe) |
|---|---|---|
| 답장 (인용 + 원본 점프) | ✅ | `components/tour-mode/ChatFeed.tsx:1093` |
| 반응 이모지 (고정 세트) | ◐ | `components/tour-mode/ChatFeed.tsx:78 — 30종 고정 · 피커 없음` |
| 복사 | ✅ | `components/tour-mode/ChatFeed.tsx:1318` |
| 원문 ↔ 번역 토글 | ✅ | `components/tour-mode/ChatFeed.tsx:650` |
| 삭제 (unsend, 15분 툼스톤) | ✅ | `components/tour-mode/ChatFeed.tsx:1354` |
| 읽음 표시 | ✅ | `components/tour-mode/ChatFeed.tsx:976` |
| 타이핑 표시 | ✅ | `components/tour-mode/ChatFeed.tsx:399` |
| 안읽음 구분선 | ✅ | `components/tour-mode/ChatFeed.tsx:731` |
| 아래로 점프 + 새 메시지 배지 | ✅ | `components/tour-mode/ChatFeed.tsx:461` |
| 음성 메시지 왕복 (STT→번역 / 한국어 TTS) | ✅ | `app/api/tour-rooms/[bookingId]/messages/route.ts:3` |
| 사진·파일·링크 모아보기 + 더 보기 | ✅ | `components/tour-mode/RoomDrawer.tsx:569` |
| 사진 단건 저장 | ✅ | `components/tour-mode/Lightbox.tsx:106` |
| 전달 (forward) | ✗ | `0 hits (components/tour-mode/ChatFeed.tsx · components/tour-mode/Composer.tsx)` |
| 메시지 단위 공유 (텍스트만, §5-2) | ✅ | `components/tour-mode/ChatFeed.tsx:23` |
| 채팅 내 검색 (§5-3) | ✅ | `components/tour-mode/RoomDrawer.tsx:514` |
| 컴포저 이모지 피커 | ✗ | `0 hits (components/tour-mode/Composer.tsx)` |
| 이미지 붙여넣기 (클립보드, §5-6) | ✅ | `components/tour-mode/Composer.tsx:484` |
| 링크 프리뷰 (텍스트만, §5-4) | ✅ | `components/tour-mode/ChatFeed.tsx:24` |
| 사진 일괄 저장 | ✗ | `0 hits (components/tour-mode/RoomDrawer.tsx)` |
| 메시지 → 공지 승격 (가이드, §5-6) | ✅ | `components/tour-mode/ChatFeed.tsx:395` |

집계: 존재 17 / 20
