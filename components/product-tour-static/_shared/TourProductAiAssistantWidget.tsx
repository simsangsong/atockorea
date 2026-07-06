"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Headphones, Minus, Plus, Send, ShieldCheck, Sparkles, ThumbsDown, ThumbsUp, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { parseSseBuffer } from "@/lib/chatbot/clientSse";
import { ChatMarkdown, safeCheckoutUrl, safeChatHref } from "./chatMarkdown";

function ChatBotAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <line x1="20" y1="3.5" x2="20" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20" cy="3" r="1.9" fill="#34d399">
        <animate attributeName="r" values="1.6;2.1;1.6" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="20" cy="3" r="1.9" fill="#34d399" opacity="0.45">
        <animate attributeName="r" values="1.9;3.4;1.9" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.45;0;0.45" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <rect x="3.2" y="15.5" width="3.6" height="9" rx="1.8" fill="currentColor" opacity="0.95" />
      <rect x="33.2" y="15.5" width="3.6" height="9" rx="1.8" fill="currentColor" opacity="0.95" />
      <rect x="6.8" y="9" width="26.4" height="22.5" rx="9" fill="currentColor" />
      <rect x="10.2" y="14.2" width="19.6" height="11.4" rx="5.7" fill="#0e2540" />
      <circle cx="16" cy="19.9" r="1.85" fill="#5eead4" />
      <circle cx="24" cy="19.9" r="1.85" fill="#5eead4" />
      <circle cx="16.55" cy="19.35" r="0.55" fill="#ffffff" />
      <circle cx="24.55" cy="19.35" r="0.55" fill="#ffffff" />
      <path
        d="M16.5 28.5 Q20 30.6 23.5 28.5"
        stroke="#0e2540"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  );
}

// W4.1 — deterministic rich tour card payload (server-built from the static
// catalogue registry; the model never invents these fields).
type TourCard = {
  slug: string;
  title: string;
  image_url: string;
  duration: string;
  rating: number;
  review_count: number;
  price_from_usd: number;
  compare_at_usd: number | null;
  href: string;
};

// W2.3 — structured quote-slot state; the widget renders tap controls for it.
type SlotRequest = {
  missing: string[];
  known: {
    region: string | null;
    track: string | null;
    date: string | null;
    party: number | null;
    duration_hours: number | null;
    jeju_pickup_zone: string | null;
    cruise_port: string | null;
  };
  date_issue?: string | null;
};

// W4.6 — grounding-source badge (server-built from the RAG chunks actually
// injected into the prompt; labels/links are deterministic, never the model).
type AnswerSource = {
  type: string;
  label: string;
  href: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  origin?: "ai" | "admin" | "support_user" | "system";
  supportMessageId?: number;
  /** Quote funnel (Q3) — renders a "go to checkout" button under the message. */
  checkoutUrl?: string;
  /** W4.2 — failure bubble that can re-run the last request. */
  retriable?: boolean;
  /** W4.1 — rich tour cards rendered under the reply text. */
  cards?: TourCard[];
  /** W4.3 — one-tap follow-up chips (rendered on the latest reply only). */
  chips?: string[];
  /** W2.3 — quote slot controls (rendered on the latest reply only). */
  slotRequest?: SlotRequest;
  /** W4.6 — grounding-source badges under the reply. */
  sources?: AnswerSource[];
  /** W4.6 — fixed "no charge now · 24h refund" trust badge (quote turns). */
  quoteTrust?: boolean;
};

// Quote-funnel checkout CTA, keyed on the widget locale (avoids threading a
// label through every localized labels object).
const CHECKOUT_CTA: Record<string, string> = {
  ko: "결제하러 가기 →",
  en: "Go to checkout →",
  ja: "決済に進む →",
  zh: "前往结账 →",
  "zh-TW": "前往結帳 →",
  es: "Ir al pago →",
};

/** Normalize a ui language tag ("en-US", "zh-TW") onto the 6 label keys. */
function langKey(lang: string): "en" | "ko" | "ja" | "zh" | "zh-TW" | "es" {
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("es")) return "es";
  if (lang.startsWith("zh-TW")) return "zh-TW";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

// W4.6 — fixed trust line under quote / checkout turns.
const TRUST_LINE: Record<string, string> = {
  ko: "지금 결제되지 않아요 · 투어 당일 청구 · 24시간 전까지 100% 환불",
  en: "No charge now · Card is charged on tour day · 100% refund up to 24h before",
  ja: "今は課金されません · 当日課金 · 24時間前まで全額返金",
  zh: "现在不扣款 · 当天扣款 · 提前24小时全额退款",
  "zh-TW": "現在不扣款 · 當天扣款 · 提前24小時全額退款",
  es: "Sin cargo ahora · Se cobra el día del tour · Reembolso 100% hasta 24h antes",
};

// W4.6 — label prefixing the grounding-source badges.
const SOURCES_LABEL: Record<string, string> = {
  ko: "근거",
  en: "Based on",
  ja: "根拠",
  zh: "依据",
  "zh-TW": "依據",
  es: "Fuentes",
};

// W5.3 — optional one-tap reasons after a thumbs-down. Keys are the stable
// analytics values sent to /assistant/feedback `reason`.
function negativeReasons(lang: string): readonly (readonly [string, string])[] {
  if (lang.startsWith("ko"))
    return [["inaccurate", "정보가 부정확해요"], ["unanswered", "질문에 답이 없어요"], ["confusing", "이해하기 어려워요"]];
  if (lang.startsWith("ja"))
    return [["inaccurate", "情報が不正確"], ["unanswered", "質問に答えていない"], ["confusing", "わかりにくい"]];
  if (lang.startsWith("es"))
    return [["inaccurate", "Información inexacta"], ["unanswered", "No respondió mi pregunta"], ["confusing", "Difícil de entender"]];
  if (lang.startsWith("zh"))
    return [["inaccurate", "信息不准确"], ["unanswered", "没有回答我的问题"], ["confusing", "难以理解"]];
  return [["inaccurate", "Not accurate"], ["unanswered", "Didn't answer my question"], ["confusing", "Hard to understand"]];
}

// W4.1 — tour card strip labels.
const VIEW_TOUR_CTA: Record<string, string> = {
  ko: "투어 보기",
  en: "View tour",
  ja: "ツアーを見る",
  zh: "查看行程",
  "zh-TW": "查看行程",
  es: "Ver tour",
};
const PRICE_FROM: Record<string, (n: number) => string> = {
  ko: (n) => `$${n}부터`,
  en: (n) => `From $${n}`,
  ja: (n) => `$${n}〜`,
  zh: (n) => `$${n}起`,
  "zh-TW": (n) => `$${n}起`,
  es: (n) => `Desde $${n}`,
};

// W2.3 — quote slot control labels. The composed submit message stays English
// (deterministic tokens the server-side extractor maps 1:1 onto slot enums).
type SlotUiLabels = {
  region: string;
  date: string;
  party: string;
  hours: string;
  pickup: string;
  port: string;
  submit: string;
  regions: readonly (readonly [string, string])[];
  zones: readonly (readonly [string, string])[];
  ports: readonly (readonly [string, string])[];
};
const SLOT_UI: Record<string, SlotUiLabels> = {
  en: {
    region: "Destination", date: "Date", party: "People", hours: "Hours",
    pickup: "Jeju hotel area", port: "Docking port", submit: "Get my quote",
    regions: [["jeju", "Jeju"], ["busan", "Busan"], ["seoul", "Seoul"]],
    zones: [["city", "Downtown"], ["out_west", "West"], ["out_east", "East"], ["out_south", "South"]],
    ports: [["jeju_port", "Jeju Port"], ["gangjeong", "Gangjeong"]],
  },
  ko: {
    region: "여행지", date: "날짜", party: "인원", hours: "시간",
    pickup: "제주 호텔 지역", port: "기항 항구", submit: "견적 받기",
    regions: [["jeju", "제주"], ["busan", "부산"], ["seoul", "서울"]],
    zones: [["city", "시내"], ["out_west", "서부"], ["out_east", "동부"], ["out_south", "남부"]],
    ports: [["jeju_port", "제주항"], ["gangjeong", "강정항"]],
  },
  ja: {
    region: "目的地", date: "日付", party: "人数", hours: "時間",
    pickup: "済州ホテルエリア", port: "寄港地", submit: "見積もりを見る",
    regions: [["jeju", "済州"], ["busan", "釜山"], ["seoul", "ソウル"]],
    zones: [["city", "市内"], ["out_west", "西部"], ["out_east", "東部"], ["out_south", "南部"]],
    ports: [["jeju_port", "済州港"], ["gangjeong", "江汀港"]],
  },
  zh: {
    region: "目的地", date: "日期", party: "人数", hours: "时长",
    pickup: "济州酒店区域", port: "停靠港口", submit: "获取报价",
    regions: [["jeju", "济州"], ["busan", "釜山"], ["seoul", "首尔"]],
    zones: [["city", "市区"], ["out_west", "西部"], ["out_east", "东部"], ["out_south", "南部"]],
    ports: [["jeju_port", "济州港"], ["gangjeong", "江汀港"]],
  },
  "zh-TW": {
    region: "目的地", date: "日期", party: "人數", hours: "時長",
    pickup: "濟州飯店區域", port: "停靠港口", submit: "獲取報價",
    regions: [["jeju", "濟州"], ["busan", "釜山"], ["seoul", "首爾"]],
    zones: [["city", "市區"], ["out_west", "西部"], ["out_east", "東部"], ["out_south", "南部"]],
    ports: [["jeju_port", "濟州港"], ["gangjeong", "江汀港"]],
  },
  es: {
    region: "Destino", date: "Fecha", party: "Personas", hours: "Horas",
    pickup: "Zona de hotel en Jeju", port: "Puerto", submit: "Ver mi precio",
    regions: [["jeju", "Jeju"], ["busan", "Busan"], ["seoul", "Seúl"]],
    zones: [["city", "Centro"], ["out_west", "Oeste"], ["out_east", "Este"], ["out_south", "Sur"]],
    ports: [["jeju_port", "Puerto Jeju"], ["gangjeong", "Gangjeong"]],
  },
};

