# AtoC Korea — Home UX Upgrade Plan & Rules

> Living document. Every UI/UX upgrade on the home page (and adjacent surfaces)
> must read and follow this file. Last reviewed: 2026-05-15 (post-Apple-audit).

## North Star — premium vs tacky

Two anchor terms to align every micro-decision:

**🟢 PREMIUM (Apple-grade) means restraint.**
- One accent colour, used 2–3 times on the page max.
- Type hierarchy comes from size + weight, **never** from style swaps (no italic
  serif for emphasis, no gradient text, no rainbow tinted icons).
- Letter-spacing is tight on display sizes (-0.02em to -0.04em).
- Whitespace is the primary design tool. If unsure, add 16px more.
- Animation curves are smooth `cubic-bezier(0.4, 0, 0.2, 1)`, never bouncy.
- Photography fills the frame. Overlays/badges are minimal or absent.
- Shadows are subtle, single-layer, monochrome.
- Buttons are solid + tight + a single shape across the page.

**🔴 TACKY (avoid) means decoration.**
- Multi-stop gradient text on headlines.
- Italic serif (Playfair, Cormorant, Lora) for "magazine feel" — almost always
  reads cheap on the web.
- Eyebrow labels wrapped in dotted decoration ( ●  WHY ATOC KOREA  ● ).
- Multi-layer drop shadows with colour tints (cyan, amber, etc).
- Rainbow icon palette (navy + emerald + sky + amber on the same row).
- Bouncy spring animations with overshoot — they read as toy-app, not Apple.
- Mixed button shapes/colours on one page.
- Costume-jewelry decorative badges (e.g. clouds, ribbons) over photography.
- Inflated rating/booking numbers used as decoration.

## Initial Audit (executive summary)

| Dimension | Score / 10 | Status |
|---|---|---|
| Content & messaging | 9 | Keep — concrete numbers, social proof solid |
| Visual hierarchy | 6 | Improve — H2 consistent, card-internal weak |
| Spacing system | 5 | Improve — six different vertical paddings in use |
| Color discipline | 7 | Improve — amber axis OK, secondary palette scattered |
| Motion & micro-interaction | 6.5 | Improve — no scroll-linked motion |
| Mobile UX | 6 | Improve — snap-scroll lacks affordance |
| Accessibility | 5 | Improve — focus rings inconsistent |

The home is a strong v0 prototype. To reach premium-brand polish it needs a
disciplined design system layer underneath, plus editorial typography and
modern scroll/motion choreography.

## Design Principles (rules to follow on every upgrade)

1. **Tokenize first, style second.** Never inline a magic number that could
   be a token. New shadows/radii/spacings go through `tailwind.config` or the
   `:root` custom-properties block in `app/globals.css`.

2. **One accent, two neutrals.**
   - Accent: `amber-700` (single shade; reserve gradients for hero only).
   - Heading text: `slate-900`.
   - Body text: `slate-600`.
   - Muted: `slate-400`.
   Anything else needs an explicit reason captured in the PR.

3. **Spacing scale: 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128.** No `py-10`,
   no `py-14`. Section vertical padding uses three tokens:
   - `--section-py-sm = 56px`
   - `--section-py-md = 80px`
   - `--section-py-lg = 112px`

4. **Radius scale (only 3):**
   - `--radius-card = 20px` (tour cards, panels)
   - `--radius-button = 14px`
   - `--radius-image = 12px`
   - `rounded-full` for pills.

5. **Shadow scale (only 3):**
   - `--shadow-1` — resting card (1+4px close, 8px diffuse)
   - `--shadow-2` — hovered card / panel (2+8px close, 24px diffuse)
   - `--shadow-3` — elevated lightbox / modal (8+24px close, 40px diffuse)

6. **Typography stack:**
   - **Single family — Inter** (with system fallbacks `-apple-system`,
     `BlinkMacSystemFont`, `SF Pro Display`). Apple-grade homes don't mix
     a serif display face with a sans body — the unity is what makes them
     feel premium.
   - Hero H1: Inter italic 500, `letter-spacing: -0.025em`, large sizes.
   - Section H2 / card titles: Inter `font-bold tracking-tight`.
   - Body: Inter, 14–16px, `leading-relaxed`.
   - Photo overlays / captions: Inter italic 500 (not Playfair / Cormorant
     — italic serif reads as 2010s wedding-invitation).
   - **Never** use gradient text on a headline. Hierarchy is size+weight.

