# Builder Loading Refactor Plan (Step 13)

**Purpose:** Plan refactor of the custom-join-tour (builder) flow: step structure, hotel search/hotel area UX, summary panel behavior, and loading screen stages/copy. No implementation in this step.

**Source of truth:** `docs/renovation/final-product-spec.md` §7.2 (Tour Builder), §7.3 (Loading Page), §9 (constraints); `docs/renovation/migration-plan.md` §2.2 (Builder, Loading); `docs/renovation/risk-map.md`; `app/custom-join-tour/page.tsx`, `components/maps/HotelMapPicker.tsx`.

---

## 1. Builder step structure

**Current (code):**  
Step type is `'start' | 'ask_participants' | 'ask_vehicle' | 'ask_destination' | 'ask_date' | 'ask_language_date' | 'chat' | 'itinerary' | 'checkout' | 'confirmed'`. The UI does not render separate screens per step; it uses:

- **Dashboard (form):** Single view when `showDashboard === true` (i.e. `step` not in `itinerary` | `checkout` | `confirmed`). Contains: destination selector (Jeju/Busan/Seoul), tour date, departure time, guide language, guests + vehicle (van vs large van), **hotel** (button opening HotelMapPicker), describe textarea, theme tags, guarantee copy, Generate button.
- **Join mode:** When `proposedTourToJoin` is set and user has not yet proceeded: card with proposed tour title/price, hotel selector, distance error, “Proceed to join” CTA. After proceed: same dashboard form is hidden; user goes to checkout.
- **Itinerary:** After generate succeeds, user is sent to `?open=itinerary` and `step === 'itinerary'`. Shows schedule, guide message, extra fee notice, pricing line, day rows with places, map, “Confirm itinerary” button.
- **Checkout:** Customer form (name, phone, email, chat app, contact), booking summary sidebar (date, time, guests, total, “Proceed to payment”), notices (24h cancel, 48h proposal).
- **Confirmed:** Success state after confirm (or after checkout when not redirecting to Stripe).

**Spec alignment (§7.2):**  
Required steps are: (1) Destination, (2) Hotel search / hotel area, (3) Date, (4) Group size, (5) Travel style, (6) Preferred tour type, (7) Optional notes. Layout: desktop = left form / right sticky live summary; mobile = stacked step cards + sticky summary/CTA.

**Planning (no code change here):**

| Aspect | Current | Target (plan) |
|--------|---------|----------------|
| Step granularity | Single form + itinerary + checkout + confirmed | Optionally expose clearer step progression (destination → hotel → date → group → style → type → notes) for UX; implementation may keep single scroll or split into step cards. |
| Order | Destination, date/time, language, guests+vehicle, hotel, describe, generate | Align order with spec where applicable: destination, **hotel area**, date, group size, travel style, tour type, notes. |
| Layout | Single column, max-w-3xl | Desktop: left form, right sticky summary (if added). Mobile: stacked + sticky summary/CTA. |

Step state machine and transitions (e.g. `setStep('itinerary' | 'checkout' | 'confirmed')`) remain; only presentation and ordering of form blocks may be refactored.

---

## 2. Hotel search / hotel area UX flow

**Current:**

- **Entry:** Button in dashboard (“Hotel location” / placeholder) opens `HotelMapPicker` (`hotelMapOpen`). Same pattern in join mode (select your hotel to check distance).
- **HotelMapPicker:** Modal with Google Map (Jeju center), Places API (New) `PlaceAutocompleteElement` only (no legacy Autocomplete). Search container ref; `gmp-select` → `toPlace()`, `fetchFields(['displayName', 'formattedAddress', 'location'])` → set `selectedLocation`. Map click → Geocoder → set `selectedLocation`. Confirm → `onConfirm({ address, lat, lng, placeName })`.
- **After select:** `hotelInfo` state set; `hotelLocation = getHotelLocationFromAddress(hotelInfo.address)` (`jeju_city` | `jeju_outside` | `seogwipo_city` | `seogwipo_outside`). Used in generate payload and pricing (van/large van per-person by zone).
- **Join mode:** When `proposedTourToJoin` exists, `useEffect` computes `haversineDistanceKm`; if &gt; `CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM`, `joinDistanceError` is set and “Proceed to join” is disabled.

