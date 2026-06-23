"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X, Loader2, Mail, Sparkles, ImageIcon } from "lucide-react";
import { useTranslations, useI18n } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type {
  CruisePort,
  JejuPickupZone,
  PriceResult,
  PricingTrack,
} from "@/lib/quote-engine/pricing-policy";
import LivePriceCard from "./LivePriceCard";

interface Props {
  open: boolean;
  onClose: () => void;
  cart: string[];
  region: RegionSlug;
  pois?: MatchPoiRow[];
  /** Authoritative price computed in BuilderShell (Phase 10.3 D17). */
  price: PriceResult;
  /** Optional phone collected separately — currently unused since the
   *  slim modal asks only for name+email+notes. Reserved for Phase 6+
   *  ops-side enhancements. */
  contactPhone?: string | null;
}

/**
 * Contact-only modal (Phase 10.3 slim).
 *
 * Previously this modal duplicated the pricing controls (date, party, lang,
 * duration, pickup, port) that now live in `<PlannerTopRail>` at the top of
 * the planner. The modal is reduced to: cart-thumb strip, the same
 * `<LivePriceCard>` shown in the planner rail (for review), and the contact
 * form (name + email + notes). Submit POSTs `/api/itinerary/quote` with the
 * URL-derived parameters that the shell already used to compute `price`.
 *
 * Phase 5 will replace this entirely with the "Book + hold card" flow; for
 * now we preserve the proposal endpoint so nothing breaks before Phase 5
 * lands.
 */
