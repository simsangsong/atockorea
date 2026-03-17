You are a senior staff-level web engineer, product designer, conversion-focused UX architect, and travel-platform product marketer.

Your mission:
Renovate the entire ATOCTravel Jeju web app into a premium, calm, high-conversion Jeju-first travel platform using a strangler-pattern UI renovation strategy.

This is NOT just a visual redesign.
This is a full product-level UX/UI renovation for a Jeju pilot system that will later scale to Busan, Seoul, Japan, Taiwan, China, and other regional travel markets.

========================================
0. PRIMARY EXECUTION RULE
========================================
You must work in this order:
1. Audit current architecture first
2. Create safe design-system and adapter foundation
3. Replace presentation layer incrementally
4. Preserve all working backend/business/payment logic
5. Keep server as source of truth for time, price, status, booking rules

Do not start destructive rewrites.
Do not rewrite working backend logic unless absolutely necessary.
If something is risky, isolate it with adapters and feature flags.

Proceed phase by phase automatically unless a destructive decision is unavoidable.
Document everything in markdown files inside the repo.

========================================
1. PRODUCT POSITIONING
========================================
This platform is NOT a generic OTA-style product-list booking site.

It must feel like:
- a smarter way to plan Jeju travel
- a more comfortable alternative to crowded bus tours
- a more affordable alternative to full private charter
- a more trustworthy booking flow with clear rules

Primary positioning:
AI-planned Jeju tours with small-group comfort, hotel-area-aware pickup flow, and transparent booking rules.

What users should understand immediately:
- This site helps me avoid complicated planning
- It considers my hotel location
- It offers better comfort than standard bus tours
- It explains payment and confirmation clearly
- It looks premium and trustworthy

We are NOT selling "AI technology" as the hero.
We are selling:
- less planning
- less hassle
- smoother pickup flow
- more comfortable movement
- transparent booking rules

Support brand message:
"Starting with Jeju, expanding across Korea."

========================================
2. PRODUCT HIERARCHY
========================================
There are 3 top-level product types:

A. AI Private Tour
- AI plans the route
- no waiting for matching
- instant confirmation
- private comfort
- best for families / friends / premium travelers
- team pricing
- current private base pricing:
  - 1–6 travelers: KRW 398,000 per team
  - 7–13 travelers: KRW 698,000 per team
- UI may show per-traveler equivalent, but server remains source of truth

B. AI Small-Group Join Tour
- AI plans the route
- small-group comfort
- hotel-area-aware matching logic
- better than crowded bus tours
- more affordable than private
- deposit now, manual balance later
- key selling point is NOT "cheap"
- key selling point is "smoother and less tiring"

C. Classic Bus Tours
- fallback / secondary product only
- should never visually dominate the AI products

Relative hierarchy:
1. AI Private Tour
2. AI Small-Group Join Tour
3. Classic Bus Tours

========================================
3. BOOKING / PAYMENT / CONFIRMATION RULES
========================================
These rules are critical.
They must be visible in UI, not hidden only in policy text.

For Small-Group Join Tours:
- customer pays 20% deposit at booking
- deposit is refundable until 24 hours before departure
- at 24 hours before departure:
  - remaining balance opens
  - user must manually pay in My Tours / My Tour
- balance deadline is 18 hours before departure
- tour confirms once minimum required travelers complete balance payment
- never auto-charge the remaining balance
- no-show is non-refundable
- repeated customer-responsible late cancellations may temporarily limit new bookings
- once balance stage opens and final price is shown, displayed final price must not increase for remaining paid travelers

Mandatory trust copy:
"We will never charge your card automatically for the remaining balance. You need to complete it manually in My Tours."

For Private Tours:
- keep existing payment logic if working
- present price clearly
- present pickup surcharge clearly
- preserve working backend behavior

========================================
4. HOTEL AREA / PICKUP STRATEGY
========================================
Hotel area is NOT just a filter.
It is a core product rule and matching condition.

Hotel area must affect:
- input flow
- pickup surcharge
- join suitability
- route-fit messaging
- list filtering
- detail page explanation

Use hotel-area-first UX.

For Jeju public-facing logic, use simplified area tiers while preserving internal finer mapping.

A. Jeju City Core
- pickup included
- no surcharge

B. Near-city area
- examples similar to Oedo / Samhwa / Samyang-type side areas
- private surcharge: KRW 30,000
- join surcharge: KRW 5,000 per traveler

C. Outer area
- examples similar to Aewol / Hamdeok / Jocheon
- private surcharge: KRW 50,000
- join surcharge: KRW 8,000 per traveler

