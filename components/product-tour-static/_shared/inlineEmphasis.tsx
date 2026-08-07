import { Fragment } from "react";

/**
 * `**bold**` in authored tour copy, rendered as emphasis instead of asterisks.
 *
 * 🔴 Why this module exists.
 *
 * Roughly 180 strings across the catalogue are authored with markdown emphasis,
 * but the components rendered them as plain React children — so guests read the
 * markers: "This tour departs **on Mondays, Thursdays and Saturdays only**".
 * It was in the practical-details accordion (pickup, inclusions, weather policy,
 * seasonal, departure days) AND in the FAQ answers, which is why this is shared
 * rather than living next to whichever component was fixed first.
 *
 * Bold only, on purpose. `parseChatInline` in ./chatMarkdown.tsx also turns bare
 * URLs and `[text](url)` into links — correct for the assistant widget, a
 * surprise in a booking accordion. This stays the narrow fix for the marker that
 * actually leaked, and like that parser it interprets a whitelist and leaves
 * everything else literal, so there is no injection surface.
 *
 * Unbalanced or empty markers (`a ** b`, `** **`) are left exactly as authored
 * rather than silently eaten — copy that looks odd should look odd, not vanish.
 *
 * A run may not cross a line break. That is not a style preference: across the
 * corpus a `**` that is still open at end of line is an authoring slip, and
 * letting it close on a later line bolds a whole paragraph on one typo. The
 * cost of the restriction was measured, not assumed — over all 238 bundle
 * files (311,658 strings, 41,453 bold runs) the newline-bounded pattern and
 * the permissive one match identically, so nothing authored today relies on it.
 */
const MD_BOLD_RE = /\*\*(?=\S)([^\n]*?\S)\*\*/g;

/** Split a line into plain and bold runs. Pure; safe to unit-test. */
export function splitBoldRuns(text: string): Array<{ bold: boolean; text: string }> {
  const parts: Array<{ bold: boolean; text: string }> = [];
  let last = 0;
  MD_BOLD_RE.lastIndex = 0;
  for (let m = MD_BOLD_RE.exec(text); m; m = MD_BOLD_RE.exec(text)) {
    if (m.index > last) parts.push({ bold: false, text: text.slice(last, m.index) });
    parts.push({ bold: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ bold: false, text: text.slice(last) });
  return parts.length ? parts : [{ bold: false, text }];
}

/**
 * Plain-text form: emphasis markers removed, nothing else changed.
 * For JSON-LD and any other machine-read surface, where `**` is noise Google
 * would ingest verbatim into a rich result.
 */
export function stripEmphasisMarkers(text: string): string {
  return splitBoldRuns(text)
    .map((r) => r.text)
    .join("");
}

/**
 * Render `**bold**` runs, optionally passing each run through an existing
 * inline renderer (the accordion has one that highlights times and prices, and
 * bold must not swallow it).
 */
export function renderEmphasis(
  text: string,
  renderRun: (run: string) => React.ReactNode = (run) => run,
  boldClassName = "font-semibold text-slate-900",
): React.ReactNode[] {
  const runs = splitBoldRuns(text);
  if (!runs.some((r) => r.bold)) return [<Fragment key="0">{renderRun(text)}</Fragment>];
  return runs.map((r, i) =>
    r.bold ? (
      <strong key={`b${i}`} className={boldClassName}>
        {renderRun(r.text)}
      </strong>
    ) : (
      <Fragment key={`t${i}`}>{renderRun(r.text)}</Fragment>
    ),
  );
}
