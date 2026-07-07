import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

const LOW_CONFIDENCE_REPLY_PATTERNS = [
  /\bI(?:'m|\s*am)?\s*not\s+sure\b/i,
  /\bI\s+do(?:n't| not)\s+have\s+(?:that|enough|verified|the)\s+information\b/i,
  /\bnot\s+(?:covered|included|available)\s+in\s+(?:the\s+)?(?:context|site|product)\b/i,
  /\bconnect\s+you\s+(?:to|with)\s+(?:customer\s+)?support\b/i,
  /\bconnect\s+you\s+(?:to|with)\s+(?:a\s+)?(?:human|agent|representative|staff)\b/i,
  /\b(?:contact|ask|check\s+with)\s+(?:support|staff|customer service|the provider|us)\b/i,
  /\b(?:contact|support)\s+(?:page|form)\b/i,
  /\/(?:contact|support)\b/i,
  /확인(?:된)?\s*(?:정보|답변).*?(?:없|찾을 수|부족)/,
  /정보(?:가)?\s*(?:없|부족|확인되지)/,
  /정확(?:한)?\s*(?:확인|안내).*?(?:필요|어렵)/,
  /고객\s*(?:센터|지원|상담|서비스).*?(?:문의|연결|확인)/,
  /(?:문의|연락)\s*(?:페이지|폼|양식)/,
  /담당자.*?(?:연결|문의|확인)/,
  /確認済み.*?(?:情報|回答).*?(?:ありません|見つかりません)/,
  /客服|人工客服|客户支持|客戶支援/,
  /atenci[oó]n al cliente|soporte/i,
];

const DIRECT_HANDOFF_REQUEST_PATTERNS = [
  /\b(?:connect|contact|speak|talk|chat)\s+(?:me\s+)?(?:to|with)\s+(?:a\s+)?(?:human|agent|person|representative|manager|support|customer support|customer service)\b/i,
  /\b(?:human|live)\s+(?:agent|support|help)\b/i,
  /\b(?:contact|message)\s+(?:support|customer service|staff)\b/i,
  /(?:상담원|담당자|관리자|사람|고객\s*(?:센터|지원|상담))\s*(?:연결|불러|호출|문의|연락|상담)/,
  /(?:연락하기|문의하기|텔레그램.*(?:보내|푸시|알림)|푸시.*(?:보내|줘))/,
  /(?:人工客服|联系客服|聯絡客服|客服连接|客服連線)/,
  /(?:atenci[oó]n al cliente|soporte humano|agente humano)/i,
];

export function assistantReplyShouldOfferHandoff(reply: string): boolean {
  return LOW_CONFIDENCE_REPLY_PATTERNS.some((pattern) => pattern.test(reply));
}

export function userMessageRequestsHumanHandoff(message: string): boolean {
  return DIRECT_HANDOFF_REQUEST_PATTERNS.some((pattern) => pattern.test(message));
}

export function humanHandoffPrompt(locale: TourProductPageLocale): string {
  if (locale === "ko") {
    return "확인된 사이트 정보만으로는 답을 확정하기 어렵습니다. 담당자에게 바로 연결해 드릴까요?";
  }
  if (locale === "ja") {
    return "確認済みのサイト情報だけでは断定できません。担当者につなぎましょうか？";
  }
  if (locale === "zh-TW") {
    return "僅憑已驗證的網站資訊還無法確認。要我幫你聯絡人工客服嗎？";
  }
  if (locale === "zh") {
    return "仅凭已验证的网站信息还无法确认。要我帮你联系人工客服吗？";
  }
  if (locale === "es") {
    return "No encuentro una respuesta confirmada en la informacion del sitio. Quieres que te conecte con atencion al cliente?";
  }
  return "I could not find a verified answer in the site information. Would you like me to connect you with customer support?";
}

export function ensureHandoffPrompt(reply: string, locale: TourProductPageLocale): string {
  const prompt = humanHandoffPrompt(locale);
  if (reply.includes(prompt)) return reply;
  if (
    /connect|customer support|contact support|human support|고객\s*(?:센터|지원|상담)|담당자|상담원|人工客服|客服|atenci[oó]n al cliente|soporte/i.test(
      reply,
    )
  ) {
    return reply;
  }
  return `${reply.trim()}\n\n${prompt}`;
}

export function humanHandoffAcknowledgement(locale: TourProductPageLocale, ticketId: number | null): string {
  const ticket = ticketId ? ` #${ticketId}` : "";
  if (locale === "ko") {
    return `문의가 담당자에게 전달되었습니다${ticket}. 가능한 한 빨리 확인해서 채팅으로 답변드릴게요.`;
  }
  if (locale === "ja") {
    return `お問い合わせを担当者に送信しました${ticket}。できるだけ早くチャットで返信します。`;
  }
  if (locale === "zh-TW") {
    return `你的諮詢已傳送給人工客服${ticket}。我們會盡快在聊天中回覆。`;
  }
  if (locale === "zh") {
    return `你的咨询已发送给人工客服${ticket}。我们会尽快在聊天中回复。`;
  }
  if (locale === "es") {
    return `Tu consulta se ha enviado a atencion al cliente${ticket}. Te responderemos por este chat lo antes posible.`;
  }
  return `Your inquiry has been sent to customer support${ticket}. We will reply in this chat as soon as possible.`;
}

export function handoffRequestText(locale: TourProductPageLocale): string {
  if (locale === "ko") return "담당자에게 연결해 주세요.";
  if (locale === "ja") return "担当者につないでください。";
  if (locale === "zh-TW") return "請幫我聯絡人工客服。";
  if (locale === "zh") return "请帮我联系人工客服。";
  if (locale === "es") return "Si, conectame con atencion al cliente.";
  return "Yes, please connect me with customer support.";
}