D. Remote area
- examples similar to Seongsan / Jungmun / Seogwipo / Hyeopjae / Andeok / Southeast Jeju / Sanbang area
- private surcharge: KRW 70,000
- join surcharge: KRW 10,000 per traveler
- join may be limited depending on area/route fit
- in some cases show:
  - "Private tour recommended"
  - "Join not available for this route yet"

Important:
Do not expose messy internal logic directly.
Internally we may map hotels to many detailed zones.
Externally keep it human-readable and simple.

Never use internal language like:
- zone logic
- rule-based matching
- semi-FIT routing

Prefer:
- Good match for your hotel
- Smoother pickup flow
- Additional pickup fee applies for your hotel area
- Private tour recommended

========================================
5. UX / COPY PRINCIPLES
========================================
The site must not sound overly technical.

Do NOT say:
- algorithmic optimization engine
- rule-based matching platform
- semi-FIT logic
- advanced intelligent routing engine
- dynamic behavioral pricing

Prefer:
- smarter route
- smoother pickup flow
- better fit for your hotel
- less hassle
- more comfortable than crowded bus tours
- secure your seat with a 20% deposit
- no automatic balance charge
- private tour recommended
- join not available for this route yet

The site should feel:
- premium but calm
- intelligent but human
- travel-first, not tech-first
- trustworthy, not flashy

========================================
6. DESIGN SYSTEM
========================================
Visual direction:
- bright background
- generous spacing
- clean premium travel UI
- subtle AI layer only
- Apple-like calmness + premium OTA trust + soft Jeju freshness
- absolutely avoid neon-heavy cyber/gaming look

Brand colors:
- Navy: trust / depth / primary headings
- Blue: action / active state / CTA
- Ocean/Teal: smart route / pickup-flow accent
- Green: confirmed / success
- Orange: waiting / balance due / caution
- Red: error / failed / deadline missed
- Neutral gray: disabled / muted / inactive

Use semantic roles, not raw hex values inside components.

Typography:
- Inter or Pretendard
- strong readability
- tabular numerics for times/prices/countdowns
- Hero heading should feel premium and spacious

Interaction rules:
- button min-height 44px
- visible focus rings
- status must never rely on color alone
- hover-only critical interactions are forbidden
- mobile-first layout is mandatory

Motion:
- subtle only
- 150ms–220ms ease-out
- opacity + small scale only
- no flashy motion
- do not imply backend actions that do not exist

========================================
7. PAGE-BY-PAGE PRODUCT SPEC
========================================

----------------------------------------
7.1 HOMEPAGE
----------------------------------------
Goal:
Sell a new, smarter Jeju travel mode, not just a list of products.

Required homepage sections:
1. Header
2. Hero
3. Trust strip
4. Why choose this over bus/private
5. Tour type cards
6. How it works
7. Preview itinerary
8. Destinations (Jeju live / Busan & Seoul coming soon)
9. Classic bus fallback section
10. Reviews
11. Final CTA
12. Footer

Header:
- left: logo
- nav:
  - AI Tours
  - Private Tours
  - Small-Group Join
  - Classic Bus Tours
  - My Tour
  - Help
- right-side main CTA:
  - Plan My Trip

Hero:
- premium but calm
- left:
  - headline
  - sub copy
  - compact planner input
  - micro trust points
- right:
  - preview card / itinerary mockup / pickup badge / price badge
- stacked mobile layout required

Suggested hero copy:
Headline:
"Plan less. Enjoy more of Jeju."
Alternative:
"A smarter, more comfortable way to tour Jeju."

Sub:
"Tell us your hotel, date, and travel style. We'll help you find the right Jeju tour — private, small-group, or budget-friendly."

Hero inputs:
- Destination
- Date
- Hotel / Hotel Area
- Guests
- Travel Style

Primary CTA:
- Plan My Trip

Trust strip examples:
- AI-built itinerary in minutes
- Smarter pickup flow
- 3–13 travelers only
- Transparent deposit and balance rules

Comparison section:
Title:
"Why travelers choose this over crowded bus tours or expensive private charters"
Compare:
- planning effort
- group size
- pickup efficiency
- comfort
- flexibility
- booking clarity
- price positioning

Tour cards:
Card 1: AI Private Tour
- AI-designed route
- instant confirmation
- your group only
- best for families / friends
CTA:
- Start Private Tour

Card 2: AI Small-Group Join Tour
- small-group comfort
- better pickup flow
- more affordable than private
- transparent deposit timeline
CTA:
- Join Small Group

