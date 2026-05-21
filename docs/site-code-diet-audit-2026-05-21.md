# Site Code Diet Audit — 2026-05-21

Scope: current Next.js app, runtime-loaded shell code, App Router routes, tracked/untracked repository weight, static public assets, and Knip static analysis.

No files were deleted in this audit. The goal is to separate safe diet targets from live-page-sensitive code.

## Executive Summary

The biggest real-world wins are not from deleting random old components. They are:

1. Reduce global shell hydration/background work.
2. Remove or gate non-production routes.
3. Archive clearly unused legacy components/data/scripts.
4. Clean local/generated repository bulk.
5. Audit public images carefully before deletion because DB/product JSON can reference them.

## Runtime Diet Candidates

These affect live pages today because they are mounted through `app/layout.tsx` or `SitePageShell`.

### 1. Header Auth Lookup Runs On Most Public Pages

File: `components/Header.tsx`

Current behavior:
- `Header` is a client component used by `SitePageShell`.
- On mount it calls `supabase.auth.getSession()`.
- If logged in, it queries `user_profiles`.
- It subscribes to `onAuthStateChange`.

Impact:
- Public pages pay for Supabase auth client work even if the visitor never opens account UI.
- Logged-in visitors get an extra profile query on public routes.
- After the mypage provider optimization, this is now one of the remaining global auth lookups.

Recommended diet:
- Split header auth UI into a lazy `HeaderAccountMenu`.
- Default render should be static signed-out/account icon.
- Load session/profile only on interaction, or after `requestIdleCallback`.
- For `/mypage`, reuse `MyPageSessionProvider` state if feasible.

Risk:
- Medium. Must preserve signed-in menu behavior and auth state changes.

### 2. Mobile Nav + Floating Language Toggle Hydrate On Desktop Too

Files:
- `src/components/layout/SitePageShell.tsx`
- `components/BottomNav.tsx`
- `components/FloatingLanguageToggle.tsx`

Current behavior:
- `BottomNav` imports `framer-motion` and `lucide-react`.
- `FloatingLanguageToggle` runs route/search hooks and can create IntersectionObservers.
- Both are rendered by `SitePageShell` for most pages, even though visually mobile-only.

Impact:
- Desktop routes still load/hydrate mobile-only logic.
- `FloatingLanguageToggle` runs setup logic on pages that do not need it.

Recommended diet:
- Dynamically import mobile-only shell pieces.
- Add a small `MobileOnlyShell` that mounts only after `matchMedia('(max-width: 767px)')`.
- Keep SSR off for the mobile-only chunk.

Risk:
- Low to medium. Need mobile QA for nav visibility and language switching.

### 3. Datepicker CSS Is Global And Duplicated

Files:
- `app/globals.css`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourDesktopBookingCard.tsx`
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourStickyBookingBar.tsx`

Current behavior:
- `app/globals.css` imports `react-datepicker/dist/react-datepicker.css`.
- The product booking components also import the same stylesheet.
- The actual datepicker component is dynamically loaded, but its CSS is effectively global.

Impact:
- Every page gets datepicker CSS even though only booking surfaces need it.
- There may be duplicate inclusion depending on bundling.

Recommended diet:
- Test removing the root `app/globals.css` datepicker import.
- Keep booking component-level import if build accepts it.
- If Next rejects component-level global CSS, move datepicker CSS to the narrowest route layout that needs booking.

Risk:
- Medium. Must verify booking calendar styling on desktop sticky card and mobile sticky bar.

### 4. Global Font Stylesheets Are Broad

File: `app/layout.tsx`

Current behavior:
- Root layout always links Pretendard and Google CJK families: JP, SC, TC, and Noto Serif KR.
- Browser unicode-range should prevent downloading all font files, but the stylesheet request is still global.

Impact:
- Global CSS request overhead.
- Not the first place to cut, but worth revisiting once functional code diet is done.

Recommended diet:
- Keep Pretendard.
- Consider locale-conditional font stylesheet links for JP/SC/TC/Serif KR.

Risk:
- Low to medium. Typography regression risk across localized pages.

## Non-Production Route Candidates

These are real App Router routes. They may not be linked publicly, but they are still routable unless protected by redirects/middleware.

