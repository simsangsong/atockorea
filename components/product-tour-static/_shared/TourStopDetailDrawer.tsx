"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bath,
  BookOpen,
  Camera,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Footprints,
  Lightbulb,
  Maximize2,
  MapPin,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TourPhotoOverlay } from "@/components/tour/TourPhotoOverlay";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import { HaenyeoStatusButton } from "./HaenyeoStatusButton";

type DrawerLocale = "en" | "ko" | "ja" | "zh" | "zh-TW" | "es";

/** Light-weight superset shape that both `ItineraryStop` (full) and `PortVariantStop`
 * (cruise shore-excursion subset) satisfy without conversion. The drawer renders
 * each section conditionally so missing fields silently disappear. */
export type TourStopDrawerStop = {
  number: number;
  name: string;
  category?: string;
  time?: string;
  duration?: string;
  description?: string;
  image?: string;
  /** Optional secondary photos for the hero strip and hover cycle. */
  images?: readonly string[];
  highlights?: readonly string[];
  whyOnRoute?: string;
  visitBasics?: {
    hours?: string;
    closed?: string;
    admission?: string;
    walking?: string;
  };
  convenience?: {
    restroom?: string;
    parking?: string;
  };
  smartNotes?: {
    photo?: string;
    facilities?: string;
    tip?: string;
  };
  timeUsed?: readonly string[] | string;
  /** When set to "haenyeo", renders a live-status check button (haenyeoshow.com) in the drawer. */
  liveStatusWidget?: "haenyeo" | string;
};

const drawerEase = [0.16, 1, 0.3, 1] as const;

const heroSlideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 24, scale: 1.02 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (direction: number) => ({ opacity: 0, x: -direction * 24, scale: 1.02 }),
};

/** Tiered classification of a `**bold**` term's inner text. Locale-agnostic —
 *  works purely on the term content so all 6 languages get the same hierarchy:
 *  prices, times, measurements, cautions, and named entities each read distinctly. */
type TermTier = "price" | "time" | "metric" | "caution" | "keyterm";

const RX_PRICE = /[₩$€¥£]\s?[\d,]|[\d,]+\s?(?:USD|KRW|won|원|円|元)\b/i;
const RX_TIME = /\b\d{1,2}:\d{2}\b/;
const RX_METRIC =
  /\d[\d.,\s/–-]*\s*(?:m²|km²|km|m|ha|hr|hrs|h|min|mins|%|kg|°C|°F|pyeong|평)\b/i;
/** Cross-locale caution lexicon (en/ko/ja/zh/zh-TW/es): closures, prohibitions,
 *  advance-booking requirements — the facts a guest must not miss. */
const RX_CAUTION =
  /\b(?:closed|prohibited|forbidden|not allowed|no entry|advance (?:booking|permission|reservation)|reservation required|booking required|by reservation only)\b|휴무|금지|불가|입장\s*불가|사전\s*(?:예약|허가|신청)|예약\s*필수|定休|休業|禁止|不可|事前\s*(?:予約|許可|申請)|要予約|立入禁止|休息日|關閉|关闭|謝絕|谢绝|禁止|需\s*提前|cerrado|prohibid[oa]|no se permite|reserva previa|se requiere|solo con reserva/i;

function classifyTerm(inner: string): TermTier {
  const t = inner.trim();
  if (RX_PRICE.test(t)) return "price";
  if (RX_CAUTION.test(t)) return "caution";
  if (RX_TIME.test(t)) return "time";
  if (RX_METRIC.test(t)) return "metric";
  return "keyterm";
}

/** Premium chip styles per tier — used inside the full-description modal. */
const TIER_MODAL_CLASS: Record<TermTier, string> = {
  price:
    "rounded-[3px] bg-emerald-50/70 px-[3px] py-[0.5px] font-semibold text-emerald-700 ring-1 ring-emerald-600/15 tabular-nums",
  time: "rounded-[3px] bg-sky-50/70 px-[3px] py-[0.5px] font-semibold text-sky-700 ring-1 ring-sky-600/15 tabular-nums",
  metric: "rounded-[3px] bg-primary/[0.06] px-[3px] py-[0.5px] font-semibold text-primary tabular-nums",
  caution:
    "font-semibold text-amber-800 underline decoration-amber-500/50 decoration-1 underline-offset-[3px]",
  keyterm: "font-semibold tracking-tight text-foreground",
};

/** Lighter, color-only styles per tier — used in bullet lists / callouts where
 *  chip backgrounds would clutter the layout (highlights, whyOnRoute, smart notes). */
const TIER_INLINE_CLASS: Record<TermTier, string> = {
  price: "font-semibold text-emerald-700 tabular-nums",
  time: "font-semibold text-sky-700 tabular-nums",
  metric: "font-semibold text-primary tabular-nums",
  caution: "font-semibold text-amber-800",
  keyterm: "font-semibold text-foreground",
};

