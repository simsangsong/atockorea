# BUNDLE-BASELINE — 라우트별 실측 (풀 오디트 A5)

> [실측] `scripts/qa-bundle-baseline.mjs` · production build + `next start` · 390px 모바일 · 콜드 캐시.
> Next 16 빌드 출력에는 First Load JS 열이 없고 `app-build-manifest.json`도 없다 —
> 그래서 **네트워크가 실제로 실어 온 바이트**가 정본이다. 델타는 이 표를 기준으로 잰다.

| 라우트 | JS 요청 | JS KB | 총 KB | LCP ms | DCL ms | API 호출 | 중복 API |
|---|---|---|---|---|---|---|---|
| /tour-mode (entry) | 12 | 147.1 | 980.9 | 2448 | 191 | 1 | — |
| /tour-mode/room/[id] (guest, live) | 26 | 606 | 1359.3 | 2300 | 109 | 4 | /api/tour-rooms/3ff283a3-1e5c-445d-be1b-13899a40f9b8/join×2 |
| /tour-mode/room/[id] (guest, lobby) | 26 | 606 | 1331.8 | 628 | 105 | 5 | /api/tour-rooms/a2e0f971-62c8-49e4-bfdb-011cf493e64e/join×2 |
| /tour-mode/guide (staff shell) | 26 | 509.8 | 1468.7 | 524 | 108 | 2 | — |
| /tour-mode/plan/[id] (D-1 editor) | 16 | 259.4 | 2720.6 | 804 | 88 | 6 | — |
| /tour-ops (ops console) | 88 | 769.3 | 3460.3 | 128 | 115 | 6 | /api/currency/rate×2 |

## 읽는 법 (다음 세션이 이 표를 오해하지 않도록)

- **JS KB = `request().sizes()`** (소켓이 실어 온 바이트, 압축 후). `content-length` 로 재면
  압축·청크 응답에서 **0** 이 나온다 — 이 스크립트 첫 실행이 룸 전체를 "1.1KB" 로 보고했다.
- **총 KB에는 이미지·폰트·API 응답이 포함**된다. 로비/플랜이 큰 이유는 코드가 아니라 사진이다
  (로비 히어로 밴드 · 플랜 에디터의 POI 썸네일). 코드 회귀는 **JS KB 열로만** 판단하라.
- **LCP는 스로틀 없는 localhost** 값이라 절대치로 쓰면 안 된다. 델타 감시용이다.
  플랜이 요구한 3G 스로틀 LCP는 **미측정**(다음 세션 몫).
- **중복 API 2건은 판별 완료:**
  - `…/join ×2` — **설계된 동작**. 두 번째는 T2.9 TTS 능력 보고(`TourRoomClient.tsx:866-882`,
    "report the device's TTS capability once per entry"). 결함 아님.
    ⚠단 그 effect의 deps 가 `[bookingId, session, locale]` 이라 **로케일을 바꿀 때마다
    join 이 한 번 더** 간다(changeLocale 자신의 join 과 합쳐 2회). P3.
  - `/api/currency/rate ×2` — 관제 콘솔, 미판별. A8 후보.
- **N+1 없음**: 손님 홈 첫 페인트의 API 호출은 4~5건(join·스냅샷·근접·차량ETA 계열)으로
  스톱 수에 비례해 늘지 않는다 [실측].

## 이 표가 못 재는 것 (K4 하니스와 동일한 자백)

동시 리얼타임 연결 상한 · SSE 폴백 증폭(K1) · 번역 공급자 상한 · 콜드스타트 ·
**실기기 백그라운드 타이머 스로틀**. 전부 순차 로컬 측정으로는 구조상 불가 — 원장에 "시뮬 불가".
