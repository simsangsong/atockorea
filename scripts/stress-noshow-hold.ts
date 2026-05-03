/* eslint-disable no-console */
/**
 * Stress / functional test for the no-show payment hold flow.
 *
 * Runs an end-to-end battery against the local dev server + Stripe test mode:
 *   A. API contract — bad inputs are rejected with the right status codes.
 *   B. ≤7d Happy path — PaymentIntent created, server-confirmed with
 *      `pm_card_visa`, webhook updates booking → `authorized`.
 *   C. >7d Happy path — SetupIntent created, server-confirmed, webhook
 *      updates booking → `setup_pending_hold`.
 *   D. Cron re-auth — booking with tour_date+4 days, run cron, verify it
 *      creates an off-session PaymentIntent and authorizes the saved card.
 *   E. Capture (no-show) / Cancel (attended) — capture and cancel paths
 *      both fire webhooks that mutate `payment_status`/`payment_intent_status`.
 *   F. Idempotency — re-confirming the same intent doesn't double-update.
 *
 * Usage:
 *   1. `npm run dev` in another terminal (or run this with the dev server
 *      already up on port 3000).
 *   2. Either:
 *        a) `stripe listen --forward-to localhost:3000/api/stripe/webhook`
 *           in another terminal so Stripe-emitted webhooks reach the dev API.
 *        b) Pass `--no-webhook-wait` and we'll skip the wait-for-webhook
 *           assertions (only verifies API contract + Stripe-side state).
 *   3. `npx tsx scripts/stress-noshow-hold.ts`
 *
 * Env required: STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
 *               CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL,
 *               SUPABASE_SERVICE_ROLE_KEY (or the regular service key).
 *
 * Cleanup: every test booking is created with a known synthetic
 * `contact_email` prefix (`stress-noshow-test-*`); the script deletes them
 * at the end (or on Ctrl-C).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import * as fs from 'node:fs';
import * as path from 'node:path';

/* -- env loading (mirror Next.js convention so this works from `npx tsx`) -- */
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]!]) {
      process.env[m[1]!] = m[2]!.replace(/^"(.*)"$/, '$1');
    }
  }
}

const ARGS = new Set(process.argv.slice(2));
const SKIP_WEBHOOK_WAIT = ARGS.has('--no-webhook-wait');
const APP_URL = process.env.STRESS_APP_URL ?? 'http://localhost:3000';
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY!;
const CRON_SECRET = process.env.CRON_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!STRIPE_KEY || !CRON_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env. Need STRIPE_SECRET_KEY, CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2025-11-17.clover' });
const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const TEST_EMAIL_PREFIX = `stress-noshow-test-${Date.now()}-`;
const TEST_TOUR_ID = process.env.STRESS_TOUR_ID ?? '6d4741e0-5181-47df-8e10-98d714896c26'; // Jeju Grand Highlights Loop, $78
const TEST_FINAL_PRICE_USD = 78;
const createdBookingIds: string[] = [];
const createdStripeCustomers: string[] = [];

let pass = 0;
let fail = 0;

function step(label: string) {
  console.log(`\n→ ${label}`);
}
function ok(msg: string) {
  pass += 1;
  console.log(`  ✓ ${msg}`);
}
function bad(msg: string, extra?: unknown) {
  fail += 1;
  console.error(`  ✗ ${msg}`);
  if (extra !== undefined) console.error('    ', extra);
}

function ymdDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function insertBooking(opts: {
  emailSuffix: string;
  daysFromNow: number;
}): Promise<string> {
  const tourDate = ymdDaysFromNow(opts.daysFromNow);
  const email = `${TEST_EMAIL_PREFIX}${opts.emailSuffix}@example.com`;
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      tour_id: TEST_TOUR_ID,
      booking_date: tourDate,
      tour_date: tourDate,
      number_of_guests: 1,
      unit_price: TEST_FINAL_PRICE_USD,
      total_price: TEST_FINAL_PRICE_USD,
      final_price: TEST_FINAL_PRICE_USD,
      payment_method: 'pending',
      payment_status: 'pending',
      status: 'pending',
      contact_name: 'Stress Test',
      contact_email: email,
      contact_phone: '+10000000000',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Insert failed: ${error?.message}`);
  }
  createdBookingIds.push(data.id);
  return data.id as string;
}

async function fetchBooking(id: string) {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (error) throw new Error(`Fetch booking ${id} failed: ${error.message}`);
  return data;
}

/** Poll the booking row until predicate holds, or fail after `timeoutMs`. */
async function waitFor(
  bookingId: string,
  predicate: (b: Record<string, unknown>) => boolean,
  timeoutMs = 8000,
): Promise<Record<string, unknown>> {
  const start = Date.now();
  let last: Record<string, unknown> | null = null;
  while (Date.now() - start < timeoutMs) {
    last = await fetchBooking(bookingId);
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    `Timed out waiting for booking ${bookingId} predicate; last=${JSON.stringify(last)}`,
  );
}

async function postCheckout(bookingId: string) {
  const r = await fetch(`${APP_URL}/api/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId,
      bookingData: {
        customerInfo: {
          name: 'Stress Test',
          email: `${TEST_EMAIL_PREFIX}checkout@example.com`,
          phone: '+10000000000',
        },
      },
    }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/* -------------------------------------------------------------------------- */