/** Inline `**bold**` → `<strong>` parser. Authors write descriptions/highlights
 *  in light markdown; this turns the markers into tier-colored typographic
 *  emphasis instead of rendering literal asterisks. */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={i} className={TIER_INLINE_CLASS[classifyTerm(inner)]}>
          {inner}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Premium-styled inline markdown for the description modal. Each `**bold**`
 *  term is classified into a tier (price / time / metric / caution / key term)
 *  and styled distinctly. `seen` tracks key terms already shown in this modal so
 *  repeat mentions render quietly — emphasis without visual noise. */
function renderModalInline(text: string, seen: Set<string>): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const inner = part.slice(2, -2);
      const tier = classifyTerm(inner);
      let className: string = TIER_MODAL_CLASS[tier];
      if (tier === "keyterm") {
        const key = inner.trim().toLowerCase().replace(/\s+/g, " ");
        if (seen.has(key)) {
          // Repeat mention — keep it emphasized but drop the editorial accent.
          className = "font-medium text-foreground";
        } else {
          seen.add(key);
          className = cn(className, "border-b-[1.5px] border-primary/30");
        }
      }
      return (
        <strong key={i} className={className}>
          {inner}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Sentences-per-paragraph + size targets for the balanced grouper. */
const PARA_TARGET_WEIGHT = 280;
const PARA_MAX_SENTENCES = 4;
const PARA_STARTER_MIN_WEIGHT = 140;
const PARA_ORPHAN_MIN_WEIGHT = 80;

/** Latin-script "new topic" sentence starters — flushing a paragraph just
 *  before one of these reproduces the natural editorial rhythm of the copy. */
const EN_PARA_STARTERS =
  /^(?:The |This |These |Those |That |Total |Adjacent |An? |Beyond |Admission|Hours|Its |With |Within |In |At |On |Of |For |From |Each |Both |Guests?\b|Visitors?\b|When |Where |While |Nearby |Unlike |Despite |After |Before |During |Here |There |Today|Note|Photography|Parking|Entry|Tickets?\b|Plan |Allow |Wear |Bring |\*\*)/;
const ES_PARA_STARTERS =
  /^(?:La |El |Los |Las |Una?\b|Este |Esta |Estos |Estas |Con |En |Para |Por |Desde |Cada |Ambos |Cuando |Donde |Aunque |Después |Antes |Durante |Aquí |Cerca |Además |También |Tenga |Lleve |Reserve |\*\*)/;

/** Per-locale sentence joiner — CJK runs sentences without inter-spacing;
 *  Latin scripts and Korean keep a single space. */
function sentenceJoiner(locale: DrawerLocale): string {
  return locale === "ja" || locale === "zh" || locale === "zh-TW" ? "" : " ";
}

/** Approximate rendered width — CJK / Kana / Hangul glyphs are wider and denser
 *  than Latin, so they count for more when balancing paragraph length. */
function visualWeight(s: string): number {
  let w = 0;
  for (const c of s) {
    w += /[　-〿぀-ヿ㐀-鿿가-힯豈-﫿＀-￯]/.test(c)
      ? 1.8
      : 1;
  }
  return w;
}

/** Splits text into sentences across Latin + CJK scripts. Guards: never breaks
 *  inside a `**bold**` span, never breaks a decimal point (e.g. "1.5 km"). Every
 *  input character is preserved in exactly one output sentence. */
function tokenizeSentences(text: string): string[] {
  const sentences: string[] = [];
  let buf = "";
  let inBold = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "*" && text[i + 1] === "*") {
      inBold = !inBold;
      buf += "**";
      i += 2;
      continue;
    }
    buf += ch;
    i += 1;
    if (inBold) continue;
    const isAsciiEnd = ch === "." || ch === "!" || ch === "?";
    const isCjkEnd = ch === "。" || ch === "！" || ch === "？";
    if (!isAsciiEnd && !isCjkEnd) continue;
    // Decimal guard: a "." flanked by digits is not a sentence end.
    if (ch === "." && /\d/.test(text[i - 2] ?? "") && /\d/.test(text[i] ?? "")) continue;
    // Absorb trailing closing quotes / brackets into this sentence.
    while (i < text.length && /[)\]"'”』」）]/.test(text[i])) {
      buf += text[i];
      i += 1;
    }
    // ASCII terminators need trailing whitespace/EOL; CJK terminators stand alone.
    if (isCjkEnd || i >= text.length || /\s/.test(text[i])) {
      const trimmed = buf.trim();
      if (trimmed) sentences.push(trimmed);
      buf = "";
    }
  }
  const tail = buf.trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/** Groups sentences into balanced, readable paragraphs. Latin scripts flush
 *  before "new topic" starter sentences for editorial rhythm; all scripts cap
 *  paragraphs by sentence count and visual weight so nothing becomes a wall. */
