/**
 * detailIntro2 field extraction: preserve raw + normalized summaries.
 * Field names vary by contentTypeId; never throw.
 */

import type { IntroRaw } from './types';
import { keyMapLoose, normalizeItemList, parseItemsEnvelope } from './parsers';
import type { ExtractedIntroFields } from './types';

const HOUR_KEY_RE =
  /(usetime|운영|이용시간|개장|폐장|open|close|playtime|opening|hours|chktime|infocenter|문의|실내|야간)/i;
const FEE_KEY_RE = /(fee|요금|입장|이용료|할인|price|ticket|유료|무료|단체)/i;
const REST_KEY_RE = /(rest|휴관|휴무|쉬는|closed|off\s*day)/i;
const PARK_KEY_RE = /(park|주차)/i;
const RESERVE_KEY_RE = /(reserv|예약|advance|booking)/i;
const STATUS_KEY_RE = /(status|운영|휴업|영업|closed|open|business)/i;

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function collectByKeyRegex(
  intro: Record<string, unknown>,
  re: RegExp,
): { joined: string | null; fields: string[] } {
  const fields: string[] = [];
  const parts: string[] = [];
  for (const [k, v] of Object.entries(intro)) {
    if (re.test(k)) {
      const s = str(v);
      if (s) {
        fields.push(k);
        parts.push(s);
      }
    }
  }
  if (!parts.length) return { joined: null, fields: [] };
  return { joined: parts.join(' | '), fields };
}

function firstNonEmptyByKeys(intro: Record<string, unknown>, keys: string[]): { val: string | null; key: string | null } {
  const lower = keyMapLoose(intro);
  for (const k of keys) {
    const v = str(lower[k.toLowerCase()] ?? intro[k]);
    if (v) return { val: v, key: k };
  }
  return { val: null, key: null };
}

/** Known KTO intro keys (non-exhaustive) for hours */
const HOUR_KEYS = [
  'usetime',
  'usetimeculture',
  'usetimefood',
  'usetimefestival',
  'usetimeshopping',
  'usetimesports',
  'playtime',
  'opentime',
  'closetime',
  'open',
  'close',
  'academyhours',
];

const FEE_KEYS = [
  'usefee',
  'usefeeculture',
  'usefeefood',
  'expguide',
  'discountinfo',
  'discount',
];

const REST_KEYS = ['restdate', 'restdateculture', 'restdatefood', 'rest', 'holidays'];

const PARK_KEYS = ['parking', 'parkingculture', 'parkingfood', 'parkingspace'];

const RESERVE_KEYS = ['reservation', 'reservationculture', 'reservationfood', 'booking', 'book'];

export function extractOperatingHoursFromIntro(intro: IntroRaw): {
  raw: string | null;
  sourceFieldNames: string[];
} {
  const rec = intro as Record<string, unknown>;
  const byKnown = firstNonEmptyByKeys(rec, HOUR_KEYS);
  if (byKnown.val) {
    return { raw: byKnown.val, sourceFieldNames: [byKnown.key!] };
  }
  const { joined, fields } = collectByKeyRegex(rec, HOUR_KEY_RE);
  return { raw: joined, sourceFieldNames: fields };
}

export function extractFeeFromIntro(intro: IntroRaw): { raw: string | null; sourceFieldNames: string[] } {
  const rec = intro as Record<string, unknown>;
  const byKnown = firstNonEmptyByKeys(rec, FEE_KEYS);
  if (byKnown.val) {
    return { raw: byKnown.val, sourceFieldNames: [byKnown.key!] };
  }
  const { joined, fields } = collectByKeyRegex(rec, FEE_KEY_RE);
  return { raw: joined, sourceFieldNames: fields };
}

export function extractRestDateFromIntro(intro: IntroRaw): { raw: string | null; sourceFieldNames: string[] } {
  const rec = intro as Record<string, unknown>;
  const byKnown = firstNonEmptyByKeys(rec, REST_KEYS);
  if (byKnown.val) {
    return { raw: byKnown.val, sourceFieldNames: [byKnown.key!] };
  }
  const { joined, fields } = collectByKeyRegex(rec, REST_KEY_RE);
  return { raw: joined, sourceFieldNames: fields };
}

