# 스마트앱 채팅 헤더 컴팩트화 + 멀티 테마 + 카톡 문법 리스트 — 마스터 플랜 (2026-07-27)

**SoT = 이 문서.** 사용자 지시(2026-07-27): ① 채팅 헤더가 LINE/카톡 대비 조잡(흰 배경·아이콘 과다·제목 잘림) → 컴팩트+프리미엄, 편의성 유지 ② 전체 흰 배경 = 미완성 인상 → 카톡 테마(겨울이야기·고대비·비밀의숲·숨바꼭질)와 LINE 배경색을 참고한 멀티 테마(아이콘/캐릭터 제외, 색·디테일만) ③ 손님 명단을 카톡 친구탭처럼도 보이게(좌석배치도 유지, 양쪽 토글) + 1:1/단체공지 대화를 카톡 채팅탭 리스트로 ④ 플랜 자체검증 후 전권 위임 자율 구현, 종료 후 자체 감사.

선행 SoT와의 관계: `docs/smartapp-ui-premium-upgrade-master-plan-2026-07-26.md`(딥 파인 시그니처·StaffShell·서랍)를 **계승**한다. U4-D8(시그니처=딥 파인)은 **기본 스킨에서 유지**되고, 신규 스킨은 사용자가 명시 요청한 확장이므로 스킨별 고유 팔레트를 갖는다. `--tr-danger`(SOS 레드)는 전 스킨 불변(§H 예외 유지).

---

## §A 진단 (코드 실측)

