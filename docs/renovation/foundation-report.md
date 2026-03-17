# Phase 1 Foundation Report

**Purpose:** Summarize the design and adapter foundation created in Phase 1. No page-level business logic was replaced.

**Source of truth:** `.cursor/rules/*`, `docs/renovation/final-product-spec.md`, `docs/renovation/migration-plan.md`.

---

## 1. Design Layer

| File | Role |
|------|------|
| `src/design/tokens.ts` | Centralized design tokens (brand/status colors, spacing, typography, motion). Unchanged; already aligned with spec. |
| `src/design/copy.ts` | Centralized copy. **Updated:** added `myTour.status.*` and `myTour.rebook` so status labels are not hardcoded in components. |
| `src/design/status.ts` | Join and booking status config. **Updated:** booking labels now reference `COPY.myTour.status.*`; tones use `as const` for type safety. |
| `src/design/motion.ts` | Motion config. **Updated:** added `motionEasing`, `motion.transition` (fast/base/slow) for Framer Motion with strict `ease` typing. |
| `src/design/analytics.ts` | Analytics helpers with privacy sanitization. **Updated:** added `balanceOpenSeen` event. |

**Dependency:** `zod` was added to `package.json` so that `src/lib/schemas/*` and adapters compile.

**Tailwind:** `tailwind.config.js` extended with design token colors (`brand.*`, `status.*`), `minHeight.touch` (44px), `shadow-design-*`, `rounded-design-*`, `duration-motion-*`, `transition-timing-motion-ease`. Content paths include `./src/**/*` so new UI is purged correctly.

---

## 2. Types

| File | Role |
|------|------|
| `src/types/tours.ts` | **Updated:** added `BuildTourRequest`, `BuildTourResponse` for builder API contract. |
| `src/types/booking.ts` | **Updated:** added `MyTourResponse` for my-tour API response. |

All price, time, and status remain server-driven; types describe request/response shapes only.

---

## 3. Schemas (Zod)

| File | Role |
|------|------|
| `src/lib/schemas/hotel.ts` | `HotelLookupResultSchema` — unchanged. |
| `src/lib/schemas/tours.ts` | **Updated:** added `BuildTourRequestSchema` for optional request validation. |
| `src/lib/schemas/booking.ts` | `BookingTimelineSchema`, `MyTourViewModelSchema`, `MyTourResponseSchema` — unchanged. |

---

## 4. Adapters

| File | Role |
|------|------|
| `src/lib/adapters/booking-adapter.ts` | **Updated:** explicit return type `MyTourResponse`; uses `MyTourResponseSchema.safeParse()`; returns fallback ViewModel on parse failure. |
| `src/lib/adapters/tours-adapter.ts` | **Updated:** explicit return type `BuildTourResponse`; uses `BuildTourResponseSchema.safeParse()`; returns fallback on parse failure. |

Rule: UI must consume adapter output only, never raw legacy payloads.

---

## 5. Reusable UI Primitives

All under `src/components/ui/`, exported from `src/components/ui/index.ts`.

| Component | File | Notes |
|-----------|------|--------|
| Button | `button.tsx` | Variants: primary, secondary, outline, ghost. Min-height 44px, focus ring. |
| Badge | `badge.tsx` | Variants map to status/brand; use with label text (status not by color alone). |
| Card | `card.tsx` | Elevated/outline/muted; CardHeader, CardTitle, CardContent subcomponents. |
| Input | `input.tsx` | Label, error, hint; focus ring; 44px min-height. |
| SearchInput | `search-input.tsx` | Search field with optional clear button; controlled/uncontrolled. |
| BottomSheet | `bottom-sheet.tsx` | Mobile-first overlay; Escape to close; body scroll lock when open. |
| Timeline | `timeline.tsx` | Generic `Timeline` (title + items with title/subtitle/date) and `BookingTimeline` using `COPY.timeline.*`. Tabular numerics for dates. |
| CountdownLabel | `countdown-label.tsx` | Countdown to `targetAt` (ISO string); tabular-nums; optional prefix/expiredLabel. |
| StatusBanner | `status-banner.tsx` | Renders `bookingStatusConfig[status]` label; tone from design/status. Server-driven status only. |
| SectionHeader | `section-header.tsx` | Title, optional subtitle, optional action (e.g. Edit link). |

All primitives use design tokens via Tailwind theme (brand-*, status-*, design-*, motion-*) and avoid hardcoded copy where applicable (Timeline/StatusBanner use COPY/status config).

---

## 6. Risks and Notes

1. **Path alias:** Components and design files use `@/src/...` (e.g. `@/src/design/copy`, `@/src/types/booking`). With `@/*` → `./*`, this resolves to `./src/...`. Ensure all consumers use the same alias; existing app may use `@/lib` (root `lib/`). No existing pages were changed, so no conflict in Phase 1.

2. **Tailwind content:** New UI lives under `src/`. Tailwind content was extended to `./src/**/*` so classes in these components are included. Existing app uses `./components`, `./app`; both remain.

3. **BottomSheet:** Uses a simple transition; no `tailwindcss-animate` dependency. If the project adds it later, `animate-in slide-in-from-bottom` can be restored.

4. **SearchInput:** Clear button does not trigger React `onChange` with empty value when in controlled mode; caller should clear their state in `onClear` if needed.

5. **Adapters:** Fallback ViewModels on parse failure are minimal (e.g. "Unknown" area, empty lists). Pages that consume adapters should handle fallback state (e.g. show error or retry). No page uses these adapters yet in Phase 1.

6. **Framer Motion:** `motion.transition` and `motionEasing` are provided for future use; no Framer Motion was added to primitives in Phase 1 to keep the foundation dependency-light.

---

## 7. What Was Not Done (By Design)

- No page-level business logic or routes were replaced.
- No existing components (Header, TourCard, checkout, etc.) were modified.
- No new API routes or server logic were added.
- Hotel adapter / tour-detail adapter are mentioned in the migration plan for later phases; not implemented in Phase 1.

---

## 8. Suggested Next Steps (Phase 2+)

- Use design tokens and COPY in shell (Header, Footer, BottomNav) presentation only.
- Replace homepage presentation with new primitives and copy constants.
- When integrating list/detail/checkout/mypage, call existing APIs and pass responses through adapters before passing ViewModels to the new UI.

---

## 9. Phase 1 change summary (package / Tailwind / wiring)

**Why `package.json` and `package-lock.json` changed**  
Dependencies were added so the foundation compiles and the new UI primitives can use shared utilities: **zod** for `src/lib/schemas/*` and adapters; **clsx** and **tailwind-merge** for class merging in primitives (e.g. Button, Badge). No new Tailwind plugin was added; existing **tailwindcss** is used with theme extensions only.

**Why `tailwind.config.js` changed**  
Content paths were extended with `./src/**/*` so Tailwind purges classes used in `src/design/*` and `src/components/ui/*`. The theme was extended with design-system tokens: **colors** (`brand.*`, `status.*`), **minHeight.touch** (44px), **boxShadow** (`design-sm`, `design-md`, `design-lg`), **borderRadius** (`design-sm`, `design-md`, `design-lg`), **transitionDuration** (`motion-fast`, `motion-base`, `motion-slow`), **transitionTimingFunction** (`motion-ease`). No Tailwind plugins were added.

**Wiring status**  
None of the new UI primitives under `src/components/ui/` are imported or used in existing page-level flows (`app/`, root `components/`, or `pages/`). They are built and exported for Phase 2+ only.
