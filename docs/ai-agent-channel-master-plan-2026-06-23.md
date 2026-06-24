# AI Agent Channel — Master Plan (2026-06-23)

Goal: make AtoC Korea **discoverable, fetchable, and bookable by AI agents** —
a dedicated "tunnel entrance" so an assistant can find a tour, price it, and
carry the traveller to checkout. Two design pillars:

1. **Be discovered** — explicit crawler welcome, `llms.txt`, richer structured data.
2. **Be trusted** — deterministic signed prices, a documented contract, and a
   payment boundary where the **human confirms and pays** (agents never charge cards).

The agent's journey: **① Discover → ② Fetch/Understand → ③ Trust/Book.**

---

## ⚠️ Reorientation (2026-06-24) — read this first

After Phase 0–5 we course-corrected. The near-term reality is **read-the-web
agents** (ChatGPT search, Perplexity, Gemini, Google AI Mode, Operator) that
crawl and parse the **rendered consumer pages** — they do NOT call a bespoke
JSON API. So the highest-ROI work is making the **existing tour pages**
maximally AI-readable and trustworthy, not a separate agent API.

- The `/api/agent/*` REST channel + MCP server (Phase 1–5) are kept as
  **future infrastructure** (valuable when OTA×AI direct-integration arrives,
  e.g. Booking×OpenAI) but are **not** the current priority. Not deleted.
- Current priority = the consumer page's machine structure. Audit found the
  *content* is already strong (real FAQ, real review bodies, pricing
  transparency, best-for/not-for, pickup w/ coords); the gaps are *structural*.

### Phase 6 — AI-readable page schema ✅ (shipped 2026-06-24)
`lib/seo/tourProductJsonLd.ts` enhanced (existing data only, no page rebuild):
- **Individual `Review`** objects (author, body, rating, date) — was aggregate-only.
- **`Offer`**: `priceValidUntil`, price-basis `priceSpecification` (per
  person/vehicle), and `cancellationPolicy` (refund terms next to price).
- **`TouristTrip`**: ISO-8601 `duration`, `touristType` (from best-for).
- **`BreadcrumbList`** block.
Verified: tsc + ESLint clean; runtime check on representative input passes.

