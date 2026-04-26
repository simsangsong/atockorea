/**
 * Centralized invariants for admin tour writes.
 *
 * Why:
 *  - `tours.slug` is referenced by `/tour-product/[slug]`, the static product
 *    registry, sitemap entries, and matching-profile bindings (`product_id`).
 *    Letting an admin rename it through a generic PATCH silently breaks links,
 *    SEO, and matching. We require an explicit rename flow instead.
 *  - `price_type` must be one of `'person' | 'group'` — the booking POST relies
 *    on this enum to compute `total_price`. A typo silently mis-prices guests.
 *
 * Apply with `applyTourWriteRules(body)` before assembling `updateData` /
 * insert payloads. The function MUTATES the body to drop disallowed fields and
 * returns `{ ok }` for valid writes or `{ ok: false, error }` for hard rejects.
 */

const PRICE_TYPES = ["person", "group"] as const;

export type AdminTourWriteResult =
  | { ok: true; warnings: string[] }
  | { ok: false; error: string; field?: string };

export function applyTourWriteRules(body: Record<string, unknown>): AdminTourWriteResult {
  const warnings: string[] = [];

  // Slug is immutable through generic admin writes. Silently strip + warn so
  // existing forms keep working but the URL stays stable. Use a dedicated
  // rename endpoint when admins legitimately need to rebrand a product.
  if (Object.prototype.hasOwnProperty.call(body, "slug")) {
    warnings.push("slug field dropped — slugs are immutable; use the rename-slug endpoint");
    delete body.slug;
  }

  if (Object.prototype.hasOwnProperty.call(body, "price_type")) {
    const value = body.price_type;
    if (value !== undefined && value !== null) {
      if (typeof value !== "string" || !(PRICE_TYPES as readonly string[]).includes(value)) {
        return {
          ok: false,
          error: `Invalid price_type "${String(value)}" — must be one of ${PRICE_TYPES.join(", ")}`,
          field: "price_type",
        };
      }
    }
  }

  return { ok: true, warnings };
}

export const ADMIN_TOUR_PRICE_TYPES = PRICE_TYPES;
