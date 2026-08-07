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
    // Two wheels, level with each other, plus a hub knocked out of each. That
    // pairing is what separates "a car" from "some path someone swapped in".
    const wheels = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="3" fill="white"\/>/g)];
    expect(wheels).toHaveLength(2);
    expect(wheels[0][2]).toBe(wheels[1][2]); // same axle line
    expect(wheels[0][1]).not.toBe(wheels[1][1]);
    for (const [, cxWheel, cyWheel] of wheels) {
      expect(svg).toContain(`<circle cx="${cxWheel}" cy="${cyWheel}" r="1.2" fill="#2b5647"/>`);
    }
    for (const [, art] of ALL) {
      // U-D3 — no emoji in UI chrome. The guide used to be a 🚌 label.
      expect(svgOf(art)).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });

  /**
   * 🔴 사장님 2026-08-07, 두 번째 지시: "자동차 그림으로, 이쁘고 컴팩트한".
   *
   * The first cut inlined lucide `Car`, which is a STROKE family — a 1.7px
   * outline scaled into a 17px pin head is a thin sketch of a car, and at map
   * size a sketch loses to a shape. Nothing about the glyph may go back to
   * outlines.
   */
  it('draws the car as filled mass, not as an outline', () => {
    const svg = svgOf(vehiclePin());
    const glyph = svg.slice(svg.indexOf('<g transform='));
    expect(glyph).toContain('fill="white"');
    expect(glyph).not.toContain('fill="none"');
    expect(glyph).not.toContain('stroke-width');
    // The knockouts are the PIN's colour, so the glyph stays a hole in the pin
    // and needs no third value kept in sync with the body.
    expect(glyph).toContain('fill="#2b5647"');
  });

  /**
   * 🔴 The palette regression this file exists to prevent.
   *
   * The markers shipped with `#f59e0b` amber stops and `#10b981` emerald pickup
   * — a generic pair inherited from the art they replaced, on the one screen
   * where the brand should be most present. The room's signature has been DEEP
   * PINE since U4-D8 (`app/tour-room-theme.css`). If either value comes back,
   * something copied the old art instead of reading the palette above it.
   */
  it('is painted in the room palette, not the generic amber/emerald it shipped with', () => {
    for (const [, art] of ALL) {
      expect(svgOf(art)).not.toContain('#f59e0b');
      expect(svgOf(art)).not.toContain('#10b981');
    }
    expect(svgOf(vehiclePin())).toContain('#3c7161'); // pine, the signature
    expect(svgOf(pickupPin())).toContain('#c08b3e'); // brass, the one warm accent
    // "You are here" blue is deliberately NOT branded — see the source comment.
    expect(svgOf(myLocationDot())).toContain('#2563eb');
  });

  it('gives every pin a gradient body and a soft shadow, not a flat sticker', () => {
    for (const [name, art] of [
      ['vehicle', vehiclePin()],
      ['stop', stopPin()],
      ['pickup', pickupPin()],
    ] as const) {
      const svg = svgOf(art);
      expect(`${name}:${svg.includes('linearGradient')}`).toBe(`${name}:true`);
      expect(svg).toContain('fill="url(#g)"');
      // 🔴 A radial gradient, never `feGaussianBlur` — a filter that silently
      // no-ops in a WebView leaves a hard black smudge under the pin.
      expect(svg).toContain('radialGradient');
      expect(svg).not.toContain('feGaussianBlur');
    }
  });

  /**
   * Stops sit on the white road fill in light and on near-black tiles in dark,
   * from ONE piece of art. Two earlier drafts each failed one side: an ivory
   * body vanished on the road, and a near-black body left an empty ivory outline
   * on the dark basemap — a legibility LOSS, because stops used to be amber.
   */
  it('keeps the stop body clear of both basemaps', () => {
    const top = /stop-color="(#[0-9a-f]{6})"/i.exec(svgOf(stopPin()).split('linearGradient')[1]!)![1];
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(lum(top)).toBeLessThan(lum('#eef1ee') - 0.2); // dark against the light canvas
    expect(lum(top)).toBeGreaterThan(lum('#1b1f24') + 0.02); // still lifts off the dark one
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
