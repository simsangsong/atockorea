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
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Map as MapIcon,
  MapPin,
  Plus,
  Route,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { koreanAllergyCardLines } from '@/lib/tour-room/allergyCard';
import { formatMinutes, haversineKm, totalDriveMinutes, type LatLng } from '@/lib/itinerary-builder/distance';
import type { RoomLocale } from '@/lib/tour-room/snapshot';
import { useTourRoomSession } from '@/hooks/useTourRoomSession';
import PlanTourItinerary from '@/components/tour-mode/plan/PlanTourItinerary';
import PlanStopCards from '@/components/tour-mode/plan/PlanStopCards';
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';
import { MAX_PLAN_STOPS, tourStopToEditorStop } from '@/lib/tour-room/planTourStops';

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
  /** The tour this course was seeded from — its rich itineraryStops (photos +
   *  descriptions) power the course preview's tap-to-detail cards. */
  origin_tour_slug?: string | null;
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
    tabDelegate: 'Guide picks',
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

/**
 * Status + course-preview strings the PlanCopy blocks above don't carry.
 * Kept as its own 5-locale table (P-D10) — the previous single-locale English
 * fallback shipped "Preview course / Total / Driving / Loading…" untranslated
 * to every non-English guest.
 */
interface PlanStatusCopy {
  saveRateLimited: string;
  templatesLoading: string;
  templatesEmpty: string;
  templatesError: string;
  placesLoading: string;
  placesEmpty: string;
  placesError: string;
  googleError: string;
  previewCourse: string;
  previewTitle: string;
  previewStops: string;
  previewTotal: string;
  previewDriving: string;
  previewClose: string;
  replaceApply: string;
  cancel: string;
  tourItinTitle: string;
  tourItinSub: string;
  tourItinApplyAll: string;
  tourItinAdd: string;
  tourItinAdded: string;
  tourItinDetails: string;
}

const PLAN_STATUS_COPY: Record<RoomLocale, PlanStatusCopy> = {
  en: {
    saveRateLimited: 'Too many quick saves. Please wait a moment, then try again.',
    templatesLoading: 'Loading recommended courses…',
    templatesEmpty: 'No recommended courses are ready for this region yet.',
    templatesError: 'Recommended courses could not be loaded.',
    placesLoading: 'Loading places…',
    placesEmpty: 'No places match this search.',
    placesError: 'Places could not be loaded. You can still search Google Maps.',
    googleError: 'Google Maps search is unavailable right now.',
    previewCourse: 'Preview course',
    previewTitle: 'Course preview',
    previewStops: 'Stops',
    previewTotal: 'Total',
    previewDriving: 'Driving',
    previewClose: 'Close course preview',
    replaceApply: 'Replace',
    cancel: 'Cancel',
    tourItinTitle: 'This tour’s itinerary',
    tourItinSub: 'The route your guide runs. Add stops to your wish-list, or start from the whole course.',
    tourItinApplyAll: 'Start from this itinerary',
    tourItinAdd: 'Add',
    tourItinAdded: 'Added',
    tourItinDetails: 'Details',
  },
  ko: {
    saveRateLimited: '저장이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
    templatesLoading: '추천 코스를 불러오는 중…',
    templatesEmpty: '아직 이 지역의 추천 코스가 준비되지 않았어요.',
    templatesError: '추천 코스를 불러오지 못했어요.',
    placesLoading: '장소를 불러오는 중…',
    placesEmpty: '검색과 일치하는 장소가 없어요.',
    placesError: '장소를 불러오지 못했어요. Google 지도 검색은 계속 쓸 수 있어요.',
    googleError: '지금은 Google 지도 검색을 사용할 수 없어요.',
    previewCourse: '코스 미리보기',
    previewTitle: '코스 미리보기',
    previewStops: '장소',
    previewTotal: '총 시간',
    previewDriving: '이동',
    previewClose: '코스 미리보기 닫기',
    replaceApply: '대체',
    cancel: '취소',
    tourItinTitle: '이 투어의 일정',
    tourItinSub: '가이드가 안내하는 코스예요. 원하는 곳을 담거나, 이 일정으로 바로 시작해 보세요.',
    tourItinApplyAll: '이 일정으로 시작하기',
    tourItinAdd: '담기',
    tourItinAdded: '담김',
    tourItinDetails: '자세히',
  },
  ja: {
    saveRateLimited: '保存が頻繁すぎます。少し待ってから再試行してください。',
    templatesLoading: 'おすすめコースを読み込み中…',
    templatesEmpty: 'この地域のおすすめコースはまだありません。',
    templatesError: 'おすすめコースを読み込めませんでした。',
    placesLoading: 'スポットを読み込み中…',
    placesEmpty: '検索に一致するスポットがありません。',
    placesError: 'スポットを読み込めませんでした。Google マップ検索は引き続き使えます。',
    googleError: '現在、Google マップ検索は利用できません。',
    previewCourse: 'コースを見る',
    previewTitle: 'コースプレビュー',
    previewStops: 'スポット',
    previewTotal: '合計',
    previewDriving: '移動',
    previewClose: 'コースプレビューを閉じる',
    replaceApply: '置き換える',
    cancel: 'キャンセル',
    tourItinTitle: 'このツアーの行程',
    tourItinSub: 'ガイドが案内するコースです。気になるスポットを追加するか、この行程から始めましょう。',
    tourItinApplyAll: 'この行程で始める',
    tourItinAdd: '追加',
    tourItinAdded: '追加済み',
    tourItinDetails: '詳細',
  },
  zh: {
    saveRateLimited: '保存太频繁了。请稍候再试。',
    templatesLoading: '正在加载推荐路线…',
    templatesEmpty: '该地区暂无推荐路线。',
    templatesError: '无法加载推荐路线。',
    placesLoading: '正在加载景点…',
    placesEmpty: '没有匹配的景点。',
    placesError: '无法加载景点。您仍可使用 Google 地图搜索。',
    googleError: '当前无法使用 Google 地图搜索。',
    previewCourse: '预览路线',
    previewTitle: '路线预览',
    previewStops: '景点',
    previewTotal: '总计',
    previewDriving: '车程',
    previewClose: '关闭路线预览',
    replaceApply: '替换',
    cancel: '取消',
    tourItinTitle: '本次行程路线',
    tourItinSub: '导游将带您走的路线。可添加想去的景点，或直接以此行程开始。',
    tourItinApplyAll: '以此行程开始',
    tourItinAdd: '添加',
    tourItinAdded: '已添加',
    tourItinDetails: '详情',
  },
  es: {
    saveRateLimited: 'Demasiados guardados seguidos. Espera un momento e inténtalo de nuevo.',
    templatesLoading: 'Cargando rutas recomendadas…',
    templatesEmpty: 'Aún no hay rutas recomendadas para esta zona.',
    templatesError: 'No se pudieron cargar las rutas recomendadas.',
    placesLoading: 'Cargando lugares…',
    placesEmpty: 'No hay lugares que coincidan.',
    placesError: 'No se pudieron cargar los lugares. Aún puedes buscar en Google Maps.',
    googleError: 'La búsqueda de Google Maps no está disponible ahora.',
    previewCourse: 'Ver la ruta',
    previewTitle: 'Vista previa de la ruta',
    previewStops: 'Paradas',
    previewTotal: 'Total',
    previewDriving: 'Trayecto',
    previewClose: 'Cerrar la vista previa',
    replaceApply: 'Reemplazar',
    cancel: 'Cancelar',
    tourItinTitle: 'El itinerario de este tour',
    tourItinSub: 'La ruta que sigue tu guía. Añade paradas a tu lista o empieza con todo el itinerario.',
    tourItinApplyAll: 'Empezar con este itinerario',
    tourItinAdd: 'Añadir',
    tourItinAdded: 'Añadido',
    tourItinDetails: 'Detalles',
  },
};

