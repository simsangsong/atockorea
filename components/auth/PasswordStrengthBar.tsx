'use client';

import type { PasswordStrengthTier } from '@/lib/password-policy';

type Props = {
  tier: PasswordStrengthTier;
  weakLabel: string;
  strongLabel: string;
};

/**
 * Two-segment meter: 약 (weak) / 강 (strong). Strong lights both segments.
 */
export function PasswordStrengthBar({ tier, weakLabel, strongLabel }: Props) {
  const weakOnly = tier === 'weak';
  const strong = tier === 'strong';

  return (
    <div className="mt-2 space-y-1" aria-live="polite">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={`h-2 rounded-full transition-colors ${
              strong ? 'bg-emerald-400 shadow-sm' : weakOnly ? 'bg-amber-400 shadow-sm' : 'bg-slate-200'
            }`}
          />
          <p className="mt-1 text-center text-[11px] font-medium text-slate-500">{weakLabel}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`h-2 rounded-full transition-colors ${
              strong ? 'bg-emerald-500 shadow-sm' : 'bg-slate-200'
            }`}
          />
          <p className="mt-1 text-center text-[11px] font-medium text-slate-500">{strongLabel}</p>
        </div>
      </div>
    </div>
  );
}