Card 3: Classic Bus Tour
- smaller visual priority
CTA:
- View Classic Bus Tours

How it works:
1. Enter your hotel
2. We plan the best route
3. Choose your comfort level
4. Travel with less hassle

Preview itinerary:
Show example card with:
- title
- pickup area
- hotel-fit hint
- traveler count
- vehicle type
- deposit note
- balance opens 24h before departure

Destinations:
- Jeju — Available now
- Busan — Coming soon
- Seoul — Coming soon
Busan/Seoul cards must not be dead links.
Use muted state + notify/waitlist CTA.

Classic bus section title:
"Prefer a classic group tour instead?"

Reviews:
Use positioning-aligned reviews, not generic praise.
Examples:
- "Much easier than planning it myself."
- "More comfortable than a regular bus tour."
- "The pickup route made much more sense."
- "Felt smoother than I expected for a join tour."

Final CTA:
"Ready to build your Jeju trip the smarter way?"
CTA:
- Plan My Trip

----------------------------------------
7.2 TOUR BUILDER PAGE
----------------------------------------
Goal:
Wizard-like flow that feels easy, guided, and hotel-aware.

Layout:
Desktop:
- left: wizard form
- right: sticky live summary
Mobile:
- stacked step cards
- sticky summary / CTA where appropriate

Required steps:
1. Destination
   - Jeju active
   - Busan / Seoul visible as coming soon
2. Hotel search / hotel area
   - autocomplete
   - landmark chips
   - manual pin fallback if needed
   - instant feedback:
     - pickup area label
     - surcharge info
     - join availability hint
3. Date
4. Group size
5. Travel style
6. Preferred tour type
   - private
   - join
   - both
7. Optional notes

Live summary panel must show:
- destination
- hotel area
- date
- guests
- style tags
- preferred type
- surcharge preview
- short deposit rule note

CTA:
- Build My Tour

Do not overload users.
Use clear step progression and human copy.

----------------------------------------
7.3 LOADING PAGE
----------------------------------------
Goal:
Feel like a real trip is being prepared, not a generic spinner.

Forbidden:
- fake real-time matching claims if backend does not support them
- misleading loading language

Allowed copy examples:
- "Checking pickup flow near [Area]..."
- "Finding the best route for your hotel area..."
- "Looking for the best tour fit..."
- "Almost there..."

Visual:
- clean light background
- simple route/pickup/itinerary assembly visual
- max 3 stages

End:
- "Your trip is ready"

----------------------------------------
7.4 GENERATED TOUR LIST PAGE
----------------------------------------
Goal:
Show AI-curated results, not a chaotic OTA wall.

Top summary bar:
- destination
- hotel area
- date
- guests
- style tags
- edit search CTA

Primary filter order:
1. Hotel Area
2. Tour Type
3. Date
4. Group Size
5. Travel Style
6. Pickup surcharge level
7. Price

Section order:
- Recommended for you
- Private options
- Small-group options
- Classic bus fallback

Tour card requirements:
- title
- type badge
- tags
- pickup area
- match quality
- join status if join
- joined traveler count
- capacity
- surcharge line
- deposit/balance note
- CTA

Visible match quality labels:
- Great pickup match
- Good pickup match
- Slight extra travel time may apply

Visible join states:
- Waiting for more travelers
- Balance payment open
- Confirmed
- Missed deadline
- Private tour recommended
- Join not available for this route yet

Frontend must consume validated ViewModels, not raw legacy payloads.

----------------------------------------
7.5 TOUR DETAIL PAGE
----------------------------------------
Goal:
Reduce anxiety and explain why the tour fits the traveler.

Required structure:
- title / hero visual
- key badges
- price summary
- pickup area + surcharge
- why this fits you
- overview
- booking timeline
- cancellation policy
- who this is best for
- similar alternatives

Possible badges:
- AI Planned
- Small Group
- Private
- Verified Local Guide
- Transparent Booking Rules

Why this fits you examples:
- good fit for your hotel area
- smoother pickup flow
- fewer travelers than a bus tour
- better value than private

Booking timeline must be visual.

----------------------------------------
7.6 CHECKOUT PAGE
----------------------------------------
Goal:
Trust-first checkout with clear next steps.

Do NOT alter working payment execution logic.
Wrap it with better UI.

Layout:
Left:
- traveler info
- contact info
- hotel / pickup area confirmation
- payment method
Right:
- sticky order summary
- booking timeline
- reassurance box
- final CTA

