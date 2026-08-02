# 스페인어 스타일가이드 (es)

> 2026-08-02 신설. de/fr/it/ru 넷은 i18n 확장 트랙에서 만들어졌고 ja/es 는 그보다
> 먼저 있던 로케일이라 가이드가 없었다.

## 🔴 호칭 — **usted** (격식). 다만 현행 파일은 갈라져 있다.

다른 넷과 달리 **여기서는 기존 일관성을 옮겨 적을 수 없었다.** 실측(`messages/es.json`
2,261키):

| 형태 | 문자열 수 |
|---|---|
| `tú` 계열 (tu · tienes · elige · selecciona) | **165** |
| `usted` 계열 (su · puede · elija · seleccione) | **150** |

거의 반반이다. 즉 이 파일에는 규범이 없고 **드리프트가 있다.** 지어낼 문제가 아니라
정할 문제이므로, 이 트랙은 **usted 로 통일**한다. 근거는 셋이다.

1. 나머지 격식 로케일이 전부 격식이다 — 독일어 `Sie`, 프랑스어 `vous`, 이탈리아어 `Lei`.
   같은 화면에서 스페인어만 반말이면 그건 로케일 차이가 아니라 사고로 읽힌다.
2. 손님과 여행사의 관계는 초면이고 유상이다.
3. 라틴아메리카 대부분과 스페인 양쪽에서 `usted` 는 안전하고, `tú` 는 지역마다 온도가 다르다.

⚠ **`messages/es.json` 의 드리프트는 이 트랙의 범위가 아니다.** 2,261키 전수 재작업이고
별도 티켓이다. 여기서 하는 일은 새 콘텐츠가 그 드리프트를 더 키우지 않는 것뿐이다.

- ✅ `Pregunte a su conductor si hoy es posible parar.`
- ❌ `Pregúntale a tu conductor…`

## 서식

| 항목 | 형식 | 예 |
|---|---|---|
| 숫자 | `1.234,56` (점=천단위, 콤마=소수) | `70.000 ₩` |
| 날짜 | `DD/MM/AAAA` | `17/08/2026` |
| 시각 | 24시간 | `9:30 h` |
| 기간 | `min` / `h` | `unos 40 min` |
| 통화 | 기호 유지, 값 불변 | `₩70.000` — €로 환산 금지 |

## 의문·감탄 부호

여는 부호 `¿` `¡` 를 **반드시** 쓴다. 빠지면 즉시 기계번역으로 읽힌다.
- ✅ `¿Dónde está el punto de encuentro?`
- ❌ `Dónde está el punto de encuentro?`

## 고유명사

한국 지명은 **개정로마자 표기 그대로 유지**한다. 스페인어 수식어를 붙이지 않는다.
- ✅ `Seongsan Ilchulbong`
- ❌ `Pico del Amanecer de Seongsan`

## 대문자

제목도 **문장식 대문자**(첫 글자만). 영어식 Title Case 금지.
- ✅ `Un día completo por la costa este`
- ❌ `Un Día Completo por la Costa Este`

## 금지 표현

| 금지 | 이유 |
|---|---|
| `barato` | 저가 이미지 — `asequible` 사용 |
| `minusválidos` | `personas con discapacidad` |
| `traducido por IA` 류 메타언급 | G11 fail |
