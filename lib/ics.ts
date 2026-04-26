/**
 * Minimal RFC 5545 ICS generator for "Add to calendar" flows. Treats input
 * instants as UTC if `start`/`end` are ISO strings with zone markers, otherwise
 * falls back to floating time (no TZID) — acceptable for all-day tour bookings.
 */

export interface IcsEventInput {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  /** ISO 8601 start timestamp. If no time component is present, treated as DATE (all-day). */
  start: string;
  /** Optional ISO 8601 end timestamp. Defaults to start + 1 day for date-only inputs. */
  end?: string;
  url?: string;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatIcsDate(d: Date, dateOnly: boolean) {
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  if (dateOnly) return `${y}${m}${day}`;
  return `${y}${m}${day}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function buildIcsEvent({ uid, title, description, location, start, end, url }: IcsEventInput): string {
  const hasTime = /T\d{2}:\d{2}/.test(start);
  const startDate = new Date(start);
  const endDate = end
    ? new Date(end)
    : new Date(startDate.getTime() + (hasTime ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));

  const dtStamp = formatIcsDate(new Date(), false);
  const dtStart = hasTime
    ? `DTSTART:${formatIcsDate(startDate, false)}`
    : `DTSTART;VALUE=DATE:${formatIcsDate(startDate, true)}`;
  const dtEnd = hasTime
    ? `DTEND:${formatIcsDate(endDate, false)}`
    : `DTEND;VALUE=DATE:${formatIcsDate(endDate, true)}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AtoC Korea//MyPage//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcsText(title)}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : '',
    location ? `LOCATION:${escapeIcsText(location)}` : '',
    url ? `URL:${escapeIcsText(url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return `${lines.join('\r\n')}\r\n`;
}

export function downloadIcsFile(filename: string, icsContent: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
