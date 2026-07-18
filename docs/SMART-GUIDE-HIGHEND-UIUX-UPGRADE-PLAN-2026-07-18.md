# Smart Guide High-End UI/UX Upgrade Plan

- 작성일: 2026-07-18
- 범위: `tour-mode` 스마트가이드 고객 플래너, 투어룸, 가이드 콘솔, 기사 콘솔
- 상태: 구현 전 계획
- 기존 기능 기준 문서: `docs/smart-guide-private-mode-master-plan-v2-2026-07-16.md`

## 1. 목표

스마트가이드의 기존 기능과 정보량은 유지하면서 다음 문제를 해결한다.

1. 진한 녹색, 엠버, 노란색 중심의 촌스럽고 무거운 인상을 제거한다.
2. 부드럽고 절제된 고급 여행 컨시어지 제품으로 시각 언어를 통일한다.
3. 코스를 선택하기 전에 포함 일정 전체를 확인할 수 있는 프리뷰를 제공한다.
4. `Your day`의 모든 편집 기능은 유지하되 기본 화면을 짧고 컴팩트하게 만든다.
5. 고객, 가이드, 기사 화면의 상태와 디자인을 하나의 제품 시스템으로 통합한다.
6. UI 개편 전에 일정 자동저장과 제출 상태의 기능 결함을 해결한다.

## 2. 현재 평가

| 영역 | 평가 | 핵심 판단 |
| --- | ---: | --- |
| 기능 범위 | 8/10 | 채팅, 음성, 자막, 지도, SOS, 일정, 가이드/기사 콘솔까지 제품 범위가 좋다. |
| 안정성 | 6.5/10 | 대표 테스트는 통과하지만 데이 플래너 자동저장과 제출 상태에 결함이 있다. |
| 고객 UI | 5/10 | 정보는 충분하지만 색이 강하고 카드와 입력 컨트롤이 길게 반복된다. |
| 앱 전체 일관성 | 4.5/10 | 고객 화면과 가이드/기사 화면이 서로 다른 제품처럼 보인다. |
| 유지보수성 | 5.5/10 | 주요 컴포넌트가 크고 화면, 상태, 네트워크, 다국어 문구가 한 파일에 섞여 있다. |

검증 결과:

- TypeScript 타입 검사 통과
- 스마트가이드 핵심 API/컴포넌트 테스트 185개 통과
- 저장 결함과 코스 프리뷰를 직접 검증하는 전용 UI 테스트는 현재 부족함
- 저장소 전체 테스트에는 스마트가이드 외 영역과 테스트 설정 관련 실패가 남아 있어 별도 정리가 필요함

## 3. 구현 전 필수 결함 수정

### P0-1. 자동저장 stale state

현재 입력을 변경한 직후 이전 렌더의 `save` 함수가 타이머에 캡처될 수 있다. 일정이나 파티 정보가 한 단계 이전 값으로 저장될 가능성이 있다.

조치:

- 최신 `stops`와 `needs`를 ref 또는 명시적 payload로 autosave 큐에 전달한다.
- 변경마다 기존 타이머를 취소하고 마지막 payload만 전송한다.
- 저장 중 추가 변경이 발생하면 완료 후 최신 payload를 한 번 더 저장한다.
- 컴포넌트 종료 전 미저장 변경 처리 정책을 명확히 한다.

### P0-2. 마지막 일정 삭제 미반영

현재 `stops.length > 0`일 때만 `stops`를 전송하므로 마지막 일정을 삭제하면 서버에 기존 일정이 남을 수 있다.

조치:

- 일반 draft 저장에서는 빈 배열도 유효한 값으로 전송한다.
- 제출과 가이드 확정에만 빈 일정 금지 규칙을 적용한다.
- 마지막 일정 삭제 후 재조회했을 때 빈 배열이 유지되는 API/컴포넌트 테스트를 추가한다.

### P0-3. 제출 상태 비영속