// W4.2 — retry CTA on failure bubbles.
const RETRY_LABEL: Record<string, string> = {
  ko: "다시 시도",
  en: "Try again",
  ja: "再試行",
  zh: "重试",
  "zh-TW": "重試",
  es: "Reintentar",
};

// W4.8 — friendly 429 instead of the blunt generic error.
function rateLimitMessage(lang: string, seconds: number): string {
  if (lang.startsWith("ko")) return `질문이 많아 잠시 쉬어가요 — 약 ${seconds}초 후에 다시 물어봐 주세요.`;
  if (lang.startsWith("ja")) return `ご質問が集中しています。約${seconds}秒後にもう一度お試しください。`;
  if (lang.startsWith("zh")) return `提问有点多，稍作休息 — 约${seconds}秒后再试一次吧。`;
  if (lang.startsWith("es")) return `Muchas preguntas seguidas — inténtalo de nuevo en unos ${seconds} segundos.`;
  return `Lots of questions at once — please try again in about ${seconds} seconds.`;
}

// W4.8 — honest note once the sent window starts trimming (server cap = 24).
function trimNotice(lang: string): string {
  if (lang.startsWith("ko")) return "긴 대화예요 — 최근 대화 위주로 이해하고 있어요.";
  if (lang.startsWith("ja")) return "長い会話のため、直近のやり取りを中心に理解しています。";
  if (lang.startsWith("zh")) return "对话较长 — 我主要参考最近的内容来回答。";
  if (lang.startsWith("es")) return "La conversación es larga: me baso sobre todo en los mensajes recientes.";
  return "Long conversation — I'm working mainly from the most recent messages.";
}

// The server caps the history at 24 messages (zod). Trim to the most recent
// window before sending so long conversations don't 400 and break the chat;
// drop any leading assistant turn so the window still starts with a user message.
function trimChatHistory(messages: ChatMessage[], max = 24): ChatMessage[] {
  let window = messages.slice(-max);
  while (window.length > 1 && window[0].role !== "user") window = window.slice(1);
  return window;
}

type AssistantResponse = {
  reply?: string;
  error?: string;
  message?: string;
  ticket_id?: number | null;
  escalated?: boolean;
  escalation_reason?: string | null;
  handoff_offered?: boolean;
  /** Quote funnel (Q3) — present when the bot created a booking; the widget
   *  renders a "go to checkout" button. */
  checkout_url?: string | null;
  /** W4.1 / W4.3 / W2.3 / W4.6 — rich-UX extensions. */
  cards?: TourCard[];
  chips?: string[];
  slot_request?: SlotRequest;
  sources?: AnswerSource[];
  quote_trust?: boolean;
};

type LiveSupportMessage = {
  id: number;
  ticket_id: number;
  message_index: number;
  sender: "user" | "admin" | "system";
  content: string;
  created_at: string;
};

type LiveSupportResponse = {
  ticket?: { id: number; status: string } | null;
  messages?: LiveSupportMessage[];
  message?: LiveSupportMessage;
  ticket_id?: number;
  error?: string;
};

type AssistantScope = "tour" | "site";

type TourProductAiAssistantWidgetProps = {
  tourProductSlug?: string;
  productTitle?: string;
  supportQuickChips?: readonly string[];
  assistantScope?: AssistantScope;
  placement?: "tour" | "global";
};

type UiLabels = {
  badge: string;
  title: string;
  siteTitle: string;
  introTitle: string;
  introBody: string;
  popular: string;
  suggested: string;
  contactSupport: string;
  contactPromptTitle: string;
  connectNow: string;
  notNow: string;
  close: string;
  send: string;
  message: string;
  activeSupport: string;
  supportMessagePlaceholder: string;
  questionPlaceholder: string;
  aiNotice: string;
  liveNotice: string;
  aiUnavailable: string;
  requestFailed: (error: string) => string;
  networkError: string;
  liveSendFailed: (error: string) => string;
  handoffFailed: (error: string) => string;
  handoffNetworkError: string;
  handoffRequest: string;
  directSupportQuestion: string;
  defaultQuickChips: string[];
  // L1 (chatbot promo) — idle teaser bubble copy shown on the global/landing
  // placement to advertise that this is a full-funnel agent, not a FAQ bot.
  teaserTitle: string;
  teaserBody: string;
  teaserCta: string;
};

const SITE_ASSISTANT_SLUG = "__site__";
const STORAGE_PREFIX = "tour-product-assistant:";
const LIVE_TICKET_PREFIX = "tour-product-assistant-live-ticket:";
// W4.7 (C-16): ONE conversation across the whole site. Storage used to be
// keyed per tour slug, so walking from a tour page to home made the chat
// look wiped. The page scope only changes what CONTEXT each turn gets.
const GLOBAL_STORAGE_KEY = "__global__";
// L1 — the teaser shows at most ONCE per session: the key is written the
// moment it appears (not only on dismiss), so navigating to another page
// doesn't re-trigger it. It also auto-hides after a few seconds if ignored.
const TEASER_DISMISS_KEY = "atc-assistant-teaser-dismissed";
const TEASER_SHOW_DELAY_MS = 6000;
const TEASER_AUTO_HIDE_MS = 12_000;
// L3 — any surface can open the assistant by dispatching this CustomEvent:
//   window.dispatchEvent(new CustomEvent("atc:open-assistant", { detail: { source } }))
const OPEN_ASSISTANT_EVENT = "atc:open-assistant";
const MSG_EASE = [0.22, 1, 0.36, 1] as const;
// W0.10 (C-36): abort a stream that goes silent — a connection that dies
// without FIN used to leave `reader.read()` pending forever, freezing the
// widget in permanent loading. Long enough for slow first tokens (~7s) plus
// the server-side finalize before `done`.
const STREAM_STALL_TIMEOUT_MS = 45_000;
// W0.10 (C-38): cap the PERSISTED history too — trimChatHistory only trims
// what is sent, while sessionStorage grew without bound until a silent
// QuotaExceeded dropped the whole conversation.
const STORED_HISTORY_MAX = 80;

type FeedbackLabels = {
  helpful: string;
  notHelpful: string;
  thanks: string;
  noted: string;
  ask: string;
  whyNot: string;
  skip: string;
};

// W3.5 — staged "thinking" copy: naming what the bot is doing (searching vs
// writing) makes the identical wait feel roughly half as long.
function stageLabels(lang: string): { searching: string; writing: string } {
  if (lang.startsWith("ko")) return { searching: "관련 정보 검색 중…", writing: "답변 작성 중…" };
  if (lang.startsWith("ja")) return { searching: "関連情報を検索中…", writing: "回答を作成中…" };
  if (lang.startsWith("es")) return { searching: "Buscando información…", writing: "Escribiendo la respuesta…" };
  if (lang.startsWith("zh")) return { searching: "正在搜索相关信息…", writing: "正在撰写回答…" };
  return { searching: "Searching our info…", writing: "Writing your answer…" };
}

