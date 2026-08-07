/**
 * Turns contact-sheet frame numbers into a durable pick list keyed by absolute source
 * path, so the selection survives a rebuild of the sheets (numbers would shift).
 *
 *   node scripts/photo-curation/record-picks.mjs --index <dir>/index.json --picks picks.json \
 *     "gamcheon-culture-village=3|2,1" "busan-tower=3|1,2"
 *
 * Grammar per argument:  <assetSlug>=<heroN>|<galleryN,galleryN,...>[#note]
 * A leading `-` on a number marks it rejected (recorded, so a later pass does not
 * re-propose a frame that was already ruled out).
 */

import { existsSync, readFileSync, writeFileSync } from "fs";

const args = process.argv.slice(2);
const argOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const INDEX = argOf("--index", "contact-sheets/index.json");
const PICKS = argOf("--picks", "scripts/photo-curation/picks.json");

const index = JSON.parse(readFileSync(INDEX, "utf8"));
const picks = existsSync(PICKS) ? JSON.parse(readFileSync(PICKS, "utf8")) : {};

const specs = args.filter((a) => /^[a-z0-9-]+=/.test(a));
if (!specs.length) {
  console.error("no pick specs given");
  process.exit(2);
}

for (const spec of specs) {
  const [, slug, rest] = spec.match(/^([a-z0-9-]+)=(.*)$/s);
  const entry = index[slug];
  if (!entry) {
    console.error(`!! unknown target: ${slug}`);
    process.exitCode = 1;
    continue;
  }
  const [body, note] = rest.split("#");
  const [heroPart, galleryPart = ""] = body.split("|");
  const byN = new Map(entry.frames.map((f) => [f.n, f]));
  const resolve = (n) => {
    const f = byN.get(Number(n));
    if (!f) throw new Error(`${slug}: frame ${n} not on any sheet`);
    return { path: f.path, w: f.w, h: f.h, bucket: f.bucket };
  };

  const gallery = [];
  const rejected = [];
  for (const raw of galleryPart.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (raw.startsWith("-")) rejected.push(resolve(raw.slice(1)));
    else gallery.push(resolve(raw));
  }

  picks[slug] = {
    poiKeys: entry.poiKeys,
    folders: entry.folders,
    hero: heroPart.trim() ? resolve(heroPart.trim()) : null,
    gallery,
    rejected,
    ...(note ? { note: note.trim() } : {}),
  };
  console.log(
    `${slug}: hero=${picks[slug].hero ? picks[slug].hero.path.split("/").pop() : "—"} ` +
      `gallery=${gallery.length} rejected=${rejected.length}`
  );
}

writeFileSync(PICKS, JSON.stringify(picks, null, 1));
console.log(`\n${Object.keys(picks).length} targets recorded → ${PICKS}`);
