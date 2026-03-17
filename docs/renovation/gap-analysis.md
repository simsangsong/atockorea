# Gap Analysis: Audit & Migration Plan vs. Final Product Spec

**Date:** 2025-03-17  
**Baseline:** `docs/renovation/final-product-spec.md`  
**Compared to:** `audit.md`, `migration-plan.md`, `component-map.md`, `risk-map.md`

**Legend:**
- **Already covered** — Explicitly addressed in audit/migration plan with clear path.
- **Partially covered** — Mentioned or implied but missing detail, ordering, or explicit deliverable.
- **Missing** — Not addressed or only loosely implied.

---

## 1. Product rules (from spec §1–2)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| P1 | Platform is NOT generic OTA; feel like smarter Jeju planning | Partially covered | Migration plan says “hotel-area-first message” and “differentiation”; no explicit “smarter planning” positioning copy. |
| P2 | Feel: avoid complicated planning, hotel considered, better comfort than bus, clear payment, premium/trustworthy | Partially covered | Copy/trust mentioned; “avoid complicated planning” and “comfort vs bus” not called out as required messaging. |
| P3 | Do NOT sell “AI technology” as hero; sell less planning, less hassle, smoother pickup, comfort, transparent rules | Partially covered | Audit/migration don’t explicitly forbid AI-as-hero or require “less planning” as primary message. |
| P4 | Support brand: “Starting with Jeju, expanding across Korea.” | Missing | Not in audit or migration plan. |
| P5 | Three product types: AI Private, AI Small-Group Join, Classic Bus — with clear hierarchy | Partially covered | Migration Phase 2 says “strong differentiation”; hierarchy order (1. Private, 2. Join, 3. Bus) not stated. |
| P6 | AI Private: AI route, no matching wait, instant confirmation, private comfort, team pricing 1–6 / 7–13 | Partially covered | Pricing in spec; audit doesn’t map current private pricing; migration doesn’t require “instant confirmation” copy. |
| P7 | UI may show per-traveler equivalent; server remains source of truth | Already covered | Migration: “Server as source of truth”; no client-side price decisions. |
| P8 | AI Small-Group Join: AI route, small-group comfort, hotel-area matching, deposit now / balance later; key sell = “smoother, less tiring” not “cheap” | Partially covered | Deposit/balance in plan; “smoother, less tiring” positioning not explicit. |
| P9 | Classic Bus: fallback only; never visually dominate AI products | Partially covered | Migration says “differentiation”; “never dominate” and “fallback” not explicit in plan. |

---

## 2. Booking / payment / confirmation rules (spec §3)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| B1 | Small-Group: 20% deposit at booking | Partially covered | Checkout trust copy in plan; “20%” explicit in spec copy; migration mentions “deposit, balance” in summary. |
| B2 | Deposit refundable until 24h before departure | Partially covered | Timeline adapter in plan; “refundable until 24h” not called out as required visible copy. |
| B3 | At 24h before: balance opens; user pays manually in My Tours | Already covered | Migration: “manual balance,” “single CTA,” trust copy “complete it manually in My Tours.” |
| B4 | Balance deadline 18h before departure | Partially covered | Timeline ViewModel has balanceDueAt; “18h” not explicit in migration. |
| B5 | Tour confirms when minimum travelers complete balance | Missing | Not in audit/migration; no “when is my tour confirmed” logic/copy called out. |
| B6 | Never auto-charge remaining balance | Already covered | Trust copy and timeline autoCharge: false in spec and plan. |
| B7 | No-show non-refundable | Missing | Not in audit or migration. |
| B8 | Late cancellations may temporarily limit new bookings | Missing | Not in audit or migration. |
| B9 | Once balance stage opens, displayed final price must not increase for remaining paid travelers | Missing | Not in audit or migration. |
| B10 | Mandatory trust copy: “We will never charge your card automatically for the remaining balance. You need to complete it manually in My Tours.” | Already covered | Migration Phase 4: trust copy near CTA. |
| B11 | Private: keep existing payment logic; present price and pickup surcharge clearly | Partially covered | “Wrap existing payment”; “pickup surcharge as separate line” in checkout; private-specific rules not enumerated. |

---

