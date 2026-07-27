'use client';

/**
 * §5.7 R-5 — the guest-facing dining card.
 *
 * 🔴 NO MAP TILE (spec K7). Kakao's terms make plotting Kakao POI data on a
 * non-Kakao map questionable, so this card is a LIST and every geographic
 * affordance is a Kakao deep link. Do not "improve" it with a Static Maps
 * thumbnail the way FacilityMapCard does — those pins come from Google.
 *
 * 🔴 CLIENT-SAFE IMPORTS ONLY: card.ts / dietary.ts / cuisine.ts are pure.
 * Importing anything `.server` here compiles and unit-tests fine and then
 * breaks `next build --webpack` only — the exact failure that once made main
 * undeployable.
 *
 * The filter chips re-filter the ALREADY-LOADED payload on the client: zero
 * network, zero API quota. A guest who never used /plan can still say "no pork"
 * and get an honest answer instantly (spec K8, intake path ③).
 */

import { useMemo, useState } from 'react';
import { IconMeal, IconReport } from '@/components/tour-mode/icons';
import {
  IconArrived,
  IconDone,
  IconFollow,
  IconReview,
  IconWarn,
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import {
  DINING_COPY,
  diningTitle,
  hoursLabel,
  kakaoDirectionsUrl,
  kakaoPlaceUrl,
  placeDisplayName,
  priceBandLabel,
  type DiningCardMeta,
  type DiningPlace,
} from '@/lib/ops/dining/card';
import {
  DIETARY_FILTER_TAGS,
  DIETARY_LABELS,
  dietaryLabel,
  type DietaryFilterTag,
} from '@/lib/ops/dining/dietary';
import { satisfiesPositively, violatesDietary } from '@/lib/ops/dining/cuisine';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** Positive tag badges we are allowed to render (verified signals only). */
const TAG_LABELS: Record<string, Record<RoomLocale, string>> = {
  vegetarian_friendly: { en: 'Veg-friendly', ko: '채식 가능', ja: 'ベジ対応', es: 'Apto veg.', zh: '有素食', 'zh-TW': '有素食', fr: 'Option végé', de: 'Vegetarisch', ru: 'Вегетарианцам', it: 'Adatto veg.' },
  vegan: { en: 'Vegan', ko: '비건', ja: 'ヴィーガン', es: 'Vegano', zh: '纯素', 'zh-TW': '純素', fr: 'Végétalien', de: 'Vegan', ru: 'Веган', it: 'Vegano' },
  halal: { en: 'Halal', ko: '할랄', ja: 'ハラル', es: 'Halal', zh: '清真', 'zh-TW': '清真', fr: 'Halal', de: 'Halal', ru: 'Халяль', it: 'Halal' },
  kids_ok: { en: 'Kid-friendly', ko: '아이 동반', ja: '子ども可', es: 'Para niños', zh: '适合儿童', 'zh-TW': '適合兒童', fr: 'Enfants bienvenus', de: 'Kinderfreundlich', ru: 'Можно с детьми', it: 'Per bambini' },
  takeout: { en: 'Takeout', ko: '포장', ja: 'テイクアウト', es: 'Para llevar', zh: '外带', 'zh-TW': '外帶', fr: 'À emporter', de: 'Zum Mitnehmen', ru: 'Навынос', it: 'Da asporto' },
  parking: { en: 'Parking', ko: '주차', ja: '駐車場', es: 'Parking', zh: '停车', 'zh-TW': '停車', fr: 'Parking', de: 'Parkplatz', ru: 'Парковка', it: 'Parcheggio' },
  reservable: { en: 'Reservations', ko: '예약 가능', ja: '予約可', es: 'Reservas', zh: '可预订', 'zh-TW': '可訂位', fr: 'Réservations', de: 'Reservierbar', ru: 'Бронь', it: 'Prenotabile' },
  cafe: { en: 'Café', ko: '카페', ja: 'カフェ', es: 'Café', zh: '咖啡', 'zh-TW': '咖啡', fr: 'Café', de: 'Café', ru: 'Кафе', it: 'Caffè' },
};

const FILTER_HINT: Record<RoomLocale, string> = {
  en: 'Filter',
  ko: '필터',
  ja: '絞り込み',
  es: 'Filtrar',
  zh: '筛选',
  'zh-TW': '篩選',
  fr: 'Filtrer',
  de: 'Filtern',
  ru: 'Фильтр',
  it: 'Filtra',
};

export type DiningFeedbackAction = 'tap' | 'visited' | 'wrong' | 'closed';

function compactCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

export default function DiningCard({
  meta,
  locale,
  auth,
}: {
  meta: DiningCardMeta;
  locale: RoomLocale;
  /** Room credentials for the feedback POST. Omitted = deep links only. */
  auth?: { bookingId: string; roomSession: string } | null;
}) {
  const copy = DINING_COPY[locale] ?? DINING_COPY.en;
  const [chips, setChips] = useState<DietaryFilterTag[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  const serverDietary = useMemo<string[]>(
    () => (Array.isArray(meta.dietary) ? meta.dietary : []),
    [meta.dietary],
  );
  const basePlaces = useMemo<DiningPlace[]>(
    () => (Array.isArray(meta.places) ? meta.places : []),
    [meta.places],
  );

  // Client-side re-filter of the loaded payload — zero network (K8 path ③).
  // Exclusion is hard; a positive verified signal only promotes (never asserts
  // compliance — cuisine.ts's whole safety contract).
  const places = useMemo(() => {
    const kept = basePlaces.filter(
      (place) => !hidden.includes(place.place_key) && !violatesDietary(place, chips),
    );
    if (chips.length === 0) return kept;
    return kept
      .map((place, index) => ({
        place,
        index,
        fit: chips.filter((tag) => satisfiesPositively(place, tag)).length,
      }))
      .sort((a, b) => b.fit - a.fit || a.index - b.index)
      .map((entry) => entry.place);
  }, [basePlaces, chips, hidden]);

  const appliedTags = useMemo(
    () => [...new Set<string>([...serverDietary, ...chips])],
    [serverDietary, chips],
  );

  const send = (placeKey: string, action: DiningFeedbackAction) => {
    if (!auth?.bookingId || !auth?.roomSession) return;
    void fetch(`/api/tour-rooms/${encodeURIComponent(auth.bookingId)}/dining/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': auth.roomSession },
      body: JSON.stringify({ placeKey, cell: meta.cell, action }),
    }).catch(() => undefined);
  };

  const toggleChip = (tag: DietaryFilterTag) =>
    setChips((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  return (
    <div className="flex flex-col gap-2" data-testid="dining-card">
      <div className="overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]">
        {/* header */}
        <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]"
            aria-hidden
          >
            <IconMeal size={TR_ICON.chip} strokeWidth={TR_STROKE.default} />
          </span>
          <p className="tr-title min-w-0 flex-1 text-[var(--tr-ink)]" data-testid="dining-title">
            {diningTitle(meta, locale)}
          </p>
        </div>

        {/* applied filters (server intake + client chips) */}
        {appliedTags.length > 0 ? (
          <p className="tr-meta px-3.5 pb-1.5 text-[var(--tr-ink-2)]" data-testid="dining-applied">
            {copy.filteredFor}: {appliedTags.map((tag) => dietaryLabel(tag, locale)).join(', ')}
          </p>
        ) : null}

        {/* filter chips — client-side, no new API call */}
        <div
          className="flex flex-wrap gap-1.5 px-3.5 pb-2"
          role="group"
          aria-label={FILTER_HINT[locale]}
          data-testid="dining-filter-chips"
        >
          {DIETARY_FILTER_TAGS.map((tag) => {
            const active = chips.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleChip(tag)}
                aria-pressed={active}
                className={`tr-label tr-press min-h-[44px] rounded-full border px-3 font-medium ${
                  active
                    ? 'border-[var(--tr-accent)] bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                    : 'border-[var(--tr-hairline)] bg-[var(--tr-surface)] text-[var(--tr-ink-2)]'
                }`}
                data-testid={`dining-chip-${tag}`}
              >
                {DIETARY_LABELS[tag][locale]}
              </button>
            );
          })}
        </div>

        {places.some((place) => place.unrated) ? (
          <p className="tr-meta px-3.5 pb-1.5 text-[var(--tr-ink-3)]" data-testid="dining-unrated">
            {copy.unrated}
          </p>
        ) : null}

        {/* the picks */}
        {places.length === 0 ? (
          <p className="tr-card-text px-3.5 pb-3 text-[var(--tr-ink-2)]" data-testid="dining-empty">
            {copy.empty}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--tr-hairline)] border-t border-[var(--tr-hairline)]">
            {places.map((place) => {
              const price = priceBandLabel(place.price_band);
              const mapUrl = kakaoPlaceUrl(place);
              const navUrl = kakaoDirectionsUrl(place);
              const menus = Array.isArray(place.signature_menus) ? place.signature_menus.slice(0, 3) : [];
              const picked = chosen === place.place_key;
              return (
                <li key={place.place_key} className="px-3.5 py-2.5" data-testid="dining-place">
                  <p className="tr-card-text font-semibold leading-snug text-[var(--tr-ink)]">
                    {placeDisplayName(place, locale)}
                  </p>

                  <p className="tr-meta mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[var(--tr-ink-2)]">
                    {place.cuisine ? <span>{place.cuisine}</span> : null}
                    {typeof place.walk_min === 'number' ? (
                      <span data-testid="dining-walk">
                        {copy.walk.replace('{min}', String(place.walk_min))}
                        {typeof place.distance_m === 'number' ? ` · ${place.distance_m}m` : ''}
                      </span>
                    ) : null}
                    {price ? <span className="font-semibold">{price}</span> : null}
                    {typeof place.rating === 'number' ? (
                      <span className="tr-num inline-flex items-center gap-0.5">
                        <IconReview size={TR_ICON.meta} className="fill-current text-amber-500" aria-hidden />
                        {place.rating.toFixed(1)}
                        {typeof place.review_count === 'number' && place.review_count > 0 ? (
                          <span className="text-[var(--tr-ink-3)]">·{compactCount(place.review_count)}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="tr-pill px-2 py-0.5 text-[var(--tr-ink-3)]" data-testid="dining-unrated-badge">
                        {copy.unrated}
                      </span>
                    )}
                    <span>{hoursLabel(place, locale)}</span>
                  </p>

                  {place.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {place.tags
                        .filter((tag) => TAG_LABELS[tag])
                        .map((tag) => (
                          <span
                            key={tag}
                            className="tr-meta rounded-full bg-[var(--tr-accent-soft)] px-2 py-0.5 font-medium text-[var(--tr-accent-deep)]"
                          >
                            {TAG_LABELS[tag][locale]}
                          </span>
                        ))}
                    </div>
                  ) : null}

                  {menus.length > 0 ? (
                    <p className="tr-meta mt-1 text-[var(--tr-ink-2)]" data-testid="dining-menus">
                      {menus
                        .map((menu) => (locale !== 'ko' && menu.name_i18n?.[locale]) || menu.name)
                        .join(' · ')}
                    </p>
                  ) : null}

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {mapUrl ? (
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => send(place.place_key, 'tap')}
                        className="tr-pill tr-label inline-flex min-h-[44px] items-center gap-1 px-3 font-semibold text-[var(--tr-ink)]"
                        data-testid="dining-map-link"
                      >
                        <IconArrived size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden />
                        {copy.mapLink}
                      </a>
                    ) : null}
                    {navUrl ? (
                      <a
                        href={navUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => send(place.place_key, 'tap')}
                        className="tr-pill tr-label inline-flex min-h-[44px] items-center gap-1 px-3 font-semibold text-[var(--tr-ink)]"
                        data-testid="dining-directions-link"
                      >
                        <IconFollow size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden />
                        {copy.directions}
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setChosen(place.place_key);
                        send(place.place_key, 'visited');
                      }}
                      aria-pressed={picked}
                      className={`tr-label tr-press inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 font-semibold ${
                        picked
                          ? 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
                          : 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
                      }`}
                      data-testid="dining-go-here"
                    >
                      <IconDone size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden />
                      {copy.goHere}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Optimistic: the guest told us it's wrong, so it goes
                        // away now. Three such reports auto-hide it for everyone.
                        setHidden((prev) => [...prev, place.place_key]);
                        send(place.place_key, 'wrong');
                      }}
                      className="tr-label tr-press inline-flex min-h-[44px] items-center gap-1 px-2 text-[var(--tr-ink-3)]"
                      data-testid="dining-report-wrong"
                    >
                      <IconReport size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden />
                      {copy.reportWrong}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* 🔴 mandatory whenever any filter is applied (dietary.ts contract) */}
        {appliedTags.length > 0 ? (
          <p
            className="tr-meta flex items-start gap-1.5 border-t border-[var(--tr-hairline)] bg-[var(--tr-surface-2)] px-3.5 py-2 leading-relaxed text-[var(--tr-ink-2)]"
            data-testid="dining-caution"
          >
            <IconWarn size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden className="mt-0.5 shrink-0" />
            <span>{copy.caution}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