7. **Motion discipline:**
   - **Default ease**: `cubic-bezier(0.4, 0, 0.2, 1)` (smooth, no overshoot).
     Reserve overshoot eases for genuine "bounce" gestures only.
   - Hover lift: `-translate-y-0.5` + `shadow-2` on cards, 220ms.
   - Lightbox / open-from-thumbnail: scale 0.95 → 1, not 0.28 → 1. Subtle.
   - Scroll-linked: introduce as a Phase 3 pattern, not piecemeal.
   - Always pair with `prefers-reduced-motion` fallback.

8. **Focus rings — every interactive element:**
   `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2`.

9. **Mobile snap-scroll always carries an affordance:**
   - Right-edge gradient fade (12–24px white→transparent).
   - First card peeks ≥20% of next card.
   - Optional dot-progress indicator below.

10. **Accent gradient — hero only.** Other sections use solid `text-slate-900`
    with an `amber-700` accent word. Do not introduce new gradient stops.

## Phased Plan

### 🔥 Phase 1 — Design Tokens & Foundations (immediate)
**Goal:** Establish the system so every later change is consistent.

- [x] Define spacing scale + section padding tokens in `app/globals.css`
      (`--section-py-{sm,md,lg}` + `.section-py-{sm,md,lg}` utilities).
- [x] Define radius scale (`--radius-{card,button,image}` + utility
      classes). Existing `--home-radius-*` from `app/home-premium.css`
      remain in place for back-compat.
- [x] Define shadow scale (`--shadow-1/2/3` + utility classes). Existing
      detailed `--home-shadow-*` tokens kept; new code uses the aliases.
- [x] Lock color tokens (`--accent`, `--text-primary/secondary/muted`,
      `--surface-section-warm`, `--surface-section-dark`).
- [x] Add fixed typography scale utilities (`.text-display`, `.text-h2`,
      `.text-h3`, `.text-body`, `.text-caption`, `.text-eyebrow`,
      `.text-micro`).
- [x] Add `.focus-ring` utility for consistent interactive focus.
- [x] **Pilot migration:** swept `why-atockorea.tsx` to the new tokens —
      `section-py-sm`, `text-eyebrow`, `text-h2`, `text-h3`, `text-body`,
      `text-caption`, and `--surface-section-warm`. `home-neutral-card` /
      `rounded-home-card` left in place for Phase 2 sweep.

### 🎯 Phase 2 — Section Polishing (1 week)

Order matters — earlier items make later ones easier:

1. [x] **H2 accent unification** — Destinations + Featured Products
   gradient-text accents replaced with solid `text-slate-900` + single
   `text-amber-700 font-extrabold` accent word. Also swept those two
   sections' H2 + eyebrow + subtitle typography to the Phase 1 tokens
   (`.text-h2`, `.text-eyebrow`, `.text-body`).
2. [x] **Hero trust panel compression** — dropped the 3 redundant pill
   badges (Direct partnerships / 4.9 · 100K+ verified / Verified operators)
   that duplicated stat-card content. Hero now leads with headline + one
   tightened body line + 3 stat cards (4.9★ / 100K+ / 8 platforms).
   Card radii migrated to `rounded-card` / `rounded-image`; inline shadows
   replaced with `.shadow-1`; typography migrated to `.text-h3`,
   `.text-caption`, `.text-micro`.
3. [x] **Card radius / shadow / focus-ring sweep** —
   - Bumped `--radius-card` 20 → 24px (premium-soft sweet spot).
   - All home v2 sections: `rounded-home-card` → `.rounded-card`.
   - `rounded-[1.6rem]` skeleton → `.rounded-card`.
   - Inline shadow strings on hero radio/chip buttons + skeleton + icon
     badge → `.shadow-1` / `.shadow-2` tokens.
   - Hero destination radio + style-chip buttons gained `.focus-ring`.
   - `shadow-home-offer-*` / `shadow-home-hero-match` named tokens
     intentionally kept (tuned for premium photo offer cards).
4. [x] **Snap-scroll edge fade** — Destinations, Choose Travel Style,
   Featured Products each got a `w-14` right-edge gradient overlay
   (mobile only, hidden md+) that fades the section background over the
   rightmost cards. Signals "more →" since the scrollbar is hidden.
   Existing peek widths (39 / 68 / 44 vw) already met the ≥20% next-card
   rule, no card width changes. Dot indicator deferred to Phase 3
   (needs scroll-driven state + IntersectionObserver).
5. [x] **Hero H1 editorial italic** — H1 swapped from Inter bold to
   Playfair Display italic at weight 500, sizes nudged up
   (1.7 / 2.2 / 2.85rem from 1.4 / 1.85 / 2.4rem) so the italic serif
   doesn't read smaller than the previous bold sans. Leading tightened
   to 1.05; letter-spacing +0.005em offsets italic compression.
   Subhead stays Inter — supports the magazine-cover lead/body contrast.
   Amber accent word was dropped because amber-700 is unreadable on the
   bright Ken Burns photo background; the italic treatment itself is the
   editorial differentiator.

