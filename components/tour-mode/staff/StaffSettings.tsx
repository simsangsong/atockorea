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

import { useState } from 'react';
import { OPS_PHONE } from '@/components/tour-mode/cockpit/Cockpit';
import SkinPicker from '@/components/tour-mode/SkinPicker';
import { useTourRoomSettings, TEXT_SCALE_STEPS, type TextScaleStep } from '@/hooks/useTourRoomSettings';
import {
  IconCollapse,
  IconPhone,
  IconScrollDown,
  IconSeat,
  IconTabChat,
  IconTextSize,
  IconThemeDark,
  IconThemeLight,
  IconThemeSystem,
  IconTip,
  IconVehicle,
  TR_ICON,
} from '@/components/tour-mode/icons';

/** W5 (U4-D13) — 스태프용 앱 사용 안내. 평소엔 접혀 있지만 항상 맨 위에
 *  보이는 진입 행 (사용자 지시: "접어두되 눈에 잘 보이게"). ko 전용 (P-D10). */
const STAFF_MANUAL: Array<{ Icon: typeof IconTabChat; title: string; body: string }> = [
  {
    Icon: IconTabChat,
    title: '대화 — 손님과 이야기하기',
    body:
      '손님 카드의 [채팅]을 누르면 그 손님과의 대화방이 열려요. 한국어로 쓰면 손님 언어로 자동 번역됩니다. ' +
      '아래 "전체 안내"에서 모든 손님에게 한 번에 공지할 수 있고, 이름 칩을 눌러 한 팀에게만 보낼 수도 있어요.',
  },
  {
    Icon: IconSeat,
    title: '좌석·명단 — 좌석 터치로 바로',
    body:
      '좌석배치도에서 좌석을 터치하면 [대화 열기]·[이 손님에게만 공지]·체크인·노쇼 처리를 할 수 있어요. ' +
      '명단 행을 누르면 손님 카드(알레르기·메모 포함)가 열립니다.',
  },
  {
    Icon: IconVehicle,
    title: '운행 — 주행 준비와 운전 모드',
    body:
      '출발 전 체크리스트를 확인하고, [운전 모드]를 누르면 큰 버튼의 다크 콕핏이 열려요. ' +
      '콕핏에서는 원버튼으로 지연·주차핀·복귀시간을 보내고, 손님 메시지를 소리로 읽어줍니다.',
  },
  {
    Icon: IconThemeSystem,
    title: '설정 — 테마와 글자 크기',
    body:
      '화면 모드(라이트/다크/자동)와 글자 크기는 이 기기에 저장되고, 대화방·콕핏까지 함께 적용돼요.',
  },
];

const THEME_OPTIONS = [
  { value: 'light' as const, label: '라이트', Icon: IconThemeLight },
  { value: 'dark' as const, label: '다크', Icon: IconThemeDark },
  { value: 'system' as const, label: '자동', Icon: IconThemeSystem },
];

export default function StaffSettings() {
  const { settings, update } = useTourRoomSettings();
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3" data-testid="staff-settings">
      {/* U4-D13 — 앱 사용 안내: 접힌 아코디언, 항상 최상단 (요청 1-1). */}
      <section className="tr-card border border-[var(--tr-hairline)]">
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          aria-expanded={manualOpen}
          className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left"
          data-testid="staff-manual-toggle"
        >
          <span className="tr-chip tr-chip--accent flex h-9 w-9 shrink-0 items-center justify-center !rounded-[13px]">
            <IconTip size={TR_ICON.chip} aria-hidden />
          </span>
          <span className="tr-card-text text-cjk-safe min-w-0 flex-1 font-semibold text-[var(--tr-ink)]">
            앱 사용 안내
          </span>
          {manualOpen ? (
            <IconCollapse size={TR_ICON.chip} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
          ) : (
            <IconScrollDown size={TR_ICON.chip} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
          )}
        </button>
        {manualOpen && (
          <div className="tr-hairline-t space-y-3.5 px-4 py-3.5" data-testid="staff-manual-body">
            {STAFF_MANUAL.map(({ Icon, title, body }) => (
              <div key={title} className="flex gap-2.5">
                <Icon size={TR_ICON.chip} className="mt-0.5 shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                <div className="min-w-0">
                  <p className="tr-card-text text-cjk-body font-semibold text-[var(--tr-ink)]">{title}</p>
                  <p className="tr-card-text text-cjk-body mt-0.5 leading-relaxed text-[var(--tr-ink-2)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
        {/* C-D6 — 배경 테마: 콘솔·대화방·손님방 셸에 즉시 적용(이 기기 저장). */}
        <p className="tr-label mt-4 font-semibold text-[var(--tr-ink-2)]">배경 테마</p>
        <div className="mt-2">
          <SkinPicker locale="ko" />
        </div>
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