Reassurance box:
Title:
"Secure Your Seat with a 20% Deposit"
Body:
"Pay a small deposit today to reserve your spot. No automatic balance charge. Free cancellation until 24 hours before departure."

Critical trust copy near CTA:
"We will never charge your card automatically for the remaining balance. You need to complete it manually in My Tours."

Order summary must clearly show:
- base tour price
- pickup surcharge as separate line item
- subtotal
- deposit due today
- remaining balance later
- final surcharge label if known

Suggested CTA:
- Reserve My Spot
or
- Pay Deposit

----------------------------------------
7.7 LOGIN / AUTH PAGE
----------------------------------------
Goal:
Low-friction access.

Preferred auth:
- Google
- Apple
- Email
- Guest checkout supported where compatible with existing logic

Benefit copy:
- manage your booking
- pay your remaining balance
- view your tour status
- get confirmation details

----------------------------------------
7.8 MY TOUR / MY PAGE
----------------------------------------
Goal:
Action dashboard, not generic account page.

Required tabs/sections:
- My Tours
- Payments
- Profile
- Support

Each tour card:
- title
- date
- pickup area
- status badge
- next step
- countdown if relevant
- remaining balance if relevant
- single primary CTA

Booking statuses:
- deposit_paid
- awaiting_balance
- balance_due
- confirmed
- cancelled
- refunded
- deadline_missed

Examples:
Status banner:
- Awaiting Balance Payment
- Confirmed
- Cancelled

Next actions:
- Pay Balance Now
- View Booking Details
- View Pickup Information
- Rebook Another Tour

Only ONE primary CTA per state.

Countdowns must use tabular numerics.

----------------------------------------
7.9 HELP / FAQ
----------------------------------------
Goal:
Reduce new-platform anxiety.

Must include:
- How does the deposit work?
- When do I pay the remaining balance?
- When is my tour confirmed?
- How do hotel-area pickup fees work?
- What if my hotel is outside central Jeju?
- Can I cancel and rebook?
- What happens if the minimum group is not reached?

Use clear accordion/card UX.

========================================
8. ARCHITECTURE / IMPLEMENTATION CONSTRAINTS
========================================
Critical constraints:
1. DO NOT break existing functionality
2. DO NOT rewrite working backend logic unless absolutely necessary
3. DO NOT replace working API contracts with incompatible ones
4. DO NOT move pricing/time/status decisions to client
5. DO NOT hardcode UI strings inside components
6. DO NOT rely on hover for critical mobile information
7. DO NOT remove working features before replacement
8. DO NOT touch existing Stripe/payment execution flows except via wrappers/presentational improvements
9. DO NOT use fake loading/status copy that implies unsupported backend behavior
10. Use feature flags for risky changes
11. Use adapter-based migration
12. Old logic / old API / old DB -> adapters -> new UI

Preferred migration strategy:
- Audit first
- Add design system and copy constants
- Add Zod schemas and adapter layer
- Build reusable UI primitives
- Refactor pages in phases
- Prefer wrapper/presentation replacement over backend rewrites

========================================
9. RECOMMENDED FILE STRUCTURE
========================================
Use or adapt this structure if compatible:

src/
  app/
    (marketing)/
      page.tsx
    build-tour/
      page.tsx
      loading.tsx
    tours/
      page.tsx
      [id]/page.tsx
    checkout/
      [id]/page.tsx
    my-tours/
      page.tsx
    login/
      page.tsx

  components/
    ui/
      button.tsx
      badge.tsx
      card.tsx
      input.tsx
      search-input.tsx
      bottom-sheet.tsx
      timeline.tsx
      countdown-label.tsx
      status-banner.tsx
      section-header.tsx
    tour/
      hero-planner.tsx
      trip-summary.tsx
      tour-card.tsx
      tour-fit-badge.tsx
      pickup-surcharge-info.tsx
      booking-timeline.tsx
      price-summary.tsx
      join-status-badge.tsx

  design/
    tokens.ts
    copy.ts
    status.ts
    analytics.ts
    motion.ts

  lib/
    adapters/
      booking-adapter.ts
      pricing-adapter.ts
      timeline-adapter.ts
      hotel-adapter.ts
    schemas/
      hotel.ts
      tours.ts
      booking.ts
    format/
      currency.ts
      date.ts
      countdown.ts

  types/
    tours.ts
    booking.ts
    pricing.ts

  docs/
    renovation/
      audit.md
      migration-plan.md
      component-map.md
      qa-checklist.md
      analytics-events.md

