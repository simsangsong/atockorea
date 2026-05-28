# Itinerary Builder — Flow Simplification + Card-Hold Booking Master Plan

**Created:** 2026-05-28
**Owner:** simsangsong
**Parent planner:** `docs/itinerary-builder-plan.md`
**Status:** 📝 Draft v2 (gap-review pass complete) — awaiting user sign-off on §C D1–D12 before promotion to parent §F Phase 10
**Estimated cost:** ~5.5 person-days (Phase 1=0.5, P2=1, P3=1.5, P4=1, P5=2, P6=0.5, P7=0.5, P8=0.5; P2 grew by 0.5d for the form generalization + webhook branching)

> This is a **spin-off planner** in the established pattern of
> `docs/itinerary-builder-redesign-master-plan-2026-05-18.md` and
> `docs/itinerary-builder-poi-data-quality-master-plan-2026-05-20.md`.
> It addresses two coupled problems the V2 redesign and pricing tracks
> did NOT touch: (1) **redundant input collection across 3 screens**,
> and (2) **submission only sends a proposal** — no card hold, no booking
> record, ops drowns in manual email handshakes.

---

## A · The problem (verbatim user complaint + verified code reality)

### A.0 The pricing table already exists — `quote` workflow is vestigial

**`lib/quote-engine/pricing-policy.ts`** (442 lines, 35/35 unit tests green,
Phase 9 D13/D14) encodes the real AtoC pricing from
`pricing_update_instructions.md`. Coverage matrix:

| Track / shape | Auto-quotable? |
|---|---|
| Private 4-12h × 1-13 pax × any region | ✅ |
| Private >12h (extrapolated +₩40k/h En, +₩30k/h Cn) | ✅ |
| Cruise incl. Gangjeong (+₩70k) | ✅ |
| DMZ 1-28 pax (fixed table) | ✅ |
| Solati 10-13 pax × 4-5h | ⚠ UI bumps to 6h (no manual escalation) |
| 14+ pax non-DMZ | ❌ truly manual |
| >28 pax DMZ | ❌ truly manual |

In other words: **only 14+ pax non-DMZ + >28 pax DMZ fall outside the
table** — vanishingly rare in real traffic (`tour_quote_requests` has
exactly 1 row in production, status `auto_quoted`; zero manual responses
in history).

The Phase 4 (`tour_quote_requests` → Slack → email → `/admin/itinerary-quotes`
→ ops manual response) workflow was built on **2026-05-17 before the
pricing table existed**, with Phase 5 adding a placeholder DB-row pricing
engine the same day. Phase 9 (2026-05-22) replaced the placeholder pricing
with the real table BUT left the surrounding "quote-and-email" pipe intact.
The ops pain the user describes ("하루에 10개만 받아도 하루가 다 가") is
exactly this: the pipe asks ops to do the human work that the pricing
table now does instantly. **The right fix is to delete the pipe, not
to streamline it.**

### A.1 User pain (2026-05-28)

> "지금 랜딩페이지에서 itinerarybuilder 흐름이 너무 조잡하고 복잡해, 먼저
> 랜딩페이지에서 preference 입력하고 다음 페이지에서 다시 입력하고
> 날짜·인원수 등등 입력하고 다음 페이지에서 한번 다시 recommended
> 입력해야 밑에 추천 일정이 생성되고 그걸 다시 take this itinerary
> 해야 내 일정이 되고, 그걸 갖다가 다시 조립하고, 그리고 운영 입장에서는
> 해당 일정을 adopt 하면 바로 카드 홀딩 까지 가야 하는데 지금은 그냥
> 제안만 보내버리는 식으로 끝나버려, 나는 운영자로써 하루에 이런 제안
> 열개만 받아도 하루가 다 가."

Two distinct asks, both required:
- **Customer flow:** collapse 4 screens × 2 redundant input passes into the
  shortest path that still preserves accurate pricing.
- **Ops flow:** adoption of an itinerary = booking + card hold today
  (same model as standard `/tour-product/[slug]`), NOT an email handshake.

### A.2 Current redundancy (verified in code)

| Field | 1st entry | 2nd entry | Cited at |
|---|---|---|---|
| `date` | `IntakeForm.tsx:78` (`?date=` URL) | `QuoteModal.tsx:59,70` (re-asked) | duplicate state |
| `party` | `IntakeForm.tsx:79` | `QuoteModal.tsx:60,71` | duplicate state |
| `guideLang` | `IntakeForm.tsx:82-85` | `QuoteModal.tsx:61,72-74` | duplicate state |
| `duration / hours` | `IntakeForm.tsx:71-72` | `QuoteModal.tsx:62,75` | duplicate state |
| `track`, `region` | `IntakeForm.tsx:69-70` | URL only (read in modal) | OK |
| `pickup zone` (Jeju) | — | `QuoteModal.tsx:64,76-78` | only modal — surprise |
| `cruise port` | — | `QuoteModal.tsx:65,79-81` | only modal — surprise |

**Implication:** the IntakeForm collects pricing-relevant inputs, sticks
them in the URL, the QuoteModal re-renders the same controls with `useState`
seeded from the URL, and any change in the modal **does not flow back to
the URL** — so the cart-page live-price (if surfaced) and the modal price
can diverge from each other for the same trip. Today the cart page does NOT
display the price (only the modal does), masking the divergence.

### A.3 The "click again to see recommendation" extra step

- `AIRecommendPanel.tsx:113-149` — user lands on `/itinerary-builder/[region]`,
  the `?intent` URL param is read (`AIRecommendPanel.tsx:105-111`), but the
  recommendation **does NOT auto-run**. User must click "Search" or a preset
  chip to fire `POST /api/itinerary/match`.
- After the recommendation renders, the user must click **"Apply this day"**
  (`AIRecommendPanel.tsx:69-81 acceptRecommendation`) to commit the recommended
  POIs to the cart. Until then the recommendation is a "preview" — visually
  separate from the cart.

That's two extra clicks for the canonical happy path.

### A.4 Submission is a proposal, not a booking

`POST /api/itinerary/quote` (lines 74-220) writes a row to `tour_quote_requests`,
sends Slack + email, returns `{ ok, quote_id, status }`. Done. The customer
gets an email with a price. To actually book, they must reply to that email.

- **No `bookings` row created** — so it never reaches the standard
  PI/SI/`recapture-holds` cron pipeline.
- **No card on file** — even auto-quoted (in-scope) itineraries with a
  computed price sit in limbo until a human emails back.
- **No `/admin/orders` integration** — they live in a separate surface
  `/admin/itinerary-quotes` that ops must check independently.

Ops cost (verified by reading
`app/api/admin/itinerary-quotes/[id]/respond/route.ts:30-158`):
each proposal requires the admin to (1) open the detail page, (2) enter
the manual amount, (3) submit — which writes `quote_memory` precedent
and sends a confirmation email. Customer then re-engages by email to
actually book. **The user's "하루에 10개만 받아도 하루가 다 가" describes
exactly this loop**: ops doing booking-shaped work for a proposal-shaped
record.

### A.5 The reusable card-hold infrastructure already exists

`POST /api/stripe/checkout` (lines 41-279):
- Reads `bookingId`, fetches the `bookings` row.
- ≤7d lead → `PaymentIntent` with `capture_method:'manual'` (auth hold now,
  auto-capture on tour day at 10:00 AM KST via existing cron).
- >7d lead → `SetupIntent` (vault card to Stripe Customer; daily
  `recapture-holds` cron converts to PI ~5d before tour).
- Writes `payment_intent_id` / `setup_intent_id` /
  `payment_intent_status` / `authorization_expires_at` back to the booking.

The itinerary builder needs to **create a `bookings` row** and **call this
endpoint**. Everything else (tour-day capture, settlement, no-show fee,
admin settle UI) is already built and tested.

### A.6 Schema + reusable-component realities (verified 2026-05-28)

1. **`bookings.tour_id` is nullable** ✅ — no schema change needed for the
   nullable-tour case.
2. **`bookings.final_price` is `numeric` but the Stripe path converts it
   as USD cents** (`stripe/checkout/route.ts:106-112`:
   `Math.round(finalPriceUsd * 100)`). The pricing engine emits **KRW**.
   Currency = D1.