export default function QuoteModal({
  open,
  onClose,
  cart,
  region,
  pois,
  price,
}: Props) {
  const t = useTranslations("itineraryBuilder.quote");
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();

  const track = (searchParams?.get("track") as PricingTrack) || "private";
  const isDmz = track === "dmz";
  const isCruise = track === "cruise";
  const date = searchParams?.get("date") ?? "";
  const party = searchParams?.get("party") ?? "";
  const guideLang = searchParams?.get("lang") ?? locale;
  const duration = searchParams?.get("duration") ?? searchParams?.get("hours") ?? "8";
  const ship = searchParams?.get("ship") ?? "";
  const pickup = (searchParams?.get("pickup") as JejuPickupZone) ?? "city";
  const cruisePort = (searchParams?.get("port") as CruisePort) ?? "gangjeong";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cartPois = useMemo(() => {
    if (!pois) return [];
    const byKey = new Map(pois.map((p) => [p.poi_key, p]));
    return cart.map((k) => byKey.get(k)).filter((p): p is MatchPoiRow => !!p);
  }, [cart, pois]);
  const cartThumbs = useMemo(() => cartPois.slice(0, 5), [cartPois]);
  const cartOverflow = Math.max(0, cartPois.length - cartThumbs.length);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(t("errorEmailRequired"));
      return;
    }
    if (!date) {
      // Phase 10.5.1 audit fix — was `.replace("email","date")` hack which
      // returned the unchanged Korean string in non-EN locales (since the
      // KO message has no "email" substring). Proper i18n key now.
      setError(t("errorDateRequired"));
      return;
    }
    setSubmitting(true);
    try {
      /**
       * Phase 10.5b — POST /api/itinerary/book (NOT /quote). The new endpoint
       * creates a real `bookings` row + returns the booking_id we redirect to
       * /itinerary-builder/checkout with for the Stripe card hold. The legacy
       * proposal endpoint is going away in 10.5c.
       */
      // Phase 10.5.1 audit fix — guard against `?party=abc` URL-tamper:
      // Number("abc") is NaN which serializes to null in JSON; the server
      // would silently default to 2. Now we coerce explicitly and fall back
      // to the same default the live-price card uses.
      const parsedParty = Number(party);
      const partySize = Number.isFinite(parsedParty) && parsedParty > 0 ? Math.round(parsedParty) : 2;
      const body = {
        poi_keys: cart,
        region,
        track,
        guide_language: guideLang,
        duration_hours: isDmz ? undefined : Number(duration) || 8,
        party_size: partySize,
        jeju_pickup_zone: region === "jeju" && !isDmz && !isCruise ? pickup : undefined,
        cruise_port: isCruise && region === "jeju" ? cruisePort : undefined,
        requested_date: date,
        contact_email: email.trim(),
        contact_name: name.trim() || null,
        notes: notes.trim() || null,
        locale,
        source_url: typeof window !== "undefined" ? window.location.href : null,
        /** Phase 10.5a price-mismatch defense — server compares to its own
         *  recompute and returns 409 if they disagree by >₩1. */
        client_quoted_total: price.total,
      };
      const res = await fetch("/api/itinerary/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Phase 10.5.1 audit fix — was hardcoded Korean copy. Now uses
        // proper i18n keys so EN/JA/ES/ZH/ZH-TW users see localized
        // messages (Phase 7 will transcreate the new keys into the
        // remaining 4 locales; EN+KO populated here).
        //   422 out_of_scope → mailto contact gate
        //   409 price_changed → re-confirm prompt
        //   503 booking_disabled → kill-switch message
        if (res.status === 422 && data.contact_email) {
          setError(t("errorOutOfScope", { email: data.contact_email as string }));
        } else if (res.status === 409 && typeof data.server_total === "number") {
          setError(
            t("errorPriceChanged", {
              total: `₩${data.server_total.toLocaleString()}`,
            }),
          );
        } else {
          setError(data.error || t("errorGeneric"));
        }
        setSubmitting(false);
        return;
      }
      router.push(`/itinerary-builder/checkout?bookingId=${encodeURIComponent(data.booking_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6"
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
          onClick={() => !submitting && onClose()}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-h-[92vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl"
        >
          {/* Hero — gradient identity shared with /thanks auto-quote variant */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-5 py-4 md:px-6 md:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 inline-flex items-center gap-1.5 text-eyebrow text-amber-300">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {t("eyebrow")}
                </p>
                <h2 className="text-h3 text-white">{t("title")}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label={t("close")}
                className="flex-shrink-0 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="max-h-[calc(92vh-88px)] space-y-4 overflow-y-auto p-5 md:p-6"
          >
            {/* Guide-curated booking — no stops picked. Replace the cart strip
                with a short notice so the customer knows the guide plans the
                day at the shown base price. (DMZ is always stop-less by design,
                so this notice is only for private/cruise empty carts.) */}
            {!isDmz && cartThumbs.length === 0 ? (
              <div className="rounded-xl bg-emerald-50/50 px-3.5 py-3 ring-1 ring-emerald-100">
                <p className="text-caption font-bold text-slate-800">{t("guideCuratedTitle")}</p>
                <p className="mt-1 text-micro leading-relaxed text-slate-600">
                  {t("guideCuratedNotice")}
                </p>
              </div>
            ) : null}

            {/* Cart thumbnail strip (skipped for DMZ — fixed itinerary) */}
            {!isDmz && cartThumbs.length > 0 ? (
              <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
                <p className="mb-2 text-eyebrow !text-slate-500">{t("cartHeader")}</p>
                <ul className="flex items-center gap-1.5">
                  {cartThumbs.map((p) => {
                    const img = p.default_image_url || p.images?.[0] || null;
                    return (
                      <li
                        key={p.poi_key}
                        title={p.name_en}
                        className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-slate-100 ring-2 ring-white"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="absolute inset-0 m-auto h-3 w-3 text-slate-400" aria-hidden />
                        )}
                      </li>
                    );
                  })}
                  {cartOverflow > 0 ? (
                    <li className="ml-1 text-micro font-semibold text-slate-500">
                      {t("andNMore", { n: cartOverflow })}
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {/* Live price summary (same component as the planner rail). */}
            <LivePriceCard price={price} isJeju={region === "jeju"} isCruise={isCruise} compact />

            {/* Contact-only fields — pricing inputs live in the PlannerTopRail */}
            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("nameLabel")}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">
                {t("emailLabel")} <span className="text-rose-600">*</span>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("notesLabel")}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t("notesPlaceholder")}
                className={`${inputCls} placeholder:text-slate-300`}
              />
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" aria-hidden />
                <p className="text-caption font-semibold text-rose-700">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className={`${homeBtnPrimary} inline-flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:bg-slate-300 ${submitting ? "opacity-90" : ""}`}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Mail className="h-4 w-4" aria-hidden />
              )}
              {submitting ? t("submitting") : t("submit")}
            </button>
            <p className="text-center text-micro text-slate-500">{t("responseHint")}</p>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
