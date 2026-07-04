/**
 * Server-safe deep-link seed parsers for the booking card (`?date=`, `?language=`).
 *
 * These pure helpers are consumed by the server component
 * `app/tour-product/[slug]/page.tsx`, so they MUST NOT live in the `"use client"`
 * `bookingShared.tsx` module — calling a client-module export from a server
 * component throws at runtime ("Attempted to call X from the server but X is on
 * the client") and trips the root error boundary on every product page.
 *
 * `bookingShared.tsx` re-exports these to keep its public API stable.
 */

import type { PreferredLanguage } from "./bookingShared";

/** Local-timezone YYYY-MM-DD for "today", matching `bookingShared.todayYmdLocal()`. */
function todayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Deep-link seeding — validate a `?date=YYYY-MM-DD` query param so an AI agent
 * (or a shared link) can pre-fill the booking card. Returns `undefined` for
 * malformed or past dates so the card keeps its default lead-time date.
 */
export function coerceSeedDateYmd(raw: string | string[] | undefined | null): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  if (Number.isNaN(new Date(`${v}T00:00:00`).getTime())) return undefined;
  return v >= todayYmdLocal() ? v : undefined;
}

/**
 * Deep-link seeding — parse `?party=` / `?guests=` (home stepper carry-through
 * and agent deep-links) into a positive guest count. Returns undefined for
 * missing/invalid input so the booking card keeps its default.
 */
export function coerceSeedGuests(raw: string | string[] | undefined | null): number | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Deep-link seeding — map a `?language=` query param onto the booking card's
 * guide-language toggle. Only en/zh/ko have a dedicated toggle; other locales
 * (ja/es) fall through to `undefined` so the card keeps its default.
 */
export function coerceSeedLanguage(
  raw: string | string[] | undefined | null,
): PreferredLanguage | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  const s = v.trim().toLowerCase();
  if (s === "ko" || s === "kr" || s === "korean") return "ko";
  if (s.startsWith("zh") || s === "cn" || s === "chinese") return "zh";
  if (s === "en" || s === "english") return "en";
  return undefined;
}
