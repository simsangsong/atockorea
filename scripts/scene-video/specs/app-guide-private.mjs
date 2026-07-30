/**
 * 본편 ② «Your tour, in one app» — 프라이빗(차량 전세). (v5)
 *
 * 공통 씬 1~8(타이틀·지도·채팅·가이드·스위치·도착·시그널·SOS)은 조인편에서
 * **가져온다** — 같은 앱, 같은 설명서. 복사본은 언젠가 갈라진다.
 * 조인의 s9("경로 고정")만 빼고, 프라이빗 고유 3씬을 얹는다:
 *
 *   플래너(절차)   → flow-3
 *   미팅 지정      → device-note
 *   현장 연장      → device-note
 *
 * ⚠ 프라이빗 전용 실화면은 픽스처에 없다(시뮬 예약이 조인). v5 에서는 이 세
 * 씬이 어차피 **그린 도형**이므로 실화면 부재가 더는 절충이 아니다 — 정보는
 * 도형이 나르고, 실화면은 도착 카드·SOS 두 곳의 증거로만 남는다(§V5).
 */

import join from './app-guide-join.mjs';

const byId = Object.fromEntries(join.scenes.map((s) => [s.id, s]));

/** s1~s8 공유 — 조인편을 고치면 여기도 따라온다. */
const shared = ['s1-title', 's2-map', 's3-chat', 's4-guide', 's5-unlock', 's6-arrival', 's7-signals', 's8-sos']
  .map((id) => ({ ...byId[id] }));
shared[0] = {
  ...shared[0],
  chrome: { tr: 'GUIDE 01 · PRIVATE TOUR', bl: 'FIVE THINGS TO KNOW' },
};

export default {
  id: 'app-guide-private',
  theme: 'ink',
  shots: 'scripts/scene-video/.shots/shots.json',
  clips: 'scripts/scene-video/.clips/clips.json',

  scenes: [
    ...shared,
    {
      id: 's9-planner',
      scene: 'flow-3',
      dur: 9.6,
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
      nodes: [
        {
          icon: 'card', active: true, title: 'Open the planner',
          gloss: { ko: '초대 메일의 플래너 열기', ja: '招待メールのプランナーを開く', zh: '打开邀请邮件里的规划', 'zh-TW': '打開邀請郵件裡的規劃', es: 'Abre el planificador', fr: 'Ouvrez le planificateur', de: 'Den Planer öffnen', ru: 'Откройте планировщик', it: 'Apri il pianificatore' },
        },
        {
          icon: 'pin', title: 'Choose places',
          gloss: { ko: '장소를 고르거나 맡기기', ja: '場所を選ぶか任せる', zh: '选择景点或交给我们', 'zh-TW': '選擇景點或交給我們', es: 'Elige lugares', fr: 'Choisissez des lieux', de: 'Orte wählen', ru: 'Выберите места', it: 'Scegli i luoghi' },
        },
        {
          icon: 'route', title: 'It appears in “Today”',
          gloss: { ko: '「오늘 일정」에 그대로 반영', ja: '「本日」にそのまま反映', zh: '原样出现在「今日」', 'zh-TW': '原樣出現在「今日」', es: 'Aparece en «Hoy»', fr: 'Il apparaît dans « Aujourd’hui »', de: 'Erscheint unter „Heute“', ru: 'Появится во вкладке «Сегодня»', it: 'Compare in «Oggi»' },
        },
      ],
      chrome: { tr: 'PAGE 09 · PLANNER', bl: 'THE NIGHT BEFORE' },
    },
    {
      id: 's10-meet',
      scene: 'device-note',
      dur: 7.4,
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
      note: {
        icon: 'clock',
        accent: true,
        title: 'Meet at 9:00, hotel lobby',
        gloss: {
          ko: '예: 9시, 호텔 로비 — 전날부터 정할 수 있어요',
          ja: '例：9時、ホテルロビー — 前日から設定できます',
          zh: '例如：9点，酒店大堂 — 前一天即可设置',
          'zh-TW': '例如:9點,飯店大廳 — 前一天即可設定',
          es: 'Ej.: 9:00, recepción — desde la víspera',
          fr: 'Ex. : 9 h, hall de l’hôtel — dès la veille',
          de: 'Z. B. 9 Uhr, Hotellobby — ab dem Vortag',
          ru: 'Напр.: 9:00, лобби отеля — можно накануне',
          it: 'Es.: 9:00, hall dell’hotel — dalla sera prima',
        },
      },
      chrome: { tr: 'PAGE 10 · MEETING', bl: 'FROM THE NIGHT BEFORE' },
    },
    {
      id: 's11-extend',
      scene: 'device-note',
      dur: 7.4,
      eyebrow: 'MORE TIME',
      headline: 'You can add hours\non the day',
      gloss: {
        ko: '당일 현장에서 시간을 더할 수 있어요',
        ja: '当日その場で時間を追加できます',
        zh: '当天可现场加时',
        'zh-TW': '當天可現場加時',
        es: 'Puedes añadir horas el mismo día',
        fr: 'Vous pouvez ajouter des heures le jour même',
        de: 'Sie können am Tag selbst Stunden ergänzen',
        ru: 'В день тура можно добавить часы',
        it: 'Puoi aggiungere ore in giornata',
      },
      note: {
        icon: 'clock',
        title: '+1 hour, paid in cash',
        gloss: {
          ko: '시간 단위, 현금으로 기사님께',
          ja: '1時間単位、現金でドライバーへ',
          zh: '按小时计，现金付给司机',
          'zh-TW': '按小時計，現金付給司機',
          es: 'Por horas, en efectivo al conductor',
          fr: 'À l’heure, en espèces au chauffeur',
          de: 'Stundenweise, bar an den Fahrer',
          ru: 'Почасово, наличными водителю',
          it: 'A ore, in contanti all’autista',
        },
      },
      chrome: { tr: 'PAGE 11 · EXTEND', bl: 'ASK YOUR DRIVER' },
    },
    {
      ...byId['s10-recap'],
      id: 's12-recap',
      chrome: { tr: 'PAGE 12 · RECAP', bl: 'THE WHOLE APP ON ONE CARD' },
    },
    {
      ...byId['s11-outro'],
      id: 's13-outro',
    },
  ],
};
