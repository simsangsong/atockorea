/**
 * 본편 ① «이 앱으로 할 수 있는 것» — 조인투어 변형.
 *
 * 원고 규율(콘텐츠 스펙 §E): 새로 쓰지 않는다. `lib/tour-room/appManual.ts`
 * 가 10섹션 × 10로케일로 이미 사전 번역돼 있고 2026-07-27 사장님 브리프로
 * 다시 쓰인 것이다. 여기 문장은 그것을 **줄인 것**이며, 설명서와 다른 말을
 * 해서는 안 된다.
 *
 * 콘텐츠 스펙 초안과 다른 지점 — 2026-07-30에 앱을 고쳤기 때문이다:
 *   · 씬 4는 "지도 탭에서 토글을 찾으세요"가 아니라 **홈의 [켜기] 한 번**이다.
 *     문이 생겼으므로 영상이 문 없는 곳을 가리킬 이유가 없다.
 *   · 씬 9-J는 "앱이 막습니다"라고 말하지 않는다. 이제 서버도 막지만 그건
 *     손님이 알 바가 아니다 — **경로가 정해져 있다**는 제품 사실만 말한다.
 *   · 좌석은 넣지 않는다. 운영이 실제로 배차하는지가 사장님 결정 대기다.
 *
 * 🔴 문안 규율 둘, 첫 컷에서 배운 것:
 *   · 자막은 두 줄 예산이다(G-3이 이제 실제로 막는다). 영어 문장은 짧게.
 *   · `note`와 `caption`이 같은 말을 하면 하나를 지운다. 한 화면에 같은
 *     문장이 두 번 있으면 둘 다 안 읽힌다.
 */

export default {
  id: 'app-guide-join',
  theme: 'light',
  shots: 'scripts/scene-video/.shots/shots.json',

  scenes: [
    {
      id: 's1-title',
      scene: 'title-card',
      dur: 3.4,
      ghost: '01',
      eyebrow: 'ATOC KOREA · TOUR APP',
      headline: '이 앱으로\n할 수 있는 것',
      sub: '투어 당일, 손에 있는 것 전부',
      progress: 0.08,
      caption: 'What this app does for you',
      chrome: { tr: 'GUIDE 01 · JOIN TOUR', bl: 'ROOM → CHAT → ARRIVAL → SIGNAL' },
    },
    {
      id: 's2-chat',
      scene: 'screen-focus',
      dur: 6.6,
      shot: 'chat-bubbles',
      eyebrow: 'YOUR LANGUAGE',
      headline: '내 언어로 그냥 쓰세요',
      caption: 'Write in your language. The reply comes back in yours.',
      chrome: { tr: 'PAGE 02 · TRANSLATION', bl: 'CHAT · 32 LANGUAGES' },
    },
    {
      id: 's3-guide',
      scene: 'screen-focus',
      dur: 5.4,
      shot: 'home',
      eyebrow: 'SMART GUIDE',
      headline: '궁금한 건 화면 위 ✨',
      caption: 'Tap the sparkle at the top and ask.',
      chrome: { tr: 'PAGE 03 · SMART GUIDE', bl: 'ALWAYS IN THE HEADER' },
    },
    {
      id: 's4-unlock',
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
    },
    {
      id: 's5-arrival',
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
    },
    {
      id: 's6-meeting',
      scene: 'screen-focus',
      dur: 6.4,
      shot: 'now-card',
      eyebrow: 'MEETING POINT',
      headline: '다시 모이는 곳은\n지도와 카운트다운으로',
      caption: 'A pin and a countdown, with a nudge before time.',
      chrome: { tr: 'PAGE 06 · REGROUP', bl: 'PIN + COUNTDOWN' },
    },
    {
      id: 's7-signals',
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
    },
    {
      id: 's8-sos',
      scene: 'screen-focus',
      dur: 6.2,
      shot: 'emergency',
      eyebrow: 'EMERGENCY',
      headline: '긴급은 한 곳에',
      caption: 'Your location goes with it, either way.',
      chrome: { tr: 'PAGE 08 · SOS', bl: 'HEADER · ALWAYS REACHABLE' },
    },
    {
      id: 's9-join',
      scene: 'screen-focus',
      dur: 7.4,
      shot: 'schedule-cards',
      eyebrow: 'JOIN TOUR',
      headline: '경로는 정해져 있어요',
      caption: 'The route is set. Check it any time in Today.',
      chrome: { tr: 'PAGE 09 · JOIN TOUR', bl: 'STAFF ON BOARD · GUIDE IN THE APP' },
    },
    {
      id: 's10-outro',
      scene: 'outro',
      dur: 4.6,
      headline: '설정 → 앱 사용 안내에서\n언제든 다시',
      sub: 'ATOC KOREA',
      caption: 'Settings → How this app works, any time.',
      chrome: { tr: 'END', bl: 'ATOC KOREA · TOUR APP' },
    },
  ],
};
