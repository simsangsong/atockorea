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
  },
};
