# AtoC Korea — Home UX Upgrade Plan & Rules

> Living document. Every UI/UX upgrade on the home page (and adjacent surfaces)
> must read and follow this file. Last reviewed: 2026-05-15.

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
   - Display headlines (Hero H1, section eyebrow accents): Playfair Display
     italic via `--font-display-serif`.
   - Section H2 / card titles: Inter `font-bold` `tracking-tight`.
   - Body: Inter, 14–16px, `leading-relaxed`.
   - Editorial captions / photo overlays: Playfair Display Italic 700.

7. **Motion discipline:**
   - Hover lift: `-translate-y-0.5` + `shadow-2` on cards, 220ms.
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
- [ ] Process Operational mobile vertical timeline.
- [ ] AI match thinking visualization.
- [ ] Sticky bottom CTA after scroll past hero.
- [ ] Section transitions reworked from 10px gradient to organic dividers.
- [ ] Snap-scroll dot-progress indicator (deferred from Phase 2 Step 4).

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

**Phase 2 complete** ✅, **Phase 3 Step 1 (hero scroll parallax) complete** ✅.

Next: **Phase 3 Step 2 — Process Operational mobile vertical timeline**.
The dark "How AtoC works" section currently shows a 4-step horizontal
connector line on lg only (`hidden lg:block`); mobile/tablet just get
four isolated cards. Add a left-side vertical timeline rail with stepped
nodes on mobile so the journey reads as a sequence.