`Send to my guide` 후 클라이언트에서는 편집을 막지만 서버 상태는 `guest_draft`로 유지된다. 새로고침 후 다시 편집하거나 중복 제출할 수 있다.

조치:

- 상태를 `guest_draft`, `guest_submitted`, `guide_confirmed`, `live`, `done`으로 명시한다.
- `submitted_at` 또는 동등한 서버 상태를 저장한다.
- 동일 버전 중복 제출은 이벤트와 메시지를 다시 만들지 않도록 idempotent 처리한다.
- 제출 이후 변경 요청 UX를 별도 경로로 제공한다.

### P0-4. 위임과 직접 선택 상태 충돌

`guide_curated`를 선택한 뒤 직접 코스를 골라도 위임 플래그가 남을 수 있다.

조치:

- 계획 모드를 `custom`, `template`, `delegated` 중 하나로 관리한다.
- 직접 코스 적용 또는 직접 장소 추가 시 `delegated`를 해제한다.
- 위임 시 기존 draft를 유지할지 비울지 제품 규칙을 확정하고 화면에서 명확히 안내한다.

### P1-1. 실패 및 빈 상태 부재

- 코스 템플릿이 없을 때 빈 화면 대신 안내와 직접 선택 CTA를 제공한다.
- POI 로딩, 빈 결과, 네트워크 실패를 구분한다.
- Google Maps 키 또는 Places 로딩 실패 시 무한 로딩 문구 대신 재시도/대체 입력을 제공한다.
- 429 응답에는 자동 backoff와 구체적인 저장 상태를 표시한다.

## 4. 비주얼 시스템

### 4.1 무드

키워드:

- soft
- refined
- elegant
- editorial restraint
- premium travel concierge
- quiet confidence

피해야 할 표현:

- 화면 대부분을 차지하는 진한 초록색 또는 엠버색
- 강한 그라디언트와 유광 버튼
- 모든 컨트롤을 pill로 만드는 스타일
- 과도한 그림자와 중첩 카드
- 장식용 색상 칩과 아이콘 배경의 반복

### 4.2 권장 팔레트

| 역할 | 색상 | 용도 |
| --- | --- | --- |
| Canvas | `#F3F4F2` | 전체 펄 미스트 배경 |
| Surface | `#FCFCFB` | 카드와 시트 |
| Surface muted | `#ECEFEE` | 선택되지 않은 컨트롤, 구분 영역 |
| Primary ink | `#252A2C` | 제목과 본문 |
| Secondary ink | `#626B6F` | 보조 설명 |
| Primary action | `#667985` | 주요 CTA, 선택 상태 |
| Primary deep | `#4E606B` | 강조 텍스트와 active 상태 |
| Secondary accent | `#8A7883` | 개인화, 컨시어지, 특별 상태 |
| Hairline | `rgba(37,42,44,0.08)` | 카드와 입력 구분선 |
| Danger | `#B55252` | 오류와 경고 |
| Emergency | 현행 고채도 red 유지 | SOS 전용 예외 |

색상 사용 원칙:

- 한 화면의 포인트 컬러 면적은 10% 이내로 제한한다.
- 주요 CTA만 solid 색상을 사용한다.
- 선택 칩은 진한 배경 대신 미세한 tint와 hairline 조합을 우선한다.
- 성공, 연결, 저장 완료는 녹색 대신 아이콘과 중립색 문구로 전달할 수 있다.

### 4.3 배경 질감

- 128x128 또는 256x256 seamless monochrome noise PNG/WebP를 사용한다.
- canvas 전용 pseudo-element에 opacity 0.015-0.025로 적용한다.
- `pointer-events: none`, `position: fixed`로 레이아웃과 입력을 방해하지 않는다.
- 카드와 입력 표면에는 grain을 적용하지 않는다.
- 저사양 모바일에서 페인트 비용과 스크롤 성능을 확인한다.
- `prefers-reduced-motion`과 무관하게 질감은 정적이어야 한다.

### 4.4 형태와 타이포그래피

