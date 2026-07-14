/**
 * T5.2 — Tour Mode invite emails.
 *
 * Customer: "your tour room is ready" — one button, three how-to lines,
 * 5 locales (the link itself is the room key; no login, §O-1 ①).
 * Guide: bilingual ko/en dispatch mail with the tour-date link + a QR image
 * (hosted PNG — data: URIs are stripped by Gmail) for on-site walk-up entry.
 *
 * Styling: solid light card + `color-scheme: light dark` meta; every color is
 * inlined so dark-mode clients that invert backgrounds keep the text legible.
 */

export type InviteLocale = 'en' | 'ko' | 'ja' | 'es' | 'zh';

const CUSTOMER_COPY: Record<
  InviteLocale,
  {
    subject: (tour: string) => string;
    greeting: (name: string) => string;
    intro: string;
    cta: string;
    how: [string, string, string];
    keep: string;
    homescreen: string;
  }
> = {
  en: {
    subject: (tour) => `Your tour room is ready — ${tour}`,
    greeting: (name) => `Hi ${name},`,
    intro:
      'Your live tour room is open. Chat with your guide in your own language, see the meeting plan, and get arrival guides on tour day — all from one link, no app, no login.',
    cta: 'Open my tour room',
    how: [
      'Tap the button — the room opens right away.',
      'Messages you send are translated for your guide automatically.',
      'On tour morning, the room shows your pickup and the bus on a map.',
    ],
    keep: 'Keep this email — the same link works all day on tour day.',
    homescreen: 'Tip: after opening the room, add it to your home screen (share → "Add to Home Screen") for one-tap access on tour day.',
  },
  ko: {
    subject: (tour) => `투어룸이 준비됐어요 — ${tour}`,
    greeting: (name) => `${name}님, 안녕하세요!`,
    intro:
      '실시간 투어룸이 열렸어요. 가이드와 내 언어로 대화하고, 집합 안내를 확인하고, 투어 당일 도착 가이드를 받아보세요 — 링크 하나면 됩니다. 앱 설치도, 로그인도 없어요.',
    cta: '내 투어룸 열기',
    how: [
      '버튼을 누르면 바로 룸이 열려요.',
      '보내는 메시지는 가이드의 언어로 자동 번역돼요.',
      '투어 아침에는 픽업 안내와 버스 위치를 지도로 볼 수 있어요.',
    ],
    keep: '이 메일을 보관해 주세요 — 투어 당일 하루 종일 같은 링크로 입장할 수 있어요.',
    homescreen: '팁: 룸을 연 뒤 홈 화면에 추가(공유 → "홈 화면에 추가")하면 투어 당일 한 번의 탭으로 들어올 수 있어요.',
  },
  ja: {
    subject: (tour) => `ツアールームのご案内 — ${tour}`,
    greeting: (name) => `${name}様`,
    intro:
      'ライブツアールームが開きました。ガイドと母国語でチャットし、集合案内を確認し、当日は到着ガイドを受け取れます — リンク1つで、アプリもログインも不要です。',
    cta: 'ツアールームを開く',
    how: [
      'ボタンをタップするとすぐにルームが開きます。',
      '送ったメッセージはガイドの言語に自動翻訳されます。',
      'ツアー当日の朝は、お迎え案内とバスの位置を地図で確認できます。',
    ],
    keep: 'このメールは保管してください — 当日は同じリンクで何度でも入室できます。',
    homescreen: 'ヒント：ルームを開いたら、ホーム画面に追加（共有 →「ホーム画面に追加」）すると当日ワンタップで入室できます。',
  },
  es: {
    subject: (tour) => `Tu sala de tour está lista — ${tour}`,
    greeting: (name) => `Hola ${name}:`,
    intro:
      'Tu sala de tour en vivo está abierta. Chatea con tu guía en tu idioma, revisa el punto de encuentro y recibe guías de llegada el día del tour — todo con un enlace, sin app ni registro.',
    cta: 'Abrir mi sala de tour',
    how: [
      'Toca el botón — la sala se abre al instante.',
      'Tus mensajes se traducen automáticamente para tu guía.',
      'La mañana del tour verás tu recogida y el bus en el mapa.',
    ],
    keep: 'Guarda este correo — el mismo enlace funciona todo el día del tour.',
    homescreen: 'Consejo: tras abrir la sala, añádela a tu pantalla de inicio (compartir → "Añadir a pantalla de inicio") para entrar con un toque el día del tour.',
  },
  zh: {
    subject: (tour) => `您的旅行房间已就绪 — ${tour}`,
    greeting: (name) => `${name}，您好！`,
    intro:
      '实时旅行房间已开启。用您的语言与导游聊天、查看集合安排，旅行当天还能收到到达讲解 — 一个链接搞定，无需安装应用或登录。',
    cta: '打开我的旅行房间',
    how: ['点击按钮即可进入房间。', '您发送的消息会自动翻译给导游。', '旅行当天早上可在地图上查看接送安排和大巴位置。'],
    keep: '请保留此邮件 — 旅行当天同一链接可随时进入。',
    homescreen: '小贴士：打开房间后，将其添加到主屏幕（分享 → "添加到主屏幕"），旅行当天一键进入。',
  },
};

