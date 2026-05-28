# Custom Itinerary Builder — Master Planner

> **⚠️ READER NOTE (2026-05-29):** Phase 10 (flow simplification +
> card-hold booking) deleted the entire Phase 4/5 quote pipe described in
> §F Phases 4-5 below. The historical instructions in those sections
> (e.g., POST /api/itinerary/quote → tour_quote_requests → Slack →
> /admin/itinerary-quotes → /itinerary-builder/thanks) are **retained
> for archaeology only** — those routes no longer exist on `main`.
>
> For the current booking flow, see the spin-off planner:
> [docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md](./itinerary-builder-flow-simplification-master-plan-2026-05-28.md)
>
> Live route map (after Phase 10):
> - `POST /api/itinerary/book` (replaces /quote)
> - `/itinerary-builder?region=…` (single planner route)
> - `/itinerary-builder/checkout?bookingId=…` (Stripe card hold)
> - `/itinerary-builder/confirmation/[bookingId]` (replaces /thanks)
> - Admin: `/admin/orders?source=itinerary_builder` (replaces /admin/itinerary-quotes)

> **Single source of truth** for the map + POI + AI-itinerary feature.
> This is a living document: status, decisions, change log, and the
> 6-phase plan all live here. The `/itinerary-builder` skill is wired
> to load this first before any work in this feature area.
>
> **Anyone (Claude or human) starting work on this feature MUST read
> this whole doc, find the current phase, and either advance it or
> update §A (status) and §B (decisions) before deviating.**

---

## A · Status dashboard

| Field | Value |
|---|---|
| **Current phase** | Phase 10 — Flow simplification + card-hold booking 🔄 (branch `feat/itinerary-builder-flow-simplification`, worktree `C:/Users/sangsong/atockorea-flow-simp`, off `origin/main` `46b529d0`). Phase 8 admin-tooling continues on `feat/admin-match-pois-editor`; Phase 9 pricing track is code-complete (interactive QA pending). |
| **Blocked on** | — (Phase 9 interactive QA is a separate track; Phase 10 only consumes the pricing module) |
| **Last updated** | 2026-05-29 |
| **Last commit touching this feature** | `bac9a5fc` — feat(builder): Phase 10.5c destructive · quote pipe deleted (-1,290 LOC) + INSERT trigger blocks writes to tour_quote_requests/quote_memory/quote_presets. Phase 5 (A+B+C) complete: card-hold booking flow live, ops email-handshake gone, net -230 LOC. |
| **Owner** | simsangsong |
| **Reviewers** | — |
| **Branch** | `feat/itinerary-builder-flow-simplification` (Phase 10, off `origin/main`). Other in-flight tracks: `feat/admin-match-pois-editor` (Phase 8), `feat/itinerary-builder-pricing` (Phase 9 QA), `fix/itinerary-builder-poi-data-quality` (data-quality). |

### Phase progress

Revised 2026-05-16 after D1-D8: original 6 phases → 7 phases (new Phase 5 for auto-quote engine; Phase 3 absorbs /tours restructure + home v2 entry; Phase 4 absorbs Q&A intake with cruise/private branch).

| Phase | Status | Started | Done | Commit hash(es) |
|---|---|---|---|---|
| 0 — Audit & plan | ✅ complete | 2026-05-16 | 2026-05-16 | `a732e63f` |
| 1 — POI catalog seed (jeju + busan) | ✅ complete | 2026-05-17 | 2026-05-17 | `98bb99ef` |
| 2 — Coordinate enrichment | ✅ complete | 2026-05-17 | 2026-05-17 | `e84d15ba` |
| 3 — Map UI read-only + `/tours` restructure + home v2 entry section | ✅ complete | 2026-05-17 | 2026-05-17 | `2205e28f` · `27e58481` · `21559eb3` · `228f2073` |
| 4 — Q&A intake (private / cruise branch) + cart + manual quote form | ✅ complete | 2026-05-17 | 2026-05-17 | `32817ace` · `e9f81bec` · `329a9ab6` · `517b3192` · `943aa17a` · `9be440f4` · `08f12a6f` · `b4693a8e` |
| 5 — Auto-quote engine + admin presets + Slack escalation + quote memory | ✅ complete | 2026-05-17 | 2026-05-17 | `2d364359` · `4dc70106` |
| 6 — POI matching_profile authoring | ✅ complete | 2026-05-17 | 2026-05-17 | `02dcde58` |
| 7 — AI recommendation engine | ✅ complete | 2026-05-17 | 2026-05-17 | `7aa60f0a` |
| 8 — Admin `match_pois` editor (tooling track) | 🔄 in progress | 2026-05-21 | — | (planner commit first) |
| 9 — Pricing policy overhaul (pricing track) | 🔄 code-complete, interactive QA pending | 2026-05-22 | — | `c0aa783f` · `3f21ef16` · `25e25744` · `634e287e` · `f89845e1` · `7931d0f9` |
| 10 — Flow simplification + card-hold booking (flow track) | 🔄 in progress | 2026-05-29 | — | (planner commit first) |

Legend: ⏸ not started · 🔄 in progress · ✅ complete · ⚠️ blocked · ❌ abandoned

> **Phase 8 is an admin-tooling track**, not a continuation of the user-facing MVP. It promotes the §E parked idea "/admin/pois browse + edit UI" (D10). It does not block or depend on the two spun-off planners (UI/UX upgrade, V2 redesign) or the POI-data-quality branch.

> **Phase 10 is a flow-simplification + booking-model track** spun off via `docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md` (D16-D26). It deletes the vestigial quote pipe (Phase 4/5 leftover after Phase 9 made it obsolete) and wires builder bookings to the standard `bookings` + Stripe card-hold infrastructure. Independent of Phase 8/9/V2 redesign — the only shared surface is the `lib/quote-engine/pricing-policy.ts` module which it consumes unchanged.

---

## B · Decision log

Append a new row whenever a §5 question gets answered or a new architectural call is made. Never silently change a decision — always log here with date + reason.