### 🚀 Phase 3 — Differentiating Motion & Storytelling (2–3 weeks)
- [x] Scroll-linked hero parallax — photo translates -22% as the user
      scrolls past, darken overlay opacity 0 → 0.5, headline drifts +36px
      with opacity 1 → 0.55. Built on framer-motion `useScroll` +
      `useTransform`; `useReducedMotion` collapses transforms to identity.
- [x] Process Operational mobile vertical timeline — added a single
      vertical rail on the left of the mobile/sm card column with each
      icon-badge sitting on the rail as a node. Cards refactored from 4
      duplicated blocks to a data-driven `STEPS` config + `StepIconBadge`
      helper. md (2-col) and lg (4-col with horizontal connector) layouts
      untouched. H2 migrated to `.text-h2`.
- [x] AI match thinking visualization — replaced BestMatchPreview's
      gradient skeleton with a deliberate "matcher thinking" UI: spinner
      + pulsing sparkle in the hero slot, 3-step checklist (Analyzing →
      Matching → Match ready) using the existing translation keys, and
      a progress bar that tracks `loadingStep`. Layout still mirrors the
      result card so there's no shift on transition.
- [x] Sticky bottom CTA after scroll past hero — new
      `StickyHomeCta` floats a slim dark bar (max-w-md centered, bottom-3
      mobile / bottom-5 md+) with "See My Best Matches" (white primary)
      + "Browse all tours" (ghost text). IntersectionObserver shows it
      once the hero exits and hides it once the FinalCTA enters. Match
      button smooth-scrolls to hero + focuses the intent textarea.
- [ ] Section transitions reworked from 10px gradient to organic dividers.
- [ ] Snap-scroll dot-progress indicator (deferred from Phase 2 Step 4).

### 🍎 Phase 4 — Apple-grade Polish (post-audit, 2026-05-15)

After scoring Phases 1–3 against the "premium vs tacky" north star, the home
still carries decorative tells that block the Apple grade. Phase 4 strips
them out, in priority order.

**Typography**

- [ ] Drop Playfair Display + Cormorant Garamond from the project. Replace
      `--font-display-serif` (where still in use) with Inter italic.
- [ ] Hero H1 (already converted to Inter italic in this session) — verify
      sizes at 1.85 / 2.4 / 3.1rem with `-0.025em` tracking on every
      breakpoint.
- [ ] Tour photo bottom-right captions (`TourPhotoOverlay`) move from
      `--font-display-serif` italic 700 → Inter italic 500 with
      `letter-spacing: -0.015em`.

**Decoration purge**

- [ ] Remove the SVG cumulus cloud badge from `TourPhotoOverlay`. Replace
      with a single thin uppercase region label (10px, tracking 0.18em,
      white at 70% opacity) — no fill, no stroke, no SVG. Or remove the
      region label entirely; the bottom-right stop name carries enough.
- [ ] Eyebrow labels across all sections — drop the bracketing dots
      ( ●  ATOC ONLY  ● ) and the inner shadow pill. Use plain uppercase
      label at 10–11px, accent colour, letter-spacing 0.18em.
- [ ] Hero trust-panel amber gradient background → single soft neutral
      (`--surface-card-soft`). Apple-grade trust signals don't shout.
- [ ] Emoji icons (🤝) — remove. Use Lucide outline if a glyph is needed.

**Colour reduction**

- [ ] Why-AtoC pillar icons (navy / emerald / amber / sky gradients) →
      one monochrome treatment (slate-900 outline on white, or white on
      slate-900 fill). Visual differentiation comes from the icon shape
      alone.
- [ ] Process Operational step-icon gradients (primary / emerald / sky /
      amber) → same neutral treatment, with the small uppercase step
      label as the accent.
- [ ] Final CTA trust-tile icons (amber star / emerald check / blue
      clock / sky user) → single monochrome slate-700 set.
- [ ] `shadow-home-offer-*` shadow tokens currently carry colored tints
      (cyan, violet). Either drop the tint (single greyscale shadow) or
      retire the token in favour of `--shadow-2`.

**Shape + button consistency**

- [ ] Canonical button shape: `rounded-full` for primary/secondary,
      `rounded-card` only for full-bleed cards/panels. Audit every
      `<button>` / `<Link>` and align.