- 카드 radius: 14-16px
- 입력 radius: 10-12px
- CTA radius: 12-14px
- 카드 그림자: 한 단계의 매우 낮은 elevation만 사용
- 기존 Pretendard Variable을 기본으로 유지해 다국어 일관성을 확보
- 제목은 600, 본문은 400-500, 메타는 500으로 제한
- 대문자 라벨과 과도한 bold 사용을 줄인다.

## 5. 코스 탐색 및 프리뷰

### 5.1 코스 카드

기본 카드에는 다음만 노출한다.

- 실제 장소 대표 이미지
- 코스명
- 1줄 성격 설명
- 정류장 수, 총 예상시간, 이동 성격
- `Preview` 보조 버튼
- 선택된 코스의 명확한 상태

카드 전체를 무조건 선택 동작으로 만들지 않는다. 카드 탭은 프리뷰, 명시적 CTA는 코스 선택으로 역할을 구분한다.

### 5.2 프리뷰 바텀시트

모바일에서는 약 78dvh 높이의 바텀시트를 사용한다.

포함 내용:

1. 대표 이미지와 최대 3장의 실제 장소 이미지
2. 코스명과 간단한 설명
3. 총 정류장 수, 총시간, 예상 이동시간
4. 모든 포함 일정의 순서형 타임라인
5. 각 장소의 체류시간, 짧은 설명, 접근성/식사/걷기 정보
6. 계절 또는 운영 경고
7. 하단 고정 `이 코스 선택` CTA

데이터 전략:

- 기존 `course_templates.stops`로 전체 일정 목록을 만든다.
- 현재 로드하는 `match_pois`를 `poi_key`로 조인해 이미지와 장소 메타를 보강한다.
- 필요한 정보가 부족할 때만 templates API에 `preview_stops`를 추가한다.
- 실제 장소를 확인할 수 있는 이미지를 사용하고 장식용 stock 이미지는 사용하지 않는다.

### 5.3 선택 후 피드백

- 선택한 코스명을 `Your day` 요약 상단에 표시한다.
- 코스 변경 시 브라우저 기본 confirm 대신 앱 스타일 확인 시트를 사용한다.
- 적용 성공 후 `Your day`로 짧게 스크롤하고 저장 상태를 표시한다.

## 6. Your Day 컴팩트 개편

### 6.1 기본 구조

상단 요약 바:

- `6 stops`
- `8h 20m`
- `54m driving`
- 경고 개수 또는 상태

일정 목록:

- 세로 타임라인 형식
- 기본 행 높이 60-72px
- 순번, 시간, 장소명, 체류시간만 표시
- 한 번에 하나의 행만 펼친다.

### 6.2 펼친 일정 행

펼쳤을 때만 다음을 표시한다.

- 도착 예정시간
- 체류시간
- 게스트 요청 메모
- 해당 일정의 운영/거리 경고
- 삭제 또는 기타 메뉴

### 6.3 재정렬

- 기본 화면에서 위/아래/삭제 버튼 3개를 반복 노출하지 않는다.
- `Edit order` 모드에서 drag handle과 삭제를 제공한다.
- 키보드와 스크린리더 사용자를 위한 대체 이동 버튼은 접근성 메뉴에 유지한다.
- 저장 중 순서가 바뀌거나 중복 저장되지 않도록 optimistic state를 검증한다.

### 6.4 About Your Party

내용은 유지하되 progressive disclosure를 적용한다.

- 미입력 상태: 기본 펼침
- 입력 완료 상태: `2 adults · Standard pace · No accessibility needs` 요약으로 접힘
- 편집 버튼 또는 헤더 탭으로 다시 펼침
- 성인/아동 수는 숫자 input 대신 compact stepper 검토
- stroller, wheelchair, luggage는 체크 아이콘이 있는 compact option row 사용
- dietary와 pace는 과도한 pill 반복을 줄이고 segmented/checkbox 패턴으로 정리
- 알레르기 입력 시 식당용 한국어 카드가 생성된다는 사실을 입력 근처에서 자연스럽게 연결