3. **`bookings.unit_price` + `total_price` are NOT NULL with no defaults**
   (existing tour flow: `app/api/bookings/route.ts:294-309,311-371` sets
   them from `tour.price_type='person'|'flat'` × `guestsCount`). Builder
   pricing is flat-per-tour (Solati ₩340k for 1 pax or for 13 pax). Need
   D11 to decide the mapping.
4. **`bookings.merchant_id`** — existing flow uses `tour.merchant_id`
   (`app/api/bookings/route.ts:312`). Builder bookings have no tour →
   no merchant inheritance. Need D12 (default to AtoC's own merchant_id
   or NULL?).
5. **`NoShowHoldCardForm` is USD-cents-only** — props at
   `components/checkout/NoShowHoldCardForm.tsx:22-35` are
   `{ publishableKey, clientSecret, intentType, returnUrl, amountUsdCents,
   leadDays }`. Display formatter at line 65 (`formatUsd`) divides by 100
   and formats with `$`. For builder KRW bookings, this **silently shows
   USD** which is a real bug. Need D9 (make currency-aware vs. fork).
6. **`/api/stripe/checkout` server-side join on `tours`** (line 89: `tours
   ( id, title, image_url )`) handles NULL gracefully via
   `tourTitle = tour?.title || 'Tour'` (line 122). ✅
7. **Stripe webhook depends on `booking_id` only for lookup** (line 76)
   ✅, BUT lines 112/178/184 hardcode `currency:'usd'` in PI/SI payloads
   → must branch on `booking.currency` after Phase 2.
8. **Webhook email send silently skips builder bookings** —
   `app/api/stripe/webhook/route.ts:415` does `if (!booking.tours) return;`
   so the auth/capture-success email is never sent for `tour_id=NULL` rows.
   Need a `source='itinerary_builder'` branch to send the BUILDER
   confirmation email instead (template TBD in Phase 5).
9. **No customer-facing cancellation route exists** anywhere
   (`/api/booking/[id]/cancel` / `/booking/[ref]` not present). Today
   cancellation is Stripe-side only (admin cancels the PI → webhook
   syncs `payment_intent_status='canceled'`). This is a pre-existing
   gap for ALL bookings — see §M (not in scope of this plan).
10. **Existing tour-checkout flow uses `sessionStorage` for handoff**
    (`app/tour/[id]/checkout/page.tsx:105`), NOT URL params. This plan
    chooses **URL-only** for builder bookings (D5 share-able link
    discipline) — different from the tour-product pattern. Need D10
    explicit ratification.
11. **No `itinerary_*` analytics events exist today** —
    `src/design/analytics.ts` only has `unifiedPlanner*`. Phase 4/5 must
    add a defined event vocabulary (§K).

---

## B · Target experience (the North Star)

### B.1 The 2-screen private-tour flow

```
[Screen 1: /itinerary-builder?region=busan&intent=...]
  ─ Sticky top: trip parameters (region · date · party · lang · duration)
  ─ Below the fold (auto-runs on entry):
     ┌─ Recommended itinerary (chip cards)
     │   "Edit" / "Try another" / "I'll keep this"
     └─ Live price card: ₩340,000 (auto-quotable) or "Quote on request"
  ─ Map = collapsible/secondary (V2 redesign covers this)
  ─ Primary CTA: "Book + hold card"

         ↓ click "Book + hold card"

[Screen 2: /itinerary-builder/checkout?bookingId=...]
  ─ Reuses /tour/[id]/checkout pattern + <NoShowHoldCardForm />
  ─ Stripe Elements card field + name/email/phone (auto-filled)
  ─ "Pay later · card saved securely · free cancellation 24h" copy
  ─ Submit → PI or SI created → redirect to /confirmation/[bookingId]
```

The DMZ track collapses to one screen (no POI cart):
- `/itinerary-builder?track=dmz` → pax + lang → live price → "Book + hold".

### B.2 Truly out-of-scope (14+ pax / >28 DMZ) — hard UI gate, NO DB

```
[Screen 1: planner]
  ─ pax slider crosses 13 (or DMZ pax crosses 28)
  ─ LivePriceCard flips to a "contact" card
  ─ "Book + hold card" CTA disabled
  ─ Shows: "Group of 16 needs a custom quote — contact@atockorea.com"
  ─ mailto link pre-filled with intake summary (region, date, party, lang)
```

No POST, no DB row, no email pipe, no Slack escalation. If real volume
ever appears at 14+ pax, promote to its own phase then. Today the DB
shows 0 manual responses in history; D4 honors that.

### B.3 What we remove

- The separate `IntakeForm` page at `/itinerary-builder` (Screen 0 today)
  → merged into the planner shell as a sticky top rail.
- The "Take this itinerary" / "Apply this day" intermediate click
  → recommendation auto-populates cart on first paint.
- The QuoteModal date/party/lang/duration re-asks → those live ONLY in
  the top rail; modal becomes a thin "name + email + phone" pane (or
  inline section) before the Stripe card.
- The "send a quote" workflow as the default outcome → instead, in-scope
  itineraries go directly to card hold; only out-of-scope ones still
  exit via email.
- `/admin/itinerary-quotes` as a distinct surface → folds into
  `/admin/orders` with a "source: itinerary-builder" filter.

---

## C · Binding decisions to ratify before Phase 1

Each decision below must be answered Yes/No (or pick one option) by the
user before any code lands. Decisions are logged into parent planner §B
and re-quoted here for context.

