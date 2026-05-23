/**
 * Temperature-unit primitives for the live-weather strip on tour-product
 * detail pages. Pure helpers + a tiny localStorage-backed hook — there is no
 * provider, since only the practical-details section currently exposes
 * temperatures and we don't want to pay the context-rerender cost elsewhere.
 *
 * Live forecast numbers arrive in Celsius from Open-Meteo. The static
 * fallback `practicalWeatherStatic.today.temp` is authored as a Celsius
 * string like `"19°"` or `"20°/19"`; the converter walks the string and
 * substitutes each numeric run rather than trying to fully parse it, so
 * decorations like the degree sign and the slash separator survive.
 */

"use client";

import { useEffect, useState } from "react";

export type TempUnit = "C" | "F";

const TEMP_UNIT_STORAGE_KEY = "atoc.tempUnit";

export function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

export function formatLiveTemp(c: number | null | undefined, unit: TempUnit): string {
  if (c == null || !Number.isFinite(c)) return "—";
  return unit === "C" ? `${c}°` : `${cToF(c)}°`;
}

/**
 * Static fallback strings are authored as Celsius. Walk every signed integer
 * run and substitute its Fahrenheit equivalent when `unit === "F"`. Non-numeric
 * decoration (`°`, `/`, `~`, locale glyphs) flows through unchanged.
 */
export function convertStaticTempString(s: string | undefined | null, unit: TempUnit): string {
  if (!s) return "—";
  if (unit === "C") return s;
  return s.replace(/-?\d+/g, (m) => String(cToF(Number(m))));
}

/**
 * Reads + persists the user's preferred temperature unit. Falls back to
 * Celsius on the server and on first paint so SSR/CSR markup matches; the
 * stored preference applies after hydration.
 */
export function useTempUnit(): [TempUnit, (next: TempUnit) => void] {
  const [unit, setUnit] = useState<TempUnit>("C");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TEMP_UNIT_STORAGE_KEY);
      if (stored === "C" || stored === "F") setUnit(stored);
    } catch {
      // localStorage may be unavailable (private mode, SSR, sandbox) — silently keep default.
    }
  }, []);

  const update = (next: TempUnit) => {
    setUnit(next);
    try {
      window.localStorage.setItem(TEMP_UNIT_STORAGE_KEY, next);
    } catch {
      // no-op
    }
  };

  return [unit, update];
}
