# Home v2 — v0 visual fidelity pass

Reference: `components/landing page (4)/` (original v0 export). Migrated body: `components/home/v2/` rendered by `HomeV2Page` inside the existing site shell (header/footer unchanged).

## Biggest sources of visible drift (before this pass)

1. **Global touch-target rule** — `app/globals.css` sets `button, a { min-height: 44px; min-width: 44px; }` for the whole app. v0 assumes compact chips, small links, and dense CTAs. That alone inflated controls and broke vertical rhythm.
2. **Theme `primary` vs v0** — Site `:root` uses neutral oklch primaries. v0 used a **navy oklch primary** (`oklch(0.3 0.08 240)`). Anything using `bg-primary`, `text-primary`, `from-primary`, or `shadow-primary/…` rendered as a different hue and weight than v0.
3. **Shared “home v2” button variant** — `homeV2Navy` fixed hero/final-CTA contrast against the wrong `primary`, but it **diverged from v0’s shadcn `Button`**, which relied on scoped `primary` plus occasional inline gradients (hero).
4. **Section substitutions** — `HomeV2SectionEyebrow`, `hv2-section-title` / `hv2-section-lead`, and `home-v2-navy` Tailwind tokens changed pill copy, title scale, and process connector colors vs the literal v0 class strings.
5. **Hero media & overlays** — v0 used a **full-bleed looping video** with a tall bottom wash into the form zone; the migrated page used a still image and a **short bottom fade**, which changed perceived height, texture, and the transition into the card.
6. **Visual break band** — v0 used a taller cinematic crop (`26vh`→`38vh`), `scale-105` on video, stronger gradient stack, and **centered** copy. The migrated version shortened the band and moved copy to the lower third with lighter overlays.
7. **Style chips** — v0 used **pill** chips with inset gradient + hairline border; migrated used smaller **rounded-lg** tiles tied to `homeV2` navy.
8. **Animation class names** — v0 used `scroll-animate` + `visible`; migrated used `home-v2-scroll-animate` + `home-v2-visible`. Behavior was similar but not identical to v0’s utility definitions.

## What was corrected (this pass)

- **`app/home-v2-fidelity.css`** — Wrapper **`.home-v2-body-isolate`** on the home v2 body:
  - Re-applies v0 **light-mode oklch token set** (`--primary`, `--ring`, `--radius`, etc.) so Tailwind/shadcn utilities match v0 inside this subtree.
  - **Resets** the global 44×44 `button`/`a` minimums for descendants only.
  - Reintroduces v0 **`scroll-animate` / `visible`** rules under the same wrapper.
- **`components/home/v2/ui/v0-shadcn-button.tsx`** — v0-pattern **Radix + CVA** button (outline uses `shadow-sm` instead of v0-only `shadow-xs`).
- **`components/home/v2/HomeV2Page.tsx`** — Inner content wrapped with **`home-v2-body-isolate`**.
- **`app/layout.tsx`** — Imports **`home-v2-fidelity.css`** after `home-v2.css`.
- **Section files** — Restored v0 **DOM/class structure** where it had been substituted (eyebrow components → v0 pills/headers), **primary-based** gradients where v0 used them, **hero video + overlays**, **visual-break** dimensions/overlays/copy placement, **pill chips**, and **`scroll-animate` + `visible`** + v0 **`data-animate` / `data-review`** hooks.
- **`tailwind.config.js`** — Added **`slate.150`** so v0’s `border-slate-150/50` on disabled destination tiles generates the intended utility.

## What cannot be 1:1 identical (and why)

- **Font stack** — v0’s export referenced Inter via its own `@theme` wiring; this app uses **Pretendard + Inter variables** from the root layout. Hero still sets `fontFamily: var(--font-sans)` inline like v0, but the computed stack differs slightly from the standalone v0 app.
- **Tailwind major / plugin differences** — v0 used Tailwind v4-style imports; this repo uses **Tailwind v3** config. Some v4-only utilities (e.g. `shadow-xs`) are approximated (`shadow-sm` or arbitrary shadows).
- **Localized copy & dynamic match UI** — The migrated page keeps **next-intl strings** and the **in-page match flow** (loading/result). v0 was static English only; those states have no exact v0 twin, so only **idle/example** sections can match v0 literally.
- **Remote images** — v0 pointed at `/images/...` assets that are not guaranteed in this repo; remote Unsplash/Pexels URLs stand in for the same framing intent.
- **Site shell & atmosphere** — The v2 page keeps the existing **header/footer** and the soft **HOME_V2_ATMOSPHERE** layer behind the body. v0 was a full-page export; the shell and outer atmosphere are intentionally **not** cloned.

## Maintenance note

Keep new home-marketing work **inside** `.home-v2-body-isolate` if it must respect v0 tokens. For the rest of the app, do **not** rely on those scoped variables — they are intentionally subtree-local.

## Follow-up: `bg-primary` looked white (fixed)

`V0ShadcnButton` and several sections use Tailwind **`bg-primary` / `from-primary` / `shadow-primary/…`**. Those utilities only exist if `theme.extend.colors.primary` is defined. This repo’s `tailwind.config.js` previously listed `background`, `foreground`, `border`, etc., but **not** `primary`, so Tailwind often **did not emit** `.bg-primary` at all — the control fell back to a default/transparent surface and read as “white” on light cards.

**Fix:** extend `tailwind.config.js` with shadcn-style semantic colors (`primary`, `secondary`, `muted`, `accent`, `destructive`, `card`, `popover`) all pointing at the existing CSS variables. Then `var(--primary)` from `:root`, `.dark`, or `.home-v2-body-isolate` resolves correctly.
