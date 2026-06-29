-- Klook onboarding prep — activate exactly the 12 Klook SKUs, deactivate the rest.
--
-- Source-of-truth note: this is the DB half of the change. The repo half lives in
-- lib/tour-consumer-visibility.ts (CONSUMER_BLOCKED_TOUR_SLUGS) + the matcher
-- fetch-tours blocklist filter, which hide the deactivated tours from the chatbot
-- catalog, home, sitemap, agent channel, and the matcher.
--
-- Reversible: re-run with is_active/is_published flipped back to true to restore.
-- Applied to AtoC Supabase (cghyvbwmijqpahnoduyv) via MCP on 2026-06-29.

-- The 12 tours that stay live for Klook onboarding.
-- pocheon-sanjeong-lake-herb-island-art-valley, jeju-grand-highlights-loop,
-- jeju-cruise-shore-excursion-small-group-tour, jeju-hydrangea-festival-tour-southwest-route,
-- jeju-hydrangea-festival-tour-east-route, busan-small-group-sightseeing-tour-cruise-passengers,
-- seoul-suburbs-private-chartered-car-10hr, seoul-private-nami-morning-calm-petite-france,
-- jeju-island-private-car-charter-tour, incheon-seoul-private-car-shore-excursion-cruise,
-- busan-private-car-charter-cruise-shore, busan-top-attractions-day-tour.

update tours
set is_active = false,
    updated_at = now()
where is_active = true
  and slug not in (
    'pocheon-sanjeong-lake-herb-island-art-valley',
    'jeju-grand-highlights-loop',
    'jeju-cruise-shore-excursion-small-group-tour',
    'jeju-hydrangea-festival-tour-southwest-route',
    'jeju-hydrangea-festival-tour-east-route',
    'busan-small-group-sightseeing-tour-cruise-passengers',
    'seoul-suburbs-private-chartered-car-10hr',
    'seoul-private-nami-morning-calm-petite-france',
    'jeju-island-private-car-charter-tour',
    'incheon-seoul-private-car-shore-excursion-cruise',
    'busan-private-car-charter-cruise-shore',
    'busan-top-attractions-day-tour'
  );

update tour_product_pages
set is_published = false
where is_published = true
  and slug not in (
    'pocheon-sanjeong-lake-herb-island-art-valley',
    'jeju-grand-highlights-loop',
    'jeju-cruise-shore-excursion-small-group-tour',
    'jeju-hydrangea-festival-tour-southwest-route',
    'jeju-hydrangea-festival-tour-east-route',
    'busan-small-group-sightseeing-tour-cruise-passengers',
    'seoul-suburbs-private-chartered-car-10hr',
    'seoul-private-nami-morning-calm-petite-france',
    'jeju-island-private-car-charter-tour',
    'incheon-seoul-private-car-shore-excursion-cruise',
    'busan-private-car-charter-cruise-shore',
    'busan-top-attractions-day-tour'
  );
