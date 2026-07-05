// W6.4 (G-5 approved) — booking CHANGE REQUEST intake.
//
// A verified customer asking to change/cancel/reschedule no longer gets a
// bare "staff will handle it" — the request is filed as a structured support
// ticket (admin-approval gate) on the spot and the reply states, in the
// customer's language, that NOTHING has changed yet. The bot still never
// writes to the booking itself.

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

export function bookingChangeReceivedReply(
  locale: TourProductPageLocale,
  ticketId: number | null,
): string {
  const ref = ticketId ? ` (#${ticketId})` : "";
  const m: Record<TourProductPageLocale, string> = {
    en: `Got it — your change request is filed${ref} and our staff will confirm it with you by email or right here. **Nothing on your booking has been changed yet**, and the 100%-refund-up-to-24h policy still applies to your current booking as-is.`,
    ko: `접수됐어요${ref} — 담당자가 확인 후 이메일 또는 이 채팅으로 확정해 드릴게요. **아직 예약은 변경되지 않았고**, 현재 예약에는 24시간 전 100% 환불 정책이 그대로 적용돼요.`,
    ja: `承りました${ref} — 担当者が確認のうえ、メールまたはこのチャットで確定をご案内します。**ご予約はまだ変更されていません**。現在のご予約には24時間前まで全額返金のポリシーがそのまま適用されます。`,
    zh: `已受理${ref} — 工作人员确认后会通过邮件或本聊天与你确定。**你的预订尚未被更改**，当前预订仍适用提前24小时全额退款政策。`,
    "zh-TW": `已受理${ref} — 工作人員確認後會透過郵件或本聊天與你確定。**你的預訂尚未被更改**，當前預訂仍適用提前24小時全額退款政策。`,
    es: `Recibido${ref} — nuestro equipo lo confirmará contigo por correo o aquí mismo. **Tu reserva aún no ha sido modificada**, y la política de reembolso 100% hasta 24h antes sigue aplicando a tu reserva actual tal cual.`,
  };
  return m[locale] ?? m.en;
}
