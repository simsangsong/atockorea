import type { TourDetailViewModel } from '@/src/types/tours';
import type {
  SmallGroupDetailContent,
  SmallGroupInsightCard,
  SmallGroupPracticalBlock,
  SmallGroupSnapshotRow,
  SmallGroupTemplateSectionChrome,
} from '../smallGroupDetailContent';
import {
  EAST_DETAILPAGE_HERO_IMAGE,
  EAST_DETAILPAGE_ROUTE_STOPS,
  getEastDetailPageFaqs,
  getEastDetailPageRelatedTours,
  getEastSignatureDetailPageEditorial,
  mapAfterStepsToSupportItems,
} from './eastSignatureDetailPageLayer';

/** English SKU title (DB base title). KO locale can override via `translations.ko.title`. */
const FALLBACK_TITLE_EN = 'East Signature Nature Core';

const TEMPLATE_CHROME: SmallGroupTemplateSectionChrome = {
  routeTimelineTitle: 'Your Day, Stop by Stop',
  routeTimelineSubtitle: 'A geology-to-coast route through East Jeju',
  routeTimelineCardHint: 'Short card summary first, deeper details only when expanded',
  seasonalSubtitle:
    'The same route feels different depending on wind, light, and closure-day conditions',
  practicalSubtitle: 'What matters before you go',
  trustSubtitle: 'Clear route logic and clear operating expectations',
  afterBookSubtitle: 'The support you receive before, during, and after your experience',
  faqSubtitle: 'Common questions from guests considering this route',
  faqEmptyState:
    'Frequently asked questions for this experience will appear here.',
};

export function isEastSignatureNatureCoreTour(tour: TourDetailViewModel): boolean {
  if ((tour.slug || '').trim() === 'east-signature-nature-core') return true;
  const raw = (tour.title || '').trim();
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');
  if (/east signature nature core/i.test(lower)) return true;
  const compact = raw.replace(/\s+/g, '');
  if (compact === '동부시그니처네이처코어') return true;
  return /시그니처/.test(raw) && /네이처/.test(raw) && /동부/.test(raw);
}

/**
 * Curated copy: geology-to-coast East route (Stone Park → Micheongul → … → Hamdeok).
 * Gallery, price, pickup, rating still come from `tour` / API when available.
 */
export function mergeEastSignatureNatureCoreContent(
  tour: TourDetailViewModel,
  base: SmallGroupDetailContent
): SmallGroupDetailContent | null {
  if (!isEastSignatureNatureCoreTour(tour)) return null;

  const editorialBase = getEastSignatureDetailPageEditorial();
  const afterSteps = editorialBase.afterBookingSteps ?? [];

  const galleryImageUrls =
    base.hero.galleryImageUrls.length > 0
      ? base.hero.galleryImageUrls
      : [EAST_DETAILPAGE_HERO_IMAGE];

  const displayTitle = (tour.title || '').trim() || FALLBACK_TITLE_EN;

  const ratingLine =
    tour.rating != null ? `${Number(tour.rating).toFixed(1)} (${tour.reviewCount ?? 0})` : '';

  const editorial = {
    ...editorialBase,
    ratingLine,
    seasonalTabs: [],
  };

  const summaryFacts = [
    {
      id: 'duration',
      label: 'Duration',
      value: tour.duration || '8–9 hours',
    },
    {
      id: 'stops',
      label: 'Stops',
      value: `${EAST_DETAILPAGE_ROUTE_STOPS.length} stops`,
    },
    {
      id: 'group',
      label: 'Group',
      value: tour.groupSize || 'Small group',
    },
    ...(tour.rating != null
      ? [
          {
            id: 'rating',
            label: 'Rating',
            value: `${Number(tour.rating).toFixed(1)} (${tour.reviewCount ?? 0} reviews)`,
          },
        ]
      : []),
  ];

  const heroBadges =
    base.hero.badges.length > 0
      ? base.hero.badges
      : [
          { id: 'east-signature-small-group', label: 'Small group' },
          { id: 'east-signature-route', label: 'East Jeju route' },
        ];

  return {
    ...base,
    hero: {
      ...base.hero,
      title: displayTitle,
      subtitle:
        'A structured East Jeju route that starts with geology, moves through a lava cave, adds village texture, and finishes on the coast.',
      positioningLine: '',
      badges: heroBadges,
      galleryImageUrls,
      summaryFacts,
    },
    quickSnapshot: QUICK_SNAPSHOT_ROWS,
    insightCards: EAST_INSIGHT_CARDS,
    routeStops: EAST_DETAILPAGE_ROUTE_STOPS,
    whyOrderWorks: WHY_ORDER_FALLBACK,
    seasonalBlocks: SEASONAL_BLOCKS_SYNC,
    practicalBlocks: EAST_PRACTICAL_BLOCKS,
    afterBookingItems: mapAfterStepsToSupportItems(afterSteps),
    faqs:
      tour.faqs && tour.faqs.length > 0 ? tour.faqs : getEastDetailPageFaqs(),
    relatedTours: getEastDetailPageRelatedTours(),
    practicalIntro:
      'Pickup, walking level, closure-day logic, and how the Seongsan stop is handled — open only the sections you need.',
    routeStopMetaLabels: {
      whyIncluded: 'Why This Stop',
      stayDuration: 'Duration',
      walkingLevel: 'Walking Effort',
      photoTip: 'Photo Tip',
      restroom: 'Restroom',
      weatherNote: 'Weather Note',
      delayNote: 'Flexibility',
    },
    editorial,
    templateSectionChrome: TEMPLATE_CHROME,
  };
}

