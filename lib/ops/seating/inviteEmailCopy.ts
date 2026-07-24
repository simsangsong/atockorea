/**
 * 조인투어 룸 초대 이메일 5로케일 문구 — AtoC 통합 플랜 §4.2① + §5.1.
 *
 * §K B0.3 이후 이 메일이 나르는 것은 공유 claim 링크가 아니라 **그 손님의
 * 개인 룸 링크**다. 문구도 그에 맞춰 고쳤다 — "명단에서 이름을 선택"은 이제
 * 존재하지 않는 화면을 설명한다.
 *
 * joinCopy.ts와 동일 캡슐 규약: 사전 번역 상수만(LLM 0), ROOM_LOCALES 기준,
 * 미지원 로케일은 en 폴백. 여기서만 이메일 본문(제목 + HTML + 텍스트)을 만든다
 * — joinCopy를 부풀리지 않기 위해 별도 파일. HTML은 인라인 스타일 + 모바일
 * 폭 대응(테이블 없이 max-width 480px 카드), 변수는 전부 이스케이프한다.
 */

import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';

export interface InviteEmailVars {
  guestName: string;
  tourTitle: string;
  tourDate: string;
  inviteUrl: string;
}

export interface InviteEmailContent {
  subject: string;
  html: string;
  text: string;
}

type CopyKey = 'subject' | 'greeting' | 'intro' | 'what' | 'cta' | 'fallback' | 'closing' | 'signoff';

/** 사전 번역 캡슐 — {guestName}/{tourTitle}/{tourDate} 치환 자리. */
const COPY: Record<CopyKey, Record<RoomLocale, string>> = {
  subject: {
    en: 'Join your tour group — {tourTitle}',
    ko: '조인투어 참여 안내 — {tourTitle}',
    zh: '加入您的行程群组 — {tourTitle}',
    ja: 'ツアーグループへの参加 — {tourTitle}',
    es: 'Únase a su grupo de tour — {tourTitle}',
  },
  greeting: {
    en: 'Hi {guestName},',
    ko: '{guestName}님, 안녕하세요.',
    zh: '您好，{guestName}：',
    ja: '{guestName}様、こんにちは。',
    es: 'Hola {guestName}:',
  },
  intro: {
    en: "You're confirmed for {tourTitle} on {tourDate}. Tap the button below to open your tour room.",
    ko: '{tourDate} {tourTitle} 예약이 확정되었습니다. 아래 버튼을 눌러 투어룸을 열어보세요.',
    zh: '您已确认参加 {tourDate} 的{tourTitle}。请点击下方按钮打开您的行程群组。',
    ja: '{tourDate}の{tourTitle}のご予約が確定しました。下のボタンからツアールームを開いてください。',
    es: 'Su reserva para {tourTitle} el {tourDate} está confirmada. Toque el botón de abajo para abrir su sala de tour.',
  },
  // §K B0.3 — 이 문구는 claim 단계를 설명하던 것이었다("명단에서 본인 이름을
  // 선택"). 개인 링크 전환 이후 그 화면은 **존재하지 않는다** — 문구를 그대로
  // 두면 이메일이 없는 절차를 지시하고, 손님은 나타나지 않는 명단을 찾는다.
  what: {
    en: 'The link below is yours alone — it opens your tour room straight away, with no name to pick. You can choose your seat for the day inside.',
    ko: '아래 링크는 본인 전용입니다. 이름을 고르실 필요 없이 바로 투어룸이 열리고, 좌석은 그 안에서 선택하시면 됩니다.',
    zh: '下方链接为您专属，无需选择姓名即可直接打开您的行程群组，座位可在其中选择。',
    ja: '下のリンクはお客様専用です。お名前を選ぶ必要はなく、そのままツアールームが開きます。座席はその中でお選びいただけます。',
    es: 'El enlace de abajo es solo suyo: abre directamente su sala de tour, sin tener que elegir su nombre. Puede elegir su asiento allí.',
  },
  cta: {
    en: 'Open your tour room',
    ko: '내 투어룸 열기',
    zh: '打开我的行程群组',
    ja: 'ツアールームを開く',
    es: 'Abrir su sala de tour',
  },
  fallback: {
    en: "If the button doesn't work, open this link:",
    ko: '버튼이 열리지 않으면 이 링크를 여세요:',
    zh: '如果按钮无法使用，请打开此链接：',
    ja: 'ボタンが動作しない場合は、このリンクを開いてください：',
    es: 'Si el botón no funciona, abra este enlace:',
  },
  closing: {
    en: 'See you on the tour!',
    ko: '투어에서 만나요!',
    zh: '期待与您同行！',
    ja: 'ツアーでお会いしましょう！',
    es: '¡Nos vemos en el tour!',
  },
  signoff: {
    en: 'AtoC Korea',
    ko: 'AtoC Korea',
    zh: 'AtoC Korea',
    ja: 'AtoC Korea',
    es: 'AtoC Korea',
  },
};

