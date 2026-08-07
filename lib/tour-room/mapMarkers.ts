/**
 * Room-map marker art — the vocabulary the guest's map is drawn in.
 *
 * 🔴 Why SVG data URIs and not `google.maps.SymbolPath.CIRCLE` + an emoji label.
 *
 * The map used to draw the guide as 🚌 typed into a marker LABEL on a plain
 * black circle. Three things were wrong with that at once: the room's own icon
 * rule (`components/tour-mode/icons.ts`) is "no emoji in UI chrome"; an emoji
 * label renders in whatever font the guest's OS ships, so the same tour looked
 * different on every phone; and a flat circle reads as "a dot", not as "the
 * vehicle you are waiting for". Kakao and Naver both solve this the same way —
 * a shaped pin with a glyph inside and a shadow that lifts it off the tiles.
 *
 * Everything here is a pure string builder, so the art is unit-testable
 * without the Maps SDK loaded (`__tests__/lib/tour-room/mapMarkers.test.ts`).
 * The canvas turns `MarkerArt` into `google.maps.Icon` at the call site — that
 * is the only part that needs `google.maps.Size` / `Point`.
 *
 * 🔴 The colours are literals on purpose. Marker art is rasterised by the Maps
 * SDK from a URL, so it can never read a CSS custom property — `var(--tr-…)`
 * inside this SVG silently renders as nothing. Any change here has to be made
 * against the token values by hand, which is why they are named below.
 */

/**
 * 🔴 The palette was off-brand, and the token names were lying about it.
 *
 * `ACCENT` here was `#f59e0b` and `SAFE` was `#10b981` — a generic amber and a
 * generic emerald, inherited from the markers this file replaced. The room's
 * signature has been DEEP PINE since U4-D8 (`app/tour-room-theme.css`:
 * `--tr-accent: #2e5e4e`, `--tr-safe: #3f6b58`, canvas `#eef1ee`, ivory
 * surfaces). So the one screen where the brand should be most present was the
 * one screen still painted in another app's colours.
 *
 * Colours here are gradient PAIRS, not flats. A pin is a small object with a
 * shadow under it; a flat fill reads as a sticker, and this is the surface the
 * guest stares at while they wait.
 */
const PINE = ['#3c7161', '#234a3d'] as const; // the vehicle — the hero marker
/**
 * Itinerary stops — slate, not black.
 *
 * 🔴 Drawn as near-black first, and the dark basemap ate it: `#14171b` on
 * `#1b1f24` leaves an ivory outline with nothing inside, and stops used to be
 * amber, so that would have been a legibility LOSS traded for a nicer light
 * theme. This slate is still unmistakably dark against the ivory canvas and
 * still lifts off the dark one, which is what one marker set for two themes has
 * to do.
 */
const INK = ['#3a424a', '#1e232a'] as const;
const BRASS = ['#c08b3e', '#96682a'] as const; // the pickup point — warm, singular
const PINE_HOLLOW = '#2b5647'; // the car's knockouts, one step darker than PINE
const ME = '#2563eb'; // "you are here" blue stays conventional on purpose
const COMPANION = '#565d66'; // --tr-ink-2
const FACILITY = '#9ca3af';
const IVORY = '#fcfcfb'; // --tr-surface: the ring, and the ink on every pin

/** The colour a Google `label` must use to sit on these pins. */
export const MARKER_LABEL_INK = IVORY;

export interface MarkerArt {
  /** `data:image/svg+xml` URI, ready for `google.maps.Icon.url`. */
  url: string;
  width: number;
  height: number;
  /** Where the art touches the coordinate (pin tip, or dot centre). */
  anchorX: number;
  anchorY: number;
  /** Where a Google `label` should sit, when the marker carries one. */
  labelX: number;
  labelY: number;
}

function dataUri(svg: string): string {
  // Collapse the authoring whitespace before encoding — the URI travels in a
  // DOM attribute for every marker on screen.
  const compact = svg.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(compact)}`;
}

/**
 * The shadow every pin stands on — a soft radial falloff, not a hard ellipse.
 *
 * 🔴 Deliberately NOT `feGaussianBlur`. Filters inside an SVG *image* are
 * honoured unevenly across the WebViews this app actually runs in, and a filter
 * that silently no-ops leaves a hard black smudge under the pin. A radial
 * gradient is plain painting: every renderer that draws the pin draws this.
 *
 * IDs are safe to repeat across markers — each data URI is its own document.
 */
function groundShadow(cx: number, cy: number, rx: number, ry: number): string {
  return [
    '<defs><radialGradient id="s">',
    '<stop offset="0" stop-color="#000" stop-opacity=".30"/>',
    '<stop offset=".55" stop-color="#000" stop-opacity=".13"/>',
    '<stop offset="1" stop-color="#000" stop-opacity="0"/>',
    '</radialGradient></defs>',
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#s)"/>`,
  ].join('');
}

