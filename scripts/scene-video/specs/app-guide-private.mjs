/**
 * 본편 ② «이 앱으로 할 수 있는 것» — 프라이빗(차량 전세) 변형.
 *
 * 씬 1~8은 조인편과 같은 문장이다. 같은 앱이고 같은 설명서이며, 두 편에서
 * 다른 말을 하면 그 자체가 결함이다. 갈리는 지점은 9부터:
 *
 *   조인    경로가 정해져 있다 · 동승 스태프 · 좌석은 현장
 *   프라이빗 일정을 손님이 정한다 · 기사님은 운전에 집중 · 시간 연장 가능
 *
 * 판별자는 `tours.price_type === 'vehicle'`(lib/tour-room/tourKind.ts). 앱이
 * `manualKind` 로 이미 갈라 놓았으므로 영상도 같은 값으로 고르면 된다.
 *
 * ⚠ 프라이빗 화면(플래너·미팅 지정·연장)은 이 픽스처에 없다 — 시뮬 예약이
 * 조인투어다. 그래서 9~11은 그 화면을 **찍지 못한 채로 말하지 않는다**:
 * 공용 화면으로 사실만 전하고, 전용 스크린샷은 프라이빗 픽스처가 생기면
 * 붙인다. 없는 화면을 그림으로 대체하는 건 §H가 금지하는 그것이다.
 */

const shared = (id, extra) => ({ id, ...extra });

export default {
  id: 'app-guide-private',
  theme: 'light',
  shots: 'scripts/scene-video/.shots/shots.json',

  scenes: [
    shared('s1-title', {
      scene: 'title-card',
      dur: 3.4,
      ghost: '01',
      eyebrow: 'ATOC KOREA · TOUR APP',
      headline: '이 앱으로\n할 수 있는 것',
      sub: '투어 당일, 손에 있는 것 전부',
      progress: 0.08,
      caption: 'What this app does for you',
      chrome: { tr: 'GUIDE 01 · PRIVATE TOUR', bl: 'PLAN → MEET → ARRIVAL → SIGNAL' },
    }),
    shared('s2-chat', {
      scene: 'screen-focus',
      dur: 6.6,
      shot: 'chat-bubbles',
      eyebrow: 'YOUR LANGUAGE',
      headline: '내 언어로 그냥 쓰세요',
      caption: 'Write in your language. The reply comes back in yours.',
      chrome: { tr: 'PAGE 02 · TRANSLATION', bl: 'CHAT · 32 LANGUAGES' },
    }),
    shared('s3-guide', {
      scene: 'screen-focus',
      dur: 5.4,
      shot: 'home',
      eyebrow: 'SMART GUIDE',
      headline: '궁금한 건 화면 위 ✨',
      caption: 'Tap the sparkle at the top and ask.',
      chrome: { tr: 'PAGE 03 · SMART GUIDE', bl: 'ALWAYS IN THE HEADER' },
    }),
    shared('s4-unlock', {
      scene: 'step-list',
      dur: 8.0,
      shot: 'arrival-unlock',
      eyebrow: 'ONE SWITCH',
      headline: '도착 해설은\n한 번만 켜면 됩니다',
      steps: [
        '홈 화면의 「도착 해설 켜기」',
        '[켜기] 를 누릅니다',
        '나머지는 앱이 알아서 합니다',
      ],
      caption: 'Turn it on once. That is the whole setup.',
      chrome: { tr: 'PAGE 04 · ARRIVAL', bl: '🔴 THE ONE STEP GUESTS MISS' },
    }),
    shared('s5-arrival', {
      scene: 'card-grid',
      dur: 7.2,
      eyebrow: 'AT EVERY STOP',
      headline: '도착하면 저절로',
      cards: [
        { shot: 'arrival-card', title: '스팟마다 해설', sub: '볼거리와 머무는 시간', active: true },
        { shot: 'arrival-unlock', title: '한 번만 켜두면', sub: '나머지는 앱이 합니다' },
      ],
      caption: 'Every stop introduces itself, in your language.',
      chrome: { tr: 'PAGE 05 · WHAT ARRIVES', bl: 'NOTHING TO ASK FOR' },
    }),
    shared('s6-meeting', {
      scene: 'screen-focus',
      dur: 6.4,
      shot: 'now-card',
      eyebrow: 'MEETING POINT',
      headline: '다시 모이는 곳은\n지도와 카운트다운으로',
      caption: 'A pin and a countdown, with a nudge before time.',
      chrome: { tr: 'PAGE 06 · REGROUP', bl: 'PIN + COUNTDOWN' },
    }),
    shared('s7-signals', {
      scene: 'card-grid',
      dur: 7.0,
      eyebrow: 'ONE TAP · TOUR DAY',
      headline: '말 꺼내기 애매한 것도\n한 번의 탭으로',
      cards: [
        { shot: 'signal-bar', title: '늦어요 · 잠깐 정차', sub: '설명하지 않아도 됩니다', active: true },
        { shot: 'share-switch', title: '길을 잃었어요', sub: '내 위치가 한 번 전달됩니다' },
      ],
      caption: 'Late, need a stop, lost the group — one tap.',
      chrome: { tr: 'PAGE 07 · SIGNALS', bl: 'TOUR DAY ONLY' },
    }),
    shared('s8-sos', {
      scene: 'screen-focus',
      dur: 6.2,
      shot: 'emergency',
      eyebrow: 'EMERGENCY',
      headline: '긴급은 한 곳에',
      caption: 'Your location goes with it, either way.',
      chrome: { tr: 'PAGE 08 · SOS', bl: 'HEADER · ALWAYS REACHABLE' },
    }),

    /* ── 여기부터 프라이빗 ─────────────────────────────────────────── */

    shared('s9-private', {
      scene: 'step-list',
      dur: 9.0,
      shot: 'schedule-cards',
      eyebrow: 'PRIVATE TOUR',
      headline: '일정은 손님이 정합니다',
      steps: [
        '전날, 초대 메일의 플래너에서',
        '코스를 고르거나 가이드에게 맡기거나',
        '정해지면 오늘 일정 탭에 그대로',
      ],
      caption: 'You choose the day — or leave it to your guide.',
      chrome: { tr: 'PAGE 09 · YOUR DAY', bl: 'PLANNER · THE NIGHT BEFORE' },
    }),
    shared('s10-meet', {
      scene: 'screen-focus',
      dur: 7.0,
      shot: 'now-card',
      eyebrow: 'YOU SET THE TIME',
      headline: '만나는 시간과 장소도\n직접 정할 수 있어요',
      caption: 'You set the meeting time and place.',
      chrome: { tr: 'PAGE 10 · MEETING', bl: 'FROM THE NIGHT BEFORE' },
    }),
    shared('s11-extend', {
      scene: 'screen-focus',
      dur: 7.0,
      shot: 'home',
      eyebrow: 'MORE TIME',
      headline: '더 있고 싶으면\n현장에서 연장',
      caption: 'Extra hours can be added on the day, in cash.',
      chrome: { tr: 'PAGE 11 · EXTEND', bl: 'DRIVER DRIVES · GUIDE IS IN THE APP' },
    }),
    shared('s12-outro', {
      scene: 'outro',
      dur: 4.6,
      headline: '설정 → 앱 사용 안내에서\n언제든 다시',
      sub: 'ATOC KOREA',
      caption: 'Settings → How this app works, any time.',
      chrome: { tr: 'END', bl: 'ATOC KOREA · TOUR APP' },
    }),
  ],
};
