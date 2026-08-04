# 다음 세션 부트스트랩 — 부산 기항지 3종 리스팅 정합 (2026-08-04)

## 0. 상태 — 레포·DB 양쪽 끝났다

**S1(코스) · S2(포함/불포함) · S3(정책) 완료. DB 적용·재동기화까지 완료.**
`pending-db-apply/` 에 이 트랙 파일은 **없다** — 10·11 둘 다 `applied/` 로 갔다.

**정본:** `docs/busan-shore-excursion-tenant-onboarding-2026-08-04.md`
(§2-b 이번에 한 것 + 실렌더가 잡은 것 · §4 남은 일 · §4-b 사장님 결정 2건)

기준선: tsc **0** · jest **5,943 pass / 0 fail**(562 스위트) · `__tests__/audit` **327 pass** ·
운영사명 소비자 표면 **0** · 두 변환기 **멱등**.

## 1. 남은 일 (우선순위 순)

### R1. 태종대 잔재 — 소그룹 산문 21건(EN, 6로케일 전부)
스톱 목록에서는 사라졌는데 `seo.metaDescription` · `seo.primaryKeywords` ·
`whyTourWorks.routeLogicSections` · 보행/어린이 아코디언 · `seasonalVariations` ·
날씨 노트에 남아 있다. **다누비 열차 안내까지 그대로다.**
판정: `node scripts/align-busan-cruise-course-2026-08.mjs --report`
⚠ **프라이빗의 태종대 52건은 결함이 아니다 — 실제 정차다. 건드리지 말 것.**

### R2. 프라이빗 내부 모순 (원래 있던 것)
`hotel_pickup_available:false` + "호텔픽업 없음" ↔ SEO·DB·`mp.pickup_base` "호텔/KTX 픽업 가능" /
최대인원 하드제약 **7** ↔ 요금 티어 **13** ↔ 차량설명 **"밴 8–10명"**.

### R3. 번들 미번역 트랙 (별도)
조인 버스 상품의 CJK+es 스톱 `description` 5개가 영어 그대로였고, 이번에 건드리는 것만 고쳤다.
남은 것 + `**注：**` 꼴 번역기 메타노트는 별도 트랙. **bold 래칫 1474 가 그 원장이다.**

### R4. 🔴 사장님 결정 없이는 진행 금지
① **취소선 정가** — "30% off" 는 채널 배지고 원가가 화면에 없어 비워 뒀다. 지어내지 말 것.
② **프라이빗 요금 티어**(8시간 1–6인/7–9인/10–13인)가 헤드라인 $456.99 와 안 맞는다.

## 2. 🔴 함정 (전부 이 레포에서 실제로 밟은 것)

1. **운영사(테넌트) 이름을 소비자 표면에 절대 쓰지 말 것.** 채널이 사이트를 리뷰할 때 우리를
   경쟁자로 인식하면 파트너십에 영향이 간다는 게 이 지시의 이유다. 커밋 전:
   `grep -rin "lovekorea\|love korea\|러브코리아" components/ messages/ app/ lib/`
   → ops 이메일 파서 테스트 픽스처·캐시 키 상수 외에 나오면 안 된다.
2. 🔴 **`TOUR_PRODUCT_USE_SUPABASE=1` — 번들만 고치면 화면은 안 바뀐다.**
   `/tour-product/[slug]` 는 `tour_product_pages.detail_payload` 를 렌더한다.
   레포 변경에는 **항상 DB 동기화가 한 세트**다(`scripts/gen-busan-cruise-course-sql-2026-08.mjs`).
   경주 트랙도 같은 데서 걸렸다.
3. 🔴 **로케일별 스톱 `name` 이 자기 `_poi_meta.poi_key` 와 어긋날 수 있다.**
   소그룹 비영어 5로케일이 그랬다 — 한국어 페이지가 영어와 **다른 옛 코스**를 팔고 있었다.
   poi_key 순서는 6로케일 동일해서 **소스로는 안 보인다.** 가드는 생성기의
   `assertNamesMatchKeys`. 그래서 소그룹은 **전 스톱을 도너에서** 가져온다.
4. 🔴 **시각을 일괄치환하지 말 것.** 국제시장 영업시간이 `09:30–19:30` 이라 `19:30` 을 쓸면
   시장이 두 시간 반 일찍 닫는다. 변환기는 컨테이너 화이트리스트 + 명시적 예외로 막고 있다.
5. 🔴 **숫자만 바꾸면 주장이 거짓이 된다.** 8시간으로 압축하니 감천 「골든아워」·용두산 「황혼」이
   틀렸다. **시각을 옮길 땐 그 시각에 기대는 문장을 같이 읽어라.**
6. **`**` 는 `highlights`/`description`/`whyOnRoute`/`smartNotes.tip` 에서만 렌더된다.**
   그 밖에 넣으면 별표가 그대로 찍힌다. 상태 이모지(🔴⚠✅)는 손님 문구에 금지.
   게이트 `__tests__/audit/bundleUnrenderedMarkup.test.ts`, 래칫 **1474**.
7. **가격 출처가 둘이다** — `staticTourProductRegistry.ts` 와 `catalogRegistrationBuilder.ts` 의
   `SLUG_OVERRIDES`. **한쪽만 고치지 말 것.** `parseListPriceUsd` 는 **센트 반올림**이다
   (달러 반올림으로 되돌리면 $58.79 가 조용히 $59 가 된다).
8. **생성물에 손으로 쓰지 말 것** — `catalogCards*.generated.ts` 는 `node scripts/build-catalog-cards.mjs`.
9. **SQL 번호 충돌** — 07 은 경주가 이미 쓰고 있었다. 이 트랙은 10·11. 새 파일은 **12부터**.

## 3. 실렌더 확인 방법 (이 트랙에서 세 번 이겼다)

```bash
node --env-file=.env.local scripts/apply-busan-cruise-course-2026-08.mjs --dry-run
```
`.claude/launch.json` 의 `busan-cruise-dev`(autoPort) → `/ko/tour-product/<slug>` 를 직접 열어라.
**tsc·jest 가 초록인 채로 한국어 코스가 통째로 틀려 있었다.**

## 4. 머지 전 게이트

```bash
npx tsc --noEmit                                          # 0
npx jest --silent                                         # 5,943+ pass / 0 fail
npx jest __tests__/audit --silent                         # 327+ pass
node scripts/align-busan-cruise-2026-08.mjs --dry-run     # (no changes)
node scripts/align-busan-cruise-course-2026-08.mjs        # rewrote 0 file(s)
node scripts/build-catalog-cards.mjs                      # 생성물 갱신 후 커밋
```
