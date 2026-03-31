# V0 design port — cleanup summary

Date: 2025-03-21 (maintenance pass after visual port).

## 1. Duplication identified (during port)

| Area | What was duplicated | Mitigation |
|------|---------------------|------------|
| MyPage + tours list | Same Tailwind triplet: `!rounded-2xl` + `shadow-[0_12px_40px_rgba(15,23,42,0.06)]` on `GlassPanel` soft | Consolidated into **`.v0-shell-elevated`** in `src/styles/v0-skin.css`. |
| Search summary bar | `!rounded-2xl` + `shadow-[0_8px_28px_…]` | Consolidated into **`.v0-shell-elevated-sm`**. |
| Planner (dark theme) | Frosted panels + step shells | Remain in `app/globals.css` under `.tour-planner-page` (`.v0-planner-*`, `.glass-card`, etc.); **different theme** from light `GlassPanel` — merge only if we introduce shared CSS variables later. |
| Docs | Old path to V0 export repeated | `docs/v0-design-port-plan.md` updated; this file records removal. |

## 2. Removed (unused / demo)

| Item | Notes |
|------|--------|
| **`components/v0-home/`** (entire tree) | V0 **SPA export** (prototype `app/page.tsx`, duplicate `components/ui/*`, hooks, assets). **Not imported** by production routes; only referenced in docs. Removed to shrink the repo and avoid `tsc`/IDE noise. **Recover from git history** if you need a visual reference. |
| **`PlannerDetailSheetShell.tsx`** | Never imported by the app; planner uses inline layout / maps. |
| **`BottomNavShell.tsx`** | Never imported; live nav remains `components/BottomNav.tsx`. The **`.v0-bottom-bar-shell`** class in `v0-skin.css` remains if you want the same look without a wrapper component. |

Exports removed from `src/components/v0-skin/index.ts` accordingly.

## 3. Shared visuals kept (actively used)

These stay in **`@/src/components/v0-skin`** and **`src/styles/v0-skin.css`**:

- **`AppBackground`**, **`GlassPanel`**, **`SectionShell`**, **`ProductVisualCard`**
- **`PlannerModalShell`**, **`ProgressShell`**
- **CSS:** tokens (`--v0-*`), `.v0-glass-panel*`, `.v0-section-shell*`, `.v0-card-image-shell`, `.v0-bottom-bar-shell`, **`.v0-shell-elevated`**, **`.v0-shell-elevated-sm`**, planner/compare utilities, etc.

No business logic, API routes, or data contracts were changed in this cleanup.

## 4. Duplicated styles to merge later (optional)

1. **`TourListCard`** — still uses `!rounded-[1.75rem]` on `GlassPanel` soft; could align with `.v0-shell-elevated` or a dedicated **`.v0-shell-tour-card`** if radius should match MyPage shells.
2. **`app/tour/[id]/checkout/page.tsx`** — local `shadow-[0_8px_30px…]` / hover shadows; could adopt `.v0-shell-elevated*` when that page is touched for design.
3. **`.tour-planner-page`** (globals) vs **`v0-skin.css`** — two “glass” languages (dark cyan vs light frost). Unify only via **design tokens** (`:root` / `@theme`) if product wants one system.

## 5. Verification

- Grep: no `from '…/v0-home'` or `BottomNavShell` / `PlannerDetailSheetShell` in `app/`, `components/`, `src/` (excluding this doc).
- `ReadLints` on touched TS/TSX: clean after edits.

---

*Add future cleanup notes below this line.*
