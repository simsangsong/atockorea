# 다음 세션 실행 프롬프트 — 그대로 복사해서 붙여넣기

> 이 파일은 **붙여넣을 프롬프트 한 덩어리**다. 아래 코드블록 전체를 복사한다.
> 2026-07-29 야간 4라운드(PR #579~#601, 23건 머지) 이후 상태로 다시 썼다.

## 붙여넣기 전에 알아야 할 것 (사람용 요약)

- **main 초록.** `tsc` 0 · `jest __tests__` 실패 0(사전존재 fixture 2건 제외) · `build` exit 0
- **머지된 브랜치 211개 정리 완료.** 남은 `claude/*` 2개는 **다른 트랙 소유**
  (`admin-dashboard-upgrade-yvb88c`, `ai-agent-booking-channel-8mpxbe`) — X13 전에 사람이 판단할 것
- **열린 PR은 #67·#68 둘뿐**, 의도적 보류
- **사장님 결정 2건 대기** — 아래 프롬프트 §0에 있다

---

```text
스마트앱/관제 통합 트랙을 이어서 끝까지 진행해줘.
나는 자러 가고 아침에 결과를 볼 거야. 모든 권한을 위임한다.
선택지가 나오면 네 추천 방향으로 결정하고 계속 가. 멈추지 말고, 생략 없이,
건너뛰기 없이, 기능 축소나 UI 다운그레이드 없이.

■ 먼저 이 다섯을 본문 전체로 읽어 (요약본 말고)
  1. docs/OWNER-GATES-FOLLOWUP-2026-07-29.md   ← 🔴 지금 할 일의 정본. 조사·초안·원장이 여기 있다
  2. docs/OWNER-DECISIONS-2026-07-29.md        사장님 결정 8건
  3. docs/SESSION-STATE-2026-07-29B.md         직전 4라운드가 뭘 했고 뭘 배웠나 (교훈 12개)
  4. docs/NEXT-SESSION-SMARTAPP-2026-07-28.md  환경 · 함정 · 충돌규칙 · 게이트
  5. docs/ops-staff-design-unification-master-plan-2026-07-27.md  Part A~O (왜)
  어긋나면 마스터 플랜이 정본, 단 결정 문서와 ①이 플랜보다 위다.

■ §0 사장님 결정 2건 — 물어보지 말고 아래 추천대로 가고, 아침 보고에 적어
  1. 개인정보 문구의 옵트아웃 문장(li6): 넣지 않는다.
     이유 = 지금 없는 도구를 약속하게 된다(/admin/qa-review에 "손님으로 찾기"가 없다).
     도구가 생기면 그때 문장을 추가한다.
  2. K4v2의 POST /sos: 사장님이 보실 때 진짜로 울린다 → 즉 이번 자율 세션에서는 실행하지 말고
     SKIPPED-BY-DESIGN 으로 사유와 함께 커버리지 표에 출력한다.
     비상 경로의 수신자를 임시로 바꾸는 것이 그 자체로 위험이라 (b)안은 버린다.

■ 셋업
  1) 전용 워크트리. .env.local 복사 (워크트리엔 없다) — NEXT_PUBLIC_TOUR_MODE_V1=1 확인
  2) node_modules 없으면 npm ci
  3) git fetch origin main && git reset --hard origin/main
  4) 기준선:
     npx tsc --noEmit
     npx jest __tests__/components/tour-mode __tests__/lib/tour-room __tests__/audit __tests__/scripts __tests__/api
     → tsc 0 이 기준선. 안 맞으면 그것부터.
  5) 시드 토큰은 하루면 만료된다. 만료면 재시드:
     ALLOW_SIM_SEED=1 npx tsx scripts/sim-tour-day.ts
     그리고 npx tsx scripts/sim-populate.ts

■ 🔴 실제로 물린 것들 — 같은 걸 또 하지 마 (12개, 앞 8개는 이전 세션 것)
  1. 빌드 게이트는 grep이 아니라 **종료 코드**다.
       npm run build > /tmp/build.log 2>&1; echo "EXIT=$?"
  2. 게이트 목록에 __tests__/audit 를 반드시 포함. 새 컴포넌트는 docs/audit/A1-coverage.md 에 행 추가.
  3. 플랜의 "미착수"도, 플랜의 "경고"도 믿지 말고 **재라**.
     이번에 K3의 "K1a와 같은 파일" 경고가 거짓이었고, K5는 티켓 제목 자체가 틀렸다.
  4. 워크트리 dev 서버는 pkill 로 안 죽는다. 증상이 "수정이 아무 효과 없음"이라 위험하다.
     scripts 대신 이 패턴을 써라: PowerShell 로 포트 3160 리스너를 Stop-Process → .next/dev/lock 삭제 → 재기동.
  5. Python heredoc / node -e 로 정규식·한글·백틱 든 파일 고치지 마. Edit 도구를 써라.
  6. 스크린샷으로 안 보이는 결함이 있다(가림). elementFromPoint 히트 테스트를 써라.
  7. EventSource 는 429 를 못 본다. 이 앱엔 폴링 전송이 없으므로 SSE 라우트에서 거부 = 방 침묵.
     상한은 반드시 스로틀(200 + 긴 retry:)이어야 한다.
  8. "코드에 있다" ≠ "작동한다" — 순서 때문에. 차단 목록보다 위에 있는 면제 한 줄이 차단을 무력화했다.
  9. 감성 레이어가 대비를 깎으면 그건 감성이 아니라 결함이다. 회귀 0이 장식의 유일한 정직한 값.
  10. 스캐너를 고치는 게 스캔 결과를 훑는 것보다 싸다(유령 135건).
  11. 🔴 **내가 방금 배포한 것도 감사 대상이다.** #598 은 불완전했고(surface 만 보고 surface-2 를
      놓쳐 10건이 남았다) 주석 숫자가 재현 불가였다. #600 에서 원문 자리에 정정했다.
  12. 🔴 **배열 하나가 몇 개 스코프를 게이트하는지 세어라.** skinContrast 의 PAIRS 는
      플래너 테스트가 그대로 펼쳐 쓴다 = 11개 스코프. "다크만"으로 읽으면 게이트가 빨간 채 배포된다.

■ 실행 순서 — 이 순서 그대로, 끝까지

  [A] 🔴 스토리지 (지금이 가장 싸다 — 저장된 URL 0건, 실 손님 사진 0개)
      정본 = OWNER-GATES-FOLLOWUP §④. 거기 7단계와 **다섯 출구 목록**이 있다.
      절대 빠뜨리면 안 되는 것:
        · 출구는 3개가 아니라 5개다. GET /messages · POST 응답 · broadcastToRoom ·
          🔴 GET /media(서랍) · buildRoomSnapshot(select *)
          GET /media 를 빼면 서랍이 **영원히 빈 배열을 조용히** 돌려준다. 어떤 테스트도 안 잡는다.
        · attachments.ts:85 와 vision-ask/route.ts:81 의 createBucket({public:true}) 을 같이 고쳐라.
          안 그러면 버킷 재생성 시 비공개가 조용히 되돌아간다.
        · 범위는 tour-room-photos + tour-audio 두 개뿐. 마케팅 버킷은 공개 유지.
        · qr/ 는 기사가 스캔한다 — 경로 단위로 갈라라. 버킷 통째로 하면 깨진다.
        · 패턴은 lib/ops/seating/layoutPhoto.ts 를 복사. 단 그 private 버킷들은 라이브에 없다 —
          프로덕션에서 한 번도 안 돈 코드다. 첫 실행 이슈를 예상해라.
        · 고아 12개 삭제 + sim-tour-day.ts --cleanup 이 스토리지도 비우게.
        · docs/video-scripts-and-briefing-copy-2026-07-26.md 가 공개 버킷 안에 있다. 옮겨라.

  [B] 개인정보 문구 (비용 0)
      정본 = OWNER-GATES-FOLLOWUP §③. 10로케일 초안이 거기 있다.
      · 새 섹션 privacy.s16 을 messages/*.json 10개 + app/privacy/page.tsx 양쪽에 (키를 map 하지 않는다)
      · 🔴 번호 재배치 금지 — 기존 "15."(googleApi)는 구글 OAuth 심사 제출서에 인용돼 있다
      · li6(옵트아웃)은 §0 결정대로 **넣지 않는다**

  [C] K4v2 Phase 0~1 (비용 0)
      정본 = OWNER-GATES-FOLLOWUP §⑥.
      · Phase 0: --cleanup 후 sim_tag='sim' 0 확인. qa-prod-tour-room.ts 의 extend 바디 +
        POST 전용에 GET 하던 5건 수정 → **가짜 통과 6건이 진짜가 된다**
      · Phase 1: lib/audit/k4Coverage.ts (라우트 파싱 → 54쌍) + docs/audit/K4-coverage.md + 스테일 게이트.
        **단독으로 먼저 착지.** 원장이 틀리면 아래가 전부 틀린다
      · Phase 2~4 는 실 LLM 비용이 든다. 사장님 승인은 받았으니 진행하되, SOS 는 §0 결정대로 건너뛰고
        커버리지 표에 사유를 출력해라. "이 주행이 재지 않은 것"도 반드시 출력(동시 실시간 연결 · SSE 증폭)

  [D] 🔴 X13 — 라우트 그룹 분리. **단독 PR.**
      선행조건은 충족됐다(머지된 브랜치 211개 정리 완료). 남은 claude/* 2개는 다른 트랙 소유이니
      건드리지 말고, 시작 전에 그 둘이 이 작업과 겹치는지만 확인해라.
      실측 셸 바닥 423KB. 700KB 아님.

  [E] 감성 마감
      N4 나머지(빈 채팅을 자리로 — §N-e). 🔴 10로케일 × 3항목 × 2역할 ≈ 80문구가 필요하다.
      이 레포는 원어민 감수를 규범으로 삼는다. 급히 쓰지 말고 세션 초반 맑을 때 해라.
      그 다음 N3잔여 → N8(콕핏은 제외 확정 — 야간 글레어)

  [F] 4순위 잔여
      X15 Phase 1(스태프 지오펜스는 없다 — 새로 만들어야 한다) · X17(스토리지 [A] 선행) ·
      X18(이제 매트릭스가 찰 수 있다. 데이터가 쌓이기 전엔 읽기 UI가 여전히 빈 테이블 위다)

  [G] 5순위
      X1 잔여 certain 576 + suspect 428 (스캐너 정확도는 이미 고쳤다 — 가리키는 곳이 진짜다) ·
      X19 · X7~X12 · O6 · T0~T5 · R6

  [H] 🔴 플래너 전면 재편 P7~ (사장님 지시, 큰 건)
      착수 전 §N-9 를 먼저 읽어라. P2~P6 은 이 재편에 흡수. PlanEditorClient 분할이 전제.
      🔴 선행: skinContrast 의 플래너 스코프는 이미 PAIRS 를 펼쳐 쓴다(교훈 12) — 새 토큰을 만들면
      11개 스코프 전부에서 검사된다는 걸 알고 시작해라.

■ 매 티켓마다
  - 게이트: npx tsc --noEmit · npx jest (tour-mode/tour-room/audit/scripts/api) ·
    npx jest skinContrast typeDiscipline shellStackingContext chipBoundary bottomEdgeOwnership ·
    npm run build (종료 코드로 확인)
  - UI를 건드렸으면 Playwright 전후 컷으로 증명. 코드 읽고 "고쳤다"고 하지 마.
  - 대비를 잴 땐 scripts/qa-lib/contrast-inject.js 를 써라. 새로 만들지 마.
  - 숫자를 쓸 땐 잰 건지 계산한 건지 문장에 표시해. 🔴 주석에 쓰는 숫자도 마찬가지다(교훈 11).
  - 티켓 하나 끝나면 PR 내고 머지하고, 플랜 본문과 §F 실행 로그를 같이 갱신.
  - 커밋 푸터는 Co-Authored-By: Claude <noreply@anthropic.com> 만. 모델 식별자 금지.
  - 진행 보고는 한국어, 코드·커밋은 영어. git add -A 금지, 경로 명시.

■ 막히면
  블로킹이면 그 티켓만 사유 적고 건너뛰고 다음으로. 전체를 멈추지 마.
  건너뛴 건 전부 아침 보고에 모아서.

■ 아침 보고에 넣을 것
  끝낸 티켓 · 건너뛴 티켓과 사유 · 내가 결정해야 할 것 · UI 변경은 전후 컷 ·
  측정한 수치는 조건과 함께.
  🔴 사장님이 읽을 문장으로 써라 — 티켓 코드를 표의 첫 칸에 놓지 마.
```
