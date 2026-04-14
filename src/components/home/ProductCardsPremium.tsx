"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { useHomepageProductCardImages } from "@/hooks/home/useHomepageProductCardImages";
import { CardFilmGrain } from "@/src/components/home/product-card-glass";

const CUSTOM_JOIN_HREF = "/custom-join-tour";
const TOURS_LIST_HREF = "/tours/list";

type CardVariant = "featured" | "supporting" | "secondary";

/** Desktop right stack: compact card height (Private + Bus). Featured fills 2× that + gap via grid stretch. */
const DESKTOP_COMPACT_CARD_HEIGHT =
  "md:h-[15.25rem] md:min-h-[15.25rem] md:max-h-[15.25rem] lg:h-[15.75rem] lg:min-h-[15.75rem] lg:max-h-[15.75rem]";

function glassCardShellClass(variant: CardVariant): string {
  const base =
    "group relative isolate flex w-full flex-col overflow-hidden rounded-home-card bg-white/[0.05] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-300/80";
  if (variant === "featured") {
    return `${base} min-h-[19.5rem] border border-white/48 shadow-home-offer-smgroup ring-1 ring-sky-400/55 hover:-translate-y-1.5 hover:border-white/62 hover:shadow-home-offer-smgroup-hover sm:min-h-[21rem] md:h-full md:min-h-0 md:max-h-none`;
  }
  if (variant === "secondary") {
    return `${base} min-h-[13.25rem] border border-white/22 shadow-home-offer-bus ring-1 ring-white/10 hover:-translate-y-1 hover:border-white/30 hover:shadow-home-offer-bus-hover sm:min-h-[14.25rem] ${DESKTOP_COMPACT_CARD_HEIGHT} md:shrink-0`;
  }
  return `${base} min-h-[14.5rem] border border-white/36 shadow-home-offer-private ring-1 ring-violet-200/35 hover:-translate-y-1.5 hover:border-white/44 hover:shadow-home-offer-private-hover sm:min-h-[15.5rem] ${DESKTOP_COMPACT_CARD_HEIGHT} md:shrink-0`;
}

/** Atmospheric scrim — gradient-forward; blur stays modest to avoid a muddy wash. */
function overlayClass(variant: CardVariant): string {
  if (variant === "secondary") {
    return "pointer-events-none absolute inset-0 z-[2] rounded-home-card bg-gradient-to-b from-slate-900/40 via-slate-900/30 to-slate-950/[0.94] backdrop-blur-[8px] backdrop-saturate-[1.15]";
  }
  if (variant === "featured") {
    /* Align with HeroPremium best-match card (slightly readable; not the heavy scrim stack) */
    return "pointer-events-none absolute inset-0 z-[2] rounded-home-card bg-gradient-to-b from-slate-900/40 via-slate-900/14 to-slate-950/[0.86] backdrop-blur-[10px] backdrop-saturate-[1.22]";
  }
  return "pointer-events-none absolute inset-0 z-[2] rounded-home-card bg-gradient-to-b from-slate-900/40 via-violet-950/12 to-slate-950/[0.9] backdrop-blur-[9px] backdrop-saturate-[1.2]";
}

/** Bottom vignette for text legibility without flattening the whole photo. */
function vignetteClass(variant: CardVariant): string {
  const base =
    "pointer-events-none absolute inset-x-0 bottom-0 z-[3] rounded-b-home-card bg-gradient-to-t to-transparent";
  if (variant === "featured") {
    return `${base} h-[76%] from-black/62 via-black/28`;
  }
  if (variant === "secondary") {
    return `${base} h-[70%] from-black/58 via-black/34`;
  }
  return `${base} h-[74%] from-black/58 via-black/26`;
}

function imageCoverClass(variant: CardVariant): string {
  const base = "object-cover transition duration-500 ease-out group-hover:scale-[1.02]";
  if (variant === "supporting") {
    return `${base} object-[center_36%] sm:object-center`;
  }
  return `${base} object-center`;
}

function chipClass(variant: CardVariant): string {
  const chipFeatured =
    "rounded-full border px-[0.58rem] py-[0.32rem] text-[8.5px] font-black uppercase tracking-[0.18em] backdrop-blur-md sm:px-2.5 sm:py-[0.42rem] sm:text-[9.5px] sm:tracking-[0.2em] md:px-3 md:py-[0.5rem] md:text-[10px] md:tracking-[0.22em] transition-colors duration-200";
  const chipCompactMd =
    "md:px-2 md:py-[0.28rem] md:text-[7.5px] md:tracking-[0.14em] lg:px-2.5 lg:py-1 lg:text-[8px] lg:tracking-[0.16em]";
  const base = `${chipFeatured} ${chipCompactMd}`;
  if (variant === "featured") {
    return `${chipFeatured} border-white/28 bg-gradient-to-b from-white/16 to-slate-950/58 text-white shadow-[0_1px_0_rgba(255,255,255,0.24)_inset,0_2px_0_rgba(0,0,0,0.1)_inset,0_6px_18px_-6px_rgba(0,0,0,0.42)]`;
  }
  if (variant === "secondary") {
    return `${base} border-white/36 bg-gradient-to-b from-white/[0.22] to-white/[0.09] text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_2px_0_rgba(0,0,0,0.08)_inset,0_6px_16px_-6px_rgba(0,0,0,0.32)]`;
  }
  return `${base} border-violet-200/35 bg-gradient-to-b from-slate-900/52 to-violet-950/42 text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_2px_0_rgba(0,0,0,0.1)_inset,0_6px_18px_-6px_rgba(0,0,0,0.38)]`;
}

