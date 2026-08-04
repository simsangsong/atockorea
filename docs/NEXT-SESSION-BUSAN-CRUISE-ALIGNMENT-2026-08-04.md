# 다음 세션 부트스트랩 — 부산 기항지 3종 리스팅 정합 (2026-08-04)

## 0. 첫 명령 (DB 접근 되는 로컬 세션 전용)

```bash
git fetch origin claude/busan-shore-excursion-analysis-py64pc
git checkout claude/busan-shore-excursion-analysis-py64pc
npm install
```

그 다음 **DB 적용** — 이걸 하기 전에는 사이트 가격이 안 바뀐다:

```bash
psql "$DATABASE_URL" -f supabase/pending-db-apply/2026-08-04-07-busan-cruise-listing-alignment.sql
node scripts/import-match-v18.mjs --single busan-cruise-shore-excursion-bus-tour
```

⚠ **적용 순서 주의.** `pending-db-apply/`에 다른 트랙의 `2026-08-04-01~06`이 아직 남아 있다
(제주 코스 개편 · 부산 소그룹 신상품 · 포천 지오파크). 그쪽은 전용 러너
`npm run tours:apply-2026-08-04`가 01~04를 순차 적용·검증·아카이브한다.
**07은 그 러너에 포함되지 않는다** — 위처럼 따로 적용한다. 01~06을 먼저 돌리는 게 안전하다.

적용 후 검증 SQL은 07 파일 하단 주석에 있다(가격 58.79/68.95/456.99, `amount_minor`
5879/6895/45699, 조인 티어 `is_active`).

## 1. 지금까지 (브랜치에 푸시 완료, 2커밋)

**정본 문서:** `docs/busan-shore-excursion-tenant-onboarding-2026-08-04.md` (§1 매핑 · §4 잔여)

사장님 지시 = *"tenant 이름은 밝히지 말고, 지금 존재하는 상품을 위 정보로 100프로 맞춰"* ·
*"픽업은 북항 혹은 영도항 대중이 없어 둘 다"* · *"가격 무조건 똑같이"*.
**신규 SKU 만들지 않는다. 기존 3종을 리스팅에 맞춘다.**

| 리스팅 | 슬러그 | 이전 → 이후 |
|---|---|---|
| 조인 | `busan-cruise-shore-excursion-bus-tour` | $49·차단 → **$58.79**·노출 |
| 소그룹 12명 | `busan-small-group-sightseeing-tour-cruise-passengers` | $84/$79 → **$68.95** |
| VIP 프라이빗 | `busan-private-car-charter-cruise-shore` | $364 → **$456.99** |

끝낸 것: 가격 센트 정확(파이프라인 `Math.round` → 센트 반올림, 두 레지스트리) · 두 오버라이드 맵
동기화 · 픽업 두 터미널 동등화(6로케일) · 조인 9→8시간 · 소그룹 정원 12 통일 · 조인 차단 해제 ·
운영사명 유출 제거(`busan-outskirts-tongdosa` 픽업 지점명 6로케일).

기준선: tsc **0** · jest **5,926 pass / 0 fail** · `__tests__/audit` **310 pass**.
`scripts/align-busan-cruise-2026-08.mjs`는 **멱등**(`--dry-run` 지원).

## 2. 남은 일 (우선순위 순)

### S1. 소그룹 코스를 리스팅 9스톱으로 (제일 큼)
지금 `itineraryStops`가 자갈치·BIFF·국제시장을 **한 스톱으로 묶어** 놨고, 송도/용두산이
*"시간 되면(If time allows)"* 조건부다. 리스팅은 각각 세운다:

> 해동용궁사 → UN기념공원 → 점심(자비) → 자갈치시장 → BIFF광장 → 국제시장 →
> 감천문화마을 → 송도 구름산책로 → 송도 스카이파크(케이블카 현장 선택) → 용두산공원

**조인 버스 상품은 이미 사실상 일치**한다 — 송도해변 1스톱 vs 구름산책로+스카이파크 2스톱 차이만.
`routeFlowStops`·`routePhases`·`catalog_card.stopsCount`도 같이 움직여야 한다.

