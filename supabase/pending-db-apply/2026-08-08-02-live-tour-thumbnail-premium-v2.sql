begin;

-- Publish the editorial premium-v2 catalogue thumbnails. Detail-page hero
-- media remains unchanged; only list/card imagery is updated here.
update public.tour_product_pages
set
  thumbnail_url = '/images/tours/catalog-thumbnails/' || slug || '-premium-v2.webp',
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
  image_url = '/images/tours/catalog-thumbnails/' || slug || '-premium-v2.webp',
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
