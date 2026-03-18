# Premium Homepage — Mobile-First Polish Pass Report

**Date:** Applied with premium refactor.  
**Scope:** Root homepage (`/`) premium sections only.  
**Reference:** `docs/renovation/homepage-refactor-plan.md`, `docs/renovation/premium-homepage-qa.md`.

---

## 1. Section spacing rhythm

**Intent:** Consistent vertical rhythm so the page feels paced, not cramped or sparse.

| Section | Mobile (default) | sm | md+ |
|--------|-------------------|-----|-----|
| Hero | (full bleed, no section py) | — | — |
| Trust strip | py-3 | py-4 | — |
| Comparison | py-6 | py-8 | py-12 |
| Product cards | py-6 | py-8 | py-12 |
| How it works | py-6 | py-8 | py-12 |
| Destinations | py-6 | py-8 | py-12 |
| Classic bus | py-6 | py-8 | py-12 |
| Reviews | py-6 | py-8 | py-12 |
| Final CTA | py-8 | py-10 | py-14 |

**Heading-to-content:** `mb-4` on mobile, `sm:mb-6` on larger screens for section titles.

**Result:** Single scale (24px → 32px → 48px) for content sections; Trust and Final CTA use slightly different values for hierarchy. No random mix of py-10/md:py-14 across sections.

---

## 2. Card density

**Intent:** Cards feel scannable on small screens without feeling like a text wall.

| Component | Change |
|-----------|--------|
| **Product cards** | Inner padding p-4 (mobile), sm:p-5; description `line-clamp-2` and `leading-snug`; badge mb-2.5; price block mt-4. Tighter hierarchy so price + CTA stay visible without scroll. |
| **Comparison trust blocks** | p-4 only (no sm:p-5); body `text-sm` with `line-clamp-3` so blocks don’t stretch; list uses `list-disc list-inside` for scanability. |
| **How it works** | 2-column grid on mobile (`grid-cols-2`), 4-column on lg; step circle 9×9 on mobile, 10×10 on sm+; label `text-xs sm:text-sm` to avoid crowding. |
| **Reviews** | p-4, `text-sm` only; single radius `rounded-xl` for consistency. |
| **Destinations** | Unchanged card padding; section uses same py rhythm as above. |

**Result:** Dense but readable; no long unbroken paragraphs on mobile.

---

## 3. Heading contrast

**Intent:** Clear visual hierarchy; section titles read as “headings,” not body text.

| Element | Before | After |
|--------|--------|--------|
| Section h2 | `text-[#1A1A1A]` | `text-slate-900` |
| Card/block h3 | `text-[#1A1A1A]` | `text-slate-900` |
| Body / subtitle | `text-[#666666]` | `text-slate-600` where appropriate |
| Trust strip | `text-[#1A1A1A]` | `text-slate-800` |

**Result:** Headings read darker and bolder; supporting copy reads as secondary without changing font weights.

---

## 4. CTA prominence

**Intent:** Primary actions (Plan My Trip, Join Small Group) stand out; tap targets remain ≥ 44px.

| Location | Change |
|----------|--------|
| **Hero CTA** | Added `shadow-lg shadow-[#1E4EDF]/30` so the button has depth and draws the eye. |
| **Final CTA** | Same shadow as Hero for consistency. |
| **Product cards** | Emphasized card (AI Join): CTA uses `bg-[#1E4EDF]` and `shadow-md shadow-[#1E4EDF]/25`; card container has `ring-1 ring-[#1E4EDF]/20` and `border-[#1E4EDF]/40`. Other cards keep dark `bg-[#0A1F44]` CTA. All CTAs `min-h-[44px]`. |

**Result:** Primary path (Plan My Trip, Join Small Group) is clearly primary; secondary cards still clear but not competing.

---

## 5. Scanability

**Intent:** Users can skim sections quickly on mobile.

| Area | Change |
|------|--------|
| **Trust strip** | Rendered as `<ul>` with list semantics; separators `·` between items (visible on all breakpoints) so four trust points scan as distinct items. |
| **Comparison trust blocks** | Booking rules use `list-disc list-inside`; pickup and deposit/balance stay as short paragraphs with `line-clamp-3`. |
| **Product cards** | Badge → title → description (2 lines) → “Starting from” + price → CTA; order is consistent and scannable. |
| **How it works** | Numbered steps in a 2×2 grid on mobile; numbers in circles, short labels. |

**Result:** No long walls of text; lists and short blocks with clear headings.

---

## 6. Visual consistency

**Intent:** Same radii, borders, and typography scale across premium sections.