| ID | Decision | Recommendation | Why |
|---|---|---|---|
| **D1** | **Currency**: `bookings.final_price` is treated as USD by `/api/stripe/checkout`, but the builder prices in KRW. Options: (a) add `bookings.currency` column + teach checkout/route to read it; (b) FX-convert KRW→USD at booking-create time using a fixed rate; (c) store the KRW total in a new `bookings.itinerary_total_krw` column and ALSO compute a USD mirror for the Stripe call. | **(a)** — add `bookings.currency text DEFAULT 'usd'` + branch `/api/stripe/checkout` on it. Cleanest, future-proof; existing rows default to 'usd' with no migration risk. | KRW→USD FX exposure for ops is real (±5% in a year). Charging in KRW is also what the tour actually costs in Korea — keeps reconciliation honest. Stripe supports KRW. |
| **D2** | **Schema for the itinerary in `bookings`**: builder bookings have variable POI sequence + custom duration + guide language + Jeju pickup zone. Options: (a) add `bookings.itinerary jsonb` (poi_keys, region, track, duration, guide_lang, pickup_zone, breakdown); (b) add discrete columns; (c) keep writing to `tour_quote_requests` and add `bookings.quote_request_id` FK. | **(a) jsonb** — one column, schema-flexible as the policy evolves, indexed via gin if needed for ops search. | The pricing breakdown is already jsonb in `auto_quote_breakdown`. Mirror that shape. Avoids 8 sparse columns most tours don't use. |
| **D3** | **What happens to `tour_quote_requests`**: (a) keep writing for out-of-scope only; (b) sunset entirely (stop writes now, drop after 90d); (c) keep as a read-only audit table. | **(b) sunset** — `pricing-policy.ts` covers everything except 14+ pax (which the UI gates BEFORE submit). Stop all writes immediately; keep table for 90d audit; drop in follow-up. Also delete `quote_presets`, `quote_memory` (manual-precedent system has no use without a manual path). | The DB has 1 row total, status `auto_quoted` — zero manual responses in history. The table + Slack + admin response surface + memory tables are 100% vestigial. |
| **D4** | **Truly out-of-scope (14+ pax non-DMZ, >28 pax DMZ)**: (a) UI gate — disable "Book + hold" with "Group of X needs a custom quote — email contact@atockorea.com"; (b) contact-form path that creates a `bookings` row with `status='pending_quote'`; (c) full ops workflow. | **(a) hard UI gate, NO DB write.** When `pricing-policy.evaluateConstraints()` returns `autoQuotable:false`, the planner shows a contact gate (mailto + Slack-channel link) and does not POST anywhere. | Real frequency is near-zero (1 quote total in production). Building a workflow for that traffic is the trap that got us here. If volume ever appears, promote to a phase then; until then, don't pre-build. |
| **D5** | **Auto-run AI recommendation on entry**: should the planner auto-call `/api/itinerary/match` on mount if any of `?intent` / `?date` / `?duration` / `?lang` is present? | **Yes, debounced**. Auto-run when (a) `?intent` is non-empty OR (b) the user has just landed via the home idle-preview chip. Show a skeleton, render in ≤2s. | The user's complaint is the extra click. Auto-run + cheap re-trigger on parameter change is the cleanest fix. Cost: a Haiku call per page-load with intent. |
| **D6** | **Sunset `/admin/itinerary-quotes` (page + API + sidebar entry)?** | **Yes, immediately** in the cut-over commit. `tour_quote_requests` table stays 90d for audit (D3) but the admin surface goes away — ops never opens it again. | Per D4 there are no new manual quotes to respond to. Keeping a dead sidebar entry creates ambiguity ("should I be checking this?"). |
| **D7** | ~~**"Adopt → instant card hold" for OUT-OF-SCOPE quotes**~~ — moot per D4 (no out-of-scope DB path exists in the new flow). | n/a | Removed. |
| **D8** | **Unified planner route**: keep `/itinerary-builder` (selector) → `/itinerary-builder/[region]` (planner) as two routes, or collapse to one `/itinerary-builder?region=...`? | **Collapse** — `/itinerary-builder` IS the planner; region is a URL param with a sensible default + a chip in the top rail to switch. | Removes one unnecessary navigation. The home entry sections (`itinerary-builder-entry`, `landing-planner-card`) already pass `?region=` and `?intent=` — they continue to work. The legacy `/itinerary-builder/[region]` route can 308-redirect for SEO. |
| **D9** | **`NoShowHoldCardForm` currency-awareness**: today it's USD-cents-only (`amountUsdCents` prop + `formatUsd` divides by 100, prints `$`). Options: (a) generalize → add `currency: 'usd'|'krw'` + `amountMinor` prop, render via Intl.NumberFormat; (b) fork a `BuilderHoldCardForm`; (c) keep USD-only and FX-convert at booking (rejected by D1). | **(a) generalize.** One component, branch on currency. Backwards-compatible: existing tour callers pass `currency:'usd'` + amount in cents; builder callers pass `currency:'krw'` + amount in whole KRW. | Forking duplicates the Stripe Elements integration, the 3DS handling, the error states. Generalizing is ~30 LOC. |
| **D10** | **Booking handoff: sessionStorage vs URL**: tour-product checkout uses `sessionStorage` (`app/tour/[id]/checkout/page.tsx:105`); builder needs a pattern. Options: (a) URL-only — `?bookingId=...` reads the booking back from Supabase server-side; (b) sessionStorage like tour-product; (c) hybrid (URL fallback to session). | **(a) URL-only** — preserves D5 share-able-link discipline + survives refresh + works for the out-of-scope "ops sends checkout link" path (URL was the only delivery channel). | sessionStorage breaks the share-able-URL pattern and the email-link path. Cost: one server fetch on checkout page mount (cached, behind `requireUser` if applicable). |
| **D11** | **`bookings.unit_price` + `total_price` mapping for builder** (both NOT NULL): builder pricing is flat-per-tour. Options: (a) `unit_price = total_price = final_price` (write the same KRW value to all three); (b) `unit_price = final_price / number_of_guests` (per-person fiction); (c) make both nullable + treat as legacy. | **(a) all three = `final_price`.** Reflects reality — builder is flat-rate. Reporting that joins on `unit_price` gets a sensible value; the per-person fiction in (b) would corrupt analytics (Solati 12 pax @ ₩640k → "₩53k unit price" is meaningless). | (c) is a schema invasion for no reader benefit. (b) misleads BI. (a) is the smallest possible lie that's still useful. |
| **D12** | **`bookings.merchant_id` default for builder**: tour bookings inherit `tour.merchant_id`. Builder has no tour. Options: (a) NULL; (b) an "AtoC self" sentinel merchant_id from env (`ATOC_DEFAULT_MERCHANT_ID`); (c) hardcode. | **(a) NULL — verified Phase 2 task 2e.** `/api/admin/orders/[id]/settle` does NOT read `merchant_id`; the merchant portal (`/api/merchant/orders`, `/api/settlements`) filters bookings by `merchant_id` so NULL rows correctly stay invisible to partner merchants (= AtoC self-revenue). No env var needed. | (b) was the cautious recommendation pending verification; (a) is safer once verified — fewer moving parts. |

---

## D · Phase plan

Each phase is shippable on its own and ends with a green build + the listed
acceptance checks. Phases run on a dedicated branch
**`feat/itinerary-builder-flow-simplification`** off `main` in an isolated
worktree (per `feedback_worktree_isolation.md`). Parent planner §A
"Last commit" is updated after every commit.

### Phase 1 — Audit + planner registration + decision lock-in (0.5d)

**Deliverable:** decisions in §C ratified, parent planner §B/§E/§F updated,
plan committed first (per "planner-edit before code" rule).

**Tasks:**
- [ ] (1a) User signs off on §C D1–D12 (this conversation; D7 is moot).
- [ ] (1b) Append D16–D26 rows to parent planner §B reflecting the §C
  ratifications.
- [ ] (1c) Append an §E parked-idea row pointing to this planner; promote
  to a §F Phase 10 entry in parent planner.
- [ ] (1d) Update parent §A: Phase 10 started 🔄, this branch named.
- [ ] (1e) Commit the planner edits in a single commit before any code.

**Acceptance:** parent planner §B has D16–D26 logged, §F has Phase 10,
this doc is committed to `docs/`.

**Cut-line:** Stops here if user wants to defer; nothing else changes.

---

### Phase 2 — Schema migration: bookings extension + currency (0.5d)

**Deliverable:** `bookings` table can store a builder itinerary; Stripe
checkout respects per-booking currency.

**Migration `<ts>_extend_bookings_for_itinerary.sql`:**
```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'tour_product',
  ADD COLUMN IF NOT EXISTS itinerary jsonb;

CREATE INDEX IF NOT EXISTS bookings_source_idx ON public.bookings(source);
CREATE INDEX IF NOT EXISTS bookings_itinerary_gin_idx
  ON public.bookings USING gin(itinerary) WHERE itinerary IS NOT NULL;

COMMENT ON COLUMN public.bookings.currency IS
  'ISO 4217. usd for legacy tour-product bookings, krw for itinerary-builder.';
COMMENT ON COLUMN public.bookings.source IS
  'tour_product | itinerary_builder | (future) bundle.';
COMMENT ON COLUMN public.bookings.itinerary IS
  'Builder-specific payload: poi_keys, region, track, duration_hours, guide_language, jeju_pickup_zone, cruise_port, breakdown.';
```

**Code changes:**
- [ ] (2a) `app/api/stripe/checkout/route.ts` — branch on `booking.currency`:
  - `'usd'` (default) → unchanged path; `Math.round(finalPriceUsd * 100)`.
  - `'krw'` → `Math.round(finalPriceKrw)` (KRW is zero-decimal in Stripe);
    set `currency:'krw'` on PI/SI.
- [ ] (2b) `app/api/stripe/webhook/route.ts` — same branch on lines
  112/178/184 (currently hardcoded `'usd'`); also add a
  `source='itinerary_builder'` arm at line 415 to send the BUILDER
  confirmation email instead of silently skipping when `booking.tours`
  is NULL. Path: `lib/email-templates/builder-booking-confirmation.ts`
  (Phase 5 builds the template; this PR just adds the dispatch arm).
- [ ] (2c) `components/checkout/NoShowHoldCardForm.tsx` — generalize per
  D9: new props `currency: 'usd'|'krw'` + `amountMinor: number` (cents
  for USD, whole KRW for KRW). Existing tour callers updated to pass
  `currency:'usd' + amountMinor: amountUsdCents`. Display formatter
  uses `Intl.NumberFormat(locale, { style:'currency', currency })`.
  Keep `amountUsdCents` as a deprecated alias that maps to
  `currency:'usd' + amountMinor` (one PR cycle, then removed) so the
  tour-product flow doesn't break.
- [ ] (2d) `lib/booking/createBuilderBooking.ts` (new) — pure helper that
  builds the bookings row payload from a `PriceResult` + intake + contact.
  Per D11: `unit_price = total_price = final_price = price.total`. Per
  D12: `merchant_id = process.env.ATOC_DEFAULT_MERCHANT_ID || null`.
  Sets `source='itinerary_builder'`, `currency='krw'`,
  `booking_reference = 'A2C-' + nanoid(8)` (matches existing tour
  pattern at `app/api/bookings/route.ts:314`).
