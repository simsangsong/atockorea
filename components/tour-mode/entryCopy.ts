/**
 * Static entry-screen copy for Tour Mode, pre-translated in the 5 room
 * locales (LLM calls: zero — §M-2 ①). T1.8 migrates these into the
 * messages/*.json tourMode.* namespace; keeping them as constants here first
 * keeps the standalone entry route free of the site i18n shell (§O-1 ②).
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export interface EntryCopy {
  title: string;
  subtitle: string;
  comingSoon: string;
  myBookings: string;
  noBookings: string;
  signInHint: string;
  guestTitle: string;
  guestHint: string;
  bookingIdLabel: string;
  emailLabel: string;
  nameLabel: string;
  enterRoom: string;
  linkHint: string;
  loading: string;
  errorGeneric: string;
  errorNotFound: string;
}

export const ENTRY_COPY: Record<RoomLocale, EntryCopy> = {
  en: {
    title: 'Tour Mode',
    subtitle: 'Your live tour room — chat with your guide in your language, follow the route, and never miss a departure.',
    comingSoon: 'Tour Mode is getting ready. If you have a booking, your tour room link will arrive by email before your tour day.',
    myBookings: 'My upcoming tours',
    noBookings: 'No upcoming confirmed tours on this account.',
    signInHint: 'Signed-in customers see their tour rooms here.',
    guestTitle: 'Find my tour room',
    guestHint: 'Booked as a guest? Enter your booking ID and the email you used.',
    bookingIdLabel: 'Booking ID',
    emailLabel: 'Email used for the booking',
    nameLabel: 'Name (optional)',
    enterRoom: 'Enter tour room',
    linkHint: 'Got a room link from us? Just tap it — it opens the room directly.',
    loading: 'Loading…',
    errorGeneric: 'Could not open the room. Check the details and try again.',
    errorNotFound: 'No booking found for these details.',
  },
  ko: {
    title: '투어모드',
    subtitle: '실시간 투어룸 — 가이드와 내 언어로 대화하고, 동선을 확인하고, 출발 시간을 놓치지 마세요.',
    comingSoon: '투어모드를 준비 중입니다. 예약이 있으시면 투어 전에 이메일로 투어룸 링크를 보내드립니다.',
    myBookings: '다가오는 내 투어',
    noBookings: '이 계정에 예정된 확정 투어가 없습니다.',
    signInHint: '로그인한 고객은 여기에서 투어룸을 볼 수 있습니다.',
    guestTitle: '내 투어룸 찾기',
    guestHint: '비회원으로 예약하셨나요? 예약 ID와 예약에 사용한 이메일을 입력하세요.',
    bookingIdLabel: '예약 ID',
    emailLabel: '예약에 사용한 이메일',
    nameLabel: '이름 (선택)',
    enterRoom: '투어룸 입장',
    linkHint: '저희가 보낸 룸 링크가 있다면 그냥 누르세요 — 바로 열립니다.',
    loading: '불러오는 중…',
    errorGeneric: '룸을 열 수 없습니다. 정보를 확인하고 다시 시도해 주세요.',
    errorNotFound: '해당 정보의 예약을 찾을 수 없습니다.',
  },
  ja: {
    title: 'ツアーモード',
    subtitle: 'リアルタイムのツアールーム — ガイドと自分の言語で会話し、ルートを確認し、出発時刻を逃しません。',
    comingSoon: 'ツアーモードは準備中です。ご予約がある場合、ツアー前にメールでルームリンクをお送りします。',
    myBookings: '今後のツアー',
    noBookings: 'このアカウントに確定済みのツアーはありません。',
    signInHint: 'ログイン済みのお客様はここでツアールームを確認できます。',
    guestTitle: 'ツアールームを探す',
    guestHint: 'ゲストとして予約しましたか？予約IDと予約時のメールアドレスを入力してください。',
    bookingIdLabel: '予約ID',
    emailLabel: '予約時のメールアドレス',
    nameLabel: 'お名前（任意）',
    enterRoom: 'ルームに入る',
    linkHint: 'ルームリンクが届いていれば、タップするだけで直接開きます。',
    loading: '読み込み中…',
    errorGeneric: 'ルームを開けませんでした。情報を確認して再度お試しください。',
    errorNotFound: 'この情報の予約が見つかりません。',
  },
  es: {
    title: 'Modo Tour',
    subtitle: 'Tu sala de tour en vivo: chatea con tu guía en tu idioma, sigue la ruta y no pierdas ninguna salida.',
    comingSoon: 'El Modo Tour está en preparación. Si tienes una reserva, recibirás el enlace de tu sala por correo antes del tour.',
    myBookings: 'Mis próximos tours',
    noBookings: 'No hay tours confirmados próximos en esta cuenta.',
    signInHint: 'Los clientes con sesión iniciada ven sus salas aquí.',
    guestTitle: 'Encontrar mi sala de tour',
    guestHint: '¿Reservaste como invitado? Introduce tu ID de reserva y el correo que usaste.',
    bookingIdLabel: 'ID de reserva',
    emailLabel: 'Correo usado en la reserva',
    nameLabel: 'Nombre (opcional)',
    enterRoom: 'Entrar a la sala',
    linkHint: '¿Tienes un enlace de sala? Tócalo: abre la sala directamente.',
    loading: 'Cargando…',
    errorGeneric: 'No se pudo abrir la sala. Verifica los datos e inténtalo de nuevo.',
    errorNotFound: 'No se encontró ninguna reserva con estos datos.',
  },
  zh: {
    title: '导览模式',
    subtitle: '实时导览房间 — 用您的语言与导游交流，掌握路线，不错过任何出发时间。',
    comingSoon: '导览模式正在准备中。如果您有预订，出发前会通过电子邮件收到房间链接。',
    myBookings: '我即将出发的行程',
    noBookings: '此账户暂无已确认的行程。',
    signInHint: '已登录的顾客可在此查看导览房间。',
    guestTitle: '查找我的导览房间',
    guestHint: '以访客身份预订？请输入预订编号和预订时使用的邮箱。',
    bookingIdLabel: '预订编号',
    emailLabel: '预订时使用的邮箱',
    nameLabel: '姓名（选填）',
    enterRoom: '进入房间',
    linkHint: '收到我们发送的房间链接？直接点击即可打开。',
    loading: '加载中…',
    errorGeneric: '无法打开房间。请核对信息后重试。',
    errorNotFound: '未找到符合该信息的预订。',
  },
};

/** Best-effort UI locale for the standalone tour-mode pages (client only). */
export function detectEntryLocale(): RoomLocale {
  // SSR determinism: Node ≥21 exposes a global `navigator` whose language is
  // the SERVER's locale — letting it leak into server render hydration-
  // mismatches every guest whose device locale differs (QA: full-tree
  // regeneration on iPhone/Safari). Server always says 'en'.
  if (typeof window === 'undefined') return 'en';
  if (typeof document !== 'undefined') {
    const cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/)?.[1];
    const fromCookie = normalize(cookie);
    if (fromCookie) return fromCookie;
  }
  if (typeof navigator !== 'undefined') {
    const fromNavigator = normalize(navigator.language);
    if (fromNavigator) return fromNavigator;
  }
  return 'en';
}

function normalize(value: string | undefined | null): RoomLocale | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().split('-')[0];
  // §D A4.1 — 정본은 ROOM_LOCALES 하나다. 사본은 순서까지 달랐다.
  return ROOM_LOCALES.find((l) => l === base) ?? null;
}
