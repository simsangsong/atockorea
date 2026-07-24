# PROGRESS — 야간 자율 실행 상태 (재개용 단일 기준)

> 🔴 **세션이 끊기거나 한도에 걸려 재개될 때 이 파일을 가장 먼저 읽는다.**
> 아래 「다음 착수 지점」 한 줄이 진실이다. 매 티켓 완료 시 이 파일을 갱신하고 커밋한다.
> 상세 플랜: `docs/app-wide-audit-master-plan-2026-07-25.md` · 리뷰: `docs/audit/A-plan-review.md`

---

## 다음 착수 지점

**→ §L L0 (계측: `ops_ai_usage` + 라우터 기록기)**

## 기준선

- main = `65b5703c` (origin/main과 동일, 미푸시 0) — tsc 0 · `next build --webpack` ✓ · 204스위트 2118 green 재검증 완료
- 작업 워크트리: `C:\Users\sangsong\atockorea-audit` (브랜치 `claude/audit-track`, `npm ci` 실설치 완료)
- 머지 워크트리: `C:\Users\sangsong\atockorea-main-merge`
- Supabase atockorea = `cghyvbwmijqpahnoduyv` (쓰기 가능) · Kursoflow = `thgyevrqykkscvcpwmfp` (읽기전용·쓰기 절대금지)
- 사전존재 실패 5스위트(무시): `api/tours` · `lib/error-handler` · `lib/logger` · `integration/assistant-streaming` · `utils/test-utils`

## 실행 순서 (§J 개정판)

| # | 티켓 | 상태 |
|---|---|---|
| 0 | 플랜 리뷰 + §L 신설 + 플랜 11건 반영 | ✅ `5f0f5842` |
| 1 | §L L0 계측 (`ops_ai_usage` + 라우터 훅) | ⬜ |
| 2 | §L L1 출력 토큰 상한 기본값 | ⬜ |
| 3 | A0.1 시뮬 환경 격리 (`sim_tag` + 모듈 + 가드 + cleanup 재작성) | ⬜ |
| 4 | B0.1 마이그레이션 (`ops_tour_groups` + 증거 캐스케이드 차단) | ⬜ |
| 5 | B0.2 `ensureTourGroup()` 리졸버 | ⬜ |
| 6 | B0.3 + B0.3c 개인 링크 전환 + 룸 진입 토큰 캐싱 | ⬜ |
| 7 | B0.3b 채널 중립 템플릿 렌더러 | ⬜ |
| 8 | B0.4 차량·좌석판·시작게이트 그룹 이관 + B0.5 회귀 | ⬜ |
| 9 | B2.1/2.1b/2.2 정원 (컬럼 + 해석순서 + 순수함수) | ⬜ |
| 10 | B2.3/2.4/2.5 경고 표면·2호차·판매표면 회귀 | ⬜ |
| 11 | B3 대화상대 선택 (B3.1~3.5) | ⬜ |
| 12 | B4 명단 메모 (B4.1~4.4) | ⬜ |
| 13 | B5 QR 자동 체크인 (B5.1~5.5) | ⬜ |
| 14 | B1 통합 통계 (B1.1~1.6) | ⬜ |
| 15 | §L L2~L6 | ⬜ |
| 16 | A0.3 성능 베이스라인 · A0.4 로케일 하니스 · A4 코드 건강도 | ⬜ |

## 슬라이스 절차 (매 티켓)

1. `atockorea-audit`에서 구현 + 로컬 커밋
2. 검수: `npx tsc --noEmit` → `npx jest <해당범위>` → 🔴 `npx next build --webpack`
3. 마이그레이션 있으면: 파일 검토 → **기존데이터 위반 사전쿼리** → `mcp__atockorea__apply_migration` → 검증쿼리 + `get_advisors`
4. `atockorea-main-merge`에서 `git merge --no-ff` → tsc + 게이트 jest + 빌드 재검 → `git push origin main`
5. **이 파일 갱신 + 커밋**

## 불변 원칙

- 투어룸 코어(`tour_room_*`, `/app/tour-mode`, `lib/tour-room`) 수정 금지 — additive만 (D2)
- 🔴 신규 `ops_*` 테이블 전부 `tenant_id text not null default 'atockorea'` + `revoke all on ... from anon, authenticated`
- 비가역 대외 액션(세무 제출·대량 발송·결제·push) 금지 (D10)
- 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만
- 희소성 UI("매진/잔여") 금지 — 정원은 판매 차단이 아니라 운영 캡 (B2-D1)

## 실행 로그 (append-only)

- **[0]** 플랜 전수 리뷰 완료 — 11건 발견(구현불가 1·커버리지구멍 1·누락 1 포함), 전부 플랜 본문 반영. §L 신설. main `65b5703c` 건전성 재검증. → `5f0f5842`