function titleClass(variant: CardVariant): string {
  if (variant === "featured") {
    return "mt-1.5 font-black leading-[1.02] tracking-[-0.038em] text-white text-[1.58rem] drop-shadow-[0_3px_28px_rgba(0,0,0,0.45)] sm:mt-2 sm:text-[1.8rem] md:text-[1.92rem] lg:text-[2.02rem]";
  }
  if (variant === "secondary") {
    return "mt-0 font-black leading-[1.1] tracking-[-0.032em] text-white text-[1.14rem] drop-shadow-[0_2px_16px_rgba(0,0,0,0.35)] sm:text-[1.3rem]";
  }
  return "mt-0 font-black leading-[1.1] tracking-[-0.034em] text-white text-[1.26rem] drop-shadow-[0_2px_20px_rgba(0,0,0,0.38)] sm:text-[1.44rem]";
}

function priceClass(variant: CardVariant): string {
  if (variant === "secondary") {
    return "home-type-price-anchor mt-0 text-[13px] text-white/94 drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] sm:text-sm";
  }
  if (variant === "featured") {
    return "home-type-price-anchor mt-1 text-[1.08rem] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.48)] sm:mt-1.5 sm:text-[1.1rem] md:text-lg md:text-[1.24rem] lg:text-[1.32rem]";
  }
  return "home-type-price-anchor mt-0 text-sm text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.38)] sm:text-[15px]";
}

function ctaClass(variant: CardVariant): string {
  const base = "offer-card-cta";
  if (variant === "featured") {
    return `${base} offer-card-cta--featured`;
  }
  if (variant === "secondary") {
    return `${base} offer-card-cta--secondary`;
  }
  return `${base} offer-card-cta--supporting`;
}

function badgeClass(variant: CardVariant): string {
  const base = "home-pill-badge-on-image";
  if (variant === "featured") {
    return `${base} home-pill-badge-on-image--cool`;
  }
  if (variant === "secondary") {
    return `${base}`;
  }
  return `${base} home-pill-badge-on-image--violet`;
}

function grainOpacityClass(variant: CardVariant): string {
  if (variant === "featured") {
    return "rounded-home-card opacity-[0.28]";
  }
  if (variant === "secondary") {
    return "rounded-home-card opacity-[0.16]";
  }
  return "rounded-home-card opacity-[0.22]";
}

type GlassOfferCardProps = {
  variant: CardVariant;
  href: string;
  imageSrc: string;
  imagePriority?: boolean;
  grainId: string;
  badge: string;
  title: string;
  price: string;
  chips: string[];
  cta: string;
  sizes: string;
};

