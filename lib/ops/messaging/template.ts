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
  /**
   * M1 — 다음날 예보 한 줄('맑음 12–19°C'). 예보를 못 가져왔으면 **넣지 않는다**:
   * 빈 값이면 아래 `stripEmptyLines`가 그 줄을 통째로 지운다. 지어낸 날씨는 최악이다.
   */
  weather?: string | null;
  /** M1 — 착장 안내 한두 문장. */
  clothing?: string | null;
  /**
   * 크루즈 D-1 (docs/cruise-jeju-shore-excursion-2026.md) — 그날 기항에서
   * 자동으로 채워진다(`cruise_calls`). 스케줄이 안 잡히면 **넣지 않는다**:
   * cruise_d1 템플릿의 토큰이 missing 배지로 남아 운영자가 배를 고르게 된다.
   */
  cruiseShip?: string | null;
  /** HH:MM (KST) */
  cruiseArrive?: string | null;
  cruiseDepart?: string | null;
  /** 출항 60분 전 — 손님에게 약속하는 복귀 시각. */
  cruiseReturnBy?: string | null;
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
  '{weather}': (v: MessageVars) => v.weather ?? '',
  '{clothing}': (v: MessageVars) => v.clothing ?? '',
  '{cruise_ship}': (v: MessageVars) => v.cruiseShip ?? '',
  '{cruise_arrive}': (v: MessageVars) => v.cruiseArrive ?? '',
  '{cruise_depart}': (v: MessageVars) => v.cruiseDepart ?? '',
  '{cruise_return_by}': (v: MessageVars) => v.cruiseReturnBy ?? '',
} as const satisfies Record<string, (v: MessageVars) => string>;

/**
 * M1 — 값이 없어 빈 껍데기만 남은 줄을 지운다.
 *
 * `날씨: {weather}` 가 `날씨: ` 로 나가면 손님은 우리가 뭔가를 빠뜨렸다고 읽는다.
 * 그래서 **치환 후 그 줄의 토큰이 전부 비었으면 줄을 통째로 없앤다.**
 *
 * 🔴 `renderTemplate` 안에 넣지 않는 이유: 기존 계약은 "빈 토큰 = 빈 문자열을
 * 제자리에"이고(`[{room_link}]` → `[]`), 그 계약에 기대는 템플릿이 이미 라이브에
 * 있다. 줄 삭제는 **날씨처럼 없을 수도 있는 선택 정보**에만 적용하는 별도 단계다.
 * 호출부: `lib/ops/messaging/guestMessage.ts`.
 */
export function stripEmptyTokenLines(rendered: string, original: string, vars: MessageVars): string {
  const originalLines = original.split('\n');
  const renderedLines = rendered.split('\n');
  if (originalLines.length !== renderedLines.length) return rendered;

  const kept = renderedLines.filter((line, i) => {
    const source = originalLines[i];
    const tokens = tokensUsed(source);
    if (tokens.length === 0) return true;
    // 이 줄의 토큰이 전부 비었는가 → 남은 건 라벨뿐이므로 줄을 버린다.
    const allEmpty = tokens.every((t) => !TEMPLATE_TOKENS[t](vars).trim());
    return !allEmpty;
  });

  // 줄을 지우면서 생긴 연속 빈 줄을 하나로 접는다.
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

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
