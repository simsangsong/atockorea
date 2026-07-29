/**
 * 🔴 Standing gate — room media stays private, and every read exit signs.
 *
 * Two separate regressions this locks down, and they fail in opposite ways:
 *
 *   1. A WRITE path reintroduces a public URL. Loud at first (the object is
 *      readable) and permanent afterwards — a public object URL to a guest
 *      photo or an expense receipt outlives the room, the invite, and the
 *      message row. This is the one that becomes unfixable once real traffic
 *      has stored URLs, which is why it was worth doing at 0 stored rows.
 *
 *   2. A READ exit forgets to hydrate. Completely silent. The drawer returns
 *      `[]`, the realtime bubble renders a broken image, the snapshot's cold
 *      open shows nothing — and every one of those is indistinguishable from
 *      "this room has no photos". No test in this repo would have caught it,
 *      which is precisely why the fix is a source-level assertion and not a
 *      behavioural one.
 *
 * Source-level on purpose: a behavioural test only covers the exits somebody
 * remembered to write a test for, and the failure mode here is forgetting.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  const full = path.join(ROOT, rel);
  const source = fs.readFileSync(full, 'utf8');
  // A path typo would otherwise make every assertion below vacuously pass.
  expect(source.length).toBeGreaterThan(0);
  return source;
}

/** Comments describe the rule; only code can break it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Every module that writes to, or reads from, the two private room buckets.
 * Adding a bucket consumer without adding it here is itself the bug — so the
 * list is asserted to be non-empty and each entry is read from disk.
 */
const ROOM_MEDIA_MODULES = [
  'lib/tour-room/roomMedia.ts',
  'lib/tour-room/attachments.ts',
  'lib/tour-room/dispatch.ts',
  'lib/tour-room/tts-server.ts',
  'lib/tour-room/extraCapsule.ts',
  'app/api/tour-rooms/[bookingId]/messages/route.ts',
  'app/api/tour-rooms/[bookingId]/media/route.ts',
  'app/api/tour-rooms/[bookingId]/vision-ask/route.ts',
  'app/api/tour-rooms/[bookingId]/tts/route.ts',
  'app/api/tour-rooms/[bookingId]/extras/route.ts',
  'app/api/admin/tour-content/generate/route.ts',
];

/**
 * The five message read exits.
 *
 * These are the ones that hand a stored message row to a client. Miss one and
 * the media on it silently stops rendering for that surface only — which is
 * why they are enumerated by hand rather than discovered: the point is that the
 * count is five, and a sixth surface has to come here to be added.
 */
const MESSAGE_READ_EXITS: Array<{ file: string; why: string; signs: RegExp }> = [
  {
    file: 'app/api/tour-rooms/[bookingId]/messages/route.ts',
    why: 'GET /messages (the feed) and the POST response + broadcastToRoom payload',
    signs: /hydrate(One)?MessageMedia\s*\(/,
  },
  {
    // The drawer returns its own item shape, not message rows, so it signs
    // directly instead of going through the message hydrator. Same rule, one
    // level down: nothing leaves without a signature.
    file: 'app/api/tour-rooms/[bookingId]/media/route.ts',
    why: 'GET /media — the room drawer, which returns [] silently if unhydrated',
    signs: /signRoomMediaBatch\s*\(/,
  },
  {
    file: 'lib/tour-room/snapshot.ts',
    why: 'buildRoomSnapshot — the app cold open',
    signs: /hydrateMessageMedia\s*\(/,
  },
  {
    file: 'lib/tour-room/extraCapsule.ts',
    why: 'the ledger capsule broadcast, which carries the receipt photo',
    signs: /hydrateOneMessageMedia\s*\(/,
  },
  {
    file: 'app/api/tour-rooms/[bookingId]/vision-ask/route.ts',
    why: 'the vision answer broadcast + response',
    signs: /hydrateOneMessageMedia\s*\(/,
  },
  {
    file: 'app/api/tour-rooms/[bookingId]/extras/route.ts',
    why: 'GET /extras — receipt photos on the ledger rows (guest financial data)',
    signs: /signRoomMediaBatch\s*\(/,
  },
];

describe('the scanner actually reads the repo', () => {
  it('every listed module exists and is non-trivial', () => {
    expect(ROOM_MEDIA_MODULES.length).toBeGreaterThan(5);
    for (const rel of ROOM_MEDIA_MODULES) {
      expect(read(rel).length).toBeGreaterThan(200);
    }
  });

  it('strips comments but not code', () => {
    expect(stripComments('// getPublicUrl\nconst a = 1;')).not.toContain('getPublicUrl');
    expect(stripComments('/* getPublicUrl */ const a = 1;')).not.toContain('getPublicUrl');
    expect(stripComments("const u = x.getPublicUrl('a');")).toContain('getPublicUrl');
    // A protocol `//` inside a string must not eat the rest of the line.
    expect(stripComments("const u = 'https://a.test'; const b = 2;")).toContain('const b = 2');
  });
});

describe('🔴 no room-media module mints a public URL', () => {
  it.each(ROOM_MEDIA_MODULES)('%s', (rel) => {
    const code = stripComments(read(rel));
    expect(code).not.toMatch(/\bgetPublicUrl\s*\(/);
  });
});

describe('🔴 no room-media module creates its bucket public', () => {
  it.each(ROOM_MEDIA_MODULES)('%s', (rel) => {
    const code = stripComments(read(rel));
    const createBucketCalls = code.match(/createBucket\s*\([^)]*\)/g) ?? [];
    for (const call of createBucketCalls) {
      // `createBucket(name, options)` declarations in an interface have no
      // literal — only literal `public: true` is a defect.
      expect(call).not.toMatch(/public\s*:\s*true/);
    }
  });
});

describe('🔴 every message read exit hydrates', () => {
  it.each(MESSAGE_READ_EXITS)('$file — $why', ({ file, signs }) => {
    const code = stripComments(read(file));
    expect(code).toMatch(signs);
  });

  it('the messages route hydrates the broadcast payload, not just the response', () => {
    const code = stripComments(read('app/api/tour-rooms/[bookingId]/messages/route.ts'));
    // The broadcast is the exit that fails invisibly: clients already in the
    // room render straight off it and never refetch that row.
    expect(code).toMatch(/broadcastToRoom\([^)]*\{\s*message:\s*wireMessage\s*\}/);
    expect(code).toMatch(/message:\s*wireMessage\s*\}/);
    expect(code).not.toMatch(/broadcastToRoom\([^)]*\{\s*message\s*\}/);
  });

  it('the drawer never lets a storage path reach the client', () => {
    const code = stripComments(read('app/api/tour-rooms/[bookingId]/media/route.ts'));
    // Destructured out of the response object before it is serialized.
    expect(code).toMatch(/\{\s*storagePath,\s*\.\.\.item\s*\}/);
  });
});

describe('the attachment write path stores a path, never a URL', () => {
  it('AttachmentMeta has no url field', () => {
    const code = stripComments(read('lib/tour-room/attachments.ts'));
    const iface = code.match(/interface AttachmentMeta \{[\s\S]*?\}/)?.[0] ?? '';
    expect(iface).toContain('path: string');
    expect(iface).not.toMatch(/^\s*url\s*:/m);
  });
});
