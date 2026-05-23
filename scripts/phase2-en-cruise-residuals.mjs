// Residual cleanup for Phase 2 EN: page_sections duplicates of the FAQ pickup answer
// that weren't reached by the JSON-object-replacement script (which only touched
// top-level staticQuestions). Pure text replace, JSON-validated.
import fs from "node:fs";

const fixes = [
  [
    "jeju-cruise-shore-excursion-bus-tour",
    "From your hotel lobby or a designated pickup point in the booking area. Exact pickup time is confirmed the evening before.",
    "At the cruise terminal arrival hall — Jeju Port (north) or Gangjeong Port (south) depending on where your ship docks. Your guide waits at the gangway-side arrival hall with an AtoC Korea sign and your name. Exact pickup time is confirmed the evening before, based on the ship posted arrival.",
  ],
  [
    "jeju-cruise-shore-excursion-small-group-tour",
    "From your hotel lobby or a designated pickup point in the booking area. Exact pickup time is confirmed the evening before.",
    "At the cruise terminal arrival hall — Jeju Port (north) or Gangjeong Port (south) depending on where your ship docks. Your guide waits at the gangway-side arrival hall with an AtoC Korea sign and your name. Exact pickup time is confirmed the evening before, based on the ship posted arrival.",
  ],
  [
    "incheon-seoul-private-car-shore-excursion-cruise",
    "Yeongjong-do or Songdo",
    "Yeongjong Island airport or the Songdo cruise terminal",
  ],
];

for (const [t, find, repl] of fixes) {
  const f = `components/product-tour-static/${t}/${t}.en.json`;
  let s = fs.readFileSync(f, "utf8");
  const n = s.split(find).length - 1;
  if (n === 0) {
    console.log("NO MATCH", t, find.slice(0, 50));
    continue;
  }
  s = s.split(find).join(repl);
  JSON.parse(s);
  fs.writeFileSync(f, s, "utf8");
  console.log("cleaned", t, "×", n);
}
