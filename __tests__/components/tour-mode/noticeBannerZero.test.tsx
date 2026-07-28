/**
 * 🔴 The countdown capsule must never hold a sentence.
 *
 * Reported from a real phone on 2026-07-29: the meeting banner rendered its
 * text crammed into a narrow left strip, every line wrapping three or four
 * times, with one wide button alone on the right. The "button" was the
 * countdown capsule — a `shrink-0` element sized for "12:30" — and at T=0 it
 * was being handed `copy.now`, which is a full instruction in all ten locales
 * ("Please gather now", and 36 characters of it in French). A shrink-0 element
 * takes the width its content asks for, so the flex-1 column beside it got
 * whatever was left.
 *
 * The instruction was redundant anyway: the same sentence is on the rally line
 * directly beneath it. So the capsule is a marker again, and this test is what
 * keeps it one — the failure mode is a future translator writing a helpful
 * sentence into a field whose whole job is to be short.
 */
import { NOTICE_COPY_FOR_TEST } from '@/components/tour-mode/NoticeBanner';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

/**
 * Six is not arbitrary: at the room's largest text scale a 390px banner leaves
 * roughly this much room beside the icon and the text column before the column
 * starts wrapping mid-phrase. Russian ("СЕЙЧАС") is the longest that fits.
 */
const MAX_MARKER_CHARS = 6;

describe('notice banner — the zero marker stays a marker', () => {
  it('every locale has one', () => {
    for (const locale of ROOM_LOCALES) {
      expect(typeof NOTICE_COPY_FOR_TEST[locale]?.nowShort).toBe('string');
      expect(NOTICE_COPY_FOR_TEST[locale].nowShort.length).toBeGreaterThan(0);
    }
  });

  it('🔴 and none of them is a sentence', () => {
    const tooLong = ROOM_LOCALES.filter(
      (locale) => NOTICE_COPY_FOR_TEST[locale].nowShort.length > MAX_MARKER_CHARS,
    ).map((locale) => `${locale}: "${NOTICE_COPY_FOR_TEST[locale].nowShort}"`);
    expect(tooLong).toEqual([]);
  });

  it('no marker contains a space — a phrase is how this broke the first time', () => {
    for (const locale of ROOM_LOCALES) {
      expect(`${locale}:${NOTICE_COPY_FOR_TEST[locale].nowShort}`).not.toMatch(/\s/);
    }
  });

  it('🔴 the long instruction still exists — it moved, it was not deleted', () => {
    // The guest must still be TOLD to gather; that sentence belongs on the
    // rally line, which can wrap, not in a fixed-width pill.
    //
    // Measured by "is it a different, fuller string" rather than by character
    // count: Chinese says the whole thing in five characters (请现在集合), so a
    // length threshold would call a perfectly good instruction a marker.
    for (const locale of ROOM_LOCALES) {
      const copy = NOTICE_COPY_FOR_TEST[locale];
      expect(copy.now).not.toBe(copy.nowShort);
      expect(copy.now.length).toBeGreaterThan(copy.nowShort.length);
      expect(copy.waiting.length).toBeGreaterThan(copy.now.length);
    }
  });
});
