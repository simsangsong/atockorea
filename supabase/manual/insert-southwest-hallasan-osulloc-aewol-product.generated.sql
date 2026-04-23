-- =============================================================================
-- southwest-hallasan-osulloc-aewol — small-group tour product (tour_product v2)
-- =============================================================================
-- Generated: 2026-04-22T14:08:15.831Z
-- Script: scripts/gen-tour-product-sql.mjs
-- Locales emitted: en
-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);
--            tour_product_offers inserted only when no default offer exists;
--            tour_matching_profiles ON CONFLICT (product_id)
-- Web: /tour-product/southwest-hallasan-osulloc-aewol
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) tours — booking + /tour/[id] checkout
-- ---------------------------------------------------------------------------
INSERT INTO public.tours (
  title, slug, city, tag, subtitle, description, highlight,
  price, original_price, price_currency, price_type, image_url, gallery_images,
  duration, difficulty, group_size, lunch_included, ticket_included,
  pickup_info, notes, badges, highlights, includes, excludes,
  schedule, itinerary_details, faqs,
  rating, review_count, pickup_points_count, dropoff_points_count,
  is_active, is_featured, translations, seo_title, meta_description
) VALUES (
  'Jeju Southwest Small Group Tour: Hallasan, O’Sulloc & Aewol',
  'southwest-hallasan-osulloc-aewol',
  'Jeju',
  'Small group · Jeju Southwest',
  'A short Hallasan walk, volcanic cliffs, a waterfall trail, tea fields, and a relaxed Aewol finish.',
  'A well-balanced Jeju southwest route linking a short Hallasan walk, volcanic coastline, Cheonjeyeon Waterfall, O’Sulloc tea fields, and Aewol Cafe Street.',
  'A short Hallasan walk, volcanic cliffs, a waterfall trail, tea fields, and a relaxed Aewol finish.',
  58.00,
  NULL,
  'USD',
  'person',
  'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80',
  '["https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80","https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80","https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80"]'::jsonb,
  '8 hours',
  'Moderate',
  'Small group',
  FALSE,
  FALSE,
  'Pickup confirmed after booking.',
  'Weather and operational conditions may shift the stop order or duration.',
  '["Great for First-Time Jeju Visitors","Jeju Southwest"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"time":"09:00","title":"Hallasan Eoseungsaengak","description":"Short Hallasan Trail"},{"time":"10:50","title":"Daepo Jusangjeolli Cliff","description":"Basalt Coastline"},{"time":"11:50","title":"Lunch","description":"Midday Reset"},{"time":"13:00","title":"Cheonjeyeon Waterfall","description":"Waterfall and Forest Walk"},{"time":"14:20","title":"O’Sulloc Tea Museum","description":"Tea Fields and Culture Stop"},{"time":"15:50","title":"Aewol Cafe Street","description":"Seaside Cafe Finale"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  4.8,
  127,
  2,
  0,
  TRUE,
  FALSE,
  '{}'::jsonb,
  'Jeju Southwest Small Group Tour: Hallasan, Jusangjeolli, O’Sulloc & Aewol | AtoC Korea',
  'A balanced Jeju southwest small group day tour linking a short Hallasan walk, Daepo Jusangjeolli Cliff, Cheonjeyeon Waterfall, O’Sulloc Tea Museum, and Aewol Cafe Street.'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  city = EXCLUDED.city,
  tag = EXCLUDED.tag,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  highlight = EXCLUDED.highlight,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  price_currency = EXCLUDED.price_currency,
  price_type = EXCLUDED.price_type,
  image_url = EXCLUDED.image_url,
  gallery_images = EXCLUDED.gallery_images,
  duration = EXCLUDED.duration,
  difficulty = EXCLUDED.difficulty,
  group_size = EXCLUDED.group_size,
  lunch_included = EXCLUDED.lunch_included,
  ticket_included = EXCLUDED.ticket_included,
  pickup_info = EXCLUDED.pickup_info,
  notes = EXCLUDED.notes,
  badges = EXCLUDED.badges,
  highlights = EXCLUDED.highlights,
  includes = EXCLUDED.includes,
  excludes = EXCLUDED.excludes,
  schedule = EXCLUDED.schedule,
  itinerary_details = EXCLUDED.itinerary_details,
  faqs = EXCLUDED.faqs,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  pickup_points_count = EXCLUDED.pickup_points_count,
  dropoff_points_count = EXCLUDED.dropoff_points_count,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured,
  translations = EXCLUDED.translations,
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2) tour_product_pages — marketing detail + detail_payload (view-model)
-- ---------------------------------------------------------------------------
INSERT INTO public.tour_product_pages (
  slug, locale, product_id, is_published, sort_order, tour_id,
  title, subtitle, region_label, duration_label, stops_count,
  rating_avg, review_count, badges, hero_image_url, thumbnail_url,
  card_short_description, seo_title, meta_description,
  headline_line_1, headline_line_2,
  price_amount_label, price_currency, price_per, detail_payload
) VALUES (
  'southwest-hallasan-osulloc-aewol',
  'en',
  'southwest-hallasan-osulloc-aewol',
  TRUE,
  1,
  (SELECT id FROM public.tours WHERE slug = 'southwest-hallasan-osulloc-aewol' LIMIT 1),
  'Jeju Southwest Small Group Tour: Hallasan, O’Sulloc & Aewol',
  'A short Hallasan walk, volcanic cliffs, a waterfall trail, tea fields, and a relaxed Aewol finish.',
  'Jeju Southwest',
  '8 hours',
  6,
  4.8,
  127,
  ARRAY['Great for First-Time Jeju Visitors', 'Jeju Southwest']::text[],
  'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80',
  'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=600&q=80',
  'A well-balanced Jeju southwest route linking a short Hallasan walk, volcanic coastline, Cheonjeyeon Waterfall, O’Sulloc tea fields, and Aewol Cafe Street.',
  'Jeju Southwest Small Group Tour: Hallasan, Jusangjeolli, O’Sulloc & Aewol | AtoC Korea',
  'A balanced Jeju southwest small group day tour linking a short Hallasan walk, Daepo Jusangjeolli Cliff, Cheonjeyeon Waterfall, O’Sulloc Tea Museum, and Aewol Cafe Street.',
  'Jeju Southwest: Hallasan, Tea Fields, and Aewol',
  'Small Group Day Tour',
  '58',
  'USD',
  'person',
  '{"document_kind":"tour_product_full_page_v1","schema_version":1,"slug":"southwest-hallasan-osulloc-aewol","locale":"en","product_id":"southwest-hallasan-osulloc-aewol","seo":{"pageTitle":"Jeju Southwest Small Group Tour: Hallasan, Jusangjeolli, O’Sulloc & Aewol | AtoC Korea","metaDescription":"A balanced Jeju southwest small group day tour linking a short Hallasan walk, Daepo Jusangjeolli Cliff, Cheonjeyeon Waterfall, O’Sulloc Tea Museum, and Aewol Cafe Street."},"catalog_card":{"slug":"southwest-hallasan-osulloc-aewol","title":"Jeju Southwest Small Group Tour: Hallasan, O’Sulloc & Aewol","subtitle":"A short Hallasan walk, volcanic cliffs, a waterfall trail, tea fields, and a relaxed Aewol finish.","region":"Jeju Southwest","duration":"8 hours","stopsCount":6,"rating":4.8,"reviewCount":127,"badges":["Great for First-Time Jeju Visitors","Jeju Southwest"],"heroImage":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80","thumbnail":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=600&q=80","priceLabel":"From US$58 per person","shortCardDescription":"A well-balanced Jeju southwest route linking a short Hallasan walk, volcanic coastline, Cheonjeyeon Waterfall, O’Sulloc tea fields, and Aewol Cafe Street."},"headlineLine1":"Jeju Southwest: Hallasan, Tea Fields, and Aewol","headlineLine2":"Small Group Day Tour","price":{"amountLabel":"58","currency":"USD","per":"person"},"hero":{"imageUrl":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80","imagePosition":"center 35%","tagline":"A short Hallasan walk, volcanic cliffs, a waterfall trail, tea fields, and a relaxed Aewol finish.","pills":["Great for First-Time Jeju Visitors","Jeju Southwest"],"meta":{"duration":"8 hours","region":"Jeju Southwest","stops":"6 stops","rating":4.8,"ratingStars":5}},"subnavItems":[{"id":"overview","label":"Overview"},{"id":"itinerary","label":"Itinerary"},{"id":"details","label":"Details"},{"id":"faq","label":"FAQ"},{"id":"reviews","label":"Reviews"}],"glanceItems":[{"icon":"camera","label":"Photo Potential","value":"High"},{"icon":"mountain","label":"Scenery Density","value":"High"},{"icon":"footprints","label":"Walking Difficulty","value":"Moderate"},{"icon":"cloud-rain","label":"Rain Suitability","value":"Moderate"},{"icon":"users","label":"Family Suitability","value":"Good"},{"icon":"scale","label":"Pace","value":"Balanced"}],"galleryItems":[{"id":1,"type":"video","src":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80","location":"Overall Route","atmosphere":"A full-day view of how the route flows","alt":"Overall atmosphere of the Jeju southwest route"},{"id":2,"type":"photo","src":"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","location":"Hallasan Opening Stop","atmosphere":"Fresh mountain air","alt":"Hallasan Eoseungsaengak trail"},{"id":3,"type":"photo","src":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","location":"Volcanic Coastline","atmosphere":"A powerful basalt shoreline","alt":"Basalt sea cliffs at Daepo Jusangjeolli"},{"id":4,"type":"photo","src":"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","location":"Forest Trail and Waterfall","atmosphere":"A cooler, calmer middle section","alt":"Forest trail at Cheonjeyeon Waterfall"},{"id":5,"type":"photo","src":"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80","location":"Tea Fields Break","atmosphere":"Open green scenery with a softer mood","alt":"Atmosphere around O’Sulloc Tea Museum and the tea fields"},{"id":6,"type":"video","src":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80","location":"Aewol Coastal Finale","atmosphere":"A relaxed close to the day","alt":"Aewol Cafe Street on the coast"}],"itineraryStops":[{"number":1,"time":"09:00","duration":"70 min","name":"Hallasan Eoseungsaengak","category":"Short Hallasan Trail","description":"The day starts at Hallasan while the air is at its freshest and the group still has full energy. Eoseungsaengak is one of the more approachable Hallasan walks, giving you a real sense of starting the day in Jeju’s mountains without turning the tour into a full-scale hike.","image":"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","highlights":["A short Hallasan walk that still feels rewarding","Open views toward Jeju City, oreum scenery, and Hallasan’s upper slopes","A much more immersive opening than a simple roadside viewpoint","A good balance of activity and accessibility for mixed-age groups"],"timeUsed":["Short trail briefing and pace check on arrival","Main uphill segment toward the viewpoint","Brief summit-area break, photos, and descent"],"whyOnRoute":"It uses the group’s early energy well and gives the full day a clear story arc from mountain to coast.","visitBasics":{"hours":"From 05:00, with seasonal restrictions possible","closed":"May be restricted in certain weather conditions","admission":"Free","walking":"Short route, but with many stairs and a moderate overall feel"},"convenience":{"restroom":"At the Eorimok entrance area","parking":"Parking available"},"smartNotes":{"photo":"Once you reach the higher lookout section, wide landscape shots usually work better than close portraits.","facilities":"Facilities are much better at the entrance than along the trail itself.","tip":"This stop works best as a focused scenic walk rather than a slow, lingering stroll."}},{"number":2,"time":"10:50","duration":"40 min","name":"Daepo Jusangjeolli Cliff","category":"Basalt Coastline","description":"After starting at Hallasan, the view opens sharply to the sea. Daepo Jusangjeolli is a dramatic basalt cliff where volcanic rock meets the waves, and it delivers the day’s first major coastal highlight.","image":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","highlights":["Jeju’s signature hexagonal basalt columns","A stronger coastal contrast because it follows the mountain section","A short stop with very high scenery payoff","A natural continuation of Jeju’s volcanic geology story after Hallasan"],"timeUsed":["Brief entrance-side introduction","Walk along the main route to the coastal viewpoint","Photo stop and regroup"],"whyOnRoute":"It keeps Jeju’s mountain-to-coast volcanic story flowing without interruption.","visitBasics":{"hours":"09:00–18:00 (last entry 17:40)","closed":"Open year-round","admission":"KRW 2,000 adults / KRW 1,000 children and teens","walking":"Easy"},"convenience":{"restroom":"Entrance area","parking":"Paid parking lot"},"smartNotes":{"photo":"A slight side angle usually captures the texture of the basalt and wave energy better than a straight-on shot.","facilities":"Facilities are simple, but the entrance area is practical and sufficient.","tip":"Because wind and sea mist can change the feel of the stop quickly, it works best with a steady pace."}},{"number":3,"time":"11:50","duration":"60 min","name":"Lunch","category":"Midday Reset","description":"Lunch acts as the reset point between the more dramatic south-coast scenery of the morning and the softer tea-field-and-cafe tone of the afternoon. After the early walking sections, it helps the second half feel noticeably more comfortable.","image":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80","highlights":["A natural reset after Hallasan and Jusangjeolli","Good pace control for groups with a wide age range","Makes the shift into the waterfall and tea-field section smoother","Helps the Aewol finale feel relaxed rather than rushed"],"timeUsed":["Arrival and seating","Meal and short break","Prepare to move on to the next stop"],"whyOnRoute":"Placing lunch here keeps the full day feeling balanced rather than front-loaded.","visitBasics":{"hours":"Depends on the restaurant","closed":"Varies by venue","admission":"May be included depending on the product condition, or paid on site","walking":"Minimal"},"convenience":{"restroom":"Inside the restaurant","parking":"Parking available"},"smartNotes":{"photo":"If you want some lifestyle-style gallery shots, food photos work especially well here.","facilities":"Dining facilities are more than sufficient.","tip":"A calmer lunch usually improves the second half of the day more than saving a few extra minutes."}},{"number":4,"time":"13:00","duration":"50 min","name":"Cheonjeyeon Waterfall","category":"Waterfall and Forest Walk","description":"After the open coastline, Cheonjeyeon adds a cooler, greener layer to the route. Bridges, forest paths, and waterfall viewpoints create a softer change of tone before the route continues toward the tea fields and Aewol.","image":"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","highlights":["A shaded and calmer waterfall stop","A change in rhythm created by bridges and forest paths","Feels especially refreshing after the more open coastal section","A strong contrast point before the tea-field and cafe stretch"],"timeUsed":["Short explanation of the walking route at the entrance","Main walk through the waterfall area","Viewpoint stop, photos, and return"],"whyOnRoute":"It softens the overall tone after Jusangjeolli and prepares the route for a quieter second half.","visitBasics":{"hours":"09:00–17:50 (last entry 17:10)","closed":"Open year-round","admission":"KRW 2,500 adults / KRW 1,350 teens and children","walking":"Moderate, with stairs and sometimes wet sections"},"convenience":{"restroom":"Entrance area","parking":"Parking available"},"smartNotes":{"photo":"Instead of forcing everything into one frame, layered compositions with the bridge and waterfall usually look better.","facilities":"Basic facilities are concentrated near the entrance.","tip":"Because of stairs and potentially slippery sections, a steady pace usually makes this stop more enjoyable."}},{"number":5,"time":"14:20","duration":"60 min","name":"O’Sulloc Tea Museum","category":"Tea Fields and Culture Stop","description":"After the waterfall walk, O’Sulloc gives the route a clear emotional reset. The tea museum, shop, and wide green tea fields help the afternoon open up before the day finishes along the coast in Aewol.","image":"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80","highlights":["Jeju tea fields in a broad, open setting","A tea-culture stop that feels especially light after the forest section","Plenty of photo opportunities across the green rows, modern buildings, and desserts","A softer emotional transition before the Aewol finale"],"timeUsed":["Short orientation around the museum area","Tea-field views, museum or shop browsing, and cafe time","Regroup before departing for Aewol"],"whyOnRoute":"It lowers the day’s physical intensity after the more active morning and hands the final stretch over in a gentler mood.","visitBasics":{"hours":"Usually 09:00–18:00, with possible seasonal variation","closed":"Open year-round","admission":"Free","walking":"Easy"},"convenience":{"restroom":"Museum and cafe area","parking":"Parking available"},"smartNotes":{"photo":"Wide tea-field views and side angles near the cafe usually photograph better than product-style close-ups alone.","facilities":"With restrooms, drinks, and places to sit, this is one of the most comfortable stops in the second half of the day.","tip":"It usually feels more satisfying to enjoy both the scenery and the cafe atmosphere rather than rushing through the museum only."}},{"number":6,"time":"15:50","duration":"60 min","name":"Aewol Cafe Street","category":"Seaside Cafe Finale","description":"Aewol closes the day on a lighter, more relaxed note. After mountain air, basalt cliffs, a waterfall walk, and tea fields, the sea view, cafe terraces, and easy coastal rhythm fit the final stop especially well.","image":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80","highlights":["A coastal cafe atmosphere that fits the end of the day perfectly","A softer, lifestyle-oriented finish around the Handam coast area","Free time for coffee, photos, and a short seaside walk","A comfortable contrast to the more active tone of the morning"],"timeUsed":["Short orientation around the area on arrival","Free time for coffee or a short coastal walk","Regroup before departure"],"whyOnRoute":"Aewol is one of the best places to close the day emotionally. It opens up the rhythm at the end and leaves the route feeling lighter rather than heavier.","visitBasics":{"hours":"The area itself is open all day; each cafe has its own hours","closed":"No closure day for the area as a whole","admission":"Free","walking":"Easy"},"convenience":{"restroom":"Depends on the cafe you use","parking":"Parking available in the area"},"smartNotes":{"photo":"Later-afternoon backlight and sea-facing terraces usually create the best images here.","facilities":"Comfort depends on which cafe is chosen, so flexible operation works better than fixing one venue too rigidly.","tip":"This stop usually scores higher when guests are allowed a freer rhythm rather than being guided too tightly."}}],"routeFlowStops":[{"id":"01","name":"Eoseungsaengak","theme":"Hallasan"},{"id":"02","name":"Jusangjeolli","theme":"Coast"},{"id":"03","name":"Lunch","theme":"Reset"},{"id":"04","name":"Cheonjeyeon","theme":"Waterfall"},{"id":"05","name":"O’Sulloc","theme":"Tea Fields"},{"id":"06","name":"Aewol","theme":"Coast"}],"routePhases":[{"label":"Morning","range":"1-2","theme":"From Hallasan to the Coast","bgClass":"bg-sky-50/70","textClass":"text-sky-700","dotClass":"bg-sky-500"},{"label":"Midday to Early Afternoon","range":"3-4","theme":"Lunch and Waterfall","bgClass":"bg-amber-50/70","textClass":"text-amber-700","dotClass":"bg-amber-500"},{"label":"Finale","range":"5-6","theme":"Tea Fields and Aewol","bgClass":"bg-emerald-50/70","textClass":"text-emerald-700","dotClass":"bg-emerald-500"}],"routeShapeIntro":{"title":"How this route flows","subtitle":"From Hallasan and volcanic coastline to lunch, waterfall, tea fields, and an Aewol coastal finish. Roughly 09:00 to 17:30."},"whyTourWorks":{"bestFor":["First-time Jeju travelers and couples","Adult family trips","Travelers who want nature, tea fields, and a softer finish","Active middle-aged and older travelers"],"lessIdeal":["Travelers who want to avoid even short stair sections or uphill walks","Groups relying heavily on strollers","Itineraries built around very young children"],"routeLogicSections":[{"title":"Pace and structure","icon":"sun","iconBg":"bg-amber-50/80","iconColor":"text-amber-600","items":[{"label":"Start with Hallasan while energy is highest","detail":"Putting Eoseungsaengak first makes the short climb feel easier and lets the route flow naturally into the coastal section."},{"label":"Lunch sits in the right position","detail":"Lunch resets the day between the more open and dramatic morning stops and the calmer waterfall-and-tea-field section that follows."},{"label":"A lighter finish after O’Sulloc","detail":"Once the tea fields soften the mood, Aewol opens the final stretch naturally with coffee, sea views, and an easier rhythm."}]},{"title":"How the route is designed","icon":"mountain","iconBg":"bg-sky-50/80","iconColor":"text-sky-600","items":[{"label":"Mountain first, sea second","detail":"The route creates altitude and texture at Hallasan first, then lets the view open dramatically to the coast at Jusangjeolli."},{"label":"Waterfall before tea fields","detail":"Cheonjeyeon settles the route down before O’Sulloc opens the second half in a lighter and gentler way."},{"label":"A cafe coast at the end","detail":"Aewol is not placed as another hard sightseeing stop, but as a lifestyle-oriented coastal finish that closes the day softly."}]},{"title":"When conditions change","icon":"wind","iconBg":"bg-slate-50/80","iconColor":"text-slate-600","items":[{"label":"Hallasan weather variables","detail":"Eoseungsaengak can be affected by sudden weather changes or trail access restrictions."},{"label":"Wind on the coast","detail":"Jusangjeolli and Aewol are much more directly exposed to wind than inland stops."},{"label":"Balanced overall walking load","detail":"The route is generally manageable, but Eoseungsaengak and Cheonjeyeon still require attention for stairs and short uphill segments."}]}]},"practicalAccordionItems":[{"id":"pickup","title":"Pickup and Return","preview":"Hotel-lobby pickup in the Jeju City area","content":["Pickup at your hotel lobby between 08:20 and 08:50","Return is expected around 17:50–18:20","Airport pickup may be possible on request","Your exact pickup time is confirmed the night before"]},{"id":"walking","title":"Walking and Terrain","preview":"Moderate overall, and manageable for most guests","content":["Total walking is usually around 4.5–5.5 km across the day.","Eoseungsaengak: short uphill route, but with many stairs.","Jusangjeolli: an easy coastal walking path.","Cheonjeyeon: forest path, stairs, and occasionally wet sections.","O’Sulloc and Aewol: comfortable stops where the pace is easier to manage.","Walking shoes with good grip are recommended."]},{"id":"weather","title":"Weather and Closure Adjustments","preview":"The tour usually runs, with changes if needed","content":["Light rain: the tour usually runs as planned.","Heavy rain or trail restrictions: the Eoseungsaengak section may be shortened or adjusted.","Strong wind: stays at Jusangjeolli or Aewol may become shorter.","Late-day weather deterioration: O’Sulloc may carry a larger share of the afternoon.","If a stop closes: an alternative stop may be used."]},{"id":"wear","title":"What to Wear and Bring","preview":"Good shoes, layers, and a light jacket","content":["Shoes with good grip","Layered clothing for mountain and coastal temperature differences","A light windbreaker","Hat and sunscreen","Water bottle"]},{"id":"included","title":"What’s Included / Not Included","preview":"Guide, vehicle, pickup, and admission included","variant":"included","content":["English-speaking guide","Small-group vehicle","Jeju City area hotel pickup and drop-off","All admission tickets","Bottled water","Lunch (pay on site)","Personal shopping expenses","Guide gratuities"]}],"practicalWeatherStatic":{"today":{"temp":"—","label":"Live weather integration"},"tomorrow":{"temp":"—","label":"Updated daily"}},"seasonalVariations":[{"name":"Spring","icon":"flower","description":"A season when rapeseed blooms can add yellow color to parts of the coast.","tag":"Flower season","bgClass":"bg-spring","iconColor":"text-pink-500"},{"name":"Summer","icon":"sun","description":"Days are long, and the greens across the route feel especially deep and vivid.","tag":"Longest daylight","bgClass":"bg-summer","iconColor":"text-sky-500"},{"name":"Autumn","icon":"leaf","description":"Clear skies often make the route’s mountain, coast, and tea-field layers feel especially sharp.","tag":"Best visibility","bgClass":"bg-autumn","iconColor":"text-amber-600"},{"name":"Winter","icon":"snow","description":"The route usually feels quieter, with shorter daylight and a calmer overall mood.","tag":"Quiet atmosphere","bgClass":"bg-winter","iconColor":"text-slate-500"}],"bookingTrustItems":[{"icon":"check-circle","title":"Licensed local operation","description":"Legally operated guiding in Jeju","iconBg":"bg-emerald-50/80","iconColor":"text-emerald-600"},{"icon":"route","title":"Built around Jeju Southwest","description":"Designed specifically for the southwest route","iconBg":"bg-sky-50/80","iconColor":"text-sky-600"},{"icon":"users","title":"Operates in a small group","description":"Up to 8 guests","iconBg":"bg-amber-50/80","iconColor":"text-amber-600"}],"bookingSupportSteps":[{"timing":"Right after booking","title":"Instant confirmation","detail":"You receive a booking confirmation with a summary of the day."},{"timing":"12 hours before","title":"12-hour reminder","detail":"Weather notes and route adjustments are shared in advance."},{"timing":"The night before","title":"Final pickup notice","detail":"Your exact pickup time and driver contact details are shared."},{"timing":"Morning of the tour","title":"Day-of route note","detail":"A short morning briefing is given based on live on-site conditions."},{"timing":"During the tour","title":"Live stop-by-stop guidance","detail":"You receive the information you need at each stop."},{"timing":"After the tour","title":"Post-tour support","detail":"Additional guidance and recommendations can be shared afterward."}],"staticQuestions":[{"id":"first-time","question":"Is this a good choice for first-time Jeju travelers?","answer":"Yes. It gives you a balanced one-day experience of Hallasan scenery, volcanic coastline, a waterfall walk, tea-field atmosphere, and a relaxed Aewol finish."},{"id":"walking","question":"Is the walking level difficult?","answer":"Not especially. Eoseungsaengak is the most active section and includes many stairs, but the rest of the day is generally manageable."},{"id":"rain","question":"Does the tour run in rainy weather?","answer":"Yes. The route can still run in rain, though Eoseungsaengak or the more exposed coastal sections may be shortened depending on conditions."},{"id":"parents","question":"Is it suitable for traveling with parents or older family members?","answer":"Yes, in many cases. It works well for adult family trips, especially when everyone is comfortable with stairs and short uphill sections."},{"id":"children","question":"Can I join with children?","answer":"Yes. It is especially suitable for children around age 8 and up who can keep up with short walks and the rhythm of a full-day tour."},{"id":"order","question":"Can the stop order change depending on on-site conditions?","answer":"Yes. Mountain weather, coastal wind, traffic, and visitor flow can all lead to small changes in the order, especially around Eoseungsaengak and the coast."},{"id":"lunch","question":"Is lunch included?","answer":"That depends on the product condition. Lunch time is built into the route, but whether the meal itself is included follows your booked plan."},{"id":"why-eoseungsaengak","question":"Why does the route start at Eoseungsaengak?","answer":"Because it opens the day with a real Hallasan feel while the group still has the most energy, without turning the route into a heavy hiking itinerary."},{"id":"why-jusangjeolli","question":"Why do you go to Jusangjeolli after Hallasan?","answer":"Because it lets Jeju’s volcanic story unfold naturally from mountain terrain into a dramatic basalt coastline."},{"id":"why-osulloc","question":"Why does O’Sulloc come before Aewol?","answer":"Because O’Sulloc softens the mood after the waterfall section, which makes Aewol feel even more relaxed and comfortable as the final stop."},{"id":"later-structure","question":"Why is the second half structured this way?","answer":"Lunch and Cheonjeyeon settle the rhythm after the more open morning section, O’Sulloc adds a lighter tea-field break, and Aewol closes the day without making the ending feel heavy."}],"guestReviews":[],"reviewsSummary":{"averageRating":0,"totalReviews":0,"ratingDistribution":[{"stars":5,"count":0,"percentage":0},{"stars":4,"count":0,"percentage":0},{"stars":3,"count":0,"percentage":0},{"stars":2,"count":0,"percentage":0},{"stars":1,"count":0,"percentage":0}],"highlights":[]},"sticky_booking_bar":{"note":"checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.","price":{"amountLabel":"58","currency":"USD","per":"person"}},"matching_profile":{"product_type":"small_group","route_type":"fixed_route","region_type":"southwest","region_tags":["jeju_southwest","hallasan_to_aewol"],"theme_tags":["hallasan","basalt","waterfall","tea","cafe","balanced_pace","one_day"],"poi_tags":["eoseungsaengak","jusangjeolli","cheonjeyeon","osulloc","aewol"],"pace_level":3,"walking_level":3,"scenic_level":5,"photo_level":5,"culture_level":3,"relax_level":4,"first_time_fit":5,"family_fit":4,"senior_fit":3,"couple_fit":5,"active_traveler_fit":3,"one_day_fit":4,"same_day_flight_fit":2,"rain_fit":3,"value_for_money_fit":5,"iconic_landmark_fit":4,"cafe_fit":5,"adult_family_fit":4,"young_kids_fit":3,"senior_active_fit":4,"senior_general_fit":3,"mobility_friendly_fit":2,"stroller_fit":1,"indoor_ratio":38,"weather_sensitivity":3,"local_culture_fit":3,"shopping_fit":2,"storytelling_fit":4,"comfort_level":4,"budget_fit":5,"premium_fit":3,"small_group_fit":5,"private_fit":1,"bus_fit":1,"price_band":"mid","pickup_base":"jeju_city","return_time_band":"17:50-18:20","duration_band":"8h","min_recommended_age":8,"hard_constraints":{"avoidIf":["tight_same_day_departure","strict_same_day_flight_schedule","needs_zero_stairs"],"notIdealFor":["toddlers","stroller_heavy","very_low_mobility"]},"walking_notes":["Overall walking is moderate for a full-day route.","Eoseungsaengak is short, but it includes many stairs.","Cheonjeyeon includes stairs and can have wet or slippery sections.","Jusangjeolli, O’Sulloc, and Aewol are easier segments where the pace is easier to manage.","Walking shoes with good grip are recommended."],"keywords":["jeju southwest day tour","hallasan osulloc aewol","jeju tea fields and coast","eoseungsaengak","jusangjeolli","cheonjeyeon waterfall","o''sulloc tea museum","aewol cafe street","balanced jeju day tour","jeju first trip southwest","제주 서남부 투어","오설록 애월 한라산","濟州西南一日遊","漢拏山 OSULLOC 애월"],"synonym_hints":["jeju southwest highlights","hallasan tea fields aewol day tour","balanced jeju small group","nature tea and cafe coast","softer afternoon finish","relaxed southwest jeju route","mountain to coast to tea fields"],"profile_version":3,"is_active":true},"matching_metadata":{"schema_version":"tour_matching_profile.v1","last_reviewed_at":"2026-04-22","score_rationale":{"pace_level":"An 8-hour route with six stops and a deliberately softer second half, so it is balanced rather than rushed.","walking_level":"Moderate overall. The main effort comes from the Eoseungsaengak stairs and the Cheonjeyeon walking path.","scenic_level":"Strong visual layering across Hallasan, basalt coastline, waterfall forest, tea fields, and the Aewol coast.","photo_level":"Very strong for variety. The route mixes mountain views, volcanic cliffs, tea-field scenery, and cafe-coast atmosphere.","culture_level":"Nature leads the day, but O’Sulloc adds tea-culture context and the route supports stronger narrative storytelling than a simple scenic loop.","relax_level":"The afternoon becomes noticeably softer after lunch, especially through O’Sulloc and Aewol.","first_time_fit":"A very strong choice for first-time Jeju visitors who want balance rather than a full-island sprint.","family_fit/young_kids_fit/stroller_fit":"Works well for adult families and school-age children, but stairs and short uphill sections make it weak for stroller-heavy groups.","senior_fit/senior_general_fit/mobility_friendly_fit":"Reasonable for active seniors, but not a true low-mobility route because of stairs at Eoseungsaengak and Cheonjeyeon.","same_day_flight_fit":"Possible only with a generous evening buffer because return is still late afternoon to early evening.","rain_fit/indoor_ratio/weather_sensitivity":"Partly protected by lunch, O’Sulloc, and optional cafe time, but the mountain and coastal sections still react clearly to weather.","local_culture_fit/shopping_fit":"Tea-culture context is present through O’Sulloc, but this is not a shopping-led or village-culture-led route.","small_group_fit/private_fit/bus_fit":"Best operated as a small-group van route. The current structure is not designed as a private-only or large-bus product.","price_band/budget_fit/premium_fit":"At US$58, it is strong on value for money, positioned in the mid-price band rather than true premium.","hard_constraints":"Keep it conservative for very low mobility, stroller-heavy groups, and guests with tight same-day departure schedules."}}}'::jsonb
)
ON CONFLICT (slug, locale) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  is_published = EXCLUDED.is_published,
  sort_order = EXCLUDED.sort_order,
  tour_id = EXCLUDED.tour_id,
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  region_label = EXCLUDED.region_label,
  duration_label = EXCLUDED.duration_label,
  stops_count = EXCLUDED.stops_count,
  rating_avg = EXCLUDED.rating_avg,
  review_count = EXCLUDED.review_count,
  badges = EXCLUDED.badges,
  hero_image_url = EXCLUDED.hero_image_url,
  thumbnail_url = EXCLUDED.thumbnail_url,
  card_short_description = EXCLUDED.card_short_description,
  seo_title = EXCLUDED.seo_title,
  meta_description = EXCLUDED.meta_description,
  headline_line_1 = EXCLUDED.headline_line_1,
  headline_line_2 = EXCLUDED.headline_line_2,
  price_amount_label = EXCLUDED.price_amount_label,
  price_currency = EXCLUDED.price_currency,
  price_per = EXCLUDED.price_per,
  detail_payload = EXCLUDED.detail_payload,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 3) tour_product_offers — sticky bar / checkout (USD minor units)
