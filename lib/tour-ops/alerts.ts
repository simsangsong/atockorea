'use client';

/**
 * W4.1 — out-of-viewport SOS attention: title/favicon blink + vibration.
 * The in-app surfaces (pin, sound, badge) live in OpsApp; these helpers make
 * a backgrounded ops tab impossible to miss until Web Push (W6) exists.
 * Module-level singletons: one blink loop no matter how many SOS fire.
 */

let blinkTimer: ReturnType<typeof setInterval> | null = null;
let originalTitle: string | null = null;
let originalFaviconHref: string | null = null;
let sosFaviconHref: string | null = null;

const BLINK_TITLE = '🆘 SOS 발생 — 관제센터';
const BLINK_MS = 900;

function faviconLink(): HTMLLinkElement | null {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

function sosFaviconDataUri(): string {
  if (sosFaviconHref) return sosFaviconHref;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 32, 35);
    sosFaviconHref = canvas.toDataURL('image/png');
    return sosFaviconHref;
  } catch {
    return '';
  }
}

/** Start (idempotently) the title + favicon blink loop. */
export function startSosAlarmVisuals(): void {
  if (typeof document === 'undefined' || blinkTimer) return;
  originalTitle = document.title;
  const link = faviconLink();
  originalFaviconHref = link?.href ?? null;
  const sosIcon = sosFaviconDataUri();
  let flip = false;
  blinkTimer = setInterval(() => {
    flip = !flip;
    document.title = flip ? BLINK_TITLE : originalTitle ?? BLINK_TITLE;
    if (link && sosIcon && originalFaviconHref) link.href = flip ? sosIcon : originalFaviconHref;
  }, BLINK_MS);
}

/** Stop the blink loop and restore the original title/favicon. */
export function stopSosAlarmVisuals(): void {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }
  if (typeof document === 'undefined') return;
  if (originalTitle !== null) document.title = originalTitle;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link && originalFaviconHref) link.href = originalFaviconHref;
}

/** Android Chrome vibrates; iOS silently ignores — that's fine, sound covers it. */
export function vibrateSos(): void {
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400]);
  } catch {
    /* not supported */
  }
}
