// The chips are tap targets whose TEXT is the routing contract: they must
// keep matching quoteFlow's deterministic regexes in every locale, or a tap
// silently falls out of the quote flow. These tests pin that coupling.

import {
  emailConfirmChips,
  quoteConfirmChips,
  recommendationChips,
  followUpChipsForIntent,
} from "@/lib/chatbot/followUpChips";
import { emailConfirmOutcome, isQuoteFlowFollowUp } from "@/lib/chatbot/quoteFlow";

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"] as const;

// A real confirm-stage reply (STAGE_MARKERS.confirm has "Estimated quote:").
const CONFIRM_PRIOR = "Estimated quote: ₩500,000 — 8h private tour in busan for 4. Want me to set up checkout?";

describe("quote confirm chips route through the quote flow (W4.3)", () => {
  it.each(LOCALES)("affirm chip in %s passes looksLikeAffirmation", (locale) => {
    const [yes] = quoteConfirmChips(locale);
    // detectedIntent "policy" disables the unknown-intent fallback, so this
    // only passes when the chip text is a recognized affirmation.
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: yes,
        priorAssistantReply: CONFIRM_PRIOR,
        detectedIntent: "policy",
      }),
    ).toBe(true);
  });

  it.each(LOCALES)("decline chip in %s exits the flow gracefully", (locale) => {
    const [, no] = quoteConfirmChips(locale);
    expect(
      isQuoteFlowFollowUp({
        latestUserMessage: no,
        priorAssistantReply: CONFIRM_PRIOR,
        detectedIntent: "policy",
      }),
    ).toBe(false);
  });
});

describe("email confirm chips route through emailConfirmOutcome (W2.10)", () => {
  it.each(LOCALES)("chips in %s map to confirmed / edit", (locale) => {
    const [yes, edit] = emailConfirmChips(locale);
    expect(emailConfirmOutcome(yes)).toBe("confirmed");
    expect(emailConfirmOutcome(edit)).toBe("edit");
  });
});

describe("followUpChipsForIntent", () => {
  it("returns recommendation chips only when cards exist", () => {
    expect(followUpChipsForIntent("tour_recommendation", "en", { hasCards: true })).toEqual(
      recommendationChips("en"),
    );
    expect(followUpChipsForIntent("tour_recommendation", "en", { hasCards: false })).toEqual([]);
  });

  it("stays silent on non-product intents", () => {
    for (const intent of ["policy", "legal", "booking_specific", "unknown", "company"]) {
      expect(followUpChipsForIntent(intent, "en", { hasCards: true })).toEqual([]);
    }
  });

  it("price questions get quote-nudge chips", () => {
    expect(followUpChipsForIntent("price_question", "ko", { hasCards: false }).length).toBeGreaterThan(0);
  });
});