**Spec (§7.2):**  
Hotel search / hotel area: autocomplete, landmark chips, manual pin fallback if needed. Instant feedback: pickup area label, surcharge info, join availability hint.

**Planning (no code change here):**

| Aspect | Current | Target (plan) |
|--------|---------|----------------|
| Autocomplete | PlaceAutocompleteElement (Places API New) in modal | Keep; no legacy Autocomplete. Optional: landmark chips or manual pin fallback per spec. |
| Instant feedback | None on main form (only pricing in vehicle cards) | After hotel select: show **pickup area label** (human copy, e.g. City Core / Near-city), **surcharge info** (if any), **join availability hint** where applicable. Use simplified tiers per migration-plan §2.4 (no internal zone names). |
| Copy | Internal `HotelLocation`; pricing in vehicle cards | Externally: human-only copy (e.g. “Good match for your hotel,” “Additional pickup fee applies”). Do not expose `jeju_city` / `jeju_outside` etc. in UI. |

All logic that derives `hotelLocation` from address (`getHotelLocationFromAddress`), pricing constants, and join distance check must remain unchanged.

---

## 3. Summary panel behavior

**Current:**

- **Dashboard (form):** No dedicated “live summary” panel. Vehicle cards show per-person price and total by zone implicitly (van vs large van, `hotelLocation`-based pricing).
- **Checkout:** Sticky “booking summary” panel (right column desktop): tour date, departure time, guests, total price, “Proceed to payment” button. Plus 48h/proposal notices above.

**Spec (§7.2):**  
Live summary panel must show: destination, hotel area, date, guests, style tags, preferred type, surcharge preview, short deposit rule note.

**Planning (no code change here):**

| Aspect | Current | Target (plan) |
|--------|---------|---------------|
| During form (dashboard) | No live summary | Add optional **live summary panel** (sticky on desktop, below/above CTA on mobile): destination, hotel area (human label), date, guests, style/tour type if captured, surcharge preview, short deposit note. Data from existing state only; no new API. |
| Checkout | Booking summary (date, time, guests, total) | Keep; may restyle. Optionally add surcharge line, deposit rule note to align with spec. |
| Copy | Mixed i18n keys | Centralized copy (e.g. `src/design/copy.ts` or messages); deposit rule note from spec. |

Summary panel is presentation only: reads from existing `destination`, `hotelInfo`/`hotelLocation`, `tourDate`, `participants`, `customerInput` (style), vehicle choice; no change to when or what is submitted to APIs.

---

## 4. Loading screen stages and allowed copy

**Current:**

- **Generate overlay:** When `showGenerateOverlay` is true, full-screen overlay (fixed, z-9999, `bg-[#0d1a2e]`): RobotMascot animation, single line **“AI ANALYZING YOUR PREFERENCES...”** (hardcoded English). Shown after validation passes; then `setLoading(true)`, POST `/api/custom-join-tour/generate`; on success, store in localStorage, then after ~1800 ms redirect to `?open=itinerary` and `setShowGenerateOverlay(false)`.
- **Inline loading:** Buttons show `Loader2` + “로딩 중...” or i18n key for confirm/proceed during `handleConfirm`, `handlePropose`, `handleCheckoutSubmit`.

**Spec (§7.3) and migration-plan:**  
Goal: feel like a trip is being prepared. **Forbidden:** fake real-time matching claims, misleading loading language. **Allowed examples:** “Checking pickup flow near [Area]…”, “Finding the best route for your hotel area…”, “Looking for the best tour fit…”, “Almost there…”. **Visual:** clean light background, simple route/pickup/itinerary assembly, **max 3 stages**. **End:** “Your trip is ready”.

**Planning (no code change here):**