### Strong Delete/Gate Candidates

- `app/test/page.tsx`
- `app/test-admin/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/bookings/page.tsx`
- `app/dashboard/members/page.tsx`
- `app/dashboard/stats/page.tsx`
- `my/page.tsx` outside `app`, unused legacy stub

Why:
- Static placeholder/stub pages.
- `robots.ts` already disallows `/test/`, `/test-admin/`, `/dashboard/`.
- Real admin is under `/admin`.
- Real mypage is under `/mypage`; `next.config.js` redirects `/my` to `/mypage`.

Recommended action:
- Delete or replace with permanent redirects/notFound.

Risk:
- Low, assuming no internal team relies on these URLs.

### Design/Sandbox Route Candidates

- `app/mockup/header/page.tsx`
- `app/mockup/landing-v2/page.tsx`
- `app/mockup/_components/HeaderV2.tsx`
- `app/reviews/preview/page.tsx`

Why:
- Mockup/sandbox surfaces.
- `/reviews/preview` is gated by `NEXT_PUBLIC_REVIEW_FLOW_PREVIEW`, but still ships a route and imports the review wizard.

Recommended action:
- Move to `docs/prototypes` or gate behind admin/dev-only route.
- In production, return `notFound()` before importing heavy client components if possible.

Risk:
- Medium if these are still used for design QA.

### Legacy Preview Route

- `app/tour-preview/[slug]/page.tsx`
- `app/tour-preview/east-small-group-v2/*`

Why:
- Several preview slugs are already redirected in `next.config.js` and `middleware.ts`.
- Generic `/tour-preview/:slug` may still be intentionally used for unpublished previews.

Recommended action:
- Keep only if preview workflow exists.
- Otherwise redirect all `/tour-preview/:slug` to canonical `/tour-product/:slug` or `notFound()`.

Risk:
- Medium. Could affect private preview URLs.

## Static Analysis Findings

Command used:

```bash
npx knip --dependencies --production --reporter compact --max-show-issues 80 --no-exit-code
```

Potential unused dependencies reported:

- `@googlemaps/google-maps-services-js`
- `@types/google.maps`
- `@types/react-datepicker`
- `buffer`
- `csv-parser`
- `h3-js`
- `next-intl`
- `recharts`

Notes:
- Treat as candidates, not truth. Some packages may be used via globals, transitive types, or external tooling.
- `buffer` appears as Node global usage (`Buffer`) but the npm `buffer` package may not be needed.
- `recharts` may be admin analytics only; confirm before removal.
- `next-intl` appears likely stale because this app uses custom `lib/i18n`.

Unlisted dependencies reported:

- `date-fns` used by product booking cards
- `server-only` used by server CMS helpers

Recommended action:
- If these are real runtime imports, add them explicitly to `package.json`.
- This is dependency hygiene, not diet.

## Unused File Candidates From Knip

High-confidence legacy component candidates:

- `components/BuilderLoadingOverlay.tsx`
- `components/ClassicBusSection.tsx`
- `components/CompactTrustBar.tsx`
- `components/ComparisonSection.tsx`
- `components/CustomCalendar.tsx`
- `components/CustomPicker.tsx`
- `components/HeroPaymentStrip.tsx`
- `components/HeroTrustBar.tsx`
- `components/HomeTourSections.tsx`
- `components/HowItWorksSection.tsx`
- `components/PaymentMethodInfo.tsx`
- `components/ReviewsSection.tsx`
- `components/RobotMascot.tsx`
- `components/SeasonalTours.tsx`
- `components/TourCardDetail.tsx`
- `components/TourLayout.tsx`
- `components/TourList.tsx`
- `components/TourSectionRow.tsx`
- `components/TrustBar.tsx`

Other candidates:

- `data/tours.ts`
- `hooks/useMediaQuery.ts`
- `lib/admin-fetch.ts`
- `lib/api-client.ts`
- `lib/jeju-poi-admin.ts`
- `lib/review-images-validate.ts`
- `lib/to-paragraphs.ts`
- `lib/tour-list-price-krw.server.ts`
- `types/tour.ts`
- root smoke/manual scripts: `__itinerary_*.mjs`, `__seed_rules.mjs`

