'use client';

/**
 * R3v2 (owner call 2026-07-27) — the language controls are DROPDOWNS, not a
 * grid of chips. Both settings (app language, chat language) share this one
 * component so they read as the same control:
 *
 *   trigger  flag + current language + chevron, one tidy row
 *   panel    a bottom sheet listing every option with its flag and a check
 *
 * A native <select> was rejected (it renders OS chrome that looks like a
 * different app), and the chip grid was rejected as "a wall of buttons".
 * A sheet also scales: 9 app locales and 32 chat languages use the exact
 * same UI, and the long list scrolls instead of pushing the page down.
 */

import { useState } from 'react';
import Sheet from '@/components/tour-mode/Sheet';
import { localeFlag } from '@/lib/tour-room/localeFlags';
import { IconDone, IconScrollDown, TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';

export interface LanguageOption {
  /** '' is allowed — the chat "Auto (match my typing)" entry. */
  value: string;
  label: string;
}

export default function LanguageSelect({
  value,
  options,
  onChange,
  label,
  closeLabel,
  testId,
}: {
  value: string;
  options: LanguageOption[];
  onChange: (value: string) => void;
  /** Sheet title + trigger aria-label (already localized by the caller). */
  label: string;
  closeLabel: string;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? ''}`}
        data-testid={testId}
        className="tr-press flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3.5 text-left"
      >
        <span className="tr-body leading-none" aria-hidden>
          {current?.value ? localeFlag(current.value) : '🌐'}
        </span>
        <span className="tr-card-text text-cjk-safe min-w-0 flex-1 font-semibold text-[var(--tr-ink)]">
          {current?.label}
        </span>
        <IconScrollDown
          size={TR_ICON.action}
          strokeWidth={TR_STROKE.default}
          aria-hidden
          className="shrink-0 text-[var(--tr-ink-3)]"
        />
      </button>

      {open && (
        <Sheet open onClose={() => setOpen(false)} closeLabel={closeLabel} title={label}>
          <div
            className="tr-card max-h-[60vh] divide-y divide-[var(--tr-hairline)] overflow-y-auto border border-[var(--tr-hairline)]"
            role="radiogroup"
            aria-label={label}
            data-testid={`${testId}-options`}
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value || 'auto'}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  data-testid={`${testId}-option-${option.value || 'auto'}`}
                  className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left active:bg-[var(--tr-surface-2)]"
                >
                  <span className="tr-body leading-none" aria-hidden>
                    {option.value ? localeFlag(option.value) : '🌐'}
                  </span>
                  <span
                    className={`tr-card-text text-cjk-safe min-w-0 flex-1 ${
                      active ? 'font-bold text-[var(--tr-ink)]' : 'text-[var(--tr-ink-2)]'
                    }`}
                  >
                    {option.label}
                  </span>
                  {active && (
                    <IconDone
                      size={TR_ICON.action}
                      strokeWidth={TR_STROKE.default}
                      aria-hidden
                      className="shrink-0 text-[var(--tr-accent)]"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}