function feedbackLabels(lang: string): FeedbackLabels {
  if (lang.startsWith("ko"))
    return { helpful: "도움이 됐어요", notHelpful: "도움이 안 됐어요", thanks: "고마워요!", noted: "알려줘서 고마워요", ask: "도움이 됐나요?", whyNot: "어떤 점이 아쉬웠나요?", skip: "건너뛰기" };
  if (lang.startsWith("ja"))
    return { helpful: "役に立った", notHelpful: "役に立たなかった", thanks: "ありがとうございます！", noted: "フィードバックに感謝します", ask: "役に立ちましたか？", whyNot: "どこが問題でしたか？", skip: "スキップ" };
  if (lang.startsWith("es"))
    return { helpful: "Útil", notHelpful: "No fue útil", thanks: "¡Gracias!", noted: "Gracias por tu comentario", ask: "¿Te ayudó?", whyNot: "¿Qué falló?", skip: "Omitir" };
  if (lang.startsWith("zh"))
    return { helpful: "有帮助", notHelpful: "没帮助", thanks: "谢谢！", noted: "感谢反馈", ask: "有帮助吗？", whyNot: "哪里不满意？", skip: "跳过" };
  return { helpful: "Helpful", notHelpful: "Not helpful", thanks: "Thanks!", noted: "Thanks for the feedback", ask: "Was this helpful?", whyNot: "What went wrong?", skip: "Skip" };
}

function labelsFor(lang: string, scope: AssistantScope): UiLabels {
  if (lang.startsWith("ko")) {
    return {
      badge: "Help center",
      title: scope === "site" ? "AtoC 마스터 챗봇" : "이 투어에 대해 물어보기",
      siteTitle: "AtoC Korea 전체 사이트",
      introTitle: "무엇을 도와드릴까요?",
      introBody:
        scope === "site"
          ? "전체 투어, 환불/취소, 회사 정보, 여행지 정보를 사이트 지식으로 답변합니다. 답을 확정하기 어려우면 바로 담당자에게 연결할 수 있어요."
          : "이 상품 페이지와 사이트 정책을 기준으로 답변합니다. 답이 애매하면 바로 담당자에게 연결할 수 있어요.",
      popular: "자주 묻는 질문",
      suggested: "추천 질문",
      contactSupport: "상담 연결",
      contactPromptTitle: "담당자에게 바로 연결해 드릴까요?",
      connectNow: "네, 연결해 주세요",
      notNow: "아니요",
      close: "닫기",
      send: "보내기",
      message: "메시지",
      activeSupport: "담당자 상담 연결됨",
      supportMessagePlaceholder: "담당자에게 보낼 메시지",
      questionPlaceholder: "질문을 입력하세요",
      aiNotice: "AI 답변은 실수할 수 있으니 예약 전 상세 정보를 한 번 더 확인해 주세요.",
      liveNotice: "담당자 상담 중입니다. 입력한 메시지는 Telegram으로 전달됩니다.",
      aiUnavailable: "현재 AI 챗봇 설정이 완료되지 않았습니다. 상담 연결 버튼으로 담당자에게 문의해 주세요.",
      requestFailed: (error) => `요청 처리 중 문제가 생겼습니다 (${error}). 잠시 후 다시 시도해 주세요.`,
      networkError: "네트워크 오류가 발생했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
      liveSendFailed: (error) => `담당자에게 메시지를 전달하지 못했습니다 (${error}). 잠시 후 다시 시도해 주세요.`,
      handoffFailed: (error) => `상담 연결을 접수하지 못했습니다 (${error}). 잠시 후 다시 시도해 주세요.`,
      handoffNetworkError: "네트워크 오류로 상담 연결을 접수하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
      handoffRequest: "담당자에게 연결해 주세요.",
      directSupportQuestion: "고객이 챗봇에서 상담 연결을 요청했습니다.",
      defaultQuickChips: ["어떤 투어가 있나요?", "환불 규정이 궁금해요", "제주/부산/서울 투어를 추천해 주세요"],
      teaserTitle: "AI 여행 에이전트",
      teaserBody: "투어 추천 · 견적 · 예약 조회 — 물어보세요",
      teaserCta: "대화 시작",
    };
  }

  return {
    badge: "Help center",
    title: scope === "site" ? "AtoC master assistant" : "Ask about this tour",
    siteTitle: "AtoC Korea sitewide support",
    introTitle: "How can we help?",
    introBody:
      scope === "site"
        ? "Ask about tours, refunds, company details, and Korea travel spots. If the answer needs staff confirmation, we can connect you here."
        : "Ask about this product page and site policies. If the answer needs staff confirmation, we can connect you here.",
    popular: "Popular questions",
    suggested: "Suggested",
    contactSupport: "Contact support",
    contactPromptTitle: "Would you like me to connect you with customer support?",
    connectNow: "Yes, connect me",
    notNow: "Not now",
    close: "Close",
    send: "Send",
    message: "Message",
    activeSupport: "Human support connected",
    supportMessagePlaceholder: "Message support",
    questionPlaceholder: "Type your question",
    aiNotice: "AI can make mistakes. Confirm details on the page before booking.",
    liveNotice: "Human support is active. Your messages are forwarded to Telegram.",
    aiUnavailable: "The AI assistant is not configured yet. Use Contact support to reach the team.",
    requestFailed: (error) => `Sorry, something went wrong (${error}). Please try again.`,
    networkError: "Network error. Check your connection and try again.",
    liveSendFailed: (error) => `Could not send your message to support (${error}). Please try again.`,
    handoffFailed: (error) => `Could not create a support request (${error}). Please try again.`,
    handoffNetworkError: "Network error. Could not create a support request. Please try again.",
    handoffRequest: "Please connect me with customer support.",
    directSupportQuestion: "The customer requested support from the chatbot.",
    defaultQuickChips: [
      "Which tours do you offer?",
      "What is the refund policy?",
      "Recommend a tour for Seoul, Busan, or Jeju",
    ],
    teaserTitle: "Your Korea travel agent",
    teaserBody: "Tour picks · quotes · booking lookup — ask anything",
    teaserCta: "Start chatting",
  };
}

function inferClientLanguage(): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "en";
  const firstSegment = window.location.pathname.split("/").filter(Boolean)[0];
  if (firstSegment === "ko" || firstSegment === "ja" || firstSegment === "es") return firstSegment;
  if (firstSegment === "zh-CN") return "zh";
  if (firstSegment === "zh-TW") return "zh-TW";
  return document.documentElement.lang || navigator.language || "en";
}

/**
 * W2.5 (C-13): sync the widget UI language to the CONVERSATION language.
 * The URL path only says which locale the page was opened in — a visitor on
 * the /en site writing Korean used to get Korean answers inside English
 * chrome (buttons, placeholders, checkout CTA). Positive script detection
 * only: Latin-only text ("ok", emails) never flips the UI.
 */
function langFromMessage(text: string): string | null {
  if (/\p{Script=Hangul}/u.test(text)) return "ko";
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) return "ja";
  if (/\p{Script=Han}/u.test(text)) return "zh";
  if (/[¿¡ñáéíóúü]/i.test(text)) return "es";
  return null;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="Loading" role="status">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-700/55 [animation-duration:0.9s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-700/55 [animation-delay:120ms] [animation-duration:0.9s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-700/55 [animation-delay:240ms] [animation-duration:0.9s]" />
    </div>
  );
}

