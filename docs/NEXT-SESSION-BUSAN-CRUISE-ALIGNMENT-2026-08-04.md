# 다음 세션 부트스트랩 — 부산 기항지 3종 리스팅 정합 (2026-08-04/05)

## 0. 상태 — S1·S2·S3·R1·R2 전부 끝났다

레포·DB 양쪽 완료. `pending-db-apply/` 에 이 트랙 파일은 **없다**(10·11·12 전부 `applied/`).

**정본:** `docs/busan-shore-excursion-tenant-onboarding-2026-08-04.md`
(§2-b 코스·가격 · §2-c 태종대 잔재·프라이빗 모순 · §4 남은 일 · §4-b 사장님 결정)

기준선: tsc **0** · jest **5,944 pass / 0 fail**(562 스위트) · `__tests__/audit` **327 pass** ·
운영사명 소비자 표면 **0** · 두 변환기 **멱등**.

## 1. 남은 일

### 🔴 R3. 프라이빗은 EN 과 비영어가 서로 다른 상품이다 (결정 필요)
EN 스톱: 픽업 → 가이드와 코스 상의 → 동해안 옵션 → 역사·마을·시내 옵션 →
**부산항 귀환(목록 한가운데!)** → 용두산 → 남포동/자갈치 → 귀환 — **옵션 선택형**.
비영어: 유엔 → 태종대 → 점심 → 감천 → 용두산 → 남포동/자갈치 — **고정 6스톱**.
아코디언 스키마도 다르다(EN `{preview, content[]}` vs 비영어 `{icon, details[]}`).
**「고정 코스인가 선택형인가」는 상품 결정이라 코드로 못 정한다.** 정해지면 한쪽으로 통일.

### R4. 자매 상품에 같은 결함
`incheon-seoul-private-car-shore-excursion-cruise` 도 크루즈 기항 상품인데
`seoulConfig()`(호텔 픽업 기본 + 「방문지 추후 추가 예정」 슬롯)를 쓴다.
위치: `components/product-tour-static/_shared/privateSampleItinerary.ts:271`.
같은 종류지만 다른 트랙이라 이번엔 건드리지 않았다.

### R5. 번들 미번역/번역잔해 트랙 (별도)
조인 버스 상품의 CJK+es 스톱 `description` 5개가 영어 그대로였고, 이번에 건드리는 것만 고쳤다.
남은 것 + `**注：**` 꼴 번역기 메타노트는 별도 트랙. **bold 래칫 1474 가 그 원장이다.**

### R6. 🔴 사장님 결정 없이는 진행 금지
① **취소선 정가** — "30% off" 는 채널 배지고 원가가 화면에 없어 비워 뒀다. 지어내지 말 것.
② **프라이빗 요금 티어**(8시간 1–6인/7–9인/10–13인)가 헤드라인 $456.99 와 안 맞는다.
③ **프라이빗 정원** — FAQ 는 「1–3인 세단/SUV, 4–7인 밴, 그 이상은 별도 문의」인데
   요금표는 **10–13인**까지 판다. 어느 쪽이 사실인지는 운영 정보이고 ②와 엮여 있다.

## 2. 🔴 함정 (전부 이 레포에서 실제로 밟은 것)

1. **운영사(테넌트) 이름을 소비자 표면에 절대 쓰지 말 것.** 채널이 사이트를 리뷰할 때 우리를
   경쟁자로 인식하면 파트너십에 영향이 간다는 게 이 지시의 이유다. 커밋 전:
   `grep -rin "lovekorea\|love korea\|러브코리아" components/ messages/ app/ lib/`
   → ops 이메일 파서 테스트 픽스처·캐시 키 상수 외에 나오면 안 된다.
2. 🔴 **`TOUR_PRODUCT_USE_SUPABASE=1` — 번들만 고치면 화면은 안 바뀐다.**
   `/tour-product/[slug]` 는 `tour_product_pages.detail_payload` 를 렌더한다.
   레포 변경에는 **항상 DB 동기화가 한 세트**다(`scripts/gen-busan-cruise-course-sql-2026-08.mjs`).
3. 🔴 **로케일 번들은 "같은 필드가 있다"가 아니라 "같은 것을 말한다"를 확인해야 한다.**
   이 트랙에서 같은 어긋남을 **네 곳**에서 봤다 — 스톱 이름 ↔ `poi_key`,
   갤러리 캡션 ↔ 사진, 점심 「포함/불포함」, 프라이빗 집합지 3곳 vs 2곳.
   **EN 만 맞고 비영어 5로케일이 옛 상품인 게 이 레포의 기본 실패 모양이다.**
   가드: 생성기의 `assertNamesMatchKeys`, 캡션은 사진에서 파생.
4. 🔴 **번들 밖에도 손님 문구가 있다.** `_shared/privateSampleItinerary.ts` 가
   「호텔 픽업 (기본)」과 「방문지 추후 추가 예정」을 렌더하고 있었다. **번들 grep 으로는 안 나온다.**
5. 🔴 **시각을 일괄치환하지 말 것.** 국제시장 영업시간이 `09:30–19:30` 이라 `19:30` 을 쓸면
   시장이 두 시간 반 일찍 닫는다. 컨테이너 화이트리스트 + 명시적 예외로 막고 있다.
6. 🔴 **숫자만 바꾸면 주장이 거짓이 된다.** 8시간으로 압축하니 감천 「골든아워」·용두산 「황혼」이
   틀렸다. **시각을 옮길 땐 그 시각에 기대는 문장을 같이 읽어라.**
7. **`**` 는 `highlights`/`description`/`whyOnRoute`/`smartNotes.tip` 에서만 렌더된다.**
   상태 이모지(🔴⚠✅)는 손님 문구에 금지. 게이트 `bundleUnrenderedMarkup`, 래칫 **1474**.
8. **가격 출처가 둘이다** — `staticTourProductRegistry.ts` 와 `catalogRegistrationBuilder.ts` 의
   `SLUG_OVERRIDES`. **한쪽만 고치지 말 것.** `parseListPriceUsd` 는 **센트 반올림**이다.
9. **생성물에 손으로 쓰지 말 것** — `catalogCards*.generated.ts` 는 `node scripts/build-catalog-cards.mjs`.
10. **SQL 번호** — 07 은 경주가 쓰고 있었다. 이 트랙은 10·11·12. 새 파일은 **13부터**.

## 3. 실렌더 확인 방법 (이 트랙에서 **네 번** 이겼다)

`.claude/launch.json` 의 `busan-cruise-dev`(autoPort) → `/ko/tour-product/<slug>` 를 직접 열어라.
**워크트리는 HMR 이 안 먹는다 — 소스를 고쳤으면 dev 재시작.**
잡아낸 것: ① 번들만 고쳐선 화면이 안 바뀜 ② 한국어 코스가 통째로 다른 상품
③ 프라이빗 「샘플 일정」의 호텔 픽업·자리표시자 ④ 70,000 vs 130,000 정책 충돌.
**전부 tsc 0 · jest 초록인 상태에서 살아 있었다.**

## 4. 머지 전 게이트

```bash
npx tsc --noEmit                                          # 0
npx jest --silent                                         # 5,944+ pass / 0 fail
npx jest __tests__/audit --silent                         # 327+ pass
node scripts/align-busan-cruise-2026-08.mjs --dry-run     # (no changes)
node scripts/align-busan-cruise-course-2026-08.mjs        # rewrote 0 file(s)
node scripts/align-busan-cruise-course-2026-08.mjs --report   # 태종대: 소그룹 0
node scripts/build-catalog-cards.mjs                      # 생성물 갱신 후 커밋
```
