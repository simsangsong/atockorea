# shadcn/ui foundation (AtoC Korea)

## Inspect summary

| Item | Value |
|------|--------|
| Package manager | **npm** (`package-lock.json`) |
| Router | **App Router** (`app/`) |
| Monorepo | **No** (single Next app; `mobile/` excluded from TS) |
| Next.js | **16.x** (build uses `--webpack`) |
| React | **19.x** |
| Tailwind | **3.4** (`tailwind.config.js`) |
| Aliases | `@/*` → repo root (`components`, `lib/utils`, etc.) |

## Installed UI components

Path: `components/ui/`

| Component | File |
|-----------|------|
| Button | `button.tsx` |
| Card | `card.tsx` |
| Input | `input.tsx` |
| Textarea | `textarea.tsx` |
| Label | `label.tsx` |
| Badge | `badge.tsx` |
| Sheet | `sheet.tsx` |
| Dialog | `dialog.tsx` |
| Dropdown menu | `dropdown-menu.tsx` |
| Select | `select.tsx` |
| Tabs | `tabs.tsx` |
| Accordion | `accordion.tsx` |
| Separator | `separator.tsx` |
| Skeleton | `skeleton.tsx` |
| Sonner (toasts) | `sonner.tsx` |

Config: `components.json` (style: base-nova, neutral, CSS variables).

## Usage

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Toasts (Toaster is mounted in app/layout.tsx)
toast.success("Saved");
```

- **`cn()`** — `import { cn } from "@/lib/utils"` for class merging.
- **Dark mode (optional later)** — `next-themes` is wired with `defaultTheme="light"`. To add a toggle: set `enableSystem` or call `setTheme("dark")` from `useTheme()`; `html` gets `class="dark"` per next-themes.

## Commands used (this setup)

```bash
npx shadcn@latest add textarea label badge dropdown-menu select tabs accordion separator skeleton sonner --yes
```

(`components.json` + earlier init already covered button, card, input, dialog, sheet.)

## Build note

Use **`npm run dev`** / **`npm run build`** as defined in `package.json` (includes `--webpack` for CSS import compatibility with Next 16).

## Compatibility fix

- **`components/ui/sonner.tsx`** must start with **`"use client"`** so `useTheme()` from `next-themes` never runs on the server during static prerender.