| Date | Decision ID | Decision | Reason / context |
|---|---|---|---|
| 2026-05-16 | — | Audit complete; Google Maps confirmed as map vendor (already integrated) | `@react-google-maps/api 2.20.7` + env key already in place — switching cost zero |
| 2026-05-16 | — | Map ID created with **vector** rendering, tilt OFF, rotation OFF | Premium feel, GPU-accelerated cluster perf, top-down clarity for planning UX; mobile gesture safety (§G.2) |
| 2026-05-16 | — | New env var `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (Vercel: Production + Preview + Development) | Map ID is not a secret; security enforced by API-key HTTP referrer restrictions |
| 2026-05-16 | D1 | **jeju + busan** (2 regions for MVP); seoul deferred | Focuses MVP on highest-tourism regions; seoul DMZ/suburbs complexity deferred to post-MVP |
| 2026-05-16 | D3 | **Extend** `match_pois` (add `lat`, `lng`, `matching_profile`, `default_stay_minutes`, `category` cols) — no new tables for POI catalog | Single source of truth; simpler schema; reuses existing `poi_key` indexing |
| 2026-05-16 | D4 | **Auto-quote engine** — admin pre-configures base conditions via Q&A; user intent within scope → auto-quote computed; intent outside scope → Slack escalation to ops; manual quotes saved and reused as precedent for future same-condition requests | **Revises original "email+Slack+DB row" simple model.** Significantly larger scope — promoted to dedicated Phase 5 (was a sub-task of old Phase 4). |
| 2026-05-16 | D5 | **No auth**; URL params carry cart state (share-able links) | Confirmed recommendation |
| 2026-05-16 | D6 | i18n strategy: author **EN messages first**; auto-translate pipeline produces `ko / ja / zh / zh-TW / es` | Reduces Phase 3 i18n authoring cost; human review pass before locale release (see §H R8) |
| 2026-05-16 | D7 | Entry points: (a) new **home v2 section** linking to builder; (b) restructure `/tours` — **remove busan/seoul/jeju private-tour static pages**, keep only shore excursions (with match CTA inside); (c) add "Want a private tour?" **CTA card on top of `/tours`** linking to Q&A intake | Single canonical path to the builder; legacy 5 private-tour static pages superseded. Retirement strategy: 301 redirects to `/itinerary-builder/<region>` to preserve SEO (see §H R7). |
| 2026-05-16 | D8 | Q&A intake has **two branches**: (i) **private-tour track** = land itinerary builder (our main flow), (ii) **cruise track** = shore excursion sequencer with shorter time window (back-to-ship constraint). Branched at first form question | Cruise has a distinct price model + hard time constraint; separate pricing presets in Phase 5 |
| 2026-05-17 | D9 | **Defer 301 redirects from 6 legacy private-tour `/tour-product/<slug>` pages → `/itinerary-builder`** until Phase 4 ships (cart + manual quote ready). Phase 3 only removes the "Private & Charter" section from `/tours` hub navigation. Legacy product pages stay accessible at their canonical URLs (still bookable). | Redirecting now would leave users stranded — the builder has no booking/quote flow yet. Affected slugs: `busan-private-car-charter-cruise-shore`, `jeju-island-private-car-charter-tour`, `incheon-seoul-private-car-shore-excursion-cruise`, `seoul-dmz-private-3rd-tunnel-suspension-bridge`, `seoul-private-nami-morning-calm-petite-france`, `seoul-suburbs-private-chartered-car-10hr`. The two cruise-overlap slugs (busan + incheon-seoul) remain visible under `/tours` "Cruise Shore Excursions" section per user request "쇼어 익스커션만 남기되". |
| 2026-05-21 | D10 | **Promote §E parked idea "/admin/pois browse + edit UI" → Phase 8 (Admin `match_pois` editor).** Build a list+editor admin surface at `/admin/match-pois` mirroring `/admin/products/v2` (상품편집), backed by an **auto-upsert** `PATCH /api/admin/match-pois/[poi_key]` (differs from the product API, which is update-only) so a new `poi_key` INSERTs and an existing one UPDATEs. Editable column whitelist excludes generated/DB-managed cols (`is_operational`, `created_at`, `updated_at`, `embedding`). | User requested 2026-05-21. Ops needs to tune the POI catalog (images, structured content, matching profiles) without hand-writing SQL. Self-contained enough to live as a phase in this planner rather than a spun-off doc. New fresh branch `feat/admin-match-pois-editor` off `main`. |
| 2026-05-21 | D11 | **Code-reality drift handled (verified on `main` 2026-05-21):** (a) `match_pois.highlights` + `match_pois.images` are **jsonb arrays**, NOT `text[]` as the original brief assumed — editor treats them as string arrays, stores as jsonb. (b) `poi_meta` is **`jsonb NOT NULL` with no default** — the upsert defaults it to `{}` on a brand-new INSERT so the NOT-NULL constraint can't fail. (c) `lib/itinerary-builder/poi-image-overrides.mjs` + `scripts/audit-itinerary-builder-pois.ts` + `npm run itinerary:poi-audit` **do NOT exist on `main`** (they live on `fix/itinerary-builder-poi-data-quality`). The "override-pinned" indicator is therefore implemented **defensively** (reads the override map only if the file is present; no-op + no build break when absent; auto-activates once the dq branch merges). The `itinerary:poi-audit` acceptance step is substituted with an inline SQL data-quality self-check on this branch. | The brief's "respect the data-quality track" guardrails referenced files not on the base branch; verifying code reality (per the brief's own instruction) surfaced this. Do NOT pull dq-branch files into this branch — keep tracks independent. |
| 2026-05-22 | D12 | **Reverse D1's Seoul deferral — Seoul region + DMZ are now in builder scope.** User 2026-05-22 chose "Seoul·DMZ도 구현" when applying the new pricing policy. Seoul POI data already exists (seoul 6 / gyeonggi 16 / gangwon 6 from Phase 2). DMZ added as a fixed-price product. | The pricing policy doc covers Seoul (Gyeonggi/Gangwon surcharges) + DMZ; pricing them without rendering them would be half a feature. D1 (jeju+busan MVP) is superseded for the pricing track. |
| 2026-05-22 | D13 | **New pricing model replaces the Phase 5 placeholder.** Axis = **guide-language tier × duration bucket** base table + pax-tier surcharge + region surcharge (was: (region,track) base + continuous per-hour/per-km/per-poi + language premium). Language tiers (user 2026-05-22): `english`={en,ja,es}, `chinese`={zh,zh-TW,ko}, `smart_guide`=hidden AI-assisted tier with a **Korean-speaking** guide (user corrected the doc's "Chinese guide"), priced chinese+₩20k. Duration is **customer-chosen** (4-12h), decoupled from cart drive+stay (now a hint). Per-km/per-poi pricing **removed**. 14+ pax (non-DMZ) → manual escalation. New copy is **transcreated** (native tone first, not literal) into all 6 locales. | Matches the real AtoC private-tour pricing in `pricing_update_instructions.md`. Phase 5's continuous model was a placeholder seeded from a 2026-05-17 chat. |
| 2026-05-22 | D14 | **Pricing source of truth moves from DB `quote_presets` → TS `lib/quote-engine/pricing-policy.ts`** (imported by BOTH client and server). | The new model is too complex for safe Studio JSON editing, and the user's "real-time price in the builder" decision requires the pricing data in-bundle client-side. One module = no client/server drift. Ops price changes go through PR+deploy; an `PRICING_AUTOQUOTE_ENABLED` env kill-switch preserves the R6 emergency-disable capability without a deploy. `quote_presets` table is left in place but no longer read by the new flow. |
| 2026-05-22 | D15 | **Cruise shore-excursion surcharges.** Cruise track adds a flat **+₩40,000** on top of the day rate (reuses the language×duration base); Jeju cruise embarking at **Gangjeong Port (강정항, Seogwipo terminal)** adds **+₩70,000** more. Hotel pickup-zone surcharge is suppressed for cruise (pickup = the port, not a hotel). New cruise-port selector on Jeju cruise defaults to Gangjeong (the primary international terminal); Busan/Seoul cruise never gets the Gangjeong add. | User 2026-05-22. Encodes the cruise-vs-land cost delta + the extra drive distance from the Seogwipo cruise terminal. Constants `CRUISE_EXCURSION_SURCHARGE` / `GANGJEONG_PORT_SURCHARGE` in `pricing-policy.ts`. |
| 2026-05-29 | D16 | **`bookings.currency` column added; builder bookings store KRW `final_price`; `/api/stripe/checkout` + webhook branch on currency.** | Avoids FX risk and KRW→USD round-trip loss. Stripe supports KRW natively (zero-decimal). User-facing prices stay in the currency the tour actually costs. Phase 10 D1. |
| 2026-05-29 | D17 | **`bookings.itinerary jsonb` column** stores `{poi_keys, region, track, duration_hours, guide_language, jeju_pickup_zone, cruise_port, breakdown}` for builder rows. | Mirrors the existing `auto_quote_breakdown` shape. One column vs 8 sparse columns most tour rows wouldn't use. Phase 10 D2. |
| 2026-05-29 | D18 | **`tour_quote_requests` + `quote_presets` + `quote_memory` writes BLOCKED immediately** (INSERT trigger in cut-over migration). Tables retained 90 days for audit, then dropped. | The pricing table (Phase 9) makes the manual-quote path vestigial; production DB shows zero manual responses in history. Keeping the pipe creates the "10 proposals = 하루 다 가" ops pain. Phase 10 D3. |
| 2026-05-29 | D19 | **Out-of-scope (14+ pax non-DMZ, >28 pax DMZ) = hard UI gate + mailto, NO DB row, NO email pipe.** | Real frequency is near-zero (1 quote total in DB history). Building a workflow for that traffic is the exact trap that created Phase 4/5's vestigial pipe. If volume ever materializes, promote to a phase. Phase 10 D4. |
| 2026-05-29 | D20 | **AI recommendation auto-runs on planner mount** when pricing inputs (`intent`/`region`/`duration`) are present; 500 ms debounce; 3-fires-per-session cap. | Removes the "Take this itinerary" extra click — the user's primary complaint. Cost-bounded by the session cap. Phase 10 D5. |
| 2026-05-29 | D21 | **`/itinerary-builder` is the single planner route**; `/itinerary-builder/[region]` 308-redirects (via `next.config.js`) to `?region=…`. | Removes one navigation step. Existing home entry sections (`itinerary-builder-entry.tsx`, `landing-planner-card.tsx`) already pass `?region=` — no changes needed. Phase 10 D8. |
| 2026-05-29 | D22 | **`/admin/itinerary-quotes` (page + API + sidebar entry) removed immediately** in the Phase 10 cut-over commit. Ops uses `/admin/orders` with a `source` filter. | Per D18 there are no new manual quotes to respond to. A dead sidebar entry creates ambiguity ("should I be checking this?"). Phase 10 D6. |
| 2026-05-29 | D23 | **`NoShowHoldCardForm` generalized** to accept `currency: 'usd'\|'krw'` + `amountMinor` (integer minor units; cents for USD, whole KRW for KRW). `amountUsdCents` retained as a deprecated alias for one PR cycle; tour-product callers updated explicitly in the same commit. | Builder KRW bookings can't reuse a USD-cents-only component; forking duplicates the Stripe Elements integration. Generalization is ~30 LOC + a snapshot test per currency. Phase 10 D9. |
| 2026-05-29 | D24 | **Booking handoff = URL-only `?bookingId=…`** for the builder (vs. tour-product's `sessionStorage` pattern). | Preserves D5 share-able-link discipline + survives refresh + works for any future email-delivery path (e.g., resend checkout link). Cost: one server-side fetch of the booking on checkout page mount. Phase 10 D10. |
| 2026-05-29 | D25 | **Builder `bookings` row writes `unit_price = total_price = final_price`** (flat-rate KRW). | Builder pricing is per-tour (Solati ₩340k for 1 pax or for 13 pax). A per-person fiction (`final / guests`) would corrupt BI. Smallest schema lie that's still useful for reports that join on `unit_price`. Phase 10 D11. |
| 2026-05-29 | D26 | **`bookings.merchant_id = process.env.ATOC_DEFAULT_MERCHANT_ID \|\| null`** for builder rows. Verified during Phase 2 task 2e against `/api/admin/orders/[id]/settle`. | Builder has no parent tour to inherit `merchant_id` from. Env-sentinel keeps it tunable without redeploy if AtoC ever wants to route builder revenue to a different merchant. Phase 10 D12. |

---

## C · Change log

One line per material change to this doc or per phase deliverable.

| Date | Commit | Change |
|---|---|---|
| 2026-05-16 | `a732e63f` | Initial audit + plan written (Phase 0) |
| 2026-05-16 | `e7666abf` | Google Maps API key + vector Map ID setup completed externally; §B decisions D1–D8 logged; §F revised from 6 → 7 phases (new Phase 5 = auto-quote engine; old Phases 5/6 renumbered to 6/7; Phase 3 expanded to include `/tours` restructure + home v2 entry; Phase 4 expanded to include Q&A intake with private/cruise branching) |
| 2026-05-17 | `98bb99ef` | Phase 1 — POI catalog seed complete. Migration `20260517120000_add_match_pois_geo_and_profile.sql` applied (adds lat/lng/matching_profile/default_stay_minutes/category/names_other_locales + region+stop_role indexes). Seed script `scripts/seed-match-pois-from-tour-jsons.mjs` walked 36 tour dirs / 204 locale files and upserted **82 unique attraction POIs**. Verification: 82 rows with name_en, **49 in busan+jeju** (≥40 acceptance ✓), 0 missing region, 0 operational rows (is_operational is generated column = poi_key LIKE 'OPS_%'). 6-locale names populated; 64/82 have default_image_url, 74/82 have parseable default_stay_minutes. Original audit-derived threshold of "≥100" was based on raw audit count of 102 that included operational keys; filtered attraction count is 82 — acceptance threshold updated to reflect reality. |
| 2026-05-17 | (Phase 3 start) | Phase 3 started — implementation plan: (a) audit current `/tours` and 5 legacy private-tour routes; (b) install `@googlemaps/markerclusterer` if not present; (c) build `/itinerary-builder` landing + `/itinerary-builder/[region]` SSR shell with cluster filter (busan-cluster vs jeju); (d) `<POICatalogMap />` client with vector Map ID + AdvancedMarker + clusterer + InfoWindow; (e) EN messages under `itineraryBuilder.*`; (f) i18n auto-translate pipeline TBD; (g) `/tours` restructure with private-tour CTA card + 301 redirects; (h) new home v2 entry section; (i) responsive + Lighthouse check. Will land in 5–8 small commits with visual review checkpoints. |
| 2026-05-17 | (Phase 4 start) | Phase 4 started — implementation plan: (4a) cart URL state + Add button + side panel/bottom sheet; (4b) `@dnd-kit/core` reorder + polyline overlay + Haversine drive estimate + cruise time budget; (4c) Q&A intake form (private/cruise branch) replacing landing; (4d) migration `tour_quote_requests` + `POST /api/itinerary/quote` + `lib/slack/notify-quote.ts` + email via `lib/email.ts`; (4e) quote form modal + success page + i18n; (4f) end-to-end test + planner close. Land in 6 small commits. |
| 2026-05-17 | `4dc70106` | Phase 5 complete. **Auto-quote engine** layered onto `POST /api/itinerary/quote`. Migration `20260517140000_create_quote_presets_and_memory.sql` creates `quote_presets` (per-(region,track) pricing knobs + `in_scope_rules`), `quote_memory` (precedent log keyed by `condition_fingerprint`), and extends `tour_quote_requests` with `auto_quote_amount_krw`/`auto_quote_breakdown`/`precedent_quote_id`. **4 preset rows seeded** (busan/jeju × private/cruise) with default KRW values from chat 2026-05-17 (base 180/220/220/260k, +35k/h beyond 8h, +1.5k/km beyond 250km, +20k per stop beyond 4, language premium en/ko 0 / ja-zh-zhTW 50k / es 80k; in-scope max_pax 12, max_hours 12/10, max_distance 600/400km) — user-editable in Studio. **Engine modules**: `lib/quote-engine/{types,classify,compute,fingerprint,memory-lookup,load-preset}.ts`, all pure & unit-testable. **API pipeline**: validate → fetch POI coords → compute drive+stay minutes + distance → loadActivePreset → classify → in-scope: computeQuote (status=auto_quoted, price emailed instantly with breakdown card), out-of-scope: lookupPrecedent → status=pending_manual + Slack escalation with violations + precedent reference (R9 mitigation: confidence band + sample size shown so ops doesn't auto-apply). **Thanks page** renders gradient price card with breakdown table for auto-quoted, pending message otherwise. **Admin response surface**: `/admin/itinerary-quotes` list + `/[id]` detail showing request + stops + precedent, `<AdminQuoteRespondForm />` POSTs to `/api/admin/itinerary-quotes/[id]/respond` which writes `quote_memory` precedent + updates status='responded' + emails customer the manual price. Build green. |
| 2026-05-17 | (Phase 5 start) | Phase 5 started — implementation plan: (5a) migration `quote_presets` + `quote_memory` + extend `tour_quote_requests` with `auto_quote_amount_krw`/`auto_quote_breakdown`/`precedent_quote_id`; (5b) seed `quote_presets` (4 rows: busan/jeju × private/cruise) with default KRW values proposed in chat 2026-05-17 — user-tunable in Supabase Studio post-MVP; (5c) `lib/quote-engine/classify.ts` (in-scope vs out-of-scope check against preset `in_scope_rules`); (5d) `lib/quote-engine/compute.ts` (pure total_krw + breakdown jsonb); (5e) `lib/quote-engine/fingerprint.ts` (stable hash for memory lookup); (5f) `lib/quote-engine/memory-lookup.ts` (precedent fetch + similarity scoring); (5g) `POST /api/itinerary/quote` rewires: in-scope → `auto_quoted` + price emailed instantly, out-of-scope → `pending_manual` + Slack escalation with precedent reference; (5h) QuoteModal + thanks page render auto-quote price card or pending message based on response status; (5i) `/admin/quotes/[id]` admin response surface writes `quote_memory`; (5j) 5-locale translate batch for new strings; (5k) `npm run build` + planner close. Land in 5-8 small commits per Phase 4 cadence. |
| 2026-05-17 | `c2b4b589` | Phase 4 follow-up — UX fix. User reported clicking Busan card on home dropped them on bare map. Two issues fixed: (1) home `<ItineraryBuilderEntry />` cards now link to `/itinerary-builder?region=<slug>` (intake form first per D7), not direct to `/itinerary-builder/<slug>`. (2) IntakeForm pre-selects radio inputs from `?region=` / `?track=` URL params. (3) Legacy `/busan` + `/jeju` page stubs replaced with 308 permanent redirects to `/itinerary-builder?region=...` in `next.config.js`. |
| 2026-05-17 | `b4693a8e` | Phase 4f — Build hardening. `npm run build` caught a missing `ChevronUp` import in `CartPanel.tsx` from the Phase 4b edit (added dnd-kit + GripVertical imports, removed the chevron import that the mobile-sheet handle still used). One-line restore. Production build now green: 24+ static + dynamic routes compiled, `/itinerary-builder`, `/itinerary-builder/[region]`, `/itinerary-builder/thanks` all listed in the route manifest. |
| 2026-05-17 | `08f12a6f` | Phase 4f — 5-locale translation pass (intake + cart + quote namespaces). Gemini 2.5 Flash. KO/JA/ZH/zh-TW/ES populated for all itineraryBuilder.* keys including new intake.* (trackLegend, regionLegend, cruiseHoursLegend...), cart.driveTotal/totalDuration/cruiseBudget/cruiseOverBudget, quote.* (title, intro, field labels, submit/submitting, errors). |
| 2026-05-17 | `9be440f4` | Phase 4e — Quote modal + thanks page + BuilderShell wiring. `<QuoteModal />` bottom-sheet/center modal prefills from URL intake params (date, party, lang, hours, ship). Submits `POST /api/itinerary/quote`, redirects to `/itinerary-builder/thanks?quote_id=...` on success. `BuilderShell` flips `getQuoteEnabled` to true and shows the modal. Server `thanks/page.tsx` renders quote_id as reference + two CTAs. |
| 2026-05-17 | `943aa17a` | Phase 4d — Quote API + DB + Slack + email. Migration `20260517130000_create_tour_quote_requests.sql` creates the table (poi_keys text[], region/track, optional date/party/contact/language/notes/locale, intake jsonb, status enum, manual_quote_* columns, updated_at trigger, RLS no-public-access). `lib/slack/notify-quote.ts` formats a numbered Slack message via SLACK_QUOTE_WEBHOOK_URL. `lib/email-templates/quote-confirmation.ts` builds an HTML confirmation. `POST /api/itinerary/quote` validates, inserts (service-role), fires Slack + Resend (fire-and-forget), returns `{ok, quote_id, status, poi_count}`. |
| 2026-05-17 | `517b3192` | Phase 4c — Q&A intake form. `app/itinerary-builder/page.tsx` rewritten as a server shell hosting `<IntakeForm />`. Track toggle (private/cruise), region pair, conditional cruise-hours chips + ship name, optional date + party. Submit pushes URL params to `/itinerary-builder/[region]`. |
| 2026-05-17 | `329a9ab6` | Phase 4b — dnd-kit Sortable reorder in CartPanel + dashed Polyline overlay on the map following cart order + Haversine drive estimate (`lib/itinerary-builder/distance.ts`: haversineKm × 1.3 road factor × 50 km/h average). CartPanel footer shows stay total / drive total / total day / cruise budget; over-budget renders a red warning. |
| 2026-05-17 | `e9f81bec` | Phase 4a — Cart URL state + Add/Remove + cart panel UI. New `useCart()` hook in `lib/itinerary-builder/cart.ts` reads/writes `?pois=key1,key2,...` via `useSearchParams` + `router.replace({ scroll: false })`. New `<BuilderShell />` client parent owns cart state and composes `<POICatalogMap />` (left, flex-1) + `<CartPanel />` (right side panel 360px on md+, floating bottom-sheet on mobile). POI InfoWindow Add button now enabled — toggles to red "Remove from itinerary" outline when poi is already in cart. CartPanel shows ordered list with stay-minute hints, total visit-time footer, and a "Get a custom quote" CTA (button reachable but disabled until Phase 4d wires the modal). New i18n keys `itineraryBuilder.cart.*` and `itineraryBuilder.map.removeFromItinerary` authored EN; 5-locale translate run deferred to Phase 4f batch. SSR verified — all routes 200, no regressions. |
| 2026-05-17 | `228f2073` | Phase 3d — i18n auto-translate pipeline complete. `scripts/translate-itinerary-builder-messages.mjs` extended with Gemini 2.5 Flash provider fallback (prefers ANTHROPIC_API_KEY when set; falls back to GEMINI_API_KEY). The user's ANTHROPIC_API_KEY was placeholder-empty so the run used Gemini; result quality verified by KO + JA spot-checks (natural marketing tone, all proper nouns + placeholders preserved). All 5 target locales (ko, ja, zh, zh-TW, es) now have the `itineraryBuilder` namespace populated. Script is idempotent — re-running replaces only the itineraryBuilder namespace. |
| 2026-05-17 | `21559eb3` | Phase 3c — i18n EN-first refactor. 3 client components (`ItineraryBuilderEntry`, `POIInfoWindowContent`, `POICatalogMap`) converted to `useTranslations("itineraryBuilder.*")`. EN namespace authored in `messages/en.json` with `home.*` and `map.*` sub-namespaces. SSR verified — no raw key leaks, all routes 200. |
| 2026-05-17 | `27e58481` | Phase 3b — `/tours` restructure + home v2 entry. **`/tours`**: removed "Private & Charter Tours" section, added prominent dark-gradient "Want a private tour?" CTA card at the top linking to `/itinerary-builder`, added inline cruise-match CTA inside Cruise Shore Excursions. The 6 private-tour `/tour-product/<slug>` pages stay accessible. **Home v2**: new `<ItineraryBuilderEntry />` section between `<DestinationsShowcase />` and `<ChooseTravelStyle />` with amber eyebrow + display title + 2-up Busan/Jeju region cards (mobile snap, desktop grid). **D9** logged: 301 redirects from 6 legacy private slugs deferred to Phase 4 close-out — redirecting now would strand users since builder has no booking flow yet. SSR verified: `/`, `/tours`, `/itinerary-builder/*` all 200 with expected markers; no regression. |
| 2026-05-17 | `2205e28f` | Phase 3a — Map UI scaffold landed. New routes `/itinerary-builder` (region selector landing) and `/itinerary-builder/[region]` (SSR shell with cluster-filtered Supabase fetch). Client `<POICatalogMap />` uses `useLoadScript` with marker+places libraries, renders `<GoogleMap mapId>` for vector, creates `AdvancedMarkerElement` + `PinElement` in useEffect, wraps with `MarkerClusterer`, opens InfoWindow on pin click with image + name (en+ko) + summary + disabled Add CTA. New deps: `@googlemaps/markerclusterer`. Middleware patch: added `itinerary-builder` to `RESERVED_ROOT_SEGMENTS` to prevent the bare-segment-to-tour-slug rewrite from redirecting `/itinerary-builder` → `/tour/itinerary-builder` (307). SSR-level verification via curl: all 3 routes (`/itinerary-builder`, `/busan`, `/jeju`) return 200 with expected content markers (Busan Map, Haedong, Tongdosa, Yangsan, Hallasan, Seongsan, UNESCO, etc.). Client-side Google Maps JS rendering not auto-verified (user's existing dev server held the `.next/dev` lock so a parallel preview server couldn't start) — user to verify in browser at `localhost:3000/itinerary-builder/busan`. Remaining Phase 3 work: i18n EN keys + auto-translate, `/tours` restructure, home v2 entry section, final visual + Lighthouse pass. |
| 2026-05-17 | `e84d15ba` | Phase 2 — Coordinate enrichment complete. **74 attractions all have lat/lng inside Korea bbox** (33.0–38.7 lat, 124.6–131.0 lng). Pipeline: (1) created separate **server-side Google Maps API key** (`GOOGLE_MAPS_API_KEY`, no app restrictions, Geocoding/Places/Distance/Directions enabled) since the public `NEXT_PUBLIC_*` key is referrer-restricted and Google rejects it from servers. (2) `scripts/geocode-match-pois.mjs` ran forward geocoding (`<name_ko> 한국` primary, `<name_en> South Korea` fallback, 250 ms throttle) → 82 OK / 0 MISS / 0 OUT_OF_BBOX, but inspection revealed 11 hits at Korea-center fallback (35.9078, 127.7669) and `jagalchi_market` mismapped to Cheonan. (3) `scripts/poi-coord-overrides.csv` built with 8 manual coords (`jagalchi`, `hallasan_1100_wetland`, `gyochon_hanok_village`, `hallim_park`, `ilchulland_*` ×2, `incheon_cruise_terminal`, `jeju_tangerine_picking`) re-geocoded with specific Korean queries (yielded ROOFTOP-grade results); applied via `--apply-overrides`. (4) **Region quality pass** (`scripts/audit-poi-regions.mjs` + `reclassify-poi-regions-from-csv.mjs`) — reverse-geocoded all 74 POIs, used `administrative_area_level_1` as authoritative source with word-boundary regex (avoiding the bug where "Minsokchon-ro" hit substring `sokcho`). Discovered **37 region corrections** needed from Phase 1's naive tour-level region tagging: `incheon → seoul` ×6, `seoul → gyeonggi` ×16, `seoul → gangwon` ×4, `busan → gyeongju` ×6, `busan → yangsan/ulsan/miryang` ×3, `seoraksan → gangwon` ×2. All 37 UPDATEs + 8 `route_variant_*` DELETEs (non-POI tour metadata) applied. (5) **Spot-check 15 famous POIs** all match known coords. Final distribution: jeju 25 / gyeonggi 16 / busan 11 / seoul 6 / gyeongju 6 / gangwon 6 / yangsan/ulsan/incheon/miryang 1 each = 74. **Busan-cluster** (busan+yangsan+gyeongju+ulsan+miryang) = **20**, **Jeju** = **25**, MVP-renderable = **45** (≥40 acceptance ✓). Seed script also patched to exclude `route_variant_*` for future runs. |
| 2026-05-21 | (Phase 8 start) | **Phase 8 started — Admin `match_pois` editor.** Promotes §E "/admin/pois browse + edit UI" (D10). Fresh branch `feat/admin-match-pois-editor` off `main`. Implementation plan: (8a) sidebar + breadcrumb entry for `/admin/match-pois` in `app/admin/layout.tsx`; (8b) `GET /api/admin/match-pois` collection list (requireAdmin, trimmed rows, `_`-prefixed junk filtered out); (8c) `GET + PATCH /api/admin/match-pois/[poi_key]` — GET fetches one row, PATCH **auto-upserts** (`onConflict: 'poi_key'`) with a column whitelist (excludes generated `is_operational` + DB-managed `created_at`/`updated_at` + `embedding`), validation (lat 33.0–38.7 / lng 124.6–131.0; highlights/images = string arrays; visit_basics/convenience/smart_notes object-or-null with `{}`→null Empty-Object Rule; reject unknown cols), and `poi_meta` defaulted to `{}` on a brand-new INSERT (NOT-NULL col); (8d) `app/admin/match-pois/page.tsx` list+editor mirroring `/admin/products/v2` — list pane (search + busan-cluster/jeju region filter + is_attraction filter + thumbnail/poi_key/name), editor pane grouped Identity / Location / Image / Content / Matching-profile with structured sub-forms + validated JSON textareas, dirty-tracking + Save + Sonner toasts; (8e) defensive override-pinned indicator (D11 — degrades to no-op since `poi-image-overrides.mjs` is absent on `main`). **Code reality verified on `main` 2026-05-21** (see D11): highlights/images are jsonb arrays (not text[]); poi_meta is NOT NULL; override map + `itinerary:poi-audit` live only on the dq branch. match_pois has 91 rows (2 `_`-prefixed junk → filtered, 84 attractions, 0 OPS_), 1 empty-`{}` visit_basics + 1 empty-`{}` convenience already present. Land in small commits per the planner-after-every-commit rule. |
| 2026-05-21 | `d242ad1c` | POI data quality track registered in §E — dedicated planner `docs/itinerary-builder-poi-data-quality-master-plan-2026-05-20.md` (revised 2026-05-21). Feature build stays ✅; separate data-integrity track on branch `fix/itinerary-builder-poi-data-quality` (off main). Phase 0 provenance gate PASSED. **Track A committed (A1–A5):** `poi-image-overrides.mjs` + seed/enrich hardening (override-wins image precedence, Signal-A wrong-POI reject, `{}`→null, omit-null payload); DB A1–A3 already applied to prod. Next: Phase 1 audit script. |
| 2026-05-21 | `00b2c17b` | POI data-quality **Phase 1 — audit script** (`scripts/audit-itinerary-builder-pois.ts`, run via tsx + `itinerary:poi-audit`). Visible set uses the exact page.tsx:78–80 predicate (imports `isBuilderAttraction`); Signal A (orphan wrong-POI image) vs Signal B (`chatgpt-image-*` AI) split; `--json`/`--strict`/`--region`. Fixed a flaky Windows exit code (libuv `UV_HANDLE_CLOSING` on `process.exit` → uses `process.exitCode` + dispatcher close). First run: 44 visible, Signal A=0 (Track A verified), `missing_image`=6 (= the Track B photo targets), 17 Signal B, jeju_tangerine empty ×3. Provenance correction: KB has NO image field → import-match-v18 writes `default_image_url=null` (not a real image source). New findings: `un_memorial_cemetery` borrowed gallery images; `_metadata`/`_kb_metadata` junk rows in match_pois. |
| 2026-05-22 | (Phase 9 start) | **Phase 9 started — Pricing policy overhaul.** Isolated worktree `feat/itinerary-builder-pricing` off `origin/main` (per `feedback_worktree_isolation.md`; main dir is on the contended `feat/unified-landing-planner` with other sessions' uncommitted changes). Decisions D12-D14 logged. Implementation plan = §F Phase 9 tasks 9a-9h: (9a) `pricing-policy.ts` typed model + pure compute/constraints + unit tests; (9b) refactor `quote-engine` onto it; (9c) rewire `/api/itinerary/quote`; (9d) Seoul region + Jeju zone classifier; (9e) IntakeForm region+duration+guide-language; (9f) QuoteModal live price + Solati disable + notices; (9g) DMZ fixed-price product; (9h) i18n transcreation (6 locales) + thanks/email. Code reality verified: quote engine + builder components identical between `origin/main` and current HEAD; `quote_presets` referenced in only 4 files; Seoul/gyeonggi/gangwon POIs exist; no admin presets editor. Land in small commits per the planner-after-every-commit rule. |
| 2026-05-22 | `3f21ef16`·`25e25744`·`634e287e`·`f89845e1`·`7931d0f9` | **Phase 9 code-complete (9a-9h).** (9a) `lib/quote-engine/pricing-policy.ts` — single SoT (English/Chinese hour tables, smart_guide hidden = chinese+₩20k, pax tiers + Solati min-6h + peak, region/Jeju-cross/Jeju-pickup surcharges, DMZ fixed table) + 30 passing unit tests reproducing every doc example. (9b) engine refactored onto it (types slimmed, fingerprint de-distanced, dead preset files deleted). (9c) `POST /api/itinerary/quote` recomputes via the same module; DMZ track (migration `20260522000000` widened the track CHECK); 14+/>28 → manual; `PRICING_AUTOQUOTE_ENABLED` kill-switch. (9d) Seoul cluster expanded (+gangwon/incheon); coord-based `jejuZone`. (9e) IntakeForm: Seoul region + DMZ track + guide-language + duration picker. (9f) QuoteModal: live price (same module → matches server), Solati 4h/5h disable, Jeju pickup, not-included + Jeju single-region notices, itemized breakdown. (9g) DMZ fixed-price product panel in BuilderShell. (9h) 6-locale transcreation (`scripts/inject-pricing-i18n.mjs`) + thanks/email new line-item breakdown. **Evidence:** `npm run build` green (full route manifest); 30/30 unit tests; `tsc --noEmit` clean. **Repair:** `f89845e1` restored `lib/itinerary-builder/locale-content.ts` (+ `types.ts` PoiLocalizedContent) — origin/main's BuilderShell imported it but a botched result-richness merge dropped it (main did not type-check). **Pending:** interactive browser QA (preview blocked by contended dev env). |
| 2026-05-22 | `049c9aab` | **D15 — cruise + Gangjeong surcharges.** `pricing-policy.ts` adds `cruise_excursion` (+₩40k, all cruise tracks) + `gangjeong_port` (+₩70k, Jeju cruise from Gangjeong) lines; cruise suppresses the hotel pickup zone. QuoteModal gains a Jeju cruise-port selector (defaults Gangjeong); API reads `cruise_port`; line labels + 6-locale copy added (`scripts/inject-cruise-i18n.mjs`). 5 new unit tests → **35/35**. `npm run build` green. |
| 2026-05-29 | (Phase 10 start) | **Phase 10 started — Flow simplification + card-hold booking.** Spin-off planner `docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md` (v2 after gap-review pass). §B D16-D26 logged. Isolated worktree `C:/Users/sangsong/atockorea-flow-simp` on `feat/itinerary-builder-flow-simplification` off `origin/main` `46b529d0`. **Goal:** delete the vestigial Phase 4/5 quote pipe (made obsolete by Phase 9's pricing table), collapse the 3-screen redundant intake into a unified planner shell, auto-run AI recommendation on entry, and route in-scope itineraries directly into the standard `bookings`+`/api/stripe/checkout` card-hold infrastructure. Out-of-scope (14+ pax / >28 DMZ) gates to a mailto with NO DB write. Plan = 8 phases (~5.5 person-days). Phase 1 = this commit (planner registration); no code until D1-D12 ratified. |
| 2026-05-29 | `2cbe643e` | **Phase 10.2 complete.** Migration `20260529000000_extend_bookings_for_itinerary.sql` applied (bookings.currency + source + itinerary). `/api/stripe/checkout` + webhook + recapture-holds cron now currency-aware (USD-cents vs whole-KRW). `NoShowHoldCardForm` generalized (currency + amountMinor props; amountUsdCents alias kept one cycle); tour-product checkout migrated. `lib/booking/createBuilderBooking.ts` helper with D11 (unit=total=final), D12 (merchant_id NULL — verified `/api/admin/orders/[id]/settle` doesn't read it), D17 (itinerary jsonb shape) + 8-test suite. `lib/email-templates/builder-booking-confirmation.ts` Phase 2 stub so webhook stops silently skipping builder bookings. **47/47 tests green** (35 pricing-policy regression + 8 createBuilderBooking + 4 formatHoldAmount). `tsc --noEmit` clean, `npm run build` green (all 70+ routes). D26 simplified to NULL in spin-off planner. |
| 2026-05-29 | `f652559e`·`98929256` | **Phase 10.2.1 complete (audit checkpoint).** 5-finder + 1-sweep code review surfaced 14 candidates. 4 real Phase 2 regressions fixed: (#1) `resolveAmount` honors explicit `currency` even when amountMinor missing + dev-only console.warn for the $0 case; (#2) `safePax()` clamps NaN/Infinity/negative pax to 1 (was producing 'invalid input syntax for type integer: NaN' on INSERT); (#3) `number_of_guests` ≡ `itinerary.pax` invariant (both clamped); (#4) DMZ duration_hours=0 email rendered "DMZ tour" label instead of dropping silently. Phase 6 plan extended with 6c (currency-aware admin/customer formatters — admin orders list/detail, dashboard total revenue, customer-printable receipt) + 6d (builder cancellation email parity — admin cancel currently gates on `tour?.title` so builder bookings get no email). Pre-existing recapture-holds idempotencyKey bug spun off as separate follow-up. **57/57 tests green** (+10), tsc clean, build green. |
| 2026-05-29 | `697477e3` | **Phase 10.3 complete — unified planner shell.** IntakeForm (377 LOC) deleted; `/itinerary-builder` IS the planner now (server reads `?region=`, fetches POIs directly). `/itinerary-builder/[region]` becomes a `permanentRedirect` (308) that forwards ALL query params. New `<PlannerTopRail>` sticky bar (desktop horizontal expanded controls; mobile 1-line summary chip → bottom-sheet) with every change writing the URL (region: `router.push` so POIs re-fetch; everything else: `router.replace({scroll:false})`). Solati 6h auto-bump preserved. New `<LivePriceCard>` pure presentation, extracted from QuoteModal; both the planner rail and the slimmed modal render the SAME price computed once in BuilderShell via `pricing-policy.quote()`. QuoteModal now contact-only (name + email + notes + LivePriceCard compact). i18n EN keys added under `itineraryBuilder.planner.*` (Phase 7 transcreates 5 locales). Browser-verified at worktree dev :3300: PlannerTopRail chip "Busan · 2p · 한국어 · 8h" + LivePriceCard ₩250,000 (KO locale → Chinese tier 8h base, correct) + 308 redirect forwards all params. **Net -518 LOC**, tsc clean, build green. |
| 2026-05-22 | (branch `fix/recommend-meal-midday`) | **Phase 7 recommendation bug-fix (user-reported): lunch placed as stop 1.** `lib/itinerary-match-engine/sequence.ts` `tspRoute` optimizes drive time only, so a meal POI (e.g. "Lunch at Gwangjang Market") could land first/last. Added `isMealStop` + `placeMealsMidday` (final step of `sequence()`): keeps non-meal stops in drive-optimized order, re-inserts meal stops around the midpoint → morning sights → lunch → afternoon. 5 unit tests (`sequence-meal-midday.test.ts`); `npm run build` green. Also surfaced this turn: Seoul build now routes to the builder (separate landing-uiux PR #3), and the `/itinerary-builder/[region]` map failure is `ApiTargetBlockedMapError` — the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` has an API restriction excluding Maps JavaScript API (fix in GCP Console, not code). |

---

## D · Working protocol

**Mandatory for anyone (Claude or human) about to touch this feature:**

1. **Read this whole doc first.** Especially §A (status), §B (decisions), §F (phase plan).
2. **Confirm which phase is in progress** (§A row marked 🔄). If no phase is active, halt and ask the user which phase to start — do NOT pick one yourself.
3. **Within the active phase**, work on the next unchecked task (§F sub-checklists). Don't skip ahead.
4. **If the user requests work that contradicts the plan** (e.g., "skip Phase 5 and go straight to AI") — first update §B with a logged decision, then update §F with the revised order, THEN execute. Never silently re-route.
5. **After every commit in this feature area**, update:
   - §A "Last commit" field
   - §A phase status (start / progress / complete)
   - §C change log (one line)
   - The relevant §F sub-checklist
6. **Scope discipline:**
   - Do NOT silently bundle unrelated work into a phase commit. If new scope appears mid-phase, log it in §E (Scope creep registry) and ask.
   - Do NOT abandon a phase mid-flight to switch to a "more interesting" piece. Finish or explicitly pause.
7. **Acceptance criteria** at each phase cut-line MUST be verified before marking ✅ — see §F per-phase acceptance.

---

## E · Scope creep / parked ideas registry

Things that came up during this work but aren't in the 6-phase plan. Park them here; don't sneak them into a phase.

| Date | Idea | Why parked | Owner / next step |
|---|---|---|---|
| 2026-05-16 | Merge `poi_search_profile` (TourAPI 576-row table) with `match_pois` | Different ID scheme (TourAPI content_id vs poi_key); not blocking MVP | Post-MVP, after Phase 7 ships and beta feedback in |
| 2026-05-16 | ~~`/admin/pois` browse + edit UI~~ **PROMOTED → Phase 8 (D10 2026-05-21)** | Originally parked as post-MVP tuning nicety; user promoted it to a build on 2026-05-21 | Built as `/admin/match-pois` (list+editor + auto-upsert API) — see §F Phase 8 |
| 2026-05-16 | ~~Auto-pricing for quotes (vehicle + driver + distance)~~ **PROMOTED → Phase 5 (D4 revised 2026-05-16)** | Originally parked as out-of-scope; D4 revision made it core | — |
| 2026-05-16 | Save itinerary to user account | Requires auth flow; URL params carry MVP value | Post-MVP |
| 2026-05-16 | Seoul region rollout (DMZ + suburbs + main) | D1 limited MVP to jeju + busan | After Phase 7 beta validates jeju/busan |
| 2026-05-16 | Admin UI for Phase 5 base-condition Q&A setup | Phase 5 may start with config-as-data (Supabase jsonb) before building an admin page | Decide during Phase 5 — escalate to admin UI only if rules get complex enough that JSON editing is error-prone |
| 2026-05-16 | Cruise shore-excursion match flow detail (reuse `/match` page or new surface?) | D8 split cruise into a separate intake branch but the result surface is TBD | Phase 4 design step |
| 2026-05-16 | Legacy private-tour static pages (busan, jeju, seoul-suburbs, incheon-seoul, seoul-dmz) — retirement timing & redirect map | D7 says remove from `/tours`; redirect mapping detail deferred | Phase 3 task — 301 redirects to `/itinerary-builder/<region>` (where region exists) or to `/itinerary-builder` landing |
| 2026-05-18 | **UI/UX upgrade — builder surfaces visually mismatched with home v2** | Functional MVP (Phase 1–7) is done. Design polish is a separate track. | **Promoted to dedicated planner: [`docs/itinerary-builder-uiux-master-plan-2026-05-18.md`](./itinerary-builder-uiux-master-plan-2026-05-18.md)** — 10 phases (A–J), ~5 person-days. Phase B onward executed only after user sign-off. |
| 2026-05-18 | **V2 redesign — structural pivot from cart-side-panel to sticky map + photo-pin markers + vertical itineraryStop timeline + bi-directional map↔card sync** | Surfaced from world-class designer critique 2026-05-18: result paradigm buries map (audit §J.1), amber inflation (§J.4), Add/Added color inversion (§J.5), IntakeForm copy untrue (§J.8). Old UIUX plan's Phases F–J were skin-deep polish on a layout this redesign replaces. | **Promoted to dedicated planner: [`docs/itinerary-builder-redesign-master-plan-2026-05-18.md`](./itinerary-builder-redesign-master-plan-2026-05-18.md)** — 13 phases (0–12), ~9 person-days. Phase 0 is a go/no-go gate (photo-pin readability on Korean POI imagery). Skill: `itinerary-builder-redesign`. |
| 2026-05-20 | **POI data quality — visible builder POIs with missing/wrong `default_image_url` + empty structured fields** | Data-integrity track, distinct from the feature build (Phases 1–7 ✅) and from the UI/UX + V2 redesign tracks. Verified 2026-05-21: image layer = tour-JSON seed + orphan writes; KB/import-match-v18 is NOT the source. | **Promoted to dedicated planner: [`docs/itinerary-builder-poi-data-quality-master-plan-2026-05-20.md`](./itinerary-builder-poi-data-quality-master-plan-2026-05-20.md)** (revised 2026-05-21). Phase 0 provenance gate PASSED. Track A immediate fixes (woljeonggyo+tongdosa image wiring, jeju_tangerine `{}`→null, jeonnong/noksan ilchulland removal) executing under the `itinerary-builder` skill — no separate skill exists for this track. |
| 2026-05-29 | **Flow simplification + card-hold booking** — customer flow redundant across 3 screens (intake/cart-page/quote-modal all asking date·party·lang·duration); submission only sends a proposal — no card hold, no booking record; ops drowns in manual email handshakes. | The Phase 4/5 quote pipe became vestigial after Phase 9 shipped the real pricing table — but the pipe wasn't removed. User 2026-05-28: "하루에 이런 제안 열개만 받아도 하루가 다 가." | **Promoted to dedicated planner: [`docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md`](./itinerary-builder-flow-simplification-master-plan-2026-05-28.md)** (v2 after gap-review). 8 phases (1-8), ~5.5 person-days. §C D1-D12 ratified by user 2026-05-29 (recommended options across the board). Phase 10 entry below in §F. |
| 2026-05-29 | Customer self-serve cancellation UI (`/booking/[ref]` cancel flow for ALL booking types) | Verified 2026-05-28: no cancellation route exists for any booking today. Cancellation is webhook-driven (ops cancels PI in Stripe Dashboard → webhook syncs status). Builder bookings inherit this gap — see Phase 10 planner §L. | Future feature, not blocking Phase 10. Scope: tour-product + itinerary_builder. Re-evaluate after 30 days of builder traffic. |

---

## F · 6-phase plan

Each phase delivers a shippable artifact and has a clear "stop here if needed" cut-line. Sub-checklists are append-only — never delete completed items, just check them off so the change history is visible.

### Phase 1 — POI catalog seed (1-2 days)

**Scope per D1 2026-05-16:** jeju + busan only for MVP seed. (Seoul rows in source JSONs are seeded as-is for future, but Phase 3/4 UIs only render jeju + busan.)

**Deliverable:** `match_pois` rows fully populated for all unique poi_keys from tour JSONs.

**Migration to write first:** `supabase/migrations/<timestamp>_add_match_pois_geo_and_profile.sql`
- `ALTER TABLE match_pois ADD COLUMN lat numeric, ADD COLUMN lng numeric, ADD COLUMN matching_profile jsonb, ADD COLUMN default_stay_minutes integer, ADD COLUMN category text;`

**Tasks:**
- [x] Write migration `supabase/migrations/20260517120000_add_match_pois_geo_and_profile.sql`
- [x] Apply migration via `mcp__atockorea__apply_migration`
- [x] Write `scripts/seed-match-pois-from-tour-jsons.mjs` — walk all `components/product-tour-static/**/<slug>.<locale>.json`, dedupe by `_poi_meta.poi_key`, write `name_en, name_ko, names_other_locales jsonb, region, default_image_url, poi_meta, stop_role='attraction'` to `match_pois`. Skip operational keys (prefix `OPS_` AND `_poi_meta.match='transit_only'`). NOTE: `is_operational` turned out to be a generated column (`poi_key LIKE 'OPS_%'`); the seed writes `stop_role='attraction'` only and the flag is computed automatically.
- [x] Run script; **82 unique attractions seeded** (audit's 102 raw count included operational); spot-check 5 POIs across 6 locales — names populated for en/ko/ja/zh/zh-TW/es.
- [x] Verification SQL run via `execute_sql`: total rows, per-region count (busan 20 / jeju 29 / seoul 23 / incheon 7 / seoraksan 2 / suwon 1), 0 rows with null `region`, 0 rows with `stop_role='operational'`.

**Acceptance (revised after seed):**
- [x] `SELECT COUNT(DISTINCT poi_key) FROM match_pois WHERE name_en IS NOT NULL;` = **82** (≥80 — real attraction count after filtering `OPS_*` + `transit_only`)
- [x] `SELECT COUNT(*) FROM match_pois WHERE region IN ('busan', 'jeju') AND name_en IS NOT NULL;` = **49** (≥40 ✓)
- [x] Every populated row has non-null `region` (0 missing)
- [x] No row has `stop_role = 'operational'` (generated column `is_operational` confirms via `poi_key LIKE 'OPS_%'` pattern, 0 such rows in seed)

**Cut-line:** If we stop here, we have a clean POI inventory for any future product (admin browse, analytics).

---

### Phase 2 — Coordinate enrichment (0.5-1 day)

**Deliverable:** Every POI in `match_pois` has lat/lng populated.

**Tasks:**
- [x] Create separate server-side Google Maps API key (`GOOGLE_MAPS_API_KEY`, no app restrictions, Geocoding API enabled) — required because the `NEXT_PUBLIC_*` key has HTTP referrer restrictions which Google rejects from servers.
- [x] Write `scripts/geocode-match-pois.mjs` (replicates `lib/google-maps.geocodeAddress` pattern as standalone `.mjs` since the script doesn't go through next.js bundling).
- [x] For each POI without lat/lng: query `"<name_ko> 한국"` first, fall back to `<name_en> South Korea`. Throttle 250 ms between requests.
- [x] CSV audit `scripts/poi-coord-audit.csv` with poi_key, name_en, geocoded coords, formatted_address, location_type (ROOFTOP / GEOMETRIC_CENTER / RANGE_INTERPOLATED / APPROXIMATE), in_bbox flag, status.
- [x] Spot-check revealed 11 hits at Korea-center fallback (35.9078, 127.7669) for ambiguous queries, plus `jagalchi_market` mismapped to Cheonan.
- [x] `scripts/poi-coord-overrides.csv` built with 8 manual coords re-geocoded with specific Korean queries (`경주 교촌마을`, `제주 한림공원`, `인천항 국제여객터미널`, etc.) yielding ROOFTOP-grade results. Applied via `--apply-overrides`.
- [x] **Region quality pass**: `scripts/audit-poi-regions.mjs` reverse-geocodes every POI's stored lat/lng → derives `formatted_address` + `administrative_area_level_1` + `locality`; `scripts/reclassify-poi-regions-from-csv.mjs` uses admin1 as authoritative source with word-boundary regex (avoiding substring false-positives like "Minsokchon-ro" matching `/sokcho/`).
- [x] 37 region corrections applied: `incheon → seoul` ×6 (priority bug in initial seed), `seoul → gyeonggi` ×16, `seoul → gangwon` ×4, `busan → gyeongju` ×6, `busan → yangsan/ulsan/miryang` ×3, `seoraksan → gangwon` ×2.
- [x] 8 `route_variant_*` rows DELETEd (tour route metadata, not POIs — seed script also patched to exclude going forward).

**Acceptance:**
- [x] 100% of `match_pois` attractions have non-null lat AND lng (74/74).
- [x] All lat values in range 33.0–38.7, all lng in 124.6–131.0 (0 violations).
- [x] Visual spot-check of 15 famous POIs (Bulguksa, Tongdosa, Haedong Yonggungsa, Jagalchi, Seongsan Ilchulbong, Gyeongbokgung, N Seoul Tower, Cheomseongdae, Bomun Lake, Hwaseong Fortress, Dora Observatory, Nami Island, Seoraksan, Gamcheon, Songaksan) confirms address match — all within ±0.001° of known coordinates.
- [x] Final region distribution: jeju 25 / gyeonggi 16 / busan 11 / seoul 6 / gyeongju 6 / gangwon 6 / yangsan 1 / ulsan 1 / incheon 1 / miryang 1 = 74.

**Cut-line:** Catalog has accurate geographic data and clean region tags. Ready for Phase 3 map UI.

**Note for Phase 3:** Region filter must use **clusters**, not single literal region match:
- `/itinerary-builder/busan` → `region IN ('busan','yangsan','gyeongju','ulsan','miryang')` = 20 POIs
- `/itinerary-builder/jeju` → `region = 'jeju'` = 25 POIs
- (future) `/itinerary-builder/seoul` → `region IN ('seoul','gyeonggi','gangwon','incheon')` = 29 POIs

---

### Phase 3 — Map UI read-only + `/tours` restructure + home v2 entry (3-4 days)

**Per D6/D7 2026-05-16:** expanded from "just the map page" to include i18n pipeline, `/tours` restructure, and home v2 entry section.

**Deliverable:** `/itinerary-builder/[region]` renders the map with POI pins; `/tours` page restructured to surface the builder as the canonical path; home v2 has a new entry section.

**Tasks — map UI:**
- [x] New route `app/itinerary-builder/[region]/page.tsx` (SSR shell, client child component) — `2205e28f`
- [x] Resolve `region` param against allowed list (`busan | jeju` per D1); 404 otherwise. Used `isRegionSlug` from `lib/itinerary-builder/regions.ts`.
- [x] Read `match_pois` for region via Supabase server client — uses **REGION_CLUSTER** (busan cluster = busan+yangsan+gyeongju+ulsan+miryang; jeju = jeju) per Phase 2 close-out note.
- [x] Build `<POICatalogMap />` client component:
  - Google Map with `mapId={NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}` (vector rendering)
  - Tilt/heading 0 + standard pan/zoom; `gestureHandling: greedy`
  - Centered on region centroid via `REGION_CENTER`
  - `AdvancedMarkerElement` + `PinElement` created in useEffect (since `@react-google-maps/api 2.20.7` doesn't expose an AdvancedMarker React component)
  - `@googlemaps/markerclusterer` (newly installed) wraps the markers
  - InfoWindow on marker click: image (`default_image_url`), name_en + name_ko, summary, disabled "Add to itinerary" button (Phase 4 will enable)
- [x] Landing page `app/itinerary-builder/page.tsx` with 2 region cards (Busan, Jeju) — server component with hardcoded EN copy (will move to messages/ in Phase 3 i18n task).
- [x] Middleware fix — added `itinerary-builder` to `RESERVED_ROOT_SEGMENTS` (the bare-segment-to-tour-slug rewrite was redirecting `/itinerary-builder` → `/tour/itinerary-builder`).
- [x] Mobile-first sizing: map 100vh / 70vh on mobile, 78vh on md+.

**Tasks — i18n pipeline (D6):**
- [x] Author EN strings in `messages/en.json` under `itineraryBuilder.{home,map}.*` (eyebrow, title, subtitle, region card labels, map states, InfoWindow CTAs).
- [x] Auto-translate pipeline via `scripts/translate-itinerary-builder-messages.mjs` — supports Anthropic Claude Haiku 4.5 (preferred) OR Gemini 2.5 Flash (fallback). Idempotent: re-running replaces only the `itineraryBuilder` namespace. Run used Gemini since ANTHROPIC_API_KEY was placeholder-empty.
- [x] Spot-check KO + JA confirmed natural marketing tone with all proper nouns + placeholders preserved. (Full async review of zh / zh-TW / es deferred — quality looks consistent.)

**Tasks — `/tours` restructure (D7):**
- [x] Audit existing `/tours` page content + 6 legacy private-tour detail routes (DB query confirmed 6 active rows with private/charter badges).
- [x] Remove private-tour cards from `/tours` grid; keep shore excursions section + **inline match CTA banner** inside shore excursions ("On a cruise? Tell us your port + hours...").
- [x] Add **"Want a private tour?" CTA card on top of `/tours`** (dark gradient with amber accent) linking to `/itinerary-builder`.
- [ ] ~~Add 301 redirects in `next.config.js` from legacy private-tour slugs~~ → **DEFERRED to Phase 4 close-out** (D9 2026-05-17): builder has no booking flow yet; redirecting now would strand users. Legacy pages remain accessible.
- [ ] ~~Delete the 5 legacy static-tour page components~~ → **DEFERRED to Phase 4 close-out** (same reason as above).

**Tasks — home v2 entry section:**
- [x] New home v2 section `components/home/v2/sections/itinerary-builder-entry.tsx` — amber eyebrow ("Custom itinerary builder"), display-size title ("Or build your own Korea day"), 2-up region cards (Busan, Jeju) with stop-count badges, mobile snap rail + desktop grid.
- [x] Wired into `components/home/v2/HomeV2Page.tsx` after `DestinationsShowcase` (natural extension — explore destinations → realize you can customize).
- [x] Section CTAs → `/itinerary-builder/<slug>` directly (skips selector for one-click flow).

**Acceptance:**
- [x] Page loads at `/itinerary-builder/busan` (20 pins via cluster) and `/itinerary-builder/jeju` (25 pins).
- [x] Vector rendering confirmed (user-verified in browser 2026-05-17).
- [x] Clicking any pin opens InfoWindow with image + name + 1-line desc + (disabled) Add button.
- [x] `/tours` shows shore excursions only + "Want private tour?" dark-gradient CTA card on top; "Private & Charter" section fully removed.
- [ ] ~~Legacy private-tour URLs return 301 → builder route~~ — **DEFERRED to Phase 4 close-out per D9** (would strand users without booking flow).
- [x] Home v2 has new `<ItineraryBuilderEntry />` section visible between `DestinationsShowcase` and `ChooseTravelStyle`.
- [x] `messages/en.json` complete; all 6 locales populated; KO + JA spot-checked.
- [ ] **Optional follow-up**: Page responsive sweep (DevTools mobile + tablet + desktop). User-verifiable manually.
- [ ] **Optional follow-up**: Lighthouse perf ≥ 70 on mobile. User-verifiable manually.

**Cut-line:** Users can browse the curated POI map AND find it from home + `/tours` in 6 languages. Can't build/save yet — Phase 4 work.

---

### Phase 4 — Q&A intake (private/cruise) + cart + manual quote form (3-4 days)

**Per D8 2026-05-16:** intake branches into private-tour vs cruise tracks at the first question (cruise has a shorter time window and different price model). Auto-quote pricing logic is **NOT** in this phase — that's Phase 5. Phase 4 only saves the request and routes to Slack (manual quote fallback) until Phase 5 lands the auto-quote engine.

**Deliverable:** End-to-end manual builder. User answers intake Q&A → routed to private OR cruise flow → picks POIs, reorders, sees drive estimate, submits a quote request that creates a DB row + Slack notification.

**Tasks — intake Q&A:**
- [ ] New route `app/itinerary-builder/page.tsx` (intake landing — region + cruise question + party + date).
- [ ] First question: "Are you arriving by cruise?" → branches:
  - **No (private-tour track):** standard land builder. Region question (busan/jeju). Party size. Date. Language. Special interests (multi-select).
  - **Yes (cruise track):** which port? (busan-cruise-port / jeju-cruise-port). Ship name + date. Time available (e.g., 6h / 8h / 10h). Onward language.
- [ ] Form persists answers to URL params (consistent with D5 share-able links): `?track=private&region=busan&date=...&party=4&lang=en&interests=temples,markets`
- [ ] On submit → route to `/itinerary-builder/[region]?...` (map view) with intake context preloaded into cart prompt.

**Tasks — cart + sequencing (carried over from old Phase 4):**
- [ ] Cart state in URL params: `?pois=tongdosa,bulguksa&date=2026-05-20&party=4&track=private` (so itineraries are share-able without auth).
- [ ] Cart UI: side panel on desktop, bottom-sheet on mobile (snap points 30%/90%).
- [ ] Drag-and-drop reorder via `@dnd-kit/core` (install if not present).
- [ ] Drive estimate: Haversine distance × 1.3 road factor × 50 km/h average → ETA per leg. Show total drive minutes + summed POI `default_stay_minutes`.
- [ ] **Cruise track only:** enforce hard time-budget — sum(stay + drive) ≤ user-selected window; warn if exceeded; refuse submit if exceeded by >30 min.
- [ ] Polyline overlay on map showing selected POI sequence in order.

**Tasks — manual quote form (Phase 5 will layer auto-quote on top):**
- [ ] Quote form modal: name / email / requested date / party size / language / notes (intake answers prefilled).
- [ ] `POST /api/itinerary/quote` route:
  - Write to new `tour_quote_requests` table (migration in this phase) with intake answers as `intake jsonb` column
  - Send Slack webhook notification to ops channel (`SLACK_QUOTE_WEBHOOK_URL`)
  - Send confirmation email to user via existing email service (`lib/email.ts`)
  - Return `{ quote_id, status: 'pending_manual' }` — auto-quote status added in Phase 5
- [ ] Success page: "We'll respond within X hours" + saved URL of the itinerary.

**Migration:** `<timestamp>_create_tour_quote_requests.sql` — id uuid PK, poi_keys text[], requested_date date, party_size int, contact_email text, contact_name text, language text, notes text, locale text, region text, track text CHECK (track IN ('private','cruise')), intake jsonb, source_url text, status text DEFAULT 'pending_manual', created_at timestamptz, manual_quote_amount_krw int NULL, manual_quote_response jsonb NULL, manual_responded_at timestamptz NULL.

**Acceptance:**
- [x] Intake form at `/itinerary-builder` lands → answer Q&A → routes to `/itinerary-builder/[region]?...` with prefilled context (track, region, date, party, hours, ship as URL params).
- [x] Cruise track enforces time budget; `BuilderShell` reads `?track=cruise&hours=N` and passes `cruiseBudgetMinutes` to `<CartPanel />` which shows the budget and renders a red `cruiseOverBudget` warning when total exceeds.
- [x] Add 3 POIs from map → cart shows them in order via URL `?pois=...`. `<POIInfoWindowContent />` toggles between Add and Remove based on `useCart().has()`.
- [x] Drag to reorder → `arrayMove` via dnd-kit → URL `?pois=` updates → `<Polyline />` redraws along the new order.
- [x] "Get quote" → `<QuoteModal />` opens → form submit → `POST /api/itinerary/quote` → DB row in `tour_quote_requests` (status=`pending_manual`) → Slack notification fires (fire-and-forget) → user email sent (fire-and-forget) → redirect to `/itinerary-builder/thanks?quote_id=...`.
- [x] Share URL → reopen → cart + intake context restored from URL params (no auth required per D5).

**Optional follow-ups (post-Phase 4):**
- [ ] End-to-end test with real SLACK_QUOTE_WEBHOOK_URL + RESEND_API_KEY (verify Slack message format + email deliverability).
- [ ] Mobile responsive sweep + Lighthouse perf.
- [ ] Admin response surface for ops to respond to `pending_manual` rows (currently Supabase Studio editing is the workflow until Phase 5 admin UI lands).

**Cut-line:** Ship-able as v1 — every quote goes through Slack manual response. Phase 5 layers auto-quote on top without changing this flow.

---

### Phase 5 — Auto-quote engine + admin presets + Slack escalation + quote memory (3-5 days)

**Per D4 2026-05-16 (revised):** admin pre-configures base pricing conditions; in-scope itineraries get auto-quoted instantly; out-of-scope ones escalate to Slack; manual responses become reusable precedent.

**Deliverable:** Quote submission either returns an instant computed price OR escalates with a precedent reference; admin can configure presets without code changes.

**Architecture sketch:**
```
POST /api/itinerary/quote
  ├─ classify(intake + cart) → in_scope | out_of_scope (rule engine over admin presets)
  ├─ if in_scope:
  │   ├─ price = computeQuote(presets, intake, cart)   // base + per-POI + per-hour + per-person
  │   ├─ status = 'auto_quoted'
  │   └─ email user with price + "book" CTA, log row
  └─ if out_of_scope:
      ├─ lookup precedent in quote_memory (similar past quotes)
      ├─ Slack ops with intake + cart + suggested-precedent-price
      ├─ status = 'pending_manual'
      └─ email user "we'll respond within X hours"

