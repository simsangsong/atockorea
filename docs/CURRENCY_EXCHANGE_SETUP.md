# USD / KRW 통화 전환 및 실시간 환율 API 가이드

사이트에서 가격을 **USD**와 **KRW**로 전환해 보여주고, **실시간 환율**을 반영하려면 아래 구조를 사용합니다.

---

## 기준 통화: 한국돈(KRW)

- **기준 통화는 KRW(원화)**입니다. DB·API에 저장·전달되는 모든 가격은 **원화(KRW)**입니다.
- 화면에서는 **기본 표시를 KRW**로 하고, 사용자가 USD를 선택하면 **원화를 환율로 나눠 USD로 변환**해 표시합니다.
- 즉, `USD 표시액 = KRW 금액 ÷ 환율(1 USD = ? KRW)` 입니다.

---

## 1. 전체 구조 요약

| 구성요소 | 역할 |
|----------|------|
| **GET /api/currency/rate** | 서버에서 환율 조회 (캐시 적용) |
| **CurrencyProvider** | 앱 전역 통화 설정 + 환율 상태 (기본 통화 KRW) |
| **useCurrency()** | 현재 통화, `formatPrice(krw)`, `convertToUSD` 등 |
| **Header 통화 버튼** | USD ↔ KRW 전환 (같은 Provider 사용) |

- DB/API는 **항상 KRW**로 저장·전달합니다.
- 프론트에서 “표시 통화”만 USD/KRW로 바꾸고, USD일 때만 `rate`로 나눠서 표시합니다.

---

## 2. 환율 API 선택

### 옵션 A: Open ER API (기본, API 키 불필요)

