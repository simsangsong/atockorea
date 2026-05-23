/**
 * Shared types for the v2 admin product editor.
 *
 * The editor primarily reads/writes the `tour_product_pages` table (one row per
 * slug × locale). The lightweight list view also fetches a subset of `tours`
 * columns for sidebar display.
 */

export type Locale = 'en' | 'ko' | 'ja' | 'zh' | 'zh-TW' | 'es';

export const ALL_LOCALES: ReadonlyArray<Locale> = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  zh: '简体中文',
  'zh-TW': '繁體中文',
  es: 'Español',
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: 'EN',
  ko: 'KO',
  ja: 'JA',
  zh: 'ZH',
  'zh-TW': 'TW',
  es: 'ES',
};

/** Possible product types pulled from `match_tours.matching_profile.product_type`. */
export type ProductType =
  | 'private'
  | 'small_group'
  | 'small_group_fixed_itinerary'
  | 'bus'
  | string;

/** Compact row for the list pane — pulled from `tours` via existing /api/admin/tours. */
export type TourListItem = {
  id: string;
  slug: string;
  title: string;
  city: 'Seoul' | 'Busan' | 'Jeju';
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
  price: number | null;
  rating: number | null;
  review_count: number | null;
  product_type: ProductType | null;
  updated_at?: string | null;
};

/** Full row for a single (slug, locale) — matches `tour_product_pages` schema. */
export type ProductPageRow = {
  id: string;
  slug: string;
  locale: string;
  product_id: string;
  is_published: boolean;
  sort_order: number;
  tour_id: string | null;
  title: string;
  subtitle: string | null;
  region_label: string | null;
  duration_label: string | null;
  stops_count: number | null;
  rating_avg: number | null;
  review_count: number | null;
  badges: string[];
  hero_image_url: string | null;
  thumbnail_url: string | null;
  card_short_description: string | null;
  seo_title: string | null;
  meta_description: string | null;
  headline_line_1: string | null;
  headline_line_2: string | null;
  price_amount_label: string | null;
  price_currency: string;
  price_per: string;
  detail_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** Aggregated multi-locale completeness for a slug. */
export type LocaleStatus = {
  locale: Locale;
  exists: boolean;
  published: boolean;
  updatedAt?: string | null;
};