const QUICK_SNAPSHOT_ROWS: SmallGroupSnapshotRow[] = [
  {
    id: 'bestFor',
    label: 'Best for',
    value:
      'First-time visitors, couples, adult families, and guests who want East Jeju to feel like one connected route.',
  },
  {
    id: 'notIdealFor',
    label: 'Not ideal for',
    value:
      'Guests avoiding stairs or caves, stroller-heavy groups, and travelers wanting a slow café-first day.',
  },
  {
    id: 'walkingLevel',
    label: 'Walking level',
    value:
      'Moderate — Seongsan is the main variable point because guests can choose the easier free side or the paid summit route.',
  },
  {
    id: 'rainSafety',
    label: 'Rain safety',
    value: 'Medium — the morning half has better shelter, while Seongsan and Seopjikoji remain exposed.',
  },
  {
    id: 'familyFit',
    label: 'Family fit',
    value:
      'Good for ages 8+; possible for younger children, but the cave and summit choice make the day smoother for older kids.',
  },
  {
    id: 'seniorFit',
    label: 'Senior fit',
    value: 'Moderate — comfortable for active seniors when Seongsan is handled via the easier coastal side.',
  },
  {
    id: 'scenicIntensity',
    label: 'Scenic intensity',
    value: 'High — stone culture, lava cave, village textures, crater views, and an open ridge coastline.',
  },
  {
    id: 'photoValue',
    label: 'Photo value',
    value: 'High — this route gives different textures instead of repeating the same sea-view stop.',
  },
  {
    id: 'relaxationLevel',
    label: 'Relaxation level',
    value: 'Balanced — content-rich morning, more exposed middle, simpler last stop.',
  },
  {
    id: 'outdoorIndoorBalance',
    label: 'Outdoor balance',
    value: 'Mixed — museum and cave support the first half, then the route shifts outdoors.',
  },
];

const EAST_INSIGHT_CARDS: SmallGroupInsightCard[] = [
  {
    id: 'i1',
    title: 'Who this tour suits best',
    body: 'Best for guests who want East Jeju to make sense as a route, not just as a list of named attractions.',
  },
  {
    id: 'i2',
    title: 'Why this order works',
    body: 'It starts with island formation and stone culture, continues underground through a lava cave, adds village life, then moves into the crater-and-coast section.',
  },
  {
    id: 'i3',
    title: 'What makes this course appealing',
    body: 'The textures keep changing — museum, stone grounds, cave, village, crater, ridge — so the day stays varied without feeling random.',
  },
  {
    id: 'i4',
    title: 'How this differs from a rigid checklist',
    body: 'Seongsan is handled as a decision stop. The group can use the easier free side or the paid summit route depending on pace, wind, and energy.',
  },
];

