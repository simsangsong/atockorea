'use client';

/**
 * T1.10 → U1.3 — emergency contacts, now the CONTENT of the header
 * emergency sheet (plan §E/§H) instead of a permanently pinned card.
 * Content is still static constants shipped in the bundle (works offline;
 * numbers are one-tap tel: links). 5-locale copy, zero LLM (§M-2 ①).
 */

import { type ReactNode } from 'react';
import { EMERGENCY_CONTACTS, EMERGENCY_TITLE } from '@/lib/tour-room/emergency';
import { IconEmergency, IconPhone } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function EmergencyCard({
  locale,
  sos,
  showTitle = true,
}: {
  locale: RoomLocale;
  /** T7.3 — the SOS control renders above the contact list. */
  sos?: ReactNode;
  /** False when a parent surface (the sheet header) already shows the title. */
  showTitle?: boolean;
}) {
  return (
    <div data-testid="emergency-card">
      {showTitle && (
        <h3 className="tr-title flex items-center gap-2 text-[var(--tr-danger)]">
          <IconEmergency size={18} aria-hidden />
          {EMERGENCY_TITLE[locale]}
        </h3>
      )}

      {sos && <div className={showTitle ? 'mt-3' : ''}>{sos}</div>}

      <ul className={`divide-y divide-[var(--tr-hairline)] ${sos || showTitle ? 'mt-2' : ''}`}>
        {EMERGENCY_CONTACTS.map((contact) => (
          <li key={contact.key} className="py-1">
            {contact.tel ? (
              <a
                href={`tel:${contact.tel}`}
                className="flex min-h-[44px] items-center gap-3 rounded-xl px-1 py-2 active:bg-[var(--tr-bubble-system)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]">
                  <IconPhone size={16} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="tr-card-text block font-medium text-[var(--tr-ink)]">{contact.label[locale]}</span>
                  {contact.note && <span className="tr-meta block text-[var(--tr-ink-2)]">{contact.note[locale]}</span>}
                </span>
              </a>
            ) : (
              <div className="flex min-h-[44px] items-center gap-3 px-1 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tr-bubble-system)] text-[var(--tr-ink-3)]">
                  <IconPhone size={16} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="tr-card-text block font-medium text-[var(--tr-ink)]">{contact.label[locale]}</span>
                  {contact.note && <span className="tr-meta block text-[var(--tr-ink-2)]">{contact.note[locale]}</span>}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
