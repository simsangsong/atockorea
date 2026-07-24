import { renderTemplate, type MessageVars } from '@/lib/ops/messaging/template'

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

/**
 * §K B0.3b — wa.me 입력은 채널 중립 변수와 **같은 것**이다. 별칭으로 남겨
 * 기존 호출부를 건드리지 않는다.
 */
export type WaTemplateInput = MessageVars

/**
 * Substitute {variables} into a template body — thin alias over the
 * channel-neutral renderer (§K B0.3b). The token contract lives in
 * `lib/ops/messaging/template.ts` and is shared with email.
 */
export function renderWaTemplate(body: string, i: WaTemplateInput): string {
  // §K B0.3b — 치환 규칙은 채널 중립 렌더러가 갖는다. 여기 두면 이메일이
  // 같은 계약을 쓸 수 없고, 두 벌이 되는 순간 문구가 어긋나기 시작한다.
  return renderTemplate(body, i)
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
