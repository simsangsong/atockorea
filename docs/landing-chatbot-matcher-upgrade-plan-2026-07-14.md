# 랜딩 + 챗봇/빌더/매처 업그레이드 플랜 (2026-07-14)

오너 지시: "랜딩 UI/UX 업그레이드(특히 destinations card 크기 축소) + 챗봇·빌더·매처 전반
리뷰/테스트/audit → 문제 발견·업그레이드 → 플랜 → 자동 실행 → 메인 머지."
Audit 원본: 랜딩 audit + 3-시스템 audit (2026-07-14, 에이전트 2종). 브랜치 `feat/landing-uiux-upgrade`.

## 슬라이스 A — 랜딩 컴팩트 (오너 명시 요구)

| # | 작업 | 파일 | 상태 |
|---|---|---|---|
| A1 | destinations card 축소: `aspect-[4/5]`→`4/3`, 모바일 `60vw`→`46vw`(Featured 44vw와 정합), 타이틀 1.75/2.1→1.35/1.7rem, sizes 갱신, 섹션 `section-py-md`→`sm`. 에디토리얼 처리(그레인·비네트·세리프) 보존 | `ui/destination-card.tsx`, `sections/destinations-showcase.tsx` | ✅ 코드 |
| A2 | (기록만) Featured/Process `section-py-md`·CTA 3중복(매처/브라우즈/AI에이전트)·히어로 trust 4타일 vs FinalCTA 중복 — 구조 변경은 A/B 실험(`home_sticky_threshold`)·빌더 플래그와 얽혀 오너 확인 후 | — | §보류 |

## 슬라이스 B — 매처/챗봇 안전·비용·버그 (audit HIGH)

| # | 작업 | 파일 |
|---|---|---|
| B1 | **`POST /api/tour-product/match` 레이트리밋 추가** — 무인증 Haiku 호출에 가드 0(자매 match-explanation은 있음). `requestGate` 10/min·60/hr per-IP 미러링 | `app/api/tour-product/match/route.ts` |
| B2 | match 감사로그 세션 쿠키 `atc_session`(존재하지 않음)→`atc_chat_sid` — user_session_id 상시 null 버그 | 동일 파일 |
| B3 | 매처 provider 레이스 가드 — requestId 토큰으로 늦게 도착한 이전 응답/explanation 병합이 새 결과를 덮어쓰는 것 차단 | `HomeV2MatchProvider.tsx` |
| B4 | 피드백 남용 방어 — IP 키 `x-real-ip` 우선(스푸핑 차단, assistant route와 정합) + (세션,답변) 중복 투표 dedupe | `assistant/feedback/route.ts` |
| B5 | 메모리 roll-forward(2차 Gemini 호출)가 응답 크리티컬 패스를 블로킹 → fire-and-forget | `assistant/route.ts` |
| B6 | MatcherBottomSheet 한국어 리터럴("매처 결과 시트"·"아래로 당겨 닫기") i18n 키화 + 시트 오픈 시 포커스 이동/복원 | `MatcherBottomSheet.tsx` |

## 슬라이스 C — 데드코드 정리

| # | 작업 | 파일 |
|---|---|---|
| C1 | 빌더 홈 진입 컴포넌트 2종(`itinerary-builder-entry.tsx`, `home-builder-section.tsx`)이 언마운트 고아인데 barrel로 번들에 잔존 — barrel export 제거(파일은 보존: 빌더 재활성 대비, Phase 13 D36 참고) | `sections/index.ts` |

## 보류 (오너 확인 필요)

- esc-05 PII 마스킹(티켓/텔레그램) — 기존 fixplan에서 의도적 deferred 이력, 임의 변경 안 함.
- `MatchResultNextSteps` 하드코딩 USD 가격 리터럴(236/249/208) — 콘텐츠/가격 정책 결정 필요.
- 랜딩 CTA 중복 정리 — A/B 실험 간섭.
- 챗봇 스트리밍 기본 ON(`CHAT_STREAMING`) — 운영 결정.

## 검증

- `npx tsc --noEmit` + `npm run build` 그린, 홈 ISR(revalidate=600) 유지.
- 랜딩 375px/데스크탑 before/after 스크린샷(destinations), 홈 렌더 에러 0.
- 매처: 연속 2회 질의 레이스 → 마지막 질의 결과 유지 확인. match API 11번째/분 요청 429.
- 기존 관련 테스트(`__tests__/lib/chatbot`, `match-engine-smoke` 등) 통과.

## 변경 로그

- 2026-07-14: 플랜 작성, A1 구현. (이후 슬라이스별 갱신)
