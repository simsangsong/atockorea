/**
 * The ticket object at the heart of the welcome-coupon popup — ivory coupon
 * card with side notches, a perforation line, and a 낙관-style vermilion
 * "환영" stamp on the stub (the Korean-identity detail). Pure CSS/JSX, zero
 * image bytes. `stamped` switches the stub stamp to the oversized landed
 * stamp used on the success step (animated via .wc-stamp-in in globals.css).
 */

const INK = '#17171d';

export function WelcomeTicket({
  figure,
  showOffSuffix,
  stamped = false,
}: {
  /** "10%" or "9折" (zh locales). */
  figure: string;
  /** Latin "OFF" tag — hidden for zh where 9折 already carries the meaning. */
  showOffSuffix: boolean;
  stamped?: boolean;
}) {
  return (
    <div
      className="relative flex -rotate-2 rounded-2xl bg-[#faf7f1] shadow-[0_14px_30px_-14px_rgba(0,0,0,0.7)]"
      aria-hidden
    >
      {/* side notches — punched out with the sheet's ink color */}
      <span
        className="absolute -left-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full"
        style={{ backgroundColor: INK }}
      />
      <span
        className="absolute -right-[9px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full"
        style={{ backgroundColor: INK }}
      />

      {/* main section */}
      <div className="flex-1 py-4 pl-6 pr-2">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-stone-400">
          First booking
        </p>
        <p className="mt-0.5 flex items-baseline leading-none">
          <span
            className="font-serif italic text-[#1c1917]"
            style={{ fontSize: 50, letterSpacing: '-0.02em' }}
          >
            {figure}
          </span>
          {showOffSuffix && (
            <span className="ml-1.5 text-[13px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              off
            </span>
          )}
        </p>
      </div>

      {/* stub */}
      <div className="flex w-[76px] flex-col items-center justify-center gap-1.5 border-l-2 border-dashed border-stone-300 py-2.5">
        <span
          className={
            stamped
              ? 'wc-stamp-in flex h-11 w-11 items-center justify-center rounded-full bg-[#c2410c]'
              : 'flex h-10 w-10 rotate-6 items-center justify-center rounded-full bg-[#c2410c]'
          }
        >
          <span className="text-[12px] font-semibold tracking-tight text-[#faf7f1]">환영</span>
        </span>
        <span className="max-w-full truncate px-0.5 text-[8px] font-medium tracking-[0.08em] text-stone-400">
          WELCOME10
        </span>
      </div>
    </div>
  );
}

/** Sparse amber/ivory sparkles scattered around the popup header. */
export function WelcomeSparkles({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 60" className={className} aria-hidden>
      <path
        d="M28 14 l2.4 5 5.2 0.8 -3.8 3.7 0.9 5.2 -4.7 -2.5 -4.7 2.5 0.9 -5.2 -3.8 -3.7 5.2 -0.8 Z"
        fill="#f5a623"
        opacity="0.9"
        transform="scale(0.6) translate(14 6)"
      />
      <path
        d="M312 30 l1.8 3.8 4 0.6 -2.9 2.8 0.7 4 -3.6 -1.9 -3.6 1.9 0.7 -4 -2.9 -2.8 4 -0.6 Z"
        fill="#e7e5e4"
        opacity="0.45"
        transform="scale(0.7) translate(126 8)"
      />
      <circle cx="298" cy="14" r="1.6" fill="#e7e5e4" opacity="0.6" />
      <circle cx="262" cy="8" r="1.1" fill="#f5a623" opacity="0.7" />
      <circle cx="62" cy="8" r="1.2" fill="#e7e5e4" opacity="0.5" />
      <circle cx="120" cy="48" r="1" fill="#f5a623" opacity="0.5" />
    </svg>
  );
}