| Aspect | Current | Target (plan) |
|--------|---------|---------------|
| Stages | Single stage (“AI ANALYZING YOUR PREFERENCES...”) | Up to **3 distinct stages** (e.g. stage 1: checking pickup/area, stage 2: finding route/fit, stage 3: almost there). No fake “matching” if backend does not support it. |
| Copy | One hardcoded English string | Replace with **allowed copy only**: e.g. “Checking pickup flow near [Area]…”, “Finding the best route for your hotel area…”, “Looking for the best tour fit…”, “Almost there…”. End with “Your trip is ready”. Copy from centralized constants or i18n; support locale. |
| Visual | Dark theme, RobotMascot, scanline | Optionally align with spec: clean light background, simple route/pickup/itinerary assembly visual. |
| End state | Redirect to itinerary after delay | Keep redirect; end copy “Your trip is ready” before or as redirect happens. |

No change to when the overlay is shown or when the generate API is called; only stages, copy, and visual of the overlay.

---

## 5. Existing logic to preserve

Do not change in Step 13:

- **Generate API:** POST `/api/custom-join-tour/generate` — body: `customerInput`, `duration: '1'`, `numberOfParticipants`, `destination`, `hotelLocation`, `hotelAddress`, `hotelLat`, `hotelLng`, `placeLang`, `tourStartDate`. Response: `schedule`, `dailyDistancesKm`, `overLimitDays`, `extraFeeNotice`, `pricing`, `removedPlaces`. Handling of success (set schedule, pricing, guideMessage, localStorage, redirect) and error (setError) unchanged.
- **Confirm API:** POST `/api/custom-join-tour/confirm` — body: `schedule`, `numberOfParticipants`, `hotelLocation`. Response: `confirmResult` (guideMessage, jejuCrossRegion, pricing, etc.). Transition to `step === 'checkout'` unchanged.
- **Proposed API:** GET `/api/custom-join-tour/proposed?id=...` for join mode; POST for create (title, schedule, participants, vehicle_type, total_price_krw, hotel_*). No change to request/response or usage.
- **Join mode:** Fetch proposed by `joinId`; distance check with `CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM`; `proceedToJoinTour` (set schedule, confirmResult, participants, joinProposedId, setStep('checkout')). Unchanged.
- **Checkout flow:** 48h validation (`isTourDateAtLeast48h`), `validateCheckoutForm`, optional POST proposed then POST `/api/bookings` then POST `/api/stripe/checkout`, redirect to Stripe URL. Session prefill from Supabase unchanged.
- **Hotel location:** `getHotelLocationFromAddress(address)` and all pricing constants in `lib/constants/custom-join-tour.ts`. No change to how `hotelLocation` is computed or used in payloads.
- **HotelMapPicker:** Places API (New) only; no legacy Autocomplete. `onConfirm(HotelInfo)` contract and usage unchanged.
- **Step transitions:** Conditions under which `setStep('itinerary' | 'checkout' | 'confirmed')` is called; `?open=itinerary` and localStorage restore behavior.

---

## 6. Files to modify

| File | Change |
|------|--------|
| `app/custom-join-tour/page.tsx` | (1) Loading overlay: replace single-line copy with up to 3 stages and allowed copy from constants/i18n; optional visual restyle (light, simple assembly). (2) Optional: reorder form blocks to match spec (destination → hotel → date → group → style → type → notes). (3) Optional: add live summary panel (reads existing state; no new fetch). (4) After hotel select: optional instant feedback (pickup area label, surcharge, join hint) using existing `hotelLocation`. No change to API call sites, request bodies, or step logic. |
| `components/maps/HotelMapPicker.tsx` | Optional: restyle only; optional landmark chips or manual pin UX. Do not change Places API (New) usage or `onConfirm` contract. |
| New component(s) | Optional: extract loading overlay into a component (e.g. `BuilderLoadingOverlay`) with stages and copy props; extract summary panel (e.g. `BuilderSummaryPanel`) if added. |
| `src/design/copy.ts` or `messages/*` | Add builder loading copy: allowed stage messages (“Checking pickup flow…”, “Finding the best route…”, “Looking for the best tour fit…”, “Almost there…”, “Your trip is ready”). Add pickup area / surcharge human labels if used. |

No new or modified API routes. No changes to `app/custom-join-tour/proposed/page.tsx` unless only copy/restyle for its loading state.

