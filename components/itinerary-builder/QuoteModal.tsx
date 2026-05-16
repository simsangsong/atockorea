"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { useTranslations, useI18n } from "@/lib/i18n";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";

interface Props {
  open: boolean;
  onClose: () => void;
  cart: string[];
  region: RegionSlug;
}

/**
 * Manual-quote submission modal. Prefilled from URL intake params (date,
 * party, language, hours, ship from /itinerary-builder Q&A).
 *
 * On submit -> POST /api/itinerary/quote -> redirect to /itinerary-builder/thanks
 */
export default function QuoteModal({ open, onClose, cart, region }: Props) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
        aria-hidden
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl md:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{t("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t("close")}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <p className="text-xs text-slate-500">
            {t("intro", { count: cart.length, region })}
          </p>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
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
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
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
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">{t("dateLabel")}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">{t("partyLabel")}</span>
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
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">{t("notesLabel")}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t("notesPlaceholder")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          {error ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || cart.length === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {submitting ? t("submitting") : t("submit")}
          </button>
          <p className="text-center text-[11px] text-slate-500">{t("responseHint")}</p>
        </form>
      </div>
    </div>
  );
}