## 3. Hotel area / pickup strategy (spec §4)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| H1 | Hotel area is core product rule: input flow, surcharge, join suitability, route-fit, list filter, detail explanation | Partially covered | Migration: hotel-adapter, “hotel-aware UX”; not all six touchpoints listed. |
| H2 | Hotel-area-first UX | Already covered | Migration Phase 2/3: “hotel-area-first,” “hotel-aware.” |
| H3 | Jeju: simplified area tiers externally; preserve internal finer mapping | Partially covered | Hotel adapter/schema exist; “simplified tiers” (A–D) not in audit/migration. |
| H4 | A. Jeju City Core: pickup included, no surcharge | Missing | Tier definitions not in audit or migration. |
| H5 | B. Near-city: private KRW 30,000; join KRW 5,000/traveler | Missing | Same. |
| H6 | C. Outer: private KRW 50,000; join KRW 8,000/traveler | Missing | Same. |
| H7 | D. Remote: private KRW 70,000; join KRW 10,000; join may be limited; “Private tour recommended” / “Join not available for this route yet” | Missing | Same; messaging in spec but not in plan. |
| H8 | Do not expose internal language (zone logic, rule-based matching, semi-FIT); use human copy (Good match, Smoother pickup, Additional fee, Private recommended) | Partially covered | Copy principles in spec; migration doesn’t explicitly forbid internal terms. |

---

## 4. UX / copy principles (spec §5)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| C1 | Do NOT say: algorithmic optimization, rule-based matching, semi-FIT, advanced intelligent routing, dynamic behavioral pricing | Partially covered | design/copy exists; audit/migration don’t list forbidden phrases. |
| C2 | Prefer: smarter route, smoother pickup, better fit for hotel, less hassle, more comfortable than bus, secure with 20% deposit, no automatic balance, private recommended, join not available | Partially covered | Copy constants; no explicit checklist in migration. |
| C3 | Feel: premium but calm, intelligent but human, travel-first not tech-first, trustworthy not flashy | Partially covered | Design tokens; “calm, human, travel-first” not explicit in plan. |

---

## 5. Design system (spec §6)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| D1 | Visual: bright background, generous spacing, clean premium, subtle AI, Apple-like calm + OTA trust + soft Jeju; avoid neon/gaming | Partially covered | Tokens exist; “bright, generous, Apple-like, avoid neon” not in migration checklist. |
| D2 | Brand colors: Navy, Blue, Ocean/Teal, Green, Orange, Red, Neutral gray (semantic roles) | Partially covered | tokens.ts; migration doesn’t require semantic-role audit. |
| D3 | Typography: Inter or Pretendard, strong readability, tabular numerics, hero premium and spacious | Partially covered | Design files; “tabular numerics” and “hero spacious” not explicit in plan. |
| D4 | Button min-height 44px | Missing | Not in migration plan. |
| D5 | Visible focus rings | Partially covered | Phase 5 accessibility; not in Phase 1 foundation. |
| D6 | Status never by color alone | Partially covered | status.ts; Phase 5 a11y; not explicit in component requirements. |
| D7 | Hover-only critical interactions forbidden | Missing | Not in audit or migration. |
| D8 | Mobile-first layout mandatory | Partially covered | Risk-map “mobile”; “mandatory” not in plan. |
| D9 | Motion: subtle, 150–220ms ease-out, opacity + small scale only; no flashy; do not imply backend actions that don’t exist | Partially covered | motion.ts; “do not imply backend” in migration (loading copy) but not motion. |

---

## 6. Page-level requirements