POST /api/admin/quotes/[id]/respond  (ops manually responds via admin route)
  ├─ writes manual_quote_amount + condition_fingerprint
  ├─ emails user with quote
  └─ adds row to quote_memory keyed by fingerprint (track, region, party_band, hours_band, has_temple, ...)
```

**Tasks — schema:**
- [ ] Migration `<timestamp>_create_quote_presets_and_memory.sql`:
  - `quote_presets` (id, track, region, base_krw, per_poi_krw, per_hour_krw, per_person_krw, in_scope_rules jsonb, active boolean, updated_at) — admin-editable rows
  - `quote_memory` (id, condition_fingerprint text, intake jsonb, cart_poi_keys text[], manual_amount_krw int, notes, created_by, created_at) — precedent log
  - Extend `tour_quote_requests` (Phase 4 table): add `auto_quote_amount_krw`, `auto_quote_breakdown jsonb`, `precedent_quote_id uuid REFERENCES quote_memory(id)`.

**Tasks — admin Q&A presets (config-as-data first; admin UI parked in §E):**
- [ ] Define preset schema. Seed two rows: `track=private,region=busan` and `track=private,region=jeju` (+ later `track=cruise,*`).
- [ ] `in_scope_rules` jsonb examples: `{"max_hours": 10, "max_pois": 8, "party_size_max": 8, "allowed_categories": ["temple","nature","market","viewpoint"], "disallowed_pois": ["restricted_military_zone_*"]}`.
- [ ] Document seed values in `docs/quote-presets-seed.md` (separate file) so ops can review.

**Tasks — classification + auto-quote pipeline:**
- [ ] `lib/quote-engine/classify.ts` — pure function `classify(presets, intake, cart) → { in_scope: bool, violations: string[] }`.
- [ ] `lib/quote-engine/compute.ts` — pure function `computeQuote(preset, intake, cart) → { amount_krw, breakdown }`.
- [ ] `lib/quote-engine/fingerprint.ts` — produces stable hash of normalized intake+cart for memory lookup.
- [ ] `lib/quote-engine/memory-lookup.ts` — k-nearest precedent fetch (start with exact fingerprint match; expand to similarity later).
- [ ] Wire into `POST /api/itinerary/quote` (extending Phase 4 route — not replacing it).

**Tasks — Slack escalation + admin response:**
- [ ] Slack message includes: intake summary, cart POI list, suggested precedent price (if any), "Respond" link → `/admin/quotes/[id]`.
- [ ] `/admin/quotes/[id]` route — auth-gated (existing admin auth pattern); ops sees request + precedent; submits final price + notes.
- [ ] On ops submit: writes `quote_memory` row + emails user + closes request.

**Tasks — user UX:**
- [ ] Auto-quoted: instant price card on success page, "Book now" CTA → Stripe (reuse existing flow if exists in Phase 5 scope, else stub).
- [ ] Manual-pending: "We'll respond within X hours" + optimistic precedent estimate if available ("similar past quotes ranged $X-Y").

**Acceptance:**
- [x] **In-scope path implemented**: API computes total_krw via pure `computeQuote()`, persists `status=auto_quoted` + `auto_quote_breakdown`, emails customer with breakdown card (header + 5-row breakdown + total + reply-to-book copy).
- [x] **Out-of-scope path implemented**: API runs `classify()`, falls through to `lookupPrecedent()`, persists `status=pending_manual` + `precedent_quote_id` if found, Slack message includes violations + precedent confidence/sample.
- [x] **Admin response surface live**: `/admin/itinerary-quotes` list + detail page + form → `POST /api/admin/itinerary-quotes/[id]/respond` writes `quote_memory` precedent + updates status + emails customer manual price.
- [x] **Precedent re-use**: subsequent same-fingerprint requests will surface the precedent's amount in Slack (validated logic; real-world verification deferred until ops responds to enough manual quotes).
- [x] **Preset editing in Supabase Studio**: 4 preset rows live in `quote_presets`, fields editable in Studio; next quote uses new prices with no redeploy.
- [ ] **Optional follow-ups**: real-world end-to-end test (submit a real quote → verify Slack + Resend); admin page i18n; preset KRW tuning by ops.

**Cut-line:** Auto-quote engine live for busan+jeju × private+cruise. Cruise auto-quote already differentiated in presets (tighter `max_hours`/`max_distance_km`).

---

### Phase 6 — POI matching_profile authoring (1-2 days)

**Deliverable:** Every POI in `match_pois` has a `matching_profile` jsonb populated.

**Strategy:** Auto-derive from parent tours, then manual review pass.

**Tasks:**
- [ ] Write `scripts/derive-poi-matching-profiles.mjs`:
  - For each poi_key, find all `match_tours` rows that reference it via `anchor_poi_keys` OR via `match_itinerary_stops` join.
  - Weighted-average their `matching_profile` jsonbs (dimension-by-dimension; weight = `1 / N` where N = stops in that tour, so a POI in a 7-stop tour contributes less than the same POI as anchor of a 3-stop tour).
  - Filter to POI-relevant dimensions only — DROP tour-level dims (`private_fit`, `cruise_shore_excursion_fit`, `one_day_fit`, `family_pace_fit`, etc.) — KEEP `scenic_level`, `nature_fit`, `cafe_fit`, `family_fit`, `iconic_landmark_fit`, `cherry_blossom_fit`, `wheelchair_accessible_anchor_fit`, etc.
- [ ] Run; CSV export `scripts/poi-matching-profile-audit.csv` (poi_key, name_en, derived profile dimensions).
- [ ] Manual review — 10 obvious miscalibrations (gut check); hand-tune in an overrides JSON; re-import.

**Acceptance:**
- [ ] 100% of attraction POIs have non-empty `matching_profile` jsonb
- [ ] Spot-check: `scenic_level` is high for viewpoints, `nature_fit` high for parks/mountains, `iconic_landmark_fit` high for UNESCO sites
- [ ] No tour-wrapper dimensions leaked into POI profiles

**Cut-line:** POI catalog is now matchable. Phase 7 becomes possible.

---

### Phase 7 — AI recommendation engine (2-3 days)

**Deliverable:** "AI 추천 받기" button calls Gemini Haiku, parses intent, returns a recommended 5-7 POI sequence with rationale + drive route.

**Tasks:**
- [ ] New route `app/api/itinerary/match/route.ts`:
  - Body: `{ intent: string, region: string, locale: string, max_pois?: number = 7, max_hours?: number = 6 }`
  - Pipeline:
    1. Call existing `parseQuery()` (parser-haiku) → `ParsedQueryV2`
    2. Hard-filter `match_pois` by region + season relevance
    3. Score each POI: reuse v2 `scoreTour` logic — adapt to read `poi.matching_profile` instead of tour's
    4. Diversity pass: top-N with soft penalty for >2 same-category POIs
    5. Sequence: greedy nearest-neighbor TSP starting from region centroid
    6. Time budget: trim from the tail until `sum(stay) + sum(drive) ≤ max_hours`
  - Output: `{ recommended_pois: poi_key[], per_poi_score_breakdown, total_drive_time_min, rationale }`
- [ ] UI: "AI 추천 받기" button on `/itinerary-builder/[region]` → calls endpoint → fills cart with recommended POIs in order → map polyline updates → flows through Phase 5 auto-quote engine
- [ ] Optional 2nd Haiku pass via `explainer-haiku.ts` for natural-language rationale shown above the cart
- [ ] Telemetry: log to existing `match_queries` table with `flow='itinerary_builder'` tag

**Acceptance:**
- [ ] EN intent "first time / family / scenic / Busan" → returns 5-7 POIs in Busan, ≤6 hours, mix of UNESCO + nature + market
- [ ] KO intent "벚꽃 시즌 / 커플 / 제주" → returns Jeju POI set with seasonal weighting
- [ ] Swap one POI manually → polyline updates; rationale section updates if Haiku 2nd-pass enabled
- [ ] Cost telemetry shows Haiku spend per request (~$0.001-0.003)
- [ ] Recommended itinerary auto-quotes via Phase 5 engine without manual step

**Cut-line:** Full feature. Ship internal beta, gather feedback, iterate `match_pois.matching_profile` quality.

---

### Phase 8 — Admin `match_pois` editor (admin-tooling track) (1-2 days)

**Per D10 2026-05-21:** promotion of the §E parked idea "/admin/pois browse + edit UI". Lets ops browse + tune the POI catalog (names, region/category, coords, image, structured content, matching profile) without hand-writing SQL. Mirrors the `/admin/products/v2` (상품편집) list+editor composition; backed by an **auto-upsert** API (new `poi_key` INSERTs, existing UPDATEs) — this differs from the product API, which is update-only.

**Deliverable:** `/admin/match-pois` admin page (list + editor) reading/editing `public.match_pois`, behind the existing `requireAdmin` gate, with a column-whitelisted auto-upsert save.

**Code-reality notes (verified on `main` 2026-05-21 — see D11):**
- `highlights` + `images` are **jsonb arrays** (not `text[]`); `visit_basics`/`convenience`/`smart_notes`/`names_other_locales`/`matching_profile`/`poi_meta` are **jsonb objects**.
- `poi_meta` is **`jsonb NOT NULL`, no default** → upsert defaults it to `{}` on a fresh INSERT.
- NEVER write: `is_operational` (GENERATED = `poi_key LIKE 'OPS_%'`), `created_at`, `updated_at`, `embedding` (vector).
- `lib/itinerary-builder/poi-image-overrides.mjs` + `scripts/audit-itinerary-builder-pois.ts` are **absent on `main`** (dq branch only) → override-pinned indicator is defensive/no-op here; audit step substituted with inline SQL self-check.
- Table state: 91 rows, 2 `_`-prefixed junk (`_metadata`, `_kb_metadata`) → filtered out of the list, 84 attractions, 0 `OPS_`, 1 empty-`{}` visit_basics + 1 empty-`{}` convenience already present.
- Reuse `REGION_CLUSTER` from `lib/itinerary-builder/regions.ts` (busan = busan+yangsan+gyeongju+ulsan+miryang; jeju = jeju) for the region filter.

**Tasks:**
- [ ] (8a) Sidebar + breadcrumb: add `{ path: '/admin/match-pois', label: '매칭 POI 관리' }` to `adminMenuItems` + `pathToBreadcrumb` in `app/admin/layout.tsx`.
- [ ] (8b) `GET /api/admin/match-pois` — collection list route. `requireAdmin`; returns trimmed rows (poi_key, name_en, name_ko, region, category, default_image_url, is_attraction, stop_role); `_`-prefixed junk filtered out server-side; `override_pinned` flag per row.
- [ ] (8c) `GET /api/admin/match-pois/[poi_key]` — fetch one full row (`requireAdmin`, `maybeSingle`), include `override_pinned`.
- [ ] (8d) `PATCH /api/admin/match-pois/[poi_key]` — auto-upsert. `requireAdmin` → validate → whitelist columns (exclude `is_operational`/`created_at`/`updated_at`/`embedding`) → default `poi_meta` to `{}` if a brand-new row → `supabase.from('match_pois').upsert(payload, { onConflict: 'poi_key' })` → return `{ data, message }` (message says "created" vs "updated").
- [ ] (8e) Validation: lat ∈ 33.0–38.7, lng ∈ 124.6–131.0 (when non-null); highlights/images = arrays of non-empty strings; visit_basics/convenience/smart_notes = object-or-null (treat `{}` as null, Empty-Object Rule); names_other_locales/matching_profile/poi_meta = object; integers for default_stay_minutes/builder_profile_version; reject unknown columns.
- [ ] (8f) Defensive override-pin helper `lib/admin/poi-override-pins.ts` — reads `poi-image-overrides.mjs` only if present; returns empty `Set` on `main`; activates when dq branch merges.
- [ ] (8g) `app/admin/match-pois/page.tsx` + `_components/` (list pane + editor pane) + `_hooks/` (list hook + single-row hook + save). List pane: search + region-cluster filter (busan/jeju) + is_attraction filter + thumbnail/poi_key/name. Editor pane: sticky header + Save + dirty-tracking + Sonner toasts; sections **Identity / Location / Image / Content / Matching profile**; jsonb rendered as structured sub-forms (names_other_locales, highlights/images string-list) + validated JSON textareas (visit_basics, convenience, smart_notes, matching_profile, poi_meta); override-pinned badge + "a re-seed wins" note in the Image section.

**Acceptance:**
- [ ] `npm run build` green.
- [ ] `/admin/match-pois` loads behind admin gate; lists `match_pois` (84 attractions, junk `_`-rows excluded); search + region + is_attraction filters work.
- [ ] Editing a row + Save round-trips through the upsert API and persists (re-fetch shows the change).
- [ ] A brand-new `poi_key` INSERTs via the same auto-upsert PATCH; an existing one UPDATEs.
- [ ] SQL data-quality self-check after edits: no new out-of-range lat/lng, no new empty-`{}` structured fields introduced by the editor (Empty-Object Rule applied), `is_operational`/`created_at`/`updated_at` never written.
- [ ] (deferred) `npm run itinerary:poi-audit --strict` once the dq branch merges to confirm no Signal-A defects — not runnable on `main`.

**Cut-line:** Ops can browse + edit the POI catalog from the admin dashboard. Image edits to override-pinned POIs are flagged as re-seed-overridable. No schema changes; no impact on the live builder beyond the data it already reads.

---

### Phase 9 — Pricing policy overhaul (pricing track) (3-5 days)

**Per D12-D14 2026-05-22:** full rewrite of the private-tour quote pricing to match the real AtoC pricing policy (`pricing_update_instructions.md`). This **replaces the Phase 5 placeholder model** (continuous per-hour/per-km/per-poi over DB `quote_presets`) with a **language-tier × duration-bucket base table + pax-tier surcharge + region surcharge** model. Branch: `feat/itinerary-builder-pricing` (off `main`, isolated worktree per `feedback_worktree_isolation.md`).

**Deliverable:** new pricing model live in the builder — customer picks guide language + tour duration + party size (+ Jeju pickup zone); a **real-time price** shows in the builder/QuoteModal; the server recomputes the identical authoritative number at submit. Seoul region + DMZ fixed-price product added. Exclusion / Jeju single-region / regional-surcharge notices shown in 6 locales.

**Pricing model (single source of truth = `lib/quote-engine/pricing-policy.ts`, imported by BOTH client and server):**

1. **Guide-language tiers** (locale → tier): `english` = {en, ja, es}; `chinese` = {zh, zh-TW, ko}; `smart_guide` = **hidden** (`visible:false`) AI-assisted tier with a **Korean-speaking** guide (NOT Chinese — D13 user correction), priced `chinese + ₩20,000` at every bucket.
2. **Base price by (tier, hours)** — KRW, covers 1-6 pax:
   - English: 4h 220k / 5h 250k / 6h 280k / 7h 310k / 8h 340k / 9h 370k / 10h 410k / 11h 450k / 12h 490k. Beyond 12h: **+₩40,000/h**.
   - Chinese: 4h 170k / 5h 190k / 6h 210k / 7h 230k / 8h 250k / 9h 270k / 10h 300k / 11h 330k / 12h 360k. Beyond 12h: **+₩30,000/h**.
   - Smart Guide = Chinese + ₩20,000 per bucket; beyond-12h +₩30,000/h.
   - (The "+₩40k/h (En) / +₩30k/h (Cn) beyond 9h" doc rule is already baked into the 10-12h table values; the per-hour rate only re-applies for >12h extrapolation. Min hours 4, or 6 for Solati.)
3. **Pax tier surcharge** (added to base) + vehicle: 1-6 = ₩0 (sedan/SUV); 7-9 = **+₩50,000** (van); 10-13 = **+₩150,000** (Solati, **peak season +₩200,000**), **min 6h constraint**; 14+ = multi-vehicle → **out of scope → manual escalation** for regular tracks (the doc's "repeat 1-6 vehicle" rule is underspecified; DMZ has its own 14-28 formula).
4. **Region surcharge** (added once, the max documented surcharge among zones the cart touches):
   - Seoul cluster: Gyeonggi (Pocheon/Gapyeong…) **+₩30,000**; Gangwon (Chuncheon/Gangneung/Sokcho…) **+₩50,000**. Tolls/parking = customer-paid (notice only).
   - Busan cluster: Yangsan **+₩30,000**; Gyeongju/Ulsan/Miryang **+₩50,000**; Geoje/Tongyeong **+₩70,000**. Tolls/parking included.
   - Jeju cross-region: cart spans ≥2 of {East, West, South} (classified by coordinates) → **+₩60,000**. Tolls/parking included.
   - Jeju pickup zone (user-selected): City ₩0 / North (Hagwi·Samhwa·Samyang·Aewol) **+₩40,000** / Outer (Hyeopjae·Jocheon·Seongsan·Seogwipo) **+₩60,000** / Cross-island (150km+) **+₩30,000**.
5. **DMZ** — fixed by pax, **no** language/duration/surcharge/Solati/peak: 1-3 630k / 4 710k / 5 750k / 6 780k / 7 830k / 8 870k / 9 920k / 10 960k / 11 1,010k / 12 1,040k / 13 1,100k / 14 1,730k / 15-28 = 1,730k + (pax-14)×70k. >28 → manual.
6. **Not-included notice** (UI, all surfaces): meals + attraction entrance tickets paid separately on the day. **Jeju single-region notice**: one region/day; 2 regions +₩60k.
7. Per-km / per-poi pricing from Phase 5 is **removed** (the new model has none). Duration is **customer-chosen**, decoupled from the cart's drive+stay estimate (the estimate becomes a *recommended-hours hint*).

**Tasks:**
- [x] (9a) `lib/quote-engine/pricing-policy.ts` — typed model above + pure `computePrice(input)` + `evaluateConstraints(input)` (Solati min-6h, 14+ manual, DMZ caps) + unit tests covering every doc example (En/Cn × 4-12h, each pax tier, each surcharge, DMZ table, smart guide, Jeju cross-region).
- [x] (9b) Refactor `lib/quote-engine/{types,compute,classify}.ts` onto the policy; extend `QuoteIntake` (guide_language, duration_hours, pax, region, jeju_pickup_zone, peak_season, track incl. `dmz`). Keep `fingerprint`/`memory-lookup` for the manual-escalation precedent path.
- [x] (9c) Rewire `POST /api/itinerary/quote` — accept new inputs, authoritative recompute via policy, DMZ branch, 14+/>caps → `pending_manual` + Slack, persist new `auto_quote_breakdown` shape. `PRICING_AUTOQUOTE_ENABLED` env kill-switch (R6).
- [x] (9d) `lib/itinerary-builder/regions.ts` — surface Seoul in the builder region list; `jejuZone(lat,lng)` → East/West/South/City; `subRegionSurcharge(region)` map for Seoul/Busan clusters. Spot-check against known POIs.
- [x] (9e) `IntakeForm` — add Seoul region + DMZ entry; explicit tour-duration selector (4-12h, private); guide-language selector → price tier; carry params to builder URL.
- [x] (9f) `QuoteModal` (+ live-price component) — real-time estimate via the **same** policy module; Solati 4h/5h disable for 10-13 pax; Jeju pickup-zone selector; not-included + Jeju single-region + per-line surcharge breakdown shown; submit confirms the identical amount.
- [x] (9g) DMZ fixed-price product — builder entry + pax→price (no POI building required), engine branch, persisted quote, breakdown card.
- [x] (9h) i18n — author EN for all new strings, **transcreate** (native tone first, NOT literal — D13) into ko/ja/zh/zh-TW/es, push to locale storage; update `/thanks` + `quote-confirmation` email for the new breakdown shape.

**Acceptance:**
- [x] `npm run build` green; `pricing-policy` unit tests pass (30/30).
- [x] Every doc pricing example reproduced exactly (30 unit tests in `__tests__/lib/quote-engine/pricing-policy.test.ts`): English 8h/2pax/Busan-city = ₩340,000; Chinese 6h/8pax/Gyeongju = 210k+50k+50k = ₩310,000; Solati 10pax 5h **blocked**; DMZ 7pax = ₩830,000; Jeju 6h English East+South + outer pickup = 280k+60k+60k = ₩400,000.
- [x] Live price in the builder == server-recomputed amount **by construction** — both call the same `lib/quote-engine/pricing-policy.quote()` (client useMemo + server route). (End-to-end browser confirmation pending — see interactive-QA note.)
- [x] Not-included + Jeju single-region notices present in all 6 locales (doc §5/§6 wording verbatim where given; rest transcreated) — verified by reading the merged keys. (Browser render pending QA.)
- [x] Smart Guide tier is absent from the UI (`SMART_GUIDE_VISIBLE=false`, no UI option) but priced in the policy for a future flip.
- [ ] **Interactive QA (pending):** browser preview was blocked by the contended dev environment (user's own dev server on :3000 + multiple worktrees; `preview_start` couldn't bind). Verify in browser: `/itinerary-builder` 3 tracks + 3 regions + guide/duration controls; `/itinerary-builder/seoul?track=dmz` panel → modal shows ₩630,000 (2pax) → ₩830,000 (7pax); a Jeju cart live price + notices in a non-EN locale.

**Cut-line:** New pricing policy is live and authoritative for busan/jeju/seoul private + cruise + DMZ. Smart Guide stays hidden until ops flips it on.

---

### Phase 10 — Flow simplification + card-hold booking (flow track) (5-6 days)

**Per D16-D26 2026-05-29:** This is a spun-off planner. Full
specification, decisions, risks, telemetry, runbook, and per-phase
checklists live in
[`docs/itinerary-builder-flow-simplification-master-plan-2026-05-28.md`](./itinerary-builder-flow-simplification-master-plan-2026-05-28.md).

**Deliverable:** the customer reaches "card on file booking" in ≤2
clicks from a home idle-preview chip; in-scope itineraries create a
`bookings` row with PI/SI populated, zero ops touch; out-of-scope (14+
pax / >28 DMZ) gates to a mailto with NO DB write; ops sees builder
bookings inside `/admin/orders` with a `source` filter; the entire
Phase 4/5 quote pipe (`/api/itinerary/quote`, `/admin/itinerary-quotes`,
Slack escalation, `quote_memory` precedent system) is deleted.

**Sub-phases (mirroring §D of the spin-off planner):**
- [x] (10.1) Planner registration + decision lock-in — `8bef20be` (D16-D26 + §F Phase 10 entry + spin-off doc).
- [x] (10.2) Schema migration `bookings.currency` / `source` / `itinerary` + Stripe currency stack (checkout, webhook, recapture-holds cron, NoShowHoldCardForm generalization, `createBuilderBooking()` helper, settle endpoint verified) — `2cbe643e` · 47/47 tests green · build green · migration applied to prod-mirror.
- [x] (10.2.1) Audit fixes #1–4 (5 finder agents + 1 sweep + DB verification 2026-05-29): `resolveAmount` honors explicit currency even when amountMinor missing · `safePax()` clamps NaN/Infinity/negative pax · `itinerary.pax === number_of_guests` invariant · DMZ duration_hours=0 email regression. Phase 6 plan extended with 6c (currency-aware admin/customer formatters) + 6d (builder cancellation email parity). Pre-existing recapture-holds idempotencyKey bug spun off as separate follow-up. — `f652559e` · 57/57 tests green · build green.
- [x] (10.3) Unified planner shell — `PlannerTopRail` + `LivePriceCard` + collapse `/itinerary-builder/[region]` → `?region=`; QuoteModal slimmed to contact-only; IntakeForm deleted. — `697477e3` · -518 LOC net · browser-verified (PlannerTopRail chip + LivePriceCard ₩250k + 308 redirect with param forwarding) · tsc clean · build green.
- [x] (10.3.1) Premium design upgrade for the right rail (user request 2026-05-29): Sparkles eyebrow + amber accent rail + white-surface preset chips with amber hover + navy primary "추천받기" CTA (was white-outline) in AIRecommendPanel; amber gradient + tighter total separator + amber info icons in LivePriceCard; white-card empty state with amber circular MapPin in ResultTimeline. No italic anywhere. Landing-card tokens throughout (rounded-card / rounded-button / focus-ring / homeBtnPrimary / layered shadow scale). — `1dcc3366` · tsc clean · browser-verified in mobile + desktop viewports.
- [x] (10.3.2) Phase 3 audit checkpoint — 5-finder + verify surfaced 7 real regressions, all fixed: **#1 CRITICAL** FormBody inline component caused focus loss + Korean/Japanese IME breakage on every URL keystroke (fix: `function FormBody` → `const renderForm = () =>` called as `{renderForm(false)}`); **#2** region switch left stale `?pois=` cart (fix: patch() drops pois on region change); **#3** track switch left orphan hours/ship/port/duration (fix: patch() cleans inverse-track params); **#4** Solati 6h auto-bump ignored cruise `hours` (fix: effect reads relevant param per track); **#5** invalid `?region=incheon` silently fell back without URL correction (fix: server-side `redirect()` canonicalization); **#6** `?region=jeju&track=dmz` rendered contradictory state (fix: server forces region=seoul when track=dmz); **#7** sitemap legacy `/itinerary-builder/{region}` entries (fix: canonical `?region=` form). Browser-verified all 4 critical cases. Lower-tier findings (livePrice memo too broad, AnimatePresence pre-existing exit-anim skip, empty `?party=` rescue, `?track=cruse` typo) deferred — not blocking Phase 4. — `929bbfcb` · tsc clean · build green.
- [x] (10.4) Auto-run AI recommendation on mount (debounced 500ms); cart directly populated via the same `acceptRecommendation` callback; per-session cap 3 fires via sessionStorage `itinerary_auto_run_count`; dedup fingerprint = `(region|track|maxHours|intent)` so pricing-irrelevant URL changes (ship name, pickup zone, port) don't re-fire; "Apply this day" CTA conditionally hidden when cart matches recommendation; AIRecommendPanel's hours `<select>` REMOVED (PlannerTopRail's duration/hours is single source via `useSearchParams`). 4 telemetry events: `itinerary_auto_recommend_{fired,succeeded,failed,exceeded}`. — `51a27c2d` · 63/63 tests green (+6 isSameKeySet) · tsc clean · build green · browser-verified at worktree dev :3300 (intent=temples+and+markets → 0 clicks → 500ms → cart auto-loaded with 4 markets/temples, `?pois=` URL written, autoRunCount=1).
- [x] (10.4.1) Premium re-do (user feedback 2026-05-29 — "그냥 흑백에 입체감도 없고… 노란색은 뭐야 뜬금없이"). Page bg → `bg-stone-50` (warm gray) so cards float visibly. All three right-rail cards (AIRecommendPanel, LivePriceCard, ResultTimeline EmptyState) share one borderless mint surface `bg-emerald-50/50` + layered shadow + `transition-shadow hover:` for floating feel. Amber removed from every surface/border/separator/icon: eyebrow `text-amber-700` → `text-slate-500` + Sparkles icon `text-emerald-600`; LivePriceCard total separator `border-amber-200/80` → `border-emerald-200/40`; notice-card amber info icons → slate; EmptyState amber circular bg → white floating disk with emerald icon. Preset chips: white pill with neutral-slate layered shadow + hover-lift (was amber-300 ring); intent input: white inset-shadow surface (was border + slate-50/60). — `19220277` · tsc clean · build green · browser-verified mobile 414×896 (three mint cards float clearly on warm-gray bg, no amber accents, navy CTA preserved).
- [x] (10.5) `/api/itinerary/book` + `/itinerary-builder/checkout` + `/itinerary-builder/confirmation/[id]` + `builder-booking-confirmation.ts` email + price-mismatch defense (409); **delete** entire quote pipe + INSERT-trigger safety migration. — Phase 10.5a `4bc11bf4` (+968 LOC: API, server-authoritative recompute, OOS-422, mismatch-409, kill-switch, checkout server page + URL-only handoff, CheckoutCardClient, confirmation page with stop strip + breakdown, fleshed email template). 10.5b `72755e39` (+92 / -300 LOC: QuoteModal.submit → /api/itinerary/book + status-aware error surface, ResultTimeline + DMZ panel autoQuotable gate + mailto, EN+KO i18n CTA wording, thanks page deleted). 10.5c `bac9a5fc` (-1,290 LOC destructive: /api/itinerary/quote, /admin/itinerary-quotes/*, /api/admin/itinerary-quotes/[id]/respond, AdminQuoteRespondForm, quote-confirmation email, lib/slack/notify-quote, lib/quote-engine/{fingerprint,memory-lookup,types} all deleted; migration `20260529001000_block_quote_table_writes.sql` applied — verified `INSERT INTO tour_quote_requests` raises P0001 with HINT pointing to /api/itinerary/book). **Net -230 LOC** while shipping the full booking-card-hold flow. 63/63 tests green, tsc clean, build green (4 builder routes: /, /[region]→308, /checkout, /confirmation/[bookingId]). Browser-verified end-to-end: `?intent=` → auto-recommend → cart populated → Book CTA → POST /api/itinerary/book → bookings row created with currency='krw' source='itinerary_builder' → checkout page renders LivePriceCard + NoShowHoldCardForm in KRW.
- [ ] (10.6) `/admin/orders` source filter + builder-row itinerary section; remove `/admin/itinerary-quotes` sidebar entry.
- [ ] (10.7) i18n hand-edit for all new keys × 6 locales (per `feedback_i18n_translate_script_drops_keys`).
- [ ] (10.8) Cut-over per §M runbook (pre-cut / cut / 72h post-cut / 30d / 90d follow-ups) + mark Phase 10 ✅.

**Acceptance:** See §G of the spin-off planner — 11 ALL-of criteria
(customer ≤2-click flow, in-scope bookings have PI/SI, out-of-scope
zero-DB gate, ops single-queue, pricing module unchanged, KRW Stripe
end-to-end, USD regression preserved, form snapshot tests, build/tsc
green, 6-locale parity, 72h observation passes).

**Cut-line:** The "10 proposals = 하루 다 가" ops pain is gone; builder
bookings live in the same `/admin/orders` queue as tour-product
bookings; settlement uses the existing `/api/admin/orders/[id]/settle`
endpoint with no new ops form to learn.

---

## G · Cross-phase concerns

### G.1 — i18n
- POI name jsonb structure: `name_en` (column), `name_ko` (column), `names_other_locales: {ja, zh, zh-TW, es}` jsonb (one column). Keeps `match_pois` slim.
- UI strings under `messages/<locale>.json` key `itineraryBuilder.*`.
- Per memory `feedback_home_visual_energy.md`: home v2 amber eyebrow / dark Process / restraint rules also apply to itinerary builder UI.

### G.2 — Mobile
- Map+cart side-by-side: tablet+ only. Mobile: map fills viewport; cart slides up as bottom-sheet (50%/90% snap points); pin popup → modal not InfoWindow.
- Test iOS Safari quirks with Google Maps inside scroll containers early.

### G.3 — Performance
- 100+ markers without clustering tanks initial paint → `@googlemaps/markerclusterer` mandatory.
- Default image preload only for the first ~10 in-viewport markers.

### G.4 — Analytics
- Reuse `src/design/analytics.ts`. New events: `itinerary_builder_open`, `poi_pin_click`, `poi_add_to_cart`, `poi_drag_reorder`, `itinerary_ai_request`, `itinerary_quote_submit`.

### G.5 — Photo policy (per memory)
- All new POI photos for `match_pois.default_image_url` follow `feedback_photo_quality_policy.md`: 16:9 / OTA bright / no AI feel / sharp quality 95 / no watermarked sources.
- Photos already in `/public/images/itinerary/*.webp` (Jagalchi, Tongdosa, Bomun, Woljeonggyo, Seoraksan, Bukchon, Songdo, Songaksan) are reusable.

---

## H · Risks (carried from audit; update as we hit them)

| # | Risk | Mitigation | Realized? |
|---|---|---|---|
| R1 | POI profiles derived from tour profiles are lossy | Ship derived, instrument click-through, manually retune worst | — |
| R2 | Mobile UX hard (map+cart+popup) | Phase 3 desktop-first to soft URL; Phase 4 adds mobile sheet | — |
| R3 | Distance Matrix API cost at scale | Haversine for previews; Distance Matrix only at quote submit | — |
| R4 | Manual tuning is long-tail | Ship Phase 7 derived-only; tune bottom 10% based on engagement | — |
| R5 | `poi_search_profile` (TourAPI) overlap | Treat as separate; revisit post-MVP | — |
| R6 | **Auto-quote engine (Phase 5) misconfigures pricing rules → wrong auto-quote sent to customer** | Hard threshold: auto-quote requires ALL preset rules satisfied (any uncertainty → escalate). Email user before any payment step. Admin sees auto-quotes-issued log daily. Dry-run mode for new presets before enabling `active=true`. | — |
| R7 | **`/tours` restructure (Phase 3) breaks SEO from inbound links to legacy private-tour slugs** | 301 redirects from all 5 legacy slugs → builder route or selector. Audit Search Console for top inbound URLs before deletion. Keep redirects live ≥ 12 months. | — |
| R8 | **Auto-translation pipeline (Phase 3 D6) produces awkward KO/JA/ZH copy** | Human review pass on `ko` (highest traffic) before merge. `ja/zh/zh-TW/es` flagged for async review; gate locale-switcher visibility on review-complete flag if needed. | — |
| R9 | **Quote-memory precedent reuse misleads ops** (old quote for different party size used as anchor) | Fingerprint MUST include party_size_band + hours_band + has_premium_poi flags. Slack message shows precedent confidence score, never auto-applies the price. | — |

---

## I · Cost estimate

Revised 2026-05-16 after §B decisions D1-D8 — Phases 3/4 expanded, new Phase 5 added.

| Phase | Person-days | Cumulative |
|---|---|---|
| 1 — POI catalog seed (jeju + busan) | 1-2 | 1-2 |
| 2 — Coordinate enrichment | 0.5-1 | 1.5-3 |
| 3 — Map UI + `/tours` restructure + home v2 entry + i18n pipeline | 3-4 | 4.5-7 |
| 4 — Q&A intake (private/cruise) + cart + manual quote | 3-4 | 7.5-11 |
| 5 — Auto-quote engine + presets + Slack escalation + memory | 3-5 | 10.5-16 |
| 6 — POI matching_profile derivation | 1-2 | 11.5-18 |
| 7 — AI recommendation engine | 2-3 | 13.5-21 |
| **Total (full feature, jeju+busan MVP)** | **13.5-21 days** | **~3-4 weeks focused** |
| Polish + Seoul rollout post-MVP | +3-7 days | **4-5 weeks total** |

**Cost delta vs original plan** (was 8.5-14 days): +5-7 days from D4 auto-quote engine (3-5d new) + D7 `/tours` restructure (~1d added to Phase 3) + D8 cruise branch + Q&A intake (~1d added to Phase 4) + D6 i18n pipeline (~0.5d added to Phase 3).

---

## J · Original audit findings (frozen — do not edit)

Captured at audit completion. If facts change, write a new dated section below with `### J.2 audit update 2026-XX-XX` rather than mutating this section.

### J.1 — 2026-05-16 audit

**Matcher v2:**
- `parser.ts` + `parser-haiku.ts` + `parser-rule.ts` — Gemini Haiku 4.5 + rule fallback; output `ParsedQueryV2` (regions, sub_regions, months, season_locks, personas, themes, anchor_pois_mentioned, pace, format, duration_constraint, user_max_hours, hard_constraints, wants_cruise, wants_charter_customization, is_multi_day_request, boost_dimensions, negative_signals, confidence, parser_notes, _telemetry).
- `matcher.ts` — 8 score components: anchor_poi_match (6.0/POI), boost_dimension_sum, theme_overlap (Jaccard×3.0 + count×1.0), persona_alignment (±4.0 to ±6.0), sub_region_match, season_lock_match (2.0/lock), format_match (0.5-2.0), a_grade_bonus (0.5), slug_token_match (0.7/token), charter_intent_match (6.0), negative_signal_penalty (−4.0/match).
- `matching_dimensions_taxonomy.json` — multilingual taxonomy (regions, sub_regions, seasons, season_locks, personas, themes, hard_constraints, anchor_pois).
- Pipeline: `hardFilter` → `scoreTour` per tour → sort with tie-break → signal-strength gating → hybrid score floor → `match_status` classification.
- Tests in `__tests__/lib/tour-match-v2/`: smoke, parser-rule-month-preserve, seasonal-gate, signal-strength. Stress corpus in `data/scenarios/a-*.ts` through `k-*.ts`.

**Tour content:**
- 34 tours × 6 locales = 204 JSON files under `components/product-tour-static/**/`.
- 102 unique `_poi_meta.poi_key` values; 157 unique stop names.
- itineraryStops fields: name, time, duration, number, category, _poi_meta (poi_key, sources, verified, kb_version), highlights, smartNotes, visitBasics, convenience, description, whyOnRoute, image, images, imageCredits, galleryItems, liveStatusWidget, timeUsed.
- routeFlowStops = minimal derived view (name, theme, type only). Ignore for catalog.
- POI consistency across parent tours: name/category/description/highlights identical; whyOnRoute is per-tour context.
- 12 of 204 files have lat/lng — but only on `pickup_dropoff.departure/return`, NOT on itineraryStops.

**Supabase:**
- `match_tours` — 30 tours × ~6 locales. Per-tour `matching_profile` (jsonb), arrays for themes, best_for, anchor_poi_keys. Embedding column unpopulated.
- `match_pois` — 84 rows, mostly EMPTY except poi_key. Designed as POI catalog.
- `match_itinerary_stops` — 208 rows, metadata-only (no body content).
- `poi_search_profile` — 576 rows, KO-locale, TourAPI content_id keyed, mostly empty tags. Separate system.
- `pickup_points` — 0 rows. Has lat/lng columns ready.
- PostGIS not enabled (pgvector is, for future semantic search).

**Map:**
- `@react-google-maps/api 2.20.7` installed. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` configured.
- `components/maps/HotelMapPicker.tsx` — modal Places Autocomplete picker.
- `components/product-tour-static/_shared/TourPickupMapSection.tsx` — read-only pickup map.
- `lib/google-maps.ts` — `geocodeAddress`, `reverseGeocode`.

**Private-tour surface:**
- 5 private-tour product pages live as static JSON detail routes (busan / jeju / seoul-suburbs / incheon-seoul / seoul-dmz).
- `/match` page exists (hero matcher result).
- No dedicated "build your own" route yet.

---

## K · Glossary

| Term | Meaning |
|---|---|
| POI | Point of interest — an itinerary stop that's a real visitable place (vs. operational stops like pickup/lunch/return) |
| `poi_key` | Stable slug identifier for a POI, e.g., `tongdosa_temple`. Lives in `_poi_meta.poi_key` and `match_pois.poi_key` |
| matching_profile | A jsonb of numeric dimension scores (0-5) that describe how well a tour or POI satisfies different traveler preferences (scenic, family-friendly, cherry-blossom, accessible, etc.) |
| Matcher v2 | The current production matcher in `lib/tour-match-v2/` — Gemini Haiku intent parser + dimension scoring |
| Hard filter | Pre-scoring elimination based on hard constraints (region, season-gate, cruise, wheelchair) |
| Signal strength | Classification of how confident the parsed intent is (strong/moderate/weak/empty), used to gate match aggressiveness |
| Cut-line | The point at which a phase delivers a shippable artifact and we can pause without throwing work away |
