"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PartyStepper } from "@/components/home/v2/ui/PartyStepper";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ArrowRight, Car, Bus, Award, Users, Sparkles, Check, Flower2, Sun, Leaf, MapPin, Clock } from "lucide-react";
import {
  currentSeasonNote,
  seasonNameKey,
  type SeasonKey,
  type SeasonNote,
} from "@/lib/home/season-notes";
import { analytics } from "@/src/design/analytics";
import {
  HOME_CTA_BUS_LIST_HREF,
  HOME_CTA_MATCHING_HREF,
  HOME_CTA_PRIVATE_LIST_HREF,
  HOME_CTA_SMALL_GROUP_LIST_HREF,
} from "@/lib/home/home-cta-routes";
import { useTranslations } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { getFeaturedJoinTourProduct } from "@/lib/home/featured-join-tour-offer";
import { ITINERARY_BUILDER_ENABLED } from "@/lib/itinerary-builder/builder-visibility";
import { CHOOSE_STYLE_CARD_USD, privateVehicleUsd } from "@/lib/home/choose-style-card-usd";
import { SnapScrollDots } from "@/components/home/v2/ui/SnapScrollDots";
import { homeBtnInverse, homeBtnPrimary } from "@/lib/home/home-button-classes";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";
import { cn } from "@/lib/utils";

const chooseStyleFeaturedWhiteCtaStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-secondary)",
};

/**
 * V5 — live-price line that crossfades when `party` changes (key={party}).
 * `initial={false}` on AnimatePresence keeps first paint deterministic
 * (SSR-safe, no hydration flash); only party-driven changes animate.
 */
