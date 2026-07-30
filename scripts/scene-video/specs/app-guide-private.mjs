/**
 * 본편 ② «What this app does for you» — 프라이빗(차량 전세) 변형. (v3)
 *
 * 씬 1~9는 조인편과 **같은 문장**이다. 같은 앱이고 같은 설명서이며, 두 편이
 * 다른 말을 하면 그 자체가 결함이다. 갈리는 지점은 10부터:
 *
 *   조인    경로가 정해져 있다 · 동승 스태프
 *   프라이빗 일정을 손님이 정한다 · 미팅 시간·장소도 · 현장 연장
 *
 * 판별자는 `tours.price_type === 'vehicle'`(lib/tour-room/tourKind.ts). 앱이
 * `manualKind` 로 이미 갈라 놓았으므로 영상도 같은 값으로 고르면 된다.
 *
 * ⚠ 프라이빗 전용 화면(플래너·미팅 지정·연장)은 이 픽스처에 없다 — 시뮬 예약이
 * 조인투어다. 그래서 10~12는 그 화면을 **찍지 못한 채로 말하지 않는다**:
 * 공용 화면 위에 사실만 얹고, 전용 스크린샷은 프라이빗 픽스처가 생기면 그
 * 세 장만 갈아끼운다. 없는 화면을 그림으로 대체하는 건 §H가 금지하는 그것이다.
 */

import join from './app-guide-join.mjs';

/** 씬 1~9는 조인편과 공유한다 — 복사하면 언젠가 갈라진다. */
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
      dur: 9.0,
      shot: 'schedule-cards',
      eyebrow: 'PRIVATE TOUR',
      headline: 'You choose the day —\nor leave it to your guide',
      gloss: {
        ko: '일정은 손님이 정합니다 — 가이드에게 맡겨도 됩니다',
        ja: '行程はお客様が決めます。ガイドにお任せもできます',
        zh: '行程由您决定 — 也可以交给导游安排',
        'zh-TW': '行程由您決定 — 也可以交給導遊安排',
        es: 'Tú eliges el día, o se lo dejas a tu guía',
        fr: 'Vous choisissez la journée, ou vous la confiez à votre guide',
        de: 'Sie bestimmen den Tag — oder überlassen ihn dem Guide',
        ru: 'День выбираете вы — или доверяете гиду',
        it: 'Scegli tu la giornata, o la lasci alla guida',
      },
      steps: [
        ['Open the planner from your invitation email', {
          ko: '초대 메일의 플래너를 엽니다', ja: '招待メールのプランナーを開きます',
          zh: '打开邀请邮件里的行程规划', 'zh-TW': '打開邀請郵件裡的行程規劃',
          es: 'Abre el planificador del correo de invitación',
          fr: 'Ouvrez le planificateur depuis l’e-mail d’invitation',
          de: 'Öffnen Sie den Planer aus der Einladungs-E-Mail',
          ru: 'Откройте планировщик из письма-приглашения',
          it: 'Apri il pianificatore dall’email di invito',
        }],
        ['Pick a course, or hand it to the guide', {
          ko: '코스를 고르거나 가이드에게 맡깁니다', ja: 'コースを選ぶかガイドに任せます',
          zh: '选择路线，或交给导游', 'zh-TW': '選擇路線，或交給導遊',
          es: 'Elige un recorrido o déjaselo al guía',
          fr: 'Choisissez un parcours ou confiez-le au guide',
          de: 'Route wählen oder dem Guide überlassen',
          ru: 'Выберите маршрут или доверьте его гиду',
          it: 'Scegli un percorso o affidalo alla guida',
        }],
        ['It appears in Today, exactly as agreed', {
          ko: '정해지면 오늘 일정 탭에 그대로', ja: '決まれば「本日」タブにそのまま',
          zh: '确定后原样出现在「今日」', 'zh-TW': '確定後原樣出現在「今日」',
          es: 'Aparece en Hoy, tal como se acordó',
          fr: 'Il apparaît dans Aujourd’hui, tel qu’convenu',
          de: 'Es erscheint im Tab „Heute“, genau wie vereinbart',
          ru: 'Он появится во вкладке «Сегодня» — как договорились',
          it: 'Compare in Oggi, esattamente come concordato',
        }],
      ],
      chrome: { tr: 'PAGE 10 · YOUR DAY', bl: 'PLANNER · THE NIGHT BEFORE' },
    },
    {
      id: 's11-meet',
      scene: 'screen-focus',
      dur: 7.0,
      shot: 'now-card',
      eyebrow: 'YOU SET THE TIME',
      headline: 'You set the meeting\ntime and place',
      gloss: {
        ko: '만나는 시간과 장소도 직접 정할 수 있어요',
        ja: '待ち合わせの時間と場所もご自身で決められます',
        zh: '见面的时间和地点也由您决定',
        'zh-TW': '見面的時間和地點也由您決定',
        es: 'Tú fijas la hora y el lugar del encuentro',
        fr: 'Vous fixez l’heure et le lieu du rendez-vous',
        de: 'Sie legen Zeit und Ort des Treffens fest',
        ru: 'Время и место встречи выбираете вы',
        it: 'Sei tu a fissare ora e luogo dell’incontro',
      },
      chrome: { tr: 'PAGE 11 · MEETING', bl: 'FROM THE NIGHT BEFORE' },
    },
    {
      id: 's12-extend',
      scene: 'screen-focus',
      dur: 7.0,
      shot: 'home',
      eyebrow: 'MORE TIME',
      headline: 'Extra hours can be\nadded on the day',
      gloss: {
        ko: '더 있고 싶으면 현장에서 시간을 연장할 수 있어요 (현금)',
        ja: 'もっと居たいときは当日その場で延長できます（現金）',
        zh: '想多待一会儿，可当天现场延长（现金）',
        'zh-TW': '想多待一會兒，可當天現場延長（現金）',
        es: 'Puedes ampliar horas el mismo día, en efectivo',
        fr: 'Des heures en plus, le jour même, en espèces',
        de: 'Zusatzstunden am Tag selbst, in bar',
        ru: 'Дополнительные часы можно добавить в тот же день, наличными',
        it: 'Ore extra aggiungibili in giornata, in contanti',
      },
      chrome: { tr: 'PAGE 12 · EXTEND', bl: 'DRIVER DRIVES · GUIDE IS IN THE APP' },
    },
    {
      id: 's13-outro',
      scene: 'outro',
      dur: 4.8,
      headline: 'Settings → How this app works,\nany time',
      gloss: join.scenes[join.scenes.length - 1].gloss,
      chrome: { tr: 'END', bl: 'ATOC KOREA · TOUR APP' },
    },
  ],
};
