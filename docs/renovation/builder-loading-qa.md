# Builder / Loading QA (Step 14)

**Purpose:** Verification checklist and test notes for the builder and loading refactor implemented in Step 14.

**Reference:** `docs/renovation/builder-loading-refactor-plan.md`, `docs/renovation/final-product-spec.md` §7.2 (Tour Builder), §7.3 (Loading Page).

---

## 1. Implementation summary

| Area | Change |
|------|--------|
| **Loading overlay** | Replaced single hardcoded “AI ANALYZING…” with `BuilderLoadingOverlay`: up to 3 stages + “Your trip is ready,” copy from `COPY.builderLoading`. Area-specific stage 1 when `areaLabel` is known; generic only when unknown. Clean light background; no real-time matching claims. |
| **Form order** | Destination → **Hotel area** → Date → Language → Group size (guests) → Vehicle → Describe → Tags → Guarantee → Generate. Hotel block moved up immediately after destination (hotel-area-first). |
| **Instant feedback** | After hotel select: pickup area message (`COPY.pickupMatch.good`) and, when applicable, surcharge line (`COPY.surcharge.short`). Data from existing `hotelLocation` / `hotelInfo` only; no new logic. |
| **Live summary** | Mobile: summary block above Generate (destination, hotel area, date, guests, surcharge if any, deposit note). Desktop: sticky right panel with same fields. All from existing state; no new API or business logic. |
| **Copy** | Builder loading and pickup area labels in `src/design/copy.ts` (`builderLoading`, `builderPickupArea`, `builderSummary`). |

---

## 2. Requirements checklist

- [ ] **Preserve all working generation logic**  
  - Generate API: same POST body and success/error handling.  
  - Confirm, proposed, checkout flows unchanged.  
  - `getHotelLocationFromAddress`, pricing constants, join distance check unchanged.

- [ ] **Hotel-area-first UX**  
  - Hotel block is the first form section after destination.  
  - Instant feedback (pickup message, surcharge) appears after hotel select.  
  - Summary shows hotel area (human label) when set.

- [ ] **Realistic loading copy only**  
  - All overlay text from `COPY.builderLoading`.  
  - No “matching,” “finding availability,” or other unsupported backend behavior.  
  - If area known: “Checking pickup flow near [Area]…” allowed.  
  - If area unknown: generic copy only (“Finding the best route…”, “Looking for the best tour fit…”, “Almost there…”).

- [ ] **No unsupported backend matching behavior**  
  - Copy does not imply real-time matching or multi-stage backend.  
  - Single generate request; overlay reflects “trip being prepared” feel only.

- [ ] **Centralized copy/constants**  
  - Loading: `COPY.builderLoading`.  
  - Pickup area labels: `COPY.builderPickupArea`.  
  - Summary deposit note: `COPY.builderSummary.depositNote`.  
  - Surcharge: `COPY.surcharge.short`, `COPY.pickupMatch.good`.

- [ ] **Mobile-first layout**  
  - Form stacks in one column on small screens.  
  - Summary appears above Generate on mobile; sticky right on `lg`.  
  - Touch targets and spacing usable on small viewports.

---

## 3. Manual test steps

1. **Builder form order**  
   - Open `/custom-join-tour`.  
   - Confirm order: Destination (map/select) → Hotel location (button) → Date / Time → Language → Guests → Vehicle cards → Describe → Tags → Guarantee → Generate.

2. **Hotel instant feedback**  
   - Open hotel picker, select a Jeju address (e.g. city core).  
   - Confirm “Good pickup match” (and no surcharge line for city core).  
   - Select an address that yields surcharge (e.g. outside city).  
   - Confirm “Good pickup match · Pickup surcharge may apply.”

3. **Summary panel**  
   - Set destination, hotel, date, guests.  
   - On desktop (`lg`): confirm sticky right panel shows destination, hotel area (human label), date, guests, surcharge line if applicable, deposit note.  
   - On mobile: confirm summary block above Generate shows same info.

