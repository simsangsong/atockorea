import Link from 'next/link';
import { Route } from 'lucide-react';
import TourModeComingSoon from '@/components/tour-mode/TourModeComingSoon';
import { isTourModeEnabled } from '@/lib/tour-room/flags';

export const dynamic = 'force-dynamic';

export default function TourPlanIndexPage() {
  if (!isTourModeEnabled()) {
    return <TourModeComingSoon />;
  }

  return (
    <div className="tr-root flex min-h-dvh items-center justify-center bg-[var(--tr-canvas)] px-5">
      <section className="w-full max-w-md rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-5 py-6 text-center shadow-[0_1px_2px_rgba(37,42,44,0.04),0_14px_34px_rgba(37,42,44,0.08)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]">
          <Route size={22} aria-hidden />
        </span>
        <h1 className="mt-4 text-[22px] font-bold leading-tight text-[var(--tr-ink)]">Open your Smart Guide plan link</h1>
        <p className="tr-body mt-2 text-[var(--tr-ink-2)]">
          The planner opens from your private tour link with a booking ID.
        </p>
        <Link
          href="/tour-mode"
          className="tr-body mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-[var(--tr-accent)] px-5 font-bold text-[var(--tr-bubble-me-ink)]"
        >
          Go to Smart Guide
        </Link>
      </section>
    </div>
  );
}