Recommended action:
- Delete in a separate PR after one `rg` confirmation per file.
- Run `npx tsc --noEmit` and a production build after removal.

Risk:
- Low to medium. Static analysis can miss dynamic references.

## Repository Weight

Directory sizes from local workspace:

| Path | Size | Files | Notes |
| --- | ---: | ---: | --- |
| `.claude` | ~2929.65 MB | 87,395 | Local agent worktrees/session data. Mostly ignored, but huge local watcher/search drag. |
| `mobile` | ~278.13 MB | 33,021 | Mostly `mobile/node_modules`. Separate app dependencies, not web runtime. |
| `public` | ~107.46 MB | 313 | Real web asset surface. Needs careful audit. |
| `components` | ~26.52 MB | 379 | Large product JSON/static bundles included here. |
| `scripts` | ~10.47 MB | 244 | Many one-off/import/translation scripts. |
| `docs` | ~7.25 MB | 221 | Many screenshots and planning docs. |
| `data` | ~4.12 MB | 16 | Generated POI outputs. |

Recommended immediate local cleanup:

- Delete local `.claude/worktrees` if no active worktree is needed.
- Delete `mobile/node_modules` if not actively building mobile.
- Keep `.claude/skills` if project-level skills are intentional.

These do not change the deployed site, but they improve local search/watch/tooling speed.

## Public Asset Audit

A static text scan found:

- Total public files: 313
- Public files with no repo text reference: 68
- Approx unreferenced static size: ~21 MB

Largest unreferenced candidates:

- `public/images/itinerary/bomun-lake-cherry-blossoms.webp`
- `public/images/itinerary/gukje-market-fresh-produce-aisle.webp`
- `public/images/itinerary/songaksan-crater-aerial.webp`
- `public/images/itinerary/seoraksan-sinheungsa-aerial.webp`
- `public/images/tours/saryeoni-forest/chatgpt-image-2026-5-8-08-14-58.webp`
- `public/images/tours/everland/chatgpt-image-2026-5-9-11-38-57.webp`
- `public/images/itinerary/songaksan-cliff-trail-sunset.webp`
- `public/images/itinerary/songdo-skywalk-cable-car.webp`
- `public/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-52-32.webp`
- `public/images/itinerary/songdo-beach-aerial.webp`
- `public/mockup-*.html`

Important caution:
- Static text scan cannot see DB-stored image URLs.
- Do not delete public images until DB/product JSON references are checked.

Recommended action:
- Create a generated manifest of all local image URLs currently stored in DB/product JSON.
- Only delete public assets absent from both code and DB.

## Suggested Execution Order

### PR 1 — Runtime Shell Diet

1. Lazy/defer header auth profile lookup.
2. Mobile-only dynamic shell for `BottomNav` and `FloatingLanguageToggle`.
3. Test homepage, tours list, tour product, itinerary builder, sign-in, mypage.

Expected impact:
- Less JS/hydration on public desktop pages.
- Fewer background Supabase auth/profile calls.

### PR 2 — Non-Production Route Cleanup

1. Remove or gate `/test`, `/test-admin`, `/dashboard`.
2. Move `/mockup/*` out of live app or make it dev-only.
3. Decide `/reviews/preview` fate.

Expected impact:
- Smaller route tree.
- Less accidental public surface.

### PR 3 — Legacy Component/File Cleanup

1. Delete high-confidence Knip file candidates.
2. Remove stale dependencies if build confirms.
3. Add missing dependencies (`date-fns`, `server-only`) if needed.

Expected impact:
- Cleaner codebase and dependency graph.

### PR 4 — Asset Cleanup

1. Build DB + product JSON local image reference manifest.
2. Delete confirmed unused public images.
3. Keep a before/after public asset report.

Expected impact:
- Smaller repo and deployment asset footprint.

## Do Not Touch Without Product Confirmation

- Product static JSON under `components/product-tour-static`.
- Public tour/itinerary images that may be DB referenced.
- `app/api/*` routes used by admin/merchant/webhooks/cron.
- Redirects in `next.config.js` and `middleware.ts`.
- Analytics tracker unless the analytics plan is being retired.