---

## 7. Risk level per file

| File / area | Risk | Mitigation |
|-------------|------|------------|
| `app/custom-join-tour/page.tsx` | **Medium** | Single large file with all state and fetch logic. Change only overlay UI, copy, optional summary panel, and optional form order/feedback. Do not modify `handleGenerate`, `handleConfirm`, `handleCheckoutSubmit`, `handlePropose`, or effect dependencies that trigger API calls. |
| `components/maps/HotelMapPicker.tsx` | **Medium** | Contains Places API (New) and geocoding. Restyle and optional chips/pin only; keep `PlaceAutocompleteElement`, `onConfirm`, and `HotelInfo` shape. |
| New loading/summary components | **Low** | Presentational; receive state/callbacks from page. |
| `src/design/copy.ts` / i18n | **Low** | Additive keys; ensure keys used and fallbacks exist. |

---

## 8. What will not be touched

- **API routes:** `/api/custom-join-tour/generate`, `/api/custom-join-tour/confirm`, `/api/custom-join-tour/proposed` — request/response contracts and behavior unchanged.
- **Booking and payment:** POST `/api/bookings`, POST `/api/stripe/checkout`, redirect, sessionStorage/localStorage keys and shapes used for checkout/confirmation.
- **Auth/session:** Supabase session fetch, checkout prefill, or any auth-dependent logic.
- **Adapter logic:** No new adapters required for this step; no change to how generate/confirm/proposed responses are consumed (only UI that displays them).
- **Hotel location and pricing logic:** `getHotelLocationFromAddress`, `JEJU_CITY_DONGS`, pricing constants, `getCustomJoinTourPricing`, `haversineDistanceKm`, `CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM`.
- **Homepage:** No changes to homepage or locale homepage (Step 12 / locale parity out of scope).
- **Locale parity:** Not part of Step 13; documented as follow-up elsewhere.

---

## 9. Clarifications (pre–Step 14)

### 9.1 Implemented now vs deferred

| Item | Status | Notes |
|------|--------|--------|
| **Autocomplete** | **Implemented now** | PlaceAutocompleteElement (Places API New) is already used in HotelMapPicker; keep as-is. |
| **Landmark chip fallback** | **Deferred** | Optional per spec; not in scope for Step 14. May be added in a later step. |
| **Manual pin fallback** | **Deferred** | Map click → Geocoder exists; optional UX improvements (e.g. explicit “pin fallback” flow) deferred. |
| **Manual review flag if unresolved** | **Deferred** | No “manual review” or “unresolved” flag is implemented or planned for Step 14. Backend/API does not expose this; add only when backend supports it. |

### 9.2 Data source for pickup area, surcharge, and join hint

**Pickup area label, surcharge preview, and join availability hint** must come **only** from:

- **Existing state** (e.g. `hotelLocation`, `hotelInfo`, `destination`, `proposedTourToJoin`, `joinDistanceError`),
- **Existing backend results** (e.g. generate/confirm/proposed API responses already in use),
- **Existing validated logic** (e.g. `getHotelLocationFromAddress`, pricing constants, `haversineDistanceKm` / `CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM`).

**Do not add new client-side business logic.** No new computations, no new API calls, and no new derived flags for these three items. Step 14 is presentation only: display what is already computed and stored.

### 9.3 Loading copy fallback behavior

- **If area label is known** (e.g. `hotelLocation` or human label already derived from existing logic): area-specific copy may be shown (e.g. “Checking pickup flow near [Area]…”).
- **If area label is unknown** (e.g. hotel not yet selected or not resolvable): use **only generic allowed copy** (e.g. “Finding the best route for your hotel area…”, “Looking for the best tour fit…”, “Almost there…”). Do not invent or imply an area name.
- **Never imply** real-time matching, live availability, or backend stages that are not actually supported (e.g. no “Matching you with a tour…” if the backend does not do real-time matching). All loading copy must be from the allowed list and consistent with a single generate request.

---

*This document is planning only. No code changes are made in Step 13 planning. Step 14 implements the refactor per this plan and §9.*
