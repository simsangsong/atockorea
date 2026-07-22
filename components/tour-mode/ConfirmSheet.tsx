'use client';

/**
 * M0/M1 (docs/tour-app-highend-motion-master-plan-2026-07-22.md) — the
 * in-app replacement for window.confirm / window.prompt on tour surfaces.
 *
 * Why not window.confirm: iOS WebView silently returns true for it (the
 * admin ConfirmSheet documents the incident pattern), which on the cockpit
 * meant a departure announcement could fire without a real confirmation.
 * This sheet is promise-based so async chains (confirm → geolocate → POST)
 * read exactly like the window.confirm code they replace:
 *
 *   const { confirm, sheet } = useConfirmSheet();
 *   ...
 *   if (await confirm({ message: '...' })) { ... }
 *   ...
 *   return <>{...}{sheet}</>;
 *
 * `input: true` turns it into a prompt replacement (resolves the typed
 * string, or null on cancel). Buttons follow the M-D4 physics classes;
 * the Sheet itself brings the spring + backdrop + Escape + focus contract.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import Sheet from '@/components/tour-mode/Sheet';
import { tapHaptic } from '@/lib/tour-room/haptics';

export interface ConfirmSheetOptions {
  title?: ReactNode;
  /** Main body line(s). Keep the exact copy of the confirm it replaces. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger material on the confirm button (SOS-red gradient). */
  danger?: boolean;
  /** Prompt mode: show a text input; resolves the string instead of true. */
  input?: boolean;
  inputPlaceholder?: string;
  /** Prompt mode: confirming with an empty field resolves '' instead of
   *  disabling OK (preserves window.prompt's cancel≠empty distinction). */
  allowEmpty?: boolean;
}

type Resolver = (value: boolean | string | null) => void;

export function useConfirmSheet(labels?: { confirm?: string; cancel?: string }) {
  const [options, setOptions] = useState<ConfirmSheetOptions | null>(null);
  const [text, setText] = useState('');
  const resolverRef = useRef<Resolver | null>(null);

  const settle = useCallback((value: boolean | string | null) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOptions(null);
    setText('');
  }, []);

  /** window.confirm replacement — resolves true/false. */
  const confirm = useCallback((opts: ConfirmSheetOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false); // a newer dialog supersedes a stale one
      resolverRef.current = (value) => resolve(value === true);
      setText('');
      setOptions({ ...opts, input: false });
    });
  }, []);

  /** window.prompt replacement — resolves the trimmed string or null. */
  const prompt = useCallback((opts: ConfirmSheetOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current?.(null);
      resolverRef.current = (value) => resolve(typeof value === 'string' ? value : null);
      setText('');
      setOptions({ ...opts, input: true });
    });
  }, []);

  const confirmLabel = options?.confirmLabel ?? labels?.confirm ?? 'OK';
  const cancelLabel = options?.cancelLabel ?? labels?.cancel ?? 'Cancel';

  const sheet = (
    <Sheet
      open={options !== null}
      onClose={() => settle(options?.input ? null : false)}
      title={options?.title}
      closeLabel={cancelLabel}
    >
      {options ? (
        <div className="flex flex-col gap-4 pb-1" data-testid="confirm-sheet">
          <p className="tr-body-lg whitespace-pre-line text-[var(--tr-ink)]">{options.message}</p>
          {options.input ? (
            <input
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={options.inputPlaceholder}
              autoFocus
              className="min-h-[48px] w-full rounded-[var(--tr-radius-input)] border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-4 text-base text-[var(--tr-ink)] focus:border-[var(--tr-accent)] focus:outline-none"
              data-testid="confirm-sheet-input"
            />
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => settle(options.input ? null : false)}
              className="tr-btn-flat min-h-[52px] flex-1 text-base font-bold"
              data-testid="confirm-sheet-cancel"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                tapHaptic();
                if (options.input) {
                  const value = text.trim();
                  settle(value || options.allowEmpty ? value : null);
                } else {
                  settle(true);
                }
              }}
              disabled={options.input && !options.allowEmpty ? text.trim().length === 0 : false}
              className={`min-h-[52px] flex-1 text-base font-bold ${
                options.danger ? 'tr-btn-physical tr-btn-physical--danger' : 'tr-btn-physical'
              }`}
              data-testid="confirm-sheet-ok"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : null}
    </Sheet>
  );

  return { confirm, prompt, sheet };
}
