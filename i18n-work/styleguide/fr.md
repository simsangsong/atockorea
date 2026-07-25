# 프랑스어 스타일가이드 (fr)

> 현행 `messages/fr.json` 2,734키의 톤을 규범화한 것이다.

## 호칭 — **vous** (격식)

전 표면 통일. `tu` 금지. 명령형은 `vous`-형.
- ✅ `Merci d'apporter votre passeport.`
- ❌ `Apporte ton passeport.`

## 서식

| 항목 | 형식 | 예 |
|---|---|---|
| 숫자 | `1 234,56` (좁은 비분리 공백 U+202F, 콤마=소수) | `70 000 ₩` |
| 날짜 | `JJ/MM/AAAA` | `17/08/2026` |
| 시각 | 24시간, `h` 구분 | `9 h 30` |
| 기간 | `min` / `h` | `env. 40 min` |
| 통화 | 기호 유지, 값 불변 | `₩70 000` — €로 환산 금지 |

## 🔴 좁은 비분리 공백 (U+202F)

`:` `?` `!` `;` `»` **앞**, `«` **뒤**에 넣는다. 일반 공백이나 무공백이 아니다.
- ✅ `Où est le point de rendez-vous ?`
- ✅ `« Une journée complète »`
- ❌ `Où est le point de rendez-vous?`

천단위 구분에도 같은 문자를 쓴다 — 일반 공백은 줄바꿈이 끼어들어 `70` / `000` 으로 쪼개진다.

## 고유명사

한국 지명은 **개정로마자 표기 그대로 유지**한다. 프랑스어 수식어를 붙이지 않는다.
- ✅ `Seongsan Ilchulbong`
- ❌ `Pic du Lever de Soleil de Seongsan`

## 대문자

제목도 **문장식 대문자**(첫 글자만). 영어식 Title Case 금지.
- ✅ `Circuit d'une journée sur la côte est`
- ❌ `Circuit d'une Journée sur la Côte Est`

## 금지 표현

| 금지 | 이유 |
|---|---|
| `bon marché` / `pas cher` | 저가 이미지 — `abordable` 사용 |
| `handicapés` (명사) | `personnes en situation de handicap` |
| `traduit par IA` 류 메타언급 | G11 fail |
