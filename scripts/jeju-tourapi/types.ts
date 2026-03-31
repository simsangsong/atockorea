/**
 * Types for Jeju curated POI import (KorService2 batch). Independent from app runtime.
 */

export type CuratedPlaceInput = {
  sourceName: string;
  /** Optional extra search strings (same order as main search is applied after built-in steps). */
  aliases?: string[];
};

export type TourApiSearchItem = {
  contentid?: string;
  contenttypeid?: string;
  title?: string;
  addr1?: string;
  addr2?: string;
  firstimage?: string;
  firstimage2?: string;
  mapx?: string;
  mapy?: string;
  tel?: string;
  overview?: string;
  homepage?: string;
  /** 조회수 (목록 API; 문자열로 오는 경우 많음) */
  readcount?: string | number;
  [key: string]: unknown;
};

export type ScoredCandidate = {
  item: TourApiSearchItem;
  score: number;
  matchReason: string[];
};

export type IntroRaw = Record<string, unknown>;

export type ExtractedIntroFields = {
  openingHoursRaw: string | null;
  openingHoursSourceFields: string[];
  admissionFeeRaw: string | null;
  admissionFeeSourceFields: string[];
  restDate: string | null;
  restDateSourceFields: string[];
  parkingInfo: string | null;
  parkingSourceFields: string[];
  reservationInfo: string | null;
  reservationSourceFields: string[];
  businessStatusNote: string | null;
  businessStatusSourceFields: string[];
  useTimeText: string | null;
  useTimeSourceFields: string[];
  feeText: string | null;
  feeSourceFields: string[];
};

export type PipelineResult = {
  sourceName: string;
  matchedTitle: string | null;
  contentId: string | null;
  contentTypeId: string | null;
  addr1: string | null;
  addr2: string | null;
  overview: string | null;
  firstImage: string | null;
  firstImage2: string | null;
  mapx: string | null;
  mapy: string | null;
  tel: string | null;
  homepage: string | null;
  openingHoursRaw: string | null;
  admissionFeeRaw: string | null;
  businessStatusNote: string | null;
  reservationInfo: string | null;
  parkingInfo: string | null;
  restDate: string | null;
  useTimeText: string | null;
  feeText: string | null;
  introRawJson: string | null;
  score: number | null;
  matchReason: string[];
  sourceApi: string;
  fetchedAt: string;
  status: 'matched' | 'review' | 'unmatched';
  /** Present when status is review (also written into jeju-review.json). */
  reviewReason?: string[];
};