- **URL**: `https://open.er-api.com/v6/latest/USD`
- **특징**: 무료, 키 없음, **KRW 지원**, 일 1회 갱신
- **제한**: 시간당/일 제한 있음. 캐시 1시간 사용으로 영향 적음
- **Attribution**: [Rates By Exchange Rate API](https://www.exchangerate-api.com) (필요 시 푸터 등에 링크)

> ⚠️ **참고**: Frankfurter(`api.frankfurter.dev`)는 KRW를 지원하지 않아 "not found"가 나옵니다. 기본값은 Open ER API입니다.

현재 코드는 **API 키가 없으면** 이걸 사용합니다.

### 옵션 B: ExchangeRate-API (API 키 사용 시)

- **가입**: https://www.exchangerate-api.com/
- **Free tier**: 월 1500 요청, 일 1회 갱신
- **문서**: https://www.exchangerate-api.com/docs/free

**ExchangeRate-API 키 붙여넣기 (어디에 넣나요?)**

1. 프로젝트 **루트 폴더**(`atockorea` 폴더, `package.json` 있는 곳)에 `.env.local` 파일을 만듭니다. (이미 있으면 그 파일을 엽니다.)
2. 아래 한 줄을 추가하고, `발급받은_API_키`를 실제 키로 바꿉니다.

```bash
EXCHANGE_RATE_API_KEY=발급받은_API_키
```

3. **저장 후 개발 서버를 다시 실행**합니다 (`npm run dev` 중지 후 다시 실행). 환경 변수는 서버 시작 시에만 읽습니다.
4. 이렇게 하면 `/api/currency/rate`가 ExchangeRate-API를 사용합니다. (키가 없으면 Open ER API 사용)

**예시** (키가 `abc123xyz` 인 경우):

```bash
EXCHANGE_RATE_API_KEY=abc123xyz
```

> ⚠️ `.env.local`은 Git에 올리지 마세요. 이미 `.gitignore`에 포함되어 있을 수 있습니다.

### 옵션 C: 다른 API로 교체

`app/api/currency/rate/route.ts` 안에서:

- `EXCHANGE_RATE_API_KEY`가 있으면 → ExchangeRate-API
- 없으면 → Open ER API (open.er-api.com)

다른 API(예: Frankfurter)로 바꿀 때도, 동일한 **응답 형식**만 맞추면 됩니다:

```ts
// 응답 형식 (JSON)
{
  "rate": 1350.5,        // 1 USD = 1350.5 KRW
  "base": "USD",
  "target": "KRW",
  "updatedAt": "2025-03-04T12:00:00.000Z",
  "source": "open-er-api" | "exchangerate-api" | "cache" | "fallback"
}
```

다른 API(예: Open Exchange Rates, Fixer 등)를 쓰려면 이 형식으로 `rate`, `updatedAt` 등을 채우도록 `route.ts`만 수정하면 됩니다.

---

## 3. API 라우트 동작 방식

**파일**: `app/api/currency/rate/route.ts`

1. **캐시**: 서버 메모리에 최대 1시간(3600초) 캐시. 같은 시간대에 여러 번 호출해도 외부 API는 한 번만 호출.
2. **Fallback**: 외부 API 실패 시 `rate: 1350` 고정값 반환 (UI 깨짐 방지).
3. **환율 소스**:
   - `EXCHANGE_RATE_API_KEY` 있음 → ExchangeRate-API
   - 없음 → Open ER API

**클라이언트 호출 예**:

```ts
const res = await fetch('/api/currency/rate');
const { rate, updatedAt } = await res.json();
// rate: 1 USD = rate KRW
```

---

## 4. 통화 컨텍스트 (CurrencyProvider)

**파일**: `lib/currency.tsx`

- **CurrencyProvider**: 루트 레이아웃(`app/layout.tsx`)에서 `I18nProvider` 안에 감싸져 있음.
- **저장**: 선택한 통화(USD/KRW)는 `localStorage` 키 `atoc_currency`에 저장되어 새로고침 후에도 유지됩니다.

**제공 값**:

| 이름 | 타입 | 설명 |
|------|------|------|
| `currency` | `'USD' \| 'KRW'` | 현재 표시 통화 |
| `setCurrency` | `(c) => void` | 통화 변경 (USD ↔ KRW) |
| `rate` | `number \| null` | 1 USD = rate KRW (null이면 아직 로드 전) |
| `rateUpdatedAt` | `string \| null` | 환율 기준 시각 (ISO) |
| `isLoading` | `boolean` | 환율 로딩 중 여부 |
| `error` | `string \| null` | 환율 조회 실패 시 메시지 |
| `formatPrice(priceKRW)` | `(n) => string` | KRW 금액을 현재 통화로 포맷 (₩80,000 또는 $59.26) |
| `convertToUSD(priceKRW)` | `(n) => number` | KRW → USD 숫자 |
| `convertToKRW(priceUSD)` | `(n) => number` | USD → KRW 숫자 |
| `refetchRate()` | `() => Promise<void>` | 환율 다시 가져오기 |

**사용 예**:

```tsx
import { useCurrency } from '@/lib/currency';

function PriceLabel({ priceKRW }: { priceKRW: number }) {
  const { formatPrice, currency } = useCurrency();
  return <span>{formatPrice(priceKRW)}</span>;
}
```

Provider 밖에서 쓰는 컴포넌트는 `useCurrencyOptional()`을 쓰고, 없으면 KRW만 보이도록 fallback 하면 됩니다.

---

## 5. Header 통화 스위치

**파일**: `components/Header.tsx`

- `useCurrency()`로 `currency`, `setCurrency` 사용.
- 버튼 클릭 시 `setCurrency(currency === 'USD' ? 'KRW' : 'USD')` 호출.
- 선택한 통화는 `CurrencyProvider`를 통해 전역에 반영되고, `formatPrice`를 쓰는 모든 가격이 USD/KRW로 같이 바뀝니다.

---

## 6. 가격 표시하는 곳에 적용하기

- **항상 Provider 안** (페이지/레이아웃 하위): `useCurrency().formatPrice(priceKRW)` 사용.
- **Provider 없을 수 있음** (공용 컴포넌트/테스트): `useCurrencyOptional()`로 받아서, 있으면 `formatPrice`, 없으면 기존처럼 KRW만 포맷.

**적용된 위치 예**:

- `components/tour/EnhancedBookingSidebar.tsx`: 예약 사이드바 가격
- `app/tour/[id]/page.tsx`: 투어 상세 하단 스티키 가격바

다른 카드/리스트도 “가격이 KRW 숫자”로 오면 같은 방식으로 `formatPrice(priceKRW)`만 넣으면 됩니다.

---

## 7. 환경 변수 정리

| 변수 | 필수 | 설명 |
|------|------|------|
| `EXCHANGE_RATE_API_KEY` | 아니오 | 있으면 ExchangeRate-API 사용, 없으면 Open ER API 사용 |

---

## 8. 실시간성과 제한

- **Open ER API / ExchangeRate-API Free**: 일 약 1회 갱신. “실시간”이라기보다 “당일 기준 환율”에 가깝습니다.
- **ExchangeRate-API Free**: 역시 제한적 갱신 + 월 1500 요청.
- **더 자주 갱신**이 필요하면 유료 API(예: Open Exchange Rates, Fixer 유료)로 `route.ts`만 교체하면 됩니다.
- 서버 캐시(1시간) 때문에 같은 시간대에는 같은 rate가 반복 사용됩니다.

---

## 9. 트러블슈팅

- **환율이 안 바뀜**: 브라우저/서버 캐시 만료(1시간) 후 다시 호출되면 갱신됩니다. 즉시 반영이 필요하면 `refetchRate()` 호출하거나, `route.ts`의 `CACHE_MS`를 줄여보세요.
- **CORS**: `/api/currency/rate`는 같은 도메인에서만 호출하면 되므로 CORS 설정은 보통 필요 없습니다.
- **환율 1350 고정처럼 보임**: 외부 API 오류 시 fallback으로 1350을 쓰기 때문입니다. 콘솔/서버 로그에 `[currency/rate]` 로그가 있는지 확인하고, API 키·URL을 점검하세요.

이 구성을 따르면 USD/KRW 전환과 “실시간(또는 당일) 환율 반영”을 한 곳에서 관리할 수 있습니다.