const EAST_PRACTICAL_BLOCKS: SmallGroupPracticalBlock[] = [
  {
    id: 'pickupDrop',
    title: 'Pickup & drop-off',
    body: 'Hotel lobby pickup in Jeju City area. For Seogwipo or farther areas, contact us first.',
    moreDetails: 'Small-group pickup timing varies by guest location and the day\'s sequence.',
  },
  {
    id: 'included',
    title: "What's included",
    body: 'Professional English-speaking guide · small-group vehicle · hotel pickup/drop-off (Jeju City) · listed entrance fees · bottled water · WhatsApp support.',
    moreDetails:
      'If a public-site closure affects the route, substitute handling should be explained in advance.',
  },
  {
    id: 'notIncluded',
    title: 'Not included',
    body: 'Extra drinks/snacks · personal purchases · travel insurance · gratuities (optional).',
    moreDetails: '',
  },
  {
    id: 'meal',
    title: 'Lunch timing',
    body: 'Lunch is usually placed between Seongeup Folk Village and Seongsan Ilchulbong.',
    moreDetails:
      'It is intentionally removed from the itinerary cards but still works best as the operational reset before the route\'s main walking-choice stop.',
  },
  {
    id: 'whatToWear',
    title: 'What to wear',
    body: 'Comfortable walking shoes with grip · layers · light wind-resistant outerwear · hat and sunglasses.',
    moreDetails: 'This matters most for the cave footing and the exposed Seongsan–Seopjikoji section.',
  },
  {
    id: 'whatToBring',
    title: 'What to bring',
    body: 'Phone or camera · sunscreen · light rain layer · cash/card · personal medication.',
    moreDetails: 'Low-light mode helps for cave photos.',
  },
  {
    id: 'walkingStairs',
    title: 'Terrain & accessibility',
    body: 'Stone Park is manageable. Micheongul is dimmer and cave-like. Seongeup is easier. Seongsan is the main variable stop if the summit is chosen.',
    moreDetails:
      'Guests with limited mobility should check in advance so the Seongsan section can be handled realistically.',
  },
  {
    id: 'kids',
    title: 'Families & seniors',
    body: 'Better for older children and active seniors than for stroller-heavy groups.',
    moreDetails: 'For seniors, the easier Seongsan side usually keeps the day more enjoyable.',
  },
  {
    id: 'restrooms',
    title: 'Restroom & break rhythm',
    body: 'Restrooms are available at the main sites.',
    moreDetails: 'The route is paced so the group is not left too long without a facility stop.',
  },
  {
    id: 'weather',
    title: 'Weather, closures & route handling',
    body: 'The route runs in most conditions, but strong wind, sea conditions, and public-site closures can affect how the day is operated.',
    moreDetails:
      'Stone Park closes Mondays. Seongsan closes on the first Monday of each month. Seongsan-area haenyeo activity should be treated as weather-dependent.',
  },
];

const WHY_ORDER_FALLBACK = `Why start at Stone Park?
Because the route is stronger when Jeju is explained before guests start comparing scenic stops.

Why Micheongul next?
It continues the geology story underground while the route is still in its explanation-heavy phase.

Why Seongeup after the cave?
It changes the texture from volcanic formation to real village life without jumping to the coast too early.

Where does lunch fit?
Operationally, lunch usually works best between Seongeup and Seongsan so the group reaches the main walking-choice stop with better energy.

Why Seongsan before Seopjikoji?
Because Seongsan is the more decision-heavy stop and Seopjikoji works better as the final coastal stretch afterward.

Why might the sequence flex?
Weather, closure days, road conditions, and group walking pace may require limited adjustment.`;

const SEASONAL_BLOCKS_SYNC: SmallGroupDetailContent['seasonalBlocks'] = [
  {
    id: 'spring',
    label: 'Spring',
    body: 'One of the easiest seasons for this route because both the morning grounds and the exposed coast are comfortable to walk.',
  },
  {
    id: 'summer',
    label: 'Summer',
    body: 'The cave becomes especially useful in the heat, while the coast needs stronger sun and wind preparation.',
  },
  {
    id: 'fall',
    label: 'Fall',
    body: 'Often the cleanest season for crater structure, longer coastal visibility, and comfortable walking.',
  },
  {
    id: 'winter',
    label: 'Winter',
    body: 'Still a strong route visually, but Seongsan and Seopjikoji feel much harsher when wind is up.',
  },
  {
    id: 'rainy',
    label: 'Rainy day',
    body: 'The museum, cave, and village help the route stay usable, but the two final coast stops may shorten.',
  },
  {
    id: 'windy',
    label: 'Windy day',
    body: 'Seongsan route choice and Seopjikoji length are the first things that should be adjusted.',
  },
  {
    id: 'peak',
    label: 'Peak season',
    body: 'This route performs best when stop lengths are handled carefully rather than trying to force every corner.',
  },
];
