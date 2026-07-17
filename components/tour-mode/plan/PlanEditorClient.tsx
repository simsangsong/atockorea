'use client';

/**
 * W1.2 — the guest D-1 pre-selection editor (`/tour-mode/plan/[bookingId]`,
 * master plan §G).
 *
 * Three tabs on top of one shared stop editor:
 *   ① recommended courses (course_templates, seeded from live tours — P-D14)
 *   ② pick your own (curated match_pois picker + Google Places fallback with
 *      ~120m poi_key snapping)
 *   ③ leave it to the guide (bookings.itinerary.guide_curated — §G tab ③)
 * plus the A10 needs checklist (P-D11 → day_plans.needs) and live W1.3
 * feasibility warnings (P-D9 — badges only, never blocks).
 *
 * Auth = the room join flow (invite token `?rt=` consumed once, scrubbed,
 * then the signed x-tour-room-auth session). Editing is lead-guest-only
 * (P-D13) — everyone else gets a read-only view. Drafts auto-save (A2).
 * All times are KST (A11).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import {
  GOOGLE_MAPS_LOADER_ID,
  GOOGLE_MAPS_LOADER_VERSION,
  libraries as GOOGLE_MAPS_LIBRARIES,
} from '@/lib/google-maps';
import { koreanAllergyCardLines } from '@/lib/tour-room/allergyCard';
import { formatMinutes, haversineKm, totalDriveMinutes, type LatLng } from '@/lib/itinerary-builder/distance';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { useTourRoomSession } from '@/hooks/useTourRoomSession';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditorStop {
  id: string;
  source: 'poi' | 'google' | 'free';
  poi_key?: string | null;
  place_id?: string | null;
  title: string;
  stop_type: string;
  arrival_planned?: string | null;
  duration_min: number | null;
  lat?: number | null;
  lng?: number | null;
  memo_guest?: string;
}

interface NeedsState {
  adults: number;
  children: number;
  child_ages: string;
  stroller: boolean;
  wheelchair: boolean;
  luggage: boolean;
  dietary: string[];
  allergy_note: string;
  pace: 'relaxed' | 'standard' | 'packed';
  note: string;
}

interface FeasibilityWarning {
  code: 'overrun' | 'closed' | 'out_of_region';
  stop_id?: string;
  title?: string;
  detail: Record<string, string | number>;
}

interface PlanResponse {
  source: string;
  schedule: Array<Record<string, unknown>>;
  day_plan: {
    status?: string;
    stops?: Array<Record<string, unknown>>;
    needs?: Record<string, unknown> | null;
    feasibility?: { warnings?: FeasibilityWarning[] } | null;
    version?: number;
  } | null;
  viewer: { role: string; is_lead: boolean; can_edit: boolean };
  tour: { date: string | null; region: string | null; total_hours: number | null; guide_curated: boolean };
}

interface CourseTemplate {
  id: string;
  title_i18n: Record<string, string>;
  stops: Array<Record<string, unknown>>;
  total_hours: number | null;
}

interface PickerPoi {
  poi_key: string;
  name_en: string | null;
  name_ko: string | null;
  names_other_locales: Record<string, string> | null;
  category: string | null;
  default_image_url: string | null;
  default_stay_minutes: number | null;
  lat: number | null;
  lng: number | null;
}

// ---------------------------------------------------------------------------
// Copy — room 5-locale convention (P-D10)
// ---------------------------------------------------------------------------

const ROOM_LOCALE_VALUES = ['en', 'ko', 'zh', 'ja', 'es'] as const;

interface PlanCopy {
  title: string;
  tourDay: string;
  kstNote: string;
  loading: string;
  joinError: string;
  memberReadOnly: string;
  confirmedNote: string;
  submittedNote: string;
  delegatedNote: string;
  tabCourses: string;
  tabPick: string;
  tabDelegate: string;
  useCourse: string;
  courseStops: (n: number) => string;
  courseHours: (h: number) => string;
  replaceConfirm: string;
  searchPlaceholder: string;
  googleToggle: string;
  googlePlaceholder: string;
  googleLoading: string;
  add: string;
  added: string;
  yourDay: string;
  emptyStops: string;
  estimated: (total: string) => string;
  timeLabel: string;
  durationLabel: string;
  minutes: (n: number) => string;
  memoPlaceholder: string;
  removeStop: string;
  moveUp: string;
  moveDown: string;
  needsTitle: string;
  needsHint: string;
  adults: string;
  children: string;
  childAges: string;
  childAgesPlaceholder: string;
  stroller: string;
  wheelchair: string;
  luggage: string;
  dietaryTitle: string;
  dietary: Record<string, string>;
  allergyPlaceholder: string;
  paceTitle: string;
  pace: Record<'relaxed' | 'standard' | 'packed', string>;
  notePlaceholder: string;
  warningsTitle: string;
  warnOverrun: (overMin: string, budget: string) => string;
  warnClosed: (title: string) => string;
  warnOutOfRegion: (title: string) => string;
  saving: string;
  saved: string;
  saveError: string;
  submit: string;
  submitting: string;
  delegateTitle: string;
  delegateDesc: string;
  delegateCta: string;
  backToRoom: string;
  allergyCardTitle: string;
  allergyCardHint: string;
}

const COPY: Record<RoomLocale, PlanCopy> = {
  en: {
    title: 'Plan your tour day',
    tourDay: 'Tour day',
    kstNote: 'All times are Korea time (KST)',
    loading: 'Opening your planner…',
    joinError: 'We couldn’t open this link. Please use the latest link from your email, or message us.',
    memberReadOnly: 'Only the lead traveller can edit the plan — you’ll see the finished day here.',
    confirmedNote: 'Your guide confirmed this itinerary. To change something, just ask in the tour room chat.',
    submittedNote: 'Sent to your guide — they’ll review and confirm it.',
    delegatedNote: 'You’ve left the course to your guide. Tell us any wishes in the tour room chat!',
    tabCourses: 'Courses',
    tabPick: 'Pick places',
    tabDelegate: 'Leave it to the guide',
    useCourse: 'Start with this course',
    courseStops: (n) => `${n} stops`,
    courseHours: (h) => `~${h}h`,
    replaceConfirm: 'Replace your current stops with this course?',
    searchPlaceholder: 'Search places…',
    googleToggle: 'Can’t find it? Search Google Maps',
    googlePlaceholder: 'Search any place in the region…',
    googleLoading: 'Loading Google search…',
    add: 'Add',
    added: 'Added',
    yourDay: 'Your day',
    emptyStops: 'No stops yet — start from a course or pick places above.',
    estimated: (total) => `Estimated ${total} incl. driving`,
    timeLabel: 'Time (KST)',
    durationLabel: 'Stay',
    minutes: (n) => `${n}min`,
    memoPlaceholder: 'Request for this stop (optional)',
    removeStop: 'Remove stop',
    moveUp: 'Move up',
    moveDown: 'Move down',
    needsTitle: 'About your party',
    needsHint: 'Helps your guide prepare — shared only with your guide.',
    adults: 'Adults',
    children: 'Children',
    childAges: 'Child ages',
    childAgesPlaceholder: 'e.g. 5, 8',
    stroller: 'Stroller',
    wheelchair: 'Wheelchair',
    luggage: 'Large luggage',
    dietaryTitle: 'Dietary',
    dietary: {
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      halal: 'Halal',
      no_pork: 'No pork',
      no_seafood: 'No seafood',
      gluten_free: 'Gluten-free',
    },
    allergyPlaceholder: 'Allergies (please describe)',
    paceTitle: 'Pace',
    pace: { relaxed: 'Relaxed', standard: 'Standard', packed: 'See a lot' },
    notePlaceholder: 'Anything else for your guide? (optional)',
    warningsTitle: 'Heads-up',
    warnOverrun: (over, budget) =>
      `This plan runs about ${over} over the booked ${budget} — your guide may trim it.`,
    warnClosed: (title) => `${title} looks closed on your tour date.`,
    warnOutOfRegion: (title) => `${title} is outside the usual service area — the guide must confirm.`,
    saving: 'Saving…',
    saved: 'Saved',
    saveError: 'Couldn’t save — retrying on your next change.',
    submit: 'Send to my guide',
    submitting: 'Sending…',
    delegateTitle: 'Let your guide build the day',
    delegateDesc:
      'Your guide plans the best route for your date, weather, and crowd levels. You can still share wishes below — they’ll be woven in.',
    delegateCta: 'Leave it to the guide',
    backToRoom: 'Open the tour room',
    allergyCardTitle: '🍽️ Restaurant card (Korean)',
    allergyCardHint: 'Show this to restaurant staff — it explains your dietary needs in Korean.',
  },
  ko: {
    title: '오늘의 일정 만들기',
    tourDay: '투어일',
    kstNote: '모든 시간은 한국시간(KST) 기준이에요',
    loading: '플래너를 여는 중…',
    joinError: '링크를 열 수 없어요. 이메일의 최신 링크로 다시 시도하거나 채팅으로 문의해 주세요.',
    memberReadOnly: '일정 편집은 대표 여행자만 할 수 있어요 — 완성된 일정이 여기에 표시돼요.',
    confirmedNote: '가이드가 일정을 확정했어요. 변경하고 싶은 게 있으면 투어룸 채팅으로 알려주세요.',
    submittedNote: '가이드에게 전달했어요 — 확인 후 확정해 드려요.',
    delegatedNote: '가이드에게 코스를 맡겼어요. 바라는 점은 투어룸 채팅으로 알려주세요!',
    tabCourses: '추천 코스',
    tabPick: '직접 고르기',
    tabDelegate: '가이드에게 맡기기',
    useCourse: '이 코스로 시작',
    courseStops: (n) => `${n}곳`,
    courseHours: (h) => `약 ${h}시간`,
    replaceConfirm: '지금 담은 일정을 이 코스로 바꿀까요?',
    searchPlaceholder: '장소 검색…',
    googleToggle: '찾는 곳이 없나요? Google 지도에서 검색',
    googlePlaceholder: '지역 내 아무 장소나 검색…',
    googleLoading: 'Google 검색 로딩 중…',
    add: '담기',
    added: '담음',
    yourDay: '나의 하루',
    emptyStops: '아직 담은 곳이 없어요 — 추천 코스로 시작하거나 위에서 골라보세요.',
    estimated: (total) => `이동 포함 예상 ${total}`,
    timeLabel: '시간 (KST)',
    durationLabel: '체류',
    minutes: (n) => `${n}분`,
    memoPlaceholder: '이 장소 요청사항 (선택)',
    removeStop: '삭제',
    moveUp: '위로',
    moveDown: '아래로',
    needsTitle: '여행 정보',
    needsHint: '가이드 준비에만 사용돼요 — 가이드에게만 공유됩니다.',
    adults: '성인',
    children: '아동',
    childAges: '아이 나이',
    childAgesPlaceholder: '예: 5, 8',
    stroller: '유모차',
    wheelchair: '휠체어',
    luggage: '대형 짐',
    dietaryTitle: '식이',
    dietary: {
      vegetarian: '채식',
      vegan: '비건',
      halal: '할랄',
      no_pork: '돼지고기 X',
      no_seafood: '해산물 X',
      gluten_free: '글루텐프리',
    },
    allergyPlaceholder: '알레르기 (자세히 적어주세요)',
    paceTitle: '페이스',
    pace: { relaxed: '여유롭게', standard: '보통', packed: '알차게' },
    notePlaceholder: '가이드에게 전할 말 (선택)',
    warningsTitle: '확인해 주세요',
    warnOverrun: (over, budget) => `예약 시간(${budget})보다 약 ${over} 길어요 — 가이드가 조정할 수 있어요.`,
    warnClosed: (title) => `${title}은(는) 투어일에 휴무로 보여요.`,
    warnOutOfRegion: (title) => `${title}은(는) 기본 서비스 권역 밖이에요 — 가이드 확인이 필요해요.`,
    saving: '저장 중…',
    saved: '저장됨',
    saveError: '저장에 실패했어요 — 다음 수정 때 다시 시도해요.',
    submit: '가이드에게 보내기',
    submitting: '보내는 중…',
    delegateTitle: '가이드가 하루를 설계해 드려요',
    delegateDesc:
      '투어일의 날씨·혼잡도·동선을 고려해 가이드가 최적 코스를 준비해요. 아래에 바라는 점을 남기면 반영돼요.',
    delegateCta: '가이드에게 맡기기',
    backToRoom: '투어룸 열기',
    allergyCardTitle: '🍽️ 식당용 카드 (한국어)',
    allergyCardHint: '식당 직원에게 보여주세요 — 식이 정보를 한국어로 설명해요.',
  },
  ja: {
    title: 'ツアーの一日をプランする',
    tourDay: 'ツアー日',
    kstNote: '時刻はすべて韓国時間(KST)です',
    loading: 'プランナーを開いています…',
    joinError: 'リンクを開けませんでした。メールの最新リンクからお試しください。',
    memberReadOnly: 'プラン編集は代表者のみ可能です。完成した行程がここに表示されます。',
    confirmedNote: 'ガイドが行程を確定しました。変更はツアールームのチャットでご相談ください。',
    submittedNote: 'ガイドに送信しました。確認のうえ確定します。',
    delegatedNote: 'コースはガイドにお任せいただきました。ご希望はチャットでどうぞ!',
    tabCourses: 'おすすめコース',
    tabPick: '自分で選ぶ',
    tabDelegate: 'ガイドに任せる',
    useCourse: 'このコースで始める',
    courseStops: (n) => `${n}か所`,
    courseHours: (h) => `約${h}時間`,
    replaceConfirm: '現在のプランをこのコースに置き換えますか?',
    searchPlaceholder: 'スポットを検索…',
    googleToggle: '見つからない場合は Google マップで検索',
    googlePlaceholder: '地域内の場所を検索…',
    googleLoading: 'Google 検索を読み込み中…',
    add: '追加',
    added: '追加済み',
    yourDay: '私の一日',
    emptyStops: 'まだスポットがありません。コースから始めるか上で選んでください。',
    estimated: (total) => `移動込みの目安 ${total}`,
    timeLabel: '時刻 (KST)',
    durationLabel: '滞在',
    minutes: (n) => `${n}分`,
    memoPlaceholder: 'このスポットへのご要望(任意)',
    removeStop: '削除',
    moveUp: '上へ',
    moveDown: '下へ',
    needsTitle: '旅の情報',
    needsHint: 'ガイドの準備にのみ使用され、ガイドにのみ共有されます。',
    adults: '大人',
    children: '子ども',
    childAges: 'お子さまの年齢',
    childAgesPlaceholder: '例: 5, 8',
    stroller: 'ベビーカー',
    wheelchair: '車いす',
    luggage: '大きな荷物',
    dietaryTitle: '食事制限',
    dietary: {
      vegetarian: 'ベジタリアン',
      vegan: 'ヴィーガン',
      halal: 'ハラール',
      no_pork: '豚肉NG',
      no_seafood: '海鮮NG',
      gluten_free: 'グルテンフリー',
    },
    allergyPlaceholder: 'アレルギー(詳しくご記入ください)',
    paceTitle: 'ペース',
    pace: { relaxed: 'ゆったり', standard: '標準', packed: 'たっぷり' },
    notePlaceholder: 'ガイドへの伝言(任意)',
    warningsTitle: 'ご確認ください',
    warnOverrun: (over, budget) => `予約時間(${budget})より約${over}長いプランです。ガイドが調整する場合があります。`,
    warnClosed: (title) => `${title}はツアー日に休業のようです。`,
    warnOutOfRegion: (title) => `${title}は通常のサービス圏外です。ガイドの確認が必要です。`,
    saving: '保存中…',
    saved: '保存済み',
    saveError: '保存できませんでした。次の変更時に再試行します。',
    submit: 'ガイドに送る',
    submitting: '送信中…',
    delegateTitle: 'ガイドが一日を設計します',
    delegateDesc: '天気・混雑・動線を考慮して最適なコースをご用意します。ご希望は下に残せば反映されます。',
    delegateCta: 'ガイドに任せる',
    backToRoom: 'ツアールームを開く',
    allergyCardTitle: '🍽️ レストラン用カード(韓国語)',
    allergyCardHint: 'お店のスタッフに見せてください — 食事制限を韓国語で説明します。',
  },
  zh: {
    title: '规划您的旅行日',
    tourDay: '出行日',
    kstNote: '所有时间均为韩国时间(KST)',
    loading: '正在打开行程规划…',
    joinError: '无法打开此链接。请使用邮件中的最新链接,或在聊天中联系我们。',
    memberReadOnly: '只有主要旅客可以编辑行程——完成后会显示在这里。',
    confirmedNote: '导游已确定行程。如需调整,请在旅行房间聊天中告诉我们。',
    submittedNote: '已发送给导游——确认后将为您敲定。',
    delegatedNote: '已交给导游安排。有任何心愿请在聊天中告诉我们!',
    tabCourses: '推荐路线',
    tabPick: '自己挑选',
    tabDelegate: '交给导游',
    useCourse: '以此路线开始',
    courseStops: (n) => `${n}站`,
    courseHours: (h) => `约${h}小时`,
    replaceConfirm: '用此路线替换当前行程吗?',
    searchPlaceholder: '搜索景点…',
    googleToggle: '找不到?用 Google 地图搜索',
    googlePlaceholder: '搜索区域内任何地点…',
    googleLoading: '正在加载 Google 搜索…',
    add: '加入',
    added: '已加入',
    yourDay: '我的一天',
    emptyStops: '还没有加入景点——从推荐路线开始或在上方挑选。',
    estimated: (total) => `含车程预计 ${total}`,
    timeLabel: '时间 (KST)',
    durationLabel: '停留',
    minutes: (n) => `${n}分钟`,
    memoPlaceholder: '对此地点的要求(可选)',
    removeStop: '删除',
    moveUp: '上移',
    moveDown: '下移',
    needsTitle: '出行信息',
    needsHint: '仅用于导游准备,只与导游共享。',
    adults: '成人',
    children: '儿童',
    childAges: '孩子年龄',
    childAgesPlaceholder: '如: 5, 8',
    stroller: '婴儿车',
    wheelchair: '轮椅',
    luggage: '大件行李',
    dietaryTitle: '饮食',
    dietary: {
      vegetarian: '素食',
      vegan: '纯素',
      halal: '清真',
      no_pork: '不吃猪肉',
      no_seafood: '不吃海鲜',
      gluten_free: '无麸质',
    },
    allergyPlaceholder: '过敏情况(请详细说明)',
    paceTitle: '节奏',
    pace: { relaxed: '轻松', standard: '标准', packed: '多看多玩' },
    notePlaceholder: '想对导游说的话(可选)',
    warningsTitle: '请注意',
    warnOverrun: (over, budget) => `此行程比预订时长(${budget})多约${over}——导游可能会调整。`,
    warnClosed: (title) => `${title}在出行日似乎休息。`,
    warnOutOfRegion: (title) => `${title}在常规服务范围之外——需导游确认。`,
    saving: '保存中…',
    saved: '已保存',
    saveError: '保存失败——下次修改时会重试。',
    submit: '发送给导游',
    submitting: '发送中…',
    delegateTitle: '让导游为您设计一天',
    delegateDesc: '导游会结合天气、人流和路线为您准备最佳行程。在下方留下心愿即可被采纳。',
    delegateCta: '交给导游',
    backToRoom: '打开旅行房间',
    allergyCardTitle: '🍽️ 餐厅出示卡(韩语)',
    allergyCardHint: '出示给餐厅工作人员——用韩语说明您的饮食要求。',
  },
  es: {
    title: 'Planea tu día de tour',
    tourDay: 'Día del tour',
    kstNote: 'Todas las horas son hora de Corea (KST)',
    loading: 'Abriendo tu planificador…',
    joinError: 'No pudimos abrir este enlace. Usa el enlace más reciente de tu correo o escríbenos.',
    memberReadOnly: 'Solo el viajero principal puede editar el plan; aquí verás el día terminado.',
    confirmedNote: 'Tu guía confirmó el itinerario. Para cambios, escríbenos en el chat del tour.',
    submittedNote: 'Enviado a tu guía: lo revisará y confirmará.',
    delegatedNote: 'Dejaste el recorrido en manos del guía. ¡Comparte tus deseos en el chat!',
    tabCourses: 'Rutas',
    tabPick: 'Elegir lugares',
    tabDelegate: 'Dejarlo al guía',
    useCourse: 'Empezar con esta ruta',
    courseStops: (n) => `${n} paradas`,
    courseHours: (h) => `~${h}h`,
    replaceConfirm: '¿Reemplazar tus paradas actuales con esta ruta?',
    searchPlaceholder: 'Buscar lugares…',
    googleToggle: '¿No lo encuentras? Busca en Google Maps',
    googlePlaceholder: 'Busca cualquier lugar de la región…',
    googleLoading: 'Cargando búsqueda de Google…',
    add: 'Añadir',
    added: 'Añadido',
    yourDay: 'Tu día',
    emptyStops: 'Aún no hay paradas: empieza con una ruta o elige arriba.',
    estimated: (total) => `Estimado ${total} incl. trayectos`,
    timeLabel: 'Hora (KST)',
    durationLabel: 'Estancia',
    minutes: (n) => `${n}min`,
    memoPlaceholder: 'Petición para esta parada (opcional)',
    removeStop: 'Eliminar',
    moveUp: 'Subir',
    moveDown: 'Bajar',
    needsTitle: 'Sobre tu grupo',
    needsHint: 'Solo para preparar tu tour; se comparte únicamente con tu guía.',
    adults: 'Adultos',
    children: 'Niños',
    childAges: 'Edades de los niños',
    childAgesPlaceholder: 'ej.: 5, 8',
    stroller: 'Carriola',
    wheelchair: 'Silla de ruedas',
    luggage: 'Equipaje grande',
    dietaryTitle: 'Dieta',
    dietary: {
      vegetarian: 'Vegetariano',
      vegan: 'Vegano',
      halal: 'Halal',
      no_pork: 'Sin cerdo',
      no_seafood: 'Sin mariscos',
      gluten_free: 'Sin gluten',
    },
    allergyPlaceholder: 'Alergias (descríbelas)',
    paceTitle: 'Ritmo',
    pace: { relaxed: 'Relajado', standard: 'Estándar', packed: 'Ver mucho' },
    notePlaceholder: '¿Algo más para tu guía? (opcional)',
    warningsTitle: 'Atención',
    warnOverrun: (over, budget) =>
      `Este plan supera en ~${over} las ${budget} reservadas; tu guía podría ajustarlo.`,
    warnClosed: (title) => `${title} parece cerrado en tu fecha de tour.`,
    warnOutOfRegion: (title) => `${title} está fuera del área habitual; el guía debe confirmarlo.`,
    saving: 'Guardando…',
    saved: 'Guardado',
    saveError: 'No se pudo guardar; se reintentará con tu próximo cambio.',
    submit: 'Enviar a mi guía',
    submitting: 'Enviando…',
    delegateTitle: 'Deja que tu guía diseñe el día',
    delegateDesc:
      'Tu guía prepara la mejor ruta según fecha, clima y multitudes. Comparte tus deseos abajo y los tendrá en cuenta.',
    delegateCta: 'Dejarlo al guía',
    backToRoom: 'Abrir la sala del tour',
    allergyCardTitle: '🍽️ Tarjeta para restaurantes (coreano)',
    allergyCardHint: 'Muéstrala al personal del restaurante: explica tu dieta en coreano.',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DURATION_OPTIONS = [30, 45, 60, 90, 120, 180, 240];
/** Google pick within this range of a curated POI snaps to its poi_key (§G tab ②). */
const POI_SNAP_KM = 0.12;