-- ---------------------------------------------------------------------------
INSERT INTO public.tour_product_offers (
  tour_product_page_id, label, amount_minor, currency, stripe_price_id, is_active, is_default
)
SELECT
  p.id,
  'Default (seed)',
  5800,
  'USD',
  NULL,
  TRUE,
  TRUE
FROM public.tour_product_pages p
WHERE p.slug = 'southwest-hallasan-osulloc-aewol' AND p.locale = 'en'
  AND NOT EXISTS (
    SELECT 1 FROM public.tour_product_offers o
    WHERE o.tour_product_page_id = p.id AND o.is_default = TRUE AND o.is_active = TRUE
  );

-- ---------------------------------------------------------------------------
-- 4) tour_matching_profiles — recommendation / match pipeline
-- ---------------------------------------------------------------------------
INSERT INTO public.tour_matching_profiles (
  product_id, product_type, route_type, region_type,
  region_tags, theme_tags, poi_tags,
  pace_level, walking_level, scenic_level, photo_level, culture_level, relax_level,
  first_time_fit, family_fit, senior_fit, couple_fit, active_traveler_fit,
  one_day_fit, same_day_flight_fit, rain_fit, value_for_money_fit,
  iconic_landmark_fit, cafe_fit,
  adult_family_fit, young_kids_fit, senior_active_fit, senior_general_fit,
  mobility_friendly_fit, stroller_fit,
  indoor_ratio, weather_sensitivity,
  local_culture_fit, shopping_fit, storytelling_fit,
  comfort_level, budget_fit, premium_fit,
  small_group_fit, private_fit, bus_fit,
  price_band, pickup_base, return_time_band, duration_band, min_recommended_age,
  hard_constraints, walking_notes, keywords, synonym_hints,
  profile_version, is_active
)
VALUES (
  'southwest-hallasan-osulloc-aewol',
  'small_group',
  'fixed_route',
  'southwest',
  '["jeju_southwest","hallasan_to_aewol"]'::jsonb,
  '["hallasan","basalt","waterfall","tea","cafe","balanced_pace","one_day"]'::jsonb,
  '["eoseungsaengak","jusangjeolli","cheonjeyeon","osulloc","aewol"]'::jsonb,
  3,
  3,
  5,
  5,
  3,
  4,
  5,
  4,
  3,
  5,
  3,
  4,
  2,
  3,
  5,
  4,
  5,
  4,
  3,
  4,
  3,
  2,
  1,
  38,
  3,
  3,
  2,
  4,
  4,
  5,
  3,
  5,
  1,
  1,
  'mid',
  'jeju_city',
  '17:50-18:20',
  '8h',
  8,
  '{"avoidIf":["tight_same_day_departure","strict_same_day_flight_schedule","needs_zero_stairs"],"notIdealFor":["toddlers","stroller_heavy","very_low_mobility"]}'::jsonb,
  '["Overall walking is moderate for a full-day route.","Eoseungsaengak is short, but it includes many stairs.","Cheonjeyeon includes stairs and can have wet or slippery sections.","Jusangjeolli, O’Sulloc, and Aewol are easier segments where the pace is easier to manage.","Walking shoes with good grip are recommended."]'::jsonb,
  '["jeju southwest day tour","hallasan osulloc aewol","jeju tea fields and coast","eoseungsaengak","jusangjeolli","cheonjeyeon waterfall","o''sulloc tea museum","aewol cafe street","balanced jeju day tour","jeju first trip southwest","제주 서남부 투어","오설록 애월 한라산","濟州西南一日遊","漢拏山 OSULLOC 애월"]'::jsonb,
  '["jeju southwest highlights","hallasan tea fields aewol day tour","balanced jeju small group","nature tea and cafe coast","softer afternoon finish","relaxed southwest jeju route","mountain to coast to tea fields"]'::jsonb,
  3,
  TRUE
)
ON CONFLICT (product_id) DO UPDATE SET
  product_type = EXCLUDED.product_type,
  route_type = EXCLUDED.route_type,
  region_type = EXCLUDED.region_type,
  region_tags = EXCLUDED.region_tags,
  theme_tags = EXCLUDED.theme_tags,
  poi_tags = EXCLUDED.poi_tags,
  pace_level = EXCLUDED.pace_level,
  walking_level = EXCLUDED.walking_level,
  scenic_level = EXCLUDED.scenic_level,
  photo_level = EXCLUDED.photo_level,
  culture_level = EXCLUDED.culture_level,
  relax_level = EXCLUDED.relax_level,
  first_time_fit = EXCLUDED.first_time_fit,
  family_fit = EXCLUDED.family_fit,
  senior_fit = EXCLUDED.senior_fit,
  couple_fit = EXCLUDED.couple_fit,
  active_traveler_fit = EXCLUDED.active_traveler_fit,
  one_day_fit = EXCLUDED.one_day_fit,
  same_day_flight_fit = EXCLUDED.same_day_flight_fit,
  rain_fit = EXCLUDED.rain_fit,
  value_for_money_fit = EXCLUDED.value_for_money_fit,
  iconic_landmark_fit = EXCLUDED.iconic_landmark_fit,
  cafe_fit = EXCLUDED.cafe_fit,
  adult_family_fit = EXCLUDED.adult_family_fit,
  young_kids_fit = EXCLUDED.young_kids_fit,
  senior_active_fit = EXCLUDED.senior_active_fit,
  senior_general_fit = EXCLUDED.senior_general_fit,
  mobility_friendly_fit = EXCLUDED.mobility_friendly_fit,
  stroller_fit = EXCLUDED.stroller_fit,
  indoor_ratio = EXCLUDED.indoor_ratio,
  weather_sensitivity = EXCLUDED.weather_sensitivity,
  local_culture_fit = EXCLUDED.local_culture_fit,
  shopping_fit = EXCLUDED.shopping_fit,
  storytelling_fit = EXCLUDED.storytelling_fit,
  comfort_level = EXCLUDED.comfort_level,
  budget_fit = EXCLUDED.budget_fit,
  premium_fit = EXCLUDED.premium_fit,
  small_group_fit = EXCLUDED.small_group_fit,
  private_fit = EXCLUDED.private_fit,
  bus_fit = EXCLUDED.bus_fit,
  price_band = EXCLUDED.price_band,
  pickup_base = EXCLUDED.pickup_base,
  return_time_band = EXCLUDED.return_time_band,
  duration_band = EXCLUDED.duration_band,
  min_recommended_age = EXCLUDED.min_recommended_age,
  hard_constraints = EXCLUDED.hard_constraints,
  walking_notes = EXCLUDED.walking_notes,
  keywords = EXCLUDED.keywords,
  synonym_hints = EXCLUDED.synonym_hints,
  profile_version = EXCLUDED.profile_version,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMIT;

SELECT slug, title, is_active FROM public.tours WHERE slug = 'southwest-hallasan-osulloc-aewol';
SELECT slug, locale, is_published, product_id FROM public.tour_product_pages WHERE slug = 'southwest-hallasan-osulloc-aewol' ORDER BY locale;
SELECT product_id, product_type, region_type, price_band, is_active FROM public.tour_matching_profiles WHERE product_id = 'southwest-hallasan-osulloc-aewol';
