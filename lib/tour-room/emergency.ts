/**
 * T1.10 — emergency contact card content (static constants, 5 locales,
 * LLM calls: zero). Ships inside the client bundle so the card renders even
 * fully offline; numbers are one-tap tel: links.
 *
 * 1330 is the Korea Travel Helpline (24h, interpretation support run by KTO).
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

export interface EmergencyContact {
  key: string;
  /** Dialable number (tel: target). Empty string = informational row. */
  tel: string;
  /** W4.3/H1 — non-phone rows: a maps deep link (nearest ER / pharmacy). */
  href?: string;
  label: Record<RoomLocale, string>;
  note?: Record<RoomLocale, string>;
}

export const EMERGENCY_TITLE: Record<RoomLocale, string> = {
  en: 'Emergency & help',
  ko: '긴급 연락처',
  ja: '緊急連絡先',
  es: 'Emergencias y ayuda',
  zh: '紧急联系方式',
  'zh-TW': '緊急聯絡方式',
  fr: 'Urgences et aide',
  de: 'Notfall & Hilfe',
  ru: 'Экстренная помощь',
  it: 'Emergenze e aiuto',
};

export const EMERGENCY_CONTACTS: readonly EmergencyContact[] = [
  {
    key: 'emergency_119',
    tel: '119',
    label: {
      en: '119 — Fire / Ambulance',
      ko: '119 — 화재·구급',
      ja: '119 — 消防・救急',
      es: '119 — Bomberos / Ambulancia',
      zh: '119 — 火警/急救',
      'zh-TW': '119 — 火警/救護車',
      fr: '119 — Pompiers / Ambulance',
      de: '119 — Feuerwehr / Rettung',
      ru: '119 — пожарные / скорая',
      it: '119 — Vigili del fuoco / Ambulanza',
    },
  },
  {
    key: 'police_112',
    tel: '112',
    label: {
      en: '112 — Police',
      ko: '112 — 경찰',
      ja: '112 — 警察',
      es: '112 — Policía',
      zh: '112 — 警察',
      'zh-TW': '112 — 警察',
      fr: '112 — Police',
      de: '112 — Polizei',
      ru: '112 — полиция',
      it: '112 — Polizia',
    },
  },
  {
    key: 'travel_helpline_1330',
    tel: '1330',
    label: {
      en: '1330 — Korea Travel Helpline (24h, interpreters)',
      ko: '1330 — 관광통역안내 (24시간)',
      ja: '1330 — 韓国旅行ホットライン（24時間・通訳）',
      es: '1330 — Línea de ayuda turística de Corea (24h, intérpretes)',
      zh: '1330 — 韩国旅游咨询热线（24小时，含翻译）',
      'zh-TW': '1330 — 韓國觀光諮詢專線（24小時，提供口譯）',
      fr: '1330 — Ligne d’aide aux voyageurs en Corée (24h/24, interprètes)',
      de: '1330 — Korea Travel Helpline (rund um die Uhr, Dolmetscher)',
      ru: '1330 — туристическая горячая линия Кореи (круглосуточно, переводчики)',
      it: '1330 — Linea di assistenza turistica della Corea (24h, interpreti)',
    },
  },
  {
    // H1 — nearest emergency room via a maps search deep link (the phone's
    // location centers the search; works with zero API calls).
    key: 'nearest_er',
    tel: '',
    href: 'https://www.google.com/maps/search/emergency+room',
    label: {
      en: 'Nearest emergency room (map)',
      ko: '가까운 응급실 찾기 (지도)',
      ja: '最寄りの救急外来を探す（地図）',
      es: 'Urgencias más cercanas (mapa)',
      zh: '查找最近的急诊室(地图)',
      'zh-TW': '尋找最近的急診室（地圖）',
      fr: 'Urgences les plus proches (carte)',
      de: 'Nächste Notaufnahme (Karte)',
      ru: 'Ближайший пункт неотложной помощи (карта)',
      it: 'Pronto soccorso più vicino (mappa)',
    },
  },
  {
    key: 'nearest_pharmacy',
    tel: '',
    href: 'https://www.google.com/maps/search/pharmacy',
    label: {
      en: 'Nearest pharmacy (map)',
      ko: '가까운 약국 찾기 (지도)',
      ja: '最寄りの薬局を探す（地図）',
      es: 'Farmacia más cercana (mapa)',
      zh: '查找最近的药店(地图)',
      'zh-TW': '尋找最近的藥局（地圖）',
      fr: 'Pharmacie la plus proche (carte)',
      de: 'Nächste Apotheke (Karte)',
      ru: 'Ближайшая аптека (карта)',
      it: 'Farmacia più vicina (mappa)',
    },
  },
  {
    key: 'atoc_ops',
    // Real ops number comes from env (unset → informational row, no tel link).
    tel: process.env.NEXT_PUBLIC_TOUR_OPS_PHONE ?? '',
    label: {
      en: 'AtoC Korea tour operations',
      ko: 'AtoC Korea 투어 운영센터',
      ja: 'AtoC Korea ツアー運営センター',
      es: 'Operaciones de tour AtoC Korea',
      zh: 'AtoC Korea 行程运营中心',
      'zh-TW': 'AtoC Korea 行程營運中心',
      fr: 'Centre des opérations AtoC Korea',
      de: 'AtoC Korea Tour-Zentrale',
      ru: 'Центр управления турами AtoC Korea',
      it: 'Centrale operativa AtoC Korea',
    },
    note: {
      en: 'Message the room first — the ops team reads it live.',
      ko: '먼저 룸에 메시지를 남기세요 — 운영팀이 실시간으로 확인합니다.',
      ja: 'まずルームにメッセージを — 運営チームがリアルタイムで確認します。',
      es: 'Escribe primero en la sala: el equipo la lee en vivo.',
      zh: '请先在房间里留言 — 运营团队会实时查看。',
      'zh-TW': '請先在旅遊房間留言 — 營運團隊會即時查看。',
      fr: 'Envoyez d’abord un message dans l’espace tour — l’équipe des opérations le lit en direct.',
      de: 'Schreiben Sie zuerst in den Tour-Raum — das Team liest live mit.',
      ru: 'Сначала напишите в комнату тура — команда читает сообщения в реальном времени.',
      it: 'Scrivi prima nella stanza del tour — il team operativo legge in tempo reale.',
    },
  },
] as const;