## 7. 앱 전체 UI/UX 통합

### 고객 영역

- `TourModeEntry`: 앱 진입과 예약 선택의 정보 위계 정리
- `HomeTab`: 타일 수와 강조색을 줄이고 오늘 상태를 첫 화면의 중심으로 이동
- `RoomShell`: 헤더와 하단 탭을 새 토큰으로 통일
- 채팅: 발신 버블의 parchment/brass 색상을 중립 tint로 전환
- 지도: 지도 위 카드와 시트의 배경, 버튼, 상태 색상을 통일
- 컨시어지: secondary accent를 사용해 일반 채팅과 구분
- 배너: 인앱 브라우저, 설치, 알림 권한 배너의 높이와 우선순위를 통합

### 가이드 영역

- raw `gray`, `amber`, `emerald` Tailwind 색상을 공통 semantic token으로 교체
- 공지, 자유시간, 일정 확정, 도착 처리의 액션 위계를 재정의
- `GuidePlanPanel`의 일정 편집 구조를 고객 플래너와 같은 timeline grammar로 맞춤
- 고객 요청과 알레르기는 명확하게 보이되 경고색 남용을 줄임

### 기사 영역

- 운전 중 가독성과 큰 터치 영역은 유지한다.
- 카카오내비/티맵 브랜드 색상은 해당 외부 앱 버튼에만 제한한다.
- 전체 화면의 emerald/yellow 원색을 중립 dark cockpit palette로 정리한다.
- 운전 중 조작을 줄이기 위해 핵심 액션 외 설정과 보조 기능을 sheet로 이동한다.

## 8. 컴포넌트 구조 개선

`PlanEditorClient.tsx`는 약 1,600줄이므로 디자인 개편 전에 다음 단위로 분리한다.

```text
plan/
  PlanEditorClient.tsx
  plan-copy.ts
  plan-types.ts
  usePlanEditor.ts
  usePlanAutosave.ts
  PlannerHeader.tsx
  PlannerTabs.tsx
  CourseList.tsx
  CourseCard.tsx
  CoursePreviewSheet.tsx
  PlacePicker.tsx
  YourDayTimeline.tsx
  TimelineStopRow.tsx
  PartyNeedsPanel.tsx
  PlanSubmitBar.tsx
```

원칙:

- 서버 상태와 표시 상태를 구분한다.
- 저장 payload 생성은 순수 함수로 분리한다.
- copy와 locale 분기를 렌더링 코드에서 분리한다.
- course preview와 day timeline은 독립적으로 테스트 가능해야 한다.

## 9. 구현 단계

### Phase 0. 안정화

- P0 저장 결함 4개 수정
- API 상태 모델과 마이그레이션 확정
- 자동저장 fake timer 테스트
- 빈 일정 삭제, 중복 제출, 위임 해제 테스트

완료 조건:

- 새로고침 전후 서버와 화면 상태가 동일함
- 마지막 일정 삭제가 서버에 반영됨
- 동일 버전 제출 이벤트가 한 번만 생성됨

### Phase 1. 디자인 토큰 및 배경

- 새 팔레트와 semantic token 정의
- grain asset 및 canvas 적용
- 카드, 입력, 버튼, sheet 기본 형태 정리
- light/dark mode 대비 확인

완료 조건:

- 진한 녹색/엠버 면적이 주 시각 언어에서 제거됨
- 고객 플래너 전체가 새 토큰만 사용함
- WCAG AA 대비 기준 충족

### Phase 2. 코스 프리뷰

- 코스 카드 재설계
- 장소 이미지 연결
- 프리뷰 바텀시트 구현
- 선택/교체 확인 UX 구현
- 로딩, 빈 결과, 오류 상태 추가

완료 조건:

- 코스를 선택하기 전에 포함된 모든 장소를 확인 가능
- 프리뷰에서 코스 선택까지 두 번 이하의 명확한 동작
- 이미지 실패 시 레이아웃이 깨지지 않음