- [ ] Single primary button visual: solid black (`bg-slate-900`,
      `text-white`), rounded-full, no gradient, no inset white highlight.
      Use this across hero matcher CTA, Final CTA primary, Sticky CTA,
      "View all tours" outline.

**Spacing inflation**

- [ ] Section vertical padding scale bumped: `--section-py-sm: 64px`
      (was 56), `--section-py-md: 96px` (was 80), `--section-py-lg: 144px`
      (was 112). Apple uses 96–160px between sections on most marketing
      pages.
- [ ] Eyebrow → H2 margin: bump from `mb-2` (8px) to `mb-3 md:mb-4`
      (12/16px). H2 → subtitle margin: same.

**Photography presence**

- [ ] Hero minimum height — bump 32 / 34 / 39vh → 56 / 60 / 72vh. The
      current hero is so short the photo barely registers; Apple landing
      pages routinely use 80vh+ hero.
- [ ] Destinations cards (currently 39vw mobile) — consider portrait
      cards filling 70vw on mobile so each destination photo gets real
      presence.

**Animation calm-down**

- [ ] Lightbox open animation (scale 0.28 → 1, y +180) — too theatrical.
      Reduce to scale 0.95 → 1, no y offset, 0.32s `cubic-bezier(0.4, 0, 0.2, 1)`.
- [ ] Hero parallax — verify the -22% photo translate isn't too aggressive
      on long-form scroll. Consider -12% to -15%.
- [ ] All current overshoot eases `[0.34, 1.35, 0.64, 1]` → standard ease.

## Definition of Done (every PR)

Before merging any home upgrade work, verify:

1. No new inline magic numbers for spacing/radius/shadow/color.
2. No new typography size outside the scale below.
3. Focus rings present on every new interactive element.
4. `prefers-reduced-motion` handled for any new animation.
5. Mobile (≤390px), tablet (768px), desktop (≥1280px) verified.
6. Lighthouse a11y score not regressed.

## Per-Step Summary Deliverable (required)

After every step in any phase, deliver a **visual changelog** the user can
scan without opening files. Format:

```
## Step N — <name>
**Section(s) touched:** <list>

| Element | Before | After |
|---|---|---|
| Section padding | py-10 md:py-14 (40/56px) | section-py-sm (56px both) |
| H2 typography | text-xl md:text-2xl lg:text-3xl | text-h2 |
| ...           | ...                              | ...               |

**Visual diff:** <one-line summary of what the user will see change>
**Files:** <slug list>
**Commit:** <hash>
```

This makes each merged step its own preview-able artifact and keeps the
phase rollup honest.

## Typography Size Scale (fixed)

| Token | px | Use |
|---|---|---|
| `text-display` | 36 (md:48) | Hero H1 only |
| `text-h2` | 24 (md:28) | Section H2 |
| `text-h3` | 18 (md:20) | Card titles |
| `text-body` | 14 (md:15) | Body |
| `text-caption` | 12 (md:13) | Subtitle / preview |
| `text-eyebrow` | 11 | uppercase tracking-[0.14em] |
| `text-micro` | 10 | meta / fine print |

## Color Tokens

```css
:root {
  /* brand */
  --accent: theme('colors.amber.700');           /* #b45309 */
  --accent-soft: theme('colors.amber.50');       /* tints */
  --brand-cream: #FDF8F0;                        /* warm section bg */
  --brand-dark: #141008;                         /* dark section bg */

  /* text */
  --text-primary: theme('colors.slate.900');
  --text-secondary: theme('colors.slate.600');
  --text-muted: theme('colors.slate.400');
  --text-inverse: theme('colors.white');

  /* surfaces */
  --surface-card: #ffffff;
  --surface-card-soft: theme('colors.slate.50');
  --surface-section-warm: var(--brand-cream);

  /* lines */
  --line-soft: theme('colors.slate.100');
  --line-strong: theme('colors.slate.200');
}
```

## Working Order — Next Up

**Phase 2 complete** ✅, **Phase 3 Steps 1–4 complete** ✅.

**Pivot:** rather than finishing Phase 3 Step 5 (organic section
transitions) next, do **Phase 4 — Apple-grade Polish** because the
current home has too many "tacky tells" that block premium read. The
biggest visual wins are:

1. **Decoration purge** (cumulus cloud SVG, eyebrow dots, emoji, gradient
   trust panel). Quick + huge readability gain.
2. **Colour reduction** (4-colour pillar/step icons → monochrome). One
   commit, transforms the whole feel.
3. **Typography unification** (drop Playfair + Cormorant, Inter italic
   only). Already started — hero H1 just migrated this session.

Run those three first, then revisit Phase 3 Step 5 and the snap-scroll
dot indicator.
