"use client";

/**
 * Theme provider — Phase D.1 of docs/app-shell-uiux-master-plan-2026-05-17.md.
 *
 * Thin "use client" wrapper around next-themes' ThemeProvider so we can mount
 * it inside the otherwise server-component root layout (app/layout.tsx).
 *
 * Binding decisions baked in:
 * - §B #3 — default = `system` (follow OS).
 * - §B #4 — class-based switching (matches tailwind.config darkMode: 'class').
 * - §B #13 — `disableTransitionOnChange` so toggle doesn't trigger a global
 *   transition flash. FOUC is also prevented by next-themes' inline script
 *   which runs in the head before hydration.
 * - §B #16 — token namespace strategy is implemented in app/globals.css `.dark`
 *   redefinitions (D.2 work). D.1 only wires the switching mechanism.
 *
 * The toggle UI itself is D.3 — this provider is the engine, not the steering wheel.
 */

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // storageKey is the default ("theme") — keeping it explicit so future
      // SSR debugging knows where to look.
      storageKey="theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
