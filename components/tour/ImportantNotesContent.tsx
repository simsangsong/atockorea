'use client';

/**
 * Important Notes content used across all tour detail pages.
 * Single source of truth for pickup, no-show, and payment policy.
 */
export default function ImportantNotesContent() {
  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 24,
        color: 'var(--cro-text-light)',
        fontSize: 14,
        lineHeight: 1.9,
        listStyleType: 'decimal',
      }}
    >
      <li style={{ marginBottom: 14 }}>
        Your guide will contact you <strong>the day before the tour</strong> to confirm your <strong>pickup location and time</strong>.
      </li>
      <li style={{ marginBottom: 14 }}>
        Please arrive at the pickup point at least <strong>10 minutes early</strong> and wait for the guide.
      </li>
      <li style={{ marginBottom: 14 }}>
        If you are more than 10 minutes late, you will be considered a <strong>no-show</strong> and <strong>no refund</strong> will be provided.
      </li>
      <li style={{ marginBottom: 0 }}>
        Tour fees are paid in full online at booking. On the day, bring cash only for personal expenses (meals, optional entries) if needed.
      </li>
    </ul>
  );
}
