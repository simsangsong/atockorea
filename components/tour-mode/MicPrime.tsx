'use client';

/**
 * Phase 1 (input-pipeline fix) — the preemptive microphone-permission
 * affordance shared by every Tour Mode voice surface.
 *
 * Behaviour by state (from useMicPermission):
 *   - 'granted' / 'unsupported' → renders nothing (mic just works, or there's
 *     no mic to grant; the text path covers 'unsupported').
 *   - 'prompt' → a "🎤 allow microphone" button + one line of why. Tapping it
 *     opens the browser prompt via getUserMedia (needs the user gesture).
 *   - 'denied' → guidance to re-enable from browser settings (a re-prompt
 *     won't appear once hard-denied), no dead button.
 *
 * `variant` matches the host surface: 'light' for the guide console /
 * customer planner (tr- token system), 'dark' for the driver cockpit.
 */

import { useMicPermission } from '@/hooks/useMicPermission';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { allow: string; whyPrompt: string; deniedTitle: string; deniedHow: string }
> = {
  en: {
    allow: '🎤 Allow microphone',
    whyPrompt: 'Enable your mic to speak — we transcribe and translate it for you.',
    deniedTitle: 'Microphone is blocked',
    deniedHow: 'Tap the 🔒/ⓘ icon in the address bar → Site settings → allow Microphone, then reload.',
  },
  ko: {
    allow: '🎤 마이크 허용',
    whyPrompt: '말로 보내려면 마이크를 켜 주세요. 자동으로 받아쓰고 번역해 드려요.',
    deniedTitle: '마이크가 차단되어 있어요',
    deniedHow: '주소창의 🔒/ⓘ 아이콘 → 사이트 설정 → 마이크 허용으로 바꾼 뒤 새로고침해 주세요.',
  },
  ja: {
    allow: '🎤 マイクを許可',
    whyPrompt: '音声で送るにはマイクを有効にしてください。自動で文字起こし・翻訳します。',
    deniedTitle: 'マイクがブロックされています',
    deniedHow: 'アドレスバーの🔒/ⓘ → サイト設定 → マイクを許可に変更し、再読み込みしてください。',
  },
  es: {
    allow: '🎤 Permitir micrófono',
    whyPrompt: 'Activa el micrófono para hablar: lo transcribimos y traducimos por ti.',
    deniedTitle: 'El micrófono está bloqueado',
    deniedHow: 'Toca el icono 🔒/ⓘ de la barra → Configuración del sitio → permitir Micrófono y recarga.',
  },
  zh: {
    allow: '🎤 允许麦克风',
    whyPrompt: '开启麦克风即可语音发送，我们会自动转写并翻译。',
    deniedTitle: '麦克风已被禁用',
    deniedHow: '点击地址栏的🔒/ⓘ图标 → 网站设置 → 允许麦克风，然后刷新页面。',
  },
};

export default function MicPrime({
  variant = 'light',
  locale = 'ko',
  className = '',
}: {
  variant?: 'light' | 'dark';
  locale?: RoomLocale;
  className?: string;
}) {
  const { state, prime } = useMicPermission();
  if (state === 'granted' || state === 'unsupported') return null;
  const copy = COPY[locale] ?? COPY.ko;
  const dark = variant === 'dark';

  if (state === 'denied') {
    return (
      <div
        className={`rounded-2xl px-4 py-3 ${
          dark ? 'bg-neutral-800 text-neutral-200' : 'bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]'
        } ${className}`}
        data-testid="mic-prime-denied"
      >
        <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-[var(--tr-danger)]'}`}>{copy.deniedTitle}</p>
        <p className={`mt-1 text-xs leading-snug ${dark ? 'text-neutral-300' : 'text-[var(--tr-ink-2)]'}`}>
          {copy.deniedHow}
        </p>
      </div>
    );
  }

  // 'prompt'
  return (
    <div className={className} data-testid="mic-prime-prompt">
      <button
        type="button"
        onClick={() => void prime()}
        className={
          dark
            ? 'w-full rounded-2xl bg-neutral-100 py-3 text-lg font-bold text-neutral-950'
            : 'w-full rounded-full bg-[var(--tr-accent)] py-2.5 text-sm font-bold text-[var(--tr-bubble-me-ink)]'
        }
      >
        {copy.allow}
      </button>
      <p
        className={`mt-1.5 text-center text-xs leading-snug ${
          dark ? 'text-neutral-400' : 'text-[var(--tr-ink-3)]'
        }`}
      >
        {copy.whyPrompt}
      </p>
    </div>
  );
}