const REGION_BOUNDS: Record<string, { north: number; south: number; west: number; east: number }> = {
  jeju: { north: 33.65, south: 33.1, west: 126.1, east: 126.99 },
  busan: { north: 35.95, south: 34.95, west: 128.5, east: 129.6 },
  seoul: { north: 38.4, south: 36.9, west: 126.3, east: 128.75 },
};

function detectLocale(): RoomLocale {
  // Server always 'en' (Node ≥21 exposes the SERVER's navigator.language —
  // trusting it breaks hydration for non-en devices); client detects for real.
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'en';
  const base = (navigator.language || 'en').toLowerCase().split('-')[0];
  return (ROOM_LOCALE_VALUES as readonly string[]).includes(base) ? (base as RoomLocale) : 'en';
}

function scrubTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('rt')) {
      url.searchParams.delete('rt');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    /* noop */
  }
}

function poiName(poi: PickerPoi, locale: RoomLocale): string {
  if (locale === 'ko' && poi.name_ko) return poi.name_ko;
  const other = poi.names_other_locales;
  if (other && typeof other === 'object') {
    const localized = other[locale];
    if (typeof localized === 'string' && localized.trim()) return localized;
  }
  return poi.name_en ?? poi.poi_key;
}

function stopTitleFrom(raw: Record<string, unknown>, locale: RoomLocale): string {
  const names = raw.name_i18n;
  if (names && typeof names === 'object') {
    const record = names as Record<string, string>;
    const localized = record[locale];
    if (typeof localized === 'string' && localized.trim()) return localized;
    if (typeof record.en === 'string' && record.en.trim()) return record.en;
    const first = Object.values(record).find((v) => typeof v === 'string' && v.trim());
    if (first) return first;
  }
  if (typeof raw.poi_key === 'string' && raw.poi_key) {
    return raw.poi_key
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return '';
}

function toEditorStops(rawStops: Array<Record<string, unknown>> | undefined, locale: RoomLocale): EditorStop[] {
  if (!Array.isArray(rawStops)) return [];
  return rawStops
    .filter((s) => s && typeof s === 'object')
    .map((s, index) => ({
      id: typeof s.id === 'string' ? s.id : `stop-${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
      source: (s.source === 'poi' || s.source === 'google' ? s.source : s.poi_key ? 'poi' : 'free') as EditorStop['source'],
      poi_key: typeof s.poi_key === 'string' ? s.poi_key : null,
      place_id: typeof s.place_id === 'string' ? s.place_id : null,
      title: stopTitleFrom(s, locale),
      stop_type: typeof s.stop_type === 'string' ? s.stop_type : 'sight',
      arrival_planned: typeof s.arrival_planned === 'string' ? s.arrival_planned.slice(0, 5) : null,
      duration_min: typeof s.duration_min === 'number' ? s.duration_min : null,
      lat: typeof s.lat === 'number' ? s.lat : null,
      lng: typeof s.lng === 'number' ? s.lng : null,
      memo_guest: typeof s.memo_guest === 'string' ? s.memo_guest : undefined,
    }))
    .filter((s) => s.title);
}

function toNeedsState(raw: Record<string, unknown> | null | undefined): NeedsState {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    adults: typeof src.adults === 'number' ? src.adults : 2,
    children: typeof src.children === 'number' ? src.children : 0,
    child_ages: Array.isArray(src.child_ages) ? (src.child_ages as number[]).join(', ') : '',
    stroller: src.stroller === true,
    wheelchair: src.wheelchair === true,
    luggage: src.luggage === true,
    dietary: Array.isArray(src.dietary) ? (src.dietary as string[]) : [],
    allergy_note: typeof src.allergy_note === 'string' ? src.allergy_note : '',
    pace: src.pace === 'relaxed' || src.pace === 'packed' ? src.pace : 'standard',
    note: typeof src.note === 'string' ? src.note : '',
  };
}

function needsPayload(needs: NeedsState): Record<string, unknown> {
  return {
    adults: needs.adults,
    children: needs.children,
    child_ages: needs.child_ages
      .split(/[,\s]+/)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 17),
    stroller: needs.stroller,
    wheelchair: needs.wheelchair,
    luggage: needs.luggage,
    dietary: needs.dietary,
    ...(needs.allergy_note.trim() ? { allergy_note: needs.allergy_note.trim() } : {}),
    pace: needs.pace,
    ...(needs.note.trim() ? { note: needs.note.trim() } : {}),
  };
}

function stopsPayload(stops: EditorStop[]): Array<Record<string, unknown>> {
  return stops.map((s) => ({
    id: s.id,
    title: s.title,
    poi_key: s.poi_key ?? undefined,
    place_id: s.place_id ?? undefined,
    stop_type: s.stop_type,
    arrival_planned: s.arrival_planned ?? undefined,
    duration_min: s.duration_min ?? undefined,
    lat: s.lat ?? undefined,
    lng: s.lng ?? undefined,
    memo_guest: s.memo_guest || undefined,
  }));
}

// ---------------------------------------------------------------------------
// Google Places fallback search (tab ② — lazy: mounts only when expanded)
// ---------------------------------------------------------------------------

function GooglePlaceSearch({
  region,
  placeholder,
  loadingLabel,
  onPick,
}: {
  region: string | null;
  placeholder: string;
  loadingLabel: string;
  onPick: (pick: { place_id: string; name: string; lat: number; lng: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return undefined;
    const places = (window as Window & { google?: typeof google }).google?.maps?.places;
    if (!places) return undefined;
    const bounds = region ? REGION_BOUNDS[region] : undefined;
    const ac = new places.Autocomplete(inputRef.current, {
      fields: ['place_id', 'geometry', 'name'],
      ...(bounds ? { bounds, strictBounds: false } : {}),
    });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      if (!place?.place_id || !loc) return;
      onPickRef.current({ place_id: place.place_id, name: place.name ?? '', lat: loc.lat(), lng: loc.lng() });
      if (inputRef.current) inputRef.current.value = '';
    });
    return () => listener.remove();
  }, [isLoaded, region]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={isLoaded ? placeholder : loadingLabel}
      disabled={!isLoaded}
      className="tr-card-text w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none disabled:opacity-60"
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type EditorTab = 'courses' | 'pick' | 'delegate';
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export default function PlanEditorClient({ bookingId }: { bookingId: string }) {
  const { state, join, roomSession } = useTourRoomSession(bookingId);
  const attempted = useRef(false);
  const [locale, setLocale] = useState<RoomLocale>(() => detectLocale());
  const copy = COPY[locale];

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [pois, setPois] = useState<PickerPoi[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [tab, setTab] = useState<EditorTab>('courses');
  const [stops, setStops] = useState<EditorStop[]>([]);
  const [needs, setNeeds] = useState<NeedsState>(() => toNeedsState(null));
  const [warnings, setWarnings] = useState<FeasibilityWarning[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [outcome, setOutcome] = useState<'submitted' | 'delegated' | null>(null);
  const [poiQuery, setPoiQuery] = useState('');
  const [googleOpen, setGoogleOpen] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── boot: join with ?rt=, scrub, adopt booking locale ─────────────────────
  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('rt');
    void join({ token: token || undefined }).then((result) => {
      if (!result) return;
      scrubTokenFromUrl();
      const resolved = result.participant?.locale;
      if (resolved && (ROOM_LOCALE_VALUES as readonly string[]).includes(resolved)) {
        setLocale(resolved as RoomLocale);
      }
    });
  }, [join]);

  const authedFetch = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}${path}`, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(roomSession ? { 'x-tour-room-auth': roomSession } : {}),
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
      }),
    [bookingId, roomSession],
  );

  // ── load plan + templates + pois once joined ───────────────────────────────
  useEffect(() => {
    if (state.status !== 'joined' || !roomSession || hydrated.current) return;
    hydrated.current = true;
    void (async () => {
      try {
        const [planRes, templatesRes] = await Promise.all([
          authedFetch('/plan'),
          authedFetch('/plan/templates'),
        ]);
        if (!planRes.ok) {
          setLoadError(true);
          return;
        }
        const planBody = (await planRes.json()) as PlanResponse;
        setPlan(planBody);
        setStops(toEditorStops(planBody.day_plan?.stops as Array<Record<string, unknown>>, locale));
        setNeeds(toNeedsState(planBody.day_plan?.needs));
        setWarnings(planBody.day_plan?.feasibility?.warnings ?? []);
        if (planBody.tour.guide_curated) setOutcome('delegated');
        if ((planBody.day_plan?.stops?.length ?? 0) > 0) setTab('pick');

        if (templatesRes.ok) {
          const body = (await templatesRes.json()) as { region: string | null; templates: CourseTemplate[] };
          setTemplates(body.templates ?? []);
          if (body.region) {
            void fetch(`/api/itinerary-builder/pois?region=${body.region}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((poisBody: { pois?: PickerPoi[] } | null) => {
                if (poisBody?.pois) setPois(poisBody.pois);
              })
              .catch(() => undefined);
          }
        }
      } catch {
        setLoadError(true);
      }
    })();
  }, [state.status, roomSession, authedFetch, locale]);

  const canEdit = Boolean(plan?.viewer.can_edit) && outcome !== 'submitted';
  const planStatus = plan?.day_plan?.status ?? null;
  const isConfirmed = planStatus !== null && planStatus !== 'guest_draft';

  // ── save (A2 auto-save, debounced) ────────────────────────────────────────
  const save = useCallback(
    async (extra?: { submit?: boolean; delegate?: boolean }) => {
      if (!plan?.viewer.can_edit) return null;
      setSaveState('saving');
      try {
        const body: Record<string, unknown> = { needs: needsPayload(needs), ...extra };
        if (stops.length > 0) body.stops = stopsPayload(stops);
        const res = await authedFetch('/plan', { method: 'PUT', body: JSON.stringify(body) });
        if (!res.ok) {
          setSaveState('error');
          return null;
        }
        const data = (await res.json()) as { feasibility?: { warnings?: FeasibilityWarning[] } };
        if (data.feasibility?.warnings) setWarnings(data.feasibility.warnings);
        setSaveState('saved');
        return data;
      } catch {
        setSaveState('error');
        return null;
      }
    },
    [authedFetch, needs, plan, stops],
  );

  const scheduleAutosave = useCallback(() => {
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save();
    }, 2500);
  }, [save]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  // ── mutations ─────────────────────────────────────────────────────────────
  const mutateStops = (updater: (prev: EditorStop[]) => EditorStop[]) => {
    setStops(updater);
    scheduleAutosave();
  };
  const mutateNeeds = (patch: Partial<NeedsState>) => {
    setNeeds((prev) => ({ ...prev, ...patch }));
    scheduleAutosave();
  };

  const addPoiStop = (poi: PickerPoi) => {
    mutateStops((prev) => [
      ...prev,
      {
        id: `poi-${poi.poi_key}-${Date.now().toString(36)}`,
        source: 'poi',
        poi_key: poi.poi_key,
        title: poiName(poi, locale),
        stop_type: 'sight',
        duration_min: poi.default_stay_minutes ?? 60,
        lat: poi.lat,
        lng: poi.lng,
      },
    ]);
  };

  const addGooglePick = (pick: { place_id: string; name: string; lat: number; lng: number }) => {
    // §G tab ② — snap to a curated POI when the pick is ~the same place.
    const here: LatLng = { lat: pick.lat, lng: pick.lng };
    const snapped = pois.find(
      (p) =>
        typeof p.lat === 'number' &&
        typeof p.lng === 'number' &&
        haversineKm(here, { lat: p.lat, lng: p.lng }) <= POI_SNAP_KM,
    );
    if (snapped) {
      addPoiStop(snapped);
      return;
    }
    mutateStops((prev) => [
      ...prev,
      {
        id: `g-${Date.now().toString(36)}`,
        source: 'google',
        place_id: pick.place_id,
        title: pick.name.slice(0, 120),
        stop_type: 'sight',
        duration_min: 60,
        lat: pick.lat,
        lng: pick.lng,
      },
    ]);
  };

  const applyTemplate = (template: CourseTemplate) => {
    if (stops.length > 0 && !window.confirm(copy.replaceConfirm)) return;
    setStops(toEditorStops(template.stops, locale));
    setWarnings([]);
    setTab('pick');
    scheduleAutosave();
  };

  const submitPlan = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const result = await save({ submit: true });
    if (result) setOutcome('submitted');
  };

  const delegatePlan = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    try {
      const res = await authedFetch('/plan', {
        method: 'PUT',
        body: JSON.stringify({ delegate: true, needs: needsPayload(needs) }),
      });
      if (res.ok) {
        setOutcome('delegated');
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const totalEstimateMin = useMemo(() => {
    const stay = stops.reduce((sum, s) => sum + (s.duration_min ?? 60), 0);
    const points = stops
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));
    return stay + totalDriveMinutes(points);
  }, [stops]);

  const filteredPois = useMemo(() => {
    const query = poiQuery.trim().toLowerCase();
    const inPlan = new Set(stops.map((s) => s.poi_key).filter(Boolean));
    const list = pois.map((p) => ({ poi: p, name: poiName(p, locale), added: inPlan.has(p.poi_key) }));
    if (!query) return list;
    return list.filter(
      ({ poi, name }) =>
        name.toLowerCase().includes(query) ||
        (poi.name_en ?? '').toLowerCase().includes(query) ||
        (poi.name_ko ?? '').includes(poiQuery.trim()),
    );
  }, [pois, poiQuery, stops, locale]);

  // ── render ────────────────────────────────────────────────────────────────
  if (state.status === 'idle' || state.status === 'joining' || (state.status === 'joined' && !plan && !loadError)) {
    return (
      <div className="tr-root mx-auto flex min-h-dvh w-full flex-col bg-[var(--tr-canvas)]" aria-busy="true">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pt-8">
          <div className="tr-skeleton h-6 w-48 rounded-full" />
          <div className="tr-skeleton h-10 w-full rounded-xl" />
          <div className="tr-skeleton h-28 w-full rounded-[var(--tr-radius-card)]" />
          <div className="tr-skeleton h-28 w-full rounded-[var(--tr-radius-card)]" />
          {/* Client may legitimately detect a non-en device locale here. */}
          <span className="sr-only" suppressHydrationWarning>
            {copy.loading}
          </span>
        </div>
      </div>
    );
  }

  if (state.status === 'error' || loadError || !plan) {
    return (
      <div className="tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-6">
        <div className="tr-card max-w-md px-5 py-6 text-center">
          <p className="tr-body text-[var(--tr-ink)]">{copy.joinError}</p>
        </div>
      </div>
    );
  }

  const roomHref = `/tour-mode/room/${encodeURIComponent(bookingId)}`;

  return (
    <div className="tr-root mx-auto min-h-dvh w-full bg-[var(--tr-canvas)] pb-28">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6">
        {/* header */}
        <header>
          <h1 className="tr-title text-[var(--tr-ink)]">{copy.title}</h1>
          <p className="tr-label mt-1 text-[var(--tr-ink-2)]">
            {plan.tour.date && (
              <>
                {copy.tourDay} <span className="font-semibold text-[var(--tr-ink)]">{plan.tour.date}</span>
                {plan.tour.total_hours ? ` · ${copy.courseHours(plan.tour.total_hours)}` : ''}
                {' · '}
              </>
            )}
            {copy.kstNote}
          </p>
        </header>

        {/* status banners */}
        {outcome === 'submitted' && (
          <div className="tr-card mt-4 border border-[var(--tr-safe)] px-4 py-3">
            <p className="tr-card-text font-medium text-[var(--tr-ink)]">{copy.submittedNote}</p>
            <a href={roomHref} className="tr-label mt-1 inline-block font-semibold text-[var(--tr-accent-deep)] underline">
              {copy.backToRoom}
            </a>
          </div>
        )}
        {outcome === 'delegated' && (
          <div className="tr-card mt-4 border border-[var(--tr-safe)] px-4 py-3">
            <p className="tr-card-text font-medium text-[var(--tr-ink)]">{copy.delegatedNote}</p>
            <a href={roomHref} className="tr-label mt-1 inline-block font-semibold text-[var(--tr-accent-deep)] underline">
              {copy.backToRoom}
            </a>
          </div>
        )}
        {isConfirmed && (
          <div className="tr-card mt-4 px-4 py-3">
            <p className="tr-card-text text-[var(--tr-ink)]">{copy.confirmedNote}</p>
          </div>
        )}
        {!plan.viewer.can_edit && !isConfirmed && !plan.viewer.is_lead && (
          <div className="tr-card mt-4 px-4 py-3">
            <p className="tr-card-text text-[var(--tr-ink-2)]">{copy.memberReadOnly}</p>
          </div>
        )}

        {/* tabs */}
        {canEdit && !isConfirmed && (
          <>
            <div role="tablist" className="mt-5 flex gap-1 rounded-xl bg-[var(--tr-surface-2)] p-1">
              {(
                [
                  ['courses', copy.tabCourses],
                  ['pick', copy.tabPick],
                  ['delegate', copy.tabDelegate],
                ] as Array<[EditorTab, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`tr-label flex-1 rounded-lg px-2 py-2 font-semibold transition-colors ${
                    tab === key
                      ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm'
                      : 'text-[var(--tr-ink-2)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* tab ① courses */}
            {tab === 'courses' && (
              <div className="mt-3 flex flex-col gap-2.5">
                {templates.map((template) => {
                  const title =
                    template.title_i18n?.[locale] || template.title_i18n?.en || Object.values(template.title_i18n ?? {})[0] || '';
                  const preview = toEditorStops(template.stops, locale)
                    .slice(0, 4)
                    .map((s) => s.title)
                    .join(' · ');
                  return (
                    <div key={template.id} className="tr-card px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="tr-card-text font-semibold text-[var(--tr-ink)]">{title}</p>
                          <p className="tr-label mt-0.5 truncate text-[var(--tr-ink-2)]">{preview}</p>
                          <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">
                            {copy.courseStops(template.stops?.length ?? 0)}
                            {template.total_hours ? ` · ${copy.courseHours(template.total_hours)}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => applyTemplate(template)}
                          className="tr-label shrink-0 rounded-full bg-[var(--tr-accent)] px-3.5 py-1.5 font-bold text-[var(--tr-bubble-me-ink)]"
                        >
                          {copy.useCourse}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* tab ② pick */}
            {tab === 'pick' && (
              <div className="mt-3">
                <input
                  type="search"
                  value={poiQuery}
                  onChange={(e) => setPoiQuery(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  className="tr-card-text w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
                />
                <div className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                  {filteredPois.map(({ poi, name, added }) => (
                    <div key={poi.poi_key} className="tr-card flex items-center gap-3 px-3 py-2">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--tr-surface-2)]">
                        {poi.default_image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={poi.default_image_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                            // Dead asset URLs degrade to the plain swatch, not a broken-image glyph.
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="tr-card-text truncate font-medium text-[var(--tr-ink)]">{name}</p>
                        <p className="tr-meta text-[var(--tr-ink-3)]">
                          {poi.category ?? ''}
                          {poi.default_stay_minutes ? ` · ${copy.minutes(poi.default_stay_minutes)}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => addPoiStop(poi)}
                        disabled={added}
                        className={`tr-label shrink-0 rounded-full px-3 py-1.5 font-bold ${
                          added
                            ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]'
                            : 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                        }`}
                      >
                        {added ? copy.added : copy.add}
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setGoogleOpen((v) => !v)}
                  className="tr-label mt-3 font-semibold text-[var(--tr-accent-deep)] underline"
                >
                  {copy.googleToggle}
                </button>
                {googleOpen && (
                  <div className="mt-2">
                    <GooglePlaceSearch
                      region={plan.tour.region}
                      placeholder={copy.googlePlaceholder}
                      loadingLabel={copy.googleLoading}
                      onPick={addGooglePick}
                    />
                  </div>
                )}
              </div>
            )}

            {/* tab ③ delegate */}
            {tab === 'delegate' && (
              <div className="tr-card mt-3 px-4 py-4">
                <p className="tr-card-text font-semibold text-[var(--tr-ink)]">{copy.delegateTitle}</p>
                <p className="tr-label mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">{copy.delegateDesc}</p>
                <button
                  onClick={() => void delegatePlan()}
                  className="tr-body mt-3 w-full rounded-xl bg-[var(--tr-accent)] px-4 py-2.5 font-bold text-[var(--tr-bubble-me-ink)]"
                >
                  {copy.delegateCta}
                </button>
              </div>
            )}
          </>
        )}

        {/* the day (shared stop editor / read-only list) */}
        {(stops.length > 0 || canEdit) && tab !== 'delegate' && (
          <section className="mt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="tr-body font-bold text-[var(--tr-ink)]">{copy.yourDay}</h2>
              {stops.length > 0 && (
                <span className="tr-meta text-[var(--tr-ink-3)]">{copy.estimated(formatMinutes(totalEstimateMin))}</span>
              )}
            </div>

            {stops.length === 0 ? (
              <p className="tr-label mt-2 text-[var(--tr-ink-2)]">{copy.emptyStops}</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-2">
                {stops.map((stop, index) => {
                  const stopWarnings = warnings.filter((w) => w.stop_id === stop.id);
                  return (
                    <li key={stop.id} className="tr-card px-3.5 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="tr-label mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] font-bold text-[var(--tr-ink-2)]">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="tr-card-text font-semibold text-[var(--tr-ink)]">
                            {stop.title}
                            {stop.source === 'google' && (
                              <span className="tr-meta ml-1.5 rounded bg-[var(--tr-surface-2)] px-1.5 py-0.5 text-[var(--tr-ink-3)]">
                                Google
                              </span>
                            )}
                          </p>
                          {canEdit ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <label className="tr-meta flex items-center gap-1 text-[var(--tr-ink-3)]">
                                {copy.timeLabel}
                                <input
                                  type="time"
                                  value={stop.arrival_planned ?? ''}
                                  onChange={(e) =>
                                    mutateStops((prev) =>
                                      prev.map((s) => (s.id === stop.id ? { ...s, arrival_planned: e.target.value || null } : s)),
                                    )
                                  }
                                  className="tr-label rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1 text-[var(--tr-ink)]"
                                />
                              </label>
                              <label className="tr-meta flex items-center gap-1 text-[var(--tr-ink-3)]">
                                {copy.durationLabel}
                                <select
                                  value={stop.duration_min ?? 60}
                                  onChange={(e) =>
                                    mutateStops((prev) =>
                                      prev.map((s) =>
                                        s.id === stop.id ? { ...s, duration_min: Number.parseInt(e.target.value, 10) } : s,
                                      ),
                                    )
                                  }
                                  className="tr-label rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1 text-[var(--tr-ink)]"
                                >
                                  {DURATION_OPTIONS.map((min) => (
                                    <option key={min} value={min}>
                                      {copy.minutes(min)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : (
                            <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">
                              {stop.arrival_planned ? `${stop.arrival_planned} · ` : ''}
                              {stop.duration_min ? copy.minutes(stop.duration_min) : ''}
                            </p>
                          )}
                          {canEdit && (
                            <input
                              type="text"
                              value={stop.memo_guest ?? ''}
                              onChange={(e) =>
                                mutateStops((prev) =>
                                  prev.map((s) => (s.id === stop.id ? { ...s, memo_guest: e.target.value } : s)),
                                )
                              }
                              placeholder={copy.memoPlaceholder}
                              maxLength={500}
                              className="tr-label mt-2 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
                            />
                          )}
                          {stopWarnings.map((w) => (
                            <p key={w.code} className="tr-meta mt-1.5 font-medium text-[var(--tr-danger)]">
                              ⚠{' '}
                              {w.code === 'closed'
                                ? copy.warnClosed(w.title ?? stop.title)
                                : copy.warnOutOfRegion(w.title ?? stop.title)}
                            </p>
                          ))}
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 flex-col items-center gap-1">
                            <button
                              aria-label={copy.moveUp}
                              disabled={index === 0}
                              onClick={() =>
                                mutateStops((prev) => {
                                  const next = [...prev];
                                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                  return next;
                                })
                              }
                              className="tr-label h-7 w-7 rounded-lg bg-[var(--tr-surface-2)] font-bold text-[var(--tr-ink-2)] disabled:opacity-40"
                            >
                              ↑
                            </button>
                            <button
                              aria-label={copy.moveDown}
                              disabled={index === stops.length - 1}
                              onClick={() =>
                                mutateStops((prev) => {
                                  const next = [...prev];
                                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                  return next;
                                })
                              }
                              className="tr-label h-7 w-7 rounded-lg bg-[var(--tr-surface-2)] font-bold text-[var(--tr-ink-2)] disabled:opacity-40"
                            >
                              ↓
                            </button>
                            <button
                              aria-label={copy.removeStop}
                              onClick={() => mutateStops((prev) => prev.filter((s) => s.id !== stop.id))}
                              className="tr-label h-7 w-7 rounded-lg bg-[var(--tr-surface-2)] font-bold text-[var(--tr-danger)]"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* plan-wide warnings (overrun) */}
            {warnings.some((w) => w.code === 'overrun') && plan.tour.total_hours && (
              <div className="tr-card mt-3 border border-[var(--tr-danger-soft,#f3d6d6)] px-4 py-3">
                <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-danger)]">{copy.warningsTitle}</p>
                {warnings
                  .filter((w) => w.code === 'overrun')
                  .map((w, i) => (
                    <p key={i} className="tr-label mt-1 text-[var(--tr-ink)]">
                      {copy.warnOverrun(
                        formatMinutes(Number(w.detail.over_min) || 0),
                        copy.courseHours(plan.tour.total_hours as number),
                      )}
                    </p>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* needs (A10) */}
        {canEdit && !isConfirmed && (
          <section className="tr-card mt-6 px-4 py-4">
            <h2 className="tr-body font-bold text-[var(--tr-ink)]">{copy.needsTitle}</h2>
            <p className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">{copy.needsHint}</p>

            <div className="mt-3 flex flex-wrap gap-3">
              <label className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
                {copy.adults}
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={needs.adults}
                  onChange={(e) => mutateNeeds({ adults: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
                  className="tr-label w-16 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1 text-[var(--tr-ink)]"
                />
              </label>
              <label className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
                {copy.children}
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={needs.children}
                  onChange={(e) => mutateNeeds({ children: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
                  className="tr-label w-16 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1 text-[var(--tr-ink)]"
                />
              </label>
              {needs.children > 0 && (
                <label className="tr-label flex items-center gap-2 text-[var(--tr-ink-2)]">
                  {copy.childAges}
                  <input
                    type="text"
                    value={needs.child_ages}
                    onChange={(e) => mutateNeeds({ child_ages: e.target.value })}
                    placeholder={copy.childAgesPlaceholder}
                    className="tr-label w-24 rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1 text-[var(--tr-ink)]"
                  />
                </label>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ['stroller', copy.stroller],
                  ['wheelchair', copy.wheelchair],
                  ['luggage', copy.luggage],
                ] as Array<['stroller' | 'wheelchair' | 'luggage', string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => mutateNeeds({ [key]: !needs[key] } as Partial<NeedsState>)}
                  aria-pressed={needs[key]}
                  className={`tr-label rounded-full border px-3 py-1.5 font-medium ${
                    needs[key]
                      ? 'border-[var(--tr-accent)] bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                      : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="tr-meta mt-3 font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">{copy.dietaryTitle}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {Object.entries(copy.dietary).map(([key, label]) => {
                const active = needs.dietary.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() =>
                      mutateNeeds({
                        dietary: active ? needs.dietary.filter((d) => d !== key) : [...needs.dietary, key],
                      })
                    }
                    aria-pressed={active}
                    className={`tr-label rounded-full border px-3 py-1.5 font-medium ${
                      active
                        ? 'border-[var(--tr-accent)] bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                        : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={needs.allergy_note}
              onChange={(e) => mutateNeeds({ allergy_note: e.target.value })}
              placeholder={copy.allergyPlaceholder}
              maxLength={300}
              className="tr-label mt-2 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
            />

            <p className="tr-meta mt-3 font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">{copy.paceTitle}</p>
            <div className="mt-1.5 flex gap-2">
              {(Object.entries(copy.pace) as Array<['relaxed' | 'standard' | 'packed', string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => mutateNeeds({ pace: key })}
                  aria-pressed={needs.pace === key}
                  className={`tr-label flex-1 rounded-full border px-3 py-1.5 font-medium ${
                    needs.pace === key
                      ? 'border-[var(--tr-accent)] bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                      : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <textarea
              value={needs.note}
              onChange={(e) => mutateNeeds({ note: e.target.value })}
              placeholder={copy.notePlaceholder}
              maxLength={500}
              rows={2}
              className="tr-label mt-3 w-full rounded-lg border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-1.5 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
            />
          </section>
        )}

        {/* W4.3 / F1 — the Korean restaurant card, derived live from needs. */}
        {(() => {
          const lines = koreanAllergyCardLines(needsPayload(needs));
          if (!lines) return null;
          return (
            <section className="tr-card mt-6 px-4 py-4" data-testid="allergy-card">
              <h2 className="tr-body font-bold text-[var(--tr-ink)]">{copy.allergyCardTitle}</h2>
              <p className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">{copy.allergyCardHint}</p>
              <div className="mt-3 rounded-xl border-2 border-[var(--tr-accent)] bg-[var(--tr-surface)] px-4 py-4">
                {lines.map((line, i) => (
                  <p
                    key={i}
                    className={
                      i === 0
                        ? 'text-[16px] font-bold leading-relaxed text-[var(--tr-ink)]'
                        : 'mt-1.5 text-[17px] font-semibold leading-relaxed text-[var(--tr-ink)]'
                    }
                  >
                    {line}
                  </p>
                ))}
              </div>
            </section>
          );
        })()}
      </div>

      {/* sticky submit bar */}
      {canEdit && !isConfirmed && tab !== 'delegate' && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 py-3">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
            <span className="tr-meta min-w-0 flex-1 truncate text-[var(--tr-ink-3)]" aria-live="polite">
              {saveState === 'saving' && copy.saving}
              {saveState === 'saved' && copy.saved}
              {saveState === 'error' && copy.saveError}
            </span>
            <button
              onClick={() => void submitPlan()}
              disabled={stops.length === 0 || saveState === 'saving'}
              className="tr-body shrink-0 rounded-xl bg-[var(--tr-accent)] px-5 py-2.5 font-bold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
            >
              {saveState === 'saving' ? copy.submitting : copy.submit}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