const CARD_STYLE =
  'max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,sans-serif;';
const BTN_STYLE =
  'display:inline-block;background:#f59e0b;color:#ffffff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;text-decoration:none;';

function shell(inner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>
<body style="margin:0;padding:24px 12px;background:#f5f4f0;">
${inner}
</body></html>`;
}

export function buildCustomerRoomInviteHtml(params: {
  locale: InviteLocale;
  customerName: string;
  tourTitle: string;
  tourDate: string;
  tourTime?: string | null;
  pickupName?: string | null;
  pickupTime?: string | null;
  roomUrl: string;
}): { subject: string; html: string } {
  const copy = CUSTOMER_COPY[params.locale] ?? CUSTOMER_COPY.en;
  const meta = [
    `📅 ${params.tourDate}${params.tourTime ? ` · ${String(params.tourTime).slice(0, 5)}` : ''}`,
    params.pickupName
      ? `🚌 ${params.pickupName}${params.pickupTime ? ` · ${String(params.pickupTime).slice(0, 5)}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .map(
      (line) =>
        `<p style="margin:4px 0;color:#374151;font-size:14px;">${line}</p>`,
    )
    .join('');

  const html = shell(`
<div style="${CARD_STYLE}">
  <div style="background:#111827;padding:20px 24px;">
    <p style="margin:0;color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:.08em;">ATOC KOREA · TOUR MODE</p>
    <p style="margin:6px 0 0;color:#ffffff;font-size:19px;font-weight:700;">${params.tourTitle}</p>
  </div>
  <div style="padding:24px;">
    <p style="margin:0 0 10px;color:#111827;font-size:15px;font-weight:600;">${copy.greeting(params.customerName)}</p>
    <p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.65;">${copy.intro}</p>
    ${meta}
    <div style="text-align:center;margin:22px 0;">
      <a href="${params.roomUrl}" style="${BTN_STYLE}">${copy.cta}</a>
    </div>
    <ol style="margin:0 0 14px;padding-left:20px;color:#4b5563;font-size:13px;line-height:1.8;">
      ${copy.how.map((line) => `<li>${line}</li>`).join('')}
    </ol>
    <p style="margin:0 0 6px;color:#9ca3af;font-size:12px;">${copy.keep}</p>
    <p style="margin:0;color:#9ca3af;font-size:12px;">${copy.homescreen}</p>
  </div>
</div>`);

  return { subject: copy.subject(params.tourTitle), html };
}

export function buildGuideRoomInviteHtml(params: {
  tourTitle: string;
  tourDate: string;
  roomCount: number;
  guideUrl: string;
  qrImageUrl?: string | null;
}): { subject: string; html: string } {
  const html = shell(`
<div style="${CARD_STYLE}">
  <div style="background:#111827;padding:20px 24px;">
    <p style="margin:0;color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:.08em;">ATOC KOREA · 가이드 투어룸 / GUIDE TOUR ROOM</p>
    <p style="margin:6px 0 0;color:#ffffff;font-size:19px;font-weight:700;">${params.tourTitle}</p>
    <p style="margin:4px 0 0;color:#d1d5db;font-size:13px;">${params.tourDate} · 예약 ${params.roomCount}건 / ${params.roomCount} booking(s)</p>
  </div>
  <div style="padding:24px;">
    <p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.65;">
      투어 당일 손님들과의 실시간 채팅·자막 방송·위치 공유가 이 링크 하나로 열립니다. 이 링크는 <b>해당 투어일의 모든 예약</b>에 입장할 수 있어요.<br>
      <span style="color:#6b7280;">One link opens live chat, caption broadcast, and location sharing with every booking on this tour date.</span>
    </p>
    <div style="text-align:center;margin:20px 0;">
      <a href="${params.guideUrl}" style="${BTN_STYLE}">가이드 룸 열기 / Open guide room</a>
    </div>
    ${
      params.qrImageUrl
        ? `<div style="text-align:center;margin:16px 0;">
      <img src="${params.qrImageUrl}" alt="QR" width="140" height="140" style="border:1px solid #e5e7eb;border-radius:12px;" />
      <p style="margin:8px 0 0;color:#6b7280;font-size:12px;">현장에서 손님 폰으로 이 QR을 스캔하면 바로 입장합니다.<br>Guests can scan this on site to enter instantly.</p>
    </div>`
        : ''
    }
    <p style="margin:0;color:#9ca3af;font-size:12px;">링크가 유출되면 운영팀에 재발송을 요청하세요 — 이전 링크는 즉시 폐기됩니다. / If the link leaks, ask ops to re-dispatch; the old link is revoked immediately.</p>
  </div>
</div>`);

  return {
    subject: `[가이드] ${params.tourDate} ${params.tourTitle} — 투어룸 링크 / Guide tour-room link`,
    html,
  };
}
