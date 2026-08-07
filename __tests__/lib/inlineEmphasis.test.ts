import {
  splitBoldRuns,
  stripEmphasisMarkers,
} from "@/components/product-tour-static/_shared/inlineEmphasis";

/**
 * Parser-level cover for the `**bold**` marker in authored tour copy.
 *
 * 🔴 These cases were written against a second, independent parser
 * (`lib/tour-product/inline-markdown.ts`) that a parallel session built the
 * same day for the same defect. Only one of the two reached main, so the other
 * one's tests are ported here rather than thrown away with it — they cover
 * failure modes the surviving module's own suite did not: prose asterisks that
 * must not eat a sentence, and the round-trip that proves splitting never drops
 * a character. `__tests__/components/practicalAccordionBold.test.tsx` covers the
 * rendered component; this file covers the pure functions underneath.
 */
describe("inline emphasis parser", () => {
  describe("splitBoldRuns", () => {
    it("splits the real line that shipped with its asterisks showing", () => {
      const line =
        "This tour departs **on Mondays, Thursdays and Saturdays only** — please book one of those dates.";
      expect(splitBoldRuns(line)).toEqual([
        { text: "This tour departs ", bold: false },
        { text: "on Mondays, Thursdays and Saturdays only", bold: true },
        { text: " — please book one of those dates.", bold: false },
      ]);
    });

    it("handles a run at the very start and the very end", () => {
      expect(splitBoldRuns("**Triple UNESCO**: World Heritage")).toEqual([
        { text: "Triple UNESCO", bold: true },
        { text: ": World Heritage", bold: false },
      ]);
      expect(splitBoldRuns("only **14 m gain**")).toEqual([
        { text: "only ", bold: false },
        { text: "14 m gain", bold: true },
      ]);
    });

    it("handles several runs in one line", () => {
      const runs = splitBoldRuns("**12°C year-round** — perfect for **summer escapes**");
      expect(runs.filter((r) => r.bold).map((r) => r.text)).toEqual([
        "12°C year-round",
        "summer escapes",
      ]);
    });

    it("leaves prose asterisks alone rather than eating the sentence", () => {
      // A lone marker is not emphasis, and treating it as an opener would
      // swallow everything after it.
      expect(splitBoldRuns("2 ** 3 = 8")).toEqual([{ text: "2 ** 3 = 8", bold: false }]);
      expect(splitBoldRuns("see the note *")).toEqual([{ text: "see the note *", bold: false }]);
      expect(splitBoldRuns("a **b")).toEqual([{ text: "a **b", bold: false }]);
    });

    it("does not let a run span a line break", () => {
      // An unclosed `**` at end of line is an authoring slip. If it were allowed
      // to close on a later line, one typo would bold a whole paragraph.
      const runs = splitBoldRuns("open **here\nand** there");
      expect(runs.every((r) => !r.bold)).toBe(true);
      expect(runs.map((r) => r.text).join("")).toBe("open **here\nand** there");
    });

    it("returns a single empty run for empty input, so renderers stay total", () => {
      expect(splitBoldRuns("")).toEqual([{ text: "", bold: false }]);
    });

    it("never loses or duplicates a character", () => {
      // Whatever the split, re-joining the runs must equal the stripped
      // original — the renderer shows all of the words.
      for (const line of [
        "This tour departs **on Mondays** — book one.",
        "**A** and **B** and plain",
        "no markup at all",
        "**2.1 km cape trail** (~30 min, only 14 m gain)",
        "2 ** 3 = 8",
        "open **here\nand** there",
      ]) {
        expect(splitBoldRuns(line).map((r) => r.text).join("")).toBe(stripEmphasisMarkers(line));
      }
    });
  });

  describe("stripEmphasisMarkers", () => {
    it("drops the markers and keeps every word", () => {
      expect(stripEmphasisMarkers("Pickup **30 min after ship clearance** — buffer")).toBe(
        "Pickup 30 min after ship clearance — buffer",
      );
    });

    it("leaves text with no markup untouched", () => {
      expect(stripEmphasisMarkers("A quiet bamboo corridor.")).toBe("A quiet bamboo corridor.");
    });

    it("is safe to run twice", () => {
      const once = stripEmphasisMarkers("**Founded 1423** by Sejong");
      expect(stripEmphasisMarkers(once)).toBe(once);
    });

    it("returns an empty string for empty input", () => {
      expect(stripEmphasisMarkers("")).toBe("");
    });

    it("does not go stale between calls", () => {
      // The matcher is a module-level global regex; a leaked lastIndex would
      // make every other call answer differently and hide half the corpus.
      const line = "**Triple UNESCO**: World Heritage";
      expect(stripEmphasisMarkers(line)).toBe("Triple UNESCO: World Heritage");
      expect(stripEmphasisMarkers(line)).toBe("Triple UNESCO: World Heritage");
      expect(stripEmphasisMarkers(line)).toBe("Triple UNESCO: World Heritage");
    });
  });
});
