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
        Guests who have paid a deposit must pay the <strong>remaining balance in cash</strong> directly to the guide on the day of the tour.
        <br />
        Please bring sufficient cash; <strong>card payments are not accepted</strong>.
      </li>
    </ul>
  );
}
