# 손님용 종이 백업 카드 (A6/명함 2배 사이즈 — 코팅 인쇄용)

> 목적: 앱이 유일한 안내 채널인 투어에서, 폰 분실·배터리·네트워크 실패 시의 마지막 보험.
> 픽업 시 기사(운전기사)가 1인 1장 배포. 앞면 = 온보딩, 뒷면 = 비상 정보.

---

## 앞면 (FRONT)

```
┌─────────────────────────────────────────┐
│  AtoC Korea — Your Smart Guide          │
│                                         │
│   [ QR CODE ]   ← Scan to open          │
│                 your Tour Room          │
│                                         │
│  💬 Chat with your driver in            │
│     YOUR language — just type.          │
│  📍 Spot guides arrive automatically.   │
│  ⏰ Return-time countdown keeps         │
│     everyone together.                  │
│                                         │
│  No app install needed — opens          │
│  in your browser.                       │
└─────────────────────────────────────────┘
```

- QR = 예약별 투어룸 손님 링크 (발권 시 운영센터가 인쇄 or 기사 폰 화면 제시로 대체 가능)
- 공용 QR이 필요하면: atockorea.com/tour-mode 랜딩(로그인 없이 예약번호 입력) — 추후 구현 옵션

## 뒷면 (BACK)

```
┌─────────────────────────────────────────┐
│  IF ANYTHING GOES WRONG                 │
│                                         │
│  🚗 Driver: can't speak English,        │
│     but the app translates live.        │
│                                         │
│  ☎ AtoC Operations (24h, English/中文): │
│     +82-__-____-____                    │
│                                         │
│  🚨 Emergency (fire/medical): 119       │
│  👮 Tourist Police (English): 1330      │
│                                         │
│  🕐 Meeting rule: be back at the van    │
│     by the countdown time shown         │
│     in your Tour Room.                  │
│                                         │
│  Booking ref: ______________            │
└─────────────────────────────────────────┘
```

---

### 운영 메모 (인쇄 전)

1. `+82-__-____-____` 자리에 `NEXT_PUBLIC_TOUR_OPS_PHONE`과 **같은 번호**를 넣을 것 (앱과 종이가 다른 번호면 혼란)
2. Booking ref는 손글씨 기입 (기사 출차 전 콕핏에서 확인 가능)
3. 코팅 권장 — 비 오는 날 + 재사용
4. 중국어권 손님 대비 뒷면 하단에 한 줄 추가 옵션: `司机不会英文，请用APP聊天，任何语言都能实时翻译。`
