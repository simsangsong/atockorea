# 독일어 스타일가이드 (de)

> 현행 `messages/de.json` 2,734키의 톤을 규범화한 것이다. **새 규범을 만드는 게 아니라 기존 일관성을 유지**하는 것이 목적.

## 호칭 — **Sie** (격식)

전 표면 통일. `du` 금지. 명령형은 `Bitte + Infinitiv` 또는 `Sie`-형.
- ✅ `Bitte bringen Sie Ihren Pass mit.`
- ❌ `Bring deinen Pass mit.`

## 서식

| 항목 | 형식 | 예 |
|---|---|---|
| 숫자 | `1.234,56` (점=천단위, 콤마=소수) | `70.000 ₩` |
| 날짜 | `TT.MM.JJJJ` | `17.08.2026` |
| 시각 | 24시간 | `09:30 Uhr` |
| 기간 | `Std.` / `Min.` | `ca. 40 Min.` |
| 통화 | 기호 유지, 값 불변 | `₩70.000` — €로 환산 금지 |

## 복합명사 — 과다결합 주의

독일어는 명사를 무한히 붙일 수 있지만 **가독성이 먼저**다. 3어간 이상은 하이픈이나 전치사구로 푼다.
- ⚠ `Kreuzfahrtschiffhafenabholungsservice`
- ✅ `Abholung am Kreuzfahrthafen`

레이아웃 붕괴의 주 원인이므로 G8 길이비(0.9–1.5)를 넘으면 먼저 여기를 본다.

## 고유명사

한국 지명은 **개정로마자 표기 그대로 유지**한다. 독일어 수식어를 붙이지 않는다.
- ✅ `Seongsan Ilchulbong`
- ❌ `Sonnenaufgangsgipfel Seongsan`

설명이 필요하면 원문에 이미 있는 경우에만 병기한다(규칙 1 — 정보 추가 금지).

## 인용부호

`„…"` (독일식) 또는 `»…«`. 영어 `"…"` 를 그대로 두지 않는다.

## 금지 표현

| 금지 | 이유 |
|---|---|
| `billig` / `Billigtour` | 저가 이미지 — `preiswert`·`günstig` 사용 |
| `Ausländer` | 구식·배제적 — `internationale Gäste` |
| `Behinderte` (명사) | `Menschen mit Behinderung` |
| `KI-übersetzt` 류 메타언급 | G11 fail |
