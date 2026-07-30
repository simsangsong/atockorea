/**
 * 본편 ② «What this app does for you» — 프라이빗(차량 전세). (v4)
 *
 * 씬 1~9는 조인편에서 **가져온다**(복사하지 않는다). 같은 앱, 같은 설명서 —
 * 두 편이 다른 말을 하면 그 자체가 결함이고, 복사본은 언젠가 갈라진다.
 * 갈리는 지점은 10부터:
 *
 *   조인    경로가 정해져 있다 · 동승 스태프
 *   프라이빗 손님이 정한다 · 만남 시각도 · 현장 연장
 *
 * 판별자는 `tours.price_type === 'vehicle'`(lib/tour-room/tourKind.ts).
 *
 * ⚠ 프라이빗 전용 화면(플래너·미팅 지정·연장)은 이 픽스처에 없다 — 시뮬 예약이
 * 조인투어다. 10~12는 그 화면을 **찍지 못한 채로 말하지 않는다**: 공용 화면 위에
 * 사실만 얹고, 전용 샷은 프라이빗 픽스처가 생기면 세 장만 갈아끼운다.
 */

import join from './app-guide-join.mjs';

/** 씬 1~9 공유. `.slice` 이므로 조인편을 고치면 여기도 따라온다. */
const shared = join.scenes.slice(0, 9).map((s) => ({ ...s }));
shared[0] = {
  ...shared[0],
  chrome: { tr: 'GUIDE 01 · PRIVATE TOUR', bl: 'PLAN → MEET → ARRIVAL → EXTEND' },
};

export default {
  id: 'app-guide-private',
  theme: 'ink',
  shots: 'scripts/scene-video/.shots/shots.json',
  clips: 'scripts/scene-video/.clips/clips.json',

  scenes: [
    ...shared,
    {
      id: 's10-private',
      scene: 'step-list',
      dur: 9.4,
      shot: 'schedule-cards',
      eyebrow: 'YOUR TOUR',
      headline: 'You choose where to go',
      gloss: {
        ko: '어디를 갈지 손님이 정합니다',
        ja: 'どこへ行くかはお客様が決めます',
        zh: '去哪里由您决定',
        'zh-TW': '去哪裡由您決定',
        es: 'Tú eliges adónde ir',
        fr: 'Vous choisissez où aller',
        de: 'Sie wählen, wohin es geht',
        ru: 'Вы выбираете, куда поехать',
        it: 'Scegli tu dove andare',
      },
      steps: [
        ['Open the planner in your email', {
          ko: '초대 메일에서 플래너를 엽니다', ja: '招待メールからプランナーを開きます',
          zh: '在邀请邮件中打开行程规划', 'zh-TW': '在邀請郵件中打開行程規劃',
          es: 'Abre el planificador en tu correo',
          fr: 'Ouvrez le planificateur dans votre e-mail',
          de: 'Öffnen Sie den Planer in Ihrer E-Mail',
          ru: 'Откройте планировщик в письме',
          it: 'Apri il pianificatore nella tua email',
        }],
        ['Choose places, or let us choose', {
          ko: '장소를 고르거나, 저희에게 맡기세요', ja: '場所を選ぶか、お任せください',
          zh: '自己选择景点，或交给我们', 'zh-TW': '自己選擇景點，或交給我們',
          es: 'Elige lugares o déjanos elegir',
          fr: 'Choisissez des lieux ou laissez-nous faire',
          de: 'Orte wählen oder uns wählen lassen',
          ru: 'Выберите места или доверьте нам',
          it: 'Scegli i luoghi o lascia scegliere noi',
        }],
        ['Your plan appears in Today', {
          ko: '정해진 일정이 「오늘 일정」에 나타나요', ja: '決まった予定は「本日」に表示されます',
          zh: '确定的行程会出现在「今日」', 'zh-TW': '確定的行程會出現在「今日」',
          es: 'Tu plan aparece en Hoy',
          fr: 'Votre programme apparaît dans Aujourd’hui',
          de: 'Ihr Plan erscheint unter „Heute“',
          ru: 'Ваш план появится во вкладке «Сегодня»',
          it: 'Il tuo piano compare in Oggi',
        }],
      ],
      chrome: { tr: 'PAGE 10 · YOUR DAY', bl: 'THE NIGHT BEFORE' },
    },
    {
      id: 's11-meet',
      scene: 'screen-focus',
      dur: 7.2,
      shot: 'now-card',
      eyebrow: 'MEETING',
      headline: 'You pick the time\nand the place',
      gloss: {
        ko: '만나는 시각과 장소도 손님이 정합니다',
        ja: '待ち合わせの時間と場所もお客様が決めます',
        zh: '见面的时间和地点也由您决定',
        'zh-TW': '見面的時間和地點也由您決定',
        es: 'Tú eliges la hora y el lugar',
        fr: 'Vous choisissez l’heure et le lieu',
        de: 'Sie wählen Zeit und Ort',
        ru: 'Вы выбираете время и место',
        it: 'Scegli tu l’ora e il luogo',
      },
      chrome: { tr: 'PAGE 11 · MEETING', bl: 'FROM THE NIGHT BEFORE' },
    },
    {
      id: 's12-extend',
      scene: 'screen-focus',
      dur: 7.2,
      shot: 'home',
      eyebrow: 'MORE TIME',
      headline: 'You can add hours\non the day',
      gloss: {
        ko: '당일 현장에서 시간을 더할 수 있어요 (현금)',
        ja: '当日その場で時間を追加できます（現金）',
        zh: '当天可现场加时（现金支付）',
        'zh-TW': '當天可現場加時（現金支付）',
        es: 'Puedes añadir horas el mismo día, en efectivo',
        fr: 'Vous pouvez ajouter des heures le jour même, en espèces',
        de: 'Sie können am Tag selbst Stunden ergänzen, in bar',
        ru: 'В день тура можно добавить часы, наличными',
        it: 'Puoi aggiungere ore in giornata, in contanti',
      },
      chrome: { tr: 'PAGE 12 · EXTEND', bl: 'PAID IN CASH ON THE DAY' },
    },
    {
      id: 's13-outro',
      scene: 'outro',
      dur: 5.0,
      headline: join.scenes[join.scenes.length - 1].headline,
      gloss: join.scenes[join.scenes.length - 1].gloss,
      chrome: { tr: 'END', bl: 'ATOC KOREA · TOUR APP' },
    },
  ],
};
