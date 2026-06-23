import type { PriceLine } from "./pricing-policy";

/**
 * Plain-text label for a price-breakdown line. Used by surfaces that don't
 * have access to `next-intl` (server-rendered HTML emails, confirmation page
 * fallback). The planner's LivePriceCard uses the i18n `labelKey` directly
 * via `useTranslations`; this helper is the non-i18n equivalent so server
 * code doesn't render raw machine codes like "base" / "pax_tier" / "jeju_pickup"
 * to customers.
 *
 * Phase 10.5.1 — extracted to a single source of truth after the audit
 * found the confirmation page rendered `line.code` directly while the email
 * template had its own duplicate switch with proper labels.
 */
export function formatPriceLineLabel(line: PriceLine): string {
  const meta = line.meta ?? {};
  switch (line.code) {
    case "base": {
      const hours = meta.hours ?? "?";
      const tier = meta.tier ?? "english";
      const tierLabel =
        tier === "chinese" ? "Chinese-tier" : tier === "smart_guide" ? "Smart Guide" : "English-tier";
      return `Base · ${hours}h ${tierLabel}`;
    }
    case "pax_tier":
      if (meta.vehicle === "van") return "Van (7–9 pax)";
      return meta.peak ? "Solati · peak season" : "Solati (10–13 pax)";
    case "region":
      return "Region surcharge";
    case "jeju_cross_region": // legacy code (pre-Phase D bookings)
      return "Jeju cross-region";
    case "jeju_east_mix":
      return "Jeju East-side mix";
    case "jeju_cross_side":
      return "Jeju cross-side pickup";
    case "jeju_distance_capped":
      return "Jeju distance surcharge (capped)";
    case "jeju_pickup": {
      const zone = String(meta.zone ?? "city");
      const zoneLabel = ({
        city: "Jeju city (downtown)",
        out_west: "Out-of-city · west",
        out_east: "Out-of-city · east",
        out_south: "Out-of-city · south",
      } as Record<string, string>)[zone] ?? zone;
      return `Jeju pickup · ${zoneLabel}`;
    }
    case "dmz_base":
      return `DMZ tour · ${meta.pax ?? "?"} pax`;
    case "cruise_excursion":
      return "Cruise shore-excursion";
    case "gangjeong_port":
      return "Gangjeong Port surcharge";
    default:
      return line.code;
  }
}