========================================
10. TYPES / VIEW MODELS / API CONTRACTS
========================================
Use these or adapt them carefully without breaking backend compatibility.

Tour types:
- private
- join
- bus

Join visible statuses:
- waiting
- balance_open
- confirmed
- missed_deadline
- private_only
- join_unavailable

Match quality:
- great
- good
- slight

Hotel lookup response:
{
  id: string;
  displayName: string;
  lat: number;
  lng: number;
  pickupAreaLabel: string;
  surchargeAmount: number;
  surchargeLabel: string | null;
  joinAvailable: boolean;
}

Build tour request:
{
  destination: "jeju";
  hotelId?: string;
  hotelName?: string;
  lat?: number;
  lng?: number;
  pickupAreaLabel?: string;
  date: string;
  guests: number;
  styleTags: string[];
  preferredType: "private" | "join" | "both";
}

Build tour response:
{
  searchSummary: {
    destination: "jeju";
    pickupAreaLabel: string;
    date: string;
    guests: number;
    styleTags: string[];
  };
  recommended: TourCardViewModel[];
  privateTours: TourCardViewModel[];
  joinTours: TourCardViewModel[];
  busTours: TourCardViewModel[];
}

My tour response:
{
  tour: MyTourViewModel;
  paymentHistory: Array<{
    id: string;
    type: "deposit" | "balance" | "refund";
    amount: number;
    paidAt: string;
    status: "paid" | "pending" | "failed" | "refunded";
  }>;
}

Booking timeline:
{
  now: string;
  tourStartAt: string;
  refundDeadlineAt: string;
  balanceOpensAt: string;
  balanceDueAt: string;
  autoCharge: false;
}

Use Zod safeParse() in adapter layer.
Do not pass raw legacy payloads directly to UI.
If parsing fails, log safely and return fallback ViewModel.

========================================
11. ANALYTICS / PRIVACY
========================================
Track useful UI/product events.
Do NOT track raw hotel names or exact coordinates.

Allowed tracking granularity:
- pickup area label
- surcharge tier
- tour type
- state transitions
- funnel steps

Example events:
- hero_form_start
- hotel_selected
- surcharge_shown
- build_tour_started
- build_tour_completed
- tour_card_viewed
- detail_viewed
- checkout_started
- deposit_paid
- balance_open_seen
- balance_paid
- payment_missed

Never store in analytics:
- raw hotel name
- exact lat/lng

========================================
12. ACCESSIBILITY / MOBILE
========================================
Must have:
- button min height 44px
- visible focus states
- no status by color alone
- mobile-first layouts
- hover-only info must have mobile bottom-sheet or inline alternative
- strong contrast
- tabular numerics for times/prices/countdowns

========================================
13. EXECUTION PHASES
========================================
Phase 0: Audit only
- map current pages
- map shared components
- map backend dependencies
- identify safe presentation components
- identify risky components
- produce migration plan
- save docs in docs/renovation/

Phase 1: Foundation
- detect Tailwind version
- create design token files
- create copy constants
- create status config
- create analytics helpers
- create motion config
- create Zod schemas and adapters
- create reusable UI primitives
- do not replace pages yet

Phase 2: Homepage
- preserve links and working actions
- use new design system
- hotel-area-first message
- strong differentiation between private / join / bus

Phase 3: Builder + Loading + List + Detail
- use adapter ViewModels
- realistic loading copy
- hotel-aware UX
- booking timeline in detail page

Phase 4: Checkout + My Tour + Login
- trust-first UX
- wrap existing auth/payment logic
- single CTA logic in My Tour
- strong manual-balance trust messaging

Phase 5: Hardening
- accessibility sweep
- analytics instrumentation
- motion consistency
- QA checklist
- no regressions

========================================
14. DELIVERABLES
========================================
Produce:
1. docs/renovation/audit.md
2. docs/renovation/migration-plan.md
3. design token/config files
4. reusable UI primitives
5. adapter layer + Zod schemas
6. page-by-page refactor
7. analytics events file
8. QA checklist
9. accessibility fixes
10. notes on risk areas

========================================
15. FINAL NON-NEGOTIABLE INSTRUCTION
========================================
Start with the architecture audit only.
Then continue through all phases automatically.
Use adapter-based migration.
Preserve all existing business logic and data structures wherever possible.
Replace presentation layer first.
Do not break checkout, booking, payment, auth, API, or route-generation logic.

When in doubt:
- preserve backend
- preserve existing contracts
- refactor UI safely
- keep server as source of truth
- keep copy human and trustworthy