function groupSentences(sentences: string[], locale: DrawerLocale): string[] {
  if (sentences.length <= 1) return sentences;
  const joiner = sentenceJoiner(locale);
  const starters =
    locale === "es" ? ES_PARA_STARTERS : locale === "en" ? EN_PARA_STARTERS : null;

  const paragraphs: string[] = [];
  let buf: string[] = [];
  let weight = 0;
  for (const sentence of sentences) {
    if (
      starters &&
      buf.length > 0 &&
      weight >= PARA_STARTER_MIN_WEIGHT &&
      starters.test(sentence)
    ) {
      paragraphs.push(buf.join(joiner));
      buf = [];
      weight = 0;
    }
    buf.push(sentence);
    weight += visualWeight(sentence);
    if (weight >= PARA_TARGET_WEIGHT || buf.length >= PARA_MAX_SENTENCES) {
      paragraphs.push(buf.join(joiner));
      buf = [];
      weight = 0;
    }
  }
  if (buf.length) paragraphs.push(buf.join(joiner));

  // Fold a short orphan tail back into the previous paragraph.
  if (paragraphs.length >= 2) {
    const last = paragraphs[paragraphs.length - 1];
    if (visualWeight(last) < PARA_ORPHAN_MIN_WEIGHT) {
      paragraphs[paragraphs.length - 2] += joiner + last;
      paragraphs.pop();
    }
  }
  return paragraphs;
}

/** Splits the long-form description into readable paragraphs.
 *  Priority: explicit `\n\n` (authored) → sentence tokenization + balanced
 *  grouping (works for every locale, including CJK full-width punctuation). */
function splitDescriptionToParagraphs(text: string, locale: DrawerLocale): string[] {
  if (!text) return [];
  if (text.includes("\n\n")) {
    return text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  }
  const sentences = tokenizeSentences(text);
  if (sentences.length <= 1) return [text];
  return groupSentences(sentences, locale);
}

/** Peels the first sentence off a paragraph for the modal's lead-in treatment. */
function splitLeadSentence(
  paragraph: string,
  locale: DrawerLocale,
): { lead: string; rest: string } {
  const sentences = tokenizeSentences(paragraph);
  if (sentences.length <= 1) return { lead: paragraph, rest: "" };
  return { lead: sentences[0], rest: sentences.slice(1).join(sentenceJoiner(locale)) };
}

/** Strip a trailing colon / fullwidth colon / Japanese colon for use as a
 *  small uppercase header (i18n strings carry "Photo:" / "拍照：" / "写真:"). */
function stripTrailingPunctuation(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/[\s:：]+$/u, "");
}

/** Split a "How time is used" step into description + duration pill.
 *  Common patterns the data uses across en/ko/ja/zh/zh-TW/es:
 *    "Parking + entrance — ~10 min" → desc + "~10 min"
 *    "차량 픽업 (약 5분)"             → desc + "약 5분"
 *    "巴士下车（约5分钟）"            → desc + "约5分钟"
 *  Falls back to the raw step text when no duration tail is detected.
 */
function splitDurationFromStep(step: string): { desc: string; duration: string } {
  if (typeof step !== "string") return { desc: String(step ?? ""), duration: "" };
  const trimmed = step.trim();

  // Em-dash / en-dash / hyphen separator near the end with a digit on the right.
  const dashCandidates = [" — ", " – ", " - ", "—", "–"];
  for (const sep of dashCandidates) {
    const idx = trimmed.lastIndexOf(sep);
    if (idx <= 0) continue;
    const right = trimmed.slice(idx + sep.length).trim();
    if (right.length > 0 && right.length <= 28 && /\d/.test(right)) {
      return { desc: trimmed.slice(0, idx).trim(), duration: right };
    }
  }

  // Parenthesized tail with a digit inside: "...（约10分钟）" / "...(약 10분)"
  const parenMatch = trimmed.match(/^(.*?)\s*[（(]\s*([^()（）]*\d[^()（）]*)\s*[）)]\s*$/);
  if (parenMatch && parenMatch[1].trim().length > 0 && parenMatch[2].length <= 28) {
    return { desc: parenMatch[1].trim(), duration: parenMatch[2].trim() };
  }

  return { desc: trimmed, duration: "" };
}

/** Single row of the Visit Basics premium definition list. Label + value sit
 *  on a single horizontal row at small viewport — long values wrap freely
 *  under the label without forcing the next row's height. */
function VisitBasicsRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "closed";
}) {
  return (
    <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span
        className={cn(
          "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
          tone === "closed" ? "bg-rose-50 text-rose-500" : "bg-primary/[0.07] text-primary",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-[13px] font-medium leading-snug text-foreground tabular-nums">
          {value}
        </p>
      </div>
    </li>
  );
}

/** Premium colored callout card for a single Smart Note (Photo or Tip).
 *  Small uppercase header (icon + label) sits above a body block in soft
 *  tone-tinted gradient — visually distinct from the neutral collapsible. */
function SmartNoteCard({
  icon,
  label,
  body,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
  tone: "photo" | "tip";
}) {
  const palette =
    tone === "photo"
      ? {
          wrap: "border-sky-100/70 bg-gradient-to-br from-sky-50/55 via-white to-white",
          icon: "bg-sky-100/70 text-sky-700",
          label: "text-sky-700/90",
        }
      : {
          wrap: "border-amber-100/70 bg-gradient-to-br from-amber-50/55 via-white to-white",
          icon: "bg-amber-100/70 text-amber-700",
          label: "text-amber-700/90",
        };
  return (
    <div className={cn("rounded-xl border px-3.5 py-3", palette.wrap)}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
            palette.icon,
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "text-[10.5px] font-semibold uppercase tracking-[0.12em]",
            palette.label,
          )}
        >
          {label}
        </span>
      </div>
      <p className="text-[13px] leading-[1.55] text-foreground/85">
        {renderInlineMarkdown(body)}
      </p>
    </div>
  );
}

