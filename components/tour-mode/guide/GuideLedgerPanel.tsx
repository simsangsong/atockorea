'use client';

/**
 * W2.4 — the guide console's per-room LEDGER panel (P-D2: cash-settled
 * record, Korean-only). Log an expense (G1 연장 / G2 대납 / G3 주차), watch
 * the guest confirm land, and mark cash received ([수취 완료] → settled).
 * Voiding stays possible until settled. Unsettled total on top — the
 * end-of-day cash conversation is one glance.
 *
 * Colours are the shared tr-plan-root tokens (inherited from the console) so
 * the panel reads as the same product as the guest planner.
 */

import { useCallback, useEffect, useState } from 'react';
import { formatKrw, EXTRA_KIND_LABELS, type ExtraKind } from '@/lib/tour-room/ledger';

interface ExtraRow {
  id: string;
  item: string;
  amount_krw: number;
  kind: string;
  status: string;
  created_at: string;
}

/** Labels come from the ledger single source (T1-5). The manual picker offers
 *  the kinds a guide logs by hand — overtime has its own compute, pickup is a
 *  booking-side charge. */
const kindLabel = (kind: string): string => EXTRA_KIND_LABELS[kind as ExtraKind] ?? kind;
const GUIDE_KIND_ORDER: ExtraKind[] = ['advance', 'ticket', 'parking', 'extension', 'other'];

const STATUS_LABELS: Record<string, string> = {
  logged: '확인 대기',
  confirmed: '손님 확인됨',
  settled: '수취 완료',
  voided: '취소됨',
};

export default function GuideLedgerPanel({
  bookingId,
  token,
}: {
  bookingId: string;
  token: string;
}) {
  const [extras, setExtras] = useState<ExtraRow[] | null>(null);
  const [unsettled, setUnsettled] = useState(0);
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('advance');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = useCallback(
    (init?: RequestInit, body?: Record<string, unknown>) =>
      fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/extras?rt=${encodeURIComponent(token)}`, {
        cache: 'no-store',
        ...init,
        ...(body
          ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
          : {}),
      }),
    [bookingId, token],
  );

  const load = useCallback(async () => {
    try {
      const res = await api();
      if (!res.ok) throw new Error('load_failed');
      const data = (await res.json()) as { extras: ExtraRow[]; unsettled_krw: number };
      setExtras(data.extras);
      setUnsettled(data.unsettled_krw);
      setError(null);
    } catch {
      setError('정산 내역을 불러오지 못했어요.');
      setExtras((prev) => prev ?? []);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const logExtra = async () => {
    const amountKrw = Number.parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!item.trim() || !Number.isFinite(amountKrw) || amountKrw <= 0) return;
    setBusy('log');
    try {
      const res = await api({ method: 'POST' }, { item: item.trim(), amount_krw: amountKrw, kind });
      if (!res.ok) throw new Error('log_failed');
      setItem('');
      setAmount('');
      await load();
    } catch {
      setError('기록에 실패했어요.');
    } finally {
      setBusy(null);
    }
  };

  const transition = async (extraId: string, action: 'settle' | 'void') => {
    setBusy(`${action}:${extraId}`);
    try {
      const res = await api({ method: 'PATCH' }, { extraId, action });
      if (!res.ok) throw new Error('transition_failed');
      await load();
    } catch {
      setError('처리에 실패했어요.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="mt-2.5 rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] p-3"
      data-testid="guide-ledger-panel"
    >
      <div className="flex items-center justify-between">
        <p className="tr-label font-semibold text-[var(--tr-ink-2)]">정산 (당일 현금 직불 · 기록용)</p>
        {unsettled > 0 && (
          <span className="tr-meta rounded-full bg-[var(--tr-accent)] px-2 py-0.5 font-bold text-[var(--tr-bubble-me-ink)]">
            미수취 {formatKrw(unsettled)}
          </span>
        )}
      </div>

      {extras === null ? (
        <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">불러오는 중…</p>
      ) : extras.length === 0 ? (
        <p className="tr-meta mt-2 text-[var(--tr-ink-3)]">기록된 지출이 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {extras.map((extra) => (
            <li
              key={extra.id}
              className={`flex items-center gap-2 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-2 ${
                extra.status === 'voided' ? 'opacity-50' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`tr-card-text font-semibold text-[var(--tr-ink)] ${extra.status === 'voided' ? 'line-through' : ''}`}>
                  {extra.item}
                  <span className="ml-1.5 font-bold text-[var(--tr-accent-deep)]">{formatKrw(extra.amount_krw)}</span>
                </p>
                <p className="tr-meta text-[var(--tr-ink-3)]">
                  {kindLabel(extra.kind)} · {STATUS_LABELS[extra.status] ?? extra.status}
                </p>
              </div>
              {(extra.status === 'logged' || extra.status === 'confirmed') && (
                <>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void transition(extra.id, 'settle')}
                    className="tr-label inline-flex min-h-[44px] shrink-0 items-center rounded-lg bg-[var(--tr-accent)] px-3 font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-50"
                    data-testid="extra-settle"
                  >
                    수취 완료
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void transition(extra.id, 'void')}
                    className="tr-label inline-flex min-h-[44px] shrink-0 items-center rounded-lg bg-[var(--tr-surface-2)] px-3 font-semibold text-[var(--tr-ink-2)] disabled:opacity-50"
                  >
                    취소
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-2.5 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void logExtra();
        }}
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="tr-label shrink-0 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2 py-2 text-[var(--tr-ink)]"
        >
          {GUIDE_KIND_ORDER.map((value) => (
            <option key={value} value={value}>{EXTRA_KIND_LABELS[value]}</option>
          ))}
        </select>
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          maxLength={120}
          placeholder="항목 (예: 입장권 4매)"
          className="tr-card-text min-w-0 flex-1 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          placeholder="₩"
          className="tr-card-text w-24 shrink-0 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-2.5 py-2 text-[var(--tr-ink)] placeholder:text-[var(--tr-ink-3)] focus:border-[var(--tr-accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy === 'log' || !item.trim() || !amount.trim()}
          className="tr-label shrink-0 rounded-xl bg-[var(--tr-accent)] px-3 py-2 font-semibold text-[var(--tr-bubble-me-ink)] disabled:opacity-40"
          data-testid="extra-log"
        >
          기록
        </button>
      </form>

      {extras !== null && extras.some((e) => e.status !== 'voided') && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy('summary');
            void api({ method: 'POST' }, { summary: true })
              .then((res) => {
                if (!res.ok) setError('요약 발송에 실패했어요.');
              })
              .finally(() => setBusy(null));
          }}
          className="tr-label mt-2 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] py-2 font-semibold text-[var(--tr-ink)] disabled:opacity-50"
          data-testid="settlement-summary"
        >
          {busy === 'summary' ? '발송 중…' : '🧾 정산 요약 발송 (손님 채팅으로)'}
        </button>
      )}

      {error && (
        <p className="tr-label mt-2 rounded-xl border border-[var(--tr-danger-soft)] bg-[var(--tr-surface)] px-3 py-2 text-[var(--tr-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