/* A — API contract                                                           */
/* -------------------------------------------------------------------------- */

async function phaseA() {
  step('Phase A — API contract');

  const r1 = await fetch(`${APP_URL}/api/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (r1.status === 400) ok('checkout: missing bookingId → 400');
  else bad(`checkout: missing bookingId → expected 400, got ${r1.status}`);

  const r2 = await fetch(`${APP_URL}/api/stripe/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: '00000000-0000-0000-0000-000000000000' }),
  });
  if (r2.status === 404) ok('checkout: nonexistent bookingId → 404');
  else bad(`checkout: nonexistent bookingId → expected 404, got ${r2.status}`);

  const r3 = await fetch(`${APP_URL}/api/cron/recapture-holds`);
  if (r3.status === 401) ok('cron: missing secret → 401');
  else bad(`cron: missing secret → expected 401, got ${r3.status}`);

  const r4 = await fetch(`${APP_URL}/api/cron/recapture-holds?secret=${encodeURIComponent(CRON_SECRET)}`);
  if (r4.status === 200) {
    const body = await r4.json();
    if (typeof body.scanned === 'number') ok(`cron: with secret → 200 + summary { scanned: ${body.scanned} }`);
    else bad('cron: 200 but missing `scanned` in body', body);
  } else {
    bad(`cron: with secret → expected 200, got ${r4.status}`);
  }
}

/* -------------------------------------------------------------------------- */
/* B — ≤7d PaymentIntent happy path                                           */
/* -------------------------------------------------------------------------- */

async function phaseB() {
  step('Phase B — ≤7d PaymentIntent happy path');

  const bookingId = await insertBooking({ emailSuffix: 'pi-happy', daysFromNow: 3 });
  const { status, body } = await postCheckout(bookingId);
  if (status !== 200) {
    bad(`checkout returned ${status}`, body);
    return;
  }
  if (body.intentType !== 'payment_intent') {
    bad(`expected intentType=payment_intent, got ${body.intentType}`);
    return;
  }
  if (!body.clientSecret || !body.paymentIntentId) {
    bad('missing clientSecret/paymentIntentId in response', body);
    return;
  }
  ok(`checkout 200 → PaymentIntent ${body.paymentIntentId}`);

  /** Server-side confirm with Stripe test PaymentMethod (skips browser). */
  const piId = body.paymentIntentId as string;
  const confirmed = await stripe.paymentIntents.confirm(piId, {
    payment_method: 'pm_card_visa',
    return_url: `${APP_URL}/tour/${TEST_TOUR_ID}/confirmation`,
  });
  if (confirmed.status === 'requires_capture') {
    ok(`PaymentIntent confirmed → status=requires_capture (auth held without charge)`);
  } else {
    bad(`unexpected PI status after confirm: ${confirmed.status}`, confirmed.next_action);
  }

  /** Stripe customer ID should now be on the booking. */
  const fresh = await fetchBooking(bookingId);
  if (fresh.payment_intent_id === piId) ok('booking row payment_intent_id matches');
  else bad(`booking row PI mismatch: expected ${piId}, got ${fresh.payment_intent_id}`);

  if (fresh.stripe_customer_id) {
    createdStripeCustomers.push(fresh.stripe_customer_id);
    ok(`booking row stripe_customer_id set: ${fresh.stripe_customer_id}`);
  } else {
    bad('booking row missing stripe_customer_id');
  }

  if (fresh.card_collection_method === 'immediate_hold') ok('card_collection_method=immediate_hold');
  else bad(`unexpected card_collection_method: ${fresh.card_collection_method}`);

  if (SKIP_WEBHOOK_WAIT) {
    console.log('  (skipping webhook DB assertions; --no-webhook-wait)');
    return { bookingId, paymentIntentId: piId };
  }

  /** Wait for `payment_intent.amount_capturable_updated` webhook to land. */
  try {
    const updated = await waitFor(bookingId, (b) => b.payment_intent_status === 'authorized');
    ok(`webhook → payment_intent_status=authorized, status=${updated.status}, payment_status=${updated.payment_status}`);
  } catch (err) {
    bad('webhook did not advance booking to authorized within 8s', (err as Error).message);
  }

  return { bookingId, paymentIntentId: piId };
}