function CollapsibleSection({
  icon,
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-all duration-200",
        open
          ? "border-primary/20 shadow-premium-elevated"
          : "border-border/70 shadow-premium hover:border-primary/15 hover:shadow-premium-elevated",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-tight text-foreground">{title}</p>
          {meta ? (
            <p className="mt-0.5 text-[11.5px] font-medium tracking-wide text-muted-foreground">
              {meta}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300",
            open
              ? "rotate-180 bg-foreground text-white shadow-md"
              : "bg-muted/70 text-muted-foreground",
          )}
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export type TourStopDetailDrawerProps = {
  stop: TourStopDrawerStop | null;
  open: boolean;
  onClose: () => void;
  sectionUi: TourProductSectionUiV1;
  locale?: DrawerLocale;
};

/**
 * Slides in from the right when a stop card is tapped. Shows full stop details
 * (image, description, highlights, time used, visit basics, smart notes) so the
 * user can see everything at once instead of scrolling through an inline expand.
 */
/** Compact-by-default thresholds — keep first impression clean, allow expand on demand. */
const HIGHLIGHTS_DEFAULT_COUNT = 5;
const SHORT_WHY_THRESHOLD = 140;

export function TourStopDetailDrawer({ stop, open, onClose, sectionUi, locale = "en" }: TourStopDetailDrawerProps) {
  const [highlightsExpanded, setHighlightsExpanded] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [prevStopNumber, setPrevStopNumber] = useState(stop?.number);
  // Hero slideshow state — activeImageIndex drives which photo shows in the
  // top hero crossfade; lightboxIndex is independent so opening the lightbox
  // doesn't rewind the inline hero.
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageDirection, setImageDirection] = useState(1);
  const prevImageIndexRef = useRef(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  /**
   * React-recommended "adjusting state on prop change" pattern: reset compact
   * toggles synchronously during render when the user switches to a different
   * stop. Avoids the cascading-render footgun of doing this in useEffect.
   */
  if (stop?.number !== prevStopNumber) {
    setPrevStopNumber(stop?.number);
    setHighlightsExpanded(false);
    setWhyExpanded(false);
    setDescModalOpen(false);
    setActiveImageIndex(0);
    prevImageIndexRef.current = 0;
    setImageDirection(1);
    setLightboxOpen(false);
    setLightboxIndex(0);
  }

  // Esc closes the description modal first, then the drawer.
  useEffect(() => {
    if (!descModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDescModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [descModalOpen]);

  const galleryPhotos = stop?.images && stop.images.length > 0
    ? stop.images
    : stop?.image
      ? [stop.image]
      : [];
  const activeImage = galleryPhotos[activeImageIndex] ?? galleryPhotos[0];

  const setActiveImage = useCallback((nextIndex: number) => {
    if (nextIndex === prevImageIndexRef.current) return;
    setImageDirection(nextIndex > prevImageIndexRef.current ? 1 : -1);
    prevImageIndexRef.current = nextIndex;
    setActiveImageIndex(nextIndex);
  }, []);

  const openImageLightbox = useCallback(() => {
    if (galleryPhotos.length === 0) return;
    setLightboxIndex(activeImageIndex);
    setLightboxOpen(true);
  }, [activeImageIndex, galleryPhotos.length]);

  const closeImageLightbox = useCallback(() => setLightboxOpen(false), []);
  const lightboxNext = useCallback(
    () => setLightboxIndex((prev) => (prev + 1) % galleryPhotos.length),
    [galleryPhotos.length],
  );
  const lightboxPrev = useCallback(
    () => setLightboxIndex((prev) => (prev - 1 + galleryPhotos.length) % galleryPhotos.length),
    [galleryPhotos.length],
  );

  // Lightbox keyboard nav (Esc / Arrows). Capture phase + stopPropagation so
  // Esc closes the lightbox without also closing the drawer behind it.
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeImageLightbox();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        lightboxNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        lightboxPrev();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [lightboxOpen, closeImageLightbox, lightboxNext, lightboxPrev]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && stop && (
        <>
          <motion.div
            key="tour-stop-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: drawerEase }}
            className="fixed inset-0 z-[70] bg-[#0c1622]/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="tour-stop-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label={stop.name}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.42, ease: drawerEase }}
            className="fixed bottom-0 right-0 top-0 z-[71] flex w-full max-w-[520px] flex-col bg-white shadow-[0_0_60px_rgba(12,22,34,0.18)]"
          >
            {/* Hero image area — slide+fade crossfade between photos. The image
                surface itself is the click target for the lightbox; the close
                button sits as a sibling so it doesn't nest inside another button. */}
            <div
              className="group relative h-56 flex-shrink-0 overflow-hidden bg-muted"
              onContextMenu={(e) => e.preventDefault()}
            >
              <button
                type="button"
                onClick={openImageLightbox}
                aria-label={galleryPhotos.length > 0 ? "View photo full size" : "Photo"}
                disabled={galleryPhotos.length === 0}
                className="absolute inset-0 block h-full w-full text-left disabled:cursor-default"
              >
                {activeImage ? (
                  <AnimatePresence initial={false} custom={imageDirection} mode="popLayout">
                    <motion.img
                      key={`${activeImage}-${activeImageIndex}`}
                      src={activeImage}
                      alt={stop.name}
                      loading="eager"
                      decoding="async"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      custom={imageDirection}
                      variants={heroSlideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.5, ease: drawerEase }}
                      className="absolute inset-0 h-full w-full object-cover tour-photo-grade tour-photo-protected"
                    />
                  </AnimatePresence>
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/55 via-[#0c1622]/10 to-transparent pointer-events-none" />
              </button>
              {/* Editorial overlay — only stop name at bottom-right; top-right is
                  already occupied by the photo counter + close button. */}
              <TourPhotoOverlay src={activeImage} size="sm" hideRegion className="p-4" />

              <div className="pointer-events-none absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-foreground shadow-lg ring-[3px] ring-white/70">
                {String(stop.number).padStart(2, "0")}
              </div>

              {galleryPhotos.length > 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-16 top-4 flex h-9 items-center gap-1.5 rounded-full bg-white/85 px-2.5 text-[11px] font-semibold tabular-nums text-foreground shadow-md backdrop-blur-md transition-transform duration-200 group-hover:scale-[1.03]"
                >
                  <Maximize2 className="h-3 w-3" strokeWidth={2.25} />
                  {activeImageIndex + 1}/{galleryPhotos.length}
                </span>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>

              {stop.duration && (
                <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-sm">
                  <Clock className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                  {stop.duration}
                </div>
              )}
            </div>

            {/* Photo selector strip — clicking a thumbnail crossfades the hero
                above, with a clear "active" affordance on the current thumb. */}
            {galleryPhotos.length > 1 && (
              <div className="flex-shrink-0 border-b border-border/50 bg-white">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-5 py-2.5">
                  {galleryPhotos.map((src, i) => {
                    const isActive = i === activeImageIndex;
                    return (
                      <button
                        type="button"
                        key={`${src}-${i}`}
                        onClick={() => setActiveImage(i)}
                        aria-pressed={isActive}
                        aria-label={`Show photo ${i + 1}`}
                        className={cn(
                          "flex-shrink-0 h-16 w-24 overflow-hidden rounded-lg bg-muted transition-all duration-300",
                          isActive
                            ? "ring-2 ring-primary/85 ring-offset-2 ring-offset-white shadow-[0_2px_4px_rgba(26,35,50,0.08),0_10px_24px_-12px_rgba(26,35,50,0.30)] -translate-y-0.5"
                            : "ring-1 ring-border/40 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_4px_10px_-4px_rgba(26,35,50,0.16)] hover:ring-border hover:-translate-y-0.5",
                        )}
                      >
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          onContextMenu={(e) => e.preventDefault()}
                          className={cn(
                            "h-full w-full object-cover transition-transform duration-500 tour-photo-protected",
                            isActive ? "scale-[1.04]" : "hover:scale-[1.05]",
                          )}
                        />
                      </button>
                    );
                  })}
                  <div className="flex-shrink-0 w-1" aria-hidden />
                </div>
              </div>
            )}

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-5 p-5">
                {/* Header — time + name + category */}
                <div>
                  {(stop.time || stop.duration) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {stop.time && <span className="font-semibold text-foreground">{stop.time}</span>}
                      {stop.time && stop.duration && <span className="text-border">·</span>}
                      {stop.duration && <span>{stop.duration}</span>}
                    </div>
                  )}
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                    {stop.name}
                  </h2>
                  {stop.category && (
                    <span className="mt-2 inline-block rounded-md bg-muted/80 px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {stop.category}
                    </span>
                  )}
                </div>

                {/* Highlights — compact + premium with optional "Read full description" link */}
                {stop.highlights && stop.highlights.length > 0 && (() => {
                  const all = stop.highlights;
                  const visible = highlightsExpanded
                    ? all
                    : all.slice(0, HIGHLIGHTS_DEFAULT_COUNT);
                  const hasMore = all.length > HIGHLIGHTS_DEFAULT_COUNT;
                  return (
                    <div>
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {sectionUi.stopHighlightsHeading}
                        </h3>
                        {stop.description && (
                          <button
                            type="button"
                            onClick={() => setDescModalOpen(true)}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-primary transition-colors hover:bg-primary/[0.14]"
                          >
                            <BookOpen className="h-3 w-3" strokeWidth={2.25} />
                            {sectionUi.stopFullDescriptionTitle ?? "Full description"}
                          </button>
                        )}
                      </div>
                      <ul className="grid grid-cols-1 gap-1.5">
                        {visible.map((highlight, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-[13px] leading-[1.5] text-foreground"
                          >
                            <span
                              aria-hidden
                              className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-accent"
                            />
                            <span>{renderInlineMarkdown(highlight)}</span>
                          </li>
                        ))}
                      </ul>
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => setHighlightsExpanded((v) => !v)}
                          aria-expanded={highlightsExpanded}
                          className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary transition-colors hover:text-primary/80"
                        >
                          {highlightsExpanded ? "Show fewer" : `Show all ${all.length}`}
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform duration-200",
                              highlightsExpanded && "rotate-180",
                            )}
                            strokeWidth={2.25}
                          />
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Live status widget — currently only haenyeo show (Seongsan Ilchulbong) */}
                {stop.liveStatusWidget === "haenyeo" && (
                  <HaenyeoStatusButton locale={locale} />
                )}

                {/* Why on route — clamped to 3 lines for long copy, "Read more" reveals full */}
                {stop.whyOnRoute && (() => {
                  const isLong = stop.whyOnRoute.length > SHORT_WHY_THRESHOLD;
                  return (
                    <div className="flex items-start gap-3 rounded-xl border border-accent/20 bg-sand-blush/80 px-4 py-3.5">
                      <Lightbulb
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[14px] leading-relaxed text-foreground",
                            isLong && !whyExpanded && "line-clamp-3",
                          )}
                        >
                          {renderInlineMarkdown(stop.whyOnRoute)}
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => setWhyExpanded((v) => !v)}
                            aria-expanded={whyExpanded}
                            className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-accent transition-colors hover:text-accent/80"
                          >
                            {whyExpanded ? "Show less" : "Read more"}
                            <ChevronDown
                              className={cn(
                                "h-3 w-3 transition-transform duration-200",
                                whyExpanded && "rotate-180",
                              )}
                              strokeWidth={2.25}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Description is no longer inline — opens via the Highlights link button as a modal popup. */}

                {/* Collapsible — Time breakdown (premium vertical timeline with duration pills) */}
                {Array.isArray(stop.timeUsed) && stop.timeUsed.length > 0 && (
                  <CollapsibleSection
                    icon={<Clock className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopTimeUsedHeading}
                  >
                    <ol className="space-y-2.5">
                      {stop.timeUsed.map((step, i) => {
                        const { desc, duration } = splitDurationFromStep(step);
                        return (
                          <li key={i} className="flex items-start gap-2.5">
                            <span
                              aria-hidden
                              className="mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-[10.5px] font-semibold text-primary tabular-nums"
                            >
                              {i + 1}
                            </span>
                            <div className="flex min-w-0 flex-1 items-start justify-between gap-2.5">
                              <p className="min-w-0 flex-1 text-[13px] leading-[1.5] text-foreground/85">
                                {desc}
                              </p>
                              {duration && (
                                <span className="mt-[1px] flex-shrink-0 rounded-md bg-muted/70 px-1.5 py-[1.5px] text-[10.5px] font-semibold tracking-[0.02em] text-muted-foreground tabular-nums">
                                  {duration}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </CollapsibleSection>
                )}
                {typeof stop.timeUsed === "string" && stop.timeUsed.trim() !== "" && (
                  <CollapsibleSection
                    icon={<Clock className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopTimeUsedHeading}
                  >
                    <p className="text-[14px] leading-relaxed text-foreground/85">
                      {renderInlineMarkdown(stop.timeUsed)}
                    </p>
                  </CollapsibleSection>
                )}

                {/* Collapsible — Visit basics + Convenience (premium definition-list) */}
                {(stop.visitBasics ||
                  (stop.convenience && (stop.convenience.restroom || stop.convenience.parking))) && (
                  <CollapsibleSection
                    icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopVisitBasicsHeading}
                  >
                    {stop.visitBasics && (
                      <ul className="divide-y divide-border/30">
                        {stop.visitBasics.hours && (
                          <VisitBasicsRow
                            icon={<Clock className="h-3.5 w-3.5" strokeWidth={2} />}
                            label={sectionUi.stopVisitHoursLabel}
                            value={stop.visitBasics.hours}
                          />
                        )}
                        {stop.visitBasics.closed && (
                          <VisitBasicsRow
                            icon={<X className="h-3.5 w-3.5" strokeWidth={2.5} />}
                            label={sectionUi.stopVisitClosedLabel}
                            value={stop.visitBasics.closed}
                            tone="closed"
                          />
                        )}
                        {stop.visitBasics.admission && (
                          <VisitBasicsRow
                            icon={<Ticket className="h-3.5 w-3.5" strokeWidth={2} />}
                            label={sectionUi.stopVisitAdmissionLabel}
                            value={stop.visitBasics.admission}
                          />
                        )}
                        {stop.visitBasics.walking && (
                          <VisitBasicsRow
                            icon={<Footprints className="h-3.5 w-3.5" strokeWidth={2} />}
                            label={sectionUi.stopVisitWalkingLabel}
                            value={stop.visitBasics.walking}
                          />
                        )}
                      </ul>
                    )}

                    {stop.convenience &&
                      (stop.convenience.restroom || stop.convenience.parking) && (
                        <div
                          className={cn(
                            "flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-muted-foreground",
                            stop.visitBasics ? "mt-3 border-t border-border/30 pt-3" : "",
                          )}
                        >
                          {stop.convenience.restroom && (
                            <div className="flex min-w-0 items-start gap-1.5">
                              <Bath className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/80" strokeWidth={2} />
                              <span className="leading-snug">{stop.convenience.restroom}</span>
                            </div>
                          )}
                          {stop.convenience.parking && (
                            <div className="flex min-w-0 items-start gap-1.5">
                              <Car className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/80" strokeWidth={2} />
                              <span className="leading-snug">{stop.convenience.parking}</span>
                            </div>
                          )}
                        </div>
                      )}
                  </CollapsibleSection>
                )}

                {/* Collapsible — Smart notes (premium colored callout cards) */}
                {stop.smartNotes && (stop.smartNotes.photo || stop.smartNotes.tip) && (
                  <CollapsibleSection
                    icon={<Sparkles className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopSmartNotesHeading}
                  >
                    <div className="space-y-2.5">
                      {stop.smartNotes.photo && (
                        <SmartNoteCard
                          icon={<Camera className="h-3.5 w-3.5" strokeWidth={2} />}
                          label={stripTrailingPunctuation(sectionUi.stopSmartNotesPhotoPrefix)}
                          tone="photo"
                          body={stop.smartNotes.photo}
                        />
                      )}
                      {stop.smartNotes.tip && (
                        <SmartNoteCard
                          icon={<Lightbulb className="h-3.5 w-3.5" strokeWidth={2} />}
                          label={stripTrailingPunctuation(sectionUi.stopSmartNotesTipPrefix)}
                          tone="tip"
                          body={stop.smartNotes.tip}
                        />
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            </div>
          </motion.aside>

          {/* Wikipedia-style description popup — opens from the Highlights link button */}
          <AnimatePresence>
            {descModalOpen && stop.description && (
              <>
                <motion.div
                  key="tour-stop-desc-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: drawerEase }}
                  className="fixed inset-0 z-[80] bg-[#0c1622]/60 backdrop-blur-[3px]"
                  onClick={() => setDescModalOpen(false)}
                  aria-hidden
                />
                {/* Position wrapper — Tailwind handles fixed + desktop centering.
                    framer-motion only animates `opacity` here so it doesn't write
                    inline `transform`, which would otherwise override Tailwind's
                    `sm:-translate-x-1/2 sm:-translate-y-1/2` on desktop and push
                    the card off-screen to the right. */}
                <motion.div
                  key="tour-stop-desc-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${stop.name} — ${sectionUi.stopFullDescriptionTitle ?? "Full description"}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.32, ease: drawerEase }}
                  className={cn(
                    "fixed z-[81] flex max-h-[88dvh]",
                    // Mobile: bottom sheet — full width, anchored to bottom
                    "bottom-0 left-0 right-0",
                    // Desktop (sm+): centered card
                    "sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[min(640px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2",
                  )}
                >
                <motion.div
                  initial={{ y: 32 }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.32, ease: drawerEase }}
                  className={cn(
                    "flex w-full flex-col overflow-hidden bg-white max-h-[88dvh]",
                    "shadow-[0_-12px_40px_rgba(12,22,34,0.18),0_-4px_12px_rgba(12,22,34,0.10)]",
                    "rounded-t-2xl sm:rounded-2xl",
                    "sm:shadow-[0_30px_80px_rgba(12,22,34,0.30),0_8px_20px_rgba(12,22,34,0.18)] sm:ring-1 sm:ring-border/60",
                  )}
                >
                  {/* Mobile drag handle (visual only) */}
                  <div className="flex justify-center pt-2 pb-1 sm:hidden">
                    <span aria-hidden className="h-1 w-9 rounded-full bg-muted-foreground/30" />
                  </div>

                  {/* Modal header — title + close */}
                  <div className="relative flex flex-shrink-0 items-start justify-between gap-3 border-b border-border/50 bg-white px-5 py-4 sm:px-6 sm:py-5">
                    {/* Left accent line */}
                    <span aria-hidden className="absolute left-0 top-3.5 h-[calc(100%-1.75rem)] w-[3px] rounded-r-full bg-primary/50" />
                    <div className="min-w-0 flex-1 pl-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                        {sectionUi.stopFullDescriptionTitle ?? "Full description"}
                      </p>
                      <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-foreground sm:text-[18px]">
                        {stop.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDescModalOpen(false)}
                      aria-label="Close"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-all hover:bg-muted active:scale-95"
                    >
                      <X className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </div>

                  {/* Modal body — premium typographic description */}
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
                    <article className="px-5 py-6 sm:px-6 sm:py-8">
                      {(() => {
                        // One `seen` set per modal render: a key term gets the
                        // editorial accent on first mention, then renders quietly.
                        const seen = new Set<string>();
                        const isLatin = locale === "en" || locale === "es";
                        return splitDescriptionToParagraphs(stop.description, locale).map((p, i) => {
                          const paragraphClass = cn(
                            "break-words [overflow-wrap:anywhere] hyphens-auto text-foreground/88",
                            i === 0
                              ? "text-[15px] leading-[1.82] tracking-[-0.004em]"
                              : "mt-5 text-[14px] leading-[1.8] tracking-[-0.003em]",
                          );
                          if (i === 0) {
                            const { lead, rest } = splitLeadSentence(p, locale);
                            return (
                              <p key={i} className={paragraphClass}>
                                <span
                                  className="text-[15.5px] font-medium text-foreground"
                                  style={
                                    isLatin ? { fontFamily: "var(--font-display-serif)" } : undefined
                                  }
                                >
                                  {renderModalInline(lead, seen)}
                                </span>
                                {rest ? (
                                  <>
                                    {sentenceJoiner(locale)}
                                    {renderModalInline(rest, seen)}
                                  </>
                                ) : null}
                              </p>
                            );
                          }
                          return (
                            <p key={i} className={paragraphClass}>
                              {renderModalInline(p, seen)}
                            </p>
                          );
                        });
                      })()}
                    </article>
                  </div>
                </motion.div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Fullscreen photo lightbox — opens when the stop hero image is tapped. */}
          <AnimatePresence>
            {lightboxOpen && galleryPhotos.length > 0 && (
              <motion.div
                key="tour-stop-image-lightbox"
                role="dialog"
                aria-modal="true"
                aria-label={`${stop.name} — photos`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: drawerEase }}
                className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0c1622]/95 backdrop-blur-sm"
                onClick={closeImageLightbox}
              >
                <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">
                  {lightboxIndex + 1} / {galleryPhotos.length}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeImageLightbox();
                  }}
                  aria-label="Close"
                  className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>

                {galleryPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        lightboxPrev();
                      }}
                      aria-label="Previous"
                      className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        lightboxNext();
                      }}
                      aria-label="Next"
                      className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                <motion.div
                  className="relative mx-4 max-h-[82vh] max-w-5xl touch-pan-y"
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => e.preventDefault()}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={(_, info) => {
                    if (galleryPhotos.length < 2) return;
                    const offsetX = info.offset.x;
                    const velocityX = info.velocity.x;
                    if (offsetX < -70 || velocityX < -500) lightboxNext();
                    else if (offsetX > 70 || velocityX > 500) lightboxPrev();
                  }}
                >
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.img
                      key={lightboxIndex}
                      src={galleryPhotos[lightboxIndex]}
                      alt={stop.name}
                      decoding="async"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      initial={{ opacity: 0, scale: 0.72, filter: "blur(10px)" }}
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, scale: 0.86, filter: "blur(6px)" }}
                      transition={{ duration: 0.46, ease: [0.34, 1.35, 0.64, 1] }}
                      className="max-h-[82vh] w-auto rounded-xl shadow-2xl tour-photo-grade tour-photo-protected"
                    />
                  </AnimatePresence>
                  <TourPhotoOverlay src={galleryPhotos[lightboxIndex]} size="lg" className="p-5" />
                </motion.div>

                {galleryPhotos.length > 1 && (
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 px-4">
                    {galleryPhotos.map((src, i) => (
                      <button
                        type="button"
                        key={`${src}-${i}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxIndex(i);
                        }}
                        aria-label={`View photo ${i + 1}`}
                        aria-current={i === lightboxIndex ? "true" : undefined}
                        className={cn(
                          "h-8 w-12 overflow-hidden rounded-md transition-all",
                          i === lightboxIndex
                            ? "ring-2 ring-white ring-offset-2 ring-offset-[#0c1622]"
                            : "opacity-50 hover:opacity-80",
                        )}
                      >
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          onContextMenu={(e) => e.preventDefault()}
                          className="h-full w-full object-cover tour-photo-grade tour-photo-protected"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
