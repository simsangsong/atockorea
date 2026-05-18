"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X, Loader2, Mail, Sparkles, Zap, ImageIcon } from "lucide-react";
import { useTranslations, useI18n } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  open: boolean;
  onClose: () => void;
  cart: string[];
  region: RegionSlug;
  /** Phase 9 — pass POIs so the modal header can render a thumbnail
   *  strip. Optional for backward compat; falls back to count-only when
   *  not provided. */
  pois?: MatchPoiRow[];
}

/**
 * Manual-quote submission modal. Prefilled from URL intake params (date,
 * party, language, hours, ship from /itinerary-builder Q&A).
 *
 * On submit -> POST /api/itinerary/quote -> redirect to /itinerary-builder/thanks
 */
export default function QuoteModal({ open, onClose, cart, region, pois }: Props) {
  const t = useTranslations("itineraryBuilder.quote");
  const { locale } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTrack = (searchParams?.get("track") === "cruise" ? "cruise" : "private") as
    | "private"
    | "cruise";
  const initialDate = searchParams?.get("date") ?? "";
  const initialParty = searchParams?.get("party") ?? "";
  const initialLang = searchParams?.get("lang") ?? "";
  const initialHours = searchParams?.get("hours") ?? "";
  const initialShip = searchParams?.get("ship") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState(initialDate);
  const [party, setParty] = useState(initialParty);
  const [language, setLanguage] = useState(initialLang || locale);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // V2 Phase 9 — eligibility heuristic (client-side hint, not authoritative).
  // The server in-scope rules engine in lib/quote-engine/classify.ts is the
  // source of truth at submit time; this banner just sets expectation.
  // Heuristic: 1-8 stops + numeric party 1-12 → likely instant; else manual.
  const eligibility: "instant" | "manual" = useMemo(() => {
    const partyN = Number(party);
    const partyOk = !party || (Number.isFinite(partyN) && partyN >= 1 && partyN <= 12);
    const sizeOk = cart.length >= 1 && cart.length <= 8;
    return partyOk && sizeOk ? "instant" : "manual";
  }, [cart.length, party]);

  // Cart thumbnails — up to 5 visible; "+N more" badge if cart exceeds.
  const cartThumbs = useMemo(() => {
    if (!pois) return [];
    const byKey = new Map(pois.map((p) => [p.poi_key, p]));
    return cart
      .map((k) => byKey.get(k))
      .filter((p): p is MatchPoiRow => !!p)
      .slice(0, 5);
  }, [cart, pois]);
  const cartOverflow = pois ? Math.max(0, cart.length - cartThumbs.length) : 0;
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError(t("errorEmailRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        poi_keys: cart,
        region,
        track: initialTrack,
        contact_email: email.trim(),
        contact_name: name.trim() || null,
        requested_date: date || null,
        party_size: party ? Number(party) : null,
        language: language || null,
        notes: notes.trim() || null,
        locale,
        intake: {
          ...(initialHours ? { hours: Number(initialHours) } : {}),
          ...(initialShip ? { ship: initialShip } : {}),
        },
        source_url: typeof window !== "undefined" ? window.location.href : null,
      };
      const res = await fetch("/api/itinerary/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || t("errorGeneric"));
        setSubmitting(false);
        return;
      }
      router.push(`/itinerary-builder/thanks?quote_id=${encodeURIComponent(data.quote_id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
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
          className="relative z-10 max-h-[90vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl"
        >
          {/* Hero — same gradient identity as /thanks auto-quote variant */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-5 py-4 md:px-6 md:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 inline-flex items-center gap-1.5 text-eyebrow text-amber-300">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Custom itinerary
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

          <form onSubmit={handleSubmit} className="max-h-[calc(90vh-90px)] space-y-4 overflow-y-auto p-5 md:p-6">
            {/* V2 Phase 9 — cart thumbnail strip. Resolves audit §J.13
                "user doesn't remember what they're quoting". */}
            {cartThumbs.length > 0 ? (
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

            {/* V2 Phase 9 — eligibility indicator. Client heuristic only;
                server in-scope engine is the source of truth at submit. */}
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 ring-1 ${
                eligibility === "instant"
                  ? "bg-emerald-50 ring-emerald-200"
                  : "bg-slate-50 ring-slate-200"
              }`}
            >
              {eligibility === "instant" ? (
                <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
              )}
              <div className="min-w-0">
                <p
                  className={`text-caption font-bold ${
                    eligibility === "instant" ? "text-emerald-800" : "text-slate-800"
                  }`}
                >
                  {eligibility === "instant"
                    ? t("eligibilityInstantLabel")
                    : t("eligibilityManualLabel")}
                </p>
                <p className="mt-0.5 text-micro text-slate-600">
                  {eligibility === "instant"
                    ? t("eligibilityInstantHint")
                    : t("eligibilityManualHint")}
                </p>
              </div>
            </div>

            <p className="text-caption text-slate-500">
              {t("intro", { count: cart.length, region })}
            </p>

          <label className="block">
            <span className="mb-1.5 block text-caption font-semibold text-slate-700">
              {t("nameLabel")}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("dateLabel")}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("partyLabel")}</span>
              <input
                type="number"
                min={1}
                max={20}
                value={party}
                onChange={(e) => setParty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-caption font-semibold text-slate-700">{t("notesLabel")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("notesPlaceholder")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
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
              disabled={submitting || cart.length === 0}
              className={`${homeBtnPrimary} inline-flex items-center justify-center gap-2 shadow-md disabled:cursor-not-allowed disabled:bg-slate-300 ${submitting ? "opacity-90" : ""}`}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mail className="h-4 w-4" aria-hidden />}
              {submitting ? t("submitting") : t("submit")}
            </button>
            <p className="text-center text-micro text-slate-500">{t("responseHint")}</p>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
