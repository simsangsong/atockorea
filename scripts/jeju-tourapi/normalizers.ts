/**
 * Final record normalization: merge intro extracts + optional detailInfo, track source fields.
 */

import type { ExtractedIntroFields } from './types';

export type FieldProvenance = {
  useTimeText: string | null;
  useTimeSourceFieldNames: string[];
  feeText: string | null;
  feeSourceFieldNames: string[];
  openingHoursRaw: string | null;
  openingHoursRawSourceFieldNames: string[];
  admissionFeeRaw: string | null;
  admissionFeeRawSourceFieldNames: string[];
};

/**
 * Collect 운영시간·이용시간 후보를 useTimeText / openingHoursRaw에 반영 (intro 추출 우선).
 */
export function normalizeUseTimeAndHours(
  extracted: ExtractedIntroFields,
): Pick<
  FieldProvenance,
  'useTimeText' | 'useTimeSourceFieldNames' | 'openingHoursRaw' | 'openingHoursRawSourceFieldNames'
> {
  return {
    useTimeText: extracted.useTimeText,
    useTimeSourceFieldNames: [...extracted.useTimeSourceFields],
    openingHoursRaw: extracted.openingHoursRaw,
    openingHoursRawSourceFieldNames: [...extracted.openingHoursSourceFields],
  };
}

/**
 * 입장료·이용요금 후보를 feeText / admissionFeeRaw에 반영.
 */
export function normalizeFeeFields(
  extracted: ExtractedIntroFields,
): Pick<
  FieldProvenance,
  'feeText' | 'feeSourceFieldNames' | 'admissionFeeRaw' | 'admissionFeeRawSourceFieldNames'
> {
  return {
    feeText: extracted.feeText,
    feeSourceFieldNames: [...extracted.feeSourceFields],
    admissionFeeRaw: extracted.admissionFeeRaw,
    admissionFeeRawSourceFieldNames: [...extracted.admissionFeeSourceFields],
  };
}

/** detailInfo2 items 배열에서 텍스트 후보를 병합 (null-safe). */
export function mergeDetailInfoTextHints(
  detailItems: Record<string, unknown>[],
  current: FieldProvenance,
): FieldProvenance {
  const extraTime: string[] = [];
  const extraFee: string[] = [];
  const timeKeys = /usetime|time|hour|운영|이용시간|개장|폐장/i;
  const feeKeys = /fee|요금|입장|이용료|price|ticket/i;

  for (const row of detailItems) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== 'string' && typeof v !== 'number') continue;
      const s = String(v).trim();
      if (!s) continue;
      if (timeKeys.test(k) && !current.useTimeText?.includes(s)) extraTime.push(`${k}:${s}`);
      if (feeKeys.test(k) && !current.feeText?.includes(s)) extraFee.push(`${k}:${s}`);
    }
  }

  let useTimeText = current.useTimeText;
  const useTimeSourceFieldNames = [...current.useTimeSourceFieldNames];
  if (extraTime.length) {
    const merged = [current.useTimeText, extraTime.join(' | ')].filter(Boolean).join(' | ');
    useTimeText = merged || current.useTimeText;
    if (extraTime.length) useTimeSourceFieldNames.push('detailInfo2:merged_hints');
  }

  let feeText = current.feeText;
  const feeSourceFieldNames = [...current.feeSourceFieldNames];
  if (extraFee.length) {
    const merged = [current.feeText, extraFee.join(' | ')].filter(Boolean).join(' | ');
    feeText = merged || current.feeText;
    if (extraFee.length) feeSourceFieldNames.push('detailInfo2:merged_hints');
  }

  return {
    ...current,
    useTimeText,
    useTimeSourceFieldNames,
    feeText,
    feeSourceFieldNames,
  };
}

export function buildFieldProvenance(extracted: ExtractedIntroFields): FieldProvenance {
  const t = normalizeUseTimeAndHours(extracted);
  const f = normalizeFeeFields(extracted);
  return { ...t, ...f };
}