### Phase 3. Your Day 및 Party 압축

- 요약 바와 타임라인 구현
- 단일 확장 편집 행 구현
- 재정렬 모드 구현
- Party 아코디언과 요약 구현
- 경고와 저장 상태 배치 개선

완료 조건:

- 6개 일정의 기본 목록이 일반 모바일 첫 2개 화면 안에 들어옴
- 기존 필드와 기능의 손실 없음
- 저장, 삭제, 순서 변경을 새로고침 후에도 재현 가능

### Phase 4. 스마트가이드 전체 통일

- 고객 투어룸 홈/채팅/지도/시트 적용
- 가이드 콘솔 적용
- 기사 콘솔 적용
- 배너와 알림 상태 통합

완료 조건:

- 고객, 가이드, 기사 화면이 같은 디자인 토큰과 컴포넌트 규칙을 사용함
- 역할별 사용 목적은 유지하면서 동일 제품으로 인지됨

### Phase 5. 회귀 및 사용성 QA

- 360, 390, 430px 모바일
- 태블릿 및 데스크톱 좁은 창
- 영어, 한국어, 일본어, 중국어, 스페인어
- light/dark mode
- 인앱 브라우저와 Chrome/Safari
- 느린 네트워크, 오프라인, 401/403/409/429/500 상태
- 음성, 위치, SOS, 지도, 제출/확정 실사용 흐름

완료 조건:

- TypeScript와 관련 테스트 통과
- 핵심 플래너 컴포넌트 테스트 추가
- 모바일 스크린샷 회귀 테스트 통과
- 텍스트 겹침, 가로 overflow, sticky bar 가림 현상 없음

## 10. 권장 릴리스 단위

### Release A: Planner Premium

Phase 0-3을 묶는다.

- 저장 신뢰성
- 새 팔레트와 grain
- 코스 프리뷰
- 컴팩트 Your Day
- Party progressive disclosure

### Release B: Smart Guide System

Phase 4-5를 묶는다.

- 투어룸 전체 통일
- 가이드/기사 콘솔 통일
- 역할별 사용성 QA
- 시각 회귀 및 운영 오류 상태 강화

## 11. 구현 시 변경 예상 파일

주요 파일:

- `components/tour-mode/plan/PlanEditorClient.tsx`
- `app/tour-room-theme.css`
- `app/api/tour-rooms/[bookingId]/plan/route.ts`
- `app/api/tour-rooms/[bookingId]/plan/templates/route.ts`
- `components/tour-mode/RoomShell.tsx`
- `components/tour-mode/HomeTab.tsx`
- `components/tour-mode/guide/GuidePlanPanel.tsx`
- `components/tour-mode/guide/GuideConsole.tsx`
- `components/tour-mode/driver/DriverConsole.tsx`

추가할 테스트:

- `__tests__/components/tour-mode/planEditorAutosave.test.tsx`
- `__tests__/components/tour-mode/coursePreview.test.tsx`
- `__tests__/components/tour-mode/yourDayTimeline.test.tsx`
- 기존 `__tests__/api/tour-rooms-plan.test.ts` 확장
- 플래너 모바일 visual regression spec

## 12. 최종 성공 기준

1. 사용자가 코스의 모든 포함 일정을 확인한 뒤 선택할 수 있다.
2. 일정 6-8개가 있어도 기본 플래너 화면이 짧고 쉽게 스캔된다.
3. 기능을 잃지 않고 필요한 항목만 펼쳐 편집할 수 있다.
4. 모든 변경은 신뢰할 수 있게 저장되고 새로고침 후 동일하다.
5. 고객, 가이드, 기사 화면이 하나의 프리미엄 스마트가이드 제품으로 보인다.
6. 녹색, 엠버, 노랑은 의미가 필요한 소규모 상태 표현에만 남는다.
7. 질감은 느껴지지만 가독성이나 성능을 해치지 않는다.
