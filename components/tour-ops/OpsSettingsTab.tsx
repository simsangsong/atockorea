'use client';

/**
 * W3.5 — settings tab: monitoring date, SOS sound toggle (persisted by the
 * shell), connection readout, and the escape hatch back to the full admin.
 * The Web Push toggle lands here after the W6 gate.
 */

import Link from 'next/link';
import type { OpsConnection } from '@/hooks/useOpsChannels';

const CONNECTION_LABELS: Record<OpsConnection, string> = {
  realtime: '실시간 연결됨 (폴링 0회)',
  connecting: '연결 중…',
  degraded: '일부 룸 연결 끊김 — 백업 폴링 동작 중',
  offline: '실시간 끊김 — 백업 폴링 동작 중',
};

export default function OpsSettingsTab({
  date,
  onDateChange,
  soundOn,
  onSoundChange,
  connection,
}: {
  date: string;
  onDateChange: (date: string) => void;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
  connection: OpsConnection;
}) {
  return (
    <div className="space-y-3 pb-4">
      <section className="rounded-2xl border border-white/10 bg-slate-900 p-4">
        <h2 className="text-[13px] font-semibold text-slate-300">모니터링 날짜</h2>
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-800 px-3 text-[14px] text-slate-100"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">해당 날짜의 모든 투어룸을 구독합니다.</p>
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900 p-4">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-300">SOS 사운드</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">새 SOS 수신 시 경보음을 울립니다.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={soundOn}
          onClick={() => onSoundChange(!soundOn)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${soundOn ? 'bg-emerald-500' : 'bg-slate-700'}`}
        >
          <span
            className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
              soundOn ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900 p-4">
        <h2 className="text-[13px] font-semibold text-slate-300">연결 상태</h2>
        <p className="mt-1 text-[12px] text-slate-400">{CONNECTION_LABELS[connection]}</p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900 p-4">
        <h2 className="text-[13px] font-semibold text-slate-300">홈 화면에 설치</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
          Android Chrome: 메뉴 ⋮ → &quot;앱 설치&quot;. iOS Safari: 공유 → &quot;홈 화면에 추가&quot;.
          설치하면 관제센터가 단독 앱으로 열립니다.
        </p>
      </section>

      <Link
        href="/admin"
        className="block rounded-2xl border border-white/10 bg-slate-900 p-4 text-[13px] font-medium text-slate-300"
      >
        ← 어드민 대시보드로
      </Link>
    </div>
  );
}