/** W4.1 — horizontally-snapping rich tour cards under a recommendation. */
function TourCardStrip({ cards, uiLang }: { cards: TourCard[]; uiLang: string }) {
  const lk = langKey(uiLang);
  const cta = VIEW_TOUR_CTA[lk] ?? VIEW_TOUR_CTA.en;
  const priceFrom = PRICE_FROM[lk] ?? PRICE_FROM.en;
  return (
    <div className="-mx-1.5 mt-2.5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1.5 pb-1.5 pt-0.5">
      {cards.map((card) => {
        // Deep-audit 2026-07-05: validate href at render (defence-in-depth vs a
        // tampered sessionStorage entry) — the same guard the checkout button
        // gets. An unsafe/unknown href drops the card rather than link to it.
        const safe = safeChatHref(card.href);
        if (!safe) return null;
        return (
        <a
          key={card.slug}
          href={safe.href}
          {...(safe.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="w-[11.5rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-900/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <div className="relative h-24 w-full bg-slate-100">
            <Image src={card.image_url} alt={card.title} fill sizes="184px" className="object-cover" />
          </div>
          <div className="px-3 pb-3 pt-2.5">
            <p className="line-clamp-2 min-h-[2.1rem] text-[12px] font-bold leading-snug text-slate-950">
              {card.title}
            </p>
            <p className="mt-1 text-[10.5px] text-slate-500">
              {card.duration}
              {card.rating > 0 ? (
                <>
                  {" "}· <span className="text-amber-500">★</span> {card.rating} ({card.review_count})
                </>
              ) : null}
            </p>
            {card.price_from_usd > 0 ? (
              <p className="mt-1.5 text-[12.5px] font-bold text-slate-950">
                {priceFrom(card.price_from_usd)}
                {card.compare_at_usd ? (
                  <span className="ml-1 text-[10px] font-medium text-slate-400 line-through">
                    ${card.compare_at_usd}
                  </span>
                ) : null}
              </p>
            ) : null}
            <span className="mt-2 flex items-center justify-center gap-1 rounded-full bg-sky-950 py-1.5 text-[11px] font-semibold text-white">
              {cta}
              <ArrowRight className="h-3 w-3" aria-hidden />
            </span>
          </div>
        </a>
        );
      })}
    </div>
  );
}

/**
 * W2.3 — tap controls for the quote slot prompt: region buttons, native date
 * picker, party stepper, hours slider (+ Jeju pickup zone / cruise port when
 * relevant). Submit composes a short English summary message — deterministic
 * tokens the server-side slot extractor maps 1:1 back onto the slot enums.
 */
function QuoteSlotControls({
  req,
  uiLang,
  disabled,
  onSubmit,
}: {
  req: SlotRequest;
  uiLang: string;
  disabled: boolean;
  onSubmit: (text: string) => void;
}) {
  const L = SLOT_UI[langKey(uiLang)] ?? SLOT_UI.en;
  const track = req.known.track ?? "private";
  const [region, setRegion] = useState<string | null>(req.known.region);
  const [date, setDate] = useState<string>(req.known.date ?? "");
  const [party, setParty] = useState<number>(req.known.party ?? 2);
  const [hours, setHours] = useState<number>(req.known.duration_hours ?? 8);
  const [pickup, setPickup] = useState<string | null>(req.known.jeju_pickup_zone);
  const [port, setPort] = useState<string | null>(req.known.cruise_port);

  const needsPickup = region === "jeju" && track !== "cruise";
  const needsPort = region === "jeju" && track === "cruise";
  const ready = Boolean(
    region && date && party >= 1 && hours >= 4 && (!needsPickup || pickup) && (!needsPort || port),
  );

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const minDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const submit = () => {
    if (!ready || !region) return;
    const zoneToken: Record<string, string> = {
      city: "downtown (city) pickup",
      out_west: "hotel in west Jeju (out_west)",
      out_east: "hotel in east Jeju (out_east)",
      out_south: "hotel in south Jeju (out_south)",
    };
    const parts = [
      region.charAt(0).toUpperCase() + region.slice(1),
      date,
      `${party} people`,
      `${hours} hours`,
    ];
    if (needsPickup && pickup && zoneToken[pickup]) parts.push(zoneToken[pickup]);
    if (needsPort && port) {
      parts.push(port === "gangjeong" ? "cruise docking at Gangjeong port" : "cruise docking at Jeju Port");
    }
    onSubmit(parts.join(", "));
  };

  const optionClass = (selected: boolean) =>
    cn(
      "rounded-xl border px-2 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
      selected
        ? "border-sky-950 bg-sky-950 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:border-sky-900/35 hover:bg-sky-50",
    );

  return (
    <div className="mt-2.5 border-t border-slate-100 pt-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{L.region}</p>
      <div className="mt-1 flex gap-1.5">
        {L.regions.map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => setRegion(value)}
            className={cn("flex-1", optionClass(region === value))}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="date"
          value={date}
          min={minDate}
          disabled={disabled}
          onChange={(e) => setDate(e.target.value)}
          aria-label={L.date}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-950 outline-none transition focus:border-sky-900/40 disabled:opacity-45"
        />
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1">
          <button
            type="button"
            disabled={disabled || party <= 1}
            onClick={() => setParty((p) => Math.max(1, p - 1))}
            aria-label={`${L.party} −`}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-600 transition enabled:hover:bg-slate-100 disabled:opacity-35"
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="flex min-w-[2.4rem] items-center justify-center gap-1 text-[12px] font-semibold text-slate-950">
            <Users className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {party}
          </span>
          <button
            type="button"
            disabled={disabled || party >= 15}
            onClick={() => setParty((p) => Math.min(15, p + 1))}
            aria-label={`${L.party} +`}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-600 transition enabled:hover:bg-slate-100 disabled:opacity-35"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {L.hours}
        </span>
        <input
          type="range"
          min={4}
          max={10}
          step={1}
          value={hours}
          disabled={disabled}
          onChange={(e) => setHours(Number(e.target.value))}
          aria-label={L.hours}
          className="h-1.5 min-w-0 flex-1 accent-sky-950"
        />
        <span className="w-7 shrink-0 text-right text-[12px] font-semibold text-slate-950">{hours}h</span>
      </div>
      {needsPickup ? (
        <>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{L.pickup}</p>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {L.zones.map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => setPickup(value)}
                className={optionClass(pickup === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {needsPort ? (
        <>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{L.port}</p>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {L.ports.map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => setPort(value)}
                className={optionClass(port === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <button
        type="button"
        disabled={disabled || !ready}
        onClick={submit}
        className="mt-2.5 w-full rounded-full bg-sky-950 py-2 text-[12px] font-bold text-white transition enabled:hover:bg-sky-900 disabled:opacity-40"
      >
        {L.submit}
      </button>
    </div>
  );
}

/** Deep-audit 2026-07-05 — restore-time shape guards (see readStoredMessages). */
function sanitizeRestoredCards(raw: unknown): TourCard[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const clean = raw.filter(
    (c): c is TourCard =>
      Boolean(c) &&
      typeof c === "object" &&
      typeof (c as TourCard).slug === "string" &&
      typeof (c as TourCard).title === "string" &&
      typeof (c as TourCard).href === "string" &&
      typeof (c as TourCard).image_url === "string" &&
      // image_url must be a same-origin path or an https URL — next/image throws
      // at render for anything else, which would crash the whole widget.
      (/^\/(?!\/)/.test((c as TourCard).image_url) || /^https:\/\//i.test((c as TourCard).image_url)),
  );
  return clean.length > 0 ? clean : undefined;
}

function sanitizeRestoredSlotRequest(raw: unknown): SlotRequest | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const known = (raw as SlotRequest).known;
  if (!known || typeof known !== "object" || Array.isArray(known)) return undefined;
  return raw as SlotRequest;
}

function readStoredMessages(storageKey: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m === "object" && typeof (m as ChatMessage).content === "string")
      .slice(-STORED_HISTORY_MAX)
      .map((m) => ({
        role: (m as ChatMessage).role === "assistant" ? "assistant" : "user",
        content: (m as ChatMessage).content,
        origin: (m as ChatMessage).origin,
        supportMessageId:
          typeof (m as ChatMessage).supportMessageId === "number" ? (m as ChatMessage).supportMessageId : undefined,
        // Deep-audit 2026-07-05: checkoutUrl was dropped on restore, so after
        // any navigation the "Go to checkout →" button vanished (the trust
        // badge stayed) — a dead end on the highest-value turn. Re-validated
        // through safeCheckoutUrl on the way back in.
        checkoutUrl: safeCheckoutUrl((m as ChatMessage).checkoutUrl) ?? undefined,
        // W4.1/W4.3/W2.3 — keep the rich-UX payloads across page navigations.
        // Deep-audit 2026-07-05: SHAPE-validate on restore. A malformed
        // persisted entry (schema drift across a mid-session deploy, or
        // tampering) used to reach QuoteSlotControls (req.known.track) or
        // TourCardStrip (<Image src>) and throw at render — and since the same
        // storage is re-read on every page, the widget then crashed everywhere
        // until sessionStorage was cleared. Drop bad entries instead.
        cards: sanitizeRestoredCards((m as ChatMessage).cards),
        chips: Array.isArray((m as ChatMessage).chips)
          ? (m as ChatMessage).chips!.filter((c): c is string => typeof c === "string")
          : undefined,
        slotRequest: sanitizeRestoredSlotRequest((m as ChatMessage).slotRequest),
        sources: Array.isArray((m as ChatMessage).sources)
          ? (m as ChatMessage).sources!.filter(
              (s): s is AnswerSource => Boolean(s) && typeof s === "object" && typeof s.label === "string",
            )
          : undefined,
        quoteTrust: (m as ChatMessage).quoteTrust === true || undefined,
      }));
  } catch {
    return [];
  }
}

function readStoredTicketId(storageKey: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(`${LIVE_TICKET_PREFIX}${storageKey}`);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** W4.7 — read the global conversation, adopting any legacy per-page one. */
function readStoredMessagesGlobal(apiSlug: string): ChatMessage[] {
  const globalMsgs = readStoredMessages(GLOBAL_STORAGE_KEY);
  if (globalMsgs.length > 0) return globalMsgs;
  const legacy = readStoredMessages(apiSlug);
  if (legacy.length > 0) return legacy; // re-persisted under the global key by the save effect
  return apiSlug === SITE_ASSISTANT_SLUG ? [] : readStoredMessages(SITE_ASSISTANT_SLUG);
}

function readStoredTicketIdGlobal(apiSlug: string): number | null {
  return (
    readStoredTicketId(GLOBAL_STORAGE_KEY) ??
    readStoredTicketId(apiSlug) ??
    (apiSlug === SITE_ASSISTANT_SLUG ? null : readStoredTicketId(SITE_ASSISTANT_SLUG))
  );
}

export function TourProductAiAssistantWidget({
  tourProductSlug,
  productTitle,
  supportQuickChips,
  assistantScope,
  placement = "tour",
}: TourProductAiAssistantWidgetProps) {
  const scope: AssistantScope = assistantScope ?? (tourProductSlug ? "tour" : "site");
  // apiSlug drives the per-page CONTEXT sent to the server; storage is global (W4.7).
  const apiSlug = tourProductSlug || SITE_ASSISTANT_SLUG;
  const storageKey = GLOBAL_STORAGE_KEY;
  const [uiLang, setUiLang] = useState("en");
  const labels = useMemo(() => labelsFor(uiLang, scope), [scope, uiLang]);
  const fb = useMemo(() => feedbackLabels(uiLang), [uiLang]);
  const quickChips = useMemo(
    () => (supportQuickChips && supportQuickChips.length > 0 ? supportQuickChips : labels.defaultQuickChips),
    [labels.defaultQuickChips, supportQuickChips],
  );

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // W3.5 — which phase the pending assistant turn is in (null = generic dots).
  const [loadingStage, setLoadingStage] = useState<"searching" | "writing" | null>(null);
  const [handoffOffer, setHandoffOffer] = useState<{ question: string } | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(() => readStoredTicketIdGlobal(apiSlug));
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredMessagesGlobal(apiSlug));
  const [feedback, setFeedback] = useState<Record<number, 1 | -1>>({});
  const listRef = useRef<HTMLDivElement>(null);
  // W4.5 — the dialog element itself takes initial focus on open (keyboard
  // users can Tab from there; no virtual-keyboard popup on mobile).
  const panelRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const lastSupportMessageIdRef = useRef(0);
  // W0.10 (C-15/C-36): the in-flight assistant request. Aborted when a new
  // request starts, when the panel closes, and on unmount — the server stops
  // generating (req.signal.aborted) instead of burning tokens for nobody.
  const abortRef = useRef<AbortController | null>(null);
  // W4.2 — the exact message list of the last assistant request, so a failure
  // bubble can offer one-tap retry instead of forcing a retype.
  const lastRequestRef = useRef<ChatMessage[] | null>(null);
  const liveSupportActive = activeTicketId !== null && liveStatus !== "resolved" && liveStatus !== "closed";
  const title = productTitle?.trim() || labels.siteTitle;

  // L1 (chatbot promo) — idle teaser bubble state. Only ever shown on the
  // global/landing placement (see effect below).
  const [teaserVisible, setTeaserVisible] = useState(false);

  useEffect(() => {
    setUiLang(inferClientLanguage());
  }, []);

  // W0.10 — abort the in-flight stream when the panel closes or the widget
  // unmounts; the visitor left, so stop the server-side generation too.
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);
  // W4.5 — move focus into the dialog when it opens (after the entry motion).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => panelRef.current?.focus(), 260);
    return () => window.clearTimeout(id);
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const dismissTeaser = useCallback(() => {
    setTeaserVisible(false);
    try {
      window.sessionStorage.setItem(TEASER_DISMISS_KEY, "1");
    } catch {
      /* private mode / storage blocked — fine, teaser just won't persist */
    }
  }, []);

  // L1 — surface the teaser after a short idle so it reads as an invitation,
  // not a load-time pop-up. Global placement only; never while the panel is
  // open; at most once per session (marked shown on appear, not on dismiss);
  // auto-hides after a few seconds so it never lingers over content.
  useEffect(() => {
    if (placement !== "global" || typeof window === "undefined") return;
    if (open) return;
    try {
      if (window.sessionStorage.getItem(TEASER_DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked — still allow the teaser */
    }
    let hideId: number | null = null;
    const showId = window.setTimeout(() => {
      setTeaserVisible(true);
      try {
        window.sessionStorage.setItem(TEASER_DISMISS_KEY, "1");
      } catch {
        /* storage blocked — worst case it shows again on the next page */
      }
      hideId = window.setTimeout(() => setTeaserVisible(false), TEASER_AUTO_HIDE_MS);
    }, TEASER_SHOW_DELAY_MS);
    return () => {
      window.clearTimeout(showId);
      if (hideId) window.clearTimeout(hideId);
    };
  }, [placement, open]);

  // L3 — let any surface (hero CTA, "추천받기" card, sticky CTA) open the
  // assistant by dispatching `atc:open-assistant`. The widget otherwise has no
  // external open affordance besides its own FAB.
  useEffect(() => {
    function onExternalOpen() {
      setOpen(true);
      setTeaserVisible(false);
    }
    window.addEventListener(OPEN_ASSISTANT_EVENT, onExternalOpen as EventListener);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onExternalOpen as EventListener);
  }, []);

  const pageContext = useCallback(
    () =>
      typeof window !== "undefined"
        ? {
            url: window.location.href.slice(0, 2000),
            title: document.title?.slice(0, 400) ?? undefined,
            section: window.location.hash ? window.location.hash.replace(/^#/, "").slice(0, 80) : undefined,
          }
        : undefined,
    [],
  );

  // W5.3 — message index awaiting an optional thumbs-down reason chip.
  const [pendingReasonIdx, setPendingReasonIdx] = useState<number | null>(null);

  const postFeedback = useCallback(
    (index: number, rating: 1 | -1, reason?: string) => {
      const answer = messages[index]?.content ?? "";
      if (!answer) return;
      const question = index > 0 && messages[index - 1]?.role === "user" ? messages[index - 1].content : undefined;
      void fetch("/api/tour-product/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          answer,
          question,
          reason,
          tourProductSlug: apiSlug,
          pageUrl: typeof window !== "undefined" ? window.location.href.slice(0, 2000) : undefined,
        }),
      }).catch(() => {
        /* best-effort; keep the optimistic UI */
      });
    },
    [messages, apiSlug],
  );

  const sendFeedback = useCallback(
    (index: number, rating: 1 | -1) => {
      if (feedback[index]) return; // one vote per message
      setFeedback((prev) => ({ ...prev, [index]: rating }));
      if (rating === 1) {
        postFeedback(index, 1);
        return;
      }
      // W5.3 — hold the 👎 POST until the (optional) reason chip, so the row
      // lands once WITH its reason. Skipping still records the bare rating.
      setPendingReasonIdx(index);
    },
    [feedback, postFeedback],
  );

  const submitNegativeReason = useCallback(
    (index: number, reason: string | null) => {
      setPendingReasonIdx((prev) => (prev === index ? null : prev));
      postFeedback(index, -1, reason ?? undefined);
    },
    [postFeedback],
  );

  const runAssistant = useCallback(
    async (next: ChatMessage[]) => {
      lastRequestRef.current = next;
      // W0.10: one in-flight request at a time; a stalled stream self-aborts.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      let timedOut = false;
      let watchdog: number | null = null;
      const kickWatchdog = () => {
        if (watchdog) window.clearTimeout(watchdog);
        watchdog = window.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, STREAM_STALL_TIMEOUT_MS);
      };

      setLoading(true);
      setLoadingStage("searching");
      try {
        kickWatchdog();
        const res = await fetch("/api/tour-product/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            assistantScope: scope,
            tourProductSlug: apiSlug,
            messages: trimChatHistory(next),
            pageContext: pageContext(),
            stream: true,
          }),
        });

        // Headers arrived → retrieval is done server-side; the model is writing.
        setLoadingStage("writing");

        // Content negotiation (D-T2-1): the server streams SSE only for a
        // free-form model answer. Deterministic gates, fallbacks, and older
        // servers reply with JSON — fall through to the buffered path below.
        const contentType = res.headers.get("content-type") || "";
        if (res.ok && contentType.includes("text/event-stream") && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          const lastUserQuestion =
            [...next].reverse().find((m) => m.role === "user")?.content ?? "";
          // Rebuild the tail each update so deltas grow a single bubble rather
          // than appending many.
          const renderAssistant = (content: string, extra?: Partial<ChatMessage>) =>
            setMessages(() => [...next, { role: "assistant", content, origin: "ai", ...extra }]);

          let buffer = "";
          let streamed = "";
          let started = false;
          let settled = false;
          try {
            for (;;) {
              const { done, value } = await reader.read();
              kickWatchdog(); // any progress resets the stall timer
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const { events, rest } = parseSseBuffer(buffer);
              buffer = rest;
              for (const ev of events) {
                // W0.8 (C-34): a single malformed SSE payload used to throw an
                // uncaught SyntaxError here and freeze the widget in a
                // permanent loading state. Broken chunks are skipped; a broken
                // `done` falls back to the streamed buffer.
                if (ev.event === "delta") {
                  let text = "";
                  try {
                    text = (JSON.parse(ev.data) as { text?: string }).text ?? "";
                  } catch {
                    continue;
                  }
                  if (!text) continue;
                  streamed += text;
                  // First token: drop the typing indicator, show the bubble.
                  if (!started) {
                    started = true;
                    setLoading(false);
                  }
                  renderAssistant(streamed);
                } else if (ev.event === "done") {
                  // done.reply is authoritative (D-T2-4): snap the bubble to it.
                  let payload: AssistantResponse = {};
                  try {
                    payload = JSON.parse(ev.data) as AssistantResponse;
                  } catch {
                    payload = {};
                  }
                  const finalText = payload.reply ?? streamed;
                  if (!finalText) continue; // broken done + nothing streamed → dropped-connection guard below
                  settled = true;
                  renderAssistant(finalText, {
                    checkoutUrl: safeCheckoutUrl(payload.checkout_url) ?? undefined,
                    cards: payload.cards,
                    chips: payload.chips,
                    slotRequest: payload.slot_request,
                    sources: payload.sources,
                    quoteTrust: payload.quote_trust,
                  });
                  setHandoffOffer(payload.handoff_offered ? { question: lastUserQuestion } : null);
                  if (payload.ticket_id && payload.escalated) {
                    setActiveTicketId(payload.ticket_id);
                    setLiveStatus("open");
                  }
                } else if (ev.event === "error") {
                  settled = true;
                  setHandoffOffer(null);
                  renderAssistant(labels.requestFailed("assistant_failed"), { origin: "system", retriable: true });
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          // Stream ended with neither done nor error and nothing rendered
          // (dropped connection): surface a network error.
          if (!settled && !started) {
            setHandoffOffer(null);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: labels.networkError, origin: "system", retriable: true },
            ]);
          }
          return;
        }

        const data = (await res.json()) as AssistantResponse;
        if (!res.ok) {
          const err = data.message || data.error || "Request failed";
          setHandoffOffer(null);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                res.status === 429
                  ? rateLimitMessage(uiLang, Math.max(5, Number(res.headers.get("Retry-After")) || 30))
                  : res.status === 503
                    ? labels.aiUnavailable
                    : labels.requestFailed(err),
              origin: "system",
              retriable: res.status !== 503,
            },
          ]);
          return;
        }
        if (data.reply) {
          setMessages([
            ...next,
            {
              role: "assistant",
              content: data.reply,
              origin: "ai",
              checkoutUrl: safeCheckoutUrl(data.checkout_url) ?? undefined,
              cards: data.cards,
              chips: data.chips,
              slotRequest: data.slot_request,
              sources: data.sources,
              quoteTrust: data.quote_trust,
            },
          ]);
          const lastUserQuestion = [...next].reverse().find((m) => m.role === "user")?.content ?? "";
          setHandoffOffer(data.handoff_offered ? { question: lastUserQuestion } : null);
          if (data.ticket_id && data.escalated) {
            setActiveTicketId(data.ticket_id);
            setLiveStatus("open");
          }
        }
      } catch (err) {
        // User-initiated abort (panel closed / superseded request) is silent;
        // a watchdog timeout surfaces the network-error bubble.
        if ((err as Error)?.name === "AbortError" && !timedOut) return;
        setHandoffOffer(null);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: labels.networkError, origin: "system", retriable: true },
        ]);
      } finally {
        if (watchdog) window.clearTimeout(watchdog);
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
        setLoadingStage(null);
      }
    },
    [labels, pageContext, scope, apiSlug, uiLang],
  );

  const applyLiveSupportMessages = useCallback((incoming: LiveSupportMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.supportMessageId).filter((id): id is number => typeof id === "number"));
      const nextMessages = incoming
        .filter((m) => !seen.has(m.id))
        .map<ChatMessage>((m) => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.content,
          origin: m.sender === "admin" ? "admin" : m.sender === "system" ? "system" : "support_user",
          supportMessageId: m.id,
        }));
      return nextMessages.length > 0 ? [...prev, ...nextMessages] : prev;
    });
  }, []);

  const sendLiveSupportMessage = useCallback(
    async (text: string) => {
      if (!activeTicketId) return;
      setLoading(true);
      try {
        const res = await fetch("/api/tour-product/assistant/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: activeTicketId,
            content: text,
          }),
        });
        const data = (await res.json()) as LiveSupportResponse;
        if (!res.ok) {
          const err = data.error || "Request failed";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: labels.liveSendFailed(err), origin: "system" },
          ]);
          return;
        }
        if (data.ticket_id) setActiveTicketId(data.ticket_id);
        if (data.message) {
          setMessages((prev) =>
            prev.map((m, idx) =>
              idx === prev.length - 1 && m.role === "user" && m.content === text && !m.supportMessageId
                ? { ...m, origin: "support_user" as const, supportMessageId: data.message!.id }
                : m,
            ),
          );
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: labels.liveSendFailed("network_error"), origin: "system" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [activeTicketId, labels],
  );

  const requestHumanSupport = useCallback(
    async (question?: string) => {
      if (loading || liveSupportActive) return;
      const latestUserQuestion =
        question?.trim() ||
        [...messages].reverse().find((m) => m.role === "user" && m.content.trim())?.content ||
        labels.directSupportQuestion;
      const next: ChatMessage[] = [...messages, { role: "user", content: labels.handoffRequest }];

      setHandoffOffer(null);
      setMessages(next);
      setLoading(true);

      try {
        const res = await fetch("/api/tour-product/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assistantScope: scope,
            tourProductSlug: apiSlug,
            messages: next,
            handoffRequested: true,
            handoffQuestion: latestUserQuestion,
            pageContext: pageContext(),
          }),
        });
        const data = (await res.json()) as AssistantResponse;
        if (!res.ok) {
          const err = data.message || data.error || "Request failed";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: labels.handoffFailed(err), origin: "system" },
          ]);
          return;
        }
        if (data.reply) {
          setMessages([...next, { role: "assistant", content: data.reply, origin: "system" }]);
        }
        if (data.ticket_id) {
          setActiveTicketId(data.ticket_id);
          setLiveStatus("open");
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: labels.handoffNetworkError, origin: "system" },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [labels, liveSupportActive, loading, messages, pageContext, scope, apiSlug],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    // W5.3 — moving on without picking a 👎 reason still records the rating.
    if (pendingReasonIdx !== null) submitNegativeReason(pendingReasonIdx, null);
    // W2.5 — follow the conversation language (positive script hits only).
    const msgLang = langFromMessage(text);
    if (msgLang && !uiLang.startsWith(msgLang)) setUiLang(msgLang);
    setInput("");
    setHandoffOffer(null);
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: text, origin: liveSupportActive ? "support_user" : undefined },
    ];
    setMessages(next);
    if (liveSupportActive) {
      await sendLiveSupportMessage(text);
      return;
    }
    await runAssistant(next);
  }, [input, liveSupportActive, loading, messages, pendingReasonIdx, runAssistant, sendLiveSupportMessage, submitNegativeReason, uiLang]);

  const sendPreset = useCallback(
    async (text: string) => {
      const preset = text.trim();
      if (!preset || loading || liveSupportActive) return;
      if (pendingReasonIdx !== null) submitNegativeReason(pendingReasonIdx, null);
      setHandoffOffer(null);
      const next: ChatMessage[] = [...messages, { role: "user", content: preset }];
      setMessages(next);
      await runAssistant(next);
    },
    [liveSupportActive, loading, messages, pendingReasonIdx, runAssistant, submitNegativeReason],
  );

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        `${STORAGE_PREFIX}${storageKey}`,
        JSON.stringify(messages.slice(-STORED_HISTORY_MAX)),
      );
    } catch {
      // Ignore unavailable sessionStorage.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    try {
      if (activeTicketId) {
        window.sessionStorage.setItem(`${LIVE_TICKET_PREFIX}${storageKey}`, String(activeTicketId));
      } else {
        window.sessionStorage.removeItem(`${LIVE_TICKET_PREFIX}${storageKey}`);
      }
    } catch {
      // Ignore unavailable sessionStorage.
    }
  }, [activeTicketId, storageKey]);

  useEffect(() => {
    lastSupportMessageIdRef.current = messages.reduce(
      (max, m) => Math.max(max, typeof m.supportMessageId === "number" ? m.supportMessageId : 0),
      0,
    );
  }, [messages]);

  useEffect(() => {
    if (!activeTicketId) return;
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          ticketId: String(activeTicketId),
          afterId: String(lastSupportMessageIdRef.current),
        });
        const res = await fetch(`/api/tour-product/assistant/live?${params.toString()}`, {
          credentials: "same-origin",
        });
        const data = (await res.json()) as LiveSupportResponse;
        if (cancelled || !res.ok) return;
        if (data.ticket === null) {
          setActiveTicketId(null);
          setLiveStatus(null);
          return;
        }
        if (data.messages) applyLiveSupportMessages(data.messages);
        if (data.ticket?.status) {
          setLiveStatus(data.ticket.status);
          if (data.ticket.status === "resolved" || data.ticket.status === "closed") {
            setActiveTicketId(null);
          }
        }
      } catch {
        // Keep polling; transient network drops should not end the chat.
      }
    };

    void poll();
    timer = window.setInterval(() => void poll(), 1500);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [activeTicketId, applyLiveSupportMessages]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages, loading, handoffOffer, activeTicketId]);

  const chipsDisabled = loading || liveSupportActive;
  // W4.3 — when the latest reply carries its own contextual chips or slot
  // controls, the generic "Suggested" strip below would compete with them.
  const lastMessage = messages[messages.length - 1];
  const contextualUiActive =
    lastMessage?.role === "assistant" &&
    Boolean((lastMessage.chips?.length ?? 0) > 0 || lastMessage.slotRequest);
  const bottomClass =
    placement === "tour"
      ? "bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))]"
      : // Mobile: stack ABOVE FloatingLanguageToggle (which sits at
        // bottom+80px and is ~44px tall) — 8.5rem clears it with a
        // 12px breathing gap. Desktop keeps bottom-5 since the lang
        // toggle is md:hidden and never competes.
        "bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-5";

  return (
    <div
      className={cn("pointer-events-none fixed right-3 z-[65] flex flex-col items-end sm:right-5", bottomClass)}
      data-tour-assistant-root
    >
      <AnimatePresence mode="wait">
        {open && (
        <motion.div
          // framer-motion v12 requires a stable `key` on the direct child
          // of AnimatePresence for exit detection to fire reliably. With
          // no key, the exit animation was being skipped on the unmount.
          key="chatbot-panel"
          // Emerges from the button's bottom-right corner — small scale +
          // soft slide + fade, eased with MSG_EASE so it feels intentional
          // rather than abrupt. Exit is slightly faster (panel disappears
          // first, button stays). reduce-motion respected via the
          // motion-reduce check on the parent root.
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.22, ease: MSG_EASE },
          }}
          exit={{
            opacity: 0,
            scale: 0.96,
            y: 6,
            transition: { duration: 0.16, ease: MSG_EASE },
          }}
          // W4.4 — dvh keeps the panel fully visible when the mobile keyboard
          // resizes the visual viewport (vh stays stale on iOS/Android).
          className="pointer-events-auto mb-3 flex max-h-[min(78vh,36rem)] w-[min(100vw-1.5rem,26rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_64px_-12px_rgba(26,35,50,0.22),0_0_0_1px_rgba(26,35,50,0.05)] supports-[height:1dvh]:max-h-[min(78dvh,36rem)]"
          role="dialog"
          aria-modal="true"
          aria-label={labels.title}
          tabIndex={-1}
          ref={panelRef}
          // W4.5 — keyboard support: Escape closes, Tab stays inside the panel.
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
              return;
            }
            if (e.key !== "Tab") return;
            const focusables = e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="relative shrink-0 border-b border-sky-900/10 bg-gradient-to-r from-sky-50 via-white to-amber-50 px-4 pb-3.5 pt-3.5">
            <div className="absolute right-2 top-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/90 hover:text-slate-950"
                aria-label={labels.close}
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-950 text-white shadow-md ring-2 ring-white/70">
                <ChatBotAvatar className="h-7 w-7 text-white" />
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="inline-flex items-center gap-1 rounded-full border border-sky-900/15 bg-white/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-900">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  {labels.badge}
                </div>
                <h2 className="mt-1.5 text-sm font-bold leading-tight tracking-tight text-slate-950">
                  {labels.title}
                </h2>
                {liveSupportActive && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    {labels.activeSupport}
                  </div>
                )}
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500" title={title}>
                  {title}
                </p>
              </div>
            </div>
          </div>

          <div
            ref={listRef}
            // W4.5 — role="log": screen readers announce appended messages
            // without re-reading the whole thread.
            role="log"
            aria-live="polite"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-3.5 py-3.5 [scrollbar-gutter:stable]"
          >
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-sky-900/20 bg-white/90 px-3.5 py-3.5 text-[12.5px] leading-relaxed text-slate-600 shadow-sm">
                <p className="font-semibold text-slate-950">{labels.introTitle}</p>
                <p className="mt-1.5 text-[12px] text-slate-600">{labels.introBody}</p>
                {!liveSupportActive && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void requestHumanSupport()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-950 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Headphones className="h-3.5 w-3.5" aria-hidden />
                    {labels.contactSupport}
                  </button>
                )}
                {quickChips.length > 0 && !liveSupportActive && (
                  <div className="mt-3 flex flex-col gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {labels.popular}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {quickChips.map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={chipsDisabled}
                          onClick={() => void sendPreset(q)}
                          className="max-w-full rounded-full border border-sky-900/20 bg-white px-3 py-1.5 text-left text-[11px] font-medium leading-snug text-sky-900 shadow-sm transition hover:border-sky-900/40 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <motion.div
                    key={`u-${i}-${m.content.slice(0, 64)}`}
                    className="flex justify-end pl-6"
                    initial={{ opacity: 0, y: 14, filter: "blur(2px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.55, ease: MSG_EASE }}
                  >
                    <div className="max-w-[92%] rounded-2xl rounded-br-md bg-sky-950 px-3.5 py-2.5 text-left text-[13px] font-medium leading-relaxed text-white shadow-md">
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`a-${i}-${m.content.slice(0, 64)}`}
                    className="flex justify-start pr-2"
                    initial={{ opacity: 0, y: 16, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.62, ease: MSG_EASE }}
                  >
                    <div className="max-w-[96%] rounded-2xl rounded-bl-md border border-white/90 bg-white px-3.5 py-2.5 text-[13px] leading-[1.55] text-slate-900 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70">
                      {(m.origin === "admin" || m.origin === "system") && (
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-sky-800/75">
                          {m.origin === "admin" ? labels.contactSupport : "Support"}
                        </span>
                      )}
                      <ChatMarkdown text={m.content} />
                      {m.quoteTrust ? (
                        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[10.5px] font-medium leading-snug text-emerald-800 ring-1 ring-emerald-200/70">
                          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          {TRUST_LINE[langKey(uiLang)] ?? TRUST_LINE.en}
                        </p>
                      ) : null}
                      {m.cards && m.cards.length > 0 ? (
                        <TourCardStrip cards={m.cards} uiLang={uiLang} />
                      ) : null}
                      {m.slotRequest && i === messages.length - 1 && !liveSupportActive ? (
                        <QuoteSlotControls
                          req={m.slotRequest}
                          uiLang={uiLang}
                          disabled={loading}
                          onSubmit={(t) => void sendPreset(t)}
                        />
                      ) : null}
                      {m.chips && m.chips.length > 0 && i === messages.length - 1 && !loading && !liveSupportActive ? (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                          {m.chips.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              disabled={chipsDisabled}
                              onClick={() => void sendPreset(chip)}
                              className="max-w-full rounded-full border border-sky-900/20 bg-white px-3 py-1.5 text-left text-[11px] font-medium leading-snug text-sky-900 shadow-sm transition hover:border-sky-900/40 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {m.retriable && i === messages.length - 1 && !loading && lastRequestRef.current ? (
                        <button
                          type="button"
                          onClick={() => {
                            const request = lastRequestRef.current;
                            if (!request) return;
                            setMessages(request);
                            void runAssistant(request);
                          }}
                          className="mt-2 inline-flex items-center gap-1 rounded-full border border-sky-900/25 bg-white px-3 py-1.5 text-[11px] font-semibold text-sky-900 transition hover:bg-sky-50"
                        >
                          {RETRY_LABEL[uiLang] ?? RETRY_LABEL.en}
                        </button>
                      ) : null}
                      {safeCheckoutUrl(m.checkoutUrl) ? (
                        <a
                          href={safeCheckoutUrl(m.checkoutUrl)!}
                          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          {CHECKOUT_CTA[uiLang] ?? CHECKOUT_CTA.en}
                        </a>
                      ) : null}
                      {m.sources && m.sources.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">
                            {SOURCES_LABEL[langKey(uiLang)] ?? SOURCES_LABEL.en}
                          </span>
                          {m.sources.map((s) => {
                            // Deep-audit 2026-07-05: validate at render too, not
                            // just server-side, so a tampered persisted source
                            // can't become a javascript: link.
                            const safe = safeChatHref(s.href);
                            return safe ? (
                              <a
                                key={`${s.type}-${s.label}`}
                                href={safe.href}
                                {...(safe.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition hover:bg-sky-50 hover:text-sky-900"
                              >
                                {s.label}
                              </a>
                            ) : (
                              <span
                                key={`${s.type}-${s.label}`}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                {s.label}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                      {(!m.origin || m.origin === "ai") && (
                        <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                          {feedback[i] ? (
                            pendingReasonIdx === i ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-medium text-slate-500">{fb.whyNot}</span>
                                {negativeReasons(uiLang).map(([key, label]) => (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => submitNegativeReason(i, key)}
                                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    {label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => submitNegativeReason(i, null)}
                                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-slate-400 transition hover:text-slate-600"
                                >
                                  {fb.skip}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500">
                                {feedback[i] === 1 ? fb.thanks : fb.noted}
                              </span>
                            )
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {i === messages.length - 1 && !loading ? (
                                <span className="text-[10px] font-medium text-slate-500">{fb.ask}</span>
                              ) : null}
                              <button
                                type="button"
                                aria-label={fb.helpful}
                                title={fb.helpful}
                                onClick={() => sendFeedback(i, 1)}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label={fb.notHelpful}
                                title={fb.notHelpful}
                                onClick={() => sendFeedback(i, -1)}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ),
              )}
            </AnimatePresence>

            {loading && (
              <motion.div
                className="flex justify-start pr-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: MSG_EASE }}
              >
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/80 bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200/60">
                  <TypingDots />
                  {loadingStage && (
                    <span className="text-[11px] font-medium text-slate-400" aria-live="polite">
                      {stageLabels(uiLang)[loadingStage]}
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {handoffOffer && !loading && !liveSupportActive && (
              <motion.div
                className="flex justify-start pr-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: MSG_EASE }}
              >
                <div className="max-w-[96%] rounded-2xl border border-sky-900/20 bg-white px-3.5 py-3 text-[12px] leading-relaxed text-slate-900 shadow-sm">
                  <p className="font-semibold">{labels.contactPromptTitle}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void requestHumanSupport(handoffOffer.question)}
                      className="rounded-full bg-sky-950 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-sky-900"
                    >
                      {labels.connectNow}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandoffOffer(null)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      {labels.notNow}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {messages.length > 0 && quickChips.length > 0 && !liveSupportActive && !contextualUiActive && (
            <div className="shrink-0 border-t border-slate-200/70 bg-white/95 px-2.5 pb-1 pt-2">
              <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{labels.suggested}</p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void requestHumanSupport()}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-900/15 bg-white px-2.5 py-1 text-[10px] font-semibold text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Headphones className="h-3 w-3" aria-hidden />
                  {labels.contactSupport}
                </button>
              </div>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1.5 pt-0.5 [scrollbar-gutter:stable]">
                {quickChips.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={chipsDisabled}
                    onClick={() => void sendPreset(q)}
                    className="shrink-0 max-w-[min(18rem,78vw)] rounded-full border border-sky-900/20 bg-sky-50 px-3 py-1.5 text-left text-[10.5px] font-medium leading-snug text-sky-950 transition hover:border-sky-900/35 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="shrink-0 border-t border-slate-200 bg-white p-2.5">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 pl-2.5 transition focus-within:border-sky-900/30 focus-within:bg-white focus-within:shadow-sm">
              <label htmlFor={inputId} className="sr-only">
                {labels.message}
              </label>
              <input
                id={inputId}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // W0.10 (C-37): during Korean/Japanese IME composition Enter
                  // commits the composition, not the message — sending here
                  // used to fire half-composed text.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                // W4.4 — when the mobile keyboard opens, keep the newest
                // messages visible above the input.
                onFocus={() => {
                  window.setTimeout(() => {
                    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
                  }, 300);
                }}
                placeholder={liveSupportActive ? labels.supportMessagePlaceholder : labels.questionPlaceholder}
                className="min-h-10 min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13px] text-slate-950 outline-none ring-0 placeholder:text-slate-400"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || !input.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-950 text-white shadow-sm transition enabled:hover:bg-sky-900 disabled:opacity-35"
                aria-label={labels.send}
              >
                <Send className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-500">
              {liveSupportActive
                ? labels.liveNotice
                : messages.length > 24
                  ? trimNotice(uiLang)
                  : labels.aiNotice}
            </p>
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* L1 — idle teaser pill. A compact one-glance nudge (title + short
          feature line) instead of a card: shows once per session, auto-hides,
          and stays small enough to never cover page content. Tapping it opens
          the chat; the × dismisses immediately. */}
      <AnimatePresence>
        {teaserVisible && !open && (
          <motion.div
            key="assistant-teaser"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.24, ease: MSG_EASE } }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.16, ease: MSG_EASE } }}
            className="pointer-events-auto mb-2.5 max-w-[min(100vw-5.5rem,16rem)] origin-bottom-right"
          >
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-white/95 py-2 pl-3 pr-1.5 shadow-[0_10px_28px_-10px_rgba(26,35,50,0.3)] backdrop-blur-sm">
              <button
                type="button"
                onClick={() => {
                  setOpen(true);
                  dismissTeaser();
                }}
                className="block min-w-0 text-left"
              >
                <p className="flex items-center gap-1.5 text-[12px] font-bold leading-tight text-slate-900">
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" strokeWidth={2.2} />
                  <span className="truncate">{labels.teaserTitle}</span>
                  <ArrowRight className="h-3 w-3 flex-shrink-0 text-sky-700" strokeWidth={2.2} />
                </p>
                <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500">{labels.teaserBody}</p>
              </button>
              <button
                type="button"
                onClick={dismissTeaser}
                aria-label={labels.close}
                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center self-start rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "group relative flex items-center justify-center overflow-hidden rounded-full text-white transition-[box-shadow,transform] duration-200 ease-out",
            "h-[3.75rem] w-[3.75rem] sm:h-[4.25rem] sm:w-[4.25rem]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2",
            "active:scale-[0.94]",
            "backdrop-blur-xl backdrop-saturate-150",
            "ring-1 ring-white/15",
            open
              ? "bg-black/80 shadow-[0_4px_18px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.18)]"
              : [
                  // True black-glass orb — translucent dark gradient picks
                  // up the page behind it via backdrop-blur, so the button
                  // reads as a polished glass pebble rather than a solid
                  // chip.
                  "bg-gradient-to-br from-slate-900/65 via-black/72 to-black/85",
                  // Floating drop shadow + curved rim light (inset top
                  // highlight) + inner bottom darken for sphere depth.
                  "shadow-[0_2px_6px_rgba(0,0,0,0.35),0_10px_26px_-6px_rgba(0,0,0,0.55),0_24px_50px_-12px_rgba(0,0,0,0.45),inset_0_1.5px_0_rgba(255,255,255,0.3),inset_0_-2px_6px_rgba(0,0,0,0.45)]",
                  // Hover: brighter glass rim + a touch more lift.
                  "hover:-translate-y-0.5 hover:ring-white/25 hover:shadow-[0_3px_8px_rgba(0,0,0,0.4),0_14px_32px_-6px_rgba(0,0,0,0.6),0_30px_60px_-12px_rgba(0,0,0,0.55),inset_0_1.5px_0_rgba(255,255,255,0.36),inset_0_-2px_6px_rgba(0,0,0,0.48)]",
                ],
          )}
          aria-expanded={open}
          aria-label={open ? labels.close : labels.title}
        >
          {/* Specular gloss arc — the wet "glass" highlight that hugs the
              top edge. Sits behind the icon so the robot still reads
              cleanly. */}
          {!open && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-2.5 top-1.5 h-3.5 rounded-full bg-gradient-to-b from-white/35 via-white/12 to-transparent blur-[1.5px]"
            />
          )}
          {/* Subtle bottom under-glow for a "floating-on-glass" sit. */}
          {!open && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-4 bottom-1.5 h-2 rounded-full bg-white/[0.06] blur-[3px]"
            />
          )}
          {open ? (
            <X className="relative h-6 w-6" strokeWidth={2.2} />
          ) : (
            <ChatBotAvatar className="relative h-11 w-11 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)] sm:h-12 sm:w-12" />
          )}
        </button>
        {!open && (
          // Amber sparkle accent at top-right — the brand's signature warm
          // accent showing up on the concierge button. Stationary, not
          // pulsing (per user feedback that motion read as flashing).
          <span
            aria-hidden
            className="pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_1px_3px_rgba(180,83,9,0.4)]"
          />
        )}
      </div>
    </div>
  );
}
