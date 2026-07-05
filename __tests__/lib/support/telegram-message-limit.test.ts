// C-33 — Telegram rejects text over 4096 chars; oversized escalations used to
// silently drop the admin notification.
import { buildLiveChatMessage, buildMessage, fitTelegramMessage } from "@/lib/support/telegram-webhook";

describe("fitTelegramMessage (C-33)", () => {
  it("passes a normal message through unchanged", () => {
    const msg = fitTelegramMessage((max) => buildMessage(basePayload("hello there"), max), 500);
    expect(msg).toContain("hello there");
    expect(msg.length).toBeLessThanOrEqual(4096);
  });

  it("clamps an entity-heavy live-chat message under the 4096 hard limit", () => {
    // 1500 raw "&" chars escape to 7500 chars ("&amp;") — the old builder
    // produced an unsendable message.
    const angry = "&".repeat(3000);
    const msg = fitTelegramMessage(
      (max) => buildLiveChatMessage(livePayload(angry), max),
      1500,
    );
    expect(msg.length).toBeLessThanOrEqual(4096);
    expect(msg).toContain("Customer live chat #7");
    expect(msg).toContain("&amp;"); // content survives, just shorter
  });

  it("clamps the ticket notification too", () => {
    const msg = fitTelegramMessage(
      (max) => buildMessage(basePayload("<".repeat(4000)), max),
      500,
    );
    expect(msg.length).toBeLessThanOrEqual(4096);
    expect(msg).toContain("New customer inquiry #7");
  });
});

function basePayload(text: string) {
  return {
    ticketId: 7,
    reason: "keyword_match",
    initialUserMessage: text,
    tourSlug: null,
    pageUrl: null,
    pageTitle: null,
    userLocale: "en",
  };
}

function livePayload(text: string) {
  return {
    ticketId: 7,
    supportMessageId: 1,
    content: text,
    tourSlug: null,
    pageUrl: null,
    pageTitle: null,
    userLocale: "en",
  };
}