- [ ] (2e) Settle endpoint verification: read
  `app/api/admin/orders/[id]/settle/route.ts`; confirm it does NOT
  require `merchant_id` for AtoC-self bookings, or update the env-sentinel
  decision (D12) accordingly.

**Acceptance:**
- [ ] Migration applies cleanly to dev + prod-mirror.
- [ ] `SELECT currency FROM bookings LIMIT 5;` → all return `'usd'`
  (existing rows unaffected).
- [ ] Existing tour-product booking still creates a PI/SI with
  `currency:'usd'` (regression check via Stripe test mode).
- [ ] Unit test: `createBuilderBooking()` for English 8h / 2pax / Busan-city
  returns `{ unit_price: 340000, total_price: 340000, final_price: 340000,
  currency: 'krw', source: 'itinerary_builder', booking_reference: 'A2C-...',
  itinerary: { poi_keys: [...], guide_language: 'en', duration_hours: 8, ... } }`.
- [ ] `NoShowHoldCardForm` renders "$340.00" when `currency:'usd' + amountMinor:34000`
  and "₩340,000" when `currency:'krw' + amountMinor:340000`. Snapshot test.

**Cut-line:** Schema is ready; Stripe stack handles KRW; nothing downstream changes yet.

---

### Phase 3 — Unified planner shell (collapse Intake into BuilderShell) (1.5d)

**Deliverable:** one route `/itinerary-builder` that hosts the planner;
all preference inputs live in a single sticky top rail; the QuoteModal
no longer asks for date/party/lang/duration.

**Tasks:**
- [ ] (3a) `app/itinerary-builder/page.tsx` rewritten — server shell that
  defaults `region` from `?region=` (fallback `busan`) and renders
  `<BuilderShell />`. The standalone `<IntakeForm />` is **removed**
  (file deleted; `IntakeDateField.tsx` reused inside the new top rail).
- [ ] (3b) `app/itinerary-builder/[region]/page.tsx` → 308 redirect to
  `/itinerary-builder?region=<slug>` (preserves all other query params
  for SEO + bookmark continuity).
- [ ] (3c) `components/itinerary-builder/PlannerTopRail.tsx` (new) — sticky
  controls: track (private/cruise/dmz) · region (busan/jeju/seoul) ·
  date · party · guideLang · duration · (conditional) Jeju pickup zone ·
  (conditional) cruise port + ship. Every change `router.replace()`s the
  URL with `scroll:false`. Validates: date required, party ≥1.
- [ ] (3d) `BuilderShell.tsx` — embeds `<PlannerTopRail />` at top;
  removes track/region props (now reads from URL); passes pricing inputs
  down to a new `<LivePriceCard />` (always-visible) and to the
  recommendation panel.
- [ ] (3e) `QuoteModal.tsx` slimmed — date/party/lang/duration/pickup/port
  controls REMOVED; modal becomes "name + email + phone + notes" + the
  Stripe card section (Phase 5 wires the card). Live-price re-uses the
  same `<LivePriceCard />` component (one SoT for UI).
- [ ] (3f) `components/itinerary-builder/LivePriceCard.tsx` (new) — pure
  presentation: receives `PriceResult` from `pricing-policy.quote()`, renders
  total + breakdown lines + Solati/Jeju notices. Used in both the planner
  body and the booking pane.
- [ ] (3g) Home entry components (`itinerary-builder-entry.tsx`,
  `landing-planner-card.tsx`) — verified to still link `/itinerary-builder?region=`;
  no change needed (D8 collapse preserves the URL shape).

**Acceptance:**
- [ ] `/itinerary-builder?region=busan&date=2026-08-20&party=4&lang=en&duration=8`
  loads with all params pre-filled in the top rail.