/** Vertical body gradient — the difference between an object and a sticker. */
function bodyGradient([top, bottom]: readonly [string, string]): string {
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>`;
}

/**
 * The teardrop, as ONE path.
 *
 * 🔴 The first cut of this drew a triangle and then a circle on top of it, each
 * with its own white ring. On screen that reads as a dart with a white scar
 * across the neck — the circle's stroke paints straight over the tail, and the
 * tail's own corners stay sharp where a pin should flare. Merging head and tail
 * into a single outline means one continuous stroke and a real teardrop.
 */
function pinBody(cx: number, cy: number, r: number, tipY: number, ring: number): string {
  const neck = r * 0.3; // how wide the tail still is as it meets the tip
  const d = [
    `M${cx} ${tipY}`,
    `C${cx - neck} ${cy + r * 0.95},${cx - r} ${cy + r * 0.62},${cx - r} ${cy}`,
    `A${r} ${r} 0 0 1 ${cx + r} ${cy}`,
    `C${cx + r} ${cy + r * 0.62},${cx + neck} ${cy + r * 0.95},${cx} ${tipY}`,
    'Z',
  ].join('');
  return `<path d="${d}" fill="url(#g)" stroke="${IVORY}" stroke-width="${ring}" stroke-linejoin="round"/>`;
}

/**
 * The car, as a SOLID silhouette on a 24-unit grid.
 *
 * 🔴 사장님 2026-08-07, 두 번째: "자동차 그림으로, 이쁘고 컴팩트한". The first cut
 * inlined lucide `Car` — the room's own icon family — but lucide is a STROKE
 * family: a 1.7px outline scaled into a 17px pin head is a thin sketch of a car,
 * and at map size a sketch loses to a shape. This is drawn as filled mass:
 * cabin, body and wheels read at a glance, and the two knockouts (windscreen,
 * wheel hubs) are what stop the mass from being a blob.
 *
 * `hollow` is the pin colour, not a second white — the glyph is a hole in the
 * pin, so it works on any body colour without a third value to keep in sync.
 */
function carGlyph(hollow: string): string {
  return [
    /*
     * One silhouette, not a cabin box stacked on a body box. Three shapes were
     * drawn and compared at 1x / 2x / 5x over light, road and dark tiles; the
     * stacked version reads as a pickup with a step in its roof, and a chunkier
     * "cute" version goes toy at size. This roofline — rake up from the bonnet,
     * shallow curve over the cabin, drop to the boot — is the one that still
     * says "car" when it is 15px wide on a phone.
     */
    '<path d="M3 12.2c0-.5.3-.9.7-1.1l3.2-1.3 2-2.4C9.4 6.8 10.1 6.5 10.9 6.5h3.6c.8 0 1.5.3 2 .9l2 2.4 3.2 1.3c.4.2.7.6.7 1.1v3.4c0 .6-.5 1.1-1.1 1.1H4.1c-.6 0-1.1-.5-1.1-1.1Z" fill="white"/>',
    // wheels, sitting proud of the body so the profile is unmistakable
    '<circle cx="7.6" cy="16.9" r="3" fill="white"/>',
    '<circle cx="16.4" cy="16.9" r="3" fill="white"/>',
    // knockouts — the glass and the hubs are what stop the mass being a blob
    `<path d="M9.5 10.4 10.9 8.6c.2-.2.4-.3.7-.3h2.8c.3 0 .5.1.7.3l1.4 1.8Z" fill="${hollow}"/>`,
    `<circle cx="7.6" cy="16.9" r="1.2" fill="${hollow}"/>`,
    `<circle cx="16.4" cy="16.9" r="1.2" fill="${hollow}"/>`,
  ].join('');
}

/**
 * The guide / driver — deep pine, the app's signature, and the only marker that
 * carries a glyph. It is the biggest thing on the map because it is the thing
 * the guest opened the map to find.
 */
export function vehiclePin(): MarkerArt {
  const W = 40;
  const H = 50;
  const cx = 20;
  const cy = 19;
  const r = 15;
  const glyph = 20 / 24;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${groundShadow(cx, H - 2.2, 7.5, 3)}
      ${bodyGradient(PINE)}
      ${pinBody(cx, cy, r, H - 3, 3)}
      <g transform="translate(${cx - 12 * glyph} ${cy - 11.7 * glyph}) scale(${glyph})">
        ${carGlyph(PINE_HOLLOW)}
      </g>
    </svg>`;
  return { url: dataUri(svg), width: W, height: H, anchorX: cx, anchorY: H - 3, labelX: cx, labelY: cy };
}

