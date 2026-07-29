/**
 * X17 — let the guest take the day with them.
 *
 * §H-3 gap 5: the Travel Timeline exists but the guest cannot carry it
 * anywhere. In the ideal app the record of today is a thing you send to a
 * friend, and that is what brings the next booking. This module builds the
 * message that gets sent.
 *
 * 🔴 Two constraints shape it, and both would be easy to get wrong.
 *
 * 1. **No photos, and no photo URLs.** Since the storage change the room's
 *    photos live in a private bucket behind SHORT-LIVED SIGNED URLs. Putting
 *    one in a shared message would paste a capability URL to a guest's private
 *    photo into a group chat — and it would 404 six hours later anyway, so it
 *    is both unsafe and useless. The share is text.
 *
 * 2. **The link obeys the OTA inducement policy, and does not restate it.**
 *    A share that links to our own product page is exactly the direct-channel
 *    inducement `reviewPolicy` exists to gate (Klook §5.11 and friends). Rather
 *    than write a second rule that will drift from the first, the destination is
 *    DERIVED from the policy already resolved for this booking:
 *
 *      direct booking      → our tour page
 *      OTA with a listing  → that OTA's listing (their platform, their booking)
 *      OTA without one     → no link at all, just the recap
 *
 *    So an OTA guest can still show a friend their day; they simply are not
 *    handed our checkout. The failure direction stays safe, the same way
 *    `resolveReviewPolicy` treats an unknown source as OTA.
 */

import type { RoomReviewPolicy } from '@/lib/tour-room/reviewPolicy';
import type { TravelTimelineData } from '@/lib/tour-room/timeline';

/** How many stops the message lists before summarising the rest. */
export const SHARE_MAX_STOPS = 6;

/**
 * Where a shared recap should point, or null for text-only.
 *
 * `reviewHref` is the policy's already-decided destination for this booking;
 * the `#reviews` fragment is stripped because a friend who has not travelled
 * yet should land on the tour, not on the review section.
 */
export function timelineShareHref(
  policy: RoomReviewPolicy,
  origin?: string | null,
): string | null {
  const href = policy.reviewHref;
  if (!href) return null;
  const withoutFragment = href.split('#')[0];
  if (!withoutFragment) return null;
  if (/^https?:\/\//i.test(withoutFragment)) return withoutFragment;
  // Relative (our own product page) — absolute, so it survives a paste.
  const base = (origin ?? '').replace(/\/$/, '');
  return base ? `${base}${withoutFragment}` : withoutFragment;
}

export interface ShareCopy {
  /** First line — "Here's where I went in Korea today". */
  shareIntro: string;
  /** Trailing line above the link, omitted when there is no link. */
  shareLinkLead: string;
  /** n photos — plural handled per locale. */
  sharePhotos: (n: number) => string;
  /** "+3 more" when the day had more stops than the message lists. */
  shareMoreStops: (n: number) => string;
}

export interface BuildShareTextInput {
  data: TravelTimelineData;
  copy: ShareCopy;
  /** The tour's own name, when the room knows it. */
  tourTitle?: string | null;
  href: string | null;
  /** Injected so the output is deterministic and testable. */
  formatTime: (iso: string) => string;
}

/**
 * The message body. Plain text on purpose — it is going into a chat app, where
 * markdown renders as literal asterisks.
 */
export function buildTimelineShareText({
  data,
  copy,
  tourTitle,
  href,
  formatTime,
}: BuildShareTextInput): string {
  const lines: string[] = [];
  lines.push(tourTitle ? `${copy.shareIntro} — ${tourTitle}` : copy.shareIntro);

  const shown = data.stops.slice(0, SHARE_MAX_STOPS);
  if (shown.length > 0) {
    lines.push('');
    for (const stop of shown) {
      const at = formatTime(stop.at);
      lines.push(at ? `${at}  ${stop.title}` : stop.title);
    }
    const rest = data.stops.length - shown.length;
    if (rest > 0) lines.push(copy.shareMoreStops(rest));
  }

  if (data.photoCount > 0) {
    lines.push('');
    lines.push(copy.sharePhotos(data.photoCount));
  }

  if (href) {
    lines.push('');
    lines.push(copy.shareLinkLead);
    lines.push(href);
  }

  return lines.join('\n');
}

export type ShareOutcome = 'shared' | 'copied' | 'unavailable';

interface ShareNavigator {
  share?: (data: { title?: string; text?: string }) => Promise<void>;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

/**
 * Hand the text to the OS share sheet, else the clipboard.
 *
 * `navigator.share` is what actually reaches KakaoTalk / WhatsApp / Messages on
 * a phone, which is where this is used. Desktop and older browsers fall back to
 * a clipboard copy, and the caller tells the guest which happened — an
 * unexplained "nothing visible occurred" is worse than no button.
 *
 * A share the guest CANCELS resolves as 'shared': an AbortError is the user
 * changing their mind, not a failure, and showing "copied" afterwards would be
 * a lie about where their words went.
 */
export async function shareTimelineText(
  nav: ShareNavigator | undefined,
  payload: { title: string; text: string },
): Promise<ShareOutcome> {
  if (nav?.share) {
    try {
      await nav.share({ title: payload.title, text: payload.text });
      return 'shared';
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return 'shared';
      // Fall through — some browsers reject share() for non-user-gesture or
      // unsupported payloads, and the clipboard still works there.
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(payload.text);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }
  return 'unavailable';
}
