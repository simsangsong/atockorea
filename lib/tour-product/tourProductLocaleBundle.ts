import type { TourProductDetailPayloadV1 } from "@/lib/tour-product/detailPayloadV1";
import { TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION } from "@/lib/tour-product/detailPayloadV1";

/**
 * 번역가/운영자가 돌려주는 번들: 동일 slug에 대해 `locale` 행 upsert용.
 * - `detail_payload`는 EN과 동일 키 구조, 문자열만 해당 언어로 번역.
 * - URL·id·숫자·schema_version·배열 길이 등 구조는 유지.
 */
export type TourProductLocaleBundle = {
  slug: string;
  locale: string;
  page: {
    title: string;
    subtitle: string;
    region_label: string;
    duration_label: string;
    card_short_description: string;
    seo_title: string;
    meta_description: string;
    headline_line_1: string;
    headline_line_2: string;
    badges: string[];
    detail_payload: TourProductDetailPayloadV1;
    /** 로케일별 표시(예: zh-TW `人`); 없으면 EN 행 값 유지 */
    price_per?: string;
    price_amount_label?: string;
    price_currency?: string;
  };
};

export function isTourProductLocaleBundle(v: unknown): v is TourProductLocaleBundle {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.slug !== "string" || typeof o.locale !== "string") return false;
  const page = o.page;
  if (typeof page !== "object" || page === null) return false;
  const p = page as Record<string, unknown>;
  const required = [
    "title",
    "subtitle",
    "region_label",
    "duration_label",
    "card_short_description",
    "seo_title",
    "meta_description",
    "headline_line_1",
    "headline_line_2",
    "badges",
    "detail_payload",
  ] as const;
  for (const k of required) {
    if (!(k in p)) return false;
  }
  if (!Array.isArray(p.badges) || !p.badges.every((x) => typeof x === "string")) return false;
  const dp = p.detail_payload;
  if (typeof dp !== "object" || dp === null) return false;
  const sv = Number((dp as Record<string, unknown>).schema_version);
  return sv === TOUR_PRODUCT_DETAIL_PAYLOAD_SCHEMA_VERSION;
}
