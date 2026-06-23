// Read-only booking lookup for the chatbot.
//
// When a user asks a booking-specific question (pickup time, status, refund
// progress, …) the assistant verifies identity with the booking reference +
// the email used to book, then answers from a whitelisted subset of the
// `bookings` row. Writes (cancel / change / refund processing) are NOT done
// here — those always hand off to staff.
//
// Security posture:
//   - Only the columns in SAFE_BOOKING_COLUMNS are ever selected, so payment
//     method, Stripe ids, payment_intent, user_id, and phone cannot leak.
//   - Verification requires an exact reference match AND an email match.
//   - The caller (route) rate-limits and locks on repeated failures, and uses
//     one identical "not found" message regardless of which field was wrong.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

// AtoC booking references look like "A2C-XXXXXXXX" (8 hex chars). Case-insensitive
// so a lowercased reference typed by the user still matches.
const BOOKING_REF_RE = /\bA2C-[0-9A-F]{8}\b/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

export type BookingCredentials = { reference: string | null; email: string | null };

/** Pull a booking reference and/or email out of free text. Either may be null. */
export function extractBookingCredentials(text: string): BookingCredentials {
  const refMatch = text.match(BOOKING_REF_RE);
  const emailMatch = text.match(EMAIL_RE);
  return {
    reference: refMatch ? refMatch[0].toUpperCase() : null,
    email: emailMatch ? emailMatch[0].toLowerCase() : null,
  };
}

export function hasBothCredentials(
  c: BookingCredentials,
): c is { reference: string; email: string } {
  return Boolean(c.reference && c.email);
}