### A-1 게스트 룸 헤더 (RoomShell, 390px 뷰포트 기준)
- 우측 아이콘 4개: 테마(w-9=36) + 컨시어지(w-11=44) + 긴급(w-11=44) + 서랍(w-9=36) = 160px + gap-2×4 = **192px**
- 좌측 back(탭 스택 시 36px) + px-4(32px) → 제목 가용폭 **~166px(back 없을 때) / ~128px(back 있을 때)** → 투어명 26자 영문이 반드시 잘림
- 헤더 bg `--tr-surface`(#fcfcfb 흰색) + 헤어라인 — 카톡/LINE은 **헤더가 배월페이퍼와 같은 색**(융합), 아이콘 3개 이하, 구분선 없음
- 부제목 줄(date·city)이 상시 렌더 → 헤더가 2줄 → 시각 무게 가중
- 가이드 룸: headerTitleSlot=좌석스트립 + 명단칩(36) + 테마 + 긴급 + 서랍 → 스트립 가용폭 부족 (이미 한 번 홈버튼을 뺀 전력, PR #488)

### A-2 StaffShell 헤더
- 홈(36)+제목+새로고침(36)+테마(36), bg surface — 같은 흰-위-흰 문제. 제목(투어명) 동일 잘림.

### A-3 전체 배경
- 라이트 캔버스 #f3f4f2 ↔ 서피스 #fcfcfb — 근사 회색 2종뿐, 색상 0 → "완전 하얀 미완성" 인상의 근원. 다크는 준수.
- `--tr-home-canvas`는 `[background:var(--tr-home-canvas)]`로 소비되어 **그라데이션 수용 가능**(스킨 활용 지점).

### A-4 명단/대화
- GuideSeatDashboard: [명단|좌석판] 세그먼트 이미 존재. 명단은 ops형 아코디언(텍스트 밀집) — 카톡 친구탭 문법(아바타·이름·서브라인·트레일링 액션) 아님.
- GuideConsole 대화 탭: 룸당 대형 카드(아바타+메타+미리보기+**액션 버튼 5개**) — 카톡 채팅탭의 행(row) 문법 아님. 전체 안내 도구는 접이식 인라인 섹션.
- 브로드캐스트 메시지는 `metadata.fanout=true`로 식별 가능(broadcast route L284) → "전체 공지" 스레드 행 미리보기 근거.

### A-5 참조 앱 해부 (스크린샷)
- **카톡 채팅방 헤더**: 배경=월페이퍼 색 그대로, 구분선 없음, back + 제목(+인원수) + 우측 얇은 아이콘 3~4개, 원형 배경 없음.
- **LINE 채팅방 헤더**: 동일 문법 (배경 융합 + 검색/통화/메뉴 3개).
- **카톡 테마 4종 색 추출**:
  - 겨울이야기: 채팅 캔버스 파우더블루 #dce7f2, 흰 버블, 내 버블 연블루, 전체 한랭 파스텔
  - 비밀의 숲: 리스트 크림 #f2efe4, 채팅 캔버스 라이트올리브 #d9e0a0대, 그린 액센트
  - 숨바꼭질: 파스텔 하늘 #cfe3ee + 연초록 구릉, 내 버블 딥틸
  - 고대비: 순흑 배경, 흰 텍스트, 아웃라인 버블 (저시력 접근성 테마)
- **카톡 클래식(吳國華 방)**: 스카이블루 월페이퍼 #b2c7d9대 + 흰 수신버블 + 그린 발신버블 — 딥 파인 발신버블과 자연 결합.
- **카톡 친구탭**: 섹션 헤더(라벨+카운트) + 행(아바타 44·이름·서브라인) + 트레일링 pill 버튼(선물하기).
- **카톡 채팅탭**: 행(아바타·이름+인원수·미리보기 1줄) + 우측(시각 상단, 빨간 카운트 하단).

---

## §B 바인딩 결정 (C-D1 ~ C-D10)

**C-D1 헤더 다이어트.** 헤더 아이콘 상한 = 우측 3개(카톡 패리티).
- 게스트 룸: [back?] 제목+LIVE | 컨시어지 · 긴급 · 서랍
- 가이드 룸: [back] 좌석스트립+명단칩 | 긴급 · 서랍 (컨시어지는 원래 손님 전용)
- StaffShell: [홈] 제목+뱃지 | 새로고침 (2개)
- **테마 토글은 헤더에서 제거** — 대체 접근: ① 설정 탭(기존 풀 컨트롤) ② RoomDrawer 바로가기 그리드에 [화면 모드] 타일 추가(원탭 사이클). A5 결정("모든 표면에 명시 컨트롤")은 "헤더"가 아니라 "쉬운 접근"이 본질 — 서랍 타일+설정 탭이 충족. `themeToggle.test.tsx`·walk 스크립트 갱신 필수.
- 버튼 폭 통일 w-10(40px), 높이 h-11(44px 터치 불변), 아이콘 TR_ICON.nav(22)/stroke 1.75 유지(크기가 아니라 개수·배경·폭이 문제였음), gap-2→gap-1.
- 부제목 줄 조건화: **연결 저하 시에만** 힌트 줄 렌더. 평상시 1줄 헤더(뱃지로 상태 전달). StaffShell은 운영정보(날짜·예약·탑승)라 부제 유지하되 tr-meta 1줄.

**C-D2 크롬 토큰.** 신규 `--tr-chrome`(헤더/탭바/서랍 헤더 bg), `--tr-chrome-line`(크롬 경계선 색). 기본 스킨: chrome=canvas와 동일, line=투명(카톡 융합 문법). 다크: chrome=canvas 다크. 헤더/탭바/RoomDrawer 헤더/StaffShell 헤더·탭바가 `bg-[var(--tr-surface)]`→`bg-[var(--tr-chrome)]`, `tr-hairline-*`→`tr-chrome-line-*`(신규 유틸). 시트/카드/컴포저는 surface 유지(콘텐츠 레이어).

**C-D3 기본 스킨 마감(화이트 탈출).** 라이트 캔버스 #f3f4f2 → **#eef1ee**(옅은 세이지 그레이), home-canvas는 미세 그라데이션. 서피스/버블/시그니처 불변 — "흰 미완성" 인상만 걷어낸다. 다크 불변.

**C-D4 스킨 6종.** `TourSkin = 'classic' | 'sky' | 'winter' | 'forest' | 'meadow' | 'contrast'`
각 스킨 = `.tr-root[data-tr-skin='X']` 라이트 블록 + `.dark .tr-root[data-tr-skin='X']` 다크 블록. 오버라이드 토큰: canvas/surface/surface-2/hairline/chrome/chrome-line/bubble-me(+ink)/bubble-in(+ink)/bubble-system(+ink)/accent/accent-soft/accent-deep(고대비만)/safe/safe-soft/home-canvas/home-tile/chip-grad-accent. **danger·danger-soft 불변(전 스킨 SOS 레드).**

| 스킨 | 무드(참조) | 라이트 canvas | 내 버블 | 액센트 |
|---|---|---|---|---|
| classic 기본 | 딥 파인·아이보리(현행 계승) | #eef1ee | #2e5e4e | #2e5e4e |
| sky 하늘 | 카톡 클래식 스카이 | #bdd0e0 | #2e5e4e | #33617f |
| winter 겨울 | 겨울이야기 | #dfe9f3 | #46708f | #46708f |
| forest 숲 | 비밀의 숲 | #e6e9d2 | #55712f | #55712f |
| meadow 들녘 | 숨바꼭질 | #d7e7e3 | #37705f | #37705f |
| contrast 고대비 | 고대비(접근성) | #ffffff | #111111 | #111111 |

- 페어링 불변식: `bg-[--tr-accent]` CTA는 `text-[--tr-bubble-me-ink]`와 짝(코드 전반 60+곳) → **모든 스킨에서 accent 계열과 bubble-me-ink가 함께 정의**되어 대비 ≥4.5:1.
- 고대비: 라이트=흰 바탕·순흑 잉크·강한 경계선, 다크=순흑 바탕·흰 잉크·아웃라인 버블(스크린샷 문법). hairline 불투명 강화.
- 다크 변형: 각 색상 가족의 저휘도 캔버스(겨울=한랭 네이비, 숲=딥 올리브 그린-블랙, 하늘=딥 슬레이트, 들녘=딥 틸-그린).

**C-D5 스킨 저장·적용.** `TourRoomSettings.skin`(기본 'classic', sanitize 화이트리스트, 구버전 저장값 무해). RoomShell·StaffShell `.tr-root`에 `data-tr-skin` 스탬프. 콕핏(주행 다크 고정)·플랜 에디터·조인/체크인·ops 콘솔은 v1 제외(스탬프 없음=클래식). StaffShell은 `tr-plan-root` 병행이지만 `[data-tr-skin]` 특이도(0,2,0)가 `.tr-plan-root`(0,1,0)를 이겨 스킨이 우선 — 의도된 동작.

**C-D6 테마 피커.** SettingsTab(5로케일)·StaffSettings(ko)에 "배경 테마" 카드: 스킨별 미니 프리뷰 스와치(캔버스 색 + 수신/발신 버블 도트 2개) + 이름 + 체크. 라벨: ko 기본/하늘/겨울/숲/들녘/고대비 · en Classic/Sky/Winter/Forest/Meadow/High contrast · ja/es/zh 상응. 스와치는 텍스트 없음(타입 규율 무접촉), aria-label 필수.

**C-D7 대화 탭 = 카톡 채팅탭 문법.** GuideConsole 대화 탭 재구성:
1. 어텐션 스트립(답장 N·검토 N) 유지
2. **고정 행 2개**: [손님 안내 보내기](기존 open-announce, 행 문법으로 리스킨) · [전체 공지] 스레드 행(메가폰 스쿼클, 미리보기=feed에서 `metadata.fanout` 최신 ko 텍스트, 폴백 "모든 손님에게 한 번에 안내") → 탭하면 **공지 시트**(Sheet)가 열리고 기존 전체 안내 블록 전체(세그먼트 공지/집합/자유시간 + 타겟 칩/피커 + 음성 + 프리셋)가 그 안으로 이사
3. **손님 대화 행**: 44px 휴 아바타 · 이름+인원·언어 메타 · 뱃지(답장필요=레드 도트, 일정 상태 칩, 탑승 ✓) · 미리보기 1줄 · 우측 시각(KST HH:MM/날짜) — 행 탭=그 룸 채팅 열기(1:1), 트레일링 ⋮(44px)=**손님 액션 시트**([일정 검토·확정](private만)·[정산]·[AI 도우미]·[운전 모드]·[이 손님에게만 공지]) → 기존 5액션 전부 보존(편의성 무손실)
4. 최근 메시지 피드 유지(컴팩트 재스타일)
- `onTargetNotice`(좌석→개인공지)는 이제 **공지 시트 오픈**으로 단순화(스크롤 점프 랩 제거). scrollIntoView 로직 삭제.
- 시간 포맷 순수 함수 `chatListTime(iso, nowMs)` 신설(+ jest): 오늘=HH:MM(KST), 그 외=M/D.

**C-D8 명단 = 카톡 친구탭 문법.** GuideSeatDashboard 명단 뷰 리스킨(로직·테스트ID·뮤테이션 전부 보존):
- 픽업 그룹 헤더 = 섹션 라벨(시각·이름·팀/명·체크인 카운트) 유지하며 여백·타이포 정돈
- 행 = 40px 휴 아바타(대화 탭과 동일 휴 = 같은 사람 같은 색) · 이름 semibold + 인원 · 서브라인(좌석 N/미지정 · 채널) · 뱃지(경고/메모) · 트레일링 상태 pill(체크인/대기/노쇼 기존 statusMeta 색)
- 행 탭=게스트 카드(기존), 좌석판·QR·게이트·노쇼 증거 플로우 무접촉
**좌석판은 그대로**, 세그먼트 토글로 번갈아 봄(요청 그대로 — 이미 있는 구조 재확인).

**C-D9 검증 하니스.** `scripts/qa-smartapp-walk.mjs` 갱신: 헤더 테마 토글 스텝 → 설정 탭 테마 버튼으로 대체, 스킨 4종 전환 샷(설정→겨울/숲/하늘/고대비), 새 대화 리스트·공지 시트·손님 액션 시트·명단 리스킨 샷 추가. 콘솔 에러 0 게이트 유지. jest: themeToggle(서랍 타일로 재작성)·staffShell(테마 토글 제거 반영)·settings(스킨 피커)·신규 skin sanitize·chatListTime.

**C-D10 불가침.** ActionGrid `+`트레이(사용자 보호) 무접촉 · pruneTarget 오발송 방지 로직 무접촉 · SOS 레드 전 스킨 불변 · 44px 터치 타깃 불변 · CJK `text-cjk-safe/body` 규율 유지 · typeDiscipline(tr-* 타이포만, lucide 배럴만) 준수 · 빌드는 `npm run build`만.

---

## §C WBS

- **P0 스킨 인프라**: settings.skin + sanitize + 스탬프(RoomShell/StaffShell) + `--tr-chrome`/`--tr-chrome-line` + 기본 스킨 캔버스 마감(C-D3) + sanitize 테스트
- **P1 헤더 컴팩트**: RoomShell/StaffShell/RoomDrawer 크롬 적용 + 아이콘 다이어트 + 테마 토글 이전(서랍 타일) + 부제 조건화 + 테스트 갱신
- **P2 스킨 6종 + 피커**: CSS 오버라이드 블록(라이트+다크 × 5) + SkinPicker 컴포넌트 + SettingsTab/StaffSettings 배선 + 테스트
- **P3 대화 리스트**: 채팅탭 행 문법 + 공지 시트 이사 + 손님 액션 시트 + chatListTime + 테스트
- **P4 명단 리스킨**: 친구탭 행 문법 (좌석판 무접촉)
- **P5 게이트·감사**: tsc 0 · 투어모드 jest green · npm run build · walk 스크린샷(스킨×표면 매트릭스) · 적대적 시각/코드 리뷰 라운드 → 수정 → 커밋/PR/머지 → 한국어 결과 보고

## §D 리스크 레지스터

| # | 리스크 | 완화 |
|---|---|---|
| R1 | accent 교체가 어딘가의 하드코딩 짝과 어긋나 대비 붕괴 | 스킨은 항상 accent+soft+bubble-me-ink 세트로 정의, 고대비/스카이 스모크 샷으로 육안 확인 |
| R2 | 테마 토글 제거가 기존 테스트/walk 깨뜨림 | 대상 3파일 사전 식별 완료(themeToggle.test, staffShell.test?, walk) — 같은 PR에서 갱신 |
| R3 | tr-plan-root vs skin 특이도 역전 | 특이도 계산 완료(0,2,0>0,1,0), P2에서 StaffShell 실샷 확인 |
| R4 | 공지 시트 이사로 좌석→개인공지 플로우 단절 | onTargetNotice=시트 오픈+타겟 프리필로 재배선, walk에 시나리오 샷 추가 |
| R5 | 고대비 스킨에서 soft 토큰들이 저대비로 남음 | 고대비는 soft류를 전부 고불투명 재정의, 육안+검사 |
| R6 | feed에 metadata 미포함(overview API)이면 공지 미리보기 실패 | P3에서 API select 확인, 미포함이면 폴백 카피 사용(추가 select는 1줄) |

## §E 실행 로그 (2026-07-27 완주)
- [x] P0 스킨 인프라 — settings.skin(sanitize)+data-tr-skin 스탬프+`--tr-chrome`/`--tr-chrome-line`+기본 캔버스 세이지 워시
- [x] P1 헤더 컴팩트 — RoomShell(우측 3아이콘 상한, 테마 토글→서랍 타일+설정 탭, 정적 부제 제거)·StaffShell(홈+새로고침 2아이콘)·RoomDrawer 크롬, themeToggle/staffShell 테스트 재작성
- [x] P2 스킨 6종+피커 — sky/winter/forest/meadow/contrast 라이트+다크 블록, **대비 수치검증 66쌍 전부 통과**(ink-3/system-ink 5스킨 보정 포함), SkinPicker 5로케일+StaffSettings 배선
- [x] P3 대화 리스트 — 고정 채널 행 2(안내 발송·전체 공지=최근 fanout 미리보기)+대화 행(휴 아바타·미리보기·KST 시각·언리드 도트)+⋮ 액션 시트(5액션 보존)+전체 안내 시트 이사(scrollIntoView 사다리 삭제), chatListClock KST 자정 경계 테스트
- [x] P4 명단 리스킨 — 친구탭 행 문법(대화 탭과 동일 휴=`lib/tour-room/hue` 추출로 순환 임포트 회피), 좌석판·뮤테이션·테스트ID 무접촉
- [x] P5 게이트 — tsc 0 · 투어모드 스위트 997 green · 전체 jest 4538 pass(잔여 실패 4스위트=main과 동일한 사전존재 러너 스코프, A1 원장 신규 2행 등록으로 원장 테스트 회복) · `npm run build` 통과 · Playwright walk 21컷 **WALK OK·콘솔 에러 0**(스킨 매트릭스·시트 3종·명단·겨울 라이트/다크 실렌더 검증)
- 기록된 dev 전용 이슈: Next dev N-인디케이터가 헤드리스에서 좌하단 탭을 가림 → walk는 `$eval` 직접 디스패치(프로덕션 무관)
