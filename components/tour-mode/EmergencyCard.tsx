'use client';

/**
 * T1.10 — collapsible emergency-info card pinned in the room header. Content
 * is static constants shipped in the bundle (works offline; the numbers are
 * one-tap tel: links). 5-locale copy, zero LLM (§M-2 ①).
 */

import { useState } from 'react';
import { EMERGENCY_CONTACTS, EMERGENCY_TITLE } from '@/lib/tour-room/emergency';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function EmergencyCard({ locale }: { locale: RoomLocale }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-[13px] font-semibold text-red-600">🆘 {EMERGENCY_TITLE[locale]}</span>
        <span className="text-[12px] text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="space-y-2 px-4 pb-3">
          {EMERGENCY_CONTACTS.map((contact) => (
            <li key={contact.key} className="text-[13px] leading-snug">
              {contact.tel ? (
                <a href={`tel:${contact.tel}`} className="font-medium text-gray-900 underline decoration-gray-300 dark:text-gray-100 dark:decoration-gray-600">
                  {contact.label[locale]}
                </a>
              ) : (
                <span className="font-medium text-gray-900 dark:text-gray-100">{contact.label[locale]}</span>
              )}
              {contact.note && <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{contact.note[locale]}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