| Token | Usage |
|-------|--------|
| **Radius** | Cards and blocks: `rounded-xl` (12px) on mobile; Trust strip and a few larger blocks use `sm:rounded-2xl` where needed. Removed ad-hoc `rounded-[20px]` on product cards in favor of `rounded-xl`. |
| **Border** | `border-[#E1E5EA]` for cards and panels. |
| **Backgrounds** | Alternating `bg-white` and `bg-[#F5F7FA]`; Final CTA and Hero use `bg-[#0A1F44]`. |
| **Typography** | Section titles: `text-lg sm:text-xl md:text-2xl font-bold text-slate-900`. Body/secondary: `text-sm` or `text-base` with `text-slate-600` / `text-slate-800`. |
| **Spacing** | Section py and heading mb follow the same scale (see §1). |

**Result:** One design language across Hero, Trust, Comparison, Product cards, How it works, Destinations, Classic bus, Reviews, and Final CTA.

---

## 7. No leftover legacy blocks on homepage

**Check:** Root route `app/page.tsx` only.

| Item | Status |
|------|--------|
| **Sections used** | HeroPremium, TrustStripPremium, ComparisonPanelPremium, ProductCardsPremium, HowItWorksPremium, DestinationsCards, ClassicBusSection, ReviewsPremium, FinalCtaPremium. |
| **DestinationsCards** | Used with `hideLegacyBlocks` → legacy AI beta block and proposed tours block are **not** rendered. |
| **Legacy components** | No HeroSection, TrustBar, PaymentMethodInfo, TourList, or proposed-tours UI on `/`. |
| **Locale route** | `app/[locale]/page.tsx` still uses legacy composition; out of scope for this pass. |

**Result:** Homepage has no duplicate or legacy blocks; single conversion story.

---

## 8. No text wall feeling on mobile

**Intent:** Avoid long, unbroken paragraphs; keep line length and block length in check.

| Risk area | Mitigation |
|-----------|------------|
| Hero sub | Already one line; `leading-snug`. |
| Trust strip | Four short items with `·` separators; no paragraph. |
| Comparison subtitle | One line; `leading-snug`. |
| Comparison trust blocks | Body copy `line-clamp-3`; booking rules as bullet list. |
| Product card description | `line-clamp-2` + `leading-snug`. |
| How it works | One short label per step. |
| Reviews | Short quotes; `text-sm`, single line or two per quote. |
| Final CTA | One headline + one button. |

**Result:** No section feels like a long paragraph; scan-friendly blocks and lists throughout.

---

## 9. Files touched (polish pass)

| File | Changes |
|------|--------|
| `src/components/home/HeroPremium.tsx` | CTA shadow. |
| `src/components/home/TrustStripPremium.tsx` | List semantics, `·` separators, rounded-xl, text-slate-800. |
| `src/components/home/ComparisonPanelPremium.tsx` | Section py rhythm, heading/body contrast (slate-900/slate-600), trust block line-clamp-3, list-disc for booking rules, rounded-xl. |
| `src/components/home/ProductCardsPremium.tsx` | Section py, heading contrast, description line-clamp-2, card radius and ring for emphasized card, CTA shadow on emphasized, density tweaks. |
| `src/components/home/HowItWorksPremium.tsx` | Section py, grid-cols-2 on mobile, smaller step circle and label on mobile, rounded-xl, heading contrast. |
| `src/components/home/ReviewsPremium.tsx` | Section py, heading contrast, p-4 and text-sm only, rounded-xl, text-slate-800. |
| `src/components/home/FinalCtaPremium.tsx` | Section py-8/10/14, CTA shadow. |
| `components/DestinationsCards.tsx` | Section py rhythm, h2 text-slate-900, destination card title colors (slate-900 / slate-600). |
| `components/ClassicBusSection.tsx` | Section py rhythm, h2 text-slate-900. |

---

## 10. Quick verification (manual)

- [ ] Load `/` on a 375px viewport; scroll full page. No horizontal overflow; sections feel evenly spaced.
- [ ] Trust strip: four items with visible `·` between them.
- [ ] Product cards: “Starting from” and price visible; emphasized card (AI Join) has blue-accent border/ring and blue CTA with shadow.
- [ ] Hero and Final CTA: “Plan My Trip” buttons have soft blue shadow.
- [ ] Comparison: table scrolls; three trust blocks stack in one column; booking rules show as bullet list.
- [ ] No “AI beta” or “Proposed tours” block on homepage.
- [ ] No long paragraph blocks; descriptions and trust copy are short or list form.

---

*Report generated after mobile-first premium polish pass. Update this document if spacing or visual tokens change.*
