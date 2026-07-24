# 다음 세션 실행 프롬프트 — AtoC×Kursoflow 통합 (2026-07-25~)

> 아래 「복사용 프롬프트」 블록을 그대로 새 세션에 붙여넣으면 된다. 그 아래는 코디네이터가 참고할 상세 컨텍스트다.

---

## 복사용 프롬프트

```
AtoC×Kursoflow 통합 프로젝트를 이어서 진행한다. 전권 위임 상태다.

## 먼저 읽을 것
1. C:\Users\sangsong\Downloads\atoc-consolidation-plan.md — 단일 SoT.
   §14(인수인계: 배포완료/절차/남은 큐/Jason액션/불변원칙) → §13(실행로그, 최신이 위) → §5.7(식당 RAG 명세) → §11 → §12
2. 메모리 project_atoc_consolidation.md

## 현재 상태 (2026-07-24 저녁 종료 시점)
- main = f69c6bff, origin/main과 동일, Vercel 배포됨. 프로젝트 브랜치 전부 머지(미머지 0).
- 검증: tsc 0 · ops+tour-room+tour-ops+admin 177스위트 1656 green · `next build --webpack` 컴파일 성공.
- 라이브 마이그레이션 14개 적용. Supabase: atockorea=cghyvbwmijqpahnoduyv / Kursoflow=thgyevrqykkscvcpwmfp(읽기전용·쓰기 절대금지)
- task#1~#6 전부 완료(파서·인박스·좌석·게스트 라이프사이클·파이낸스 캡처원장·일일보고서·프라이빗/조인 분리·지오펜싱·노쇼 증거팩·Phase3 정산세무 A/B/C)
- **Kakao 키 검증 완료** — 로컬 `KAKAO_REST_API_KEY`로 Mobility 길찾기·Local 검색 실호출 성공. task#7 전면 착수 가능.

## 이번 세션 착수 지점: task#7 Kakao 식당 RAG (§5.7)
플랜 §5.7의 R-1~R-7을 그대로 구현한다. 핵심 계약:
- **RAG hit 시 Kakao API 호출 0** (오너 요구의 핵심). geohash7(≈150m 셀) 캐시 → 셀에 유효 캐시 ≥10곳이면 즉시 서빙.
- dietary 필터(비건/채식/할랄/돼지고기 제외/조개·견과 알러지/글루텐프리/아이동반)는 `tour_day_plans.needs`(기존 컬럼)에서 읽는다.
- 트리거는 식사 POI 도착 15분 전 — **기존 arrivalBundle 훅 재사용**(새 크론 만들지 말 것).
- 10 locale 번역은 **1회만**(Haiku + prompt caching) 하고 캐시에 저장, 이후 영구 재사용.
- 캐시 TTL 90일. 무효화 = 게스트 "정보 틀림" 신고 / 관리자 수동 / 폐업 감지.
- 제주 주요 POI 30곳 선행 시딩(백그라운드 배치 1회) — 일일 쿼터 70% 도달 시 알림.

## 슬라이스 표준 절차 (§14.2 — 2026-07-24 개정판, 반드시 준수)
워크트리 격리(`git worktree add C:\Users\sangsong\atockorea-<name> -b claude/ops-<name> origin/main`)
→ **워크트리마다 `npm ci` 실설치**(⚠node_modules를 정션으로 공유하면 한쪽이 지워질 때 전부 붕괴 — 실제 2회 발생)
→ 서브에이전트 빌드(로컬 커밋만·push 금지·하위에이전트 spawn 금지)
→ 코디네이터 검수: tsc 0 + 신규 green + 기존 비파괴 + 🔴**`npx next build --webpack`**
→ 마이그레이션은 파일 검토 → 기존데이터 위반 사전쿼리 → `mcp__atockorea__apply_migration` → 검증쿼리/`get_advisors`
→ `atockorea-main-merge`에서 `git merge --no-ff` → tsc + jest + 빌드 재검 → `git push origin main` + 브랜치 push
→ 플랜 §13에 로그 append

## 불변 원칙
- 투어룸 코어(tour_room_*, /app/tour-mode, lib/tour-room) 수정 금지 — additive만(D2)
- 비가역 대외 액션(세무 제출·대량 발송·결제·push) 금지, 오너 확인 후(D10)
- 미머지 8개 구 브랜치(admin-dashboard-upgrade 등, 5~7/18)는 이 프로젝트 무관 — 손대지 말 것
- 커밋 푸터 `Co-Authored-By: Claude <noreply@anthropic.com>`만. 진행보고 한국어

읽고 나서 task#7(Kakao 식당 RAG)부터 착수하라.
```

