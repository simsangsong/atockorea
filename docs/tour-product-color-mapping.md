# Tour-Product Detail — 색-의미 매핑표 (W3.1, §F-6ⓓ)

작성 2026-07-14. 상세 페이지(`components/product-tour-static/east-signature-nature-core/**` +
`_shared/**` 상세 전용 컴포넌트)의 **장식색 SSOT**. 모든 색 PR은 이 표와 대조한다.
토큰 정의: `tour-product-v2-scope.css`의 `--tpc-*` (풀/딥/워시 3슬롯, OKLCH 수치 밴드 — 앰버 앵커 캘리브레이션).

## 장식 토큰 (hue → 고정 의미)

| 토큰 | 의미 (단일) | 대표 사용처 |
|---|---|---|
| `--tpc-jade-*` | 보장·포함·가용 (positive assurance / live-available 통합 — 그린 충돌 해소) | 무료취소 마이크로라인, Included 체크, 서포트 confirm 스텝, (W5.1) 라이브 도트 |
| `--tpc-amber-*` | 즉시성·가격 주변 강조 (액션 인접) | 즉시확정, 별점 보조, 서포트 reminder 스텝 |
| `--tpc-orange-*` | 시간·타이밍 | 타이밍 아이브로우, day-of 스텝, 시계 아이콘 |
| `--tpc-rose-*` | 하이라이트·에디토리얼 보조 | 히어로 pill/eyebrow, 계절 spring, post-tour 스텝 |
| `--tpc-sapphire-*` | 정보·경로·지원 | route/support 아이콘, during-tour 스텝, 24/7 지원 |
| `--tpc-amethyst-*` | 가족·구성 특성 | AtAGlance family 행 |
| `--tpc-indigo-*` | 전야·야간 | night-before 스텝 |
| `--tpc-star` | 평점(별) 전용 | 리뷰·추천 카드 ★ |

## 별도 시스템 (이 표의 재조율 대상 아님 — 불변)

| 시스템 | 값 | 비고 |
|---|---|---|
| 액션 톤 (G-2) | `bg-amber-700` / `hover:bg-amber-800` | CTA·활성 선택 전용. 뷰포트당 대면적 풀 톤 1개 규칙 |
| 시맨틱 성공/실패 | emerald-50/700 · rose-50/700 pills | 가용성 상태·에러. 의미색이므로 장식 밴드 미적용 |
| 에디토리얼 존 | copper `#c8956c`(`--accent`), 이슈넘버, pull-quote, 화보 | §F-6 불가침. 지도 마커 copper 유지(§B 대체 명세 ④) |
| 4계절 wash | `--spring-blossom` 등 4종 | 기존 저채도 wash 유지 (W3.5에서 세그먼트화만) |

## 슬롯 규칙

- **full** (`--tpc-X-full`): 24px 이하 아이콘·도트·2px 헤어라인 소면적만.
- **deep** (`--tpc-X-deep`): 텍스트 (라벨·아이브로우).
- **wash** (`--tpc-X-wash`): 대면적 저틴트 배경. 섹션당 1종.
- 효과 스택 ≤1 (gradient+ring+shadow 동시 금지).
- 뷰포트 내 사진 제외 유채색 면적 체감 10~15%.

## 집행

- 판정: `grep -rE "(emerald|rose|violet|sky|orange|amber|teal)-(400|500|600)" components/product-tour-static/east-signature-nature-core/` → **0** (시맨틱 pills·액션 톤은 위 표의 예외 목록만 허용).
- 신규 장식색 = 이 표에 의미 행 추가 후에만.
