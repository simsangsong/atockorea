/**
 * §K B0.3b — 채널 중립 템플릿 렌더러.
 *
 * wa.me와 이메일이 **같은 변수 계약**을 쓴다. 지금까지는 wa.me가
 * `{guest_name}`·`{room_link}`를, 초대 메일이 `{guestName}`·`{inviteUrl}`를
 * 썼다 — 같은 것을 두 이름으로 부르는 상태였고, B0-D1b가 경고한 바로 그
 * 드리프트다. 문구를 고칠 때 한쪽만 고쳐지는 날이 반드시 온다.
 *
 * 🔴 이 파일이 **토큰 어휘의 단일 기준**이다. 새 변수는 여기 추가하고,
 * `TEMPLATE_TOKENS`에 올라오지 않은 토큰은 어느 채널에서도 치환되지 않는다.
 *
 * 채널별로 다른 것은 **링크뿐**이다: wa.me는 URL을 본문에 그대로 넣고,
 * 이메일은 같은 URL을 버튼으로 만든다. 문구와 변수는 공유한다.
 */

export interface MessageVars {
  guestName: string;
  tourName?: string | null;
  /** YYYY-MM-DD 또는 사람이 읽는 형식. */
  tourDate?: string | null;
  pickupPoint?: string | null;
  /** HH:MM */
  pickupTime?: string | null;
  /** 투어룸 링크 — B0.3 이후 **그 손님의 개인 링크**다. */
  roomLink?: string | null;
  /** 당일 패스/체크인 링크. */
  passLink?: string | null;
  operatorName?: string | null;
}

/**
 * 토큰 → 값 해석기. 이 표가 계약이다.
 *
 * 별칭(`{name}`·`{pass_url}` 등)은 kursoflow 포팅 호환으로 남긴다 — 기존
 * 템플릿 30개가 라이브에 시딩돼 있어서 지우면 그 문구들이 깨진다.
 */
export const TEMPLATE_TOKENS = {
  '{guest_name}': (v: MessageVars) => v.guestName,
  '{name}': (v: MessageVars) => v.guestName,
  '{tour_name}': (v: MessageVars) => v.tourName ?? '',
  '{tour_date}': (v: MessageVars) => v.tourDate ?? '',
  '{pickup_point}': (v: MessageVars) => v.pickupPoint ?? '',
  '{pickup_time}': (v: MessageVars) => v.pickupTime ?? '',
  '{pickup}': (v: MessageVars) =>
    v.pickupPoint ? `${v.pickupPoint}${v.pickupTime ? ` ${v.pickupTime}` : ''}` : '',
  '{room_link}': (v: MessageVars) => v.roomLink ?? '',
  '{pass_link}': (v: MessageVars) => v.passLink ?? '',
  '{pass_url}': (v: MessageVars) => v.passLink ?? '',
  '{operator}': (v: MessageVars) => v.operatorName ?? 'AtoC Korea',
} as const satisfies Record<string, (v: MessageVars) => string>;

export type TemplateToken = keyof typeof TEMPLATE_TOKENS;

export const TEMPLATE_TOKEN_LIST = Object.keys(TEMPLATE_TOKENS) as TemplateToken[];

/**
 * 본문의 {변수}를 채운다.
 *
 * 🔴 **모르는 토큰은 그대로 둔다.** 조용히 지우면 운영자는 문구가 멀쩡해 보이는
 * 채로 정보가 빠진 메시지를 보내게 된다. 미리보기에 `{typo_here}`가 그대로
 * 보이는 편이 훨씬 낫다 — 고치라는 신호다.
 */
export function renderTemplate(body: string, vars: MessageVars): string {
  let out = body;
  for (const [token, resolve] of Object.entries(TEMPLATE_TOKENS)) {
    out = out.replaceAll(token, resolve(vars as MessageVars));
  }
  return out;
}

/** 본문에 실제로 등장하는 계약 토큰 (미리보기·검증용). */
export function tokensUsed(body: string): TemplateToken[] {
  return TEMPLATE_TOKEN_LIST.filter((t) => body.includes(t));
}

/**
 * 계약에 없는 `{...}` 토큰. 템플릿 편집 화면이 "이건 안 채워집니다"라고
 * 말할 수 있어야 한다.
 */
export function unknownTokens(body: string): string[] {
  const found = body.match(/\{[a-z0-9_]+\}/gi) ?? [];
  return [...new Set(found.filter((t) => !(t in TEMPLATE_TOKENS)))];
}

/**
 * 채우지 못한 필수 변수. 발송 전 게이트에 쓴다 — 링크 자리가 빈 채로 나가는
 * 메시지가 가장 흔한 사고다.
 */
export function missingRequired(body: string, vars: MessageVars): TemplateToken[] {
  return tokensUsed(body).filter((token) => !TEMPLATE_TOKENS[token](vars).trim());
}