function GlassOfferCard({
  variant,
  href,
  imageSrc,
  imagePriority,
  grainId,
  badge,
  title,
  price,
  chips,
  cta,
  sizes,
}: GlassOfferCardProps) {
  return (
    <Link href={href} className={glassCardShellClass(variant)}>
      <div className="absolute inset-0 z-0 overflow-hidden rounded-home-card">
        <Image
          src={imageSrc}
          alt=""
          fill
          sizes={sizes}
          className={imageCoverClass(variant)}
          priority={imagePriority === true}
        />
      </div>
      <div className={overlayClass(variant)} aria-hidden />
      <div className={vignetteClass(variant)} aria-hidden />
      <CardFilmGrain id={grainId} className={grainOpacityClass(variant)} />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-[5] h-px rounded-t-home-card bg-gradient-to-r from-transparent to-transparent opacity-95 ${
          variant === "featured" ? "via-white/58" : variant === "secondary" ? "via-white/32" : "via-white/44"
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-px rounded-b-home-card bg-gradient-to-r from-transparent to-transparent ${
          variant === "featured" ? "via-white/28 opacity-80" : "via-white/18 opacity-65"
        }`}
        aria-hidden
      />

      <div
        className={`relative z-10 flex h-full min-h-0 flex-1 flex-col justify-end text-white ${
          variant === "featured"
            ? "gap-y-0.5 p-5 pb-5 pt-5 sm:gap-y-1 sm:p-5 sm:pb-5 sm:pt-5 md:gap-y-1.5 md:p-5 md:pb-5 md:pt-5 lg:p-6 lg:pb-6 lg:pt-6"
            : variant === "secondary"
              ? "gap-y-1.5 p-3.5 pb-4 pt-4 sm:gap-y-2 sm:p-4 sm:pb-5 sm:pt-5 md:gap-y-1 md:p-3 md:pb-3 md:pt-3 lg:gap-y-1.5 lg:p-3.5"
              : "gap-y-1.5 p-3.5 pb-4 pt-4 sm:gap-y-2 sm:p-4 sm:pb-5 sm:pt-5 md:gap-y-1 md:p-3 md:pb-3 md:pt-3 lg:gap-y-1.5 lg:p-3.5"
        }`}
      >
        <span className={`shrink-0 ${badgeClass(variant)}`}>{badge}</span>
        <h3 className={`shrink-0 ${titleClass(variant)}`}>{title}</h3>
        <p className={`shrink-0 ${priceClass(variant)}`}>{price}</p>
        <div
          className={`flex flex-wrap gap-x-1 gap-y-1 sm:gap-x-1.5 sm:gap-y-1.5 md:gap-x-1.5 md:gap-y-1.5 ${variant === "secondary" ? "max-w-[95%]" : ""} ${variant === "featured" ? "mt-2 mb-2 sm:mt-2.5 sm:mb-3 md:mb-3 lg:mb-3.5" : "mt-0.5 sm:mt-1"}`}
        >
          {chips.map((chip) => (
            <span key={chip} className={chipClass(variant)}>
              {chip}
            </span>
          ))}
        </div>
        <span className={`shrink-0 ${ctaClass(variant)}`}>{cta}</span>
      </div>
    </Link>
  );
}

/**
 * Product offers: mobile — vertical stack unchanged. Desktop — 50% featured (tall) + 50% column of two compact cards.
 */
export default function ProductCardsPremium() {
  const t = useTranslations("home");
  const images = useHomepageProductCardImages();

  const joinChips = useMemo(
    () =>
      [
        t("premium.productCards.joinChip1"),
        t("premium.productCards.joinChip2"),
        t("premium.productCards.joinChip3"),
        t("premium.productCards.joinChip4"),
      ] as string[],
    [t]
  );
  const privateChips = useMemo(
    () =>
      [t("premium.productCards.privateChip1"), t("premium.productCards.privateChip2"), t("premium.productCards.privateChip3")] as string[],
    [t]
  );
  const busChips = useMemo(
    () => [t("premium.productCards.busChip1"), t("premium.productCards.busChip2")] as string[],
    [t]
  );

  return (
    <section
      className="home-section-y-homeflow home-section-divide relative bg-transparent px-4 sm:px-6 lg:px-8"
      aria-labelledby="product-cards-premium-heading"
    >
      <div className="container mx-auto max-w-6xl">
        <header className="mb-6 text-center sm:mb-7 md:mb-8">
          <p className="home-type-eyebrow text-slate-500">
            {t("premium.productCards.eyebrow")}
          </p>
          <h2
            id="product-cards-premium-heading"
            className="home-type-display mt-2 text-[1.8rem] leading-[1.06] sm:text-[2.05rem] sm:leading-[1.02]"
          >
            {t("premium.productCards.title")}
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:items-stretch md:gap-3.5 lg:gap-4">
          <div className="flex min-h-0 w-full md:h-full md:min-h-0">
            <GlassOfferCard
              variant="featured"
              href={CUSTOM_JOIN_HREF}
              imageSrc={images.join}
              imagePriority
              grainId="pc-grain-join"
              badge={t("premium.productCards.joinBadge")}
              title={t("premium.productCards.joinTitle")}
              price={t("premium.productCards.joinPrice")}
              chips={joinChips}
              cta={t("premium.productCards.joinCta")}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          <div className="flex min-h-0 w-full flex-col gap-3 sm:gap-3.5 md:gap-3.5 lg:gap-4">
            <GlassOfferCard
              variant="supporting"
              href={CUSTOM_JOIN_HREF}
              imageSrc={images.private}
              grainId="pc-grain-private"
              badge={t("premium.productCards.privateBadge")}
              title={t("premium.productCards.privateTitle")}
              price={t("premium.productCards.privatePrice")}
              chips={privateChips}
              cta={t("premium.productCards.privateCta")}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <GlassOfferCard
              variant="secondary"
              href={TOURS_LIST_HREF}
              imageSrc={images.bus}
              grainId="pc-grain-bus"
              badge={t("premium.productCards.busBadge")}
              title={t("premium.productCards.busTitle")}
              price={t("premium.productCards.busPrice")}
              chips={busChips}
              cta={t("premium.productCards.busCta")}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
