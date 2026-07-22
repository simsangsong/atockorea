import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  /**
   * Consumer-isolated legacy static tour surfaces (`data/tours`, `app/jeju/[slug]` family).
   * New tour work must use API + `TourListCard` / `app/tour/[id]` or `/tour-product/*`.
   * @see `.cursor/rules/legacy-isolated-tour-surfaces.mdc`
   */
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "app/jeju/**",
      "components/TourCardDetail.tsx",
      "data/tours.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/TourCardDetail",
              message:
                "Legacy list card tied to data/tours. Use components/tour/TourListCard + API adapters for new work. See .cursor/rules/legacy-isolated-tour-surfaces.mdc",
            },
          ],
          patterns: [
            {
              group: ["@/data/tours", "**/data/tours", "**/data/tours.ts"],
              message:
                "Legacy static tour catalog (permanently isolated from new SKUs). Use GET /api/tours + adapters, TourListCard, or /tour-product/* — not data/tours. See .cursor/rules/legacy-isolated-tour-surfaces.mdc",
            },
          ],
        },
      ],
    },
  },
  /**
   * W3.1 (tour-detail high-end plan §F-6) — the detail page's decorative
   * colors are the curated `--tpc-*` tokens in tour-product-v2-scope.css.
   * Raw tailwind 400/500/600 primaries and new inline hex are blocked inside
   * the section bundle; semantic pills use 50/700 steps and the action CTA
   * uses amber-700/800, which this pattern deliberately does not match.
   * Mapping table: docs/tour-product-color-mapping.md
   */
  {
    files: ["components/product-tour-static/east-signature-nature-core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/(emerald|rose|violet|sky|orange|amber|teal|indigo)-(400|500|600)/]",
          message:
            "Raw primary tailwind color in the tour-detail bundle. Use the curated --tpc-* tokens (docs/tour-product-color-mapping.md).",
        },
        {
          selector: "TemplateElement[value.raw=/(emerald|rose|violet|sky|orange|amber|teal|indigo)-(400|500|600)/]",
          message:
            "Raw primary tailwind color in the tour-detail bundle. Use the curated --tpc-* tokens (docs/tour-product-color-mapping.md).",
        },
      ],
    },
  },
  /**
   * M-D6 (docs/tour-app-highend-motion-master-plan-2026-07-22.md): native
   * browser dialogs are banned on tour surfaces — iOS WebView silently
   * returns true for confirm() (see components/admin/ConfirmSheet.tsx), and
   * they are the opposite of the high-end feel. Use useConfirmSheet().
   */
  {
    files: ["components/tour-mode/**/*.{ts,tsx}", "components/tour-ops/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "confirm", message: "Use useConfirmSheet() from components/tour-mode/ConfirmSheet (M-D6)." },
        { name: "alert", message: "Use the toast/say pattern instead (M-D6)." },
        { name: "prompt", message: "Use useConfirmSheet().prompt (M-D6)." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='window'][property.name=/^(confirm|alert|prompt)$/]",
          message: "Native dialogs are banned on tour surfaces — use useConfirmSheet() (M-D6).",
        },
      ],
    },
  },
]);

export default eslintConfig;
