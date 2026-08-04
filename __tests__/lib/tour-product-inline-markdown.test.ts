import {
  hasInlineMarkup,
  splitInlineBold,
  stripInlineBold,
} from "@/lib/tour-product/inline-markdown";

describe("tour-product inline markdown", () => {
  describe("splitInlineBold", () => {
    it("splits the real line that shipped with its asterisks showing", () => {
      const line = "This tour departs **on Mondays, Thursdays and Saturdays only** — please book one of those dates.";
      expect(splitInlineBold(line)).toEqual([
        { text: "This tour departs ", bold: false },
        { text: "on Mondays, Thursdays and Saturdays only", bold: true },
        { text: " — please book one of those dates.", bold: false },
      ]);
    });

    it("handles a run at the very start and the very end", () => {
      expect(splitInlineBold("**Triple UNESCO**: World Heritage")).toEqual([
        { text: "Triple UNESCO", bold: true },
        { text: ": World Heritage", bold: false },
      ]);
      expect(splitInlineBold("only **14 m gain**")).toEqual([
        { text: "only ", bold: false },
        { text: "14 m gain", bold: true },
      ]);
    });

    it("handles several runs in one line", () => {
      const segs = splitInlineBold("**12°C year-round** — perfect for **summer escapes**");
      expect(segs.filter((s) => s.bold).map((s) => s.text)).toEqual(["12°C year-round", "summer escapes"]);
    });

    it("leaves prose asterisks alone rather than eating the sentence", () => {
      // A lone marker is not emphasis, and treating it as an opener would
      // swallow everything after it.
      expect(splitInlineBold("2 ** 3 = 8")).toEqual([{ text: "2 ** 3 = 8", bold: false }]);
      expect(splitInlineBold("see the note *")).toEqual([{ text: "see the note *", bold: false }]);
      expect(splitInlineBold("a **b")).toEqual([{ text: "a **b", bold: false }]);
    });

    it("does not let a run span a line break", () => {
      const segs = splitInlineBold("open **here\nand** there");
      expect(segs.every((s) => !s.bold)).toBe(true);
    });

    it("returns nothing for empty input", () => {
      expect(splitInlineBold("")).toEqual([]);
      expect(splitInlineBold(null)).toEqual([]);
      expect(splitInlineBold(undefined)).toEqual([]);
    });

    it("never loses or duplicates a character", () => {
      // Whatever the split, re-joining the segments with the markers removed
      // must equal the stripped original — the renderer shows all of the words.
      for (const line of [
        "This tour departs **on Mondays** — book one.",
        "**A** and **B** and plain",
        "no markup at all",
        "**2.1 km cape trail** (~30 min, only 14 m gain)",
      ]) {
        expect(splitInlineBold(line).map((s) => s.text).join("")).toBe(stripInlineBold(line));
      }
    });
  });

  describe("stripInlineBold", () => {
    it("drops the markers and keeps every word", () => {
      expect(stripInlineBold("Pickup **30 min after ship clearance** — buffer"))
        .toBe("Pickup 30 min after ship clearance — buffer");
    });

    it("leaves text with no markup untouched", () => {
      expect(stripInlineBold("A quiet bamboo corridor.")).toBe("A quiet bamboo corridor.");
    });

    it("is safe to run twice", () => {
      const once = stripInlineBold("**Founded 1423** by Sejong");
      expect(stripInlineBold(once)).toBe(once);
    });

    it("returns an empty string for empty input", () => {
      expect(stripInlineBold(null)).toBe("");
      expect(stripInlineBold(undefined)).toBe("");
    });
  });

  describe("hasInlineMarkup", () => {
    it("does not go stale between calls", () => {
      // The matcher is a global regex; a shared lastIndex would make every
      // other call answer false and hide half the corpus.
      const line = "**Triple UNESCO**: World Heritage";
      expect(hasInlineMarkup(line)).toBe(true);
      expect(hasInlineMarkup(line)).toBe(true);
      expect(hasInlineMarkup(line)).toBe(true);
    });

    it("is false for plain prose", () => {
      expect(hasInlineMarkup("A quiet bamboo corridor.")).toBe(false);
      expect(hasInlineMarkup("")).toBe(false);
    });
  });
});