### 7.1 Homepage

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| HP1 | Sections in order: Header, Hero, Trust strip, Why choose, Tour type cards, How it works, Preview itinerary, Destinations, Classic bus fallback, Reviews, Final CTA, Footer | Partially covered | Migration “new Hero, trust strip, destinations, tour type cards, How it works, preview itinerary, reviews, final CTA”; order and “Why choose” comparison not explicit. |
| HP2 | Header: logo left; nav AI Tours, Private, Small-Group Join, Classic Bus, My Tour, Help; right CTA “Plan My Trip” | Partially covered | Shell restyle; exact nav labels and “Plan My Trip” not specified. |
| HP3 | Hero: premium/calm; left: headline, sub, compact planner input, micro trust; right: preview card/itinerary mockup/pickup/price badge; stacked mobile | Partially covered | “New Hero”; “compact planner input” and “preview card” not detailed. |
| HP4 | Hero copy: “Plan less. Enjoy more of Jeju.” or “A smarter, more comfortable way to tour Jeju.”; sub about hotel/date/style | Partially covered | copy.ts; migration doesn’t require these exact hero lines. |
| HP5 | Hero inputs: Destination, Date, Hotel/Hotel Area, Guests, Travel Style; primary CTA Plan My Trip | Partially covered | Builder has steps; homepage “compact planner” not mapped to these five. |
| HP6 | Trust strip: AI-built itinerary, Smarter pickup, 3–13 travelers, Transparent deposit and balance | Partially covered | Trust strip in plan; four points not enumerated. |
| HP7 | Comparison section: “Why travelers choose this over crowded bus tours or expensive private charters”; compare planning, group size, pickup, comfort, flexibility, booking clarity, price | Missing | Not in migration plan. |
| HP8 | Tour cards: 1) AI Private (CTA Start Private Tour), 2) AI Small-Group Join (CTA Join Small Group), 3) Classic Bus (smaller priority, CTA View Classic Bus Tours) | Partially covered | “Tour type cards”; CTAs and “smaller priority” for bus not explicit. |
| HP9 | How it works: 1. Enter hotel 2. We plan route 3. Choose comfort 4. Travel with less hassle | Partially covered | “How it works” in plan; four steps not listed. |
| HP10 | Preview itinerary: example card with title, pickup area, hotel-fit hint, traveler count, vehicle, deposit note, balance opens 24h | Partially covered | “Preview itinerary block”; card fields not enumerated. |
| HP11 | Destinations: Jeju Available now; Busan/Seoul Coming soon; not dead links; muted + notify/waitlist CTA | Partially covered | DestinationsCards; “not dead links” and “notify/waitlist” not in plan. |
| HP12 | Classic bus section title: “Prefer a classic group tour instead?” | Missing | Not in migration plan. |
| HP13 | Reviews: positioning-aligned (easier than planning, more comfortable than bus, pickup made sense, smoother for join) | Partially covered | “Reviews”; spec examples not in plan. |
| HP14 | Final CTA: “Ready to build your Jeju trip the smarter way?” + Plan My Trip | Missing | Not in migration plan. |

### 7.2 Tour Builder page

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| TB1 | Wizard-like; left form, right sticky live summary; mobile stacked + sticky summary/CTA | Partially covered | Builder in Phase 3; “sticky live summary” and layout not detailed. |
| TB2 | Steps: 1) Destination (Jeju active, Busan/Seoul coming soon), 2) Hotel search/area (autocomplete, landmark chips, manual pin), instant feedback: pickup area, surcharge, join hint | Partially covered | Hotel adapter; “landmark chips,” “manual pin,” “instant feedback” not all in plan. |
| TB3 | Steps: 3) Date, 4) Group size, 5) Travel style, 6) Preferred tour type (private/join/both), 7) Optional notes | Partially covered | custom-join-tour has different steps; spec step list not aligned. |
| TB4 | Live summary: destination, hotel area, date, guests, style tags, preferred type, surcharge preview, short deposit rule note | Partially covered | “live summary panel” in plan; fields not enumerated. |
| TB5 | CTA “Build My Tour”; clear step progression; do not overload | Partially covered | Builder CTA; “do not overload” not explicit. |

### 7.3 Loading page

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| LD1 | Feel like trip being prepared; no fake real-time matching if backend doesn’t support | Already covered | Migration: “realistic loading copy,” “No fake real-time matching.” |
| LD2 | Allowed copy: “Checking pickup flow near [Area]…”, “Finding the best route…”, “Looking for the best tour fit…”, “Almost there…” | Partially covered | “Spec copy” in plan; examples not listed. |
| LD3 | Visual: clean light, simple route/pickup/itinerary assembly, max 3 stages; end “Your trip is ready” | Partially covered | “Dedicated loading route or in-page”; “max 3 stages” and end copy not in plan. |

### 7.4 Generated tour list page

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| GL1 | Top summary bar: destination, hotel area, date, guests, style tags, edit search CTA | Partially covered | Adapter ViewModels; “top summary bar” and fields not in plan. |
| GL2 | Primary filter order: Hotel Area, Tour Type, Date, Group Size, Travel Style, Pickup surcharge, Price | Missing | Not in migration plan. |
| GL3 | Section order: Recommended for you, Private options, Small-group options, Classic bus fallback | Partially covered | tours-adapter has recommended/privateTours/joinTours/busTours; list page structure not aligned to “sections.” |
| GL4 | Tour card: title, type badge, tags, pickup area, match quality, join status, joined/capacity, surcharge, deposit/balance note, CTA | Partially covered | Restyle TourCardDetail; “match quality,” “join status,” “deposit/balance note” need adapter/API. |
| GL5 | Match quality labels: Great pickup match, Good pickup match, Slight extra travel time may apply | Missing | Not in migration plan. |
| GL6 | Join states: Waiting for more travelers, Balance payment open, Confirmed, Missed deadline, Private recommended, Join not available for this route yet | Partially covered | status.ts / types; migration doesn’t list all six states for list. |
| GL7 | Frontend consumes validated ViewModels, not raw legacy payloads | Already covered | Migration: adapters; UI consumes ViewModels only. |