---

## 코디네이터 상세 컨텍스트 (프롬프트에 넣을 필요 없음)

### 1. 이번 세션(07-24 저녁)에 배포한 것

| 커밋 | 슬라이스 | 요지 |
|---|---|---|
| `8cc42875` | §11.C C2 1km 접근 프리뷰 | 서버 거리 재검증 + **3중 중복억제**(클라 스테퍼 / `tour_room_events` UNIQUE 선점 / 도착이 접근을 대체). 마이그레이션 0 |
| `10574389` | §11.C C1+C3 차량위치·ETA | 콕핏 위치공유 토글(기억형) + 손님 차량카드 + 2단 ETA(즉시 synthetic → `/vehicle-eta`가 Kakao로 교체) |
| `83d47bd3` | task#5 노쇼 증거팩 | 사진(카메라 강제)+GPS+타임스탬프, private 버킷·서명 URL, **증거 없으면 absent 400** |
| `df422af3` | task#6-A 월 정산 사이클 | 마감→인터컴퍼니 인보이스→송금 등록→**3자 대사 하드 게이트**(허용오차 0) |
| `720b466c` | 🔴 프로덕션 빌드 복구 | 아래 §2 참조 |
| `8f95a396` | task#6-B 가이드 등록부 | PII 봉투(평문 컬럼 없음)·단가 이력·휴무 달력·셀프 스케줄·열람 감사로그 |
| `f69c6bff` | task#6-C 정산·세무 서식 | 배정 원장(worked만 정산)·3.3% 원문 포팅·4종 서식(인쇄+BOM CSV, 940927) |

### 2. 🔴 반드시 승계할 교훈 — `next build`를 게이트에 넣어라

노쇼 슬라이스의 admin 증거 시트가 `'use client'` 페이지인데 `node:crypto`·`sharp`를 쓰는 서버 모듈(`lib/ops/seating/evidence.ts`)을 import했다. **tsc 0 · jest 전부 green인데 프로덕션 webpack 빌드만 실패** → `83d47bd3` 이후 Vercel 배포가 계속 실패 중이었고, 다음 슬라이스 서브에이전트가 발견해 알려주기 전까지 몰랐다.

- 재현 커맨드는 `npx next build --webpack`이다(`vercel.json` → `npm run build` → `next build --webpack`). 플래그 없이 `next build`만 돌리면 Turbopack 설정 에러로 엉뚱하게 죽는다.
- 해법 패턴: 순수 표시 함수를 **client-safe 파일로 분리**하고 서버 모듈이 re-export. 저장소 선례 = `facilityPins/facilityPins.server`, `eta/eta.server`, 이번에 추가된 `evidence/evidenceFormat`.
- 로컬 빌드에서 `/reviews` 프리렌더 실패는 **워크트리에 `.env.local`이 없어서** 나는 것이라 무시해도 된다(Vercel엔 env가 있다). 판정 기준은 `✓ Compiled successfully` 여부.

### 3. 환경 사고 — node_modules 정션 공유 금지

