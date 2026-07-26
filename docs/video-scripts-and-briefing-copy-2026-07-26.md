# 영상 자막 + 모닝 브리핑 스크립트 전집 (2026-07-26)

> 이 문서의 모든 텍스트는 **앱에 이미 배선된 실제 확정본**의 스냅샷이다.
> 원본(SoT)은 코드다 — 여기서 고치지 말고 아래 원본 파일을 고친 뒤 이 문서를 재생성할 것.
>
> | 섹션 | 원본 (SoT) |
> |---|---|
> | ① 안전 영상 자막 | `lib/video-automation/safetyScript.ts` (10로케일) |
> | ② 앱 소개 v4 카피 | `assets/howto/onboarding-en.html` |
> | ③-A 오프닝 채팅 | `lib/tour-room/morningBriefing.ts` (5로케일) |
> | ③-B 브리핑 카드 5장 | `lib/ops/seating/cards/*.ts` (start·safety·schedule·lunch·etiquette) |

관련 영상 산출물:

- 안전 30초: `tour-videos/safety/safety-intro-30s-v1.mp4` — `poi_videos` kind='safety' **pending_review** (승인 시 브리핑 카드 ②에서 재생)
- 앱 소개 v4: `tour-videos/howto/onboarding-en-v4.mp4`
- 렌더 소스: `assets/howto/*.html` + `scripts/render-howto-video.mjs`

---

## ① 안전(주의사항) 영상 — 영어 자막 (30.000초)

챕터 타이밍은 렌더와 프레임 단위로 일치한다 (`SAFETY_SCRIPT_CUES`).

```
[00:00–00:03]  Welcome — 3 quick rules for a smooth ride

[00:03–00:10]  Seatbelts on — all seats, front and back
               (Korean law)

[00:10–00:18]  No smoking — in the car and at all tourist sites
               (Fine up to ₩100,000)

[00:18–00:26]  Please don't talk to the driver while moving — use the app chat
               (Korean traffic law)

[00:26–00:29]  Tap the seatbelt to continue

[00:29–00:30]  Enjoy your day 🌿
```

- 동일 내용이 **en · ko · zh-TW · zh-CN · ja · es · de · fr · it · ru** 10개 언어 VTT로 서빙 중 (`public/videos/safety-intro-30s/subtitles/`)
- 손님의 채팅 언어(언어 무제한 브릿지가 기억한 `chat_locale`)로 기본 트랙 자동 선택
- 영상 자체는 무음·무텍스트(픽토그램+숫자 1·2·3만)라 언어 추가 = VTT 1개

## ② 앱 소개 영상 v4 — 화면 카피 (영어)

```
S1  ATOC SMART GUIDE
    One link. Your whole day.
    Opens right in your browser — nothing to install

S2  GETTING STARTED
    Scan once — you're in
    Your driver shows you the QR at pickup

S3  LIVE TRANSLATION
    Speak your language — so does your driver
    Every message is translated instantly, both ways

S4  AT EVERY STOP
    Every place tells you its story
    Stories, tips and photo spots appear as you arrive — ask anything, anytime

S5  FREE TIME
    Wander freely, return on time
    One shared countdown — nobody gets left behind

S6  ALWAYS WITH YOU
    Real people behind the screen
    Late, lost, or need help? One tap reaches our team — 24/7
```

## ③ 모닝(투어 시작) 브리핑 — 앱이 발사하는 전체 스크립트

투어 시작 시 운영자/기사 **원탭**으로 채팅 메시지 1건 + 카드 5장이 순서대로 나간다.

### ③-A 오프닝 채팅 메시지 (투어 유형별 2종, 5로케일 사전 번역·LLM 0)

**조인(버스/스몰그룹)형:**

```
Good morning, and welcome aboard! 🚌
This chat translates automatically — write in your own language and the staff will understand.
Today's route is in the Schedule tab. At each stop we'll send the meeting time,
restroom map, and a mini guide right here.
Lunch details will be announced before the lunch stop.
Meeting times always appear at the top with a countdown — please keep
notifications on and be back a little early. 🙏
```

**프라이빗(차터)형:**

```
Good morning! I'm your driver today. This chat translates automatically —
feel free to write in your language. 🚐
Today's charter includes 9 hours of service.
Beyond that, overtime is ₩30,000 per hour, payable in cash on the day.
The route runs one direction only — back-and-forth detours aren't possible,
so we'll confirm the stop order before departing.
Questions anytime — send text, a photo, or a voice message here and it
reaches me in Korean instantly.
```

- `{hours}` = 제주 9h / 부산 8h, `{rate}` = ₩30,000 — **`lib/tour-room/overtime.ts` 상수에서 자동 삽입**되어 정산 산식과 절대 어긋나지 않는다.

### ③-B 브리핑 카드 5장 (start → safety → schedule → lunch → etiquette)

| # | 카드 | 내용 |
|---|---|---|
| 1 | **Start** | 인사 캡슐 |
| 2 | **Safety** | 3규칙 텍스트 + **30초 안전 영상 재생** (poi_videos 승인 후) |
| 3 | **Schedule — "Today's plan 🗓"** | **당일 실데이터 자동 조립**: 스톱별 시각+장소명, 6개 초과분은 "…and {n} more in the Schedule tab", 하단 각주 "Times shift with traffic — the app always shows the live version in the Schedule tab." 일정 없으면 카드 자체를 생략(빈 카드 발송 없음) |
| 4 | **Lunch** | 점심 안내 |
| 5 | **Etiquette** | 아래 5줄 |

**Etiquette 카드 전문 (영어):**

```
A few local manners — they make the day smoother for everyone. 🏞

Korean tourist sites are entirely non-smoking, including outdoor areas —
fines reach ₩100,000.

At temples and royal tombs, keep your voice low, stay on the marked paths,
and ask before photographing people.

Public bins are rare in Korea — please carry your rubbish back to the vehicle.

Please be back at the meeting point before the countdown at the top of your
screen runs out — the whole group waits for the last person.

Please do not talk to the driver while the vehicle is moving (Korean traffic law).
Use the one-tap phrases in the message box instead — "restroom", "too cold",
"carsick" and more are already translated.
```

---

## 설계 메모

- **일정 스케줄을 영상에 굽지 않는 이유**: 일정은 투어마다 매일 달라진다. 고정 자산(안전 영상)과 동적 카드(당일 일정)를 분리한 현 구조가 맞고, 이미 그렇게 구현돼 있다.
- 문구 수정 시: 원본 파일에서 고치면 5(또는 10)로케일 세트를 함께 갱신할 것 — 영어만 고치고 타 로케일을 방치하면 드리프트가 생긴다.
