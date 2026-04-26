/**
 * Port-based route variant types for cruise shore-excursion products.
 *
 * Some tour products (currently: Jeju Cruise Shore Excursion bus + small-group)
 * change their entire 4-stop itinerary based on the ship's docking port. Instead
 * of forcing authors into the richer `itineraryStops` shape (which carries
 * `image`, `whyOnRoute`, `convenience`, `smartNotes`, etc.), these products
 * keep a light "routeVariants" array where each variant has its own
 * `dockingPort` meta and a compact stops list focused on highlights + basic
 * visit info.
 *
 * The timeline renders a port toggle above the stops; the `TourStickyBookingBar`
 * shows the selected port label on the CTA.
 */

export type PortVariantStop = {
  number: number;
  name: string;
  category: string;
  duration: string;
  description: string;
  highlights: readonly string[];
  visitBasics: {
    hours: string;
    closed: string;
    admission: string;
    walking: string;
  };
};

export type DockingPort = {
  name: string;
  address?: string;
  meetingPoint?: string;
  pickupWindow?: string;
  returnPolicy?: string;
};

export type PortRouteVariant = {
  variant_id: string;
  title: string;
  dockingPort: DockingPort;
  summary?: string;
  stops: readonly PortVariantStop[];
};