- [ ] Edit duration in top rail → URL updates → `<LivePriceCard />` re-prices
  in <100ms (same `useMemo` discipline as today's modal).
- [ ] `/itinerary-builder/busan` 308-redirects to `/itinerary-builder?region=busan`.
- [ ] `npm run build` green; no unused-import warnings from removed
  IntakeForm imports.
- [ ] Manual: no duplicate input fields anywhere in the customer journey.

**Cut-line:** Single planner shell shipped; recommendation still requires
a click; submission still goes to the old proposal endpoint. Phase 4+5
wire the rest.

---

### Phase 4 — Auto-run recommendation + cart adoption (1d)

**Deliverable:** landing on `/itinerary-builder?...` with any preferences
present auto-fires the AI recommendation and writes the result directly
into the cart; the "Take this itinerary" / "Apply this day" button is
removed.

**Tasks:**
- [ ] (4a) `AIRecommendPanel.tsx` — replace the manual-trigger pattern
  with a `useEffect` that calls `/api/itinerary/match` when
  `(intent OR duration changed OR region changed)` AND
  `(cart is empty OR cart is the previous recommendation set)`.
  Debounce 500ms. Show a skeleton stripe; on success,
  `useCart().reorder(recommendedPois)` directly (no "preview" state).
- [ ] (4b) Remove the "Take this itinerary" CTA + the
  `acceptRecommendation` callback path (it becomes a no-op since the
  recommendation IS the cart).
- [ ] (4c) Keep "Try another" / "Edit manually" affordances — "Try another"
  re-fires with a different seed/preset; "Edit manually" leaves the cart
  in user-edit mode (auto-run becomes inactive until they clear or re-arm).
- [ ] (4d) Telemetry: log `itinerary_auto_recommend_fired` /
  `itinerary_auto_recommend_succeeded` to `match_queries` with
  `flow='itinerary_builder_auto'` tag.

**Acceptance:**
- [ ] Click a Busan idle-preview chip on home → land on
  `/itinerary-builder?region=busan&intent=...` → cart populated within 2s,
  zero clicks required.
- [ ] Change `duration` in top rail from 8h → 6h → cart re-recommends
  (fewer POIs, drive trimmed) automatically.
- [ ] User reorders cart manually → auto-run stops firing
  (`cart != lastRecommendationSet`).

**Cut-line:** Customer reaches a priced, recommended itinerary in 0 clicks
from a home chip. Submission still proposal-shaped — Phase 5 fixes that.

---

### Phase 5 — Booking + card hold replaces "quote" (2d) — the core change

**Deliverable:** "Book + hold card" CTA creates a `bookings` row, calls
`/api/stripe/checkout`, redirects to a Stripe-card screen, returns to
a confirmation page.

**Tasks:**
- [ ] (5a) `app/api/itinerary/book/route.ts` (new) — POST endpoint.
  Body: `{ poi_keys, region, track, duration_hours, party, guide_lang,
  date, jeju_pickup_zone, cruise_port, contact: { name, email, phone },
  notes, locale, source_url, client_quoted_total }`.
  - **Server-authoritative recompute** via `lib/quote-engine/pricing-policy.quote()`
    — mirrors `app/api/bookings/route.ts:298-309` defense:
    `if (Math.abs(clientQuotedTotal - serverPrice.total) > 1) return 409
    { error:'price_changed', server_total, client_total }`. The UI handles
    409 by showing the new price and asking for re-confirmation (no auto-book
    at a different price).
  - If `autoQuotable === true` → call `createBuilderBooking()` helper from
    (2d), INSERT via service-role Supabase client (bypasses RLS), return
    `{ ok, booking_id, total_krw, breakdown }`.
  - If `autoQuotable === false` → **return 422** with `{ violations,
    contact_email: 'contact@atockorea.com' }`. NO DB write, NO Slack,
    NO email — those paths are deleted in (5g).
  - Telemetry: log to `match_queries` with `flow='itinerary_builder_book'`
    and emit `itineraryBuilderBookingSubmitted` analytics event (§K).
- [ ] (5b) `app/itinerary-builder/checkout/page.tsx` (new) — **URL-only
  pattern per D10**: reads `?bookingId=` server-side, fetches the booking
  via service-role Supabase (verifies `source='itinerary_builder'` to
  prevent cross-flow URL abuse), calls `/api/stripe/checkout` to mint
  the PI/SI clientSecret, renders `<NoShowHoldCardForm currency="krw"
  amountMinor={booking.final_price} returnUrl="/itinerary-builder/confirmation/[bookingId]" />`.
  Right-rail summary panel reuses `<LivePriceCard />` (built in Phase 3)
  + a POI thumbnail strip from `match_pois`.
  - Layout: mirrors the 2-column `lg:grid-cols-3` structure of
    `app/tour/[id]/checkout/page.tsx:377-689`. Header + Footer + BottomNav.
  - Auth: matches the tour-product behavior — guest checkout allowed,
    `user_id = null` on the booking row (D5 "no auth" precedent).
- [ ] (5c) "Book + hold card" CTA in `BuilderShell` (replaces the
  QuoteModal trigger for in-scope; the modal still opens for the
  contact-only step). On click for in-scope:
  - POST `/api/itinerary/book` → get `booking_id`
  - `router.push('/itinerary-builder/checkout?bookingId=...')`
- [ ] (5d) Out-of-scope gate UI: in `PlannerTopRail` + DMZ pax picker,
  when `evaluateConstraints()` returns violations, replace "Book + hold
  card" with a disabled-styled card showing the violation(s) +
  "Email contact@atockorea.com" mailto link. No POST attempted.
- [ ] (5e) Confirmation page `/itinerary-builder/confirmation/[bookingId]`
  — server component, fetches booking + itinerary jsonb + match_pois
  names. Layout mirrors `/tour/[id]/confirmation`: hero "확정되었습니다",
  booking reference, itinerary stop strip, breakdown, "card saved · no
  charge today · 24h free cancellation" reassurance, "view in mypage"
  CTA. Does NOT reuse the tour confirmation by import — it depends on
  `tour.title`/`tour.image_url` which builder bookings don't have.
- [ ] (5e.2) Email template `lib/email-templates/builder-booking-confirmation.ts`
  (new) — HTML email mirroring the layout of the tour-product confirmation
  email but rendering itinerary stops + breakdown instead of tour title.
  Subject pattern: `"[AtoC Korea] 일정이 확정되었습니다 · {{bookingReference}}"`.
  6-locale support via the existing `getEmailLocale()` pattern. Dispatched
  by the webhook arm added in (2b).
- [ ] (5e.3) `/itinerary-builder/thanks/page.tsx` — **deleted** (replaced
  by the per-booking confirmation page above). Its current responsibility
  (showing `?quote_id=...` status) is gone with the quote pipe.
- [ ] (5f) `recapture-holds` cron — verified to handle nullable `tour_id`
  (read `lib/cron/recapture-holds.ts`; if it joins on `tours` table,
  switch to LEFT JOIN and tolerate NULL).
- [ ] (5g) **Delete (not deprecate) the entire quote pipe:**
  - `app/api/itinerary/quote/route.ts` — deleted.
  - `app/api/admin/itinerary-quotes/[id]/respond/route.ts` — deleted.
  - `app/admin/itinerary-quotes/page.tsx` + `[id]/page.tsx` — deleted.
  - Sidebar entry in `app/admin/layout.tsx` — removed.
  - `lib/slack/notify-quote.ts` — deleted.
  - `lib/quote-engine/fingerprint.ts`, `memory-lookup.ts`,
    `load-preset.ts` — deleted (precedent system has no use without a
    manual path). `compute.ts`, `classify.ts`, `types.ts` reviewed —
    keep what `pricing-policy.ts` doesn't already cover, delete the rest.
  - Migration `<ts>_drop_quote_system_writes.sql`: leaves the tables for
    audit but adds a row-level trigger that raises an error on INSERT to
    `tour_quote_requests`, `quote_memory`, `quote_presets` (safety net so
    nothing accidentally writes).
- [ ] (5h) Follow-up issue filed: drop `tour_quote_requests` /
  `quote_memory` / `quote_presets` tables 90d after cut-over.

**Acceptance:**
- [ ] User completes the planner with an in-scope itinerary →
  "Book + hold card" → Stripe card form (KRW) → confirms → redirect to
  confirmation page showing booking ref + itinerary + "card saved, no
  charge today" message.
- [ ] `SELECT id, source, final_price, currency, unit_price, total_price,
  payment_intent_status FROM bookings WHERE source='itinerary_builder'
  ORDER BY created_at DESC LIMIT 1;` shows the new row with all four
  pricing columns = `final_price`, `currency='krw'`, and the correct
  PI/SI status.
- [ ] Stripe dashboard shows a PaymentIntent (≤7d lead) or SetupIntent
  (>7d) in **KRW** on the correct Customer; metadata includes
  `booking_id` + `kind:'tour_day_auto_charge_*'`.
- [ ] Customer receives the BUILDER confirmation email (not the silent
  skip from webhook line 415).
- [ ] Out-of-scope attempt (16 pax planner state) → CTA disabled +
  mailto chip; no POST fires; nothing in DB.
- [ ] Server-authoritative recompute: send a tampered `client_quoted_total`
  → 409 + new total returned; no booking row created.
- [ ] `recapture-holds` cron dry-run shows the new builder bookings
  in the eligible set on T-6d (and skips them gracefully if `tour_id`
  IS NULL — task 5f).
- [ ] Existing tour-product booking flow still works end-to-end (USD,
  PI/SI on Customer, confirmation email) — regression check.

**Cut-line:** Customer flow now ends in a card hold; ops sees the
booking in `/admin/orders` (Phase 6 polishes the ops side).

---

### Phase 6 — Ops surface: just show builder bookings in `/admin/orders` (0.5d)

**Deliverable:** ops sees itinerary bookings inside `/admin/orders`
alongside tour-product bookings; nothing else changes on the ops side.
There is no "set quote amount" form because there are no manual quotes
to set.

**Tasks:**
- [ ] (6a) `app/admin/orders/page.tsx` — add a `source` filter (chips:
  All / Tour product / Itinerary builder) reading `bookings.source`.
  Itinerary rows render with a small "📋 Custom" badge.
- [ ] (6b) `app/admin/orders/[id]/page.tsx` — when `source =
  'itinerary_builder'`, render an "Itinerary" section showing the cart
  POIs (names + thumbnails + drive estimate), the breakdown lines, and
  the guide language / duration / pickup zone. Reuse `match_pois` for
  POI name lookup. Settlement (capture/release) is the EXISTING
  `/api/admin/orders/[id]/settle` flow — no changes.

**Acceptance:**
- [ ] Submit an itinerary as a customer → ops sees it in
  `/admin/orders?source=itinerary_builder` immediately, with PI/SI
  status visible like any tour-product booking.
- [ ] Tour-day capture / release works via the existing settle endpoint
  (no new ops form to learn).

**Cut-line:** Ops has one queue. The "10 proposals = 하루 다 가" problem
is gone — ops only touches what would have been a settlement anyway.

---

### Phase 7 — i18n transcreation + copy polish (0.5d)

**Deliverable:** all new strings authored EN, transcreated into
ko/ja/zh/zh-TW/es using the existing `inject-pricing-i18n.mjs`-style
script pattern. Per `feedback_i18n_translate_script_drops_keys.md`,
verify key parity before commit.

**Authoring discipline:** per `feedback_i18n_translate_script_drops_keys.md`,
prefer hand-editing locale files over the translate script (which silently
drops EN keys). Build still stays green on missing keys (raw-key
fallback) so a key-by-key copy paste from `en.json` → 5 locales is safer.
Spot-check KO + JA before merge.

**New keys (under `itineraryBuilder.*`):**
- `planner.topRail.*` (region · track · date · party · lang · duration · pickup · port labels)
- `planner.bookCta` ("Book + hold card")
- `planner.outOfScopeGate.title` / `.body` / `.mailtoLabel` / `.contactEmail`
- `planner.priceMismatch.title` / `.body` / `.reconfirmCta` (409 handling)
- `planner.autoRecommend.skeleton` / `.error` / `.tryAgain`
- `checkout.itinerarySummary.*` (POI count, total drive, etc.)
- `checkout.fxHint` ("₩340,000 (≈ $254)") — D1 R1 mitigation
- `confirmation.title` / `.subtitle` / `.bookingRef` / `.itinerarySection`
  / `.cardSaved` / `.cancellationPolicy` / `.viewInMypage`
- `confirmation.email.subject` / `.preheader` / `.body.*`
- `admin.orders.sourceFilter.*` (all / tourProduct / itineraryBuilder)
- `admin.orders.itineraryBlock.*` (stops / breakdown / language / duration)

**Acceptance:**
- [ ] All 6 locale files have the new keys (hand-edit + manual review).
- [ ] `npm run build` green with no missing-key warnings.
- [ ] No raw-key leaks visible on the live screens at the cut-over
  cadence (spot-check at /itinerary-builder, /checkout, /confirmation
  in EN + KO + JA).

---

### Phase 8 — Cut-over + verification + sunset (0.5d)

**Deliverable:** the legacy proposal endpoint is dark, the new flow is
the only entry point, ops has confirmed they no longer get the email
storm.

**Tasks:**
- [ ] (8a) Feature flag `BUILDER_BOOKING_ENABLED` (env, default `true`
  post-cut-over) — for safety rollback.
- [ ] (8b) Watch `/admin/orders` for 72h. Verify:
  - In-scope bookings have PI/SI on the Customer.
  - Pending-quote bookings progress: ops sets price → email → customer
    card → PI/SI.
  - No `tour_quote_requests` row created after the cut-over timestamp.
- [ ] (8c) Mark Phase 10 ✅ in parent planner; commit summary in §C
  change log.
- [ ] (8d) File a follow-up task to permanently delete
  `/admin/itinerary-quotes` + `POST /api/itinerary/quote` in 90d.

**Acceptance:**
- [ ] 72h observation: ≥3 in-scope bookings completed end-to-end with
  card hold; ≥1 out-of-scope cycled through ops correctly.
- [ ] Ops confirms email-handshake burden gone for in-scope itineraries.

---

## E · Files touched (precise inventory)

| Type | File | What |
|---|---|---|
| Deleted | `components/itinerary-builder/IntakeForm.tsx` | merged into `PlannerTopRail` |
| Deleted | `app/itinerary-builder/[region]/page.tsx` | 308 → `/itinerary-builder?region=` |
| New | `components/itinerary-builder/PlannerTopRail.tsx` | unified top-rail |
| New | `components/itinerary-builder/LivePriceCard.tsx` | shared price card |
| New | `app/itinerary-builder/checkout/page.tsx` | Stripe card screen (URL-only handoff, D10) |
| New | `app/itinerary-builder/confirmation/[bookingId]/page.tsx` | post-card confirmation |
| New | `app/api/itinerary/book/route.ts` | bookings-row creation + price-mismatch defense |
| New | `lib/booking/createBuilderBooking.ts` | pure helper (D11/D12 mappings) |
| New | `lib/email-templates/builder-booking-confirmation.ts` | 6-locale HTML email |
| New | `src/design/analytics.ts` events (`itineraryBuilder*`) | event vocabulary per §K |
| New migration | `<ts>_extend_bookings_for_itinerary.sql` | currency + source + itinerary |
| Modified | `app/itinerary-builder/page.tsx` | now hosts PlannerTopRail + BuilderShell |
| Modified | `components/itinerary-builder/BuilderShell.tsx` | embeds top rail, exposes live price |
| Modified | `components/itinerary-builder/QuoteModal.tsx` | slimmed to contact-only |
| Modified | `components/itinerary-builder/AIRecommendPanel.tsx` | auto-run + cart-direct |
| Modified | `app/api/stripe/checkout/route.ts` | branch on `booking.currency` |
| Modified | `app/api/stripe/webhook/route.ts` | currency branch + builder email arm at line 415 |
| Modified | `app/api/bookings/route.ts` | pass `currency:'usd'` explicitly (default no-op) for tour callers, to match new helper signature |
| Modified | `components/checkout/NoShowHoldCardForm.tsx` | currency-aware (D9): new `currency`+`amountMinor` props |
| Modified | `app/tour/[id]/checkout/page.tsx` | pass `currency:'usd'` + `amountMinor` (no behavior change) |
| Modified | `app/admin/orders/[id]/settle/route.ts` (if needed per D12) | tolerate NULL merchant_id for builder rows |
| Modified | `lib/cron/recapture-holds.ts` | tolerate `tour_id = NULL` (also LEFT JOIN bookings → tours) |
| Modified | `app/admin/orders/page.tsx` | source filter + builder badge |
| Modified | `app/admin/orders/[id]/page.tsx` | itinerary section (read-only) |
| Modified | `app/admin/layout.tsx` | remove `/admin/itinerary-quotes` sidebar entry |
| Modified | `messages/{en,ko,ja,zh,zh-TW,es}.json` | new keys |
| **Deleted** | `app/api/itinerary/quote/route.ts` | sunset immediately |
| **Deleted** | `app/api/admin/itinerary-quotes/[id]/respond/route.ts` | sunset immediately |
| **Deleted** | `app/admin/itinerary-quotes/page.tsx` + `[id]/page.tsx` | sunset immediately |
| **Deleted** | `lib/slack/notify-quote.ts` | no more manual escalation |
| **Deleted** | `lib/quote-engine/{fingerprint,memory-lookup,load-preset}.ts` | precedent system retired |
| **Deleted** | `components/itinerary-builder/admin/AdminQuoteRespondForm.tsx` (if present) | no manual responses |
| New migration | `<ts>_block_quote_table_writes.sql` | INSERT trigger on quote_* tables raises (safety) |
| **Deleted** | `app/itinerary-builder/thanks/page.tsx` | replaced by confirmation route |
| **Deleted** | `lib/email-templates/quote-confirmation.ts` | replaced by builder-booking-confirmation |

---

## F · Risks + mitigations

| # | Risk | Mitigation | Severity |
|---|---|---|---|
| R1 | KRW Stripe charges may surprise customers whose card issuers add FX fees | Show "₩X (≈ $Y)" hint in checkout copy; user can choose USD via locale-aware fallback in §C/D1 if too disruptive | M |
| R2 | `recapture-holds` cron breaks on `tour_id IS NULL` | Phase 5 task 5f — verify + patch in same PR; add unit test for builder-booking cron eligibility | H |
| R3 | Existing in-flight `tour_quote_requests` rows abandoned | D3 keeps the table read-only for 90d so ops finishes the backlog | M |
| R4 | Auto-run AI fires N times per session, blowing Haiku cost | Debounce 500ms + dedupe on `(intent, region, duration)` fingerprint; cap at 3 fires per page-session | L |
| R5 | Customer accidentally books an AI recommendation they didn't review | "Book + hold card" reveals an itinerary summary above the CTA; copy emphasizes "no charge today, free cancellation 24h" | M |
| R6 | Solati 10-13 pax + 4h/5h paths still leak edge cases into booking | Inherit Phase 9 `evaluateConstraints` — if any violation, the CTA is disabled with a tooltip explaining which constraint fails | L |
| R7 | Out-of-scope email link expires / customer loses it | Booking ref printed at submit; resend-link self-serve at `/find-booking` (already exists) | L |
| R8 | Cut-over leaves legacy proposal in customer email backlog who try to respond by email | Email auto-responder for `quote+responses@`: "We've moved to instant booking, please re-quote at <link>" for 30d | M |
| R9 | Tests for the new flow are integration-heavy (Stripe + bookings + cron) | Use Stripe test mode + a seeded `bookings` row in `__tests__/integration/`; mock the cron clock | M |
| R10 | `NoShowHoldCardForm` generalization breaks existing tour-product flow | Phase 2 task 2c keeps `amountUsdCents` as a deprecated alias for one PR cycle; Stripe test-mode regression check in acceptance | H |
| R11 | Webhook silently skips builder email at line 415 today; the new arm could mis-fire for tour-product bookings | Phase 2 task 2b only branches on `source==='itinerary_builder'` (explicit allow-list); tour-product email path unchanged | H |
| R12 | Client/server price divergence (client cached an older price; pricing-policy.ts updated mid-session) | 5a 409 + re-confirm UX; client never books at a price the server doesn't agree with | M |
| R13 | Peak-season date threshold rolls over at midnight while user is mid-flow → price jumps mid-checkout | The pricing-policy uses `requestedDate` (tour date, not current date) so midnight-now does not affect price; midnight-of-tour-date is irrelevant. Verified by reading `isPeakSeason()` at `pricing-policy.ts:283-293`. | L |
| R14 | Builder bookings need RLS allowance for service-role INSERT + guest-user reads | Use the service-role client in `/api/itinerary/book` (bypasses RLS, already standard for `/api/bookings`); confirmation page also service-role read (no auth required, D5) | L |
| R15 | KRW Stripe Customers can't be reused if the same email later books a USD tour-product | Stripe Customers are currency-agnostic; the PI/SI carries the currency. Existing `stripe.customers.list({email})` lookup at `checkout/route.ts:131` works for both. ✅ | — |
| R16 | Cancellation UI doesn't exist for any booking type today → builder bookings have no customer self-cancel | Pre-existing gap, not in scope. Note in §M; customers email/Slack to cancel; ops cancels the PI in Stripe Dashboard → webhook syncs. Park as a future feature. | L |
| R17 | `/api/itinerary/match` cost spike if auto-run misbehaves at scale | Phase 4 4d telemetry + 3-fires-per-session cap (R4 mitigation); set a per-IP daily rate limit if cost monitor flags | L |

---

## G · Acceptance for the whole plan

Plan is ✅ complete when ALL of:

1. A customer can reach "card on file booking" from a home idle-preview
   chip in ≤2 clicks (chip → planner with auto-recommend → "Book + hold").
2. An in-scope itinerary creates a `bookings` row WITH `payment_intent_id`
   or `setup_intent_id` populated, with zero ops touch.
3. An out-of-scope attempt (14+ pax / >28 DMZ) shows the mailto gate
   and creates ZERO DB rows.
4. `/admin/orders` shows builder bookings via the `source` filter; ops
   does not see a separate quotes queue at all.
5. Pricing module (`lib/quote-engine/pricing-policy.ts`) unchanged —
   single SoT preserved across all 35+ existing unit tests still green.
6. Stripe stack handles KRW end-to-end: PI/SI created in KRW, captured
   in KRW, refunded in KRW (Stripe test-mode confirmed).
7. Existing tour-product flow regression-tested: USD booking still
   creates PI/SI in USD, confirmation email still sent.
8. `NoShowHoldCardForm` renders correctly in both currencies (snapshot).
9. `npm run build` green; `tsc --noEmit` clean; existing unit tests pass.
10. 6-locale key parity verified by hand (no `feedback_i18n_translate_script_drops_keys.md`
    regression).
11. 72h post-cut-over observation: ≥3 in-scope KRW bookings completed
    end-to-end with card hold; zero `tour_quote_requests` writes after
    cut-over timestamp; ops confirms email-handshake burden eliminated.

---

## H · Open questions for user (must answer before Phase 1 commits)

1. **§C D1 currency**: confirm option (a) `bookings.currency` column added
   + KRW used for builder bookings. Or do you want USD with FX conversion?
2. **§C D4 out-of-scope handling**: confirm option (a) — hard UI gate
   with mailto, **no DB row, no email pipe**, since real frequency is
   ~zero (1 quote total in DB history). Or do you want a contact-form
   path?
3. **§C D8 collapse routes**: confirm `/itinerary-builder?region=` becomes
   the single planner route + 308 redirect from `/itinerary-builder/[region]`.
4. **§C D9 form generalization**: OK to modify `NoShowHoldCardForm` in
   place (add currency-aware props + deprecate `amountUsdCents` alias)?
   This touches the existing tour-product checkout flow — regression
   covered by Phase 2 acceptance.
5. **§C D10 handoff**: confirm URL-only `?bookingId=...` pattern (vs.
   tour-product's sessionStorage). The URL-only path supports the
   share-able-link discipline + survives refresh + works for any future
   "ops resends checkout link" path.
6. **§C D11 unit_price/total_price**: confirm option (a) — write
   `final_price` to all three columns for builder rows.
7. **§C D12 merchant_id**: NULL or env-sentinel
   `ATOC_DEFAULT_MERCHANT_ID`? Need to check whether
   `/api/admin/orders/[id]/settle` requires it (Phase 2 task 2e).
8. **D5 auto-run AI**: confirm the recommendation auto-fires when any
   pricing input is present (debounced). Or keep the manual "Search" click?
9. **Phasing**: comfortable shipping Phase 2 (schema + Stripe stack
   generalization) + Phase 3 (unified shell) FIRST as one PR (low-risk,
   isolated), then Phase 4 (auto-run) + Phase 5 (booking + quote-pipe
   deletion) together? Or land them in strict order with separate PRs?
10. **The 1 existing `tour_quote_requests` row**: it's status
    `auto_quoted`, no customer action needed. Safe to leave it in the
    audit table (D3) and move on.
11. **FX-hint copy**: show "₩340,000 (≈ $254)" on checkout to soften
    surprise for US-card holders? Live FX from a daily-fetched env
    constant, no third-party API at request time.

---

## J · Mobile UX strategy

The current planner is desktop-first (map + side panel + modal). After
the unified shell + auto-recommend + booking flow lands, mobile must:

| Layer | Mobile behavior |
|---|---|
| `PlannerTopRail` | Sticky on scroll; on mobile, collapses to a 1-line summary chip ("Busan · 2026-08-20 · 4명 · EN · 8h") that taps to expand a full-screen sheet for editing. |
| `LivePriceCard` | Floats bottom-sheet on mobile (above the BottomNav); "Book + hold card" CTA always reachable without scrolling past the map. |
| `AIRecommendPanel` | Skeleton stripe collapses to a single-card placeholder on mobile; "Try another" / "Edit manually" become an inline overflow menu (⋯). |
| `<POICatalogMap>` | Inherits V2 redesign's mobile treatment (map collapses to a hero band with "Show map" CTA when timeline is in focus); this plan does NOT relitigate the map UX. |
| Out-of-scope gate | Replaces the bottom-sheet entirely with a centered card on mobile (more visible than a sticky CTA). |
| Checkout page | Reuses the existing tour-product 2-column layout's mobile pattern (1-column stack, sticky summary at top, card form below). `<NoShowHoldCardForm />` is already mobile-tested. |
| Confirmation page | Mobile-first; hero card + collapsible itinerary section. |

**Cross-coordination:** the V2 redesign (`docs/itinerary-builder-redesign-master-plan-2026-05-18.md`)
owns the map/timeline mobile pattern. This plan owns top-rail + price-card
+ checkout. If both ship in parallel, the V2 sticky-map work and this
plan's PlannerTopRail must agree on the sticky-z-order layering — flag
as a coordination point in §N.

---

## K · Telemetry events catalog

All emitted via `trackEvent()` (`src/design/analytics.ts:trackEvent`).
Defined as named methods on the analytics object so refactors stay
typed:

| Event | Fired from | Payload |
|---|---|---|
| `itineraryPlannerLoaded` | planner mount | `{ region, track, hasIntent, source }` |
| `itineraryParamChanged` | PlannerTopRail change | `{ field, value, region, track }` |
| `itineraryAutoRecommendFired` | useEffect debounced trigger | `{ region, durationHours, fingerprint }` |
| `itineraryAutoRecommendSucceeded` | match endpoint OK | `{ poiCount, totalDriveMin, fingerprint, latencyMs }` |
| `itineraryAutoRecommendFailed` | match endpoint error | `{ region, errorCode }` |
| `itineraryCartManualEdit` | user reorders/adds/removes | `{ action, poiKey }` |
| `itineraryOutOfScopeGateShown` | evaluateConstraints fails | `{ violations, pax, track }` |
| `itineraryOutOfScopeMailtoClicked` | mailto chip click | `{ pax, track }` |
| `itineraryBookCtaClicked` | "Book + hold card" click | `{ totalKrw, poiCount, autoQuotable }` |
| `itineraryBuilderBookingSubmitted` | `/api/itinerary/book` 200 | `{ bookingId, totalKrw, leadDays }` |
| `itineraryBuilderBookingPriceChanged` | 409 from `/api/itinerary/book` | `{ clientTotal, serverTotal, delta }` |
| `itineraryStripeIntentCreated` | `/api/stripe/checkout` OK | `{ bookingId, intentType }` |
| `itineraryCardHoldConfirmed` | Stripe Elements success | `{ bookingId, intentType, leadDays }` |

**Cost cap (R17):** `itineraryAutoRecommendFired` count > 3 per
sessionStorage key `itinerary_auto_run_count` → suppress further
auto-runs that session; user can still trigger manually.

---

## L · Cancellation & refund inheritance (out of scope, parked)

**Current reality:** no customer-facing cancellation route exists for ANY
booking type today (verified 2026-05-28). Cancellation is webhook-driven:
ops cancels the PaymentIntent in Stripe Dashboard → `payment_intent.canceled`
webhook → `bookings.payment_intent_status='canceled'` (verified at
`app/api/stripe/webhook/route.ts:164-179`). The webhook lookup is by
`booking_id` only — no `tour_id` dependency — so builder bookings will
work the same way ✅.

**Implication for this plan:** no new cancellation code is needed.
Builder bookings inherit the same model:
- Customer wants to cancel → emails/Slacks AtoC
- Ops opens Stripe Dashboard, cancels the PI/SI
- Webhook syncs the status
- Settlement endpoint releases the hold (if it was authorized but not
  captured)

**Parked follow-up (not in this plan):** building a
`/booking/[reference]` self-serve cancellation flow with a 24h policy
gate. Open this as a §E parked idea in the parent planner with
`tour_product + itinerary_builder` scope.

---

## M · Cut-over runbook (expands Phase 8)

### Pre-cut (T-1 day)
- [ ] Stripe test mode: end-to-end booking with KRW (in-scope English
      8h / 2 pax / Busan-city → ₩340,000 hold → Stripe Dashboard shows
      KRW PI on the right Customer)
- [ ] Stripe test mode: end-to-end booking with USD (tour-product
      regression)
- [ ] 6-locale parity verified (hand-check 3 keys per locale)
- [ ] `recapture-holds` cron dry-run with a NULL-`tour_id` seeded row
      → does not crash
- [ ] Audit of the 1 existing `tour_quote_requests` row: confirm it's
      `auto_quoted`, customer received the email, no follow-up needed
- [ ] Email auto-responder for `quote+*@atockorea.com` set up (R8)
- [ ] Feature flag `BUILDER_BOOKING_ENABLED=false` initially

### Cut (T-day, 09:00 KST)
- [ ] Deploy to prod with `BUILDER_BOOKING_ENABLED=false`
- [ ] Verify routing: `/itinerary-builder?region=busan` loads new shell,
      `/itinerary-builder/busan` 308-redirects, home entry chips work
- [ ] Verify `/admin/orders?source=itinerary_builder` filter renders
      (empty list expected)
- [ ] Flip `BUILDER_BOOKING_ENABLED=true`
- [ ] Smoke test in prod: self-test booking with a real personal card
      → confirm Stripe Dashboard shows a KRW PI/SI → cancel it from
      Stripe Dashboard → webhook syncs

### Post-cut (T+0 → T+72h)
- [ ] Watch `/admin/orders` hourly for first 24h
- [ ] Watch Sentry/Vercel logs for `/api/itinerary/book` errors
- [ ] Watch `match_queries` for auto-recommend volume + Haiku cost
- [ ] Watch Stripe Dashboard for KRW PI/SI failures or unusual decline
      patterns (issuer-side FX rejections)
- [ ] Confirm zero new `tour_quote_requests` rows after cut-over timestamp:
      `SELECT COUNT(*) FROM tour_quote_requests WHERE created_at > '<T>';`
      → must be 0

### Rollback criteria (any of)
- Stripe KRW failures > 5% of attempts
- `/api/itinerary/book` 5xx rate > 1%
- Customer complaints about double-charge / FX surprise > 2 in 24h
- Ops reports they're STILL getting quote emails (indicates a path we
  missed)

### Rollback procedure
- Flip `BUILDER_BOOKING_ENABLED=false` → planner's "Book + hold card"
  reverts to a "Request a quote" CTA pointing to a temporary lightweight
  contact form (NOT the old quote pipe — that's deleted). Stripe-side
  PI/SI created so far are kept (refundable via ops); no DB rollback.

### 30d follow-up
- [ ] Confirm 0 backwash to `/quote` paths
- [ ] Decision to drop `tour_quote_requests` / `quote_memory` /
      `quote_presets` tables (filed as a follow-up issue in 5h)

### 90d follow-up
- [ ] Drop the three quote tables + the safety trigger migration

---

## N · Parent planner update draft (proposed)

Once §C decisions are signed off, the parent planner
`docs/itinerary-builder-plan.md` gets these edits in the Phase 1 commit:

### §A status row added:
```
| 10 — Flow simplification + card-hold booking | 🔄 in progress | 2026-05-28 | — | (planner commit first) |
```

### §B new decision rows (draft, may be reduced based on user answers):
```
| 2026-05-28 | D16 | bookings.currency column added; builder bookings store KRW final_price; /api/stripe/checkout + webhook branch | Avoids FX risk and KRW→USD round-trip loss; Stripe supports KRW natively |
| 2026-05-28 | D17 | bookings.itinerary jsonb column stores poi_keys/track/duration/breakdown for builder rows | Mirrors auto_quote_breakdown shape; one column vs 8 sparse cols |
| 2026-05-28 | D18 | tour_quote_requests + quote_presets + quote_memory writes BLOCKED immediately (trigger); tables retained 90d for audit then dropped | The pricing table (Phase 9) makes the manual-quote path vestigial; DB shows zero manual responses in history |
| 2026-05-28 | D19 | Out-of-scope (14+ pax / >28 DMZ) = hard UI gate + mailto, NO DB row, NO email pipe | Real frequency near-zero; building a workflow for that traffic is the trap that created the ops pain |
| 2026-05-28 | D20 | AI recommendation auto-runs on planner mount when pricing inputs present (500ms debounce, 3-fires-per-session cap) | Removes the "Take this itinerary" extra click |
| 2026-05-28 | D21 | /itinerary-builder is the single planner route; /[region] 308-redirects (next.config.js) | Removes one navigation step |
| 2026-05-28 | D22 | /admin/itinerary-quotes (page + API + sidebar) removed immediately in cut-over commit; ops uses /admin/orders with source filter | Single queue for ops cognitive load |
| 2026-05-28 | D23 | NoShowHoldCardForm generalized to accept `currency`+`amountMinor` (deprecate `amountUsdCents` alias); tour-product callers updated | Builder KRW bookings can't reuse a USD-cents-only component; forking duplicates Stripe Elements code |
| 2026-05-28 | D24 | Booking handoff = URL-only `?bookingId=...` (vs tour-product's sessionStorage) | Preserves share-able links (D5) + survives refresh + works for any email-link delivery path |
| 2026-05-28 | D25 | Builder `bookings` row writes `unit_price = total_price = final_price` (flat-rate reality) | Smallest schema lie; per-person fiction would corrupt BI for Solati 10-13 pax |
| 2026-05-28 | D26 | Builder `bookings.merchant_id = process.env.ATOC_DEFAULT_MERCHANT_ID || null` | TBD by settle-endpoint requirement (Phase 2 task 2e); env default keeps it tunable |
```

### §E new parked-idea row:
```
| 2026-05-28 | Flow simplification + card-hold booking | Customer flow redundant across 3 screens; submission is proposal-only — ops drowns in email handshakes. | **Promoted to dedicated planner: `docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md`** — 8 phases (1–8), ~5.5 person-days. Phase 1 = decisions + planner commit; no code until §C D1–D12 ratified. |
| 2026-05-28 | Customer self-serve cancellation UI | No `/booking/[ref]` cancellation flow exists for ANY booking type today; cancellation is webhook-driven (ops cancels PI in Stripe Dashboard). Builder bookings inherit this gap — see §L. | Future feature; not blocking this plan. Track scope: tour-product + itinerary_builder. |
```

### §F new Phase 10 entry (full sub-checklist mirroring §D above).

### Coordination with parallel tracks
- **V2 redesign** (`docs/itinerary-builder-redesign-master-plan-2026-05-18.md`):
  owns map/timeline mobile layout. If both ship in parallel, agree on
  the sticky-z-order between `PlannerTopRail` (this plan) and the V2
  sticky-map (that plan). Communicate at each track's Phase 1.
- **Phase 9 pending interactive QA**: independent of this plan (Phase 9
  is code-complete; this plan only consumes the pricing module). Do NOT
  block Phase 10 on Phase 9's QA — they verify different surfaces.
- **POI data quality** (`docs/itinerary-builder-poi-data-quality-master-plan-2026-05-20.md`):
  no overlap. Builder bookings render POI names from `match_pois` —
  whatever names are correct on cut-over day are what customers see.
