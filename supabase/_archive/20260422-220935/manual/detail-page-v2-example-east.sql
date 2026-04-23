-- Example: align v0 "route shape" strip with DB marketing itinerary (after migration 20260411120000_tours_detail_page_v2).
-- Expand `content` with partial hero / routeStops / quickSnapshot JSON as needed — see `lib/tour-detail/v2/detail-page-v2.ts` merge keys.

UPDATE tours
SET detail_page_v2 = '{
  "version": 1,
  "templateShell": {
    "routeShape": {
      "title": "How this day moves",
      "subtitle": "Culture and stone first, then the iconic East coast — approx. 8 hours.",
      "stops": [
        { "id": "01", "name": "Stone Park", "theme": "Geology" },
        { "id": "02", "name": "Seongeup", "theme": "Village" },
        { "id": "03", "name": "Lunch", "theme": "Reset" },
        { "id": "04", "name": "Seopjikoji", "theme": "Coast" },
        { "id": "05", "name": "Seongsan", "theme": "Crater" },
        { "id": "06", "name": "Hamdeok", "theme": "Beach" }
      ],
      "phases": [
        { "label": "Morning", "range": "1-2", "theme": "Stone & village", "bgClass": "bg-sky-50/70", "textClass": "text-sky-700", "dotClass": "bg-sky-500" },
        { "label": "Midday", "range": "3-4", "theme": "Lunch & coast", "bgClass": "bg-amber-50/70", "textClass": "text-amber-700", "dotClass": "bg-amber-500" },
        { "label": "Finish", "range": "5-6", "theme": "Crater & beach", "bgClass": "bg-emerald-50/70", "textClass": "text-emerald-700", "dotClass": "bg-emerald-500" }
      ]
    }
  }
}'::jsonb,
    updated_at = NOW()
WHERE slug = 'east-signature-nature-core';
