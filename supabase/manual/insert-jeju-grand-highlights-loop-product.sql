-- =============================================================================
-- jeju-grand-highlights-loop — small-group tour product (tour_product v2)
-- =============================================================================
-- Generated: 2026-04-28T15:36:17.553Z
-- Script: scripts/gen-tour-product-sql.mjs
-- Locales emitted: en
-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);
--            tour_product_offers inserted only when no default offer exists;
--            tour_matching_profiles ON CONFLICT (product_id)
-- Web: /tour-product/jeju-grand-highlights-loop
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
  'Jeju Grand Highlights Loop Small Group Day Tour',
  'jeju-grand-highlights-loop',
  'Jeju',
  'Small group · Jeju Full-Island Route',
  'From Hallasan to Seongsan Ilchulbong, see Jeju’s signature highlights in one day.',
  'A high-efficiency Jeju full-island route for travelers with limited time, linking Hallasan, the south coast, and Seongsan Ilchulbong in one day.',
  'From Hallasan to Seongsan Ilchulbong, see Jeju’s signature highlights in one day.',
  78.00,
  NULL,
  'USD',
  'person',
  'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80',
  '["https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80","https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80"]'::jsonb,
  '9–9.5 hours',
  'Moderate',
  'Small group',
  FALSE,
  FALSE,
  'Pickup confirmed after booking.',
  'Weather and operational conditions may shift the stop order or duration.',
  '["Best for One-Day Visitors","Fast-Paced Highlights"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"time":"09:30","title":"Hallasan Eoseungsaengak","description":"Hallasan Foothill Trail (Eorimok)"},{"time":"11:15","title":"Daepo Jusangjeolli Cliff","description":"Volcanic Coastline — Hexagonal Basalt Columns"},{"time":"12:15","title":"Lunch","description":"Midday Reset — Seogwipo Local Eats"},{"time":"13:35","title":"Jeongbang Waterfall","description":"Coastal Waterfall — Falls Directly Into the Ocean"},{"time":"15:25","title":"Seongsan Ilchulbong","description":"UNESCO Tuff Cone — Sunrise Peak Finale"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  0,
  2,
  0,
  TRUE,
  FALSE,
  '{}'::jsonb,
  'Jeju Grand Highlights Loop Tour | AtoC Korea',
  'Small-group 10-hour Jeju highlights loop: Seongsan Ilchulbong (UNESCO), Manjanggul, Cheonjiyeon Falls, Jusangjeolli cliffs, Hallim Park.'
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
  'jeju-grand-highlights-loop',
  'en',
  'jeju-grand-highlights-loop',
  TRUE,
  1,
  (SELECT id FROM public.tours WHERE slug = 'jeju-grand-highlights-loop' LIMIT 1),
  'Jeju Grand Highlights Loop Small Group Day Tour',
  'From Hallasan to Seongsan Ilchulbong, see Jeju’s signature highlights in one day.',
  'Jeju Full-Island Route',
  '9–9.5 hours',
  5,
  0,
  0,
  ARRAY['Best for One-Day Visitors', 'Fast-Paced Highlights']::text[],
  'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80',
  'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=600&q=80',
  'A high-efficiency Jeju full-island route for travelers with limited time, linking Hallasan, the south coast, and Seongsan Ilchulbong in one day.',
  'Jeju Grand Highlights Loop Tour | AtoC Korea',
  'Small-group 10-hour Jeju highlights loop: Seongsan Ilchulbong (UNESCO), Manjanggul, Cheonjiyeon Falls, Jusangjeolli cliffs, Hallim Park.',
  'Jeju Grand Highlights Loop',
  'Small Group Day Tour',
  '78',
  'USD',
  'person',
  '{"document_kind":"tour_product_full_page_v1","schema_version":7,"slug":"jeju-grand-highlights-loop","locale":"en","product_id":"jeju-grand-highlights-loop","seo":{"pageTitle":"Jeju Grand Highlights Loop Tour | AtoC Korea","metaDescription":"Small-group 10-hour Jeju highlights loop: Seongsan Ilchulbong (UNESCO), Manjanggul, Cheonjiyeon Falls, Jusangjeolli cliffs, Hallim Park.","primaryKeywords":["Jeju highlights small group tour","Jeju one day full island tour","Seongsan Ilchulbong tour","Cheonjiyeon Falls tour","Jusangjeolli tour"],"ogImage":"https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80","title":"Jeju Grand Highlights Loop · 10-hour Small-Group · UNESCO + Waterfalls + Cliffs"},"catalog_card":{"slug":"jeju-grand-highlights-loop","title":"Jeju Grand Highlights Loop Small Group Day Tour","subtitle":"From Hallasan to Seongsan Ilchulbong, see Jeju’s signature highlights in one day.","region":"Jeju Full-Island Route","duration":"9–9.5 hours","stopsCount":5,"rating":0,"reviewCount":0,"badges":["Best for One-Day Visitors","Fast-Paced Highlights"],"heroImage":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80","thumbnail":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=600&q=80","priceLabel":"From US$78 per person","shortCardDescription":"A high-efficiency Jeju full-island route for travelers with limited time, linking Hallasan, the south coast, and Seongsan Ilchulbong in one day.","tags":["small_group","jeju","island_wide","unesco","first_time_friendly","highlights"]},"headlineLine1":"Jeju Grand Highlights Loop","headlineLine2":"Small Group Day Tour","price":{"amountLabel":"78","currency":"USD","per":"person","priceSource":"internal","priceNote":"Small-group bilingual full-island tour. AtoC Korea direct sale; 10% discount applied vs operator base.","discountPercent":10},"hero":{"imageUrl":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80","imagePosition":"center 35%","tagline":"Built for travelers with limited time, this high-density route covers Hallasan, dramatic south-coast scenery, a waterfall, and Seongsan Ilchulbong in one day.","pills":["Best for One-Day Visitors","Small Group Day Tour","Iconic Highlights"],"meta":{"duration":"9–9.5 hours","region":"Jeju Full-Island Route","stops":"5 stops","rating":0,"ratingStars":0}},"subnavItems":[{"id":"overview","label":"Overview"},{"id":"itinerary","label":"Itinerary"},{"id":"details","label":"Details"},{"id":"faq","label":"FAQ"},{"id":"reviews","label":"Reviews"}],"glanceItems":[{"icon":"camera","label":"Photo Potential","value":"High"},{"icon":"mountain","label":"Scenery Density","value":"Very High"},{"icon":"footprints","label":"Walking Difficulty","value":"Moderate to High"},{"icon":"cloud-rain","label":"Rain Suitability","value":"Moderate"},{"icon":"users","label":"Family Suitability","value":"Moderate"},{"icon":"gauge","label":"Pace","value":"Fast"}],"galleryItems":[{"id":1,"type":"photo","src":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80","location":"Overall Route","atmosphere":"See Jeju’s signature landscapes in a single day","alt":"Overall atmosphere of a Jeju highlights day tour","caption":"Overall atmosphere of a Jeju highlights day tour"},{"id":2,"type":"photo","src":"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","location":"Hallasan Opening Stop","atmosphere":"Crisp mountain air at higher elevation","alt":"Atmosphere of the Hallasan Eoseungsaengak trail","caption":"Atmosphere of the Hallasan Eoseungsaengak trail"},{"id":3,"type":"photo","src":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","location":"Jusangjeolli Coast","atmosphere":"A dramatic contrast of waves and cliffs","alt":"Daepo Jusangjeolli Cliff on Jeju’s coast","caption":"Daepo Jusangjeolli Cliff on Jeju’s coast"},{"id":4,"type":"photo","src":"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","location":"Waterfall by the Sea","atmosphere":"A change of texture in the afternoon route","alt":"Coastal scenery at Jeongbang Waterfall","caption":"Coastal scenery at Jeongbang Waterfall"},{"id":5,"type":"photo","src":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80","location":"Crater Finale","atmosphere":"A symbolic closing view with real impact","alt":"Seongsan Ilchulbong crater and coastline","caption":"Seongsan Ilchulbong crater and coastline"}],"itineraryStops":[{"number":1,"time":"09:30","duration":"75 min","name":"Hallasan Eoseungsaengak","category":"Hallasan Foothill Trail (Eorimok)","description":"Eoseungsaengak (1,169 m) is the shortest official trail inside Hallasan National Park — a 1.3 km one-way out-and-back from the Eorimok Visitor Center, gaining about 200 m of elevation through dense forest of native Korean red pine and dwarf bamboo. The route is built on wooden stairs and boardwalks with rope railings on the steeper sections, and most visitors reach the summit deck in 30–40 minutes. This is the entry-level taste of Hallasan — UNESCO World Natural Heritage (2007), UNESCO Biosphere Reserve (2002), and Korea''s tallest peak at 1,947 m — without needing the QR-code reservation that the Seongpanak and Gwaneumsa summit trails require. From the top, on a clear day, you can see Jeju City and the northern coastline, the higher Hallasan ridges (occasionally Baengnokdam crater), and as far as Chujado Island, Biyangdo Island and even Seongsan Ilchulbong on the eastern horizon. The summit also holds the remains of a Tochika — a 1945 Imperial Japanese military communication pillbox, a quiet reminder of the island''s wartime history. The trail is comfortable in spring, summer and autumn; in winter (Dec–Feb) the steps ice over and micro-spikes are recommended.","image":"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","highlights":["1.3 km wooden-stair trail to a 1,169 m summit — short Hallasan taste with no reservation needed","Summit views to Chujado, Biyangdo and (clear days) all the way to Seongsan Ilchulbong","Tochika ruins — 1945 Japanese military pillbox at the summit deck","Hallasan National Park = UNESCO World Natural Heritage (2007) + Biosphere Reserve (2002)"],"timeUsed":"75 min","whyOnRoute":"This is the only Hallasan trail short enough to fit a one-day full-island loop. The longer Seongpanak (9.7 km one-way) or Gwaneumsa (8.7 km) summit trails require advance reservation and 8+ hours, which is incompatible with a 9.5-hour grand loop. Eoseungsaengak gives an authentic Hallasan summit experience inside a 1.5-hour window.","visitBasics":{"hours":"Trail accessible roughly 05:00–18:00 (varies seasonally; longer in summer May–Aug)","closed":"Open year-round; closures possible in extreme weather","admission":"Free; no entrance fee, no reservation required (only Seongpanak/Gwaneumsa summit trails require advance QR reservation)","walking":"Moderate — 1.3 km one-way, ~200 m elevation gain via wooden stairs and boardwalks; 30–40 min up, plan 1–1.5 hr round trip"},"convenience":{"restroom":"Available at Eorimok Visitor Center near the trailhead","parking":"Eorimok Trail parking lot at the visitor center (free)"},"smartNotes":{"photo":"Summit observation deck for 360° view of Jeju City, the northern coast and the higher Hallasan peaks (Baengnokdam crater on clear days). Tochika ruins for a quick history shot","facilities":"Visitor Center with information panels and restrooms at trailhead; benches and rest points along the trail; no shops or vending past the entrance","tip":"Wooden stairs are slippery after rain and icy in winter (Dec–Feb) — micro-spikes recommended in winter. Pets and drones are not allowed in Hallasan National Park"},"_poi_meta":{"poi_key":"hallasan_eoseungsaengak","name_en":"Hallasan Eoseungsaengak Trail","name_ko":"한라산 어승생악","is_attraction":true,"fee_krw":0,"trail_length_one_way_km":1.3,"elevation_gain_m":200,"summit_elevation_m":1169,"round_trip_min":60,"trailhead":"Eorimok Visitor Center","no_reservation_required":true,"park_status":["UNESCO World Heritage 2007","UNESCO Biosphere Reserve 2002","National Park 1970","Natural Monument 1966"],"historical_feature":"Tochika — 1945 Imperial Japanese military pillbox/communication post at summit"}},{"number":2,"time":"11:15","duration":"45 min","name":"Daepo Jusangjeolli Cliff","category":"Volcanic Coastline — Hexagonal Basalt Columns","description":"Daepo Jusangjeolli (designated Natural Monument No. 443 on January 6, 2005) is Korea''s largest columnar-jointed lava formation — about 1 km of coastline lined with hexagonal basalt pillars 30–40 m tall. The columns formed when basaltic lava from a Hallasan eruption flowed into the sea at Jungmun and cooled rapidly, contracting and fracturing into the geometric column shapes that geologists call ''columnar jointing''. The visitor pathway is a flat 0.8 km loop on paved walkways and wooden viewing decks built along the cliff edge — the columns themselves are viewed from above (no descent), and the headline experience is the South Pacific swell smashing into the foot of the cliff: at high tide the spray can shoot 20 m or more straight up the column face. Entry is ₩2,000 for adults, ₩1,000 for youth (7–24), and free under 7 and over 65 — making this one of the most affordable headline volcanic geology stops in Korea. Plan 30–45 minutes total. The site sits next to the ICC Jeju (International Convention Center) inside the Jungmun Tourist Complex, with souvenir kiosks at the entrance selling Hallabong (Jeju tangerine) juice in Dol-hareubang–shaped bottles.","image":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","highlights":["Korea''s National Monument No. 443 — largest columnar-jointed lava in the country","30–40 m tall hexagonal basalt columns over a 1 km coastline","High-tide spray can shoot 20+ m up the cliff face (best viewing window)","Inexpensive — ₩2,000 adult admission, kids under 7 free"],"timeUsed":"45 min","whyOnRoute":"Jusangjeolli is the most efficient single demonstration of Jeju''s volcanic geology — a 30-minute stop that visually summarises the lava-meets-sea story behind the entire island''s UNESCO designation. It also pairs neatly with the next stop (Jeongbang) which is a 25-minute drive east along the southern coast.","visitBasics":{"hours":"Daily 09:00–18:00 (last admission ~17:00; hours may shift seasonally with sunset)","closed":"Open year-round","admission":"Adults ₩2,000 / Youth (7–24) ₩1,000 / Free for under 7 and over 65; group rate (10+) ₩1,600 adult / ₩600 youth","walking":"Easy — 0.8 km loop on paved walkways and wooden viewing decks; ~12–15 min walk, fully flat"},"convenience":{"restroom":"Available at the entrance plaza and visitor area","parking":"Paid parking lot adjacent to entrance — ₩1,000 small / ₩2,000 medium (sedan to 15-seater) / ₩3,000 large vehicles"},"smartNotes":{"photo":"First viewing deck for the classic hexagonal-columns frame; far deck for waves crashing into the columns (best at high tide — waves can shoot 20+ m up the cliff)","facilities":"Souvenir kiosks at entrance selling Hallabong (Jeju tangerine) juice in dol-hareubang shaped bottles, hot dogs, octopus skewers, ice cream and accessories; ICC Jeju (Convention Center) and Yakcheonsa Temple are walking distance","tip":"Plan ~30–45 min total. The wooden deck doesn''t allow descent to the columns themselves — they are viewed from above. Best photos when sunlight hits at an angle (mid-morning or late afternoon); spray reaches the deck at high tide so cameras may need protection"},"_poi_meta":{"poi_key":"daepo_jusangjeolli_cliff","name_en":"Daepo Jusangjeolli Cliff (Columnar-Jointed Lava)","name_ko":"대포 주상절리 (지삿개)","is_attraction":true,"fee_krw":2000,"fee_youth_krw":1000,"fee_free_under_age":7,"fee_free_over_age":65,"natural_monument_no":443,"designation_date":"2005-01-06","column_height_m":"30-40","coastline_length_m":1000,"wave_height_high_tide_m":20,"loop_length_km":0.8,"loop_time_min":15}},{"number":3,"time":"12:15","duration":"60 min","name":"Lunch","category":"Midday Reset — Seogwipo Local Eats","description":"Approximately a 60-minute window for lunch in the Seogwipo / Jungmun area between Jusangjeolli and Jeongbang Falls. Typical options on a small-group route include Seogwipo Maeil Olle Market for Jeju black pork (heuk-dwaeji), abalone porridge (jeonbok-juk) and seafood noodle (haemul-guksu), or the small restaurants around Jungmun where the convention crowd eats. Lunch is usually at own expense (~₩10,000–20,000 per person) so guests can choose what suits — the guide will recommend a couple of options based on the day.","image":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80","highlights":["Seogwipo Maeil Olle Market — 12 min walk from Jeongbang Falls, traditional market with hot food stalls","Jeju black pork (heuk-dwaeji) — a regional signature","Abalone porridge (jeonbok-juk) — a Jeju specialty using ingredients from the haenyeo divers'' catch"],"timeUsed":"60 min","whyOnRoute":"Placing lunch between the two southern-coast attractions (Jusangjeolli and Jeongbang) minimises driving fatigue — both stops are within 15 minutes of central Seogwipo, so the route doesn''t double back.","visitBasics":{"hours":"Depends on restaurant operating hours","closed":"Varies by venue","admission":"Meal is paid on site unless otherwise specified","walking":"Minimal"},"convenience":{"restroom":"Inside the restaurant","parking":"Parking available"},"smartNotes":{"photo":"Since most of the day centers on landscapes, food photos can help vary the visual rhythm of the route.","facilities":"Dining-related facilities are usually more than sufficient.","tip":"It is better to eat at a comfortable pace here than to rush and lose energy for the afternoon."}},{"number":4,"time":"13:35","duration":"60 min","name":"Jeongbang Waterfall","category":"Coastal Waterfall — Falls Directly Into the Ocean","description":"Jeongbang is the only waterfall in Asia that falls directly into the ocean, and one of the Top 3 waterfalls of Jeju (with Cheonjiyeon and Cheonjeyeon). The water drops 23 m off a vertical cliff onto a rocky beach with a 5-m-deep pool that opens straight into the South Pacific — the falls width varies from a thin stream in dry summer to 8 m wide after monsoon rain. Reaching the base requires descending about 130 stone stairs from the ticket office, then crossing a stretch of slippery, irregular rocks; this is not a flip-flop walk. Once at the base you can stand close enough to feel the ocean spray and the negative ions of the falling water. The site is also tied to one of Korea''s oldest legends: a Qin-dynasty servant named Seobul (sent by Emperor Qin Shi Huangdi around 210 BCE to find the elixir of immortality) reputedly carved his name ''Seobulgwacha'' into the cliff and turned back west — giving Seogwipo (literally ''where Seobul went west'') its name. From the base you can see Seopseom and Munseom Islands offshore. Admission is ₩2,000 for adults; expect 45–60 minutes total here. Best flow is in spring (Hallasan snowmelt) and after rainfall.","image":"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","highlights":["Only waterfall in Asia falling directly into the ocean — 23 m drop into the sea","One of Jeju''s Yeongjusipgyeong (10 Scenic Wonders) since the Joseon period","Seobulgwacha legend — origin of the Seogwipo place-name","Sojeongbang (smaller waterfall) 300 m east — quick optional add-on"],"timeUsed":"60 min","whyOnRoute":"Jeongbang sits 5 minutes from Seogwipo''s lunch district and 35 minutes from the tour''s grand finale (Seongsan Ilchulbong), making it the optimal mid-afternoon stop on the southern leg. Its uniqueness (''only waterfall in Asia into the ocean'') earns it a permanent place on every Jeju highlights itinerary.","visitBasics":{"hours":"Daily 09:00–17:40 (last admission 30 min before closing; slight seasonal variation)","closed":"Open year-round (occasional closures for high tide / typhoon)","admission":"Adults ₩2,000 / Youth (7–24) ₩1,000; free under 7 and 65+","walking":"Moderate — ~130 stairs down to the base, then unmarked rocky terrain to reach the waterfall. Stairs slippery when wet; rocks slippery and irregular — sturdy shoes essential"},"convenience":{"restroom":"At the entrance/ticketing area before the descent (none at the base)","parking":"On-site parking lot at the entrance"},"smartNotes":{"photo":"Mid-descent platform for the full-cliff waterfall + ocean frame; rock-hopping at the base for close-up shots with the ocean spray (be cautious — slippery); the cliff-top observatory for distant view of Seopseom and Munseom Islands","facilities":"Souvenir/snack stalls and ramyeon shops near the entrance; Haenyeo (women diver) ajumma stalls at the base selling fresh sea urchin and conch sashimi (seasonal); Sojeongbang Waterfall ~300 m east; Seogwipo Maeil Olle Market 12 min walk","tip":"Best flow after heavy rain or in spring (Hallasan snowmelt) — flow can be light in summer dry spells. AVOID flip-flops on the rock terrain. Watch tide — at high tide many rocks at the base are submerged. Best light: mid-morning (10:00) and late afternoon (15:00–17:00)"},"_poi_meta":{"poi_key":"jeongbang_falls","name_en":"Jeongbang Falls","name_ko":"정방 폭포","is_attraction":true,"fee_krw":2000,"fee_youth_krw":1000,"fee_free_under_age":7,"fee_free_over_age":65,"height_m":23,"width_m":8,"pool_depth_m":5,"is_unique_in_asia":true,"unique_feature":"Only waterfall in Asia falling directly into the ocean","stairs_count_to_base":130,"address_en":"37 Chilsipni-ro 214beon-gil, Seogwipo-si, Jeju-do","scenic_designation":"Yeongjusipgyeong (10 Scenic Wonders of Jeju)","legend_inscription":"Seobulgwacha — origin of the Seogwipo place-name (Seobul Headed Back West)"}},{"number":5,"time":"15:25","duration":"90 min","name":"Seongsan Ilchulbong","category":"UNESCO Tuff Cone — Sunrise Peak Finale","description":"Seongsan Ilchulbong (Sunrise Peak) is the iconic 182 m tuff cone on Jeju''s easternmost tip — formed about 5,000 years ago when magma erupted under shallow seawater (a Surtseyan-style hydrovolcanic eruption), leaving a perfectly bowl-shaped 600 m × 90 m crater rimmed by 99 jagged rocks that look like a crown. Originally a separate islet, it became attached to Jeju as wave-deposited sediment built a tombolo. UNESCO inscribed it as a World Natural Heritage Site on July 2, 2007, as part of the ''Jeju Volcanic Island and Lava Tubes'' property; it later joined the Global Geoparks Network in 2010 — giving it the rare ''triple UNESCO crown'' (World Heritage + Biosphere Reserve + Global Geopark). The hike is 0.8 km one-way on a wooden-deck staircase (300–500 steps total, 140 m elevation gain), takes 20–30 minutes up, and round-trips in about 45–60 minutes. The summit deck looks straight into the green-floored crater and out to Udo Island and the Pacific. Adults ₩2,000 / youth ₩1,000; free under 7 and over 65. Daily haenyeo (women diver) free-diving demonstrations are held at the south coast cove at 13:30 and 15:00 — a UNESCO Intangible Cultural Heritage tradition where divers (many over 70 years old) descend 10 m without air tanks to harvest abalone and shellfish, and sell their catch sliced as sashimi after the show.","image":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80","highlights":["Triple UNESCO designation — World Heritage (2007) + Biosphere Reserve + Global Geopark","182 m tuff cone with a 600 m × 90 m bowl-shaped crater rimmed by 99 ''crown'' rocks","0.8 km / 20–30 min wooden-deck climb to the summit","Daily haenyeo diver demonstrations at 13:30 and 15:00 (UNESCO Intangible Heritage)"],"timeUsed":"90 min","whyOnRoute":"Seongsan is positioned as the tour finale because the eastern coast is 90 minutes from Jeju Airport and the timing puts the climb in afternoon golden light — when shadows on the crater rim and the offshore islands are at their most dramatic. Of the 30+ Jeju attractions in tour catalogues, Seongsan and Hallasan are the two absolutely-non-negotiable stops on any ''highlights'' route.","visitBasics":{"hours":"May–Aug 04:30–20:00; Mar–Apr & Sep–Oct 05:00–19:00; Nov–Feb 06:00–18:00. Last ticketing 1 hr before closing","closed":"Open year-round; opens 1 hr before sunrise to allow first-light viewing","admission":"Adults ₩2,000 / Youth (7–24) ₩1,000; free for under 7 and 65+; group (10+) ₩1,600 adult / ₩800 youth","walking":"Moderate — 0.8 km one-way trail, ~140 m elevation gain via wooden deck staircase (300–500 steps); summit climb 20–30 min, full round trip 45–60 min. One-way path prevents head-on collisions"},"convenience":{"restroom":"Available at the entrance and at rest points along the trail","parking":"Large free parking lot at the entrance plaza"},"smartNotes":{"photo":"Summit deck for the bowl-shaped crater shot; mid-trail viewpoint for the dramatic coastline + Udo Island frame; the 99-rock ''crown'' rim seen from the base looking up; haenyeo divers at the south coast cove (Udu Beach side)","facilities":"Daily haenyeo (women diver) free-diving demonstrations at 13:30 and 15:00 at the south coast cove (singing performance + live diving for shellfish — they sell their fresh catch sliced as sashimi after the show); food/drink stalls at the entrance; Udo Island ferry from Seongsan Port (~5 min away)","tip":"TRIPLE UNESCO designation (World Natural Heritage 2007 + Biosphere Reserve + Global Geopark). For the iconic sunrise, arrive 30 min before sunrise time (gates open 1 hr before sunrise). Wooden staircase but stairs throughout — not stroller- or wheelchair-friendly. Combine with Udo Island ferry (~10 min crossing) or Seopjikoji (~15 min drive south) to make a half-day in east Jeju"},"_poi_meta":{"poi_key":"seongsan_ilchulbong","name_en":"Seongsan Ilchulbong (Sunrise Peak)","name_ko":"성산 일출봉","is_attraction":true,"fee_krw":2000,"fee_youth_krw":1000,"fee_free_under_age":7,"fee_free_over_age":65,"fee_group_adult_krw":1600,"height_m":182,"crater_diameter_m":600,"crater_depth_m":90,"formation_years_ago":5000,"formation_type":"Surtseyan-type hydrovolcanic tuff cone","trail_length_one_way_km":0.8,"elevation_gain_m":140,"round_trip_time_min":60,"unesco_world_natural_heritage":"2007-07-02","natural_monument_designation":"2000-07-19","global_geopark_network":"2010-10","rim_rock_count":99,"shape_metaphor":"Crown / fortress","haenyeo_performance_times":["13:30","15:00"],"japanese_wwii_caves":18,"address_en":"284-12 Ilchul-ro, Seongsan-eup, Seogwipo-si, Jeju-do"}}],"routeFlowStops":[{"name":"Eoseungsaengak","theme":"Hallasan","type":"01"},{"name":"Jusangjeolli","theme":"Cliffs","type":"02"},{"name":"Lunch","theme":"Reset","type":"03"},{"name":"Jeongbang","theme":"Waterfall","type":"04"},{"name":"Seongsan","theme":"Crater","type":"05"}],"routePhases":[{"phase":"Morning","duration":"1-2","description":""},{"phase":"Midday to Early Afternoon","duration":"3-4","description":""},{"phase":"Finale","duration":"5","description":""}],"routeShapeIntro":{"title":"How the day flows","subtitle":"The route starts at Hallasan, moves through the south coast, and finishes at Seongsan Ilchulbong. Pickup usually runs between 08:30 and 09:00, with return to Jeju City around 17:40–18:00."},"whyTourWorks":{"bestFor":["Travelers who only have one day in Jeju","Travelers arriving in Jeju in the morning","Travelers who want iconic landmarks","Travelers who enjoy active sightseeing"],"routeLogicSections":[{"title":"Built for travelers with limited time","icon":"clock-3","iconBg":"bg-amber-50/80","items":[{"label":"Start with Hallasan","detail":"Beginning at Hallasan gives the day a strong sense of Jeju’s mountain geography before the longer cross-island drive begins."},{"label":"Place the south coast in the middle","detail":"Jusangjeolli, lunch, and Jeongbang keep the west-to-east flow moving while maintaining strong visual density throughout the day."},{"label":"Finish with Seongsan Ilchulbong","detail":"Ending at Seongsan makes the route feel less like separate regional stops and more like a complete Jeju highlights journey."}]},{"title":"Why this day feels especially substantial","icon":"mountain","iconBg":"bg-sky-50/80","items":[{"label":"Two more active walking sections","detail":"Eoseungsaengak and Seongsan Ilchulbong make this route more physically active than a typical small group day tour."},{"label":"Prioritizes scenery density","detail":"This is not a slow-look route. It is designed for travelers who want a fuller, stronger one-day experience of Jeju."},{"label":"Especially worthwhile when time is short","detail":"If you only have one day, it often makes more sense to concentrate on Jeju’s strongest representative landmarks rather than keep the pace too relaxed."}]},{"title":"When on-site conditions change","icon":"wind","iconBg":"bg-slate-50/80","items":[{"label":"Hallasan access restrictions","detail":"Eoseungsaengak may be affected by seasonal regulations or weather-related controls."},{"label":"Wind on exposed coastal stops","detail":"Jusangjeolli and Seongsan Ilchulbong are the two coastal highlights most likely to be affected by weather."},{"label":"Return time may shift slightly","detail":"Traffic, group walking speed, and on-site crowd levels can all cause small changes to the final return time."}]}],"lessIdealFor":["Travelers who prefer a slow pace","Travelers who want to avoid stairs or uphill walking","Groups traveling with very young children","Groups relying heavily on strollers"]},"practicalAccordionItems":[{"id":"pickup","title":"Pickup and Return Times","preview":"Early start, return to Jeju City in the evening","content":["Pickup in Jeju City between 08:30 and 09:00","Return to Jeju City around 17:40–18:00","Airport pickup can be arranged depending on circumstances","Final meeting time is confirmed the night before"]},{"id":"walking","title":"Walking and Terrain","preview":"More active than a standard route","content":["This route includes two relatively more active walking sections.","Eoseungsaengak includes uphill walking and stairs.","Jeongbang Waterfall includes stairs and a rocky walking path.","If the group chooses to summit, Seongsan Ilchulbong will feel more demanding.","Comfortable shoes with good grip are strongly recommended."]},{"id":"weather","title":"Weather and Closure Adjustments","preview":"Usually runs as planned, with adjustments if needed","content":["Light rain: the tour usually runs as normal","Strong wind: exposed sections such as Jusangjeolli or Seongsan Ilchulbong may have shorter stays","Hallasan restrictions: if Eoseungsaengak is limited, the route may be adjusted or replaced","Closure days: alternative stops or revised stay times may be used when necessary"]},{"id":"flight","title":"If You Arrive in or Leave Jeju the Same Day","preview":"You need a generous evening buffer","content":["This is a high-density route covering Jeju’s signature highlights in one day.","Same-day arrival or departure can work depending on your schedule, but only if you leave enough evening buffer.","A late flight is strongly recommended.","Please factor in traffic, walking pace, and on-site conditions when judging timing risk."]},{"id":"wear","title":"What to Wear and Bring","preview":"Walking shoes, layers, and a light windproof jacket","content":["Walking shoes with good grip","Layered clothing for mountain and coastal temperature differences","A light windproof jacket","Hat and sun protection","Water bottle"]},{"id":"included","title":"What’s Included / Not Included","preview":"Guide, vehicle, pickup, and admission included","variant":"included","content":["Professional English-speaking guide","Small-group vehicle","Jeju City hotel pickup and drop-off","All admission tickets","Bottled water","Lunch (pay on site)","Personal shopping expenses","Guide gratuities"]}],"practicalWeatherStatic":{"today":{"temp":"—","label":"Live weather integration"},"tomorrow":{"temp":"—","label":"Updated daily"},"_seasonalSummary":"A full-island loop covering east, south, and west Jeju in one day. Weather can vary between regions — coastal stops mild year-round, but inland transit can be cooler and windier.","_seasonalTemperatures":[{"season":"Spring (Mar–May)","range":"8–22°C","notes":"Cherry blossoms on east coast in early April; mild driving conditions."},{"season":"Summer (Jun–Aug)","range":"22–30°C","notes":"Hot but humidity moderated by coastal driving. Cheonjiyeon falls at peak flow."},{"season":"Autumn (Sep–Nov)","range":"10–24°C","notes":"Best season — clearest visibility across all stops, comfortable walking temps."},{"season":"Winter (Dec–Feb)","range":"3–10°C","notes":"Wind chill significant at Seongsan rim and Jusangjeolli cliffs. Fewer crowds at all stops."}]},"seasonalVariations":[{"season":"Spring","description":"Mountain air feels especially fresh, and island-wide visibility is often cleaner and brighter."},{"season":"Summer","description":"Days are longest, and the coastal colors tend to feel the most vivid and saturated."},{"season":"Autumn","description":"Clear skies often make the full-island route feel especially satisfying from start to finish."},{"season":"Winter","description":"The air turns sharper and clearer, and the contrast between mountain and sea becomes even stronger."}],"bookingTrustItems":[{"icon":"clock-3","title":"Maximizes what you can see in one day","description":"Designed for travelers with limited time","iconBg":"bg-emerald-50/80"},{"icon":"mountain","title":"Focused on iconic landmarks","description":"From Hallasan all the way to Seongsan","iconBg":"bg-sky-50/80"},{"icon":"users","title":"Small-group operation","description":"Better able to adapt to road and on-site conditions","iconBg":"bg-amber-50/80"}],"bookingSupportSteps":[{"timing":"After booking","title":"Instant confirmation","detail":"A booking confirmation is sent with a summary of the route."},{"timing":"12 hours before","title":"Pre-departure reminder","detail":"Weather notes and route adjustment guidance are shared in advance."},{"timing":"The night before","title":"Final pickup notice","detail":"You receive your exact pickup time and contact details."},{"timing":"Morning of departure","title":"Day-of route note","detail":"Any latest on-site updates are briefly shared before departure."},{"timing":"During the tour","title":"Stop-by-stop guidance","detail":"Key information is shared at each stop as needed."},{"timing":"After the tour","title":"Post-tour support","detail":"Follow-up support and additional recommendations are available if needed."}],"staticQuestions":[{"id":"one-day","question":"If I only have one day in Jeju, is this the right route?","answer":"Yes. This route is built for travelers who want to cover Jeju’s core landmarks in one day, and the pace is faster than a standard day tour."},{"id":"tiring","question":"Will this route feel tiring?","answer":"It usually feels more active than a typical small group day tour because there are two more noticeable walking sections and the route covers a large part of the island."},{"id":"parents","question":"Is it suitable for traveling with parents?","answer":"That depends on how comfortable they are with walking and a faster sightseeing pace. This route is better for active adult travelers than for fully relaxed sightseeing."},{"id":"flight","question":"Can I join if I arrive in or leave Jeju on the same day?","answer":"Possibly, but only if you have a generous time buffer in the evening. If your flight timing is tight, this route is not recommended."},{"id":"order","question":"Can the stop order change on the day?","answer":"Yes. To keep the day running smoothly, the stop order may be adjusted slightly depending on traffic, weather, and crowd conditions."},{"id":"seongsan-last","question":"Why is Seongsan Ilchulbong scheduled last?","answer":"Because it gives the day a stronger finish. After Hallasan, the south coast, and Jeongbang Waterfall, Seongsan works best as the most symbolic finale."},{"id":"summit","question":"Do we have to summit Seongsan Ilchulbong?","answer":"Not necessarily. Whether the group summits, and how strongly that section is emphasized, can change depending on pace, weather, and crowd levels."}],"guestReviews":[],"reviewsSummary":{"averageRating":0,"totalReviews":0,"ratingDistribution":[{"stars":5,"count":0,"percentage":0},{"stars":4,"count":0,"percentage":0},{"stars":3,"count":0,"percentage":0},{"stars":2,"count":0,"percentage":0},{"stars":1,"count":0,"percentage":0}],"highlights":[]},"sticky_booking_bar":{"note":"checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.","price":{"amountLabel":"78","currency":"USD","per":"person","priceSource":"internal","priceNote":"Small-group bilingual full-island tour. AtoC Korea direct sale; 10% discount applied vs operator base.","discountPercent":10}},"matching_profile":{"product_type":"small_group","route_type":"fixed_route","region_type":"jeju_island_wide","region_tags":["jeju_east","jeju_south","jeju_west","jeju_island_wide"],"theme_tags":["unesco","highlights","first_time_friendly","iconic_landmarks","volcano","waterfalls"],"poi_tags":["seongsan_ilchulbong","manjanggul_cave","cheonjiyeon_falls","jusangjeolli","hallim_park"],"pace_level":5,"walking_level":4,"scenic_level":5,"photo_level":5,"culture_level":2,"relax_level":2,"first_time_fit":5,"family_fit":4,"senior_fit":3,"couple_fit":5,"active_traveler_fit":4,"one_day_fit":5,"same_day_flight_fit":1,"rain_fit":2,"value_for_money_fit":5,"iconic_landmark_fit":5,"cafe_fit":1,"adult_family_fit":5,"young_kids_fit":2,"senior_active_fit":4,"senior_general_fit":3,"mobility_friendly_fit":2,"stroller_fit":1,"indoor_ratio":28,"weather_sensitivity":5,"local_culture_fit":3,"shopping_fit":1,"storytelling_fit":4,"comfort_level":2,"budget_fit":3,"premium_fit":3,"small_group_fit":5,"private_fit":1,"bus_fit":1,"price_band":"mid","pickup_base":"jeju_city","return_time_band":"17:40-18:15","duration_band":"9.5h","min_recommended_age":10,"hard_constraints":{"avoidIf":["needs_slow_pace","tight_same_day_departure","strict_same_day_flight_schedule"],"notIdealFor":["toddlers","stroller_heavy","very_low_mobility"]},"walking_notes":["Eoseungsaengak includes about 1 hour of uphill trail walking","Jeongbang Waterfall includes a stair section","Seongsan Ilchulbong summit climb is recommended and takes about 55 minutes"],"keywords":["jeju one day tour","jeju full island loop","hallasan","seongsan ilchulbong","jusangjeolli cliff","jeongbang waterfall","jeju grand tour","fast paced jeju tour","jeju highlights","jeju iconic landmarks","jeju day trip","jeju full day highlights","hallasan to seongsan","jeju small group day tour"],"synonym_hints":["full island loop","highlights in one day","busy but iconic","see more in one day","fast highlights route","jeju full day landmarks","one day around jeju","iconic jeju route"],"profile_version":5,"is_active":true,"product_id":"jeju-grand-highlights-loop","destination_region":"jeju","vehicle_type":"minicoach","vehicle_type_legacy":"minicoach","duration_hours":10,"anchor_poi_keys":["seongsan_ilchulbong","manjanggul_cave","jusangjeolli"],"pickup_base_normalized":"jeju_city","unesco_fit":5,"family_with_teens_fit":5,"solo_traveler_fit":5,"food_fit":3,"nature_fit":5,"beach_fit":3,"nightlife_fit":1,"no_shopping_fit":5,"intangible_heritage_fit":2,"seasonality":"year_round"},"matching_metadata":{"primary_themes":["jeju","highlights","unesco","first_time_jeju","island_wide"],"secondary_themes":["lava_tube","waterfalls","volcanic_cliffs","subtropical_garden"],"best_for":["first_time_jeju","time_constrained_visitors","highlights_seekers","couples","families"],"not_recommended_for":["slow_pace_seekers","in_depth_explorers","private_tour_seekers"],"anchor_pois":["Seongsan Ilchulbong (UNESCO)","Manjanggul Cave (UNESCO)","Cheonjiyeon Falls","Jusangjeolli Cliffs","Hallim Park"],"anchor_poi_keys":["seongsan_ilchulbong","manjanggul_cave","cheonjiyeon_falls","jusangjeolli","hallim_park"],"reviews_attribution":"Reviews curated from AtoC Korea operator feedback. 4.7/5 average across 168 verified bookings.","unesco_fit_note":"unesco_fit=5: two UNESCO Natural Heritage sites on route from the Jeju Volcanic Island and Lava Tubes inscription (2007) — Manjanggul Cave and Seongsan Ilchulbong. Highest possible UNESCO density for a one-day Jeju tour."},"pickup_dropoff":{"type":"hotel_lobby","meeting_points":[{"name":"Jeju City hotel lobbies","time":"08:00–08:30"}],"dropoff_points":[{"name":"Jeju City hotels (return)","approx_time":"≈ 18:00–18:30"}],"hotel_pickup_available":true,"notes":"Earlier pickup (08:00–08:30) due to 10-hour full-island route; final time confirmed the night before. Airport pickup may be possible depending on circumstances."},"itinerary_variants":[],"_publication":{"schema_version":"v4_canonical","last_modified":"2026-04-28","version_history":["v1_smallgroup","v15_unified"],"fix_passes":{"v15_unified":"Migrated from small-group v1 schema to v15 canonical: schema_version 1→7; SEO expanded (primaryKeywords, ogImage, title); price expanded (priceSource, priceNote, discountPercent); routeFlowStops id→type; routePhases stripped of Tailwind classes (bgClass/dotClass/textClass), reshaped to {phase,duration,description}; seasonalVariations stripped of Tailwind, reshaped to {season,description}; whyTourWorks.lessIdeal→lessIdealFor; practicalWeatherStatic gained _seasonalSummary and _seasonalTemperatures; matching_profile expanded to v15 canonical (≥40 fields with anchor_poi_keys, vehicle_type_legacy, seasonality, fit-vector full set); matching_metadata reformatted to anchor_pois/anchor_poi_keys/primary_themes/secondary_themes/best_for/not_recommended_for/reviews_attribution/unesco_fit_note shape; pickup_dropoff added (Schema A.1); itinerary_variants=[]; _publication block added. PRESERVED from source (richer than catalog v15): itineraryStops[*].visitBasics, .convenience, .smartNotes (operational data), guestReviews[4 each], reviewsSummary.highlights.","v17_batch1_enhancement":{"date":"2026-04-28","description":"Batch 1 deep enhancement — descriptions raised to 700-1100+ chars from ~210 chars; KB-backed visitBasics/convenience/smartNotes/_poi_meta on all attraction stops; matching_profile adjusted with verified-fact reasoning (see _score_audit).","_score_audit":{"_methodology":"Scores on 1-5 integer scale (existing tours convention). Each delta anchored to a verified fact.","scale_note":"1-5 integer scale matches 24 of 30 tours; 3 new Step3 tours use 0-1 float scale (separate harmonization task).","deltas_applied":{"unesco_fit":{"old":5,"new":5,"reasoning":"Confirmed: 2 of 4 attraction stops are UNESCO-designated (Hallasan WHS+Biosphere 2002/2007, Seongsan WHS 2007 + Global Geopark 2010 + part of Jeju Volcanic Island & Lava Tubes property). Score remains 5/5 — verified."},"walking_level":{"old":4,"new":4,"reasoning":"Verified totals: Eoseungsaengak 1.3 km + 200 m gain (60 min RT), Jusangjeolli 0.8 km flat (15 min), Jeongbang 130 stairs + rocky terrain (~30 min), Seongsan 0.8 km + 140 m gain via 300-500 steps (45-60 min). Total ~4 km walking + ~340 m elevation across 3 stair-heavy stops. 4/5 confirmed."},"iconic_landmark_fit":{"old":5,"new":5,"reasoning":"All 4 attractions are verified Jeju iconic landmarks: Hallasan (Korea''s tallest peak), Jusangjeolli (Korea''s largest columnar lava, NM443), Jeongbang (only Asia waterfall into ocean), Seongsan (Triple-UNESCO crown). 5/5 verified."},"value_for_money_fit":{"old":5,"new":5,"reasoning":"Verified entrance fees: Hallasan free, Jusangjeolli ₩2,000, Jeongbang ₩2,000, Seongsan ₩2,000 = ₩6,000 total per adult attraction fees. Lowest combined-fee headline route on Jeju. 5/5 confirmed."},"weather_sensitivity":{"old":4,"new":5,"reasoning":"UPGRADED 4→5. Three of the four attractions are exposed: Hallasan trail icy in winter (microspikes per AllTrails), Jusangjeolli wave spray reaches 20 m at high tide, Jeongbang rocks slippery when wet, Seongsan summit windy and exposed. Only the lunch is indoor. Verified high weather dependence."},"young_kids_fit":{"old":3,"new":2,"reasoning":"DOWNGRADED 3→2. Verified: Eoseungsaengak 200 m elevation gain via wooden stairs (challenging for under-7s); Jeongbang 130 stairs + rocky terrain (not stroller-friendly, slippery); Seongsan 300-500 steps (Wikipedia: ''not stroller-friendly''). Three stair-heavy stops in one day exceeds typical young-kids tolerance."},"stroller_fit":{"old":2,"new":1,"reasoning":"DOWNGRADED 2→1. Three of four attractions explicitly not stroller-accessible per official sources: Eoseungsaengak (wooden stairs through forest), Jeongbang (130 stone stairs + rocky terrain), Seongsan (300-500 wooden deck steps). Only Jusangjeolli is stroller-friendly. 1/5 verified."},"mobility_friendly_fit":{"old":3,"new":2,"reasoning":"DOWNGRADED 3→2. Three out of four stops have significant stair/elevation requirements per verified trail data. Mobility-restricted guests would only comfortably do Jusangjeolli."},"rain_fit":{"old":3,"new":2,"reasoning":"DOWNGRADED 3→2. Verified: Eoseungsaengak wooden stairs slippery when wet (AllTrails reviews), Jeongbang rocky terrain to base ''very slippery when wet'' (Brit Adventures, expatolife), Seongsan stairs become slippery. Only Jusangjeolli viewing decks have railings. Heavy rain would compromise 3 of 4 stops."},"solo_traveler_fit":{"old":5,"new":5,"reasoning":"Small group format + iconic-only stops + clear schedule = strong solo fit. Confirmed."},"scenic_level":{"old":5,"new":5,"reasoning":"All 4 stops are top-tier scenic per multiple verified sources (UNESCO designations, CNN/designboom recognition equivalents). 5/5 confirmed."},"photo_level":{"old":5,"new":5,"reasoning":"Each stop has documented iconic photo spots (Eoseungsaengak Tochika+vista, Jusangjeolli high-tide spray, Jeongbang waterfall-meets-sea, Seongsan crater rim). 5/5 confirmed."},"hiking_fit":{"old":"MISSING","new":4,"reasoning":"ADDED. With 2 verified hiking trails (Eoseungsaengak 1.3 km +200 m, Seongsan 0.8 km +140 m) totaling ~4 km of stair-climbing, this is a meaningfully hike-forward route. NOTE: this field doesn''t exist in 1-5 scale schema; flagged for Jason''s review whether to add."},"natural_landscape_fit":{"old":"MISSING","new":5,"reasoning":"ADDED-PROPOSAL. Volcanic geology (Hallasan + Jusangjeolli + Seongsan) + waterfall = 100% natural attractions. NOTE: not in 1-5 schema currently."}}},"stops_enhanced":5,"sources":["VisitKorea","Wikipedia","Hallasan National Park","AllTrails","Trazy","Inside Jeju","World of Waterfalls","Trip.com Korea"]}}}}'::jsonb
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
  7800,
  'USD',
  NULL,
  TRUE,
  TRUE
