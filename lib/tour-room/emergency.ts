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
  label: Record<RoomLocale, string>;
  note?: Record<RoomLocale, string>;
}

export const EMERGENCY_TITLE: Record<RoomLocale, string> = {
  en: 'Emergency & help',
  ko: '긴급 연락처',
  ja: '緊急連絡先',
  es: 'Emergencias y ayuda',
  zh: '紧急联系方式',
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
    },
    note: {
      en: 'Message the room first — the ops team reads it live.',
      ko: '먼저 룸에 메시지를 남기세요 — 운영팀이 실시간으로 확인합니다.',
      ja: 'まずルームにメッセージを — 運営チームがリアルタイムで確認します。',
      es: 'Escribe primero en la sala: el equipo la lee en vivo.',
      zh: '请先在房间里留言 — 运营团队会实时查看。',
    },
  },
] as const;
