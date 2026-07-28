/**
 * A nav-app deep-link button in its brand's colour.
 *
 * 🔴 Why the box is built the way it is. `app/globals.css` sets a GLOBAL
 * `button, a { min-height: 44px; min-width: 44px }`. That is the right
 * accessibility floor and §E lists 44px touch as invariant — but an `<a>` is
 * `display: inline` by default, so the rule inflated these chips into pale
 * 44x44 blobs with an 11px label stuck in the top-left corner. That is exactly
 * what the owner photographed ("글자 대비 쓸데없이 여백이 커").
 *
 * So the fix is the pattern this repo already uses for the compact switch:
 * **shrink the visual, keep the hit area.** The anchor keeps its 44px box and
 * becomes a centring flexbox with transparent padding; the coloured pill is an
 * inner span sized to its own text. The finger still gets 44px, the eye gets a
 * button that fits its label.
 */
import { NAV_BRAND, navBrandForKey } from '@/lib/tour-room/navBrand';

/**
 * Simple marks from each brand's basic geometry — NOT the official logo files
 * (see the note in lib/tour-room/navBrand.ts). Drawn in `currentColor` so they
 * always match the brand ink.
 */
function BrandMark({ brand }: { brand: ReturnType<typeof navBrandForKey> }) {
  if (brand === 'kakao') {
    // Kakao's speech bubble: a wide rounded body with a short tail.
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M8 2.2c-3.3 0-6 2-6 4.5 0 1.6 1.1 3 2.8 3.8l-.6 2.2c-.1.3.2.5.4.3l2.6-1.7c.3 0 .5.1.8.1 3.3 0 6-2 6-4.7S11.3 2.2 8 2.2Z"
        />
      </svg>
    );
  }
  if (brand === 'tmap') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden focusable="false">
        <path fill="currentColor" d="M3 3h10v2.3H9.2V13H6.8V5.3H3V3Z" />
      </svg>
    );
  }
  if (brand === 'naver') {
    // Naver's mark is its N.
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden focusable="false">
        <path fill="currentColor" d="M3.4 3h3.3l2.6 4V3h3.3v10H9.3L6.7 9v4H3.4V3Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M8 1.8a4.4 4.4 0 0 0-4.4 4.4c0 3.2 4 7.7 4.2 7.9a.3.3 0 0 0 .4 0c.2-.2 4.2-4.7 4.2-7.9A4.4 4.4 0 0 0 8 1.8Zm0 6a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Z"
      />
    </svg>
  );
}

export default function NavBrandButton({
  chipKey,
  label,
  href,
  onClick,
  testId,
}: {
  /** Chip key from lib/tour-room/nav-links.ts — decides the brand. */
  chipKey: string;
  label: string;
  href: string;
  onClick?: () => void;
  testId?: string;
}) {
  const brand = navBrandForKey(chipKey);
  const { bg, ink } = NAV_BRAND[brand];
  return (
    <a
      href={href}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      /* The 44px floor lives here (invisible); the pill inside is text-sized. */
      className="tr-press -my-1 flex items-center justify-center"
      data-testid={testId}
    >
      <span
        className="tr-meta text-cjk-safe inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold"
        style={{ backgroundColor: bg, color: ink }}
      >
        <BrandMark brand={brand} />
        {label}
      </span>
    </a>
  );
}
