/** Shared glass chrome for homepage image product cards (grain + check icon). */

export function CardFilmGrain({ id, className = "rounded-home-card opacity-[0.24]" }: { id: string; className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-[4] h-full w-full mix-blend-soft-light ${className}`}
      viewBox="0 0 256 256"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <filter id={id} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="4" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
      </defs>
      <rect width="256" height="256" filter={`url(#${id})`} fill="white" opacity="0.9" />
    </svg>
  );
}

export function ProductCardCheckIcon({ compact }: { compact?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`mt-0.5 shrink-0 text-blue-300 ${compact ? "h-3.5 w-3.5" : "h-[13px] w-[13px]"}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}