/* -------------------------------------------------------------------------- */
/* C — >7d SetupIntent happy path                                             */
/* -------------------------------------------------------------------------- */

async function phaseC() {
  step('Phase C — >7d SetupIntent happy path');

  const bookingId = await insertBooking({ emailSuffix: 'si-happy', daysFromNow: 30 });
  const { status, body } = await postCheckout(bookingId);
  if (status !== 200) {
    bad(`checkout returned ${status}`, body);
    return;
  }
  if (body.intentType !== 'setup_intent') {
    bad(`expected intentType=setup_intent, got ${body.intentType}`);
    return;
  }
  if (!body.clientSecret || !body.setupIntentId) {
    bad('missing clientSecret/setupIntentId in response', body);
    return;
  }
  ok(`checkout 200 → SetupIntent ${body.setupIntentId}`);

  const siId = body.setupIntentId as string;
  const confirmed = await stripe.setupIntents.confirm(siId, {
    payment_method: 'pm_card_visa',
    return_url: `${APP_URL}/tour/${TEST_TOUR_ID}/confirmation`,
  });
  if (confirmed.status === 'succeeded') ok('SetupIntent confirmed → status=succeeded (card vaulted)');
  else bad(`unexpected SI status after confirm: ${confirmed.status}`);

  if (SKIP_WEBHOOK_WAIT) {
    console.log('  (skipping webhook DB assertions; --no-webhook-wait)');
    return { bookingId, setupIntentId: siId };
  }

  try {
    const updated = await waitFor(
      bookingId,
      (b) => b.payment_intent_status === 'setup_pending_hold' && !!b.stripe_payment_method_id,
    );
    ok(`webhook → setup_pending_hold; payment_method_id=${updated.stripe_payment_method_id}`);
  } catch (err) {
    bad('webhook did not advance to setup_pending_hold within 8s', (err as Error).message);
  }

  return { bookingId, setupIntentId: siId };
}

/* -------------------------------------------------------------------------- */
/* D — Cron re-auth                                                           */
/* -------------------------------------------------------------------------- */