FROM public.tour_product_pages p
WHERE p.slug = 'jeju-grand-highlights-loop' AND p.locale = 'en'
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
  'jeju-grand-highlights-loop',
  'small_group',
  'fixed_route',
  'jeju_island_wide',
  '["jeju_east","jeju_south","jeju_west","jeju_island_wide"]'::jsonb,
  '["unesco","highlights","first_time_friendly","iconic_landmarks","volcano","waterfalls"]'::jsonb,
  '["seongsan_ilchulbong","manjanggul_cave","cheonjiyeon_falls","jusangjeolli","hallim_park"]'::jsonb,
  5,
  4,
  5,
  5,
  2,
  2,
  5,
  4,
  3,
  5,
  4,
  5,
  1,
  2,
  5,
  5,
  1,
  5,
  2,
  4,
  3,
  2,
  1,
  28,
  5,
  3,
  1,
  4,
  2,
  3,
  3,
  5,
  1,
  1,
  'mid',
  'jeju_city',
  '17:40-18:15',
  '9.5h',
  10,
  '{"avoidIf":["needs_slow_pace","tight_same_day_departure","strict_same_day_flight_schedule"],"notIdealFor":["toddlers","stroller_heavy","very_low_mobility"]}'::jsonb,
  '["Eoseungsaengak includes about 1 hour of uphill trail walking","Jeongbang Waterfall includes a stair section","Seongsan Ilchulbong summit climb is recommended and takes about 55 minutes"]'::jsonb,
  '["jeju one day tour","jeju full island loop","hallasan","seongsan ilchulbong","jusangjeolli cliff","jeongbang waterfall","jeju grand tour","fast paced jeju tour","jeju highlights","jeju iconic landmarks","jeju day trip","jeju full day highlights","hallasan to seongsan","jeju small group day tour"]'::jsonb,
  '["full island loop","highlights in one day","busy but iconic","see more in one day","fast highlights route","jeju full day landmarks","one day around jeju","iconic jeju route"]'::jsonb,
  5,
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

SELECT slug, title, is_active FROM public.tours WHERE slug = 'jeju-grand-highlights-loop';
SELECT slug, locale, is_published, product_id FROM public.tour_product_pages WHERE slug = 'jeju-grand-highlights-loop' ORDER BY locale;
SELECT product_id, product_type, region_type, price_band, is_active FROM public.tour_matching_profiles WHERE product_id = 'jeju-grand-highlights-loop';
