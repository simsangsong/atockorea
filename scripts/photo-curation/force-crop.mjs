/**
 * Per-frame crop overrides for burned-in chrome that `overlay-crop.mjs` cannot be trusted
 * to find on its own: Google Lens / translate buttons, a Klook watermark, a camera date
 * stamp. Confirmed by eye on bottom-left corner sheets of the *generated* WebPs, which is
 * the only place these actually show up at product size.
 *
 * Keys are `<assetSlug>/<role>`, role `H` for the hero and `g1..gN` for gallery slots.
 *
 *   left   — force a left crop of this fraction, instead of the detector's guess
 *   bottom — additionally trim this fraction off the bottom, applied after the left crop
 *   ratio  — crop to this aspect (e.g. 16/9) instead. `focusY` (0..1, default 0.5) picks
 *            the band to keep. Phone photos of a moving subject come in portrait; a card
 *            crops them to 16:9 anyway, and letting the pipeline choose the band beats
 *            letting `object-fit: cover` guess — it centred on empty track and cut the
 *            Sky Capsules out of frame entirely.
 *
 * A crop on a frame that turns out to be clean costs nothing — it is a slightly tighter
 * composition. Shipping UI chrome on an OTA card does not have that property, so this
 * list errs toward cropping.
 */

const LEFT = { left: 0.16 };

/** @type {Map<string, {left?: number, bottom?: number}>} */
export const FORCE_CROP = new Map([
  ["haeundae-beach/H", LEFT],
  ["haeundae-beach/g1", LEFT],
  ["korean-folk-village/g1", LEFT],
  ["osulloc-tea/g4", LEFT],
  ["osulloc-tea/g5", LEFT],
  ["aewol-cafe-street/g3", LEFT],
  ["nami-island/g1", LEFT],
  ["nami-island/g3", LEFT],
  ["songdo-beach/g1", LEFT],
  ["camellia-hill/g1", LEFT],
  ["hyeopjae-beach/g3", LEFT],
  ["hyeopjae-beach/g4", LEFT],
  ["petite-france/g2", LEFT],
  ["gwangmyeong-cave/g4", LEFT],
  ["pocheon-art-valley/g2", LEFT],
  ["pocheon-art-valley/g3", LEFT],
  ["imjingak/g2", LEFT],
  ["gyeongju-national-museum/g2", LEFT],
  ["cheomseongdae/g1", LEFT],
  ["woljeonggyo/H", LEFT],
  ["woljeonggyo/g1", LEFT],
  ["gamaksan-suspension-bridge/H", LEFT],
  ["gamaksan-suspension-bridge/g1", LEFT],
  ["herb-island/g3", LEFT],
  ["gwangjang-market/g1", LEFT],
  ["aewol-handam/H", LEFT],
  ["aewol-handam/g1", LEFT],
  ["hallasan-1100/g1", LEFT],
  ["sanjeong-lake/H", LEFT],
  ["jeju-stone-park/g1", LEFT],
  ["yeomiji-garden/H", LEFT],
  ["sangumburi/H", LEFT],

  // A Klook watermark sits along the very bottom edge, past the Lens button the detector
  // already trims from the left.
  ["hallim-park/H", { bottom: 0.09 }],
  ["hallim-park/g1", LEFT],

  // Camera date stamp burned into the bottom-left.
  ["yongmeori-coast/H", { bottom: 0.11 }],

  // 사장님 제공 실촬본 (2026-08-07) — 세로 폰 사진이라 16:9 로 재단한다.
  ["cheongsapo-blue-line/H", { ratio: 16 / 9, focusY: 0.45 }],
  ["cheongsapo-blue-line/g1", { ratio: 16 / 9, focusY: 0.45 }],
  ["cheongsapo-blue-line/g2", { ratio: 16 / 9, focusY: 0.45 }],
]);
