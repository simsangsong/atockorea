'use client';

/**
 * U4-D11 — the staff shell's 설정 tab (Korean-only, P-D10).
 *
 * The old guide console had NO settings at all: no theme control (stuck on
 * light), no text-size control (the slider only existed in the guest room).
 * This panel gives staff the two device controls that matter in the field —
 * theme (sunlight vs night driving) and text size (dashboard-distance
 * reading) — on the same useTourRoomSettings store the whole app shares, so
 * the choice follows the operator into the room chat and the cockpit.
 */

import { OPS_PHONE } from '@/components/tour-mode/cockpit/Cockpit';
import { useTourRoomSettings, TEXT_SCALE_STEPS, type TextScaleStep } from '@/hooks/useTourRoomSettings';
import {
  IconPhone,
  IconTextSize,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  TR_ICON,
} from '@/components/tour-mode/icons';

const THEME_OPTIONS = [
  { value: 'light' as const, label: '라이트', Icon: IconThemeLight },
  { value: 'dark' as const, label: '다크', Icon: IconThemeDark },
  { value: 'system' as const, label: '자동', Icon: IconThemeSystem },
];

export default function StaffSettings() {
  const { settings, update } = useTourRoomSettings();

  return (
    <div className="flex flex-col gap-3" data-testid="staff-settings">
      <section className="tr-card border border-[var(--tr-hairline)] p-4">
        <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconThemeSystem size={TR_ICON.chip} className="text-[var(--tr-ink-3)]" aria-hidden />
          화면 모드
        </h3>
        <div className="mt-2.5 flex gap-1 rounded-full bg-[var(--tr-surface-2)] p-1">
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ theme: value })}
              aria-pressed={settings.theme === value}
              data-testid={`staff-theme-${value}`}
              className={`tr-label text-cjk-safe flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-full font-bold ${
                settings.theme === value
                  ? 'bg-[var(--tr-surface)] text-[var(--tr-ink)] shadow-sm'
                  : 'text-[var(--tr-ink-3)]'
              }`}
            >
              <Icon size={TR_ICON.meta} aria-hidden />
              {label}
            </button>
          ))}
        </div>
        <p className="tr-meta mt-2 leading-snug text-[var(--tr-ink-3)]">
          자동은 기기 설정을 따라요. 야간 운행 중 콕핏은 자동에서도 다크로 유지돼요.
        </p>
      </section>

      <section className="tr-card border border-[var(--tr-hairline)] p-4">
        <h3 className="tr-card-text flex items-center gap-1.5 font-semibold text-[var(--tr-ink)]">
          <IconTextSize size={TR_ICON.chip} className="text-[var(--tr-ink-3)]" aria-hidden />
          글자 크기
        </h3>
        <div className="mt-2.5">
          <div className="flex items-center gap-3">
            <span className="tr-meta shrink-0 text-[var(--tr-ink-3)]" aria-hidden>
              가
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={settings.textScale}
              onChange={(event) => update({ textScale: Number(event.target.value) as TextScaleStep })}
              aria-label="글자 크기"
              aria-valuetext={`${settings.textScale} / 5`}
              data-testid="staff-text-scale"
              className="tr-press h-9 min-w-0 flex-1 accent-[var(--tr-accent)]"
            />
            <span className="tr-title shrink-0 text-[var(--tr-ink-3)]" aria-hidden>
              가
            </span>
          </div>
          <div className="mt-1 flex justify-between px-9" aria-hidden>
            {TEXT_SCALE_STEPS.map((step) => (
              <span
                key={step}
                className={`tr-meta tr-num ${
                  step === settings.textScale ? 'font-bold text-[var(--tr-accent-deep)]' : 'text-[var(--tr-ink-3)]'
                }`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </section>

      {OPS_PHONE ? (
        <a
          href={`tel:${OPS_PHONE}`}
          className="tr-card flex min-h-[52px] items-center gap-3 border border-[var(--tr-hairline)] px-4 text-[var(--tr-ink)]"
          data-testid="staff-ops-call"
        >
          <IconPhone size={TR_ICON.action} className="text-[var(--tr-ink-2)]" aria-hidden />
          <span className="tr-card-text font-semibold">운영팀에 전화</span>
        </a>
      ) : null}
    </div>
  );
}
