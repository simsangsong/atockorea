'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Destination chooser as a pill button + floating panel (Phase 2.4) — replaces
 * the admin-style `<select>`. Site-native palette (B32): pin icon + city name,
 * active selection in slate-900. No tour-count badge (the catalogue does not
 * advertise counts anywhere per 2026-05-20 direction).
 */
export interface DestinationPillOption {
  /** Raw city value sent to the API ("all" = no filter). */
  value: string;
  /** Localized display label. */
  label: string;
}

interface DestinationPillSelectProps {
  value: string;
  options: ReadonlyArray<DestinationPillOption>;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Label for the "all destinations" reset option. */
  allLabel: string;
  className?: string;
}

export function DestinationPillSelect({
  value,
  options,
  onChange,
  ariaLabel,
  allLabel,
  className,
}: DestinationPillSelectProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!anchorRef.current || anchorRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = value === 'all' ? allLabel : options.find((o) => o.value === value)?.label ?? allLabel;
  const isActive = value !== 'all';

  return (
    <div className={`relative shrink-0 ${className ?? ''}`} ref={anchorRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          isActive
            ? 'inline-flex h-11 items-center gap-1.5 rounded-2xl bg-slate-900 px-3.5 text-[13px] font-semibold text-white shadow-[0_2px_8px_-3px_rgba(15,23,42,0.4)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30'
            : 'inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/85 px-3.5 text-[13px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20'
        }
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 21s-7-5.686-7-11a7 7 0 1114 0c0 5.314-7 11-7 11z"
          />
          <circle cx="12" cy="10" r="2.5" strokeWidth={2} />
        </svg>
        <span className="max-w-[120px] truncate">{selected}</span>
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-[60vh] w-52 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_24px_56px_-22px_rgba(15,23,42,0.36)] backdrop-blur-md"
        >
          {[{ value: 'all', label: allLabel }, ...options].map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={
                  active
                    ? 'flex w-full items-center rounded-xl bg-slate-900 px-3 py-2 text-left text-[13px] font-semibold text-white'
                    : 'flex w-full items-center rounded-xl px-3 py-2 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-100'
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