### 7.5 Tour detail page

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| TD1 | Structure: title/hero, key badges, price summary, pickup + surcharge, why this fits you, overview, booking timeline, cancellation, who this is for, similar alternatives | Partially covered | “booking timeline,” “why this fits you,” badges; full structure not enumerated. |
| TD2 | Badges: AI Planned, Small Group, Private, Verified Local Guide, Transparent Booking Rules | Partially covered | Badges in plan; list not in migration. |
| TD3 | “Why this fits you”: good fit for hotel area, smoother pickup, fewer than bus, better value than private | Partially covered | “why this fits you” in plan; four examples not. |
| TD4 | Booking timeline must be visual | Already covered | Migration: “booking timeline” block; timeline.tsx exists. |

### 7.6 Checkout page

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| CX1 | Do not alter working payment execution; wrap with better UI | Already covered | Migration and risk-map: wrap only. |
| CX2 | Layout: left (traveler, contact, hotel/pickup confirmation, payment); right (sticky order summary, booking timeline, reassurance box, final CTA) | Partially covered | “Reassurance box,” “trust copy”; full layout not in plan. |
| CX3 | Reassurance: “Secure Your Seat with a 20% Deposit”; body re deposit, no auto balance, free cancel until 24h | Partially covered | “Reassurance box” in plan; exact title/body not. |
| CX4 | Critical trust copy near CTA (never auto-charge…) | Already covered | Migration Phase 4. |
| CX5 | Order summary: base, pickup surcharge separate, subtotal, deposit due today, remaining balance later, final surcharge if known | Partially covered | “Restyle order summary (base, surcharge, deposit, balance)”; “final surcharge label” not. |
| CX6 | CTA: “Reserve My Spot” or “Pay Deposit” | Missing | Not in migration plan. |

### 7.7 Login / auth page

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| AU1 | Preferred auth: Google, Apple, Email; guest checkout where compatible | Partially covered | Current Supabase; “Apple,” “guest checkout” not in plan. |
| AU2 | Benefit copy: manage booking, pay balance, view status, get confirmation | Partially covered | “Benefit copy” in plan; four points not listed. |

### 7.8 My Tour / My page

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| MY1 | Tabs/sections: My Tours, Payments, Profile, Support | Partially covered | mypage has dashboard, mybookings, upcoming, history, reviews, wishlist, settings; spec tabs not aligned. |
| MY2 | Each tour card: title, date, pickup area, status badge, next step, countdown if relevant, remaining balance if relevant, single primary CTA | Partially covered | “Single primary CTA,” “status labels”; card fields not enumerated. |
| MY3 | Statuses: deposit_paid, awaiting_balance, balance_due, confirmed, cancelled, refunded, deadline_missed | Partially covered | booking-adapter, status.ts; migration doesn’t list all seven. |
| MY4 | Status banners: Awaiting Balance Payment, Confirmed, Cancelled; next actions: Pay Balance Now, View Booking Details, View Pickup, Rebook | Partially covered | “Single primary CTA per state”; actions not enumerated. |
| MY5 | Only ONE primary CTA per state | Already covered | Migration Phase 4. |
| MY6 | Countdowns: tabular numerics | Missing | Not in migration plan. |

### 7.9 Help / FAQ

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| HQ1 | Must include: How does deposit work? When pay balance? When is tour confirmed? How do hotel-area pickup fees work? What if hotel outside central Jeju? Cancel and rebook? Minimum group not reached? | Missing | Not in audit or migration plan. |
| HQ2 | Clear accordion/card UX | Missing | Not in migration plan. |

---

