/**
 * I2 — the "지금 카드" wording, in the room's ten locales.
 *
 * Typed as `Record<RoomLocale, …>` rather than `Record<string, …>` on purpose:
 * the loose form is exactly how `vision-ask` shipped a five-entry map and
 * answered French, German, Russian and Italian guests in English for weeks
 * (U-D10 / G1). With this type, adding a locale breaks the build until every
 * string exists.
 *
 * The tone rule: this card speaks in the second person and says what to DO. A
 * guest reads it while walking, holding a suitcase, in their fourth language of
 * the day. Nothing here is a heading — everything is an instruction or a fact.
 */
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface NowCardCopy {
  /** rally_overdue — the group is already waiting. */
  rallyTitle: string;
  rallySub: string;
  rallyCall: string;
  rallyShare: string;
  /** free_time — the countdown is the message. */
  freeTitle: (minutes: number) => string;
  freeAction: string;
  /** arrived — the guest is standing somewhere. */
  arrivedEyebrow: string;
  arrivedStay: (minutes: number) => string;
  arrivedAction: string;
  /** pickup_window — the vehicle is coming to them. */
  pickupTitle: string;
  pickupAction: string;
  /** moving — the quiet one. */
  movingEyebrow: string;
  movingAction: string;
  /** Chips, derived from state (max two). */
  chipToilet: string;
  chipPhoto: string;
  chipMeeting: string;
  chipNext: string;
  /**
   * SG-1b — the four-row grammar. Eyebrows say WHAT is happening, the
   * numeral says HOW LONG, the title says WHERE, the sub says what to do.
   * Every time interpolation (`t`) is pre-formatted through formatTargetTime
   * (SG-D20) — raw "HH:MM" here would split the room into 12h/24h dialects.
   */
  rallyEyebrow: string;
  freeEyebrow: string;
  pickupEyebrow: string;
  freeMeetAt: (point: string) => string;
  freeTitleNoPoint: string;
  waitUntil: (t: string) => string;
  /** Request-phrased on purpose — pickup +10 has no enforcement capsule (F-4). */
  pickupWaitUntil: (t: string) => string;
  arrivedUntil: (t: string) => string;
  /** "Nothing to do" is a real state (제로베이스 §D-B question 3). */
  movingReassurance: string;
  /** E1 — on-device walk-back; rendered only when the guest opted in. */
  leaveBy: (minutes: number, t: string) => string;
  walkOptIn: string;
  /** NumeralClock minutes suffix — the label carries its own spacing. */
  minuteUnitLabel: string;
}