function LivePrice({
  party,
  reduce,
  className,
  children,
}: {
  party: number;
  reduce: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p className={className}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={party}
          initial={reduce ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -3 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

/**
 * Film-grain noise tile (same recipe as the hero) layered over the card photo
 * strip so the duotone reads as printed editorial texture, not a flat stock cut.
 */
const CARD_GRAIN_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * V2 — thin duotone photo strip at the top of each type card. Reuses existing
 * site photography (no new assets): small-group → Jagalchi market travelers,
 * private → Seoul private-car view of Gyeongbokgung, bus → branded coach at the
 * Busan cruise terminal. The photo is tinted toward the card's colour identity
 * (slate for the dark small-group card, emerald for the white private/bus pods)
 * via the Vogue saturate/contrast/brightness filter + a multiply tone overlay,
 * then a bottom fade melts it into the card body, with a faint film grain on
 * top. Sits below the hero, so lazy-loaded (LCP-safe).
 */
function CardPhotoStrip({
  src,
  alt,
  tone,
}: {
  src: string;
  alt: string;
  tone: "slate" | "emerald";
}) {
  return (
    <div className="relative -mx-4 -mt-4 mb-4 h-24 overflow-hidden md:-mx-5 md:-mt-5 md:h-28">
      <Image
        src={src}
        alt={alt}
        fill
        loading="lazy"
        sizes="(min-width: 768px) 300px, 70vw"
        className="object-cover [filter:saturate(1.1)_contrast(1.06)_brightness(0.96)]"
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 mix-blend-multiply",
          tone === "slate" ? "bg-slate-800/55" : "bg-emerald-900/30",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0",
          tone === "slate"
            ? "bg-gradient-to-t from-slate-900 via-slate-900/35 to-slate-900/5"
            : "bg-gradient-to-t from-white via-white/25 to-transparent",
        )}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
        style={{ backgroundImage: CARD_GRAIN_BG }}
      />
    </div>
  );
}

const SEASON_ICON: Record<SeasonKey, typeof Flower2> = {
  cherryBlossom: Flower2,
  summer: Sun,
  autumn: Leaf,
};

/**
 * Client-only season note via useSyncExternalStore: the server snapshot is
 * `null` (renders nothing) and the client snapshot is computed once from the
 * browser's clock, so SSR/CSR can never mismatch on a date boundary (a UTC
 * server vs a KST client could otherwise disagree by a day). Cached so the
 * getSnapshot reference stays stable across renders.
 */
let clientSeasonNote: SeasonNote | null | undefined;
const subscribeNoop = () => () => {};
function readClientSeasonNote(): SeasonNote | null {
  if (clientSeasonNote === undefined) {
    clientSeasonNote = currentSeasonNote(new Date());
  }
  return clientSeasonNote;
}

/**
 * U8 — honest seasonality cue. The only urgency we surface: AtoC tours are
 * on-demand (availability is effectively unlimited), so "N spots left" scarcity
 * is N/A by design — we never fabricate it. This chip shows a calendar-true
 * scenic-season note (active countdown or a ≤30-day lead) derived from the
 * engine's peak ranges; renders nothing when no season is active or imminent.
 */
function SeasonNoteChip() {
  const t = useTranslations("home");
  const note = useSyncExternalStore(subscribeNoop, readClientSeasonNote, () => null);
  if (!note) return null;
  const Icon = SEASON_ICON[note.key];
  const label = t(
    note.state === "active"
      ? "premium.v2.chooseStyle.seasonActive"
      : "premium.v2.chooseStyle.seasonSoon",
    { season: t(seasonNameKey(note.key)), count: note.days },
  );
  return (
    <div className="mb-4 flex justify-center md:mb-5">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-caption font-semibold text-amber-800">
        <Icon className="h-3.5 w-3.5 flex-none text-amber-500" aria-hidden />
        {label}
      </span>
    </div>
  );
}

export function ChooseTravelStyle() {
  const t = useTranslations("home");
  const { formatPrice } = useCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  const featuredJoin = useMemo(() => getFeaturedJoinTourProduct(), []);
  const reveal = useRevealContainerProps();
  const reduce = !!useReducedMotion(); // V5 — gate the price crossfade

  // Reform U2/V6 — party drives the (Wave 1) live price + dynamic recommend.
  // In Wave 0 it carries forward into the card links so the catalogue can
  // pre-fill group size (U9 continuity seed). Default 2, no gate.
  const [party, setParty] = useState(2);
  // Reform U6 destination strip removed (user direction 2026-06-22) — the home
  // strip is now party-only; destination is chosen on /tours/list instead.
  const withParams = (href: string) => {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}party=${party}`;
  };
  const handleStepperChange = (next: number) => {
    setParty(next);
    analytics.homePartyStepperChange({ party: next });
  };

  // L3 (chatbot promo) — open the global AI assistant from the landing. The
  // widget (TourProductAiAssistantWidget) listens for `atc:open-assistant`.
  const openAssistant = () => {
    analytics.homeCtaClick({ source: "chatbot_open_choose_style" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("atc:open-assistant", { detail: { source: "choose_style" } }),
      );
    }
  };

  // Private per-vehicle price for the current party — tiered (sedan/van/solati),
  // so it jumps at 7 and 10 pax to match the real PAX_TIERS table.
  const privateVehicle = privateVehicleUsd(party);
  // Reform U5 — dynamic recommendation. The "Recommended" badge sits on
  // small-group for small parties and moves to private once a private charter
  // is actually the better value (compared against the real tiered price, not a
  // flat one): private vehicle ≤ small-group per-person × party.
  const recommendPrivate = privateVehicle <= featuredJoin.listPriceUsd * party;

  return (
    <section className="section-py-sm px-4 md:px-6 bg-slate-50">
      <motion.div {...reveal} className="max-w-4xl mx-auto">
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="text-center mb-5 md:mb-6">
          <p className="mb-3 text-eyebrow md:mb-4">
            {t("premium.v2.chooseStyle.eyebrow")}
          </p>
          {/* Standard section heading (Inter sans) — matches Featured / Why /
              Process headings. V1's magazine serif was rejected here: it reads
              as out-of-place on a plain section title (the editorial serif
              belongs on photo-card titles like Destinations, not section h2s). */}
          <h2 className="text-h2 text-slate-900">
            {t("premium.v2.chooseStyle.title")}
          </h2>
        </motion.div>

        {/* U8 — calendar-true seasonality cue (no fabricated scarcity). */}
        <SeasonNoteChip />

        {/* U2/V6 — party stepper directly above the cards (destination strip
            removed 2026-06-22; destination is chosen on /tours/list). */}
        <motion.div
          variants={REVEAL_ITEM_VARIANTS}
          className="mb-6 flex flex-col items-center gap-4 md:mb-7"
        >
          <PartyStepper
            value={party}
            onChange={handleStepperChange}
            label={t("premium.v2.chooseStyle.partyLabel")}
            caption={t("premium.v2.chooseStyle.partyCaption", { count: party })}
            decreaseAria={t("premium.v2.chooseStyle.partyDecrease")}
            increaseAria={t("premium.v2.chooseStyle.partyIncrease")}
          />
        </motion.div>

        {/* relative wrapper hosts the right-edge fade overlay so users see
            "more →" on mobile where the scrollbar is hidden. */}
        <div className="relative -mx-4 md:mx-0">
        <div ref={scrollRef} className="flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto pb-2 pl-6 pr-10 scrollbar-none md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none">
          {/* Small Group — featured (dark slate, amber accent only) */}
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            className={cn(
              "relative w-[68vw] flex-none snap-start overflow-hidden rounded-card border border-slate-700/50 bg-slate-900 p-4 md:p-5 shadow-2 transition-all duration-300 ease-out hover:-translate-y-0.5 flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto",
              // V7 — elevate the recommended card (small-group below the crossover).
              !recommendPrivate && "ring-2 ring-amber-300/70 ring-offset-2 ring-offset-slate-50",
            )}
          >
            <CardPhotoStrip
              src="/images/tours/jagalchi-market/jagalchi-interior-foreign-tourists.webp"
              alt={t("premium.v2.chooseStyle.smallGroupTitle")}
              tone="slate"
            />
            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              {/* U5 — recommended badge shows here only while small-group is the
                  better value (party below the private crossover). */}
              {!recommendPrivate ? (
                <span className="text-micro font-bold text-amber-300 bg-white/5 border border-white/15 px-2.5 py-1 rounded-full tracking-wide flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {t("premium.v2.chooseStyle.recommended")}
                </span>
              ) : null}
            </div>

            <h3 className="text-base md:text-lg font-bold text-white mb-1">
              {t("premium.v2.chooseStyle.smallGroupTitle")}
            </h3>
            <p className="text-caption text-slate-300 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.smallGroupDesc")}
            </p>

            <div className="mb-4">
              <p className="text-micro text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-2">
                {featuredJoin.compareAtPriceUsd != null ? (
                  <span className="text-sm text-slate-500 line-through">
                    {formatPrice(featuredJoin.compareAtPriceUsd)}
                  </span>
                ) : null}
                <span className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {formatPrice(featuredJoin.listPriceUsd)}
                </span>
                <span className="text-micro text-white/70 font-semibold">{t("premium.v2.chooseStyle.perPerson")}</span>
              </div>
              {/* U1 live price — per-person × party = total for the group. */}
              <LivePrice
                party={party}
                reduce={reduce}
                className="mt-1.5 text-caption font-semibold tabular-nums text-amber-200/90"
              >
                {t("premium.v2.chooseStyle.totalForParty", {
                  total: formatPrice(featuredJoin.listPriceUsd * party),
                  count: party,
                })}
              </LivePrice>
            </div>

            <V0ShadcnButton
              asChild
              size="lg"
              className={homeBtnInverse}
              style={chooseStyleFeaturedWhiteCtaStyle}
            >
              <Link
                href={withParams(HOME_CTA_SMALL_GROUP_LIST_HREF)}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_featured_join" });
                  analytics.homeTourTypeCardClick({ type: "small_group", party });
                }}
              >
                {t("premium.v2.chooseStyle.sgCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </motion.div>

          {/* Private — white pod with subtle mint warm-light (premium, not minty) */}
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            className={cn(
              "group relative w-[68vw] flex-none snap-start overflow-hidden rounded-card border border-emerald-100/60 bg-gradient-to-b from-white via-white to-emerald-50/40 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04),0_8px_22px_-12px_rgba(16,122,87,0.10),0_18px_36px_-18px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-emerald-200/75 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(15,23,42,0.05),0_10px_28px_-12px_rgba(16,122,87,0.16),0_22px_42px_-18px_rgba(15,23,42,0.16)] flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto",
              // V7 — elevate the recommended card (private at/above the crossover).
              recommendPrivate && "ring-2 ring-amber-300/70 ring-offset-2 ring-offset-slate-50",
            )}
          >
            <CardPhotoStrip
              src="/images/tours/seoul-private-charter/seoul-private-gyeongbokgung-from-car.webp"
              alt={t("premium.v2.chooseStyle.privateTitle")}
              tone="emerald"
            />
            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-emerald-50/70 border border-emerald-100/70 flex items-center justify-center">
                <Car className="w-4 h-4 md:w-5 md:h-5 text-slate-700" />
              </div>
              {/* U5 — the "Recommended" badge lands here once a private charter
                  is the better value (party ≥ crossover); otherwise the neutral
                  "Private" tag. */}
              {recommendPrivate ? (
                <span className="text-micro font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full tracking-wide flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {t("premium.v2.chooseStyle.recommended")}
                </span>
              ) : (
                <span className="text-micro font-bold text-slate-700 bg-white/70 border border-emerald-100/60 px-2.5 py-1 rounded-full tracking-wide backdrop-blur-[2px]">
                  {t("premium.v2.chooseStyle.privateBadge")}
                </span>
              )}
            </div>

            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">{t("premium.v2.chooseStyle.privateTitle")}</h3>
            <p className="text-caption text-slate-600 mb-2 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.privateDesc")}
            </p>
            {/* Flexibility proof for the "유연성 UP" badge: hourly duration choice
                + route customization — the concrete differentiator vs fixed OTA
                private tours. */}
            <p className="mb-3 flex items-start gap-1.5 text-micro font-semibold leading-snug text-emerald-700">
              <Clock className="mt-px h-3.5 w-3.5 flex-none" aria-hidden />
              {t("premium.v2.chooseStyle.privateFlexLine")}
            </p>

            <div className="mb-4">
              <p className="text-micro text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl md:text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                  {formatPrice(privateVehicle)}
                </span>
                <span className="text-slate-500 text-micro font-semibold">{t("premium.v2.chooseStyle.privatePerVehicle")}</span>
              </div>
              {/* U1 live price — tiered vehicle ÷ party = effective per-person. */}
              <LivePrice
                party={party}
                reduce={reduce}
                className="mt-1.5 text-caption font-semibold tabular-nums text-emerald-700"
              >
                {t("premium.v2.chooseStyle.perPersonForParty", {
                  perPerson: formatPrice(Math.round(privateVehicle / party)),
                  count: party,
                })}
              </LivePrice>
            </div>

            <V0ShadcnButton
              asChild
              size="lg"
              className={cn(homeBtnPrimary, "mt-4")}
            >
              <Link
                href={withParams(HOME_CTA_PRIVATE_LIST_HREF)}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_private_custom" });
                  analytics.homeTourTypeCardClick({ type: "private", party });
                }}
              >
                {t("premium.v2.chooseStyle.privateCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
            {/* U4 — curated private list is the primary path; building a custom
                day from scratch is the secondary "or…" option.
                Klook prep 2026-06-29: builder gated off → link hidden. */}
            {ITINERARY_BUILDER_ENABLED && (
              <Link
                href={`/itinerary-builder?party=${party}`}
                className="focus-ring mt-2.5 flex items-center justify-center gap-1 text-micro font-semibold text-slate-500 transition-colors duration-200 hover:text-slate-800"
              >
                {t("premium.v2.chooseStyle.privateBuildOwn")}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </motion.div>

          {/* Bus — white pod with subtle mint warm-light (matches Private card) */}
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            className="group relative w-[68vw] flex-none snap-start overflow-hidden rounded-card border border-emerald-100/60 bg-gradient-to-b from-white via-white to-emerald-50/40 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04),0_8px_22px_-12px_rgba(16,122,87,0.10),0_18px_36px_-18px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-emerald-200/75 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(15,23,42,0.05),0_10px_28px_-12px_rgba(16,122,87,0.16),0_22px_42px_-18px_rgba(15,23,42,0.16)] flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto"
          >
            <CardPhotoStrip
              src="/images/tours/busan-cruise-terminal/busan-cruise-terminal-bus-pickup.webp"
              alt={t("premium.v2.chooseStyle.busTitle")}
              tone="emerald"
            />
            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-emerald-50/70 border border-emerald-100/70 flex items-center justify-center">
                <Bus className="w-4 h-4 md:w-5 md:h-5 text-slate-700" />
              </div>
              <span className="text-micro font-bold text-slate-700 bg-white/70 border border-emerald-100/60 px-2.5 py-1 rounded-full tracking-wide backdrop-blur-[2px]">
                {t("premium.v2.chooseStyle.busBadge")}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight mb-1">
              {t("premium.v2.chooseStyle.busTitle")}
            </h3>
            <p className="text-caption text-slate-600 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.busDesc")}
            </p>

            <div className="mb-4">
              <p className="text-micro text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  {formatPrice(CHOOSE_STYLE_CARD_USD.bus.from)}
                </span>
                <span className="text-slate-500 text-micro font-semibold">{t("premium.v2.chooseStyle.busPerPerson")}</span>
              </div>
              {/* U1 live price — per-person × party = total for the group. */}
              <LivePrice
                party={party}
                reduce={reduce}
                className="mt-1.5 text-caption font-semibold tabular-nums text-emerald-700"
              >
                {t("premium.v2.chooseStyle.totalForParty", {
                  total: formatPrice(CHOOSE_STYLE_CARD_USD.bus.from * party),
                  count: party,
                })}
              </LivePrice>
            </div>

            <V0ShadcnButton
              asChild
              size="lg"
              className={cn(homeBtnPrimary, "mt-4")}
            >
              <Link
                href={withParams(HOME_CTA_BUS_LIST_HREF)}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_browse_bus" });
                  analytics.homeTourTypeCardClick({ type: "bus", party });
                }}
              >
                {t("premium.v2.chooseStyle.busCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </motion.div>
        </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50 via-slate-50/65 to-transparent md:hidden"
          />
        </div>
        <SnapScrollDots containerRef={scrollRef} count={3} />

        {/* U7 — risk-reversal trust line (once, below the cards). All three
            points are already-stated policy: free cancellation 24h + card-hold
            (no charge today) + vetted operators. */}
        <motion.div
          variants={REVEAL_ITEM_VARIANTS}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 md:mt-6"
        >
          {[
            "premium.v2.chooseStyle.riskFreeCancel",
            "premium.v2.chooseStyle.riskNoChargeToday",
            "premium.v2.chooseStyle.riskCheckedOperators",
          ].map((key) => (
            <span
              key={key}
              className="flex items-center gap-1.5 text-micro font-medium text-slate-500 md:text-caption"
            >
              <Check className="h-3.5 w-3.5 flex-none text-emerald-600" aria-hidden />
              {t(key)}
            </span>
          ))}
        </motion.div>

        {/* Dedicated itinerary-builder entry — promoted from the Private card's
            quiet text link to a co-equal full-width card (§B reversal of U4).
            Leads with the hour-by-hour + map customization that is the builder's
            distinct merit. Emerald tone keeps it in the premium/private family
            and distinct from the amber matcher card below. Carries party so the
            builder opens pre-seeded. */}
        {/* Klook prep 2026-06-29: dedicated builder card gated off site-wide. */}
        {ITINERARY_BUILDER_ENABLED && (
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="mt-5 md:mt-6">
          <Link
            href={`/itinerary-builder?party=${party}`}
            onClick={() => analytics.homeTourTypeCardClick({ type: "builder", party })}
            className="focus-ring group flex items-center gap-4 overflow-hidden rounded-card border border-emerald-200/70 bg-gradient-to-b from-white to-emerald-50/50 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-14px_rgba(16,122,87,0.16)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(15,23,42,0.05),0_16px_38px_-16px_rgba(16,122,87,0.22)] motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:gap-5 md:px-7 md:py-6"
          >
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-emerald-200/70 bg-emerald-50 shadow-sm md:h-14 md:w-14">
              <MapPin className="h-6 w-6 text-emerald-600 md:h-7 md:w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold tracking-tight text-slate-900 md:text-lg">
                {t("premium.v2.chooseStyle.builderCardTitle")}
              </p>
              <p className="mt-0.5 text-caption leading-snug text-slate-500 md:text-[13px]">
                {t("premium.v2.chooseStyle.builderCardDesc")}
              </p>
            </div>
            <span className="flex flex-none items-center gap-1.5 text-caption font-semibold text-emerald-700 md:text-[15px]">
              <span className="hidden sm:inline">{t("premium.v2.chooseStyle.builderCardCta")}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 md:h-5 md:w-5" />
            </span>
          </Link>
        </motion.div>
        )}

        {/* U3 — matcher "Get a recommendation" entry. A co-equal but secondary
            (outline) full-width card under the type cards, so the undecided
            segment isn't pushed to a buried link. Routes to the matcher. */}
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="mt-4 md:mt-5">
          <Link
            href={HOME_CTA_MATCHING_HREF}
            onClick={() => analytics.homeTourTypeCardClick({ type: "recommend", party })}
            className="focus-ring group flex items-center gap-4 overflow-hidden rounded-card border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/70 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-14px_rgba(15,23,42,0.14)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(15,23,42,0.05),0_16px_38px_-16px_rgba(15,23,42,0.2)] motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:gap-5 md:px-7 md:py-6"
          >
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl border border-amber-200/70 bg-amber-50 shadow-sm md:h-14 md:w-14">
              <Sparkles className="h-6 w-6 text-amber-500 md:h-7 md:w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold tracking-tight text-slate-900 md:text-lg">
                {t("premium.v2.chooseStyle.recommendCardTitle")}
              </p>
              <p className="mt-0.5 text-caption leading-snug text-slate-500 md:text-[13px]">
                {t("premium.v2.chooseStyle.recommendCardDesc")}
              </p>
            </div>
            <span className="flex flex-none items-center gap-1.5 text-caption font-semibold text-slate-700 md:text-[15px]">
              <span className="hidden sm:inline">{t("premium.v2.chooseStyle.recommendCardCta")}</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 md:h-5 md:w-5" />
            </span>
          </Link>
        </motion.div>

        {/* L3 (chatbot promo) — "talk to the AI agent now" secondary affordance.
            Opens the always-present global assistant instead of routing away,
            so the undecided visitor can ask anything (recommend → quote →
            booking lookup → human) in one tap. */}
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="mt-3 text-center">
          <button
            type="button"
            onClick={openAssistant}
            className="focus-ring group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption font-semibold text-slate-500 transition-colors duration-200 hover:text-amber-700"
          >
            <Sparkles className="h-3.5 w-3.5 flex-none text-amber-500" aria-hidden />
            {t("premium.v2.chooseStyle.askAgentCta")}
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
