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
]);

export default eslintConfig;
