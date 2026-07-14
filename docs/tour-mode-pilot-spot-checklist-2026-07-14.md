# 투어모드 파일럿 스팟 검증 체크리스트 (T4.6 AC)

**파일럿 투어:** Busan Top Attractions Day Tour (`busan-top-attractions-day-tour`, tour_id `00daddb9-85ff-4981-a88f-d86aca809ed7`)
**시딩:** 2026-07-14 `scripts/seed-tour-guide-spots.ts` — 좌표 출처 = `match_pois`(빌더 지도와 동일 좌표), 콘텐츠 = `data/tour-stop-content/busan-top-attractions-day-tour.json`(T4.1 무손실 추출, 6로케일).

> 아래 표는 **사람 검수 게이트**입니다. 각 스팟을 지도에서 열어(링크) 실제 하차/집합 지점과 반경이 맞는지 확인하고 ✅ 해주세요. 수정은 `/admin/products` 투어모드 스팟 편집(T4.2) 또는 SQL로.

| # | 스팟 | 좌표 | 반경 | 확인 포인트 | 검수 |
|---|---|---|---|---|---|
| 1 | Haedong Yonggungsa Temple | [35.1884543, 129.2231109](https://maps.google.com/?q=35.1884543,129.2231109) | 150m | 주차장→사찰 입구 도보 구간이 반경 안에 드는지 (입구 기준이면 OK) | ☐ |
| 2 | Cheongsapo & Blue Line Park | [35.1613733, 129.1918758](https://maps.google.com/?q=35.1613733,129.1918758) | 200m | 청사포 정거장 기준. 미포~청사포 선형 구간이라 탑승 지점이 다르면 좌표 이동 필요 | ☐ |
| 3 | UN Memorial Cemetery | [35.127812, 129.0957126](https://maps.google.com/?q=35.127812,129.0957126) | 150m | 정문(추모관 쪽) 기준인지 | ☐ |
| 4 | Gamcheon Culture Village | [35.0973904, 129.0105924](https://maps.google.com/?q=35.0973904,129.0105924) | 200m | 버스 하차장(마을 입구 안내센터) 기준인지 — 마을이 넓어 반경 200m 유지 권장 | ☐ |
| 5 | Jagalchi Fish Market | [35.0966, 129.0308](https://maps.google.com/?q=35.0966,129.0308) | 150m | 본관 기준. 투어가 부평깡통시장 쪽에서 내리면 좌표 이동 필요 | ☐ |

**지오펜스 동작 파라미터(공통):** 진입 = trigger_radius / 이탈 = 1.5×(exit_radius_m NULL) / 60초 dwell / 6 m/s 초과(버스 통과) 시 도착 보류 / 도착 간 120초 쿨다운.

**미시딩 스톱:** #1 픽업(픽업 보드가 담당), #4 점심(식당 유동적) — 지오펜스 없음(의도).

**검수 후 할 일:** 이 문서 체크 → 문제 스팟은 어드민에서 좌표/반경 수정 → §I 내부 리허설(실기기)에서 도착 카드 1회 발화 확인.
