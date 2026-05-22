import {
  extractTicketIdFromTelegramText,
  parseTelegramAdminIntent,
} from "@/lib/support/telegram-inbound";

describe("telegram inbound support parsing", () => {
  it("parses explicit reply commands", () => {
    const intent = parseTelegramAdminIntent({
      message_id: 10,
      chat: { id: 123 },
      text: "/reply #42 픽업 장소는 호텔 로비입니다.",
    });

    expect(intent).toEqual({
      kind: "reply",
      ticketId: 42,
      content: "픽업 장소는 호텔 로비입니다.",
      replyToMessageId: null,
    });
  });

  it("uses the replied Telegram message text to find the ticket", () => {
    const intent = parseTelegramAdminIntent({
      message_id: 11,
      chat: { id: 123 },
      text: "네, 반려동물 전용 좌석은 별도 확인이 필요합니다.",
      reply_to_message: {
        message_id: 9,
        text: "Customer live chat #77\n\nMessage:\nCan I bring a pet?",
      },
    });

    expect(intent.kind).toBe("reply");
    expect(intent.ticketId).toBe(77);
    expect(intent.replyToMessageId).toBe(9);
  });

  it("extracts ticket ids from notification text", () => {
    expect(extractTicketIdFromTelegramText("New customer inquiry #123")).toBe(123);
    expect(extractTicketIdFromTelegramText("no id here")).toBeNull();
  });
});