### Phase 6 — still open (next, by ROI)
- **Deep-linkable booking URL** on the detail page: `?date=&guests=&language=&course=`
  pre-fills the booking card (the user's priority #5).
- **Structured fields** in the data model: `languages[]`, min/max group size,
  `tourType` enum (currently narrative text only) → then add `inLanguage` /
  participant count to JSON-LD.
- **Reviews content**: some products ship `guestReviews: []` — backfill.
- `ItemList` JSON-LD on `/tours/list`.

---

## Decisions (locked)

- **D1 — Payment model:** human confirms at hosted checkout. The agent channel
  hands off a `checkout_url`; no card is charged by an agent. (Lowest trust/risk
  cost for v1.)
- **D2 — Catalogue source:** the static product registry (`STATIC_TOUR_PRODUCTS`,
  same set the sitemap advertises). Deterministic, no DB round-trip,
  consumer-visibility filtered.
- **D3 — Price integrity:** HMAC-signed, 15-min `quote_token`. The book step
  rejects altered/expired quotes. Final amount reconfirmed at checkout.
- **D4 — No new coupling to the live booking pipeline:** `/api/bookings` and
  `/api/itinerary/book` are origin-locked + inventory-coupled by design. v1 stays
  on the safe side and hands off rather than writing booking rows directly.

---

## Phase 0 — Discovery visibility ✅ (shipped 2026-06-23)

- `app/robots.ts` — named AI agents explicitly welcomed (GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, Applebot-Extended, etc.); `/api/agent/` and
  `/llms.txt` allowed; private dashboards still blocked. Added `host`.
- `app/llms.txt/route.ts` — `/llms.txt` front door: site summary + agent API +
  OpenAPI + live tour list (Markdown, llms.txt convention).
- `lib/seo/tourProductJsonLd.ts` — added a `TouristTrip` JSON-LD block
  (travel-native schema) alongside the existing Product/Offer/FAQ.
- `app/sitemap.ts` — `/for-agents` added.

## Phase 1 — Agent API v1 + OpenAPI + docs ✅ (shipped 2026-06-23)

- `lib/agent/catalog.ts` — projects the static registry into a machine-first
  shape; `agentSiteUrl()` canonical host helper.
- `lib/agent/quoteToken.ts` — HMAC-signed quote tokens (sign/verify, 15-min TTL,
  constant-time compare). Secret: `AGENT_QUOTE_SECRET` (falls back to
  `NEXTAUTH_SECRET` → service-role key → dev secret).
- `app/api/agent/v1/tours/route.ts` — `GET` catalogue (region/search/limit/offset),
  CORS-open, edge-cacheable.
- `app/api/agent/v1/tours/[slug]/route.ts` — `GET` one tour + booking pointers.
- `app/api/agent/v1/quote/route.ts` — `POST { slug, date, guests }` → signed quote.
- `app/api/agent/v1/book/route.ts` — `POST { quote_token, contact? }` →
  `checkout_url` handoff (human pays).
- `app/api/agent/openapi.json/route.ts` — OpenAPI 3.1 contract.
- `app/for-agents/page.tsx` — human+machine developer guide / trust surface.

**Verification:** `tsc --noEmit` → 0 errors repo-wide; ESLint clean on all new files.

### Env to set in production
- `AGENT_QUOTE_SECRET` — stable HMAC key for quote tokens (rotation-controlled).

### The v1 flow
```
GET  /api/agent/v1/tours?region=jeju&search=unesco
GET  /api/agent/v1/tours/{slug}
POST /api/agent/v1/quote   { slug, date, guests }      -> { quote_token, ... }
POST /api/agent/v1/book    { quote_token, contact? }   -> { checkout_url }   (human pays)
```

---

## Phase 2 — MCP server ✅ (shipped 2026-06-23)

- `app/api/agent/mcp/route.ts` — Streamable HTTP, stateless JSON-RPC 2.0 MCP
  server (no SDK dependency). Implements `initialize`, `tools/list`,
  `tools/call`, `ping`, notifications; `GET` advertises capabilities; CORS-open.
  Tools: `search_tools` → **`search_tours`**, `get_tour`, `quote_price`,
  `create_booking` — reusing the same catalog/quote/checkout logic as REST.
- `lib/agent/checkoutUrl.ts` — shared checkout-handoff URL builder (REST + MCP
  single-sourced; `book` route refactored onto it).
- Discovery: MCP URL added to `/llms.txt`, `/for-agents`, and OpenAPI
  `x-agent-channel.mcp`.

## Phase 3 — Agent-safe reservations + hardening ✅ (shipped 2026-06-23)

- `supabase/pending-db-apply/2026-06-24-08-agent-reservations.sql` — **isolated**
  `agent_reservations` table (decoupled from bookings/inventory; service-role
  only, RLS on). **Not applied** — staged in the repo's `pending-db-apply`
  convention (filename + README manifest row) per instruction.
- `lib/agent/reservation.ts` — best-effort persistence with idempotency-key
  replay; **degrades gracefully** if the table doesn't exist yet, so the booking
  handoff never breaks.
- `lib/agent/rateLimit.ts` — in-memory fixed-window limiter with API-key tiers
  (`AGENT_API_KEYS` env, `x-api-key` header → higher limit). Per-instance
  courtesy throttle; documented as such.
- Wired into REST `quote` + `book` and the MCP endpoint. `book` / `create_booking`
  now accept an `Idempotency-Key` (header or body/arg) and return
  `reservation_id` + `idempotent_replay`.

## Phase 4 — Agent discovery manifests ✅ (shipped 2026-06-23)

- `app/.well-known/agent.json/route.ts` — channel manifest (payment model,
  endpoints, MCP, auth, pricing).
- `app/.well-known/ai-plugin.json/route.ts` — plugin-style manifest pointing at
  the OpenAPI contract, with a model-facing "never charge a card" instruction.
- Cross-linked from `/llms.txt` and OpenAPI `x-agent-channel.well_known`.
- **Note:** no real delegated-payment standard (Stripe Agent Toolkit / OpenAI
  ACP / Google AP2) is wired — those mean the agent charges, which conflicts with
  D1 (human pays). Left as an explicit future decision, not silently adopted.

### Env to set in production (additions)
- `AGENT_API_KEYS` — optional. Comma-separated `label:key` pairs to grant
  higher rate limits to trusted agents.

## Phase 5 — Availability + observability ✅ (shipped 2026-06-24)

- `lib/agent/availability.ts` — read-only inventory check (product_inventory −
  active bookings, default capacity fallback) reusing the service client. **No
  new SQL** — pure TS, mirrors POST /api/bookings. Returns
  `available | sold_out | unknown`; never holds inventory or charges.
- `app/api/agent/v1/tours/[slug]/availability/route.ts` — `GET …?date=` + the
  MCP **`check_availability`** tool.
- `lib/agent/events.ts` + `supabase/pending-db-apply/2026-06-24-10-agent-channel-events.sql`
  — best-effort telemetry (`quote_issued`, `booking_handoff`,
  `availability_checked`, `mcp_tool_call`). Degrades gracefully until applied.
  No raw IP stored.
- `supabase/pending-db-apply/2026-06-24-11-agent-reservations-updated-at.sql` —
  `updated_at` trigger for the reservations table.
- Surfaced in OpenAPI, llms.txt, `/.well-known/agent.json`, `/for-agents`.

### Staged SQL awaiting a connected session (apply in filename order)
- `2026-06-24-08-agent-reservations.sql`
- `2026-06-24-10-agent-channel-events.sql`
- `2026-06-24-11-agent-reservations-updated-at.sql` (after 08)

## Still open (future)

- Global (cross-instance) rate limiting via Upstash/Redis — current limiter is
  per-instance.
- Apply the staged SQL above, then optionally an admin view of leads + an
  agent-channel funnel dashboard reading `agent_channel_events`.
- Structured-data expansion: `ItemList` JSON-LD on `/tours/list`,
  `BreadcrumbList` on detail pages.
- Delegated payment (agent charges) — only if/when the business accepts the risk.

---

## Trust principles (why agents should transact with us)

1. Deterministic, server-authoritative, **signed** prices — agents can't invent numbers.
2. **No silent charges** — human confirms at hosted checkout.
3. **Documented, versioned contract** (OpenAPI) + `/for-agents`.
4. **Loud failures** — out-of-scope (party too large, past date) returns a clear
   error + contact path, never a wrong booking.
5. Open read/quote (no auth/key), CORS-open for browser-based agents.