// Requests to CHANGE the booking (cancel / refund / reschedule). Deliberately
// conservative: status questions like "is my refund processed?" / "환불 됐어?"
// must NOT match — those are read queries we answer from the booking facts.
const WRITE_INTENT_PATTERNS: RegExp[] = [
  /\b(?:please\s+)?(?:cancel|refund|reschedule|change|modify|move|amend)\s+(?:my|the|this|our)\s+(?:booking|reservation|tour|order|trip|date|time)\b/i,
  /\bi\s+(?:want|need|would like|'d like|wanna)\s+to\s+(?:cancel|refund|reschedule|change|modify|move)\b/i,
  /\bcancel\s+(?:my|the|this)\s+(?:booking|reservation|tour|order)\b/i,
  // Korean — action requests (취소/환불/변경 + 하고싶/해주세요/해줘 …)
  /(?:취소|환불|변경|수정|날짜\s*변경|일정\s*변경|예약\s*변경)\s*(?:하고\s*싶|해\s*주세요|해줘|부탁|하려|할게요|할\s*수\s*있)/,
  /(?:예약|투어|일정|날짜)\s*(?:을|를)?\s*(?:취소|변경|바꾸|수정|환불)\s*(?:하|해|할)/,
  // Japanese
  /(?:予約|ツアー|日程|日付).*(?:キャンセル|変更|返金|払い戻し).*(?:したい|してください|お願い|変えたい)/,
  // Chinese (Simplified + Traditional)
  /(?:取消|更改|改期|退款|修改|更換)(?:我的|这个|這個|該)?(?:预订|預訂|订单|訂單|预约|預約|行程|预定)/,
  // Spanish
  /\b(?:cancelar|reembolso|reembolsar|cambiar|modificar|reprogramar)\s+(?:mi|la|el)\s+(?:reserva|reservaci[oó]n|tour|fecha|pedido)\b/i,
];

export function isBookingWriteRequest(text: string): boolean {
  return WRITE_INTENT_PATTERNS.some((re) => re.test(text));
}

export type SafeBookingView = {
  bookingReference: string;
  tourName: string | null;
  tourDate: string | null;
  tourTime: string | null;
  guests: number | null;
  status: string;
  paymentStatus: string | null;
  settlementStatus: string | null;
  currency: string;
  amount: { value: number; currency: string } | null;
  refund: { eligible: boolean; processed: boolean; amount: number | null } | null;
  cancellation: { cancelledAt: string; reason: string | null } | null;
  specialRequests: string | null;
};

// Collapse whitespace + cap length on user-controlled free text before it goes
// into the model context, so injected newlines / "SYSTEM:" lines can't fake
// structure (defence-in-depth alongside the route's prompt-injection guard).
function neutralizeFreeText(value: string | null, max = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

// The ONLY columns we read. Nothing sensitive (stripe_*, payment_intent_id,
// setup_intent_id, payment_reference, user_id, merchant_id, contact_phone) is
// listed, so it can never reach the model or the user.
const SAFE_BOOKING_COLUMNS =
  "booking_reference, contact_email, tour_id, tour_date, tour_time, number_of_guests, status, payment_status, settlement_status, final_price, total_price, currency, refund_eligible, refund_processed, refund_amount, cancelled_at, cancellation_reason, special_requests";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function mapBookingRowToSafeView(
  row: Record<string, unknown>,
  tourName: string | null,
): SafeBookingView {
  const amountValue = num(row.final_price) ?? num(row.total_price);
  const currency = typeof row.currency === "string" && row.currency ? row.currency : "USD";
  const refundAmount = num(row.refund_amount);
  const hasRefundInfo =
    row.refund_eligible != null || row.refund_processed != null || refundAmount !== null;
  return {
    bookingReference: String(row.booking_reference ?? ""),
    tourName,
    tourDate: typeof row.tour_date === "string" ? row.tour_date : null,
    // tour_time is a Postgres TIME (HH:MM:SS); guard the slice in case the
    // stored value is shorter/malformed so we never show a truncated time.
    tourTime:
      typeof row.tour_time === "string" && /^\d{2}:\d{2}/.test(row.tour_time)
        ? row.tour_time.slice(0, 5)
        : null,
    guests: num(row.number_of_guests),
    status: String(row.status ?? "unknown"),
    paymentStatus: typeof row.payment_status === "string" ? row.payment_status : null,
    settlementStatus: typeof row.settlement_status === "string" ? row.settlement_status : null,
    currency,
    amount: amountValue !== null ? { value: amountValue, currency } : null,
    refund: hasRefundInfo
      ? {
          eligible: Boolean(row.refund_eligible),
          processed: Boolean(row.refund_processed),
          amount: refundAmount,
        }
      : null,
    cancellation:
      typeof row.cancelled_at === "string" && row.cancelled_at
        ? {
            cancelledAt: row.cancelled_at,
            reason: neutralizeFreeText(
              typeof row.cancellation_reason === "string" ? row.cancellation_reason : null,
            ),
          }
        : null,
    specialRequests: neutralizeFreeText(
      typeof row.special_requests === "string" ? row.special_requests : null,
    ),
  };
}

/**
 * Verify a booking by reference + email and return a whitelisted view, or null
 * if the credentials do not both match a single booking.
 */
export async function verifyAndFetchBooking(
  sb: SupabaseClient,
  creds: { reference: string; email: string },
): Promise<SafeBookingView | null> {
  const reference = creds.reference.trim().toUpperCase();
  const email = normalizeEmail(creds.email);
  // Validate shape before querying — also blocks any wildcard/odd input.
  if (!BOOKING_REF_RE.test(reference) || !EMAIL_RE.test(email)) return null;

  const { data, error } = await sb
    .from("bookings")
    .select(SAFE_BOOKING_COLUMNS)
    .eq("booking_reference", reference)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const storedEmail = typeof row.contact_email === "string" ? normalizeEmail(row.contact_email) : "";
  if (!storedEmail || storedEmail !== email) return null;

  let tourName: string | null = null;
  if (typeof row.tour_id === "string") {
    const { data: tour } = await sb
      .from("tours")
      .select("title")
      .eq("id", row.tour_id)
      .maybeSingle();
    const t = tour as { title?: string } | null;
    tourName = t?.title ?? null;
  }

  return mapBookingRowToSafeView(row, tourName);
}

/**
 * Render the verified booking as a labelled fact block for the model. The model
 * phrases the answer in the user's language; these facts constrain it. English
 * labels are fine — the model translates the surrounding prose.
 */
export function buildVerifiedBookingContext(view: SafeBookingView): string {
  const lines: string[] = [`Booking reference: ${view.bookingReference}`];
  if (view.tourName) lines.push(`Tour: ${view.tourName}`);
  if (view.tourDate) lines.push(`Tour date: ${view.tourDate}`);
  lines.push(`Tour time: ${view.tourTime ?? "not set on the booking — confirmed by staff"}`);
  if (view.guests != null) lines.push(`Guests: ${view.guests}`);
  lines.push(`Booking status: ${view.status}`);
  if (view.paymentStatus) lines.push(`Payment status: ${view.paymentStatus}`);
  if (view.amount) lines.push(`Amount paid/owed: ${view.amount.value.toFixed(2)} ${view.amount.currency}`);
  if (view.refund) {
    const amount =
      view.refund.amount != null
        ? `, amount=${view.refund.amount.toFixed(2)} ${view.currency}`
        : "";
    lines.push(
      `Refund: eligible=${view.refund.eligible ? "yes" : "no"}, processed=${view.refund.processed ? "yes" : "no"}${amount}`,
    );
  }
  lines.push(
    view.cancellation
      ? `Cancellation: cancelled on ${view.cancellation.cancelledAt}${view.cancellation.reason ? ` (reason: ${view.cancellation.reason})` : ""}`
      : "Cancellation: not cancelled",
  );
  if (view.specialRequests) lines.push(`Special requests: ${view.specialRequests}`);
  lines.push("Pickup: exact pickup time and place are confirmed by staff (not stored on this booking record).");
  return lines.join("\n");
}

// ── Localized assistant copy ────────────────────────────────────────────────

export function bookingCredentialsPrompt(locale: TourProductPageLocale): string {
  if (locale === "ko")
    return "예약 내용을 확인해 드릴게요. 예약번호(예: A2C-XXXXXXXX)와 예약 시 사용한 이메일을 알려주세요. (변경·취소·환불 처리는 담당자가 도와드립니다.)";
  if (locale === "ja")
    return "ご予約を確認します。予約番号(例: A2C-XXXXXXXX)とご予約時のメールアドレスを教えてください。(変更・キャンセル・返金は担当者が対応します。)";
  if (locale === "zh")
    return "我来帮你查询预订。请提供预订编号(例如 A2C-XXXXXXXX)和预订时使用的邮箱。(更改、取消、退款由人工客服处理。)";
  if (locale === "zh-TW")
    return "我來幫你查詢預訂。請提供預訂編號(例如 A2C-XXXXXXXX)和預訂時使用的電子郵件。(更改、取消、退款由人工客服處理。)";
  if (locale === "es")
    return "Puedo revisar tu reserva. Comparte tu numero de reserva (p. ej. A2C-XXXXXXXX) y el correo que usaste al reservar. (Los cambios, cancelaciones y reembolsos los gestiona nuestro equipo.)";
  return "I can check your booking. Please share your booking reference (e.g. A2C-XXXXXXXX) and the email you used to book. (Changes, cancellations, and refunds are handled by our staff.)";
}

export function bookingNotFoundReply(locale: TourProductPageLocale): string {
  if (locale === "ko")
    return "그 예약번호와 이메일로 일치하는 예약을 찾지 못했어요. 두 가지 모두 다시 한 번 확인해 주세요. 계속 안 되면 담당자에게 바로 연결해 드릴게요.";
  if (locale === "ja")
    return "その予約番号とメールアドレスで一致するご予約が見つかりませんでした。両方をもう一度ご確認ください。解決しない場合は担当者におつなぎします。";
  if (locale === "zh")
    return "没有找到与该预订编号和邮箱匹配的预订。请再次确认两者。如果仍然不行,我可以帮你联系人工客服。";
  if (locale === "zh-TW")
    return "找不到與該預訂編號和電子郵件相符的預訂。請再次確認兩者。如果仍然不行,我可以幫你聯絡人工客服。";
  if (locale === "es")
    return "No encontre una reserva que coincida con ese numero y correo. Verifica ambos, por favor. Si sigue sin funcionar, puedo conectarte con atencion al cliente.";
  return "I couldn't find a booking matching that reference and email. Please double-check both. If it still doesn't work, I can connect you with customer support.";
}

export function bookingLockedReply(locale: TourProductPageLocale): string {
  if (locale === "ko")
    return "보안을 위해 예약 조회를 잠시 중단했어요. 예약 확인을 위해 담당자에게 연결해 드릴게요.";
  if (locale === "ja")
    return "セキュリティのため予約照会を一時停止しました。ご予約の確認のため担当者におつなぎします。";
  if (locale === "zh")
    return "出于安全考虑,我暂停了预订查询。我会帮你联系人工客服来核实预订。";
  if (locale === "zh-TW")
    return "基於安全考量,我暫停了預訂查詢。我會幫你聯絡人工客服來核實預訂。";
  if (locale === "es")
    return "Por seguridad, pause la consulta de reservas. Te conectare con atencion al cliente para verificar tu reserva.";
  return "For security I've paused booking lookups for now. I'll connect you with customer support to verify your booking.";
}

export function bookingWriteHandoffNote(locale: TourProductPageLocale): string {
  if (locale === "ko")
    return "변경·취소·환불 처리는 담당자가 직접 도와드려요. 이 채팅에서 바로 연결해 드릴까요?";
  if (locale === "ja")
    return "変更・キャンセル・返金の手続きは担当者が対応します。このチャットでおつなぎしましょうか?";
  if (locale === "zh") return "更改、取消和退款由人工客服处理。要我在此聊天中帮你联系吗?";
  if (locale === "zh-TW") return "更改、取消和退款由人工客服處理。要我在此聊天中幫你聯絡嗎?";
  if (locale === "es")
    return "Los cambios, cancelaciones y reembolsos los gestiona nuestro equipo. Quieres que te conecte en este chat?";
  return "Changes, cancellations, and refunds are handled by our staff. Would you like me to connect you in this chat?";
}
