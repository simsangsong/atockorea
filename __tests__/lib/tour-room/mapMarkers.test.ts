/**
 * Room-map marker art.
 *
 * These are strings, so they are checkable without the Maps SDK — but a string
 * test cannot tell you a pin is ugly. What it CAN hold is the handful of
 * properties that were actually wrong before, and the ones that break silently:
 * a pin whose tip is not on the coordinate points at the wrong place, and a
 * `var(--tr-…)` in here renders as nothing at all because the SDK rasterises
 * this art from a URL, where CSS custom properties do not exist.
 */
import {
  basemapStyle,
  companionDot,
  facilityDot,
  myLocationDot,
  pickupPin,
  stopPin,
  vehiclePin,
  type MarkerArt,
} from '@/lib/tour-room/mapMarkers';

const ALL: Array<[string, MarkerArt]> = [
  ['vehicle', vehiclePin()],
  ['me', myLocationDot()],
  ['companion', companionDot()],
  ['stop', stopPin()],
  ['pickup', pickupPin()],
  ['facility', facilityDot()],
];

const svgOf = (art: MarkerArt) =>
  decodeURIComponent(art.url.replace('data:image/svg+xml;charset=UTF-8,', ''));

describe('marker art', () => {
  it.each(ALL)('%s is a self-contained inline SVG', (_name, art) => {
    expect(art.url.startsWith('data:image/svg+xml;charset=UTF-8,')).toBe(true);
    const svg = svgOf(art);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`width="${art.width}"`);
    expect(svg).toContain(`height="${art.height}"`);
    // No network: a marker that has to fetch is a marker that can fail to draw.
    // The SVG namespace is a URI, not a request — everything else must be local.
    expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//);
  });

  it.each(ALL)('%s uses literal colours, never CSS variables', (_name, art) => {
    // 🔴 `var(--tr-accent)` inside marker art silently renders as nothing.
    expect(svgOf(art)).not.toContain('var(--');
  });

  it.each(ALL)('%s anchors inside its own art', (_name, art) => {
    expect(art.anchorX).toBeGreaterThanOrEqual(0);
    expect(art.anchorX).toBeLessThanOrEqual(art.width);
    expect(art.anchorY).toBeGreaterThanOrEqual(0);
    expect(art.anchorY).toBeLessThanOrEqual(art.height);
  });

  describe('pins point at the coordinate; dots sit on it', () => {
    it.each([
      ['vehicle', vehiclePin()],
      ['stop', stopPin()],
      ['pickup', pickupPin()],
    ])('%s anchors at its tip, near the bottom of the art', (_name, art) => {
      expect(art.anchorX).toBe(art.width / 2);
      expect(art.anchorY).toBeGreaterThan(art.height * 0.85);
      // The label belongs in the head, well above the tip.
      expect(art.labelY).toBeLessThan(art.height / 2);
    });

    it.each([
      ['me', myLocationDot()],
      ['companion', companionDot()],
      ['facility', facilityDot()],
    ])('%s anchors at its centre', (_name, art) => {
      expect(art.anchorX).toBe(art.width / 2);
      expect(art.anchorY).toBe(art.height / 2);
    });
  });

  it('draws the vehicle as one teardrop, not a circle stacked on a triangle', () => {
    const svg = svgOf(vehiclePin());
    // 🔴 The first cut drew `<path triangle/>` then `<circle/>`, each with its
    // own white ring — on screen the circle's stroke painted a white scar across
    // the tail. One outline is the fix, and the shape is the whole point.
    expect(svg).not.toContain('<circle cx="20" cy="19"');
    const body = svg.match(/<path d="M20 47[^"]*"/);
    expect(body).not.toBeNull();
    expect(body![0]).toContain('A15 15'); // the head arc, in the same path
    expect(body![0]).toContain('C'); // the tail curves, in the same path
  });

  it('gives the guide a car, per 사장님 2026-08-07 — and no emoji anywhere', () => {
    const svg = svgOf(vehiclePin());
    // lucide `Car`: a body path plus two wheels. Matching the wheels is what
    // separates "a car" from "some path someone swapped in".
    expect(svg).toContain('<circle cx="7" cy="17" r="2"/>');
    expect(svg).toContain('<circle cx="17" cy="17" r="2"/>');
    for (const [, art] of ALL) {
      // U-D3 — no emoji in UI chrome. The guide used to be a 🚌 label.
      expect(svgOf(art)).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });

  it('makes the vehicle the biggest thing on the map', () => {
    const vehicle = vehiclePin();
    for (const [name, art] of ALL) {
      if (name === 'vehicle') continue;
      expect(art.width).toBeLessThan(vehicle.width);
    }
  });
});

describe('basemap style', () => {
  it.each(['light', 'dark'] as const)('%s hides the clutter but keeps place names', (theme) => {
    const style = basemapStyle(theme);
    const off = (featureType: string, elementType?: string) =>
      style.some(
        (rule) =>
          rule.featureType === featureType &&
          (elementType === undefined || rule.elementType === elementType) &&
          (rule.stylers as Array<{ visibility?: string }>).some((s) => s.visibility === 'off'),
      );
    expect(off('poi', 'labels.icon')).toBe(true);
    expect(off('poi.business')).toBe(true);
    expect(off('transit', 'labels.icon')).toBe(true);
    // 🔴 Labels stay ON. A guest who is lost reads street and district names —
    // the previous style hid `poi/labels` outright, icons and text together.
    expect(off('poi', 'labels')).toBe(false);
    expect(style.some((r) => r.elementType === 'labels.text.fill')).toBe(true);
  });

  it('is actually two different maps, not one with a tint', () => {
    expect(JSON.stringify(basemapStyle('light'))).not.toEqual(JSON.stringify(basemapStyle('dark')));
  });
});