/**
 * Me — a bearing-less blue dot with an ivory collar and a soft halo, the shape
 * every phone map has trained people to read as "you are here". Anchored at
 * its centre, not a tip: it marks a point, it does not point at one.
 *
 * Blue stays blue while everything around it went pine. This one marker is not
 * ours to brand — a guest looking for themselves scans for the colour their
 * phone's own map uses, and losing that costs more than the consistency buys.
 */
export function myLocationDot(): MarkerArt {
  const S = 34;
  const c = S / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <circle cx="${c}" cy="${c}" r="15" fill="${ME}" opacity="0.14"/>
      <circle cx="${c}" cy="${c}" r="9.5" fill="${IVORY}"/>
      <circle cx="${c}" cy="${c}" r="6.5" fill="${ME}"/>
    </svg>`;
  return { url: dataUri(svg), width: S, height: S, anchorX: c, anchorY: c, labelX: c, labelY: c };
}

/** Another traveller in the group — the same dot, muted, so "me" stays findable. */
export function companionDot(): MarkerArt {
  const S = 28;
  const c = S / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <circle cx="${c}" cy="${c}" r="9" fill="${COMPANION}" stroke="${IVORY}" stroke-width="2.5"/>
    </svg>`;
  return { url: dataUri(svg), width: S, height: S, anchorX: c, anchorY: c, labelX: c, labelY: c };
}

/**
 * An itinerary stop. The number stays a Google `label` rather than SVG `<text>`
 * — text inside an SVG *image* picks up no webfont and centres differently per
 * engine, whereas a label is real DOM the SDK positions for us. `labelX/Y` is
 * what the caller feeds to `labelOrigin`.
 */
function labelledPin(gradient: readonly [string, string]): MarkerArt {
  const W = 30;
  const H = 38;
  const cx = 15;
  const cy = 14;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${groundShadow(cx, H - 2, 5.8, 2.4)}
      ${bodyGradient(gradient)}
      ${pinBody(cx, cy, 12, H - 3, 2.5)}
    </svg>`;
  return { url: dataUri(svg), width: W, height: H, anchorX: cx, anchorY: H - 3, labelX: cx, labelY: cy };
}

/**
 * An itinerary stop — near-black, so the numbers stay crisp and the stops stay
 * BEHIND the vehicle in the visual order. An ivory-bodied version was drawn and
 * rejected: it vanishes on the white road fill, which is where stops sit.
 */
export function stopPin(): MarkerArt {
  return labelledPin(INK);
}

/**
 * The pickup point — brass. There is exactly one of these on a tour, and it is
 * the only place a guest has to BE at a time, so it gets the one warm colour on
 * the map rather than a second green nobody can tell from the vehicle.
 */
export function pickupPin(): MarkerArt {
  return labelledPin(BRASS);
}

/** Toilets / shops / photo spots — present, never competing with the group. */
export function facilityDot(): MarkerArt {
  const S = 14;
  const c = S / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <circle cx="${c}" cy="${c}" r="5" fill="${FACILITY}" stroke="${IVORY}" stroke-width="1.5"/>
    </svg>`;
  return { url: dataUri(svg), width: S, height: S, anchorX: c, anchorY: c, labelX: c, labelY: c };
}

/**
 * Basemap styling — the tiles the pins sit on.
 *
 * Stock Google is loud: every convenience store, every transit icon, saturated
 * motorway orange. Kakao and Naver both hold the base back so the route and the
 * people on it are the only things with colour. This mutes the road hierarchy,
 * calms water and parks, and keeps place LABELS (which a lost guest reads) while
 * dropping the icon clutter beside them.
 */
export function basemapStyle(theme: 'light' | 'dark'): google.maps.MapTypeStyle[] {
  const hidden = [{ visibility: 'off' }];
  if (theme === 'dark') {
    return [
      { elementType: 'geometry', stylers: [{ color: '#1b1f24' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#9aa3ad' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#15181c' }] },
      { featureType: 'poi', elementType: 'labels.icon', stylers: hidden },
      { featureType: 'poi.business', stylers: hidden },
      { featureType: 'transit', elementType: 'labels.icon', stylers: hidden },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1f2a24' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#141b22' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#262b31' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: hidden },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#33393f' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2c3238' }] },
    ];
  }
  return [
    { elementType: 'geometry', stylers: [{ color: '#f6f5f2' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    { featureType: 'poi', elementType: 'labels.icon', stylers: hidden },
    { featureType: 'poi.business', stylers: hidden },
    { featureType: 'transit', elementType: 'labels.icon', stylers: hidden },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3ece1' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d9e6ee' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#ececea' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fdf3e0' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#f2e4c8' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#e4e2dd' }] },
  ];
}