### S2. 포함/불포함 불릿을 리스팅에 맞추기
- 조인 2종 포함: **입장료** · 가이드(영/중) · 왕복 이동 · 통행료 · 주차 · 유류 · 발권수수료
- 조인 2종 불포함: 식사 · 개인경비 · 팁 · 보험 · **부산타워 전망대(현장)** · **스카이캡슐&해변열차(현장)**
- 프라이빗 불포함: **전 스팟 입장료** · 식사 · 개인경비 · 팁 · 보험
- 🔴 소그룹 `mp.lunch_included_fit: 1`이 본문 "점심 불포함"과 모순 — 같이 고칠 것

### S3. 정책 문구
조인 **08:00 이전 픽업 / 20:00 이후 종료 → ₩10,000/인** ·
프라이빗 **07:00 이전 시작 / 20:00 이후 종료 → ₩50,000/시간**, **부산 외 +₩130,000** ·
만 4세 이상 · 24시간 전 무료취소 · **크루즈 승객 전용(비크루즈 예약 거부)**.

### S4. 태종대 잔재 (원래 있던 결함)
소그룹 `itineraryStops`에서 빠졌는데 `seo.metaDescription`·`routePhases`·FAQ 다수에 남아 있다.

### S5. 프라이빗 내부 모순 (원래 있던 결함)
`hotel_pickup_available:false` + "호텔픽업 없음" ↔ SEO·DB·`mp.pickup_base` "호텔/KTX 픽업 가능" /
최대인원 하드제약 **7** ↔ 요금 티어 **13** ↔ 차량설명 **"밴 8–10명"**.

### S6. 🔴 사장님 결정 2건
1. **취소선(정가)** — 리스팅 "30% off"는 채널 프로모 배지고 원가가 화면에 없어서 **비워 뒀다.**
   표시하려면 값을 받아야 한다(지어내지 말 것).
2. **프라이빗 요금 티어**($230~$378, 8시간 1–6인/7–9인/10–13인)가 헤드라인 $456.99와 안 맞는다.
   티어를 지울지, 리스팅에 맞출지.

## 3. 🔴 함정 (전부 이 레포에서 실제로 밟은 것)

1. **운영사(테넌트) 이름을 소비자 표면에 절대 쓰지 말 것.** 채널이 사이트를 리뷰할 때 우리를
   경쟁자로 인식하면 파트너십에 영향이 간다는 게 이 지시의 이유다. 커밋 전:
   `grep -rin "lovekorea\|love korea\|러브코리아" components/ messages/ app/ lib/`
   → ops 이메일 파서 테스트 픽스처·캐시 키 상수 외에 나오면 안 된다.
2. **가격 출처가 둘이다.** `staticTourProductRegistry.ts`와 `catalogRegistrationBuilder.ts`의
   `SLUG_OVERRIDES`. "sync 유지" 주석을 달고도 어긋나 있었다. **한쪽만 고치지 말 것.**
3. **`parseListPriceUsd`는 이제 센트 반올림이다**(두 파일 모두). 달러 반올림으로 되돌리면
   $58.79가 조용히 $59가 된다.
4. **전역 치환 금지.** 이 레포는 전역 치환이 살아 있는 소비처를 지워 회귀를 낸 전적이 있고,
   옵셔널 prop이라 tsc가 조용했다. **diff를 읽어라.** 산문 6로케일은 구조화된 필드부터.
5. **생성물에 손으로 쓰지 말 것** — `catalogCards*.generated.ts`는 `node scripts/build-catalog-cards.mjs`
   가 만든다(`npm run build`가 자동 실행).
6. 검증은 `git checkout -B x origin/main` 기준으로. 로컬 `main`이 뒤처져 게이트를 헛잰 적이 있다.
7. **워크트리는 HMR이 안 먹는다** — 소스를 고쳤으면 dev 재시작 후 확인.

## 4. 머지 전 게이트

```bash
npx tsc --noEmit                                   # 기대: 0
npx jest --silent                                  # 기대: 5,926+ pass / 0 fail
npx jest __tests__/audit --silent                  # 기대: 310+ pass
node scripts/align-busan-cruise-2026-08.mjs --dry-run   # 기대: (no changes)
node scripts/build-catalog-cards.mjs               # 생성물 갱신 후 커밋
```