## 7. Architecture / implementation constraints (spec §8)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| A1 | Do not break existing functionality | Already covered | Migration and risk-map. |
| A2 | Do not rewrite working backend unless necessary | Already covered | Same. |
| A3 | Do not replace API contracts with incompatible ones | Already covered | Same. |
| A4 | Do not move pricing/time/status decisions to client | Already covered | Server as source of truth. |
| A5 | Do not hardcode UI strings in components | Partially covered | copy.ts; not in migration checklist. |
| A6 | Do not rely on hover for critical mobile info | Missing | Not in migration plan. |
| A7 | Do not remove working features before replacement | Already covered | Risk-map. |
| A8 | Do not touch Stripe/payment execution except wrappers | Already covered | Same. |
| A9 | Do not use fake loading/status copy implying unsupported backend | Already covered | Migration loading. |
| A10 | Use feature flags for risky changes | Already covered | Migration. |
| A11 | Use adapter-based migration | Already covered | Full plan. |
| A12 | Old logic/API/DB → adapters → new UI | Already covered | Same. |

---

## 8. File structure (spec §9)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| F1 | App routes: (marketing), build-tour, tours, checkout, my-tours, login | Partially covered | Current routes differ (custom-join-tour, tour/[id], mypage); plan doesn’t require spec route names. |
| F2 | components/ui: button, badge, card, input, search-input, bottom-sheet, timeline, countdown-label, status-banner, section-header | Partially covered | timeline exists; others “add or adopt”; bottom-sheet, countdown-label, status-banner not explicit. |
| F3 | components/tour: hero-planner, trip-summary, tour-card, tour-fit-badge, pickup-surcharge-info, booking-timeline, price-summary, join-status-badge | Partially covered | Some exist under different names; spec names not required in plan. |
| F4 | design/: tokens, copy, status, analytics, motion | Already covered | Present; migration Phase 1. |
| F5 | lib/adapters: booking, pricing, timeline, hotel | Partially covered | booking, tours, hotel mentioned; pricing-adapter, timeline-adapter in file structure only. |
| F6 | lib/schemas: hotel, tours, booking; lib/format: currency, date, countdown | Partially covered | Schemas exist; format/ not in audit. |
| F7 | types: tours, booking, pricing | Partially covered | tours, booking exist; pricing type not confirmed. |

---

## 9. Types / ViewModels / API contracts (spec §10)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| V1 | Tour types: private, join, bus | Partially covered | types/tours; migration uses adapters. |
| V2 | Join statuses: waiting, balance_open, confirmed, missed_deadline, private_only, join_unavailable | Partially covered | Schemas/types; migration doesn’t list all. |
| V3 | Match quality: great, good, slight | Partially covered | Spec ViewModels; not in migration checklist. |
| V4 | Hotel lookup response (id, displayName, lat, lng, pickupAreaLabel, surchargeAmount, surchargeLabel, joinAvailable) | Partially covered | hotel schema/adapter; “Hotel lookup” adapter in plan. |
| V5 | Build tour request/response shape (destination, hotelId, date, guests, styleTags, preferredType; searchSummary, recommended, privateTours, joinTours, busTours) | Partially covered | tours-adapter and schemas. |
| V6 | My tour response (tour, paymentHistory) | Partially covered | booking-adapter. |
| V7 | Booking timeline (now, tourStartAt, refundDeadlineAt, balanceOpensAt, balanceDueAt, autoCharge: false) | Partially covered | Timeline adapter in plan; schema not confirmed. |
| V8 | Zod safeParse in adapter; no raw legacy to UI; fallback ViewModel on parse failure | Already covered | Migration and existing adapters. |

---

## 10. Analytics / privacy (spec §11)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| AN1 | Do not track raw hotel names or exact coordinates | Missing | Not in migration plan. |
| AN2 | Allowed: pickup area label, surcharge tier, tour type, state transitions, funnel steps | Partially covered | design/analytics.ts; migration Phase 5 “analytics instrumentation”; allowed list not in plan. |
| AN3 | Example events: hero_form_start, hotel_selected, surcharge_shown, build_tour_started, build_tour_completed, tour_card_viewed, detail_viewed, checkout_started, deposit_paid, balance_open_seen, balance_paid, payment_missed | Partially covered | analytics.ts; event list not in migration. |
| AN4 | Never store: raw hotel name, exact lat/lng | Missing | Not in migration plan. |

---

## 11. Accessibility / mobile (spec §12)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| AC1 | Button min height 44px | Missing | Not in migration plan. |
| AC2 | Visible focus states | Partially covered | Phase 5 a11y. |
| AC3 | No status by color alone | Partially covered | status.ts; not in Phase 1. |
| AC4 | Mobile-first layouts | Partially covered | Implied. |
| AC5 | Hover-only info must have mobile bottom-sheet or inline alternative | Missing | Not in migration plan. |
| AC6 | Strong contrast | Missing | Not in migration plan. |
| AC7 | Tabular numerics for times/prices/countdowns | Partially covered | Design spec; not in migration. |

