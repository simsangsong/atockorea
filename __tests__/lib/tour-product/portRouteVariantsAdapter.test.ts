import * as fs from "node:fs";
import * as path from "node:path";

import { mapItineraryVariantsToRouteVariants } from "@/lib/tour-product/portRouteVariantsAdapter";
import { buildTourProductViewModelFromFullPageJson } from "@/components/product-tour-static/_shared/buildTourProductViewModelFromJson";

describe("mapItineraryVariantsToRouteVariants", () => {
  it("returns null for missing input", () => {
    expect(mapItineraryVariantsToRouteVariants(undefined)).toBeNull();
    expect(mapItineraryVariantsToRouteVariants(null)).toBeNull();
    expect(mapItineraryVariantsToRouteVariants([])).toBeNull();
    expect(mapItineraryVariantsToRouteVariants({})).toBeNull();
    expect(mapItineraryVariantsToRouteVariants("not an array")).toBeNull();
  });

  it("returns null when variants have no usable stops", () => {
    const input = [
      { port_id: "jeju_port", port_label: "Jeju Port", stops: [] },
      { port_id: "gangjeong_port", stops: [{ noName: true }] },
    ];
    expect(mapItineraryVariantsToRouteVariants(input)).toBeNull();
  });

  it("maps a minimal valid variant", () => {
    const input = [
      {
        port_id: "jeju_port",
        port_label: "Jeju Port (Northern Terminal)",
        port_label_short: "Jeju Port",
        route_focus: "East coast UNESCO landmarks",
        stops: [
          {
            name: "Pickup",
            category: "Logistics",
            description: "Meet at arrival hall.",
            highlights: ["Pickup 30 min after clearance"],
            number: 1,
            duration: "30 min",
            time: "Cruise arrival + 30 min",
            whyOnRoute: "Sets the cruise tempo for the day.",
          },
        ],
      },
    ];
    const out = mapItineraryVariantsToRouteVariants(input);
    expect(out).not.toBeNull();
    expect(out).toHaveLength(1);
    const variant = out![0]!;
    expect(variant.variant_id).toBe("jeju_port");
    expect(variant.title).toBe("Jeju Port");
    expect(variant.dockingPort.name).toBe("Jeju Port (Northern Terminal)");
    expect(variant.summary).toBe("East coast UNESCO landmarks");
    expect(variant.stops).toHaveLength(1);
    const stop = variant.stops[0]!;
    expect(stop.number).toBe(1);
    expect(stop.name).toBe("Pickup");
    expect(stop.duration).toBe("30 min");
    expect(stop.time).toBe("Cruise arrival + 30 min");
    expect(stop.whyOnRoute).toBe("Sets the cruise tempo for the day.");
    expect(stop.highlights).toEqual(["Pickup 30 min after clearance"]);
    expect(stop.visitBasics).toBeUndefined();
  });

  it("falls back stop numbers to position when missing or non-positive", () => {
    const input = [
      {
        port_id: "p",
        port_label: "P",
        stops: [
          { name: "A" },
          { name: "B", number: 0 },
          { name: "C", number: -1 },
        ],
      },
    ];
    const out = mapItineraryVariantsToRouteVariants(input)!;
    expect(out[0]!.stops.map((s) => s.number)).toEqual([1, 2, 3]);
  });

  it("skips variants missing port_id or all-empty stops", () => {
    const input = [
      { stops: [{ name: "Orphan" }] }, // no port_id
      { port_id: "ok", port_label: "OK", stops: [{ name: "Real" }] },
    ];
    const out = mapItineraryVariantsToRouteVariants(input)!;
    expect(out).toHaveLength(1);
    expect(out[0]!.variant_id).toBe("ok");
  });

  it("drops visitBasics when every inner field is empty/whitespace", () => {
    const input = [
      {
        port_id: "p",
        port_label: "P",
        stops: [{ name: "S", visitBasics: { hours: "  ", closed: "" } }],
      },
    ];
    const out = mapItineraryVariantsToRouteVariants(input)!;
    expect(out[0]!.stops[0]!.visitBasics).toBeUndefined();
  });

  it("preserves visitBasics when at least one inner field is present", () => {
    const input = [
      {
        port_id: "p",
        port_label: "P",
        stops: [{ name: "S", visitBasics: { admission: "Free" } }],
      },
    ];
    const out = mapItineraryVariantsToRouteVariants(input)!;
    expect(out[0]!.stops[0]!.visitBasics).toEqual({
      hours: undefined,
      closed: undefined,
      admission: "Free",
      walking: undefined,
    });
  });
});

describe("buildTourProductViewModelFromFullPageJson — Jeju cruise integration", () => {
  const readBundle = (slug: string) => {
    const p = path.join(
      process.cwd(),
      "components",
      "product-tour-static",
      slug,
      `${slug}.en.json`,
    );
    return JSON.parse(fs.readFileSync(p, "utf8"));
  };

  it("wires itinerary_variants into routeVariants for the bus-tour bundle", () => {
    const doc = readBundle("jeju-cruise-shore-excursion-bus-tour");
    expect(doc.routeVariants).toBeUndefined();
    expect(Array.isArray(doc.itinerary_variants)).toBe(true);
    expect(doc.itinerary_variants.length).toBeGreaterThan(0);

    const vm = buildTourProductViewModelFromFullPageJson(doc, "en");
    expect(Array.isArray(vm.routeVariants)).toBe(true);
    expect(vm.routeVariants!.length).toBe(doc.itinerary_variants.length);
    const ids = vm.routeVariants!.map((v) => v.variant_id).sort();
    expect(ids).toEqual(["gangjeong_port", "jeju_port"]);
    for (const variant of vm.routeVariants!) {
      expect(variant.dockingPort.name).toBeTruthy();
      expect(variant.stops.length).toBeGreaterThan(0);
      for (const stop of variant.stops) {
        expect(stop.name).toBeTruthy();
        expect(stop.number).toBeGreaterThan(0);
      }
    }
  });

  it("wires itinerary_variants into routeVariants for the small-group bundle", () => {
    const doc = readBundle("jeju-cruise-shore-excursion-small-group-tour");
    const vm = buildTourProductViewModelFromFullPageJson(doc, "en");
    expect(vm.routeVariants).toBeDefined();
    expect(vm.routeVariants!.length).toBe(doc.itinerary_variants.length);
  });

  it("leaves routeVariants undefined for products without populated variants", () => {
    const doc = readBundle("jeju-grand-highlights-loop");
    const vm = buildTourProductViewModelFromFullPageJson(doc, "en");
    // Empty / absent → either undefined or an empty array; never a stale fabrication.
    const rv = vm.routeVariants;
    expect(rv === undefined || (Array.isArray(rv) && rv.length === 0)).toBe(true);
  });
});
