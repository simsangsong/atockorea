'use client';

/**
 * W3.5 — settings tab: monitoring date, SOS sound toggle (persisted by the
 * shell), connection readout, and the escape hatch back to the full admin.
 * W6 — Web Push toggle: subscribes this device so SOS/도움요청 alerts arrive
 * even when the console is closed. Needs the registered SW (production) and
 * notification permission; every failure path surfaces a toast instead of a
 * silent dead toggle.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { OpsConnection } from '@/hooks/useOpsChannels';
import { getOpsToken } from '@/components/tour-ops/opsShared';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function PushToggleSection() {
  const [state, setState] = useState<'unsupported' | 'off' | 'on' | 'busy'>('off');

  useEffect(() => {
    const probe = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setState('unsupported');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration('/admin/tour-ops');
        const subscription = await registration?.pushManager.getSubscription();
        setState(subscription ? 'on' : 'off');
      } catch {
        setState('off');
      }
    };
    void probe();
  }, []);

  const enable = useCallback(async () => {
    setState('busy');
    try {
      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error('푸시 키가 설정되지 않았습니다 (VAPID env).');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('알림 권한이 거부되었습니다.');
      const registration = await navigator.serviceWorker.getRegistration('/admin/tour-ops');
      if (!registration) throw new Error('서비스워커가 없습니다 — 프로덕션 설치 후 사용 가능합니다.');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const token = await getOpsToken();
      const res = await fetch('/api/admin/tour-ops/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '구독 등록 실패');
      setState('on');
      toast.success('푸시 알림이 켜졌어요 — 앱을 닫아도 SOS가 울립니다.');
    } catch (error) {
      setState('off');
      toast.error(error instanceof Error ? error.message : '푸시 구독 실패');
    }
  }, []);

  const disable = useCallback(async () => {
    setState('busy');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/admin/tour-ops');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const token = await getOpsToken();
        await fetch('/api/admin/tour-ops/push-subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          body: JSON.stringify({ endpoint }),
        });
      }
      setState('off');
    } catch {
      setState('off');
    }
  }, []);

  // W3.4 — a row inside the grouped "알림·모니터링" card (not its own card).
  if (state === 'unsupported') {
    return (
      <div className="p-4">
        <h2 className="text-[13px] font-semibold text-[var(--tr-ink)]">푸시 알림</h2>
        <p className="mt-1 text-[12px] text-[var(--tr-ink-3)]">이 브라우저는 Web Push를 지원하지 않습니다.</p>
      </div>
    );
  }
  const on = state === 'on';
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--tr-ink)]">푸시 알림</h2>
        <p className="mt-0.5 text-[11px] text-[var(--tr-ink-3)]">앱을 닫아도 SOS·도움요청을 이 기기로 알립니다.</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="푸시 알림"
        disabled={state === 'busy'}
        onClick={() => void (on ? disable() : enable())}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          on ? 'bg-emerald-500' : 'bg-[var(--tr-ink-3)]'
        }`}
      >
        <span
          className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
            on ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

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
  // W3.4 — iOS grouped-list: hairline-divided rows inside one card per group,
  // instead of six loose full cards (the ops center's biggest density win).
  return (
    <div className="space-y-3 pb-4">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">알림 · 모니터링</p>
      <section className="divide-y divide-[var(--tr-hairline)] overflow-hidden rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
        <div className="p-4">
          <h2 className="text-[13px] font-semibold text-[var(--tr-ink)]">모니터링 날짜</h2>
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3 text-[14px] text-[var(--tr-ink)]"
          />
          <p className="mt-1.5 text-[11px] text-[var(--tr-ink-3)]">해당 날짜의 모든 투어룸을 구독합니다.</p>
        </div>

        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--tr-ink)]">SOS 사운드</h2>
            <p className="mt-0.5 text-[11px] text-[var(--tr-ink-3)]">새 SOS 수신 시 경보음을 울립니다.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={soundOn}
            onClick={() => onSoundChange(!soundOn)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${soundOn ? 'bg-emerald-500' : 'bg-[var(--tr-ink-3)]'}`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-white transition-transform ${
                soundOn ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <PushToggleSection />
      </section>

      <p className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">연결 · 앱</p>
      <section className="divide-y divide-[var(--tr-hairline)] overflow-hidden rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
        <div className="p-4">
          <h2 className="text-[13px] font-semibold text-[var(--tr-ink)]">연결 상태</h2>
          <p className="mt-1 text-[12px] text-[var(--tr-ink-2)]">{CONNECTION_LABELS[connection]}</p>
        </div>

        <div className="p-4">
          <h2 className="text-[13px] font-semibold text-[var(--tr-ink)]">홈 화면에 설치</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--tr-ink-2)]">
            Android Chrome: 메뉴 ⋮ → &quot;앱 설치&quot;. iOS Safari: 공유 → &quot;홈 화면에 추가&quot;.
            설치하면 관제센터가 단독 앱으로 열립니다.
          </p>
        </div>
      </section>

      <Link
        href="/admin"
        className="block rounded-2xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] p-4 text-[13px] font-medium text-[var(--tr-ink)] active:bg-[var(--tr-surface-2)]"
      >
        ← 어드민 대시보드로
      </Link>
    </div>
  );
}