// ---------------------------------------------------------------------------
// Google Places fallback search (tab ② — lazy: mounts only when expanded)
// ---------------------------------------------------------------------------

interface GooglePlaceHit {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

function GooglePlaceSearch({
  region,
  placeholder,
  loadingLabel,
  errorLabel,
  onPick,
}: {
  region: string | null;
  placeholder: string;
  loadingLabel: string;
  errorLabel: string;
  onPick: (pick: { place_id: string; name: string; lat: number; lng: number }) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GooglePlaceHit[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  // Debounced server-side Places (New) Text Search via /api/places/search — no
  // client-side Google Maps JS, so the browser referrer restriction on the
  // public key can't break it (and the legacy Autocomplete widget is retired).
  // setState routed through nested fns (react-hooks/set-state-in-effect guard).
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const apply = (r: GooglePlaceHit[], s: 'idle' | 'loading' | 'error') => {
      if (cancelled) return;
      setResults(r);
      setState(s);
    };
    if (q.length < 2) {
      apply([], 'idle');
      return;
    }
    const begin = () => {
      if (!cancelled) setState('loading');
    };
    begin();
    const timer = setTimeout(() => {
      fetch(`/api/places/search?q=${encodeURIComponent(q)}${region ? `&region=${encodeURIComponent(region)}` : ''}`)
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as { results?: GooglePlaceHit[] } | null;
          apply(body?.results ?? [], res.ok ? 'idle' : 'error');
        })
        .catch(() => apply([], 'error'));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, region]);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="text"
        placeholder={placeholder}
        className="tr-card-text w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
      />
      {state === 'loading' && <p className="tr-meta mt-1 px-1 text-[var(--tr-ink-3)]">{loadingLabel}</p>}
      {state === 'error' && (
        <p className="tr-label mt-1 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-danger)]">
          {errorLabel}
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
          {results.map((r) => (
            <li key={r.place_id} className="border-b border-[var(--tr-hairline)] last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onPickRef.current({ place_id: r.place_id, name: r.name, lat: r.lat, lng: r.lng });
                  setQuery('');
                  setResults([]);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left active:bg-[var(--tr-surface-2)]"
              >
                <span className="tr-card-text font-medium text-[var(--tr-ink)]">{r.name}</span>
                {r.address ? <span className="tr-meta text-[var(--tr-ink-3)]">{r.address}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type EditorTab = 'courses' | 'pick' | 'delegate';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'rate_limited';
type SaveExtra = { submit?: boolean };
interface DraftSnapshot {
  stops: EditorStop[];
  needs: NeedsState;
  stopsChanged?: boolean;
}

interface PlanSaveResponse {
  day_plan?: PlanResponse['day_plan'];
  feasibility?: { warnings?: FeasibilityWarning[] };
  error?: string;
}

export default function PlanEditorClient({ bookingId }: { bookingId: string }) {
  const { state, join, roomSession } = useTourRoomSession(bookingId);
  const attempted = useRef(false);
  const [locale, setLocale] = useState<RoomLocale>(() => detectLocale());
  const copy = COPY[locale];
  const ui = PLAN_STATUS_COPY[locale];

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [pois, setPois] = useState<PickerPoi[]>([]);
  const [templatesState, setTemplatesState] = useState<LoadState>('idle');
  const [poisState, setPoisState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState(false);

  const [tab, setTab] = useState<EditorTab>('courses');
  const [stops, setStops] = useState<EditorStop[]>([]);
  const [needs, setNeeds] = useState<NeedsState>(() => toNeedsState(null));
  const [warnings, setWarnings] = useState<FeasibilityWarning[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [outcome, setOutcome] = useState<'submitted' | 'delegated' | null>(null);
  const [poiQuery, setPoiQuery] = useState('');
  const [googleOpen, setGoogleOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<CourseTemplate | null>(null);
  const [replaceArmed, setReplaceArmed] = useState(false);
  // The previewed course's own rich itinerary (photos + descriptions), pulled
  // from its origin_tour_slug so the preview shows the same tap-to-detail stop
  // cards as the product page instead of bland text rows. Empty → text fallback.
  const [previewRichStops, setPreviewRichStops] = useState<ItineraryStop[]>([]);
  // §G tab ① — the BOOKED tour's own itinerary (rich stop cards + shared drawer).
  const [tourStops, setTourStops] = useState<ItineraryStop[]>([]);
  const [tourTitle, setTourTitle] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraft = useRef<DraftSnapshot>({ stops: [], needs });
  const submittingRef = useRef(false);

  useEffect(() => {
    latestDraft.current = { stops, needs, stopsChanged: latestDraft.current.stopsChanged };
  }, [stops, needs]);

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
        setTemplatesState('loading');
        setPoisState('loading');
        const [planRes, templatesRes] = await Promise.all([
          authedFetch('/plan'),
          authedFetch('/plan/templates'),
        ]);
        if (!planRes.ok) {
          setLoadError(true);
          return;
        }
        const planBody = (await planRes.json()) as PlanResponse;
        const loadedStops = toEditorStops(planBody.day_plan?.stops as Array<Record<string, unknown>>, locale);
        const loadedNeeds = toNeedsState(planBody.day_plan?.needs);
        latestDraft.current = { stops: loadedStops, needs: loadedNeeds };
        setPlan(planBody);
        setStops(loadedStops);
        setNeeds(loadedNeeds);
        setWarnings(planBody.day_plan?.feasibility?.warnings ?? []);
        if (planBody.day_plan?.status === 'guest_submitted') {
          setOutcome('submitted');
        } else if (planBody.tour.guide_curated) {
          setOutcome('delegated');
        } else {
          setOutcome(null);
        }
        if ((planBody.day_plan?.stops?.length ?? 0) > 0) setTab('pick');

        if (templatesRes.ok) {
          const body = (await templatesRes.json()) as { region: string | null; templates: CourseTemplate[] };
          setTemplates(body.templates ?? []);
          setTemplatesState('ready');
          if (body.region) {
            try {
              const poisRes = await fetch(`/api/itinerary-builder/pois?region=${body.region}`);
              if (!poisRes.ok) throw new Error(`pois_${poisRes.status}`);
              const poisBody = (await poisRes.json()) as { pois?: PickerPoi[] };
              setPois(poisBody.pois ?? []);
              setPoisState('ready');
            } catch {
              setPoisState('error');
            }
          } else {
            setPoisState('ready');
          }
        } else {
          setTemplatesState('error');
          setPoisState('ready');
        }

        // §G tab ① — the booked tour's own itinerary (best-effort: an absent
        // detail page or a load failure just leaves the generic templates).
        try {
          const itinRes = await authedFetch(`/tour-itinerary?locale=${locale}`);
          if (itinRes.ok) {
            const itinBody = (await itinRes.json()) as { stops?: ItineraryStop[]; tourTitle?: string | null };
            setTourStops(Array.isArray(itinBody.stops) ? itinBody.stops : []);
            setTourTitle(itinBody.tourTitle ?? null);
          }
        } catch {
          /* templates remain the fallback */
        }
      } catch {
        setLoadError(true);
      }
    })();
  }, [state.status, roomSession, authedFetch, locale]);

  const planStatus = plan?.day_plan?.status ?? null;
  const isSubmitted = outcome === 'submitted' || planStatus === 'guest_submitted';
  const canEdit = Boolean(plan?.viewer.can_edit) && !isSubmitted;
  const isConfirmed = planStatus !== null && planStatus !== 'guest_draft' && planStatus !== 'guest_submitted';

  // ── save (A2 auto-save, debounced) ────────────────────────────────────────
  const applySaveResponse = useCallback((data: PlanSaveResponse) => {
    if (data.day_plan) {
      setPlan((prev) => (prev ? { ...prev, day_plan: data.day_plan ?? prev.day_plan } : prev));
    }
    const nextWarnings = data.feasibility?.warnings ?? data.day_plan?.feasibility?.warnings;
    if (nextWarnings) setWarnings(nextWarnings);
    if (data.day_plan?.status === 'guest_submitted') setOutcome('submitted');
  }, []);

  const save = useCallback(
    async (draft: DraftSnapshot, extra?: SaveExtra) => {
      if (!plan?.viewer.can_edit) return null;
      setSaveState('saving');
      try {
        const body: Record<string, unknown> = {
          needs: needsPayload(draft.needs),
          stops: stopsPayload(draft.stops),
          ...(draft.stopsChanged ? { stops_changed: true } : {}),
          ...extra,
        };
        const res = await authedFetch('/plan', { method: 'PUT', body: JSON.stringify(body) });
        const data = (await res.json().catch(() => ({}))) as PlanSaveResponse;
        if (!res.ok) {
          setSaveState(res.status === 429 ? 'rate_limited' : 'error');
          return null;
        }
        applySaveResponse(data);
        if (draft.stopsChanged) {
          latestDraft.current = { ...latestDraft.current, stopsChanged: false };
        }
        setSaveState('saved');
        return data;
      } catch {
        setSaveState('error');
        return null;
      }
    },
    [applySaveResponse, authedFetch, plan?.viewer.can_edit],
  );

  const scheduleAutosave = useCallback((draft: DraftSnapshot) => {
    latestDraft.current = draft;
    setSaveState('dirty');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save(draft);
    }, 2500);
  }, [save]);

  // Best-effort flush of a pending debounced draft before the tab is
  // backgrounded, closed, or the planner is left (SPA nav) — otherwise a fast
  // "edit → leave" silently drops up to 2.5s of changes. keepalive lets the
  // request outlive the page. No-op when nothing is pending.
  const flushPending = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!plan?.viewer.can_edit || !roomSession) return;
    const draft = latestDraft.current;
    try {
      void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        body: JSON.stringify({
          needs: needsPayload(draft.needs),
          stops: stopsPayload(draft.stops),
          ...(draft.stopsChanged ? { stops_changed: true } : {}),
        }),
        keepalive: true,
      });
    } catch {
      /* best effort — the next explicit save still catches it */
    }
  }, [bookingId, roomSession, plan?.viewer.can_edit]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    window.addEventListener('pagehide', flushPending);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      document.removeEventListener('visibilitychange', onVisibility);
      flushPending();
    };
  }, [flushPending]);

  // ── mutations ─────────────────────────────────────────────────────────────
  const mutateStops = useCallback(
    (updater: (prev: EditorStop[]) => EditorStop[]) => {
      if (outcome === 'delegated') setOutcome(null);
      setStops((prev) => {
        const next = updater(prev);
        const draft = { stops: next, needs: latestDraft.current.needs, stopsChanged: true };
        latestDraft.current = draft;
        scheduleAutosave(draft);
        return next;
      });
    },
    [outcome, scheduleAutosave],
  );

  const mutateNeeds = useCallback(
    (patch: Partial<NeedsState>) => {
      setNeeds((prev) => {
        const next = { ...prev, ...patch };
        const draft = {
          stops: latestDraft.current.stops,
          needs: next,
          stopsChanged: latestDraft.current.stopsChanged,
        };
        latestDraft.current = draft;
        scheduleAutosave(draft);
        return next;
      });
    },
    [scheduleAutosave],
  );

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

  // App-style confirm lives in the preview sheet footer (setReplaceArmed) — no
  // jarring browser confirm() dialog (master plan §5.3).
  const applyTemplate = (template: CourseTemplate) => {
    const nextStops = toEditorStops(template.stops, locale);
    const draft = { stops: nextStops, needs: latestDraft.current.needs, stopsChanged: true };
    if (outcome === 'delegated') setOutcome(null);
    setStops(nextStops);
    setWarnings([]);
    setTab('pick');
    scheduleAutosave(draft);
  };

  // §G tab ① — adopt the whole booked-tour itinerary as the wish-list plan.
  const applyTourItinerary = () => {
    const nextStops = tourStops
      .map((s, i) => tourStopToEditorStop(s, s._poi_meta?.poi_key ? poiByKey.get(s._poi_meta.poi_key) : undefined, i))
      .slice(0, MAX_PLAN_STOPS);
    const draft = { stops: nextStops, needs: latestDraft.current.needs, stopsChanged: true };
    if (outcome === 'delegated') setOutcome(null);
    setStops(nextStops);
    setWarnings([]);
    setTab('pick');
    scheduleAutosave(draft);
  };

  // …or add a single itinerary stop (deduped by poi_key, capped at MAX_PLAN_STOPS).
  const addTourStop = (stop: ItineraryStop) => {
    const poi = stop._poi_meta?.poi_key ? poiByKey.get(stop._poi_meta.poi_key) : undefined;
    mutateStops((prev) => {
      if (stop._poi_meta?.poi_key && prev.some((s) => s.poi_key === stop._poi_meta?.poi_key)) return prev;
      if (prev.length >= MAX_PLAN_STOPS) return prev;
      return [...prev, tourStopToEditorStop(stop, poi, prev.length)];
    });
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    setReplaceArmed(false);
    setPreviewRichStops([]);
  };

  // Pull the previewed course's rich itinerary (its origin_tour_slug) so the
  // preview shows photo cards + tap→detail like the product page, not bland
  // text rows. Empty result → the text fallback below. setState routed through
  // a nested fn so the effect body has no direct setState (lint guard).
  useEffect(() => {
    const slug = previewTemplate?.origin_tour_slug?.trim();
    let cancelled = false;
    const apply = (rich: ItineraryStop[]) => {
      if (!cancelled) setPreviewRichStops(rich);
    };
    apply([]); // reset while the new course (if any) loads
    if (slug) {
      void (async () => {
        try {
          const res = await authedFetch(`/tour-itinerary?slug=${encodeURIComponent(slug)}&locale=${locale}`);
          if (res.ok) {
            const body = (await res.json()) as { stops?: ItineraryStop[] };
            apply(Array.isArray(body.stops) ? body.stops : []);
          }
        } catch {
          /* text fallback */
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [previewTemplate, authedFetch, locale]);

  const submitPlan = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitBusy(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const result = await save(latestDraft.current, { submit: true });
      if (result) setOutcome('submitted');
    } finally {
      submittingRef.current = false;
      setSubmitBusy(false);
    }
  };

  const delegatePlan = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    try {
      const res = await authedFetch('/plan', {
        method: 'PUT',
        body: JSON.stringify({ delegate: true, needs: needsPayload(latestDraft.current.needs) }),
      });
      const data = (await res.json().catch(() => ({}))) as PlanSaveResponse;
      if (res.ok) {
        applySaveResponse(data);
        setOutcome('delegated');
        setSaveState('saved');
      } else {
        setSaveState(res.status === 429 ? 'rate_limited' : 'error');
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

  const poiByKey = useMemo(() => new Map(pois.map((poi) => [poi.poi_key, poi])), [pois]);
  const previewStops = useMemo(
    () => (previewTemplate ? toEditorStops(previewTemplate.stops, locale) : []),
    [locale, previewTemplate],
  );
  const previewDriveMin = useMemo(() => {
    const points = previewStops
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number }));
    return totalDriveMinutes(points);
  }, [previewStops]);
  const previewStayMin = useMemo(
    () => previewStops.reduce((sum, stop) => sum + (stop.duration_min ?? 60), 0),
    [previewStops],
  );

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
  const tabItems: Array<[EditorTab, string, typeof Route]> = [
    ['courses', copy.tabCourses, Route],
    ['pick', copy.tabPick, MapPin],
    ['delegate', copy.tabDelegate, Sparkles],
  ];

  return (
    <div className="tr-root tr-plan-root mx-auto min-h-dvh w-full bg-[var(--tr-canvas)] pb-32" data-locale={locale}>
      <div className="mx-auto w-full max-w-xl px-4 pt-4">
        {/* header */}
        <header className="tr-plan-hero">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="tr-meta font-bold uppercase text-[var(--tr-plan-hero-muted)]">Smart guide planner</p>
              <h1 className="mt-1 text-[24px] font-bold leading-tight text-[var(--tr-plan-hero-ink)]">{copy.title}</h1>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[var(--tr-plan-hero-ink)]">
              <MapIcon size={21} aria-hidden />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {plan.tour.date && (
              <span className="tr-label inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 font-semibold text-[var(--tr-plan-hero-ink)]">
                <Clock3 size={14} aria-hidden />
                {copy.tourDay} {plan.tour.date}
              </span>
            )}
            {plan.tour.total_hours && (
              <span className="tr-label inline-flex min-h-9 items-center rounded-full bg-white/10 px-3 font-semibold text-[var(--tr-plan-hero-ink)]">
                {copy.courseHours(plan.tour.total_hours)}
              </span>
            )}
            <span className="tr-label inline-flex min-h-9 items-center rounded-full bg-white/10 px-3 text-[var(--tr-plan-hero-muted)]">
              {copy.kstNote}
            </span>
          </div>
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
        {saveState === 'rate_limited' && (
          <div className="tr-card mt-4 border border-[var(--tr-danger-soft)] px-4 py-3" role="status">
            <p className="tr-card-text font-medium text-[var(--tr-danger)]">{ui.saveRateLimited}</p>
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
            <div role="tablist" className="mt-5 grid grid-cols-3 gap-1 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-1 shadow-[var(--tr-plan-shadow-soft)]">
              {tabItems.map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`tr-label flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl px-2 text-center font-bold transition ${
                    tab === key
                      ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-plan-shadow-button)]'
                      : 'text-[var(--tr-ink-2)] hover:bg-[var(--tr-surface-2)]'
                  }`}
                >
                  <Icon size={14} strokeWidth={2.3} aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            {/* tab ① courses */}
            {tab === 'courses' && (
              <div className="mt-3 flex flex-col gap-3">
                <PlanTourItinerary
                  stops={tourStops}
                  locale={locale}
                  tourTitle={tourTitle}
                  canEdit
                  addedKeys={new Set(stops.map((s) => s.poi_key).filter(Boolean) as string[])}
                  labels={{
                    sectionTitle: ui.tourItinTitle,
                    sectionSub: ui.tourItinSub,
                    applyAll: ui.tourItinApplyAll,
                    add: ui.tourItinAdd,
                    added: ui.tourItinAdded,
                    details: ui.tourItinDetails,
                    stopsCount: copy.courseStops,
                  }}
                  onApplyAll={applyTourItinerary}
                  onAddStop={addTourStop}
                />
                {templatesState === 'loading' && (
                  <div className="tr-card px-4 py-4" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.templatesLoading}</p>
                  </div>
                )}
                {templatesState === 'error' && (
                  <div className="tr-card border border-[var(--tr-danger-soft)] px-4 py-4" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-danger)]">{ui.templatesError}</p>
                  </div>
                )}
                {templatesState === 'ready' && templates.length === 0 && (
                  <div className="tr-card px-4 py-4" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.templatesEmpty}</p>
                  </div>
                )}
                {templates.map((template, index) => {
                  const title =
                    template.title_i18n?.[locale] || template.title_i18n?.en || Object.values(template.title_i18n ?? {})[0] || '';
                  const preview = toEditorStops(template.stops, locale)
                    .slice(0, 4)
                    .map((s) => s.title)
                    .join(' · ');
                  return (
                    <article key={template.id} className="tr-card tr-plan-course-card px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
                          <Route size={19} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="tr-meta rounded-full bg-[var(--tr-surface-2)] px-2 py-0.5 font-bold text-[var(--tr-ink-3)]">
                              #{index + 1}
                            </span>
                            <span className="tr-meta font-semibold uppercase text-[var(--tr-accent-deep)]">{copy.tabCourses}</span>
                          </div>
                          <h2 className="mt-1 text-[16px] font-bold leading-snug text-[var(--tr-ink)]">{title}</h2>
                          {preview && (
                            <p className="tr-label tr-plan-line-clamp-2 mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">
                              {preview}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="tr-label inline-flex min-h-8 items-center rounded-full bg-[var(--tr-surface-2)] px-3 text-[var(--tr-ink-2)]">
                          {copy.courseStops(template.stops?.length ?? 0)}
                        </span>
                        {template.total_hours && (
                          <span className="tr-label inline-flex min-h-8 items-center gap-1 rounded-full bg-[var(--tr-surface-2)] px-3 text-[var(--tr-ink-2)]">
                            <Clock3 size={13} aria-hidden />
                            {copy.courseHours(template.total_hours)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(template)}
                        className="tr-body mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-plan-shadow-button)] transition active:scale-[0.99]"
                      >
                        <Search size={17} aria-hidden />
                        {ui.previewCourse}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            {/* tab ② pick */}
            {tab === 'pick' && (
              <div className="mt-3">
                <div className="relative">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tr-ink-3)]"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={poiQuery}
                    onChange={(e) => setPoiQuery(e.target.value)}
                    placeholder={copy.searchPlaceholder}
                    className="tr-card-text w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-10 py-3 text-[var(--tr-ink)] shadow-[var(--tr-plan-shadow-soft)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
                  />
                </div>
                {poisState === 'loading' && (
                  <div className="tr-card mt-2 px-4 py-3" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.placesLoading}</p>
                  </div>
                )}
                {poisState === 'error' && (
                  <div className="tr-card mt-2 border border-[var(--tr-danger-soft)] px-4 py-3" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-danger)]">{ui.placesError}</p>
                  </div>
                )}
                {poisState === 'ready' && filteredPois.length === 0 && (
                  <div className="tr-card mt-2 px-4 py-3" role="status">
                    <p className="tr-card-text font-medium text-[var(--tr-ink-2)]">{ui.placesEmpty}</p>
                  </div>
                )}
                <div className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
                  {filteredPois.map(({ poi, name, added }) => (
                    <div key={poi.poi_key} className="tr-card flex items-center gap-3 px-3 py-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-[var(--tr-surface-2)]">
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
                        type="button"
                        onClick={() => addPoiStop(poi)}
                        disabled={added}
                        className={`tr-label inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 font-bold ${
                          added
                            ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]'
                            : 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                        }`}
                      >
                        {added ? <CheckCircle2 size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
                        {added ? copy.added : copy.add}
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setGoogleOpen((v) => !v)}
                  className="tr-label mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--tr-accent-soft)] px-3 font-bold text-[var(--tr-accent-deep)]"
                >
                  <MapPin size={14} aria-hidden />
                  {copy.googleToggle}
                </button>
                {googleOpen && (
                  <div className="mt-2">
                    <GooglePlaceSearch
                      region={plan.tour.region}
                      placeholder={copy.googlePlaceholder}
                      loadingLabel={copy.googleLoading}
                      errorLabel={ui.googleError}
                      onPick={addGooglePick}
                    />
                  </div>
                )}
              </div>
            )}

            {/* tab ③ delegate */}
            {tab === 'delegate' && (
              <div className="tr-card mt-3 px-4 py-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
                  <Sparkles size={20} aria-hidden />
                </span>
                <p className="mt-3 text-[17px] font-bold leading-snug text-[var(--tr-ink)]">{copy.delegateTitle}</p>
                <p className="tr-card-text mt-1.5 leading-relaxed text-[var(--tr-ink-2)]">{copy.delegateDesc}</p>
                <button
                  type="button"
                  onClick={() => void delegatePlan()}
                  className="tr-body mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-plan-shadow-button)]"
                >
                  <Sparkles size={17} aria-hidden />
                  {copy.delegateCta}
                </button>
              </div>
            )}
          </>
        )}

        {/* the day (shared stop editor / read-only list) */}
        {(stops.length > 0 || canEdit) && tab !== 'delegate' && (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="tr-body flex items-center gap-2 font-bold text-[var(--tr-ink)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
                  <Route size={16} aria-hidden />
                </span>
                {copy.yourDay}
              </h2>
              {stops.length > 0 && (
                <span className="tr-meta rounded-full bg-[var(--tr-surface)] px-3 py-1.5 font-semibold text-[var(--tr-ink-3)] shadow-[var(--tr-plan-shadow-soft)]">
                  {copy.estimated(formatMinutes(totalEstimateMin))}
                </span>
              )}
            </div>

            {stops.length === 0 ? (
              <p className="tr-label mt-2 text-[var(--tr-ink-2)]">{copy.emptyStops}</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-2">
                {stops.map((stop, index) => {
                  const stopWarnings = warnings.filter((w) => w.stop_id === stop.id);
                  return (
                    <li key={stop.id} className="tr-card px-3.5 py-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="tr-label mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--tr-accent-soft)] font-bold text-[var(--tr-accent-deep)]">
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
                                  className="tr-label min-h-9 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 text-[var(--tr-ink)]"
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
                                  className="tr-label min-h-9 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 text-[var(--tr-ink)]"
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
                              className="tr-label mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
                            />
                          )}
                          {stopWarnings.map((w) => (
                            <p key={w.code} className="tr-meta mt-1.5 flex items-center gap-1 font-semibold text-[var(--tr-danger)]">
                              <AlertTriangle size={13} aria-hidden />
                              {w.code === 'closed'
                                ? copy.warnClosed(w.title ?? stop.title)
                                : copy.warnOutOfRegion(w.title ?? stop.title)}
                            </p>
                          ))}
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 flex-col items-center gap-1">
                            <button
                              type="button"
                              aria-label={copy.moveUp}
                              disabled={index === 0}
                              onClick={() =>
                                mutateStops((prev) => {
                                  const next = [...prev];
                                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                  return next;
                                })
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)] transition active:scale-95 disabled:opacity-40"
                            >
                              <ChevronUp size={17} aria-hidden />
                            </button>
                            <button
                              type="button"
                              aria-label={copy.moveDown}
                              disabled={index === stops.length - 1}
                              onClick={() =>
                                mutateStops((prev) => {
                                  const next = [...prev];
                                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                  return next;
                                })
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)] transition active:scale-95 disabled:opacity-40"
                            >
                              <ChevronDown size={17} aria-hidden />
                            </button>
                            <button
                              type="button"
                              aria-label={copy.removeStop}
                              onClick={() => mutateStops((prev) => prev.filter((s) => s.id !== stop.id))}
                              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--tr-danger-soft)] text-[var(--tr-danger)] transition active:scale-95"
                            >
                              <Trash2 size={16} aria-hidden />
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
            <h2 className="tr-body flex items-center gap-2 font-bold text-[var(--tr-ink)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
                <UserRound size={16} aria-hidden />
              </span>
              {copy.needsTitle}
            </h2>
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
                  className="tr-label min-h-9 w-16 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[var(--tr-ink)]"
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
                  className="tr-label min-h-9 w-16 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[var(--tr-ink)]"
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
                    className="tr-label min-h-9 w-24 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 text-[var(--tr-ink)]"
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
                  type="button"
                  key={key}
                  onClick={() => mutateNeeds({ [key]: !needs[key] } as Partial<NeedsState>)}
                  aria-pressed={needs[key]}
                  className={`tr-label min-h-10 rounded-full border px-3 font-medium ${
                    needs[key]
                      ? 'border-[var(--tr-accent)] bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                      : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="tr-meta mt-3 flex items-center gap-1.5 font-semibold uppercase text-[var(--tr-ink-3)]">
              <UtensilsCrossed size={13} aria-hidden />
              {copy.dietaryTitle}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {Object.entries(copy.dietary).map(([key, label]) => {
                const active = needs.dietary.includes(key);
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() =>
                      mutateNeeds({
                        dietary: active ? needs.dietary.filter((d) => d !== key) : [...needs.dietary, key],
                      })
                    }
                    aria-pressed={active}
                    className={`tr-label min-h-10 rounded-full border px-3 font-medium ${
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
              className="tr-label mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
            />

            <p className="tr-meta mt-3 font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">{copy.paceTitle}</p>
            <div className="mt-1.5 flex gap-2">
              {(Object.entries(copy.pace) as Array<['relaxed' | 'standard' | 'packed', string]>).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => mutateNeeds({ pace: key })}
                  aria-pressed={needs.pace === key}
                  className={`tr-label min-h-10 flex-1 rounded-full border px-3 font-medium ${
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
              className="tr-label mt-3 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
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

      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-0" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={ui.previewClose}
            className="absolute inset-0 cursor-default"
            onClick={closePreview}
          />
          <section className="relative max-h-[86dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] shadow-[var(--tr-shadow-overlay)]">
            <div className="sticky top-0 z-10 border-b border-[var(--tr-hairline)] bg-[var(--tr-surface)]/95 px-4 py-3 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-accent-deep)]">{ui.previewTitle}</p>
                  <h2 className="mt-0.5 text-[18px] font-bold leading-snug text-[var(--tr-ink)]">
                    {previewTemplate.title_i18n?.[locale] ||
                      previewTemplate.title_i18n?.en ||
                      Object.values(previewTemplate.title_i18n ?? {})[0] ||
                      copy.tabCourses}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={ui.previewClose}
                  onClick={closePreview}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]"
                >
                  <X size={17} aria-hidden />
                </button>
              </div>
            </div>

            <div className="px-4 pb-4 pt-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  [ui.previewStops, String(previewRichStops.length || previewStops.length)],
                  [
                    ui.previewTotal,
                    previewTemplate.total_hours
                      ? copy.courseHours(previewTemplate.total_hours)
                      : formatMinutes(previewStayMin + previewDriveMin),
                  ],
                  [ui.previewDriving, previewDriveMin > 0 ? formatMinutes(previewDriveMin) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3 py-2">
                    <p className="tr-meta font-bold uppercase tracking-wide text-[var(--tr-ink-3)]">{label}</p>
                    <p className="tr-label mt-0.5 truncate font-semibold text-[var(--tr-ink)]">{value}</p>
                  </div>
                ))}
              </div>

              {previewRichStops.length > 0 ? (
                // Rich itinerary from the course's origin_tour_slug — same photo
                // cards + tap→detail drawer as the product page (§ 사용자 요청).
                <div className="mt-4">
                  <PlanStopCards
                    stops={previewRichStops}
                    locale={locale}
                    canEdit={false}
                    labels={{ add: ui.tourItinAdd, added: ui.tourItinAdded, details: ui.tourItinDetails }}
                  />
                </div>
              ) : (
                <ol className="mt-4 flex flex-col gap-2">
                  {previewStops.map((stop, index) => {
                    const imageUrl = stop.poi_key ? poiByKey.get(stop.poi_key)?.default_image_url : null;
                    return (
                      <li key={stop.id} className="flex gap-3 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--tr-surface-2)]">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[var(--tr-ink-3)]">
                              <MapPin size={18} aria-hidden />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="tr-meta flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] font-bold text-[var(--tr-accent-deep)]">
                              {index + 1}
                            </span>
                            <p className="tr-card-text truncate font-bold text-[var(--tr-ink)]">{stop.title}</p>
                          </div>
                          <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">
                            {stop.duration_min ? copy.minutes(stop.duration_min) : copy.minutes(60)}
                            {stop.stop_type ? ` · ${stop.stop_type}` : ''}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="tr-safe-bottom sticky bottom-0 z-20 border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)]/95 px-4 py-3 backdrop-blur">
              {stops.length > 0 && replaceArmed ? (
                <div>
                  <p className="tr-label text-center font-medium text-[var(--tr-ink-2)]">{copy.replaceConfirm}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReplaceArmed(false)}
                      className="tr-body flex min-h-[50px] flex-1 items-center justify-center rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-4 font-bold text-[var(--tr-ink-2)]"
                    >
                      {ui.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyTemplate(previewTemplate);
                        closePreview();
                      }}
                      className="tr-body flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-plan-shadow-button)]"
                    >
                      <CheckCircle2 size={17} aria-hidden />
                      {ui.replaceApply}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (stops.length > 0) {
                      setReplaceArmed(true);
                    } else {
                      applyTemplate(previewTemplate);
                      closePreview();
                    }
                  }}
                  className="tr-body flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--tr-accent)] px-4 font-bold text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-plan-shadow-button)]"
                >
                  <CheckCircle2 size={17} aria-hidden />
                  {copy.useCourse}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* sticky submit bar */}
      {canEdit && !isConfirmed && tab !== 'delegate' && stops.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--tr-hairline)] bg-[var(--tr-surface)]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center gap-3">
            <span className="tr-label min-w-0 flex-1 truncate font-semibold text-[var(--tr-ink-3)]" aria-live="polite">
              {saveState === 'saving' && copy.saving}
              {saveState === 'saved' && copy.saved}
              {saveState === 'error' && copy.saveError}
              {saveState === 'rate_limited' && ui.saveRateLimited}
            </span>
            <button
              type="button"
              onClick={() => void submitPlan()}
              disabled={stops.length === 0 || saveState === 'saving' || submitBusy}
              className="tr-body flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--tr-accent)] px-5 font-bold text-[var(--tr-bubble-me-ink)] shadow-[var(--tr-plan-shadow-button)] disabled:opacity-50"
            >
              <Send size={17} aria-hidden />
              {saveState === 'saving' || submitBusy ? copy.submitting : copy.submit}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