4. **Loading overlay**  
   - Fill required fields and click Generate.  
   - Confirm overlay appears with light background and staged copy (e.g. “Checking pickup flow near City Core…” or “Finding the best route…”).  
   - Confirm stages advance (no fake “matching” wording).  
   - On success, confirm “Your trip is ready” then redirect to itinerary.

5. **Generation and checkout unchanged**  
   - Complete generate → confirm itinerary → checkout (or proceed to join).  
   - Confirm no regression in API calls, validation, or payment flow.

---

## 4. Out of scope (deferred)

- Landmark chip fallback, manual pin fallback UX, manual review flag (per plan §9.1).  
- Checkout/payment/API contract or homepage changes.  
- New client-side business logic for pickup area, surcharge, or join hint (display only from existing state/backend/validated logic).

---

## 5. Files touched

| File | Role |
|------|------|
| `src/design/copy.ts` | `builderLoading`, `builderPickupArea`, `builderSummary` |
| `components/BuilderLoadingOverlay.tsx` | New: 3-stage loading overlay, allowed copy only |
| `app/custom-join-tour/page.tsx` | Overlay usage, form order, hotel block + feedback, summary panel, `generateSuccess` state |

No changes to: checkout, payment, API routes, homepage, HotelMapPicker contract or Places API usage.

---

## 6. Step 14 verification report (code-derived, browser-level)

Verification performed by inspecting the implemented code paths. Exact visible strings are from `COPY` and render logic.

### 6.1 Instant hotel feedback (after hotel selection)

**Rendered when:** `hotelInfo` is set (user has confirmed a hotel in HotelMapPicker).

| Item | Visible in UI? | Exact visible text |
|------|----------------|--------------------|
| **Pickup area label** | **No.** The human area name (e.g. "City Core", "Near-city") is **not** shown in the instant feedback block. | — |
| **Pickup match message** | Yes | `"Good pickup match"` (`COPY.pickupMatch.good`) |
| **Surcharge text** | Yes, only when `hotelLocation !== 'jeju_city'` | `"Pickup surcharge may apply"` (`COPY.surcharge.short`), shown after " · " on the same line as "Good pickup match". |
| **Join availability hint** | **No.** | Not rendered in the main builder form. Join mode has its own card with `joinDistanceError`; the create flow does not show a join availability hint after hotel select. |

**Summary:** Instant feedback shows only "Good pickup match" and, when applicable, " · Pickup surcharge may apply". The pickup area label (e.g. "City Core") is not displayed in this block; it appears only in the live summary panel.

---

### 6.2 Live summary — visible fields and order

**Mobile** (`lg:hidden` block above Generate button):

| Order | Visible element | Source |
|-------|-----------------|--------|
| 1 | Heading | `"Summary"` |
| 2 | Single line of values | `{destination} · {hotel area value if hotelInfo} · {tourDate} · {participants} guests` (e.g. "Jeju · City Core · 2025-04-01 · 5 guests"). No separate field labels on this line. |
| 3 | Optional line | `"Pickup surcharge may apply"` when `hotelLocation !== 'jeju_city'` and hotel set |
| 4 | Deposit note | `"20% deposit to reserve · Balance due 24h before departure"` |

**Desktop** (sticky aside, `hidden lg:block`):

| Order | Visible label / text | Value / note |
|-------|----------------------|--------------|
| 1 | Heading | `"Summary"` |
| 2 | `"Destination"` | Busan / Seoul / Jeju |
| 3 | `"Hotel area"` | `COPY.builderPickupArea[hotelLocation]` (e.g. "City Core", "Near-city") or "—" if no hotel |
| 4 | `"Date"` | `tourDate` or "—" |
| 5 | `"Guests"` | `participants` number |
| 6 | (optional) | `"Pickup surcharge may apply"` when surcharge applies |
| 7 | (paragraph) | `"20% deposit to reserve · Balance due 24h before departure"` |

