import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

const LOW_CONFIDENCE_REPLY_PATTERNS = [
  /\bI(?:'m|\s*am)?\s*not\s+sure\b/i,
  /\bI\s+do(?:n't| not)\s+have\s+(?:that|enough|verified|the)\s+information\b/i,
  /\bnot\s+(?:covered|included|available)\s+in\s+(?:the\s+)?(?:context|site|product)\b/i,
  /\b(?:contact|ask|check\s+with)\s+(?:support|staff|customer service|the provider)\b/i,
  /확인(?:된)?\s*(?:사이트\s*)?정보.*(?:없|찾지\s*못|확인.*필요)/,
  /제공된\s*정보.*없/,
  /정보에\s*없/,
  /정확(?:한|히).*확인.*(?:어렵|필요)/,
  /고객\s*지원팀.*문의/,
  /문의하시겠습니까/,
  /고객센터.*연결/,
  /담당자.*연결/,
];

export function assistantReplyShouldOfferHandoff(reply: string): boolean {
  return LOW_CONFIDENCE_REPLY_PATTERNS.some((pattern) => pattern.test(reply));
}

export function humanHandoffPrompt(locale: TourProductPageLocale): string {
  if (locale === "ko") {
    return "확인된 사이트 정보에서는 답을 찾지 못했어요. 담당자 고객센터로 연결해 드릴까요?";
  }
  if (locale === "ja") {
    return "確認済みのサイト情報だけでは回答できません。担当者サポートへおつなぎしましょうか？";
  }
  if (locale === "zh" || locale === "zh-TW") {
    return "我在已确认的网站信息中找不到答案。要帮您转接人工客服吗？";
  }
  if (locale === "es") {
    return "No encuentro una respuesta confirmada en la información del sitio. ¿Quieres que te conecte con atención al cliente?";
  }
  return "I could not find a verified answer in the site information. Would you like me to connect you with customer support?";
}

export function ensureHandoffPrompt(reply: string, locale: TourProductPageLocale): string {
  const prompt = humanHandoffPrompt(locale);
  if (reply.includes(prompt)) return reply;
  if (/connect|customer support|고객센터|고객\s*지원팀|담당자|문의하시겠습니까|人工客服|atención al cliente/i.test(reply)) return reply;
  return `${reply.trim()}\n\n${prompt}`;
}

export function humanHandoffAcknowledgement(locale: TourProductPageLocale, ticketId: number | null): string {
  const ticket = ticketId ? ` #${ticketId}` : "";
  if (locale === "ko") {
    return `문의가 담당자 고객센터로 전달되었습니다${ticket}. 확인 후 가능한 한 빨리 도와드릴게요.`;
  }
  if (locale === "ja") {
    return `お問い合わせを担当者サポートへ送信しました${ticket}。確認後、できるだけ早くご案内します。`;
  }
  if (locale === "zh" || locale === "zh-TW") {
    return `已将您的咨询转给人工客服${ticket}。我们确认后会尽快协助您。`;
  }
  if (locale === "es") {
    return `Tu consulta se ha enviado a atención al cliente${ticket}. Te ayudaremos lo antes posible.`;
  }
  return `Your inquiry has been sent to customer support${ticket}. We will help as soon as possible.`;
}

export function handoffRequestText(locale: TourProductPageLocale): string {
  if (locale === "ko") return "네, 담당자 고객센터로 연결해주세요.";
  if (locale === "ja") return "はい、担当者サポートにつないでください。";
  if (locale === "zh" || locale === "zh-TW") return "是的，请转接人工客服。";
  if (locale === "es") return "Sí, conéctame con atención al cliente.";
  return "Yes, please connect me with customer support.";
}
