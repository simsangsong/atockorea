// AtoC 통합 Phase 2 — WhatsApp Click-to-Chat deep link builder.
// Ported from kursoflow src/lib/messaging/wa-deep-link.ts + phone-normalize.ts
// (consolidation plan §2 포팅 ④, §4.2), trimmed to the atockorea surface:
// kursoflow-specific cruise / guide-assignment / legacy-Jeju template branches
// stay behind. Business API 절대 금지 (v1.2 §4.4) — wa.me 딥링크만.
//
// Spec: https://faq.whatsapp.com/5913398998672934
//   wa.me/<E.164-no-plus>?text=<URL-encoded-text>
//
// Plan §4.2 template variables: {guest_name} {tour_date} {pickup_time}
// {room_link} {pass_link} — kursoflow aliases ({name}, {pickup}, {pass_url},
// {operator}, …) are kept so ported template bodies keep rendering.

// ── Phone normalization (kursoflow phone-normalize.ts) ──────────────────────

export function stripPhoneDigits(input?: string | null): string {
  return input ? input.replace(/\D/g, '') : ''
}

/** E.164 digits without '+' — wa.me's required shape. null = unusable. */
export function normalizeWaDigits(input?: string | null): string | null {
  const digits = stripPhoneDigits(input)
  if (digits.length < 6 || digits.length > 15) return null
  return digits
}

export const normalizeWaPhone = normalizeWaDigits

/**
 * Pick the best wa.me digits from a booking's phone + whatsapp fields.
 * Many OTA guests enter WhatsApp as the local subscriber number while the
 * phone field carries the country code (phone=+1 714…, WA=714…) — wa.me needs
 * the country code, so the longer number wins when it ends with the shorter.
 */
export function resolveWhatsAppDigits(input: {
  phone?: string | null
  whatsapp?: string | null
}): string | null {
  const phoneDigits = normalizeWaDigits(input.phone)
  const whatsappDigits = normalizeWaDigits(input.whatsapp)

  if (!whatsappDigits) return phoneDigits
  if (!phoneDigits) return whatsappDigits
  if (whatsappDigits === phoneDigits) return whatsappDigits

  if (
    phoneDigits.length > whatsappDigits.length &&
    whatsappDigits.length >= 7 &&
    phoneDigits.endsWith(whatsappDigits)
  ) {
    return phoneDigits
  }

  return whatsappDigits
}

// ── Template rendering ───────────────────────────────────────────────────────

export interface WaTemplateInput {
  guestName: string
  tourName?: string | null
  tourDate?: string | null // YYYY-MM-DD or human-readable
  pickupPoint?: string | null
  pickupTime?: string | null // HH:MM
  /** 투어룸 초대/입장 링크 (plan §4.2 {room_link}). */
  roomLink?: string | null
  /** 당일 패스/체크인 링크 (plan §4.2 {pass_link}). */
  passLink?: string | null
  /** Operator (agency) name — fills {operator}. */
  operatorName?: string | null
}

/**
 * Substitute {variables} into a template body. Unknown tokens are left as-is
 * (visible in preview — a prompt to fix the template, not silent data loss).
 *
 * Plan tokens: {guest_name} {tour_date} {pickup_time} {room_link} {pass_link}
 * Aliases (kursoflow compat): {name} {tour_name} {pickup_point} {pickup}
 * {pass_url} {operator}
 */
export function renderWaTemplate(body: string, i: WaTemplateInput): string {
  const pickupLine = i.pickupPoint
    ? `${i.pickupPoint}${i.pickupTime ? ` ${i.pickupTime}` : ''}`
    : ''
  return body
    .replaceAll('{guest_name}', i.guestName)
    .replaceAll('{name}', i.guestName)
    .replaceAll('{tour_name}', i.tourName ?? '')
    .replaceAll('{tour_date}', i.tourDate ?? '')
    .replaceAll('{pickup_point}', i.pickupPoint ?? '')
    .replaceAll('{pickup_time}', i.pickupTime ?? '')
    .replaceAll('{pickup}', pickupLine)
    .replaceAll('{room_link}', i.roomLink ?? '')
    .replaceAll('{pass_link}', i.passLink ?? '')
    .replaceAll('{pass_url}', i.passLink ?? '')
    .replaceAll('{operator}', i.operatorName ?? 'AtoC Korea')
}

/**
 * Build a one-tap wa.me link with the rendered message.
 * Returns null when the phone is unusable (caller disables the button).
 */
export function buildWhatsAppDeepLink(
  input: WaTemplateInput & { phone: string },
  templateBody: string,
): string | null {
  const phone = normalizeWaPhone(input.phone)
  if (!phone) return null
  const text = renderWaTemplate(templateBody, input)
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
}

/** Just the rendered message — "복사" UX when a wa.me link isn't viable. */
export function buildWhatsAppMessage(input: WaTemplateInput, templateBody: string): string {
  return renderWaTemplate(templateBody, input)
}

/** Variable catalog for template editor UIs (Korean labels). */
export const WA_TEMPLATE_VARIABLES: { token: string; label: string }[] = [
  { token: '{guest_name}', label: '게스트 이름' },
  { token: '{tour_name}', label: '투어명' },
  { token: '{tour_date}', label: '투어 날짜' },
  { token: '{pickup_point}', label: '픽업지' },
  { token: '{pickup_time}', label: '픽업 시간' },
  { token: '{room_link}', label: '투어룸 링크' },
  { token: '{pass_link}', label: '패스 링크' },
  { token: '{operator}', label: '여행사명' },
]