---

## 12. Execution phases (spec §13)

| ID | Requirement | Coverage | Notes |
|----|-------------|----------|--------|
| E0 | Phase 0: Audit; map pages, components, backend; identify safe vs risky; produce migration plan; save in docs/renovation/ | Already covered | audit, component-map, risk-map, migration-plan. |
| E1 | Phase 1: Design tokens, copy, status, analytics, motion; Zod + adapters; UI primitives; no page replacement | Already covered | Migration Phase 1. |
| E2 | Phase 2: Homepage; design system; hotel-area-first; private/join/bus differentiation | Already covered | Migration Phase 2. |
| E3 | Phase 3: Builder + Loading + List + Detail; adapter ViewModels; realistic loading; hotel-aware; booking timeline on detail | Already covered | Migration Phase 3. |
| E4 | Phase 4: Checkout + My Tour + Login; trust-first; wrap auth/payment; single CTA; manual-balance trust | Already covered | Migration Phase 4. |
| E5 | Phase 5: Accessibility, analytics, motion consistency, QA, no regressions | Already covered | Migration Phase 5. |

---

## 13. At risk: omission, distortion, simplification

Items that could be omitted, distorted, or oversimplified during implementation:

1. **Payment timeline precision**  
   Spec: 24h before = balance opens, 18h before = balance due. Risk: generic “balance due” copy without “18h” or wrong order; timeline adapter might not enforce 18h/24h in copy.

2. **Hotel area tiers (A–D) and copy**  
   Spec defines four Jeju tiers with exact surcharges and “Private recommended” / “Join not available.” Risk: backend may use different zones; UI could show internal labels or wrong amounts; “human” copy (Good match, Smoother pickup) replaced by technical terms.

3. **Product hierarchy and bus-tour prominence**  
   Spec: 1. Private, 2. Join, 3. Bus; bus “never visually dominate.” Risk: current homepage may give bus equal weight; renovation could keep current balance instead of demoting bus.

4. **Join confirmation rule**  
   Spec: “Tour confirms once minimum required travelers complete balance payment.” Risk: not in audit/migration; My Tour might show “Confirmed” without this rule being explained; FAQ “What if minimum not reached?” missing.

5. **“No price increase after balance opens”**  
   Spec: once balance stage opens, displayed final price must not increase for remaining paid travelers. Risk: not in plan; could be broken by backend or UI changes.

6. **Comparison section (Why choose this over bus/private)**  
   Spec: dedicated section with seven comparison dimensions. Risk: merged into generic “trust” or “how it works,” losing conversion-focused comparison.

7. **Filter and section order on list page**  
   Spec: filter order (Hotel Area first, then Tour Type, etc.) and section order (Recommended, Private, Small-group, Bus). Risk: implemented as single list or different order, reducing hotel-area-first and product hierarchy.

8. **Match quality and join state labels**  
   Spec: exact labels (e.g. “Great pickup match,” “Waiting for more travelers”). Risk: ad-hoc strings or different wording; missing states (e.g. “Join not available for this route yet”).

9. **Help/FAQ content**  
   Spec: seven required questions. Risk: FAQ exists but doesn’t cover deposit, balance timing, confirmation, pickup fees, outside central Jeju, cancel/rebook, minimum group; or uses accordion that doesn’t meet “clear” UX.

10. **Analytics privacy**  
    Spec: never store raw hotel name or exact lat/lng. Risk: events or logging could include PII; not called out in migration, so easy to add tracking that violates spec.

11. **Accessibility and interaction rules**  
    Spec: 44px min height, no hover-only critical info, tabular numerics. Risk: treated as “later a11y pass” and forgotten; hover-only tooltips left on mobile; countdowns/price with proportional numerals.

12. **Reassurance and CTA wording**  
    Spec: exact reassurance title/body and “Reserve My Spot” or “Pay Deposit.” Risk: different wording that weakens trust or clarity.

---

## 14. Summary counts

| Coverage        | Count (approx) |
|----------------|----------------|
| Already covered | 35 |
| Partially covered | 85 |
| Missing        | 25 |

**Recommendation:** Update migration plan to (1) add explicit checklists for missing and partially covered items, (2) call out hotel-area tiers and payment timeline rules, (3) add Help/FAQ and analytics-privacy to phases, (4) add a11y and copy constraints to Phase 1/5 so they are not dropped.