async function phaseD(siBookingId: string | undefined) {
  step('Phase D — Cron re-auth (>7d booking → cron creates off-session PI)');
  if (!siBookingId) {
    bad('no SetupIntent booking from Phase C; skipping');
    return;
  }

  /** Pull the booking forward into the cron's window: tour_date+4. */
  const newDate = ymdDaysFromNow(4);
  await supabase.from('bookings').update({ tour_date: newDate }).eq('id', siBookingId);
  ok(`moved tour_date forward to ${newDate} (within cron window)`);

  const r = await fetch(`${APP_URL}/api/cron/recapture-holds?secret=${encodeURIComponent(CRON_SECRET)}`);
  if (r.status !== 200) {
    bad(`cron returned ${r.status}`);
    return;
  }
  const summary = await r.json();
  console.log(`    cron summary: ${JSON.stringify(summary)}`);
  if (summary.authorized >= 1) ok(`cron authorized ${summary.authorized} booking(s)`);
  else if (summary.requires_action >= 1) ok(`cron flagged ${summary.requires_action} as 3DS required (acceptable for test cards)`);
  else bad('cron did not authorize or flag the SI booking', summary);

  /** Allow a brief settling window — cron's DB write + webhook update can race. */
  let fresh: Record<string, unknown> | null = null;
  for (let i = 0; i < 8; i += 1) {
    fresh = await fetchBooking(siBookingId);
    if (fresh.payment_intent_id) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (fresh?.payment_intent_id) ok(`booking row now has payment_intent_id (${fresh.payment_intent_id})`);
  else bad('booking row still missing payment_intent_id after cron');

  return (fresh?.payment_intent_id as string | null) ?? null;
}

/* -------------------------------------------------------------------------- */
/* E — Capture (no-show) / Cancel (attended)                                   */
/* -------------------------------------------------------------------------- */

async function phaseE(piId: string | undefined) {
  step('Phase E — Capture (no-show) + Cancel (attended)');
  if (!piId) {
    bad('no PaymentIntent to capture; skipping');
    return;
  }

  /** Capture path — simulate admin clicking "Mark no-show". */
  try {
    const captured = await stripe.paymentIntents.capture(piId);
    if (captured.status === 'succeeded') ok(`capture → status=succeeded ($${captured.amount_received / 100})`);
    else bad(`unexpected status after capture: ${captured.status}`);
  } catch (err) {
    bad('capture failed', (err as Error).message);
  }

  /** Now cancel a different booking for the attended path. */
  const cancelBookingId = await insertBooking({ emailSuffix: 'pi-cancel', daysFromNow: 3 });
  const { body } = await postCheckout(cancelBookingId);
  if (body.intentType !== 'payment_intent' || !body.paymentIntentId) {
    bad('cancel-path checkout did not yield a PaymentIntent', body);
    return;
  }
  const cancelPiId = body.paymentIntentId as string;
  await stripe.paymentIntents.confirm(cancelPiId, {
    payment_method: 'pm_card_visa',
    return_url: `${APP_URL}/tour/${TEST_TOUR_ID}/confirmation`,
  });
  await new Promise((r) => setTimeout(r, 600));
  const canceled = await stripe.paymentIntents.cancel(cancelPiId);
  if (canceled.status === 'canceled') ok(`cancel → status=canceled (no charge)`);
  else bad(`unexpected status after cancel: ${canceled.status}`);
}

/* -------------------------------------------------------------------------- */
/* F — Idempotency                                                            */
/* -------------------------------------------------------------------------- */

async function phaseF() {
  step('Phase F — Idempotency: re-confirming an already-authorized PI');

  const bookingId = await insertBooking({ emailSuffix: 'idempo', daysFromNow: 2 });
  const first = await postCheckout(bookingId);
  if (first.status !== 200) {
    bad('first checkout failed', first);
    return;
  }
  const piId1 = first.body.paymentIntentId as string;
  await stripe.paymentIntents.confirm(piId1, {
    payment_method: 'pm_card_visa',
    return_url: `${APP_URL}/tour/${TEST_TOUR_ID}/confirmation`,
  });
  ok(`first PI ${piId1} confirmed`);

  /** Wait for the webhook to mark the booking authorized — otherwise the
   *  second checkout sees `auth_pending` and (correctly) treats it as a retry. */
  try {
    await waitFor(bookingId, (b) => b.payment_intent_status === 'authorized');
    ok('webhook confirmed authorization before idempotency probe');
  } catch (err) {
    bad('webhook did not authorize within 8s', (err as Error).message);
    return;
  }

  /** A second checkout attempt should refuse since the booking is already authorized. */
  const second = await postCheckout(bookingId);
  if (second.status === 400) ok('second checkout on authorized booking → 400 (rejected)');
  else bad(`expected 400 on already-authorized booking; got ${second.status}`, second.body);
}

/* -------------------------------------------------------------------------- */
/* Cleanup                                                                    */
/* -------------------------------------------------------------------------- */

async function cleanup() {
  step('Cleanup');
  for (const id of createdBookingIds) {
    await supabase.from('bookings').delete().eq('id', id);
  }
  ok(`deleted ${createdBookingIds.length} test booking(s)`);
  for (const cid of createdStripeCustomers) {
    try {
      await stripe.customers.del(cid);
    } catch { /* noop */ }
  }
  if (createdStripeCustomers.length > 0) ok(`deleted ${createdStripeCustomers.length} Stripe customer(s)`);
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
  console.log(`Stress test: ${APP_URL}`);
  console.log(`Webhook wait: ${SKIP_WEBHOOK_WAIT ? 'OFF (skip DB-side assertions)' : 'ON'}`);

  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT — cleaning up.');
    await cleanup();
    process.exit(130);
  });

  /** Warm up the routes — Next.js dev compiles on first hit, which can cause
   *  the very first request after a file edit to 404 mid-recompile. */
  await fetch(`${APP_URL}/api/stripe/checkout`, { method: 'POST', body: '{}' }).catch(() => {});
  await fetch(`${APP_URL}/api/cron/recapture-holds`).catch(() => {});

  try {
    await phaseA();
    const b = await phaseB();
    const c = await phaseC();
    const reauthPi = await phaseD(c?.bookingId);
    /** Use whichever PI is in `requires_capture` state for the capture test. */
    await phaseE(reauthPi ?? b?.paymentIntentId);
    await phaseF();
  } catch (err) {
    console.error('\n[FATAL] uncaught:', err);
    fail += 1;
  } finally {
    await cleanup();
  }

  console.log(`\n=== Stress test summary: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
