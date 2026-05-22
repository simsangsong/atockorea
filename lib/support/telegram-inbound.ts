type TelegramChat = {
  id?: number | string;
};

export type TelegramInboundMessage = {
  message_id?: number;
  text?: string;
  caption?: string;
  chat?: TelegramChat;
  from?: unknown;
  reply_to_message?: TelegramInboundMessage;
};

export type TelegramAdminIntent =
  | {
      kind: "reply";
      ticketId: number | null;
      content: string;
      replyToMessageId: number | null;
    }
  | {
      kind: "resolve";
      ticketId: number | null;
      content: string | null;
      replyToMessageId: number | null;
    }
  | { kind: "empty"; ticketId: number | null; content: null; replyToMessageId: number | null };

const REPLY_COMMAND_RE = /^\/reply(?:@\w+)?\s+#?(\d+)\s+([\s\S]+)/i;
const RESOLVE_COMMAND_RE = /^\/(?:resolve|close)(?:@\w+)?\s+#?(\d+)(?:\s+([\s\S]+))?/i;
const LEADING_TICKET_RE = /^#(\d+)\s+([\s\S]+)/;
const TICKET_ID_RE = /(?:ticket|inquiry|chat|문의|상담)?\s*#(\d+)\b/i;

export function telegramMessageText(message: TelegramInboundMessage | null | undefined): string {
  return (message?.text ?? message?.caption ?? "").trim();
}

export function telegramChatId(message: TelegramInboundMessage | null | undefined): string | null {
  const raw = message?.chat?.id;
  return raw === undefined || raw === null ? null : String(raw);
}

export function extractTicketIdFromTelegramText(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(TICKET_ID_RE);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function parseTelegramAdminIntent(message: TelegramInboundMessage): TelegramAdminIntent {
  const text = telegramMessageText(message);
  const replyText = telegramMessageText(message.reply_to_message);
  const replyToMessageId = message.reply_to_message?.message_id ?? null;

  if (!text) {
    return { kind: "empty", ticketId: extractTicketIdFromTelegramText(replyText), content: null, replyToMessageId };
  }

  const replyCommand = text.match(REPLY_COMMAND_RE);
  if (replyCommand) {
    return {
      kind: "reply",
      ticketId: Number(replyCommand[1]),
      content: replyCommand[2].trim(),
      replyToMessageId,
    };
  }

  const resolveCommand = text.match(RESOLVE_COMMAND_RE);
  if (resolveCommand) {
    return {
      kind: "resolve",
      ticketId: Number(resolveCommand[1]),
      content: resolveCommand[2]?.trim() || null,
      replyToMessageId,
    };
  }

  const leadingTicket = text.match(LEADING_TICKET_RE);
  if (leadingTicket) {
    return {
      kind: "reply",
      ticketId: Number(leadingTicket[1]),
      content: leadingTicket[2].trim(),
      replyToMessageId,
    };
  }

  return {
    kind: "reply",
    ticketId: extractTicketIdFromTelegramText(replyText),
    content: text,
    replyToMessageId,
  };
}
