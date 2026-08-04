# 로컬 세션 핸드오프 — 문법 스윕 G2·G3 + PR #715 시각 확인 (2026-08-04)

> **이 문서는 로컬(키·시뮬 있는) 세션의 부트스트랩이다.** 트랙 SoT 는
> `docs/smartapp-grammar-uiux-sweep-plan-2026-08-04.md` — 원칙 §2 여섯 개를 착수 전에 읽는다.
> 원장: `docs/audit/GRAMMAR-LEDGER-2026-08.md`(G4 마감 표) · `docs/audit/UIUX-LEDGER-2026-08.md`(UX-000 먼저).
> 격자 `docs/audit/GRAMMAR-GRID.md` 는 **생성물** — 손대지 말고 `node scripts/gen-grammar-grid.mjs` 로 재생성.

## §0 원커맨드 부트스트랩

**터미널 A (셋업 + 게이트 + dev, 한 줄):**

```bash
git fetch origin main && git checkout -B local-g2g3 origin/main && npm install && npx tsc --noEmit && npx jest __tests__/audit --silent && npm run dev
```

**터미널 B (dev 뜬 뒤, 시뮬 시드 한 줄):**

```bash
npx tsx scripts/sim-tour-day.ts && npx tsx scripts/sim-populate.ts
```

- 게이트가 하나라도 깨지면 **거기가 첫 발견이다** — 진행하지 말고 원장에 적는다.
- ⚠ 워크트리는 HMR 이 안 먹는다 — 소스를 고쳤으면 dev 재시작 후 워크를 돌린다.
- ⚠ 검증 기준은 항상 `origin/main`(로컬 main 은 뒤처진 전과 있음) — 위 한 줄이 이미 그렇게 한다.

## §1 먼저: PR #715 시각 확인 6건 (원격 세션이 실렌더 없이 출고한 것)

전부 시뮬 룸에서 확인. 판정은 "동작하는가"가 아니라 **"카톡에서 온 손님 눈에 자연스러운가"** —
어색하면 원장에 `UPGRADE-` 행으로.

| # | 표면 | 여는 법 | 볼 것 |
|---|---|---|---|
| 1 | 반응 이모지 30종 그리드 | 말풍선 길게 → 액션 시트 | 6열 그리드 줄바꿈·터치 타깃·기존 5종 선두 |
| 2 | 링크 프리뷰 카드 | URL 포함 메시지 전송 | 텍스트만(이미지 0)·다크·긴 제목 truncate·없는 페이지=카드 미출현 |
| 3 | 서랍 대화 검색 | 서랍 → 검색 입력 | 2자 미만 무반응·번역문 검색·탭→해당 메시지 점프+하이라이트 |
| 4 | unsend 툼스톤 | 내 메시지 삭제 | 「삭제된 메시지」 이탤릭·리액션/답장 진입 차단 |
| 5 | 공지 승격 | 가이드 토큰으로 시트 → [전체 공지로 재전송] | NoticeBanner 반영·기사 토큰에선 미노출 |
| 6 | 컴포저 붙여넣기 | 스크린샷 복사 → 컴포저 ⌘V | 첨부 트레이 진입·캡션·사이즈 가드 |

+ **기사 단독 멀티룸**(조인 투어 팀 목록→팀별 콕핏)과 **명단 시트 [손님 입장 QR]** 오버레이도
같은 시드에서 한 번씩 눈으로 지나갈 것 (같은 날 출고, 같은 이유로 실렌더 0).

## §2 G2 — 미검 영역 스캔 (플랜 §3)

- 판정불가 하니스 12 에 `COVERS` 선언 (`docs/audit/UIUX-COVERAGE.md` 의 `~` 칸이 목록)
- companion / join 표면 실렌더 첫 방문
- 축 확장: rally 5단 · 스킨 7종 · 로케일 6종 · textScale 3종 — 하니스는
  `scripts/qa-uiux-render.mjs` / `qa-uiux-flow.mjs` / `qa-cjk-render.mjs` 재사용
- 흐름 워크: 관제의 하루 · D-1 · 종료 후 (`qa-smartapp-walk.mjs` / `qa-cockpit-walk.mjs` / `qa-driver-walk.ts` 참조)
- 플랜 에디터 **편집 가능 변형** 시드 주행 (지금까지 고정코스만 주행됨)
- P-18: `/admin/tour-ops` **TBT 프로파일 먼저**, 동적 import 는 그 다음 (성능 원장에 기록)

## §3 G3 — 업그레이드 후보 발굴

결함 아닌 "더 좋게" ≥10건, 후보마다 비용/효과 1줄 + **전후 컷 계획** 필수.
원장에 `UPGRADE-` 접두로. §1 에서 어색했던 것이 자연스러운 첫 후보다.

## §4 다시 열지 말 것 (결정으로 닫힘)

- 격자 ✗ 3 = **전달 · 컴포저 이모지 피커 · 사진 일괄 저장** — 사장님 결정으로 닫힌 부재. 결함 아님.
- 투어룸 자동 발송 경로 금지(수동 버튼 유지) · 실사용 0 은 의도.

## §5 매 웨이브 마감

`npx tsc --noEmit` 0 · `npx jest __tests__` 0 fail · 상설 게이트 전종(K4 60쌍·여정 그리드 59·
문법 격자 17/20·CJK·C축 64/2·A1 92) · UI 변경 시 전후 컷 · 원장 갱신 · PR 단위 머지.