/** 로케일 정규화 — 미지원이면 en. */
export function resolveInviteLocale(raw?: string | null): RoomLocale {
  const base = (raw ?? 'en').toLowerCase().split('-')[0];
  return (ROOM_LOCALES as readonly string[]).includes(base) ? (base as RoomLocale) : 'en';
}

function line(key: CopyKey, locale: RoomLocale, vars: Record<string, string> = {}): string {
  let text = COPY[key][locale] ?? COPY[key].en;
  for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, v);
  return text;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * (제목 + HTML + 텍스트) 이메일 본문을 만든다. 미지원 로케일은 en 폴백.
 * inviteUrl은 href/텍스트 양쪽에 이스케이프해 넣는다(주입 방지).
 */
export function buildInviteEmail(rawLocale: string | null | undefined, vars: InviteEmailVars): InviteEmailContent {
  const locale = resolveInviteLocale(rawLocale);
  const guestName = (vars.guestName || '').trim() || (locale === 'ko' ? '손님' : 'Guest');
  const interp = { guestName, tourTitle: vars.tourTitle, tourDate: vars.tourDate };

  const subject = line('subject', locale, interp);
  const greeting = line('greeting', locale, interp);
  const intro = line('intro', locale, interp);
  const what = line('what', locale, interp);
  const cta = line('cta', locale, interp);
  const fallback = line('fallback', locale, interp);
  const closing = line('closing', locale, interp);
  const signoff = line('signoff', locale, interp);

  const url = vars.inviteUrl;
  const safeUrl = escapeHtml(url);

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ee;">
  <div style="max-width:480px;margin:0 auto;padding:28px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2430;">
    <div style="background:#ffffff;border:1px solid #e7e0d4;border-radius:14px;padding:26px 22px;">
      <p style="margin:0 0 14px;font-size:15px;line-height:22px;font-weight:700;color:#111827;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:22px;color:#374151;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 22px;font-size:14px;line-height:22px;color:#374151;">${escapeHtml(what)}</p>
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${safeUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 24px;font-size:15px;font-weight:700;line-height:18px;">${escapeHtml(cta)}</a>
      </div>
      <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#6b7280;">${escapeHtml(fallback)}</p>
      <p style="margin:0 0 20px;font-size:12px;line-height:18px;word-break:break-all;"><a href="${safeUrl}" style="color:#2563eb;text-decoration:underline;">${safeUrl}</a></p>
      <p style="margin:0;font-size:14px;line-height:22px;color:#374151;">${escapeHtml(closing)}</p>
      <p style="margin:6px 0 0;font-size:13px;line-height:20px;font-weight:700;color:#111827;">${escapeHtml(signoff)}</p>
    </div>
  </div>
</body>
</html>`;

  const text = [greeting, '', intro, '', what, '', `${cta}: ${url}`, '', closing, signoff].join('\n');

  return { subject, html, text };
}