export function extractParkingFromIntro(intro: IntroRaw): { raw: string | null; sourceFieldNames: string[] } {
  const rec = intro as Record<string, unknown>;
  const byKnown = firstNonEmptyByKeys(rec, PARK_KEYS);
  if (byKnown.val) {
    return { raw: byKnown.val, sourceFieldNames: [byKnown.key!] };
  }
  const { joined, fields } = collectByKeyRegex(rec, PARK_KEY_RE);
  return { raw: joined, sourceFieldNames: fields };
}

export function extractReservationInfoFromIntro(intro: IntroRaw): { raw: string | null; sourceFieldNames: string[] } {
  const rec = intro as Record<string, unknown>;
  const byKnown = firstNonEmptyByKeys(rec, RESERVE_KEYS);
  if (byKnown.val) {
    return { raw: byKnown.val, sourceFieldNames: [byKnown.key!] };
  }
  const { joined, fields } = collectByKeyRegex(rec, RESERVE_KEY_RE);
  return { raw: joined, sourceFieldNames: fields };
}

export function extractBusinessStatusNoteFromIntro(intro: IntroRaw): { raw: string | null; sourceFieldNames: string[] } {
  const rec = intro as Record<string, unknown>;
  const { joined, fields } = collectByKeyRegex(rec, STATUS_KEY_RE);
  return { raw: joined, sourceFieldNames: fields };
}

function normalizeUseTimeText(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t.length) return null;
  if (t.length < 2) return null;
  return t;
}

function normalizeFeeText(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (!t.length) return null;
  const okShort = /^(무료|유료|상시|연중무휴|별도|문의)$/i.test(t);
  if (t.length < 2 && !okShort) return null;
  return t;
}

export function isAmbiguousShort(text: string | null, kind: 'time' | 'fee'): boolean {
  if (!text) return true;
  const t = text.trim();
  if (kind === 'fee' && /^(무료|유료|상시|연중무휴|별도|문의)$/i.test(t)) return false;
  if (t.length < 3) return true;
  if (kind === 'time' && /^[0-9:~\-–\s]+$/.test(t) && t.length < 6) return true;
  return false;
}

/** Parse detailIntro2 body: returns first intro item + raw json string */
export function parseIntroBody(rawText: string): {
  intro: IntroRaw | null;
  introList: IntroRaw[];
  error?: string;
} {
  const env = parseItemsEnvelope(rawText);
  if (!env.items.length) {
    return { intro: null, introList: [], error: env.parseError ?? 'no items' };
  }
  const first = env.items[0] as IntroRaw;
  const list = normalizeItemList<Record<string, unknown>>(env.items as unknown[]);
  return { intro: first, introList: list as IntroRaw[] };
}

export function buildExtractedIntroFields(intro: IntroRaw | null): ExtractedIntroFields {
  if (!intro) {
    return {
      openingHoursRaw: null,
      openingHoursSourceFields: [],
      admissionFeeRaw: null,
      admissionFeeSourceFields: [],
      restDate: null,
      restDateSourceFields: [],
      parkingInfo: null,
      parkingSourceFields: [],
      reservationInfo: null,
      reservationSourceFields: [],
      businessStatusNote: null,
      businessStatusSourceFields: [],
      useTimeText: null,
      useTimeSourceFields: [],
      feeText: null,
      feeSourceFields: [],
    };
  }

  const oh = extractOperatingHoursFromIntro(intro);
  const fee = extractFeeFromIntro(intro);
  const rest = extractRestDateFromIntro(intro);
  const park = extractParkingFromIntro(intro);
  const resv = extractReservationInfoFromIntro(intro);
  const biz = extractBusinessStatusNoteFromIntro(intro);

  const useTimeText = normalizeUseTimeText(oh.raw);
  const feeText = normalizeFeeText(fee.raw);

  return {
    openingHoursRaw: oh.raw,
    openingHoursSourceFields: oh.sourceFieldNames,
    admissionFeeRaw: fee.raw,
    admissionFeeSourceFields: fee.sourceFieldNames,
    restDate: rest.raw,
    restDateSourceFields: rest.sourceFieldNames,
    parkingInfo: park.raw,
    parkingSourceFields: park.sourceFieldNames,
    reservationInfo: resv.raw,
    reservationSourceFields: resv.sourceFieldNames,
    businessStatusNote: biz.raw,
    businessStatusSourceFields: biz.sourceFieldNames,
    useTimeText,
    useTimeSourceFields: oh.sourceFieldNames,
    feeText,
    feeSourceFields: fee.sourceFieldNames,
  };
}