**Not in summary (spec §7.2):** style tags, preferred type. Current builder captures describe text and vehicle (van/large van) but does not show "style tags" or "preferred type" in the summary panel.

---

### 6.3 Loading overlay — exact copy by case

**With known area label** (`areaLabel` passed, e.g. "City Core", "Near-city", "Seogwipo area", "Outer"):

| Stage | Exact visible copy |
|-------|--------------------|
| Stage 1 (0–1.5s) | `"Checking pickup flow near [Area]…"` with `[Area]` replaced by the label (e.g. `"Checking pickup flow near City Core…"`) |
| Stage 2 (1.5–3s) | `"Looking for the best tour fit…"` |
| Stage 3 (3s+) | `"Almost there…"` |
| End (on success) | `"Your trip is ready"` |

**Without area label** (`areaLabel` null or empty, e.g. hotel not selected — in practice overlay is only shown when validation passed so hotel is set; this path is for consistency):

| Stage | Exact visible copy |
|-------|--------------------|
| Stage 1 | `"Finding the best route for your hotel area…"` |
| Stage 2 | `"Looking for the best tour fit…"` |
| Stage 3 | `"Almost there…"` |
| End (on success) | `"Your trip is ready"` |

---

### 6.4 Generate flow and next state

- **API:** POST `/api/custom-join-tour/generate` with body unchanged: `customerInput`, `duration: '1'`, `numberOfParticipants`, `destination`, `hotelLocation`, `hotelAddress`, `hotelLat`, `hotelLng`, `placeLang`, `tourStartDate` (when set). No API body changes in Step 14.
- **On success:** Schedule (and related state) set from response; `setGenerateSuccess(true)`; overlay shows "Your trip is ready"; after 1800 ms: `router.push(\`${pathname}?open=itinerary\`)`, `setShowGenerateOverlay(false)`, `setGenerateSuccess(false)`. Same next state/route as before (itinerary view with `?open=itinerary`).
- **Checkout / payment:** `handleCheckoutSubmit` and calls to POST `/api/bookings`, POST `/api/stripe/checkout`, and redirect logic were not modified. No checkout or payment logic changes in Step 14.

---

## 7. Mismatches vs spec (final-product-spec §7.2)

| Spec requirement | Current implementation | Mismatch? |
|------------------|------------------------|-----------|
| Instant feedback: **pickup area label** | Human area label (e.g. "City Core") is **not** shown in the instant feedback block; only "Good pickup match" and surcharge are shown. Area label appears in the **summary panel** only. | **Yes** — pickup area label is not clearly visible in instant feedback. |
| Instant feedback: **surcharge info** | Shown when applicable: "Pickup surcharge may apply". | No. |
| Instant feedback: **join availability hint** | **Not shown** in the create flow. Join mode shows distance error only. | **Yes** — join availability hint is not present in builder create flow. |
| Live summary: **style tags** | Not displayed in summary. | **Yes** — summary does not include style tags. |
| Live summary: **preferred type** | Not displayed in summary (vehicle / private vs join is not summarized). | **Yes** — summary does not include preferred type. |
| Builder steps | Spec: Destination, Hotel, Date, Group size, Travel style, Preferred tour type, Optional notes. Current: Destination, Hotel, Date, Language, Guests, Vehicle (van/large van), Describe, Tags, Guarantee, Generate. | **Spec-mapped, not fully replaced** — order and hotel-first alignment done; "Travel style" / "Preferred tour type" are represented by describe + vehicle + tags rather than separate spec-named steps. |

**Summary of mismatches to fix later (do not block Step 15):**

1. **Join hint:** Not present in create flow; spec calls for "join availability hint" in instant feedback.
2. **Pickup area label in instant feedback:** Not clearly visible there; only in summary. Spec expects it in instant feedback.
3. **Builder fields:** Current form is spec-mapped (destination → hotel → date → group → style/type/notes) but not fully replaced (e.g. no dedicated "Preferred tour type" step; vehicle + describe + tags cover it).
4. **Summary:** Missing style tags and preferred type in the live summary panel.