머지 직후마다 워크트리들의 `node_modules`가 비워지는 현상이 2회 발생했다. 여러 워크트리가 `mklink /J`로 **설치본 하나를 공유**하던 구조라 한쪽이 지워지면 전부 붕괴한다. 최종적으로 `atockorea-main-merge`에 실제 `npm ci` 설치본(1226 packages)을 만들어 복구했고, 이후 워크트리는 각자 실설치로 전환했다. **정션 공유로 되돌리지 말 것.**

### 4. task#7 착수 전 확인할 코드 지형

- `KAKAO_REST_API_KEY` — 로컬 검증 완료. Local API(`https://dapi.kakao.com/v2/local/search/category.json`, `category_group_code=FD6`/`CE7`)와 Mobility 둘 다 이 키로 동작한다.
- 기존 재사용 대상: `lib/tour-room/arrivalBundle.ts`(15분 전 훅 지점) · `tour_day_plans.needs`(dietary 저장소, W1 A10 니즈 체크리스트가 이미 씀) · `lib/tour-room/facilityPins*`(POI 스코프 지도 카드 렌더 선례) · `generatedContent.ts`(Haiku 배치 번역 + 일일 예산 편승 패턴) · `poi_facility_pins` 검수 게이트 UI(`/admin/facility-pins`) — 식당 캐시에도 같은 검수 패턴을 쓸지 판단할 것.
- 신규 테이블 2종 예정: `ops_kakao_place_cache`(geohash7 인덱스·tags GIN·expires_at) + `ops_restaurant_recommendations`. v1.2 §5.4.4 스키마를 채택하되 FK는 실스키마(bookings/tour_room_participants)로 조정.
- ⚠ 손님 노출 문구는 룸 5로케일(en/ko/ja/es/zh) 상수. 식당명·대표메뉴 번역만 10 locale 캐시.

### 5. task#7 이후 큐

1. **안전비디오 VTT 10트랙**(§5.6·§5.7 스크립트 완성본) + POI 소개비디오(`lib/video-automation` 확장)
2. **C-16 브리핑 카드스택 확장**(`lib/ops/seating/startBriefing.ts` 캡슐 9장)
3. **지오펜싱 후속 2건**: (a) 콕핏 GPS 워처 샘플을 접근 판정에도 연결 — 현재 C2 진입점은 손님 `RoomMapTab` 하나뿐이라 손님 위치공유 옵트인에 의존한다. 차량 위치로 발동하면 그 의존이 사라진다. (b) 접근 카드 비디오 슬롯에 실영상 연결
4. **잔여 소품**: 동행자 개별등록(C-6)·admin 차량배정 UI·§11.D D3 프리셋 kind 분리 재평가·Stripe fee 원장행

### 6. 사람 게이트 (코드로 못 넘는 것 — 오너 확인 필요)

- 🔴 세무: 부가세 방침(10% vs 알선 재설계) 세무사 확정 → 확정 전까지 정산서·인보이스에 부가세 라인 없음이 의도된 상태다. 확정 후 `ops_finance_config.expert_reviewed=true`로 DRAFT 해제.
- `ops_finance_config` 법인정보(법적명칭·주소·사업자번호·EIN·지급조건·수취계좌) 입력 — 미입력 시 인보이스에 "미입력" 자리표시.
- 신고기한 due_date 공휴일 순연 교정(시스템은 법정 날짜만 적었다). 서식 셀 ↔ 실제 HWP 별지서식 서면 대조.
- env: `OPS_GUIDE_PII_ENC_KEY`(미설정 시 주민번호·계좌 저장 400) · `OPS_GUIDE_SCHEDULE_TOKEN_SECRET` · Vercel의 `KAKAO_REST_API_KEY` **이름 일치 확인**.
- 실기기 QA: 기사 콕핏 위치공유(백그라운드 전환), 노쇼 카메라(iOS Safari `capture` 편차), admin 인쇄 뷰 3종(정산서·인보이스·증거 시트).
- 인박스 활성화 3건(Resend Inbound·`RESEND_WEBHOOK_SECRET`·OTA 포워딩), 해외직접투자 신고 이력 확인, Kursoflow 백업.
