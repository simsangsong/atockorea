begin;

-- Keep the admin-v2 media source aligned with the bundled premium-v1
-- catalogue release. Detail-page hero media is intentionally unchanged.
update public.tour_product_pages
set
  thumbnail_url = '/images/tours/catalog-thumbnails/' || slug || '-premium-v1.webp',
  updated_at = now()
where slug in (
  'jeju-grand-highlights-loop',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-small-group-sightseeing-tour-cruise-passengers',
  'busan-top-attractions-day-tour',
  'southwest-hallasan-osulloc-aewol',
  'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip',
  'seoul-seoraksan-nami-island-morning-calm-day-tour',
  'seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour',
  'busan-cruise-shore-excursion-bus-tour',
  'busan-private-car-charter-cruise-shore',
  'incheon-seoul-private-car-shore-excursion-cruise',
  'busan-small-group-yonggungsa-skycapsule-gamcheon-tour',
  'busan-private-car-charter-city-tour',
  'jeju-island-private-car-charter-tour',
  'seoul-suburbs-private-chartered-car-10hr',
  'from-busan-gyeongju-ancient-capital-day-tour',
  'jeju-eastern-unesco-spots-day-tour',
  'jeju-southern-top-unesco-spots-tour',
  'seoul-suwon-hwaseong-folk-village-starfield-library',
  'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library',
  'seoul-suwon-hwaseong-waujeongsa-starfield'
);

update public.tours
set
  image_url = '/images/tours/catalog-thumbnails/' || slug || '-premium-v1.webp',
  updated_at = now()
where slug in (
  'jeju-grand-highlights-loop',
  'jeju-cruise-shore-excursion-small-group-tour',
  'busan-small-group-sightseeing-tour-cruise-passengers',
  'busan-top-attractions-day-tour',
  'southwest-hallasan-osulloc-aewol',
  'seoul-seoraksan-naksansa-temple-naksan-beach-day-trip',
  'seoul-seoraksan-nami-island-morning-calm-day-tour',
  'seoul-winter-seoraksan-nami-eobi-ice-valley-day-tour',
  'busan-cruise-shore-excursion-bus-tour',
  'busan-private-car-charter-cruise-shore',
  'incheon-seoul-private-car-shore-excursion-cruise',
  'busan-small-group-yonggungsa-skycapsule-gamcheon-tour',
  'busan-private-car-charter-city-tour',
  'jeju-island-private-car-charter-tour',
  'seoul-suburbs-private-chartered-car-10hr',
  'from-busan-gyeongju-ancient-capital-day-tour',
  'jeju-eastern-unesco-spots-day-tour',
  'jeju-southern-top-unesco-spots-tour',
  'seoul-suwon-hwaseong-folk-village-starfield-library',
  'seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library',
  'seoul-suwon-hwaseong-waujeongsa-starfield'
);

commit;
