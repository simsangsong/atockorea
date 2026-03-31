# V0 design port — visual integration QA (final pass)

**Date:** 2026-03-21  
**Scope:** Presentation and stacking only. No changes to API routes, payments, Supabase, validation, routing contracts, or business logic.

This pass audits the ported surfaces documented in [`v0-design-port-plan.md`](./v0-design-port-plan.md): landing (`app/page.tsx` + premium home sections), custom join tour planner (`app/custom-join-tour/page.tsx`), tours list (`app/tours/list/page.tsx`), my page shell (`app/mypage/*`), shared chrome (`Header`, `Footer`, `BottomNav`), and v0 skin primitives (`src/components/v0-skin/*`, `src/styles/v0-skin.css`).

---

## 1. Audit checklist

| Area | Result | Notes |
|------|--------|--------|
| **Z-index conflicts** | **Fixed (partial)** | Header and BottomNav both used `z-50`; document order could let the bottom bar paint above the full-screen **search** overlay inside `Header`. Header is now `z-[60]` so site chrome stacks above the fixed bottom nav (`z-50`). Planner destination map used `z-[9999]` for a local overlay; reduced to `z-10` inside the positioned map block (sufficient for stacking within the card). `BuilderLoadingOverlay` uses `z-[120]` — above `HotelMapPicker` (`z-[100]`) and nav; below `react-datepicker` popper (`z-index: 9999` in `globals.css`) so an open calendar still wins when both could theoretically overlap. |
| **Broken mobile spacing** | **Improved** | Bottom padding for the fixed nav now includes `env(safe-area-inset-bottom)` on `BottomNav` and a matching `.mobile-bottom-nav-spacer` utility so content is not clipped by the home indicator on notched devices (requires non-zero insets when the viewport uses `viewport-fit=cover`; see follow-ups). |
| **Bottom nav overlap** | **Improved** | Same as above; landing, planner, tours list, mypage layout, and proposed-tours page spacers use `.mobile-bottom-nav-spacer`. Tours list `main` already had `pb-24` for scroll clearance — unchanged. |
| **Modal overflow** | **OK** | `PlannerModalShell` inline mode uses `v0-planner-panel--inline` (`overflow: visible`, no fixed 85vh). `HotelMapPicker` uses `max-h-[90vh]` + `overflow-y-auto` on the scroll region. |
| **Text contrast** | **OK** | Dark planner uses cyan/white on `#0d1a2e`; landing uses slate scales on frosted panels. No automatic WCAG measurement in this pass; spot-check on real devices recommended. |
| **Inconsistent button states** | **OK** | Planner CTAs use `v0-planner-cta`, `disabled:` opacity, and focus styles on field buttons (`globals.css`). Secondary links use hover transitions. |
| **Hydration risk** | **Low** | `mypage/page.tsx` uses `useEffect` for desktop redirect (client-only). `HotelMapPicker` returns `null` when `document` is undefined (SSR). Dynamic map components use `ssr: false`. No server/client HTML mismatch identified for conditional UI beyond standard client boundaries. |

---

## 2. Flow verification (manual)

These are **expected** behaviors to re-check in the browser after any future visual change.

| Flow | What to verify |
|------|----------------|
| **Landing → planner** | Hero “PLAN MY TRIP” / destination cards / Final CTA link to `/custom-join-tour`. Header nav “Tours” goes to `/tours` (marketing route), not `/tours/list` — intentional product split; not altered in this pass. |
| **Planner step transitions** | Progress bar reflects `plannerStepProgressPercent(step)`; panel title switches by step (`itinerary`, `checkout`, `confirmed`, default). |
| **Loading overlay** | `BuilderLoadingOverlay` shows during generate; success copy; `z-[120]` covers page + bottom nav. |
| **Detail sheet open/close** | `HotelMapPicker` portal to `document.body`; backdrop click and Confirm/Cancel; map/search scroll on small height. |
| **Planner → payment CTA** | Checkout step and Stripe/payment behavior unchanged; only stacking/spacing touched globally. |
| **Landing → tours** | Final CTA secondary button → `/tours/list`; classic bus section unchanged. |
| **Bottom nav switching** | Active state for `/custom-join-tour/proposed` includes `pathname.includes("custom-join-tour")` (covers builder and proposed). |

---

## 3. Presentation-only fixes applied (this pass)

| Change | Purpose |
|--------|---------|
| `components/Header.tsx`: `z-50` → `z-[60]` | Full-screen search overlay and sticky header stack **above** fixed `BottomNav` (`z-50`). |
| `components/BottomNav.tsx`: `pb-[env(safe-area-inset-bottom,0px)]`, `aria-label` | Clearance for iOS home indicator; accessibility. |
| `app/globals.css`: `.mobile-bottom-nav-spacer` | `calc(4rem + env(safe-area-inset-bottom, 0px))` matches nav height + safe area. |
| `app/page.tsx`, `app/custom-join-tour/page.tsx`, `app/tours/list/page.tsx`, `app/mypage/layout.tsx`, `app/custom-join-tour/proposed/page.tsx` | Spacer divs use `.mobile-bottom-nav-spacer` + `aria-hidden` where appropriate. |
| `app/custom-join-tour/page.tsx`: map overlay `z-[9999]` → `z-10` | Avoid unnecessary global stacking; keeps controls above the hologram within the map shell. |
| `components/BuilderLoadingOverlay.tsx`: `z-[9999]` → `z-[120]` | Aligns with design-token intent (`--v0-z-modal-busy` ≈ 110) and keeps stacking predictable vs. nav/modals. |

---

## 4. Residual risks / follow-ups (non-blocking)

1. **`viewport-fit=cover`:** For `env(safe-area-inset-bottom)` to be non-zero on some iOS Safari versions, the root viewport may need `viewport-fit=cover` (Next.js `viewport` export or meta). Not added in this pass to avoid global viewport side effects without product sign-off.
2. **`BuilderLoadingOverlay` + `AnimatePresence`:** When `visible` becomes false, the component returns `null` immediately, so exit animation may not run. Pre-existing; not a regression from this pass.
3. **Other pages with `h-16` spacers:** Cart, auth, tour checkout, etc. still use a fixed `h-16` spacer. Consider migrating them to `.mobile-bottom-nav-spacer` for consistency when those screens are in scope.
4. **Z-index reference (practical):** Bottom nav `50` → Header `60` → modal-style overlays `100` (`HotelMapPicker`) → busy overlay `120` → datepicker popper `9999` (portal).

---

## 5. Sign-off

- **Lint:** `ReadLints` clean on edited TSX files.  
- **Logic:** No edits to fetches, Supabase, payment handlers, step state machine, or route handlers.
