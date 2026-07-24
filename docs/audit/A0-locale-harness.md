# A0-locale-harness — 로케일 레이아웃 하니스 (A0.4)

**감사일:** 2026-07-25 · **축:** 1 UI/UX · 6 콘텐츠
**실행:** `npm run locale:fit` (`-- --top=40`으로 더 보기) · 회귀: `__tests__/audit/localeFit.test.ts`
**판정:** ✅ **1커맨드로 전 로케일 검사** — 단, 스크린샷이 아니라 **문자열 수준**이다(아래 §1 참조).

---

## 0. 🔴 플랜 문구 정정 — "10 로케일 × 카드"는 성립하지 않는다

A0.4/A1.7은 "10 로케일 × 주요 카드"라고 적혀 있지만, 실제 로케일 집합은 **표면마다 다르다**:

| 집합 | 개수 | 구성 | 어디에 |
|---|---|---|---|
| `lib/locale.ts` `locales` | **10** | en ko zh zh-TW es ja fr de it ru | **마케팅 사이트**(`messages/*.json`) |
| `ROOM_LOCALES` | 5 | en ko zh ja es | **투어룸 카드·캡슐** |
| `DINING_LOCALES` | 10 | (zh-CN/zh-TW 구분) | 다이닝 RAG 번역 |
| `WA_LOCALES` | 6 | +zh-TW | wa.me 템플릿 |

즉 **투어룸 카드는 5로케일이지 10로케일이 아니다.** de·ru는 룸 카드에 존재하지 않는다.
A1.7이 노린 "독일어·러시아어 긴 단어 붕괴"는 **사이트 표면**의 문제이고, 이 하니스는
그쪽(10로케일 2,255키)을 본다. 룸 카드 5로케일은 별도 스위트가 이미 키 누락 0을 지킨다.

---

## 1. 무엇을 하는 하니스인가 (그리고 무엇이 아닌가)

A1.7의 표적은 "긴 단어 붕괴"다. 그 파괴 기전은 **끊을 수 없는 긴 토큰**이다 —
독일어 합성어(`Benachrichtigungseinstellungen`, 30자)는 공백이 없어 `word-break: normal`에서
줄바꿈이 안 되고 컨테이너를 그대로 민다. 원인이 문자열에 있으므로 **문자열만 보고도 좁힐 수 있다.**

🔴 **판정 기준은 문자 수가 아니라 최장 무공백 토큰이다.** CJK는 글자 단위로 끊기므로
같은 길이라도 안 터진다 — 문자 수로 재면 한국어·일본어가 위험 목록을 채우고 진짜 위험이 묻힌다.

🔴 **이건 스크린샷을 대신하지 않는다.** 픽셀 검증은 A1.7이 실기기에서 한다.
이 하니스가 하는 일은 **2,255 × 9 = 20,295개 문자열을 눈으로 볼 146개로 줄이는 것**이다.

---

## 2. 실측 결과

```
로케일 10개 · 문자열 각 2,255개
✅ 누락 키 없음 — 10 로케일 전부 en의 키를 갖고 있다
레이아웃 위험 후보 231건
  · 🔴 좁은 컨테이너(버튼·라벨·칩) 146건  ← 실제로 볼 것
  ·    넓은 산문(약관·정책 본문)  85건  ← 같은 토큰이어도 안 터진다
좁은 컨테이너 로케일별: fr 63 · it 29 · de 24 · ru 24 · es 6
```

### 🔴 좁은 컨테이너 vs 산문을 가른 이유

첫 실행은 후보 231건을 **정렬 없이** 뱉었고, 상위권이 전부 약관 본문이었다.
독일어 약관 문장에 30자 합성어가 있는 것은 사실이지만 **폭 넓은 문단이라 터지지 않는다.**
그 상태로는 리포트를 열어 봐도 할 일이 안 보인다 — 진짜 위험(설정 화면 **버튼 라벨**의
같은 30자)이 산문 아래 묻혀 있었다.

키 경로로 표면을 판정해(`terms`/`privacy`/... 네임스페이스 + `.p1`/`.li2`/`.desc` 꼬리표)
좁은 컨테이너를 먼저 올린다.

### 상위 위험 (실제로 볼 것)

| 로케일 | 토큰 | 키 | 문자열 |
|---|---|---|---|
| de | 30 | `settingsPage.alertNotificationsSaved` | Benachrichtigungseinstellungen gespeichert! |
| de | 30 | `settingsPage.saveNotifications` | Benachrichtigungseinstellungen speichern |
| de | 30 | `settingsPage.notificationPrefsTitle` | Benachrichtigungseinstellungen |
| de | 25 | `home.footer.refundPolicy` | Rückerstattungsrichtlinie |
| de | 20 (2.17x) | `home.customJoinTour.guideKorean` | Koreanischsprachiger Guide |
| de | 20 (1.94x) | `home.footer.terms` | Allgemeine Geschäftsbedingungen |

**독일어 `settingsPage.*` 3건이 단일 최대 위험이다** — 30자 합성어가 버튼/제목에 그대로 들어간다.

### 알려진 오탐

`auth.emailPlaceholder`(`ihre.email@beispiel.com`, 23자)는 3개 로케일에서 잡히지만
**입력 필드 placeholder라 넘쳐도 스크롤된다.** 특별 처리하지 않았다 — 예외를 늘리는 것보다
목록에 남겨 두고 사람이 3초에 넘기는 편이 낫다(A4.1에서 배운 것: 이유 없는 예외가 검사를 죽인다).

---

## 3. 부수 발견 — 10로케일 목록도 복제돼 있었다 (A4.1)

A4.1은 **룸 5로케일**의 복제를 잡았는데, 이 티켓에서 **사이트 10로케일**도 두 곳에
복제돼 있는 것이 드러났다:

- `lib/locale.ts` — 서버 안전, importer 2개
- `lib/i18n.ts` — `'use client'`, importer **55개**. 타입·목록·`defaultLocale`을 **그대로 다시 정의**

두 파일이 따로 존재하는 것 자체는 맞다(하나는 client 모듈이다). 그러나 **목록까지** 복제할
이유는 없다. `i18n.ts`가 `locale.ts`에서 import해 재export하도록 고쳤다 — 55개 importer는
아무것도 안 바꿔도 된다.

---

## 4. 확인했고 문제없음

1. **10 로케일 키 누락 0.** 2,255개 키가 10개 번들 전부에 있다 — 번역이 빠져 영어가
   그대로 노출되는 자리가 없다. 회귀 테스트로 고정했다.
2. **CJK 로케일(ko/zh/zh-TW/ja)은 위험 후보 0건.** 글자 단위 줄바꿈이 실제로 보호막이다.
3. **es는 6건뿐.** 라틴 계열 중 가장 안전하다.

## 5. 다음

- **A1.7**이 이 146건을 실기기 375px에서 픽셀 검증한다. 목록이 있으니 전수가 아니라 표적 검사다.
- 독일어 `settingsPage.*` 3건은 A1.7을 기다리지 말고 먼저 볼 만하다(단일 최대 위험).