export const NOW_CARD_COPY: Record<RoomLocale, NowCardCopy> = {
  en: {
    rallyTitle: 'Your group is waiting',
    rallySub: 'Head to the meeting point',
    rallyCall: 'Call the team',
    rallyShare: 'Send my location',
    freeTitle: (m) => `${m} min of free time left`,
    freeAction: 'Head back',
    arrivedEyebrow: 'You’re here',
    arrivedStay: (m) => `About ${m} min here`,
    arrivedAction: 'Listen to the guide',
    pickupTitle: 'Your ride is on the way',
    pickupAction: 'I’m here',
    movingEyebrow: 'Next',
    movingAction: 'Open map',
    chipToilet: 'Toilets',
    chipPhoto: 'Photo spot',
    chipMeeting: 'Meeting point',
    chipNext: 'Next stop',
    rallyEyebrow: 'Meeting time',
    freeEyebrow: 'Free time',
    pickupEyebrow: 'Pickup',
    freeMeetAt: (point) => `Meet at ${point}`,
    freeTitleNoPoint: 'Meeting point coming soon',
    waitUntil: (t) => `Waits until ${t}, then departs`,
    pickupWaitUntil: (t) => `Please be out by ${t}`,
    arrivedUntil: (t) => `Yours until about ${t}`,
    movingReassurance: 'Nothing to do — enjoy the ride',
    leaveBy: (m, t) => `${m} min walk from you — leave by ${t}`,
    walkOptIn: 'Walk time from my location',
    minuteUnitLabel: ' min',
  },
  ko: {
    rallyTitle: '일행이 기다리고 있어요',
    rallySub: '집합 장소로 와 주세요',
    rallyCall: '운영팀 전화',
    rallyShare: '내 위치 보내기',
    freeTitle: (m) => `자유시간 ${m}분 남았어요`,
    freeAction: '돌아가는 길',
    arrivedEyebrow: '지금 여기',
    arrivedStay: (m) => `약 ${m}분 머무릅니다`,
    arrivedAction: '해설 듣기',
    pickupTitle: '차량이 오고 있어요',
    pickupAction: '여기 있어요',
    movingEyebrow: '다음',
    movingAction: '지도 열기',
    chipToilet: '화장실',
    chipPhoto: '포토스팟',
    chipMeeting: '집합 장소',
    chipNext: '다음 스톱',
    rallyEyebrow: '집합',
    freeEyebrow: '자유시간',
    pickupEyebrow: '픽업',
    freeMeetAt: (point) => `${point}에서 만나요`,
    freeTitleNoPoint: '집합 안내를 기다려 주세요',
    waitUntil: (t) => `${t}까지 대기 후 출발해요`,
    pickupWaitUntil: (t) => `${t}까지는 나와 주세요`,
    arrivedUntil: (t) => `약 ${t}까지 여유 있어요`,
    movingReassurance: '지금은 편히 계시면 됩니다',
    leaveBy: (m, t) => `내 위치에서 도보 ${m}분 · ${t}에는 출발하세요`,
    walkOptIn: '내 위치 기준 도보 시간',
    minuteUnitLabel: '분',
  },
  ja: {
    rallyTitle: 'みなさんお待ちです',
    rallySub: '集合場所へお越しください',
    rallyCall: '運営に電話',
    rallyShare: '現在地を送る',
    freeTitle: (m) => `自由時間はあと${m}分です`,
    freeAction: '戻る道順',
    arrivedEyebrow: '現在地',
    arrivedStay: (m) => `滞在は約${m}分です`,
    arrivedAction: 'ガイドを聞く',
    pickupTitle: '車両が向かっています',
    pickupAction: 'ここにいます',
    movingEyebrow: '次',
    movingAction: '地図を開く',
    chipToilet: 'トイレ',
    chipPhoto: '撮影スポット',
    chipMeeting: '集合場所',
    chipNext: '次のスポット',
    rallyEyebrow: '集合',
    freeEyebrow: '自由時間',
    pickupEyebrow: 'お迎え',
    freeMeetAt: (point) => `${point}で集合です`,
    freeTitleNoPoint: '集合のご案内をお待ちください',
    waitUntil: (t) => `${t}まで待って出発します`,
    pickupWaitUntil: (t) => `${t}までにお越しください`,
    arrivedUntil: (t) => `${t}頃までごゆっくりどうぞ`,
    movingReassurance: '今は何もしなくて大丈夫です',
    leaveBy: (m, t) => `現在地から徒歩${m}分 · ${t}に出発を`,
    walkOptIn: '現在地からの徒歩時間',
    minuteUnitLabel: '分',
  },
  zh: {
    rallyTitle: '大家在等您',
    rallySub: '请前往集合地点',
    rallyCall: '致电运营团队',
    rallyShare: '发送我的位置',
    freeTitle: (m) => `自由活动还剩 ${m} 分钟`,
    freeAction: '返回路线',
    arrivedEyebrow: '当前位置',
    arrivedStay: (m) => `停留约 ${m} 分钟`,
    arrivedAction: '收听讲解',
    pickupTitle: '车辆正在赶来',
    pickupAction: '我在这里',
    movingEyebrow: '下一站',
    movingAction: '打开地图',
    chipToilet: '洗手间',
    chipPhoto: '拍照点',
    chipMeeting: '集合地点',
    chipNext: '下一站',
    rallyEyebrow: '集合',
    freeEyebrow: '自由活动',
    pickupEyebrow: '接送',
    freeMeetAt: (point) => `在${point}集合`,
    freeTitleNoPoint: '集合信息即将发布',
    waitUntil: (t) => `等到 ${t} 后出发`,
    pickupWaitUntil: (t) => `请在 ${t} 前出来`,
    arrivedUntil: (t) => `约 ${t} 前可自由参观`,
    movingReassurance: '现在无需做任何事，安心乘车即可',
    leaveBy: (m, t) => `距您步行 ${m} 分钟 · 请在 ${t} 出发`,
    walkOptIn: '按我的位置计算步行时间',
    minuteUnitLabel: ' 分钟',
  },
  'zh-TW': {
    rallyTitle: '大家在等您',
    rallySub: '請前往集合地點',
    rallyCall: '致電營運團隊',
    rallyShare: '傳送我的位置',
    freeTitle: (m) => `自由活動還剩 ${m} 分鐘`,
    freeAction: '返回路線',
    arrivedEyebrow: '目前位置',
    arrivedStay: (m) => `停留約 ${m} 分鐘`,
    arrivedAction: '收聽導覽',
    pickupTitle: '車輛正在前來',
    pickupAction: '我在這裡',
    movingEyebrow: '下一站',
    movingAction: '開啟地圖',
    chipToilet: '洗手間',
    chipPhoto: '拍照點',
    chipMeeting: '集合地點',
    chipNext: '下一站',
    rallyEyebrow: '集合',
    freeEyebrow: '自由活動',
    pickupEyebrow: '接送',
    freeMeetAt: (point) => `在${point}集合`,
    freeTitleNoPoint: '集合資訊即將發布',
    waitUntil: (t) => `等到 ${t} 後出發`,
    pickupWaitUntil: (t) => `請在 ${t} 前出來`,
    arrivedUntil: (t) => `約 ${t} 前可自由參觀`,
    movingReassurance: '現在無需做任何事，安心乘車即可',
    leaveBy: (m, t) => `距您步行 ${m} 分鐘 · 請在 ${t} 出發`,
    walkOptIn: '按我的位置計算步行時間',
    minuteUnitLabel: ' 分鐘',
  },
  es: {
    rallyTitle: 'Tu grupo te espera',
    rallySub: 'Ve al punto de encuentro',
    rallyCall: 'Llamar al equipo',
    rallyShare: 'Enviar mi ubicación',
    freeTitle: (m) => `Quedan ${m} min de tiempo libre`,
    freeAction: 'Volver',
    arrivedEyebrow: 'Estás aquí',
    arrivedStay: (m) => `Unos ${m} min aquí`,
    arrivedAction: 'Escuchar la guía',
    pickupTitle: 'Tu vehículo está en camino',
    pickupAction: 'Estoy aquí',
    movingEyebrow: 'Siguiente',
    movingAction: 'Abrir mapa',
    chipToilet: 'Aseos',
    chipPhoto: 'Punto de fotos',
    chipMeeting: 'Punto de encuentro',
    chipNext: 'Siguiente parada',
    rallyEyebrow: 'Hora de reunión',
    freeEyebrow: 'Tiempo libre',
    pickupEyebrow: 'Recogida',
    freeMeetAt: (point) => `Nos vemos en ${point}`,
    freeTitleNoPoint: 'Punto de encuentro en breve',
    waitUntil: (t) => `Esperamos hasta las ${t} y salimos`,
    pickupWaitUntil: (t) => `Salga antes de las ${t}, por favor`,
    arrivedUntil: (t) => `Tiene hasta las ${t} aprox.`,
    movingReassurance: 'Nada que hacer — disfrute el trayecto',
    leaveBy: (m, t) => `A ${m} min a pie — salga a las ${t}`,
    walkOptIn: 'Tiempo a pie desde mi ubicación',
    minuteUnitLabel: ' min',
  },
  fr: {
    rallyTitle: 'Votre groupe vous attend',
    rallySub: 'Rejoignez le point de rendez-vous',
    rallyCall: 'Appeler l’équipe',
    rallyShare: 'Envoyer ma position',
    freeTitle: (m) => `Il reste ${m} min de temps libre`,
    freeAction: 'Retour',
    arrivedEyebrow: 'Vous êtes ici',
    arrivedStay: (m) => `Environ ${m} min sur place`,
    arrivedAction: 'Écouter le guide',
    pickupTitle: 'Votre véhicule arrive',
    pickupAction: 'Je suis ici',
    movingEyebrow: 'Ensuite',
    movingAction: 'Ouvrir la carte',
    chipToilet: 'Toilettes',
    chipPhoto: 'Spot photo',
    chipMeeting: 'Point de rendez-vous',
    chipNext: 'Prochain arrêt',
    rallyEyebrow: 'Rassemblement',
    freeEyebrow: 'Temps libre',
    pickupEyebrow: 'Prise en charge',
    freeMeetAt: (point) => `Rendez-vous à ${point}`,
    freeTitleNoPoint: 'Point de rendez-vous à venir',
    waitUntil: (t) => `Attente jusqu’à ${t}, puis départ`,
    pickupWaitUntil: (t) => `Merci de sortir avant ${t}`,
    arrivedUntil: (t) => `Profitez-en jusqu’à ${t} environ`,
    movingReassurance: 'Rien à faire — profitez du trajet',
    leaveBy: (m, t) => `À ${m} min à pied — partez à ${t}`,
    walkOptIn: 'Temps de marche depuis ma position',
    minuteUnitLabel: ' min',
  },
  de: {
    rallyTitle: 'Ihre Gruppe wartet',
    rallySub: 'Bitte zum Treffpunkt kommen',
    rallyCall: 'Team anrufen',
    rallyShare: 'Standort senden',
    freeTitle: (m) => `Noch ${m} Min. freie Zeit`,
    freeAction: 'Zurück zum Treffpunkt',
    arrivedEyebrow: 'Sie sind hier',
    arrivedStay: (m) => `Etwa ${m} Min. hier`,
    arrivedAction: 'Guide anhören',
    pickupTitle: 'Ihr Fahrzeug ist unterwegs',
    pickupAction: 'Ich bin hier',
    movingEyebrow: 'Als Nächstes',
    movingAction: 'Karte öffnen',
    chipToilet: 'Toiletten',
    chipPhoto: 'Fotostelle',
    chipMeeting: 'Treffpunkt',
    chipNext: 'Nächster Stopp',
    rallyEyebrow: 'Treffpunkt',
    freeEyebrow: 'Freie Zeit',
    pickupEyebrow: 'Abholung',
    freeMeetAt: (point) => `Treffpunkt: ${point}`,
    freeTitleNoPoint: 'Treffpunkt folgt in Kürze',
    waitUntil: (t) => `Wir warten bis ${t}, dann Abfahrt`,
    pickupWaitUntil: (t) => `Bitte bis ${t} draußen sein`,
    arrivedUntil: (t) => `Zeit bis ca. ${t}`,
    movingReassurance: 'Nichts zu tun — genießen Sie die Fahrt',
    leaveBy: (m, t) => `${m} Min. zu Fuß — um ${t} losgehen`,
    walkOptIn: 'Gehzeit von meinem Standort',
    minuteUnitLabel: ' Min.',
  },
  ru: {
    rallyTitle: 'Ваша группа ждёт',
    rallySub: 'Подойдите к месту сбора',
    rallyCall: 'Позвонить команде',
    rallyShare: 'Отправить моё местоположение',
    freeTitle: (m) => `Свободного времени осталось ${m} мин`,
    freeAction: 'Обратный путь',
    arrivedEyebrow: 'Вы здесь',
    arrivedStay: (m) => `Около ${m} мин здесь`,
    arrivedAction: 'Послушать гида',
    pickupTitle: 'Ваш транспорт уже едет',
    pickupAction: 'Я здесь',
    movingEyebrow: 'Далее',
    movingAction: 'Открыть карту',
    chipToilet: 'Туалеты',
    chipPhoto: 'Точка для фото',
    chipMeeting: 'Место сбора',
    chipNext: 'Следующая остановка',
    rallyEyebrow: 'Сбор',
    freeEyebrow: 'Свободное время',
    pickupEyebrow: 'Трансфер',
    freeMeetAt: (point) => `Встречаемся: ${point}`,
    freeTitleNoPoint: 'Место сбора скоро появится',
    waitUntil: (t) => `Ждём до ${t}, затем отправляемся`,
    pickupWaitUntil: (t) => `Пожалуйста, выйдите к ${t}`,
    arrivedUntil: (t) => `Время примерно до ${t}`,
    movingReassurance: 'Ничего делать не нужно — наслаждайтесь поездкой',
    leaveBy: (m, t) => `${m} мин пешком — выходите в ${t}`,
    walkOptIn: 'Время пешком от моего местоположения',
    minuteUnitLabel: ' мин',
  },
  it: {
    rallyTitle: 'Il gruppo la sta aspettando',
    rallySub: 'Raggiunga il punto di ritrovo',
    rallyCall: 'Chiama il team',
    rallyShare: 'Invia la mia posizione',
    freeTitle: (m) => `Restano ${m} min di tempo libero`,
    freeAction: 'Torna indietro',
    arrivedEyebrow: 'Si trova qui',
    arrivedStay: (m) => `Circa ${m} min qui`,
    arrivedAction: 'Ascolta la guida',
    pickupTitle: 'Il veicolo sta arrivando',
    pickupAction: 'Sono qui',
    movingEyebrow: 'Prossima',
    movingAction: 'Apri la mappa',
    chipToilet: 'Servizi igienici',
    chipPhoto: 'Punto foto',
    chipMeeting: 'Punto di ritrovo',
    chipNext: 'Prossima tappa',
    rallyEyebrow: 'Ritrovo',
    freeEyebrow: 'Tempo libero',
    pickupEyebrow: 'Prelievo',
    freeMeetAt: (point) => `Ci vediamo a ${point}`,
    freeTitleNoPoint: 'Punto di ritrovo in arrivo',
    waitUntil: (t) => `Attendiamo fino alle ${t}, poi si parte`,
    pickupWaitUntil: (t) => `Esca entro le ${t}, per favore`,
    arrivedUntil: (t) => `Ha tempo fino alle ${t} circa`,
    movingReassurance: 'Niente da fare — si goda il viaggio',
    leaveBy: (m, t) => `${m} min a piedi — parta alle ${t}`,
    walkOptIn: 'Tempo a piedi dalla mia posizione',
    minuteUnitLabel: ' min',
  },
};
