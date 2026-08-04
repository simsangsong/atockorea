'use client';

/**
 * 현장 재합류 QR (2026-08-04 시나리오 감사 #2) — the staff-side door for a
 * guest who lost their invite link. One tap mints a booking-scoped customer
 * token (server-audited, tour-day expiry) and shows it as a QR for the guest
 * to scan on the spot.
 *
 * The URL is a capability — the overlay says so in plain Korean and the
 * server rate-gates minting, but the real control is the human one: the
 * driver shows the screen to the guest, not to the crowd.
 */

import { useCallback, useState } from 'react';

export default function OnsiteJoinQr({ bookingId, roomSession }: { bookingId: string; roomSession: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');
  const [qr, setQr] = useState<{ dataUrl: string; url: string } | null>(null);

  const open = useCallback(async () => {
    setState('busy');
    try {
      const res = await fetch(`/api/tour-rooms/${bookingId}/reinvite`, {
        method: 'POST',
        headers: { 'x-tour-room-auth': roomSession },
      });
      const data = await res.json();
      if (!res.ok || typeof data?.url !== 'string') {
        setState('error');
        return;
      }
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(data.url, { width: 480, margin: 1 });
      setQr({ dataUrl, url: data.url });
      setState('idle');
    } catch {
      setState('error');
    }
  }, [bookingId, roomSession]);

  return (
    <>
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={() => void open()}
        className="text-cjk-safe flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--tr-surface-2)] font-bold text-[var(--tr-ink)]"
        data-testid="onsite-join-qr-btn"
      >
        {state === 'busy' ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--tr-accent)] border-t-transparent" aria-hidden />
        ) : (
          '손님 입장 QR (링크 분실 시)'
        )}
      </button>
      {state === 'error' ? (
        <p className="tr-label mt-1 text-center text-[var(--tr-danger)]">QR 발급에 실패했어요 — 잠시 후 다시 눌러주세요.</p>
      ) : null}
      {qr ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-white p-6 text-center"
          data-testid="onsite-join-qr-overlay"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.dataUrl} alt="입장 QR" width={300} height={300} />
          <p className="text-xl font-bold text-neutral-900">손님에게만 보여주세요</p>
          <p className="tr-body text-neutral-500">스캔하면 이 팀의 투어룸으로 들어옵니다 · 오늘까지 유효</p>
          <button
            type="button"
            onClick={() => setQr(null)}
            className="text-cjk-safe mt-2 w-full max-w-xs rounded-2xl bg-neutral-900 py-4 text-xl font-bold text-white"
            data-testid="onsite-join-qr-close"
          >
            닫기
          </button>
        </div>
      ) : null}
    </>
  );
}
