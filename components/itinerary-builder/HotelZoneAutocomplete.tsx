"use client";

import { useEffect, useRef, useState } from "react";
import { classifyJejuHotelZone, type JejuPickupZone } from "@/lib/quote-engine/pricing-policy";

/**
 * Phase D.2 — pick a Jeju hotel via Google Places and auto-derive the pickup
 * zone (시내 / 시외-서·동·남) from its coordinates. The Maps JS + `places`
 * library are already loaded by POICatalogMap on the same page, so this
 * attaches a classic `Autocomplete` once `window.google.maps.places` is ready.
 * Degrades to a disabled input if Places never loads — the manual dropdown
 * beside it stays the source of truth.
 */
export default function HotelZoneAutocomplete({
  onZone,
  placeholder,
}: {
  onZone: (zone: JejuPickupZone, label: string) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onZoneRef = useRef(onZone);
  onZoneRef.current = onZone;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let listener: google.maps.MapsEventListener | null = null;

    const init = (): boolean => {
      if (cancelled || !inputRef.current) return false;
      const places = (window as Window & { google?: typeof google }).google?.maps?.places;
      if (!places) return false;
      const ac = new places.Autocomplete(inputRef.current, {
        fields: ["geometry", "name"],
        // Bias results to Jeju island.
        bounds: { north: 33.65, south: 33.1, west: 126.1, east: 126.99 },
        strictBounds: false,
      });
      listener = ac.addListener("place_changed", () => {
        const loc = ac.getPlace()?.geometry?.location;
        if (!loc) return;
        onZoneRef.current(classifyJejuHotelZone(loc.lat(), loc.lng()), ac.getPlace()?.name ?? "");
      });
      setReady(true);
      return true;
    };

    if (init()) return () => { cancelled = true; listener?.remove(); };
    // Places not ready yet — poll briefly while the map finishes loading it.
    const poll = window.setInterval(() => { if (init()) window.clearInterval(poll); }, 400);
    const giveUp = window.setTimeout(() => window.clearInterval(poll), 12000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(giveUp);
      listener?.remove();
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      disabled={!ready}
      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-caption font-medium placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
    />
  );
}
