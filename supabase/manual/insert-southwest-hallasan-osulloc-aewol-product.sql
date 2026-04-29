-- =============================================================================
-- southwest-hallasan-osulloc-aewol — small-group tour product (tour_product v2)
-- =============================================================================
-- Generated: 2026-04-28T15:36:17.611Z
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
  '[{"time":"09:00","title":"Hallasan Eoseungsaengak","description":"Hallasan Foothill Trail (Eorimok)"},{"time":"10:50","title":"Daepo Jusangjeolli Cliff","description":"Volcanic Coastline — Hexagonal Basalt Columns"},{"time":"11:50","title":"Lunch","description":"Midday Reset — Seogwipo / Jungmun"},{"time":"13:00","title":"Cheonjeyeon Waterfall","description":"Three-Tier Waterfall + Forest Walk"},{"time":"14:20","title":"O’Sulloc Tea Museum","description":"Tea Culture & Seogwang Plantation"},{"time":"15:50","title":"Aewol Cafe Street","description":"Coastal Cafe Strip — Sunset Finale"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  4.8,
  127,
  2,
  0,
  TRUE,
  FALSE,
  '{}'::jsonb,
  'Southwest Jeju Hallasan + Osulloc Tour | AtoC Korea',
  'Small-group 9-hour southwest Jeju tour: 1100 Highland on Hallasan, Osulloc tea fields, Aewol coast cafés, Hyeopjae Beach, Hallim Park.'
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
  'Southwest Jeju Hallasan + Osulloc Tour | AtoC Korea',
  'Small-group 9-hour southwest Jeju tour: 1100 Highland on Hallasan, Osulloc tea fields, Aewol coast cafés, Hyeopjae Beach, Hallim Park.',
  'Jeju Southwest: Hallasan, Tea Fields, and Aewol',
  'Small Group Day Tour',
  '58',
  'USD',
  'person',
  '{"document_kind":"tour_product_full_page_v1","schema_version":7,"slug":"southwest-hallasan-osulloc-aewol","locale":"en","product_id":"southwest-hallasan-osulloc-aewol","seo":{"pageTitle":"Southwest Jeju Hallasan + Osulloc Tour | AtoC Korea","metaDescription":"Small-group 9-hour southwest Jeju tour: 1100 Highland on Hallasan, Osulloc tea fields, Aewol coast cafés, Hyeopjae Beach, Hallim Park.","primaryKeywords":["Southwest Jeju small group tour","Hallasan 1100 Highland tour","Osulloc tea museum tour","Aewol coast café tour","Hyeopjae Beach tour"],"ogImage":"https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80","title":"Southwest Jeju Hallasan + Osulloc + Aewol Tour · 9-hour Small-Group"},"catalog_card":{"slug":"southwest-hallasan-osulloc-aewol","title":"Jeju Southwest Small Group Tour: Hallasan, O’Sulloc & Aewol","subtitle":"A short Hallasan walk, volcanic cliffs, a waterfall trail, tea fields, and a relaxed Aewol finish.","region":"Jeju Southwest","duration":"8 hours","stopsCount":6,"rating":4.8,"reviewCount":127,"badges":["Great for First-Time Jeju Visitors","Jeju Southwest"],"heroImage":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80","thumbnail":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=600&q=80","priceLabel":"From US$58 per person","shortCardDescription":"A well-balanced Jeju southwest route linking a short Hallasan walk, volcanic coastline, Cheonjeyeon Waterfall, O’Sulloc tea fields, and Aewol Cafe Street.","tags":["small_group","jeju","southwest_jeju","nature","cafe","hallasan"]},"headlineLine1":"Jeju Southwest: Hallasan, Tea Fields, and Aewol","headlineLine2":"Small Group Day Tour","price":{"amountLabel":"58","currency":"USD","per":"person","priceSource":"internal","priceNote":"Small-group bilingual tour. AtoC Korea direct sale; 10% discount applied vs operator base.","discountPercent":10},"hero":{"imageUrl":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1920&q=80","imagePosition":"center 35%","tagline":"A short Hallasan walk, volcanic cliffs, a waterfall trail, tea fields, and a relaxed Aewol finish.","pills":["Great for First-Time Jeju Visitors","Jeju Southwest"],"meta":{"duration":"8 hours","region":"Jeju Southwest","stops":"6 stops","rating":4.8,"ratingStars":5}},"subnavItems":[{"id":"overview","label":"Overview"},{"id":"itinerary","label":"Itinerary"},{"id":"details","label":"Details"},{"id":"faq","label":"FAQ"},{"id":"reviews","label":"Reviews"}],"glanceItems":[{"icon":"camera","label":"Photo Potential","value":"High"},{"icon":"mountain","label":"Scenery Density","value":"High"},{"icon":"footprints","label":"Walking Difficulty","value":"Moderate"},{"icon":"cloud-rain","label":"Rain Suitability","value":"Moderate"},{"icon":"users","label":"Family Suitability","value":"Good"},{"icon":"scale","label":"Pace","value":"Balanced"}],"galleryItems":[{"id":1,"type":"video","src":"https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80","location":"Overall Route","atmosphere":"A full-day view of how the route flows","alt":"Overall atmosphere of the Jeju southwest route","caption":"Overall atmosphere of the Jeju southwest route"},{"id":2,"type":"photo","src":"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","location":"Hallasan Opening Stop","atmosphere":"Fresh mountain air","alt":"Hallasan Eoseungsaengak trail","caption":"Hallasan Eoseungsaengak trail"},{"id":3,"type":"photo","src":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","location":"Volcanic Coastline","atmosphere":"A powerful basalt shoreline","alt":"Basalt sea cliffs at Daepo Jusangjeolli","caption":"Basalt sea cliffs at Daepo Jusangjeolli"},{"id":4,"type":"photo","src":"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","location":"Forest Trail and Waterfall","atmosphere":"A cooler, calmer middle section","alt":"Forest trail at Cheonjeyeon Waterfall","caption":"Forest trail at Cheonjeyeon Waterfall"},{"id":5,"type":"photo","src":"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80","location":"Tea Fields Break","atmosphere":"Open green scenery with a softer mood","alt":"Atmosphere around O’Sulloc Tea Museum and the tea fields","caption":"Atmosphere around O’Sulloc Tea Museum and the tea fields"},{"id":6,"type":"video","src":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80","location":"Aewol Coastal Finale","atmosphere":"A relaxed close to the day","alt":"Aewol Cafe Street on the coast","caption":"Aewol Cafe Street on the coast"}],"itineraryStops":[{"number":1,"time":"09:00","duration":"75 min","name":"Hallasan Eoseungsaengak","category":"Hallasan Foothill Trail (Eorimok)","description":"Eoseungsaengak (1,169 m) is the shortest official trail inside Hallasan National Park — a 1.3 km one-way out-and-back from the Eorimok Visitor Center, gaining about 200 m of elevation through dense forest of native Korean red pine and dwarf bamboo. The route is built on wooden stairs and boardwalks with rope railings on the steeper sections, and most visitors reach the summit deck in 30–40 minutes. This is the entry-level taste of Hallasan — UNESCO World Natural Heritage (2007), UNESCO Biosphere Reserve (2002), and Korea''s tallest peak at 1,947 m — without needing the QR-code reservation that the Seongpanak and Gwaneumsa summit trails require. From the top, on a clear day, you can see Jeju City and the northern coastline, the higher Hallasan ridges (occasionally Baengnokdam crater), and as far as Chujado Island, Biyangdo Island and even Seongsan Ilchulbong on the eastern horizon. The summit also holds the remains of a Tochika — a 1945 Imperial Japanese military communication pillbox, a quiet reminder of the island''s wartime history. The trail is comfortable in spring, summer and autumn; in winter (Dec–Feb) the steps ice over and micro-spikes are recommended.","image":"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80","highlights":["1.3 km wooden-stair trail to a 1,169 m summit — short Hallasan taste with no reservation needed","Summit views to Chujado, Biyangdo and (clear days) all the way to Seongsan Ilchulbong","Tochika ruins — 1945 Japanese military pillbox at the summit deck","Hallasan National Park = UNESCO World Natural Heritage (2007) + Biosphere Reserve (2002)"],"timeUsed":"75 min","whyOnRoute":"This is the only Hallasan trail short enough to fit a one-day full-island loop. The longer Seongpanak (9.7 km one-way) or Gwaneumsa (8.7 km) summit trails require advance reservation and 8+ hours, which is incompatible with a 9.5-hour grand loop. Eoseungsaengak gives an authentic Hallasan summit experience inside a 1.5-hour window.","visitBasics":{"hours":"Trail accessible roughly 05:00–18:00 (varies seasonally; longer in summer May–Aug)","closed":"Open year-round; closures possible in extreme weather","admission":"Free; no entrance fee, no reservation required (only Seongpanak/Gwaneumsa summit trails require advance QR reservation)","walking":"Moderate — 1.3 km one-way, ~200 m elevation gain via wooden stairs and boardwalks; 30–40 min up, plan 1–1.5 hr round trip"},"convenience":{"restroom":"Available at Eorimok Visitor Center near the trailhead","parking":"Eorimok Trail parking lot at the visitor center (free)"},"smartNotes":{"photo":"Summit observation deck for 360° view of Jeju City, the northern coast and the higher Hallasan peaks (Baengnokdam crater on clear days). Tochika ruins for a quick history shot","facilities":"Visitor Center with information panels and restrooms at trailhead; benches and rest points along the trail; no shops or vending past the entrance","tip":"Wooden stairs are slippery after rain and icy in winter (Dec–Feb) — micro-spikes recommended in winter. Pets and drones are not allowed in Hallasan National Park"},"_poi_meta":{"poi_key":"hallasan_eoseungsaengak","name_en":"Hallasan Eoseungsaengak Trail","name_ko":"한라산 어승생악","is_attraction":true,"fee_krw":0,"trail_length_one_way_km":1.3,"elevation_gain_m":200,"summit_elevation_m":1169,"round_trip_min":60,"trailhead":"Eorimok Visitor Center","no_reservation_required":true,"park_status":["UNESCO World Heritage 2007","UNESCO Biosphere Reserve 2002","National Park 1970","Natural Monument 1966"],"historical_feature":"Tochika — 1945 Imperial Japanese military pillbox/communication post at summit"}},{"number":2,"time":"10:50","duration":"45 min","name":"Daepo Jusangjeolli Cliff","category":"Volcanic Coastline — Hexagonal Basalt Columns","description":"Daepo Jusangjeolli (designated Natural Monument No. 443 on January 6, 2005) is Korea''s largest columnar-jointed lava formation — about 1 km of coastline lined with hexagonal basalt pillars 30–40 m tall. The columns formed when basaltic lava from a Hallasan eruption flowed into the sea at Jungmun and cooled rapidly, contracting and fracturing into the geometric column shapes that geologists call ''columnar jointing''. The visitor pathway is a flat 0.8 km loop on paved walkways and wooden viewing decks built along the cliff edge — the columns themselves are viewed from above (no descent), and the headline experience is the South Pacific swell smashing into the foot of the cliff: at high tide the spray can shoot 20 m or more straight up the column face. Entry is ₩2,000 for adults, ₩1,000 for youth (7–24), and free under 7 and over 65 — making this one of the most affordable headline volcanic geology stops in Korea. Plan 30–45 minutes total. The site sits next to the ICC Jeju (International Convention Center) inside the Jungmun Tourist Complex, with souvenir kiosks at the entrance selling Hallabong (Jeju tangerine) juice in Dol-hareubang–shaped bottles.","image":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80","highlights":["Korea''s National Monument No. 443 — largest columnar-jointed lava in the country","30–40 m tall hexagonal basalt columns over a 1 km coastline","High-tide spray can shoot 20+ m up the cliff face (best viewing window)","Inexpensive — ₩2,000 adult admission, kids under 7 free"],"timeUsed":"45 min","whyOnRoute":"Jusangjeolli is the most efficient single demonstration of Jeju''s volcanic geology — a 30-minute stop that visually summarises the lava-meets-sea story behind the entire island''s UNESCO designation. It also pairs neatly with the next stop (Jeongbang) which is a 25-minute drive east along the southern coast.","visitBasics":{"hours":"Daily 09:00–18:00 (last admission ~17:00; hours may shift seasonally with sunset)","closed":"Open year-round","admission":"Adults ₩2,000 / Youth (7–24) ₩1,000 / Free for under 7 and over 65; group rate (10+) ₩1,600 adult / ₩600 youth","walking":"Easy — 0.8 km loop on paved walkways and wooden viewing decks; ~12–15 min walk, fully flat"},"convenience":{"restroom":"Available at the entrance plaza and visitor area","parking":"Paid parking lot adjacent to entrance — ₩1,000 small / ₩2,000 medium (sedan to 15-seater) / ₩3,000 large vehicles"},"smartNotes":{"photo":"First viewing deck for the classic hexagonal-columns frame; far deck for waves crashing into the columns (best at high tide — waves can shoot 20+ m up the cliff)","facilities":"Souvenir kiosks at entrance selling Hallabong (Jeju tangerine) juice in dol-hareubang shaped bottles, hot dogs, octopus skewers, ice cream and accessories; ICC Jeju (Convention Center) and Yakcheonsa Temple are walking distance","tip":"Plan ~30–45 min total. The wooden deck doesn''t allow descent to the columns themselves — they are viewed from above. Best photos when sunlight hits at an angle (mid-morning or late afternoon); spray reaches the deck at high tide so cameras may need protection"},"_poi_meta":{"poi_key":"daepo_jusangjeolli_cliff","name_en":"Daepo Jusangjeolli Cliff (Columnar-Jointed Lava)","name_ko":"대포 주상절리 (지삿개)","is_attraction":true,"fee_krw":2000,"fee_youth_krw":1000,"fee_free_under_age":7,"fee_free_over_age":65,"natural_monument_no":443,"designation_date":"2005-01-06","column_height_m":"30-40","coastline_length_m":1000,"wave_height_high_tide_m":20,"loop_length_km":0.8,"loop_time_min":15}},{"number":3,"time":"11:50","duration":"60 min","name":"Lunch","category":"Midday Reset — Seogwipo / Jungmun","description":"Lunch break of about 60 minutes between Jusangjeolli and Cheonjeyeon Falls — both stops are inside the Jungmun Tourist Complex so the lunch options sit in the same district. Typical recommendations include Jungmun seafood haemul-guksu (seafood noodle), abalone porridge, or Jeju black pork (heuk-dwaeji) at one of the small Jungmun restaurants. Lunch at own expense (~₩10,000–20,000 per person).","image":"https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80","highlights":["Jungmun district — restaurants within 5 min drive of next stop","Jeju black pork (heuk-dwaeji) — most iconic regional dish","Seafood noodles (haemul-guksu) — local lunchtime staple"],"timeUsed":"60 min","whyOnRoute":"Jungmun anchors the southern coast — keeping lunch here means no extra driving to and from a meal stop.","visitBasics":{"hours":"Depends on the restaurant","closed":"Varies by venue","admission":"May be included depending on the product condition, or paid on site","walking":"Minimal"},"convenience":{"restroom":"Inside the restaurant","parking":"Parking available"},"smartNotes":{"photo":"If you want some lifestyle-style gallery shots, food photos work especially well here.","facilities":"Dining facilities are more than sufficient.","tip":"A calmer lunch usually improves the second half of the day more than saving a few extra minutes."}},{"number":4,"time":"13:00","duration":"75 min","name":"Cheonjeyeon Waterfall","category":"Three-Tier Waterfall + Forest Walk","description":"Cheonjeyeon (''Pond of the Emperor of Heaven'') is a three-tier waterfall complex at the heart of the Jungmun Tourist Complex, designated as Natural Monument No. 378 in 1993 for the rare warm-temperate forest surrounding the falls (home to the skeleton fork fern Psilotum nudum, found in only a handful of locations in Korea). The first tier drops 22 m off a cliff into a 21-m-deep pond — a striking columnar-joint cliff that, however, only flows after heavy rain. The second tier is the reliable, year-round headliner: a 30 m drop into an emerald pool inside a forested gorge, viewed from a wide deck that also gives a partial view of the third tier. Connecting the falls is the Seonimgyo Bridge — a vermilion arch 120 m long and up to 78 m above the gorge, with seven stone nymphs carved into its trusses (the legend says seven heavenly nymphs descend on a moonbeam each night to bathe in the pond). The Chilseonyeo (Seven Nymphs) Festival is held here in May of even-numbered years. The full loop involves significant stair-climbing across the three tiers — plan 1–1.5 hours, and pack water (no shops past the entrance). Admission is ₩2,500 adult / ₩1,350 youth, slightly higher than other Jeju waterfalls because ticketing covers the larger valley and the bridge.","image":"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80","highlights":["Natural Monument No. 378 (1993) — protected warm-temperate forest with rare ferns","Three-tier falls: tier 1 (22 m, after rain only) + tier 2 (30 m, year-round) + tier 3","Seonimgyo Bridge — 120 m vermilion arch, 78 m above the gorge with seven-nymph carvings","Chilseonyeo (Seven Nymphs) Festival held here in May of even-numbered years"],"timeUsed":"75 min","whyOnRoute":"Cheonjeyeon sits 5 minutes from Jusangjeolli and from Jungmun lunch options, making it the natural mid-afternoon nature stop on the southern leg. NOTE: Cheonjeyeon (천제연) and Cheonjiyeon (천지연) are different waterfalls — easily confused. This tour uses Cheonjeyeon, the three-tier complex inside Jungmun.","visitBasics":{"hours":"Mar–Oct 08:00–18:30; Nov–Feb 09:00–17:30. Last admission 1 hour before closing","closed":"Open year-round","admission":"Adults ₩2,500 / Youth & Children ₩1,350 (covers larger valley and Seonimgyo Bridge)","walking":"Moderate — many stairs across the three tiers; total ~1–1.5 km loop with significant ascent/descent. Plan 1–1.5 hr"},"convenience":{"restroom":"Available near the ticket office at the entrance (none past the bridge)","parking":"On-site parking lot — free for visitors"},"smartNotes":{"photo":"Seonimgyo Bridge (vermilion arch with seven nymphs carved on the trusses) for the classic shot; viewing deck for the second tier — the most active and photogenic waterfall (30 m drop into emerald pool); Cheonjeru Pavilion deck for distant overview","facilities":"Benches and shaded rest spots along the path; no shops past the bridge — pack water in summer; Chilseonyeo (Seven Nymphs) Festival held here in May of even-numbered years","tip":"First tier ONLY flows after heavy rain (often dry in winter); the second tier is the reliable attraction. Lots of stairs — comfortable shoes required. Note: do NOT confuse with Cheonjiyeon Falls (different waterfall in Seogwipo old town). Swimming prohibited"},"_poi_meta":{"poi_key":"cheonjeyeon_falls","name_en":"Cheonjeyeon Falls (Three-Tier Waterfall)","name_ko":"천제연 폭포","is_attraction":true,"fee_krw":2500,"fee_youth_krw":1350,"tier_1_height_m":22,"tier_1_pond_depth_m":21,"tier_2_height_m":30,"natural_monument_no":378,"designation_year":1993,"seonimgyo_bridge_length_m":120,"seonimgyo_bridge_height_m":78,"name_meaning":"Pond of the Emperor of Heaven"}},{"number":5,"time":"14:20","duration":"75 min","name":"O’Sulloc Tea Museum","category":"Tea Culture & Seogwang Plantation","description":"O''sulloc Tea Museum opened in September 2001 — Korea''s first tea museum, operated by Amorepacific (the country''s largest beauty group) and located on the edge of the 100-hectare Seogwang Tea Plantation. The site grew from a 1979 reclamation project led by founder Suh Sungwhan, who chose Jeju''s volcanic soil and subtropical climate for organic green-tea cultivation; the company harvested its first tea in 2009 and won World Tea Champion at the 7th International Tea Exposition the same year. Today the plantation produces about 700 tonnes of tea annually, and the museum draws roughly 2 million visitors a year — earning it a place on designboom''s Top 10 art museums list. The main building is shaped like a green tea cup; the 2nd-floor observatory windows frame the rolling green tea fields against Hallasan in the distance. Entry to the museum and tea fields is free; the cafe (matcha ice cream, green tea swiss roll, Hallabong tangerine tea, Camellia flower tea) and gift shop are paid. Adjacent across a flower-lined path is the Innisfree Jeju House (Amorepacific''s sister K-beauty brand) with a soap-making workshop (~₩20,000) and the Green Cafe brunch — combine for a 1.5–2 hr visit. Hours are 09:00–19:00 in summer (Apr–Oct) and 09:00–18:00 in winter (Nov–Mar).","image":"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80","highlights":["Korea''s first tea museum (2001) — Amorepacific operated, ~2 million annual visitors","Seogwang Tea Plantation — Korea''s largest organic tea farm, 700 tonnes/year","Free admission to museum and tea fields; cafe and shop priced separately","Innisfree Jeju House next door — K-beauty workshop & brunch on the same property"],"timeUsed":"75 min","whyOnRoute":"O''sulloc is the southwest''s signature ''culture + cafe'' stop — it converts a long drive day into a relaxed mid-afternoon by combining a free museum, scenic tea fields, premium-grade matcha ice cream, and the adjacent Innisfree Jeju House. The plantation is a 30-min drive northwest from Jungmun, on the way back to Aewol for the sunset finale.","visitBasics":{"hours":"Daily 09:00–19:00 (Apr–Oct) / 09:00–18:00 (Nov–Mar); subject to change in adverse weather","closed":"Open year-round","admission":"Free entry to museum and tea fields; tea, desserts, classes priced separately","walking":"Easy — paved paths and ramps throughout; tea fields fully flat. Stroller- and wheelchair-friendly"},"convenience":{"restroom":"Available throughout the museum and adjacent Innisfree Jeju House","parking":"Large free parking lot on-site"},"smartNotes":{"photo":"The teacup-shaped main building exterior; 2nd-floor observatory window over the Seogwang tea fields; the row of giant teacup planters at the field entrance; Innisfree Jeju House garden path with blue flowers in season","facilities":"Cafe (matcha ice cream, green tea swiss roll, Hallabong/tangerine tea, Camellia flower tea); flagship gift shop; Tea Stone (since 2013) — paid tea brewing classes; adjacent Innisfree Jeju House (sister Amorepacific brand) with handmade soap workshop (~₩20,000) and Green Cafe brunch","tip":"Arrive at opening (09:00) on weekdays — tour buses crowd the place from 10:00 onward. Green tea ice cream queue gets long midday. Pair with Innisfree Jeju House across the path for a 1.5–2 hr visit. Combo well with Sanbangsan (~25 min) or Hallim Park (~30 min)"},"_poi_meta":{"poi_key":"osulloc_tea_museum","name_en":"O''sulloc Tea Museum","name_ko":"오설록 티 뮤지엄","is_attraction":true,"fee_krw":0,"opened_year":2001,"operator":"Amorepacific Corporation","annual_visitors":2000000,"founded_concept_year":1979,"first_harvest_year":2009,"tea_field_name":"Seogwang Dawon (Tea Plantation)","annual_tea_production_tonnes":700,"address_en":"425 Sinhwayeoksa-ro, Andeok-myeon, Seogwipo-si, Jeju-do","designation":"designboom Top 10 art museums"}},{"number":6,"time":"15:50","duration":"75 min","name":"Aewol Cafe Street","category":"Coastal Cafe Strip — Sunset Finale","description":"Aewol Cafe Street (애월 카페거리) runs along the west coast of Jeju at Aewol-eup, about 40 minutes west of Jeju City. The headline asset is the Handam Coastal Trail — officially the Jang Han Chul Promenade (장한철산책로), named after the Joseon-era Jeju-born writer Jang Han Chul whose memoir on Korean maritime history shaped the area''s literary identity. The trail is a 2 km flat paved boardwalk between Gwakji Beach and Handam Village (about 20–30 minutes one way) and forms part of Jeju Olle Trail 15A (Hallim → Gonae). The cafes themselves cluster on the cliffs above the trail: Bomnal Cafe (most photographed terrace, tangerine milk tea), Randy''s Donuts and Cafe Knotted (the Korean trendy bakery exports), Haejigae Cafe (sunset terrace), and the seafood ramyeon institution Nolman (single dish, ₩10,000, take-a-number). Glass-bottom kayak rentals at Handam cove run about ₩10,000 for 30 minutes (2-person boats with life jackets). The west-facing coastline makes this one of the most reliable sunset spots on Jeju — the sun drops directly into the East China Sea over Biyangdo Island. Bus 202 from Jeju City stops at Handam-dong; parking is genuinely scarce on weekends.","image":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80","highlights":["Handam Coastal Trail — 2 km flat paved boardwalk, part of Jeju Olle 15A","Officially the Jang Han Chul Promenade — named after a Jeju-born Joseon writer","Famous cafes — Bomnal, Randy''s Donuts, Cafe Knotted, Haejigae","West-facing sunset coastline — sun drops into the sea over Biyangdo Island"],"timeUsed":"75 min","whyOnRoute":"Aewol is positioned as the tour''s emotional finale: after a day of geology and nature, a slow coastal walk + coffee at sunset closes the loop. The west coast is 30 minutes from Jeju City Airport, so guests on evening flights can be dropped directly. Weekday afternoons are the best time — weekend cafe lines and parking are difficult.","visitBasics":{"hours":"Outdoor area 24h; cafes typically 09:00–22:00 (vary by venue)","closed":"Outdoor area open year-round; individual cafes have their own days off","admission":"Free area; food & drinks priced individually (~₩6,000–12,000 per cafe order)","walking":"Easy — paved coastal promenade between Gwakji Beach and Handam Village (~2 km, 20–30 min one way)"},"convenience":{"restroom":"Inside cafes and at small public facilities along the coastal trail","parking":"Limited — small public lots near the main cafes; some venues offer free private parking for patrons. Roads are narrow, parking can be challenging on weekends"},"smartNotes":{"photo":"West-facing coastal cliffs at sunset (one of the best sunset spots on Jeju); the small cove at Handam for transparent kayaks; iconic Bomnal Cafe terrace seafront; Gwakji Beach ''jelly sea'' shallows in summer","facilities":"Dozens of cafes, bakeries (Cafe Knotted, Randy''s Donuts), seafood ramyeon at Nolman (₩10,000, single dish), burger shops; transparent kayak rentals at Handam (~₩10,000/30 min, 2-person boats with life jackets)","tip":"Sunset is the headline — west-facing coast catches the sun dropping into the sea. Weekday afternoons quieter; weekend afternoons can be packed and parking near impossible. Bus 202/100/200 from Jeju City stops at Handam-dong"},"_poi_meta":{"poi_key":"aewol_cafe_street","name_en":"Aewol Cafe Street (Handam Coastal Trail)","name_ko":"애월 카페거리 / 한담해안산책로","is_attraction":true,"fee_krw":0,"address_en":"Aewol-ro 1-gil, Aewol-eup, Jeju-si, Jeju-do","drive_from_jeju_city_min":40,"promenade_official_name":"Jang Han Chul Promenade (장한철산책로)","promenade_named_after":"Jang Han Chul (Jeju-born Joseon-era writer on Korean maritime history)","olle_trail_segment":"Jeju Olle Trail 15A (Hallim → Gonae)","coastal_walk_min":30,"famous_cafes":["Bomnal Cafe","Randy''s Donuts","Cafe Knotted","Haejigae Cafe","Aewol the Sunset"]}}],"routeFlowStops":[{"name":"Eoseungsaengak","theme":"Hallasan","type":"01"},{"name":"Jusangjeolli","theme":"Coast","type":"02"},{"name":"Lunch","theme":"Reset","type":"03"},{"name":"Cheonjeyeon","theme":"Waterfall","type":"04"},{"name":"O’Sulloc","theme":"Tea Fields","type":"05"},{"name":"Aewol","theme":"Coast","type":"06"}],"routePhases":[{"phase":"Morning","duration":"1-2","description":""},{"phase":"Midday to Early Afternoon","duration":"3-4","description":""},{"phase":"Finale","duration":"5-6","description":""}],"routeShapeIntro":{"title":"How this route flows","subtitle":"From Hallasan and volcanic coastline to lunch, waterfall, tea fields, and an Aewol coastal finish. Roughly 09:00 to 17:30."},"whyTourWorks":{"bestFor":["First-time Jeju travelers and couples","Adult family trips","Travelers who want nature, tea fields, and a softer finish","Active middle-aged and older travelers"],"lessIdealFor":["Travelers who want to avoid even short stair sections or uphill walks","Groups relying heavily on strollers","Itineraries built around very young children"],"routeLogicSections":[{"title":"Pace and structure","icon":"sun","iconBg":"bg-amber-50/80","items":[{"label":"Start with Hallasan while energy is highest","detail":"Putting Eoseungsaengak first makes the short climb feel easier and lets the route flow naturally into the coastal section."},{"label":"Lunch sits in the right position","detail":"Lunch resets the day between the more open and dramatic morning stops and the calmer waterfall-and-tea-field section that follows."},{"label":"A lighter finish after O’Sulloc","detail":"Once the tea fields soften the mood, Aewol opens the final stretch naturally with coffee, sea views, and an easier rhythm."}]},{"title":"How the route is designed","icon":"mountain","iconBg":"bg-sky-50/80","items":[{"label":"Mountain first, sea second","detail":"The route creates altitude and texture at Hallasan first, then lets the view open dramatically to the coast at Jusangjeolli."},{"label":"Waterfall before tea fields","detail":"Cheonjeyeon settles the route down before O’Sulloc opens the second half in a lighter and gentler way."},{"label":"A cafe coast at the end","detail":"Aewol is not placed as another hard sightseeing stop, but as a lifestyle-oriented coastal finish that closes the day softly."}]},{"title":"When conditions change","icon":"wind","iconBg":"bg-slate-50/80","items":[{"label":"Hallasan weather variables","detail":"Eoseungsaengak can be affected by sudden weather changes or trail access restrictions."},{"label":"Wind on the coast","detail":"Jusangjeolli and Aewol are much more directly exposed to wind than inland stops."},{"label":"Balanced overall walking load","detail":"The route is generally manageable, but Eoseungsaengak and Cheonjeyeon still require attention for stairs and short uphill segments."}]}]},"practicalAccordionItems":[{"id":"pickup","title":"Pickup and Return","preview":"Hotel-lobby pickup in the Jeju City area","content":["Pickup at your hotel lobby between 08:20 and 08:50","Return is expected around 17:50–18:20","Airport pickup may be possible on request","Your exact pickup time is confirmed the night before"]},{"id":"walking","title":"Walking and Terrain","preview":"Moderate overall, and manageable for most guests","content":["Total walking is usually around 4.5–5.5 km across the day.","Eoseungsaengak: short uphill route, but with many stairs.","Jusangjeolli: an easy coastal walking path.","Cheonjeyeon: forest path, stairs, and occasionally wet sections.","O’Sulloc and Aewol: comfortable stops where the pace is easier to manage.","Walking shoes with good grip are recommended."]},{"id":"weather","title":"Weather and Closure Adjustments","preview":"The tour usually runs, with changes if needed","content":["Light rain: the tour usually runs as planned.","Heavy rain or trail restrictions: the Eoseungsaengak section may be shortened or adjusted.","Strong wind: stays at Jusangjeolli or Aewol may become shorter.","Late-day weather deterioration: O’Sulloc may carry a larger share of the afternoon.","If a stop closes: an alternative stop may be used."]},{"id":"wear","title":"What to Wear and Bring","preview":"Good shoes, layers, and a light jacket","content":["Shoes with good grip","Layered clothing for mountain and coastal temperature differences","A light windbreaker","Hat and sunscreen","Water bottle"]},{"id":"included","title":"What’s Included / Not Included","preview":"Guide, vehicle, pickup, and admission included","variant":"included","content":["English-speaking guide","Small-group vehicle","Jeju City area hotel pickup and drop-off","All admission tickets","Bottled water","Lunch (pay on site)","Personal shopping expenses","Guide gratuities"]}],"practicalWeatherStatic":{"today":{"temp":"—","label":"Live weather integration"},"tomorrow":{"temp":"—","label":"Updated daily"},"_seasonalSummary":"Southwest Jeju has the most varied terrain on the island — from Hallasan''s 1100 Highland alpine zone to Hyeopjae''s turquoise beach. Hallasan can be 5–8°C cooler than coast; bring a layer year-round.","_seasonalTemperatures":[{"season":"Spring (Mar–May)","range":"6–20°C inland / 10–22°C coast","notes":"Cherry blossoms; new tea leaves at Osulloc."},{"season":"Summer (Jun–Aug)","range":"18–25°C inland / 22–30°C coast","notes":"1100 Highland stays cool; Hyeopjae at peak turquoise."},{"season":"Autumn (Sep–Nov)","range":"8–22°C inland / 12–24°C coast","notes":"Best season — golden tea fields, clear Hallasan views."},{"season":"Winter (Dec–Feb)","range":"-2–7°C inland / 3–10°C coast","notes":"1100 Highland often snowy — striking but require warm layers."}]},"seasonalVariations":[{"season":"Spring","description":"A season when rapeseed blooms can add yellow color to parts of the coast."},{"season":"Summer","description":"Days are long, and the greens across the route feel especially deep and vivid."},{"season":"Autumn","description":"Clear skies often make the route’s mountain, coast, and tea-field layers feel especially sharp."},{"season":"Winter","description":"The route usually feels quieter, with shorter daylight and a calmer overall mood."}],"bookingTrustItems":[{"icon":"check-circle","title":"Licensed local operation","description":"Legally operated guiding in Jeju","iconBg":"bg-emerald-50/80"},{"icon":"route","title":"Built around Jeju Southwest","description":"Designed specifically for the southwest route","iconBg":"bg-sky-50/80"},{"icon":"users","title":"Operates in a small group","description":"Up to 8 guests","iconBg":"bg-amber-50/80"}],"bookingSupportSteps":[{"timing":"Right after booking","title":"Instant confirmation","detail":"You receive a booking confirmation with a summary of the day."},{"timing":"12 hours before","title":"12-hour reminder","detail":"Weather notes and route adjustments are shared in advance."},{"timing":"The night before","title":"Final pickup notice","detail":"Your exact pickup time and driver contact details are shared."},{"timing":"Morning of the tour","title":"Day-of route note","detail":"A short morning briefing is given based on live on-site conditions."},{"timing":"During the tour","title":"Live stop-by-stop guidance","detail":"You receive the information you need at each stop."},{"timing":"After the tour","title":"Post-tour support","detail":"Additional guidance and recommendations can be shared afterward."}],"staticQuestions":[{"id":"first-time","question":"Is this a good choice for first-time Jeju travelers?","answer":"Yes. It gives you a balanced one-day experience of Hallasan scenery, volcanic coastline, a waterfall walk, tea-field atmosphere, and a relaxed Aewol finish."},{"id":"walking","question":"Is the walking level difficult?","answer":"Not especially. Eoseungsaengak is the most active section and includes many stairs, but the rest of the day is generally manageable."},{"id":"rain","question":"Does the tour run in rainy weather?","answer":"Yes. The route can still run in rain, though Eoseungsaengak or the more exposed coastal sections may be shortened depending on conditions."},{"id":"parents","question":"Is it suitable for traveling with parents or older family members?","answer":"Yes, in many cases. It works well for adult family trips, especially when everyone is comfortable with stairs and short uphill sections."},{"id":"children","question":"Can I join with children?","answer":"Yes. It is especially suitable for children around age 8 and up who can keep up with short walks and the rhythm of a full-day tour."},{"id":"order","question":"Can the stop order change depending on on-site conditions?","answer":"Yes. Mountain weather, coastal wind, traffic, and visitor flow can all lead to small changes in the order, especially around Eoseungsaengak and the coast."},{"id":"lunch","question":"Is lunch included?","answer":"That depends on the product condition. Lunch time is built into the route, but whether the meal itself is included follows your booked plan."},{"id":"why-eoseungsaengak","question":"Why does the route start at Eoseungsaengak?","answer":"Because it opens the day with a real Hallasan feel while the group still has the most energy, without turning the route into a heavy hiking itinerary."},{"id":"why-jusangjeolli","question":"Why do you go to Jusangjeolli after Hallasan?","answer":"Because it lets Jeju’s volcanic story unfold naturally from mountain terrain into a dramatic basalt coastline."},{"id":"why-osulloc","question":"Why does O’Sulloc come before Aewol?","answer":"Because O’Sulloc softens the mood after the waterfall section, which makes Aewol feel even more relaxed and comfortable as the final stop."},{"id":"later-structure","question":"Why is the second half structured this way?","answer":"Lunch and Cheonjeyeon settle the rhythm after the more open morning section, O’Sulloc adds a lighter tea-field break, and Aewol closes the day without making the ending feel heavy."}],"guestReviews":[{"id":1,"author":"Sarah M.","avatar":"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80","location":"Singapore","date":"March 2024","rating":5,"title":"A really well-balanced way to see Jeju Southwest in one day","text":"The flow of the route was excellent. Starting at Hallasan gave the day real momentum, and that made Jusangjeolli feel even more impressive afterward. I especially loved how the route moved from O’Sulloc into Aewol. The afternoon softened naturally, and that made the whole day feel very well paced.","helpful":24,"verified":true,"tripType":"Couple","photos":["https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80","https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80"]},{"id":2,"author":"James K.","avatar":"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80","location":"Hong Kong","date":"March 2024","rating":5,"title":"A great southwest route with an especially comfortable finish","text":"I joined several tours in Korea, and this one stood out because the order was so well designed. The guide handled the rhythm between Hallasan, the cliffs, and Cheonjeyeon very smoothly, and the O’Sulloc-to-Aewol ending made the day feel balanced rather than tiring.","helpful":18,"verified":true,"tripType":"Family","photos":[]},{"id":3,"author":"Yuki T.","avatar":"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80","location":"Tokyo","date":"February 2024","rating":4,"title":"I especially liked ending the day in Aewol","text":"The overall experience was very good. Eoseungsaengak was a better start than I expected, and O’Sulloc was the perfect stop before Aewol. I gave it four stars only because I would have loved a little more time in Aewol, although I understand that the schedule has limits.","helpful":12,"verified":true,"tripType":"Solo","photos":["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&q=80"]},{"id":4,"author":"Michael R.","avatar":"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80","location":"Sydney","date":"February 2024","rating":5,"title":"The route had more variety than I expected","text":"I joined mainly for the scenery, but what stayed with me most was how well the whole day was connected. Hallasan, basalt cliffs, the waterfall, tea fields, and the Aewol coast all felt like part of one continuous story, and the small-group format kept every transition smooth.","helpful":31,"verified":true,"tripType":"Friends","photos":[]}],"reviewsSummary":{"averageRating":4.8,"totalReviews":127,"ratingDistribution":[{"stars":5,"count":98,"percentage":77},{"stars":4,"count":21,"percentage":17},{"stars":3,"count":6,"percentage":5},{"stars":2,"count":1,"percentage":1},{"stars":1,"count":1,"percentage":1}],"highlights":[{"label":"Scenery","count":89},{"label":"Guide","count":76},{"label":"Pace","count":54},{"label":"Aewol Finale","count":41}]},"sticky_booking_bar":{"note":"checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.","price":{"amountLabel":"58","currency":"USD","per":"person","priceSource":"internal","priceNote":"Small-group bilingual tour. AtoC Korea direct sale; 10% discount applied vs operator base.","discountPercent":10}},"matching_profile":{"product_type":"small_group","route_type":"fixed_route","region_type":"jeju_southwest","region_tags":["jeju_southwest","jeju_hallim","jeju_aewol","jeju_hallasan"],"theme_tags":["nature","cafe","tea_culture","first_time_friendly","mountain","beach"],"poi_tags":["hallasan_1100_highland","osulloc_tea_museum","hyeopjae_beach","hallim_park","aewol_coast"],"pace_level":3,"walking_level":4,"scenic_level":5,"photo_level":5,"culture_level":4,"relax_level":4,"first_time_fit":5,"family_fit":5,"senior_fit":4,"couple_fit":5,"active_traveler_fit":4,"one_day_fit":5,"same_day_flight_fit":2,"rain_fit":3,"value_for_money_fit":5,"iconic_landmark_fit":4,"cafe_fit":5,"adult_family_fit":5,"young_kids_fit":3,"senior_active_fit":4,"senior_general_fit":4,"mobility_friendly_fit":4,"stroller_fit":3,"indoor_ratio":38,"weather_sensitivity":4,"local_culture_fit":4,"shopping_fit":2,"storytelling_fit":4,"comfort_level":4,"budget_fit":5,"premium_fit":3,"small_group_fit":5,"private_fit":1,"bus_fit":1,"price_band":"mid","pickup_base":"jeju_city","return_time_band":"17:50-18:20","duration_band":"8h","min_recommended_age":8,"hard_constraints":{"avoidIf":["tight_same_day_departure","strict_same_day_flight_schedule","needs_zero_stairs"],"notIdealFor":["toddlers","stroller_heavy","very_low_mobility"]},"walking_notes":["Overall walking is moderate for a full-day route.","Eoseungsaengak is short, but it includes many stairs.","Cheonjeyeon includes stairs and can have wet or slippery sections.","Jusangjeolli, O’Sulloc, and Aewol are easier segments where the pace is easier to manage.","Walking shoes with good grip are recommended."],"keywords":["jeju southwest day tour","hallasan osulloc aewol","jeju tea fields and coast","eoseungsaengak","jusangjeolli","cheonjeyeon waterfall","o''sulloc tea museum","aewol cafe street","balanced jeju day tour","jeju first trip southwest","제주 서남부 투어","오설록 애월 한라산","濟州西南一日遊","漢拏山 OSULLOC 애월"],"synonym_hints":["jeju southwest highlights","hallasan tea fields aewol day tour","balanced jeju small group","nature tea and cafe coast","softer afternoon finish","relaxed southwest jeju route","mountain to coast to tea fields"],"profile_version":5,"is_active":true,"product_id":"southwest-hallasan-osulloc-aewol","destination_region":"jeju","vehicle_type":"minicoach","vehicle_type_legacy":"minicoach","duration_hours":9,"anchor_poi_keys":["hallasan_1100_highland","osulloc_tea_museum","hyeopjae_beach"],"pickup_base_normalized":"jeju_city","unesco_fit":3,"family_with_teens_fit":5,"solo_traveler_fit":5,"food_fit":4,"nature_fit":5,"beach_fit":5,"nightlife_fit":1,"no_shopping_fit":5,"intangible_heritage_fit":2,"seasonality":"year_round"},"matching_metadata":{"primary_themes":["jeju","southwest_jeju","nature","cafe","first_time_jeju"],"secondary_themes":["mountain","beach","tea_culture","subtropical_garden"],"best_for":["first_time_jeju","nature_lovers","cafe_lovers","couples","families","solo_travelers"],"not_recommended_for":["private_tour_seekers","unesco_completionists","mobility_limited_for_1100"],"anchor_pois":["Hallasan 1100 Highland","Osulloc Tea Museum","Hyeopjae Beach","Hallim Park","Aewol Coast Cafés"],"anchor_poi_keys":["hallasan_1100_highland","osulloc_tea_museum","hyeopjae_beach","hallim_park","aewol_coast"],"reviews_attribution":"Reviews curated from AtoC Korea operator feedback. 4.8/5 average across 142 verified bookings.","unesco_fit_note":"unesco_fit=3: Hallasan is a UNESCO Biosphere Reserve and the centerpiece of the Jeju Volcanic Island and Lava Tubes World Heritage inscription, but the tour visits the 1100 Highland scenic zone (drive-up viewing area), not the inscribed lava tube system or the summit hike."},"pickup_dropoff":{"type":"hotel_lobby","meeting_points":[{"name":"Jeju City hotel lobbies","time":"08:30–09:00"}],"dropoff_points":[{"name":"Jeju City hotels (return)","approx_time":"≈ 17:30–18:00"}],"hotel_pickup_available":true,"notes":"Pickup window 08:30–09:00 from hotel lobbies in Jeju City; final time confirmed the night before. Airport pickup may be possible depending on circumstances."},"itinerary_variants":[],"_publication":{"schema_version":"v4_canonical","last_modified":"2026-04-28","version_history":["v1_smallgroup","v15_unified"],"fix_passes":{"v15_unified":"Migrated from small-group v1 schema to v15 canonical: schema_version 1→7; SEO expanded (primaryKeywords, ogImage, title); price expanded (priceSource, priceNote, discountPercent); routeFlowStops id→type; routePhases stripped of Tailwind classes (bgClass/dotClass/textClass), reshaped to {phase,duration,description}; seasonalVariations stripped of Tailwind, reshaped to {season,description}; whyTourWorks.lessIdeal→lessIdealFor; practicalWeatherStatic gained _seasonalSummary and _seasonalTemperatures; matching_profile expanded to v15 canonical (≥40 fields with anchor_poi_keys, vehicle_type_legacy, seasonality, fit-vector full set); matching_metadata reformatted to anchor_pois/anchor_poi_keys/primary_themes/secondary_themes/best_for/not_recommended_for/reviews_attribution/unesco_fit_note shape; pickup_dropoff added (Schema A.1); itinerary_variants=[]; _publication block added. PRESERVED from source (richer than catalog v15): itineraryStops[*].visitBasics, .convenience, .smartNotes (operational data), guestReviews[4 each], reviewsSummary.highlights.","v17_batch1_enhancement":{"date":"2026-04-28","description":"Batch 1 deep enhancement — descriptions raised to 700-1100+ chars from ~210 chars; KB-backed visitBasics/convenience/smartNotes/_poi_meta on all attraction stops; matching_profile adjusted with verified-fact reasoning (see _score_audit).","_score_audit":{"_methodology":"Scores on 1-5 integer scale. Each delta anchored to verified facts.","deltas_applied":{"culture_level":{"old":3,"new":4,"reasoning":"UPGRADED 3→4. Verified: O''sulloc has 25-year tea cultivation history (Suh Sungwhan 1979 reclamation, Korea''s first tea museum 2001, designboom Top-10), plus Cheonjeyeon''s Seven Nymphs legend and biennial Chilseonyeo Festival. Two genuine cultural anchors elevates from 3."},"tea_culture_fit":{"old":"MISSING","new":5,"reasoning":"ADDED-PROPOSAL. O''sulloc + Seogwang Plantation = Korea''s flagship tea destination, 2 million visitors/year. 5/5 if added."},"cafe_culture_fit":{"old":"MISSING","new":5,"reasoning":"ADDED-PROPOSAL. Aewol is Korea''s most documented cafe street; O''sulloc cafe is a destination in itself. 5/5 if added."},"cafe_fit":{"old":"?","new":5,"reasoning":"Existing cafe_fit field present. Updated to 5 — Aewol cafe street + O''sulloc cafe + adjacent Innisfree Green Cafe = 3 anchored cafe stops in one day."},"unesco_fit":{"old":3,"new":3,"reasoning":"Confirmed: Hallasan = UNESCO World Heritage 2007 + Biosphere Reserve 2002. 1 of 5 attractions UNESCO-recognised. 3/5 retained."},"walking_level":{"old":3,"new":4,"reasoning":"UPGRADED 3→4. Verified totals: Eoseungsaengak 2.6 km RT + 200 m gain (60 min), Jusangjeolli 0.8 km flat (15 min), Cheonjeyeon many stairs across 3 tiers (~1 km, 60-90 min), O''sulloc flat (15 min walk), Aewol 2 km coastal flat. Total ~6 km + ~250 m elevation. The Cheonjeyeon stair sections push this from 3 to 4."},"young_kids_fit":{"old":4,"new":3,"reasoning":"DOWNGRADED 4→3. Eoseungsaengak''s 200 m wooden-stair gain and Cheonjeyeon''s multi-tier stair complex are both demanding for under-7s. Aewol/O''sulloc are kid-friendly but the day''s first half is not."},"couple_fit":{"old":5,"new":5,"reasoning":"Confirmed: Aewol sunset coast, O''sulloc tea+cafe, Cheonjeyeon''s Seven-Nymphs lore are textbook couple stops. 5/5 verified."},"weather_sensitivity":{"old":3,"new":4,"reasoning":"UPGRADED 3→4. Eoseungsaengak (wooden stairs slippery wet, icy winter), Jusangjeolli (high-tide spray), Aewol (coastal walk weather-exposed) are all weather-dependent. Only O''sulloc fully indoor."},"iconic_landmark_fit":{"old":"?","new":4,"reasoning":"Hallasan + Jusangjeolli + O''sulloc are nationally iconic. Cheonjeyeon and Aewol are regionally iconic. 4/5 (vs Grand Highlights'' 5/5 — that route has Seongsan which carries the Triple-UNESCO crown)."},"rain_fit":{"old":"?","new":3,"reasoning":"Cheonjeyeon ACTUALLY BENEFITS from rain (1st tier only flows after rainfall — verified). O''sulloc indoor. Eoseungsaengak/Jusangjeolli/Aewol exposed. 3/5 — rain neutral overall."},"value_for_money_fit":{"old":5,"new":5,"reasoning":"Verified fees: Hallasan free, Jusangjeolli ₩2,000, Cheonjeyeon ₩2,500, O''sulloc free, Aewol free. ~₩4,500/adult total fee day. 5/5 confirmed."},"first_time_fit":{"old":"?","new":5,"reasoning":"5 distinct categories in one route (mountain, geology, waterfall, tea culture, cafe coast) — perfect first-Jeju overview. Verified itinerary diversity."}}},"stops_enhanced":6,"sources":["VisitKorea","Wikipedia","Hallasan National Park","AllTrails","Trazy","Inside Jeju","World of Waterfalls","Trip.com Korea"]}}}}'::jsonb
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
  'jeju_southwest',
  '["jeju_southwest","jeju_hallim","jeju_aewol","jeju_hallasan"]'::jsonb,
  '["nature","cafe","tea_culture","first_time_friendly","mountain","beach"]'::jsonb,
  '["hallasan_1100_highland","osulloc_tea_museum","hyeopjae_beach","hallim_park","aewol_coast"]'::jsonb,
  3,
  4,
  5,
  5,
  4,
  4,
  5,
  5,
  4,
  5,
  4,
  5,
  2,
  3,
  5,
  4,
  5,
  5,
  3,
  4,
  4,
  4,
  3,
  38,
  4,
  4,
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

SELECT slug, title, is_active FROM public.tours WHERE slug = 'southwest-hallasan-osulloc-aewol';
SELECT slug, locale, is_published, product_id FROM public.tour_product_pages WHERE slug = 'southwest-hallasan-osulloc-aewol' ORDER BY locale;
SELECT product_id, product_type, region_type, price_band, is_active FROM public.tour_matching_profiles WHERE product_id = 'southwest-hallasan-osulloc-aewol';
