# AI Agent Channel — Master Plan (2026-06-23)

Goal: make AtoC Korea **discoverable, fetchable, and bookable by AI agents** —
a dedicated "tunnel entrance" so an assistant can find a tour, price it, and
carry the traveller to checkout. Two design pillars:

1. **Be discovered** — explicit crawler welcome, `llms.txt`, richer structured data.
2. **Be trusted** — deterministic signed prices, a documented contract, and a
   payment boundary where the **human confirms and pays** (agents never charge cards).

The agent's journey: **① Discover → ② Fetch/Understand → ③ Trust/Book.**

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

- `supabase/pending-db-apply/0001_agent_reservations.sql` — **isolated**
  `agent_reservations` table (decoupled from bookings/inventory; service-role
  only, RLS on). **Not applied** — staged for review per instruction.
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

## Still open (future)

- Global (cross-instance) rate limiting via Upstash/Redis — current limiter is
  per-instance.
- Apply `0001_agent_reservations.sql`, then optionally an admin view of leads.
- Structured-data expansion: `ItemList` JSON-LD on `/tours/list`,
  `BreadcrumbList` on detail pages.
- Real availability check in the agent channel (today pricing assumes default
  capacity; inventory lives in the origin-locked pipeline).
- Delegated payment (agent charges) — only if/when the business accepts the risk.

---

## Trust principles (why agents should transact with us)

1. Deterministic, server-authoritative, **signed** prices — agents can't invent numbers.
2. **No silent charges** — human confirms at hosted checkout.
3. **Documented, versioned contract** (OpenAPI) + `/for-agents`.
4. **Loud failures** — out-of-scope (party too large, past date) returns a clear
   error + contact path, never a wrong booking.
5. Open read/quote (no auth/key), CORS-open for browser-based agents.
