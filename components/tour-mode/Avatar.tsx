/**
 * U0.5 — room avatar (plan §F-2).
 *
 * Roles get fixed identities: guide = amber flag, admin = ink shield
 * (AtoC ops). Travellers get an initial on a deterministic pastel (falls
 * back to a person glyph when no name is known — message rows carry only
 * sender_role, so feed avatars for other travellers are the neutral glyph).
 */

import { IconDriver, IconGuide, IconOpsBadge, IconTraveller, TR_STROKE } from '@/components/tour-mode/icons';
import { avatarColorFor, avatarInitial } from '@/lib/tour-room/avatarColor';

export default function Avatar({
  role,
  name,
  size = 36,
}: {
  role: string;
  name?: string | null;
  size?: number;
}) {
  const iconSize = Math.round(size * 0.5);
  const common: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
  };

  if (role === 'guide') {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-[var(--tr-ink)] text-[var(--tr-bubble-me)]"
        style={common}
        data-testid="avatar-guide"
        aria-hidden
      >
        <IconGuide size={iconSize} strokeWidth={TR_STROKE.small} />
      </span>
    );
  }

  if (role === 'driver') {
    // A1.1 P1 — a distinct glyph (van, not the guide's flag) so the guest can
    // tell at a glance who is speaking; the driver only speaks Korean over the
    // W3 bridge, so "guide vs driver" decides what the guest may ask. The
    // background stays the muted ink so the guide keeps visual primacy.
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-[var(--tr-ink-2,var(--tr-ink))] text-[var(--tr-surface)]"
        style={common}
        data-testid="avatar-driver"
        aria-hidden
      >
        <IconDriver size={iconSize} strokeWidth={TR_STROKE.small} />
      </span>
    );
  }

  if (role === 'admin') {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-[var(--tr-ink)] text-[var(--tr-surface)]"
        style={common}
        data-testid="avatar-admin"
        aria-hidden
      >
        <IconOpsBadge size={iconSize} strokeWidth={TR_STROKE.small} />
      </span>
    );
  }

  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-[var(--tr-bubble-system)] text-[var(--tr-ink-3)]"
        style={common}
        data-testid="avatar-anon"
        aria-hidden
      >
        <IconTraveller size={iconSize} strokeWidth={TR_STROKE.small} />
      </span>
    );
  }

  const color = avatarColorFor(trimmed);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold"
      style={{ ...common, backgroundColor: color.bg, color: color.ink }}
      data-testid="avatar-initial"
      aria-hidden
    >
      {avatarInitial(trimmed)}
    </span>
  );
}
