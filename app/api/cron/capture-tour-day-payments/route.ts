import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/capture-tour-day-payments
 *
 * Captures authorized Stripe card holds on the tour date at 10:00 AM Korea time.
 * This is the actual collection step for card-on-file bookings: the customer
 * is not charged at booking time, but the authorized amount is collected after
 * the morning pickup window has passed.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const CAPTURE_HOUR_KST = 10;

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2025-11-17.clover' });
};

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  // Only the Authorization header is accepted — no `?secret=` query fallback
  // (W-3: query strings leak via logs/Referer and would let anyone trigger
  // off-session charges). Vercel Cron sets `Authorization: Bearer ${CRON_SECRET}`.
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${expected}`;
}

function nowInKst(): Date {
  return new Date(Date.now() + KST_OFFSET_MS);
}

function ymdKst(date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function currentKstHour(): number {
  return nowInKst().getUTCHours();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const targetDate = req.nextUrl.searchParams.get('date') || ymdKst();
  const hourKst = currentKstHour();
  if (!force && hourKst < CAPTURE_HOUR_KST) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'before_10am_kst',
      hourKst,
      targetDate,
    });
  }

  const supabase = createServerClient();
  const stripe = getStripe();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(
      `
      id, booking_reference, tour_id, tour_date, booking_date, status,
      payment_method, payment_status, payment_intent_status, payment_intent_id,
      final_price, no_show_fee_usd_cents, contact_email,
      tours ( title )
    `,
    )
    .eq('status', 'confirmed')
    .eq('payment_method', 'stripe')
    // A0.1 — 시뮬 예약은 돈이 오가는 경로에 절대 들어오지 않는다. 지금은
    // 시더가 payment_method를 안 채워서 우연히 안전하지만, 우연에 기대는
    // 안전은 시더가 한 줄 바뀌는 순간 사라진다.
    .is('sim_tag', null)
    .eq('payment_status', 'authorized')
    .eq('payment_intent_status', 'authorized')
    .not('payment_intent_id', 'is', null)
    // Deep-audit 2026-07-05: builder/chatbot bookings store booking_date as
    // the CREATION date (legacy tour-product rows store it equal to
    // tour_date), so the plain booking_date leg captured same-day-created
    // short-lead bookings DAYS EARLY — "charged on tour day" violated. The
    // booking_date leg now applies to legacy sources only.
    .or(`tour_date.eq.${targetDate},and(booking_date.eq.${targetDate},source.neq.itinerary_builder)`);

  if (error) {
    console.error('[capture-tour-day-payments] query error:', error);
    return NextResponse.json({ error: 'DB query failed', details: error.message }, { status: 500 });
  }

  const summary = {
    targetDate,
    hourKst,
    scanned: bookings?.length ?? 0,
    captured: 0,
    alreadyCaptured: 0,
    skipped: 0,
    failed: 0,
    failures: [] as Array<{ bookingId: string; reason: string }>,
  };

  for (const booking of bookings ?? []) {
    const piId = booking.payment_intent_id as string | null;
    if (!piId) {
      summary.skipped += 1;
      continue;
    }

    let pi: Stripe.PaymentIntent;
    try {
      pi = await stripe.paymentIntents.retrieve(piId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.failures.push({ bookingId: booking.id, reason });
      console.error(`[capture-tour-day-payments] retrieve failed booking=${booking.id}:`, error);
      continue;
    }

    const paidAt = new Date().toISOString();
    if (pi.status === 'succeeded') {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_intent_status: 'captured',
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq('id', booking.id);

      if (updateError) {
        summary.failed += 1;
        summary.failures.push({ bookingId: booking.id, reason: updateError.message });
      } else {
        summary.alreadyCaptured += 1;
      }
      continue;
    }

    if (pi.status !== 'requires_capture') {
      summary.skipped += 1;
      summary.failures.push({ bookingId: booking.id, reason: `not_capturable_${pi.status}` });
      continue;
    }

    try {
      const captured = await stripe.paymentIntents.capture(
        piId,
        {
          metadata: {
            ...pi.metadata,
            settle_reason: 'tour_day_auto_capture_10_kst',
          },
        },
        {
          idempotencyKey: `tour-day-auto-capture-${booking.id}-${targetDate}`,
        },
      );

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          payment_intent_status: 'captured',
          payment_method: 'stripe',
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq('id', booking.id);

      if (updateError) {
        summary.failed += 1;
        summary.failures.push({ bookingId: booking.id, reason: updateError.message });
        console.error(
          `[capture-tour-day-payments] Stripe captured but DB update failed booking=${booking.id}:`,
          updateError,
        );
        continue;
      }

      // F-1 (plan §6.1) — 캡처 확정 시 내부 원장 기입. webhook succeeded와 동일
      // 멱등키라 둘 다 발화해도 1행으로 수렴; 이 크론 경로가 있어 webhook 미수신
      // 상황에서도 원장 갭이 생기지 않는다. best-effort — 실패해도 캡처 무영향.
      //
      // §6.3 — Stripe 실수수료 행도 같이 남긴다. 캡처 직후에는 balance
      // transaction이 아직 안 붙어 있을 수 있는데, 그때는 행을 쓰지 않는다:
      // 나중에 webhook succeeded가 같은 멱등키로 fee 행만 채워 넣는다.
      try {
        const { recordCaptureLedger } = await import('@/lib/ops/finance/ledger');
        const { getFinanceMarginRate } = await import('@/lib/ops/finance/config');
        const { fetchStripeFee } = await import('@/lib/ops/finance/stripeFee');
        const marginRate = await getFinanceMarginRate(supabase);
        const feeLookup = await fetchStripeFee(stripe, captured); // 읽기 전용 (D10)
        const ledger = await recordCaptureLedger(supabase, {
          bookingId: booking.id,
          grossMinor: captured.amount_received ?? captured.amount ?? 0,
          currency: captured.currency ?? 'usd',
          marginRate,
          paymentIntentId: captured.id,
          stripeFee: feeLookup.ok ? feeLookup.fee : null,
          stripeFeeGap: feeLookup.ok ? null : feeLookup.reason,
        });
        if (!ledger.ok) {
          console.error(`[capture-tour-day-payments] ledger record skipped booking=${booking.id}: ${ledger.error}`);
        } else if (!ledger.feeRecorded) {
          console.warn(`[capture-tour-day-payments] stripe fee not recorded booking=${booking.id}: ${ledger.feeGap}`);
        }
      } catch (ledgerErr) {
        console.error(`[capture-tour-day-payments] ledger record failed (non-blocking) booking=${booking.id}:`, ledgerErr);
      }

      summary.captured += 1;
      console.log(
        `[capture-tour-day-payments] captured booking=${booking.id} amount=${captured.amount_received} ${captured.currency}`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.failures.push({ bookingId: booking.id, reason });
      console.error(`[capture-tour-day-payments] capture failed booking=${booking.id}:`, error);
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
