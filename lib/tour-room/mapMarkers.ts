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

/** Mirrors of the room tokens these markers are meant to sit beside. */
const INK = '#12151a'; // --tr-ink (the FindGuideCard surface)
const ACCENT = '#f59e0b'; // --tr-accent
const SAFE = '#10b981'; // --tr-safe
const ME = '#2563eb';
const FACILITY = '#9ca3af';
const WHITE = '#ffffff';

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
 * The drop shadow every pin stands on. A plain low-opacity ellipse rather than
 * a Gaussian filter: filters inside an SVG *image* are honoured unevenly across
 * the WebViews this app actually runs in, and a missing filter would leave the
 * pin looking pasted on.
 */
function groundShadow(cx: number, cy: number, rx = 4.5, ry = 1.6): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000000" opacity="0.18"/>`;
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
function pinBody(cx: number, cy: number, r: number, tipY: number, fill: string, ring: number): string {
  const neck = r * 0.3; // how wide the tail still is as it meets the tip
  const d = [
    `M${cx} ${tipY}`,
    `C${cx - neck} ${cy + r * 0.95},${cx - r} ${cy + r * 0.62},${cx - r} ${cy}`,
    `A${r} ${r} 0 0 1 ${cx + r} ${cy}`,
    `C${cx + r} ${cy + r * 0.62},${cx + neck} ${cy + r * 0.95},${cx} ${tipY}`,
    'Z',
  ].join('');
  return `<path d="${d}" fill="${fill}" stroke="${WHITE}" stroke-width="${ring}" stroke-linejoin="round"/>`;
}

/**
 * The guide / driver — 사장님 2026-08-07: "가이드 아이콘은 자동차 아이콘으로".
 *
 * The glyph is lucide `Car` (the same family as every other icon in the room,
 * exported as `IconVehicle`), inlined at its native 24-unit grid and scaled
 * into the pin head. Stroke width is pre-multiplied so it reads the same
 * weight as the icons in the cards below the map.
 */
export function vehiclePin(): MarkerArt {
  const W = 40;
  const H = 50;
  const cx = 20;
  const cy = 19;
  const r = 15;
  const glyph = 17 / 24;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${groundShadow(cx, H - 2)}
      ${pinBody(cx, cy, r, H - 3, INK, 3)}
      <g transform="translate(${cx - 8.5} ${cy - 8.5}) scale(${glyph})"
         fill="none" stroke="${WHITE}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2"/>
        <path d="M9 17h6"/>
        <circle cx="17" cy="17" r="2"/>
      </g>
    </svg>`;
  return { url: dataUri(svg), width: W, height: H, anchorX: cx, anchorY: H - 3, labelX: cx, labelY: cy };
}

/**
 * Me — a bearing-less blue dot with a white collar and a soft halo, the shape
 * every phone map has trained people to read as "you are here". Anchored at
 * its centre, not a tip: it marks a point, it does not point at one.
 */
export function myLocationDot(): MarkerArt {
  const S = 34;
  const c = S / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <circle cx="${c}" cy="${c}" r="15" fill="${ME}" opacity="0.14"/>
      <circle cx="${c}" cy="${c}" r="9.5" fill="${WHITE}"/>
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
      <circle cx="${c}" cy="${c}" r="9" fill="#6b7280" stroke="${WHITE}" stroke-width="2.5"/>
    </svg>`;
  return { url: dataUri(svg), width: S, height: S, anchorX: c, anchorY: c, labelX: c, labelY: c };
}

/**
 * An itinerary stop. The number stays a Google `label` rather than SVG `<text>`
 * — text inside an SVG *image* picks up no webfont and centres differently per
 * engine, whereas a label is real DOM the SDK positions for us. `labelX/Y` is
 * what the caller feeds to `labelOrigin`.
 */
export function stopPin(): MarkerArt {
  const W = 30;
  const H = 38;
  const cx = 15;
  const cy = 14;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${groundShadow(cx, H - 2, 4.5, 1.8)}
      ${pinBody(cx, cy, 12, H - 3, ACCENT, 2.5)}
    </svg>`;
  return { url: dataUri(svg), width: W, height: H, anchorX: cx, anchorY: H - 3, labelX: cx, labelY: cy };
}

/** The pickup point — same shape as a stop, "safe" green, carries a P label. */
export function pickupPin(): MarkerArt {
  const W = 30;
  const H = 38;
  const cx = 15;
  const cy = 14;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${groundShadow(cx, H - 2, 4.5, 1.8)}
      ${pinBody(cx, cy, 12, H - 3, SAFE, 2.5)}
    </svg>`;
  return { url: dataUri(svg), width: W, height: H, anchorX: cx, anchorY: H - 3, labelX: cx, labelY: cy };
}

/** Toilets / shops / photo spots — present, never competing with the group. */
export function facilityDot(): MarkerArt {
  const S = 14;
  const c = S / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <circle cx="${c}" cy="${c}" r="5" fill="${FACILITY}" stroke="${WHITE}" stroke-width="1.5"/>
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
