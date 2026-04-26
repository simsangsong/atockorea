-- =============================================================================
-- busan-city-tour-shore-excursion-cruise-guests — small-group tour product (tour_product v2)
-- =============================================================================
-- Generated: 2026-04-25T18:10:19.171Z
-- Script: scripts/gen-tour-product-sql.mjs
-- Locales emitted: en
-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);
--            tour_product_offers inserted only when no default offer exists;
--            tour_matching_profiles ON CONFLICT (product_id)
-- Web: /tour-product/busan-city-tour-shore-excursion-cruise-guests
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
  'Busan City Tour Shore Excursion for Cruise Guests',
  'busan-city-tour-shore-excursion-cruise-guests',
  'Busan',
  'Small group · Busan Cruise Port',
  'A cruise-day Busan highlights route with direct port pickup, seaside temple views, Korean War history, Songdo coast, Gamcheon alleys, and a Nampo/Jagalchi finish.',
  'A Busan shore excursion built specifically for cruise passengers. The route prioritizes on-time return to port while still giving first-time visitors a strong mix of Busan’s coastline, Buddhist culture, Korean War memory, hillside art, local market atmosphere, and old-downtown harbor views.',
  'A cruise-day Busan highlights route with direct port pickup, seaside temple views, Korean War history, Songdo coast, Gamcheon alleys, and a Nampo/Jagalchi finish.',
  79.00,
  NULL,
  'USD',
  'person',
  'https://tong.visitkorea.or.kr/cms/resource/35/3499335_image2_1.jpg',
  '["https://tong.visitkorea.or.kr/cms/resource/35/3499335_image2_1.jpg","https://tong.visitkorea.or.kr/cms/resource/11/2668611_image2_1.jpg","https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80","https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80","https://tong.visitkorea.or.kr/cms/resource/91/3365491_image2_1.jpg","https://tong.visitkorea.or.kr/cms/resource/13/2941313_image2_1.bmp"]'::jsonb,
  'Flexible 6–9 hours',
  'Moderate',
  'Small group',
  FALSE,
  FALSE,
  'Pickup confirmed after booking.',
  'Weather and operational conditions may shift the stop order or duration.',
  '["Cruise Port Pickup","Port-Return Priority","No Shopping Stops"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"time":"Variable","title":"Cruise Terminal Pickup","description":"Port Pickup and Schedule Check"},{"time":"After pickup","title":"Haedong Yonggungsa Temple","description":"Seaside Buddhist Temple"},{"time":"Midday","title":"United Nations Memorial Cemetery","description":"Korean War History and Memorial Site"},{"time":"Midday or Early Afternoon","title":"Songdo Beach, Cloud Walk & Optional Marine Cable Car","description":"Coastal View and Optional Cable Car"},{"time":"Flexible","title":"Lunch at a Local Restaurant","description":"Free-Choice Lunch Break"},{"time":"Afternoon","title":"Gamcheon Culture Village","description":"Hillside Art Village and Viewpoint"},{"time":"Late Afternoon","title":"Yongdusan Park, Nampo-dong & Jagalchi Market","description":"Old Downtown, Harbor View and Seafood Market"},{"time":"Before all-aboard time","title":"Return to Cruise Terminal","description":"Port Return"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  0,
  0,
  2,
  0,
  TRUE,
  FALSE,
  '{}'::jsonb,
  'Busan Shore Excursion for Cruise Guests | Port Pickup, Temple, UN Memorial, Songdo, Gamcheon & Jagalchi | AtoC Korea',
  'A Busan shore excursion designed for cruise guests with port pickup and return, covering Haedong Yonggungsa Temple, the UN Memorial Cemetery, Songdo Beach or optional cable car, local lunch time, Gamcheon Culture Village, Yongdusan Park, Nampo-dong, and Jagalchi Market. Built around a port-return-first schedule for cruise-day safety.'
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
  'busan-city-tour-shore-excursion-cruise-guests',
  'en',
  'busan-city-tour-shore-excursion-cruise-guests',
  TRUE,
  1,
  (SELECT id FROM public.tours WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests' LIMIT 1),
  'Busan City Tour Shore Excursion for Cruise Guests',
  'A cruise-day Busan highlights route with direct port pickup, seaside temple views, Korean War history, Songdo coast, Gamcheon alleys, and a Nampo/Jagalchi finish.',
  'Busan Cruise Port',
  'Flexible 6–9 hours',
  7,
  0,
  0,
  ARRAY['Cruise Port Pickup', 'Port-Return Priority', 'No Shopping Stops']::text[],
  'https://tong.visitkorea.or.kr/cms/resource/35/3499335_image2_1.jpg',
  'https://tong.visitkorea.or.kr/cms/resource/91/3365491_image2_1.jpg',
  'A Busan shore excursion built specifically for cruise passengers. The route prioritizes on-time return to port while still giving first-time visitors a strong mix of Busan’s coastline, Buddhist culture, Korean War memory, hillside art, local market atmosphere, and old-downtown harbor views.',
  'Busan Shore Excursion for Cruise Guests | Port Pickup, Temple, UN Memorial, Songdo, Gamcheon & Jagalchi | AtoC Korea',
  'A Busan shore excursion designed for cruise guests with port pickup and return, covering Haedong Yonggungsa Temple, the UN Memorial Cemetery, Songdo Beach or optional cable car, local lunch time, Gamcheon Culture Village, Yongdusan Park, Nampo-dong, and Jagalchi Market. Built around a port-return-first schedule for cruise-day safety.',
  'Busan Shore Excursion',
  'for Cruise Guests',
  '79',
  'USD',
  'person',
  '{"document_kind":"tour_product_full_page_v1","schema_version":1,"slug":"busan-city-tour-shore-excursion-cruise-guests","locale":"en","product_id":"busan-city-tour-shore-excursion-cruise-guests","seo":{"pageTitle":"Busan Shore Excursion for Cruise Guests | Port Pickup, Temple, UN Memorial, Songdo, Gamcheon & Jagalchi | AtoC Korea","metaDescription":"A Busan shore excursion designed for cruise guests with port pickup and return, covering Haedong Yonggungsa Temple, the UN Memorial Cemetery, Songdo Beach or optional cable car, local lunch time, Gamcheon Culture Village, Yongdusan Park, Nampo-dong, and Jagalchi Market. Built around a port-return-first schedule for cruise-day safety."},"catalog_card":{"slug":"busan-city-tour-shore-excursion-cruise-guests","title":"Busan City Tour Shore Excursion for Cruise Guests","subtitle":"A cruise-day Busan highlights route with direct port pickup, seaside temple views, Korean War history, Songdo coast, Gamcheon alleys, and a Nampo/Jagalchi finish.","region":"Busan Cruise Port","duration":"Flexible 6–9 hours","stopsCount":7,"rating":0,"reviewCount":0,"badges":["Cruise Port Pickup","Port-Return Priority","No Shopping Stops"],"heroImage":"https://tong.visitkorea.or.kr/cms/resource/35/3499335_image2_1.jpg","thumbnail":"https://tong.visitkorea.or.kr/cms/resource/91/3365491_image2_1.jpg","priceLabel":"From US$79 per person","shortCardDescription":"A Busan shore excursion built specifically for cruise passengers. The route prioritizes on-time return to port while still giving first-time visitors a strong mix of Busan’s coastline, Buddhist culture, Korean War memory, hillside art, local market atmosphere, and old-downtown harbor views."},"headlineLine1":"Busan Shore Excursion","headlineLine2":"for Cruise Guests","price":{"amountLabel":"79","currency":"USD","per":"person"},"hero":{"imageUrl":"https://tong.visitkorea.or.kr/cms/resource/35/3499335_image2_1.jpg","imagePosition":"center 46%","tagline":"Designed around your ship schedule, this Busan shore excursion connects a dramatic seaside temple, a solemn UN memorial, Songdo’s oceanfront, Gamcheon’s colorful hillside alleys, and the Nampo/Jagalchi harbor district while keeping port return as the operating priority.","pills":["Busan Cruise Port","Shore Excursion","On-Time Return Priority"],"meta":{"duration":"Flexible 6–9 hours","region":"Busan","stops":"7 stops","rating":0,"ratingStars":0}},"subnavItems":[{"id":"overview","label":"Overview"},{"id":"itinerary","label":"Itinerary"},{"id":"details","label":"Details"},{"id":"faq","label":"FAQ"},{"id":"reviews","label":"Reviews"}],"glanceItems":[{"icon":"ship","label":"Cruise Suitability","value":"Very High"},{"icon":"camera","label":"Photo Potential","value":"Very High"},{"icon":"landmark","label":"Culture & History","value":"High"},{"icon":"footprints","label":"Walking Difficulty","value":"Moderate to Active"},{"icon":"clock","label":"Time Buffer","value":"Port-First"},{"icon":"cloud-rain","label":"Rain Suitability","value":"Limited"}],"galleryItems":[{"id":1,"type":"photo","src":"https://tong.visitkorea.or.kr/cms/resource/35/3499335_image2_1.jpg","location":"Haedong Yonggungsa Temple","atmosphere":"A rare seaside temple opening that gives cruise guests a strong Busan identity immediately after leaving the port.","alt":"Haedong Yonggungsa Temple seaside view for a Busan shore excursion"},{"id":2,"type":"photo","src":"https://tong.visitkorea.or.kr/cms/resource/11/2668611_image2_1.jpg","location":"United Nations Memorial Cemetery","atmosphere":"A calm historical stop that explains Busan’s Korean War memory with more emotional weight than a simple viewpoint.","alt":"United Nations Memorial Cemetery in Korea in Busan"},{"id":3,"type":"photo","src":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80","location":"Songdo Beach & Coastal Area","atmosphere":"A flexible seaside stop where the route can stay simple with a beach and skywalk walk or add the cable car when time and tickets allow.","alt":"Songdo Beach coastal atmosphere in Busan"},{"id":4,"type":"photo","src":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80","location":"Local Restaurant Lunch","atmosphere":"A practical reset stop that can be adjusted depending on ship schedule, group pace, and dietary needs.","alt":"Local lunch break on a Busan shore excursion"},{"id":5,"type":"photo","src":"https://tong.visitkorea.or.kr/cms/resource/91/3365491_image2_1.jpg","location":"Gamcheon Culture Village","atmosphere":"Colorful hillside houses, murals, alleys, and harbor-facing viewpoints create the most photogenic urban stop of the day.","alt":"Gamcheon Culture Village colorful hillside houses in Busan"},{"id":6,"type":"photo","src":"https://tong.visitkorea.or.kr/cms/resource/13/2941313_image2_1.bmp","location":"Yongdusan Park, Nampo-dong & Jagalchi Market","atmosphere":"Old-downtown Busan, harbor views, seafood-market energy, and an efficient final zone before returning to the cruise terminal.","alt":"Jagalchi Market and Nampo-dong harbor district in Busan"}],"itineraryStops":[{"number":1,"time":"Variable","duration":"30–45 min","name":"Cruise Terminal Pickup","category":"Port Pickup and Schedule Check","description":"The tour begins at the Busan cruise terminal assigned to your ship. Because Busan cruise calls can use different port facilities, the exact meeting point is confirmed from your cruise information before the tour. The guide waits inside the terminal arrival area with a clear sign, checks the ship’s all-aboard time, and adjusts the route length before departure.","image":"https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=1200&q=80","highlights":["Direct cruise-port pickup and drop-off","Route timing adjusted to ship arrival and departure","Guide sign meeting inside the terminal arrival area","Port-return-first operation before sightseeing ambition"],"timeUsed":["Disembarkation and meeting inside the terminal","Passenger check and WhatsApp contact confirmation","Ship departure time confirmation and route timing briefing"],"whyOnRoute":"A shore excursion must start with schedule control. Confirming the ship’s return deadline before leaving the terminal protects the whole day from cruise timing risk.","visitBasics":{"hours":"According to cruise ship arrival and local terminal operation","closed":"Subject to cruise call and port authority operation","admission":"Not applicable","walking":"Easy inside the terminal, but walking distance may vary by berth and disembarkation flow"},"convenience":{"restroom":"Available inside the terminal","parking":"Tour vehicle staging depends on terminal traffic control"},"smartNotes":{"photo":"This is an operational stop, not a sightseeing stop.","facilities":"Busan Port International Passenger Terminal has arrival, passenger service, CIQ, and amenity facilities; cruise berth arrangements can vary.","tip":"Do not leave the terminal area if you cannot find the guide. Stay inside and contact the operator by WhatsApp."}},{"number":2,"time":"After pickup","duration":"60 min","name":"Haedong Yonggungsa Temple","category":"Seaside Buddhist Temple","description":"Haedong Yonggungsa Temple is one of Busan’s most distinctive first stops because it combines Buddhist architecture with a rocky coastline rather than a mountain setting. For cruise guests, it delivers a strong sense of Busan’s coastal identity early in the day, with sea-facing prayer halls, stone paths, ocean sound, and dramatic photo angles.","image":"https://tong.visitkorea.or.kr/cms/resource/35/3499335_image2_1.jpg","highlights":["A rare Korean temple built directly beside the sea","Strong first-stop impact for cruise passengers with limited time in Busan","Good storytelling value around Korean Buddhism, prayer customs, and coastal belief","High photo reward from the bridge, coastal trail, and sea-view areas"],"timeUsed":["Guide briefing at the entrance and stair approach","Temple grounds, sea-view photo points, and short free time","Regroup and return to vehicle"],"whyOnRoute":"It creates immediate destination value after port pickup and gives the itinerary a memorable coastal-culture opening before moving into Busan’s history and city sections.","visitBasics":{"hours":"04:30–19:20; last entry by 18:50","closed":"Open year-round","admission":"Free","walking":"Moderate; stairs and uneven outdoor temple paths"},"convenience":{"restroom":"Available","parking":"Parking available; charged parking may apply"},"smartNotes":{"photo":"Frame the temple with the ocean and rock line, not only the buildings. The seaside setting is what makes the stop different.","facilities":"This is an active religious site, so group movement should remain quiet and respectful.","tip":"The stairs and crowds make this stop unsuitable for travelers requiring step-free access."}},{"number":3,"time":"Midday","duration":"50–60 min","name":"United Nations Memorial Cemetery","category":"Korean War History and Memorial Site","description":"The United Nations Memorial Cemetery in Korea gives the route historical depth. It is a quiet and carefully maintained memorial site for UN personnel who served during the Korean War, and it helps visitors understand why Busan has a different wartime memory from many other Korean cities.","image":"https://tong.visitkorea.or.kr/cms/resource/11/2668611_image2_1.jpg","highlights":["A solemn historical site with strong storytelling value","Free admission and reliable visitor structure","Useful context for Busan’s role during the Korean War","A calm contrast after the busy seaside temple stop"],"timeUsed":["Guide introduction before entering the memorial area","Memorial grounds and selected explanation points","Quiet reflection time and regroup"],"whyOnRoute":"For cruise guests who may only see Busan once, this stop adds historical meaning and emotional balance instead of making the day only about photos.","visitBasics":{"hours":"09:00–17:00 from October to April; 09:00–18:00 from May to September","closed":"Open 365 days according to UNMCK visitor information","admission":"Free","walking":"Easy to moderate; mostly open memorial grounds"},"convenience":{"restroom":"Available","parking":"Parking and group-vehicle access may depend on site controls"},"smartNotes":{"photo":"Keep photography respectful. This is a memorial cemetery, not a casual photo zone.","facilities":"The site is organized and visitor-friendly, but conduct should remain quiet and respectful.","tip":"This stop works especially well for travelers interested in history, veterans, and the Korean War."}},{"number":4,"time":"Midday or Early Afternoon","duration":"75–90 min","name":"Songdo Beach, Cloud Walk & Optional Marine Cable Car","category":"Coastal View and Optional Cable Car","description":"Songdo gives the shore excursion a flexible coastal middle section. The area can be kept light with Songdo Beach and the Cloud Walk, or upgraded with the Songdo Marine Cable Car when time, weather, and ticket availability allow. This flexibility is useful for cruise days because the guide can protect the return buffer without losing the ocean-view character of the tour.","image":"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80","highlights":["Songdo Beach is known as Korea’s first public beach","Songdo Cloud Walk provides a short overwater skywalk-style experience","Marine Cable Car can be added on-site as an optional paid experience","A good adjustable stop for cruise guests because the duration can be expanded or compressed"],"timeUsed":["Coastal walk and beach/skywalk viewing","Optional cable car boarding if time and tickets allow","Photo time and regroup"],"whyOnRoute":"Songdo sits well between the UN Memorial/Gamcheon side and the Nampo/Jagalchi port-return side, giving the route ocean scenery without forcing a long detour late in the day.","visitBasics":{"hours":"Outdoor beach and coastal area generally open; Songdo Marine Cable Car hours vary by season, commonly 09:00–20:00/21:00/22:00 depending on month","closed":"Cable car generally open year-round, but operation can change due to weather or safety conditions","admission":"Beach and Cloud Walk are free; Songdo Marine Cable Car is optional and paid on-site","walking":"Easy to moderate; cable car boarding may involve queueing and stairs/elevators depending on conditions"},"convenience":{"restroom":"Available in the beach/cable car area","parking":"Parking available near Songdo Bay Station; traffic can be busy in peak season"},"smartNotes":{"photo":"The best visual combination is beach, cable cars, and sea in one frame.","facilities":"Facilities are strong for a coastal stop, but optional cable car timing depends on queues and ship schedule.","tip":"For cruise excursions, the cable car should remain optional unless tickets and time buffer are secured."}},{"number":5,"time":"Flexible","duration":"50–60 min","name":"Lunch at a Local Restaurant","category":"Free-Choice Lunch Break","description":"Lunch is planned as a practical local-restaurant stop rather than a rigid fixed menu. The exact location can be adjusted according to traffic, the ship schedule, and the route pace. Vegetarian, vegan, allergy-related, or special menu needs should be shared in advance so the guide can choose a workable lunch area.","image":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80","highlights":["Flexible lunch stop that can protect the port-return buffer","Meal cost is not included unless configured differently at checkout","Special dietary needs can be considered if shared in advance","A needed reset between major sightseeing sections"],"timeUsed":["Guide explanation of lunch options","Free-choice meal time","Regroup and departure"],"whyOnRoute":"A shore excursion cannot allow lunch to consume the return buffer. Keeping this stop flexible allows the guide to adapt without damaging the main sightseeing route.","visitBasics":{"hours":"Depends on the selected restaurant area and ship schedule","closed":"Varies by restaurant","admission":"Meal cost not included","walking":"Easy"},"convenience":{"restroom":"Available at or near the restaurant","parking":"Depends on restaurant area and vehicle size"},"smartNotes":{"photo":"This is primarily a comfort and timing stop rather than a sightseeing highlight.","facilities":"Restaurant facilities vary by selected location.","tip":"Share dietary restrictions before the tour day, not at the restaurant."}},{"number":6,"time":"Afternoon","duration":"75–90 min","name":"Gamcheon Culture Village","category":"Hillside Art Village and Viewpoint","description":"Gamcheon Culture Village is one of Busan’s most recognizable urban photo stops, with pastel hillside houses, murals, alleys, and sea-facing viewpoints. It is also a real residential neighborhood, so the visit should balance photo time with respectful movement through narrow lanes and lived-in spaces.","image":"https://tong.visitkorea.or.kr/cms/resource/91/3365491_image2_1.jpg","highlights":["Busan’s signature colorful hillside village","Strong photo value for cruise passengers who want a clear Busan memory","Good walking-storytelling stop with views, murals, and alleys","Real residential village, so quiet and cleanliness are important"],"timeUsed":["Guide orientation and viewpoint introduction","Main photo spots and alley walk","Free time near the central visitor zone and regroup"],"whyOnRoute":"Gamcheon gives the route a very different texture from the temple and coastline. It also sits close enough to Nampo/Jagalchi to work well before the final port-return zone.","visitBasics":{"hours":"March–October 09:00–18:00; November–February 09:00–17:00 according to Visit Busan visitor guidance","closed":"Open year-round","admission":"Free, except parking or optional purchases","walking":"Moderate to active; slopes, stairs, narrow alleys, and uneven surfaces"},"convenience":{"restroom":"Available near visitor areas","parking":"Public parking exists but can be limited and busy"},"smartNotes":{"photo":"Wide hillside shots from the viewpoint are usually more useful than only close-up mural photos.","facilities":"Visitor support exists, but the village is not a flat theme park.","tip":"This is not ideal for guests who require step-free access or who dislike hills."}},{"number":7,"time":"Late Afternoon","duration":"60–90 min","name":"Yongdusan Park, Nampo-dong & Jagalchi Market","category":"Old Downtown, Harbor View and Seafood Market","description":"The final sightseeing zone brings the tour back toward Busan’s old downtown and port side. Yongdusan Park provides an easy city-view stop, Busan Tower is optional and paid if time allows, Nampo-dong adds shopping-street energy, and Jagalchi Market gives the day a strong local seafood-market finish before returning to the cruise terminal.","image":"https://tong.visitkorea.or.kr/cms/resource/13/2941313_image2_1.bmp","highlights":["Efficient final zone close to the port-return side of the city","Yongdusan Park is free; Busan Tower/Diamond Tower is optional and paid","Nampo-dong adds old-downtown shopping and street atmosphere","Jagalchi Market is one of Korea’s largest seafood markets"],"timeUsed":["Yongdusan Park orientation and optional tower decision","Short Nampo-dong walk depending on timing","Jagalchi Market visit or quick final photo stop","Depart for cruise terminal with return buffer"],"whyOnRoute":"Ending here is operationally logical for cruise guests because it keeps the final sightseeing area closer to the port and reduces the risk created by ending too far away.","visitBasics":{"hours":"Yongdusan Park open year-round; Busan Tower 10:00–22:00 with last admission around 21:30; Jagalchi Market generally 05:00–22:00 except regular closure Tuesdays","closed":"Yongdusan Park open year-round; Busan Tower weather/operation may vary; Jagalchi Market closes on the 1st, 3rd and 5th Tuesdays","admission":"Yongdusan Park free; Busan Tower optional paid; Jagalchi purchases differ by store","walking":"Easy to moderate; some stairs or slopes around park access"},"convenience":{"restroom":"Available around park/market areas","parking":"Urban parking and vehicle stopping can be congested"},"smartNotes":{"photo":"For a short cruise-day finish, the best photos are usually harbor-market atmosphere and quick city-view shots rather than a long shopping walk.","facilities":"This is a busy urban zone, so group timing and clear meeting points matter.","tip":"If the ship departure is early, this section should be shortened before cutting the port-return buffer."}},{"number":8,"time":"Before all-aboard time","duration":"Variable","name":"Return to Cruise Terminal","category":"Port Return","description":"The tour ends with direct return to the assigned Busan cruise terminal. The guide prioritizes returning before the ship’s all-aboard time, and may shorten optional stops, shopping time, or the final downtown section if traffic or disembarkation delays reduce the safe operating window.","image":"https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=1200&q=80","highlights":["Direct cruise terminal drop-off","Return timing adjusted to ship departure","Optional stops can be shortened to protect the ship schedule","Final route decisions made around traffic, weather, and port deadline"],"timeUsed":["Final passenger count","Drive back to cruise terminal","Drop-off inside or near the terminal according to port controls"],"whyOnRoute":"For cruise guests, successful return to port is more important than completing every sightseeing minute. The route is designed with this priority built in.","visitBasics":{"hours":"According to ship departure and all-aboard time","closed":"Not applicable","admission":"Not applicable","walking":"Easy, but terminal distance may vary by berth"},"convenience":{"restroom":"Available inside terminal","parking":"Subject to port traffic control"},"smartNotes":{"photo":"This is an operational return, not a sightseeing stop.","facilities":"Terminal access may be controlled by port security and cruise operations.","tip":"The final return buffer should never be traded for optional shopping or paid attractions."}}],"routeFlowStops":[{"id":"01","name":"Cruise Port","theme":"Pickup"},{"id":"02","name":"Yonggungsa","theme":"Temple"},{"id":"03","name":"UN Memorial","theme":"History"},{"id":"04","name":"Songdo","theme":"Coast"},{"id":"05","name":"Lunch","theme":"Reset"},{"id":"06","name":"Gamcheon","theme":"Village"},{"id":"07","name":"Nampo/Jagalchi","theme":"Local"},{"id":"08","name":"Cruise Port","theme":"Return"}],"routePhases":[{"label":"Arrival Window","range":"1","theme":"Port Pickup and Timing Control","bgClass":"bg-sky-50/70","textClass":"text-sky-700","dotClass":"bg-sky-500"},{"label":"Core Highlights","range":"2-4","theme":"Seaside Temple, War Memory, and Songdo Coast","bgClass":"bg-cyan-50/70","textClass":"text-cyan-700","dotClass":"bg-cyan-500"},{"label":"City Culture","range":"5-7","theme":"Lunch, Gamcheon, Nampo and Jagalchi","bgClass":"bg-amber-50/70","textClass":"text-amber-700","dotClass":"bg-amber-500"},{"label":"Return Buffer","range":"8","theme":"Direct Port Return","bgClass":"bg-slate-50/70","textClass":"text-slate-700","dotClass":"bg-slate-500"}],"routeShapeIntro":{"title":"How the cruise-day route flows","subtitle":"The route starts from your cruise terminal and first locks the ship schedule. It then moves from Busan’s east-coast temple scenery to Korean War history, Songdo’s flexible oceanfront stop, a practical lunch break, Gamcheon’s hillside village, and the old-downtown Nampo/Jagalchi area before returning directly to port with a protected time buffer."},"whyTourWorks":{"bestFor":["Cruise passengers visiting Busan for one day","First-time visitors who want a broad city overview","Travelers who want direct port pickup and drop-off","Guests who prefer no-shopping sightseeing routes","Adult families and active seniors who can handle stairs and slopes"],"lessIdeal":["Travelers requiring a fully step-free itinerary","Guests with very short port calls who still want every listed stop","Visitors who want long shopping time or a slow luxury pace","Travelers uncomfortable with hills, stairs, narrow alleys, or full-day movement","Guests who need guaranteed optional cable car or tower tickets without prebooking"],"routeLogicSections":[{"title":"Why this route works for cruise guests","icon":"ship","iconBg":"bg-sky-50/80","iconColor":"text-sky-600","items":[{"label":"The route is built around the ship schedule","detail":"The guide confirms the all-aboard time before departure and adjusts optional stops before touching the return buffer."},{"label":"Strong variety without moving too far from the port late in the day","detail":"The farthest coastal temple section is handled earlier, while the final Nampo/Jagalchi section stays closer to the return side of the city."},{"label":"Optional attractions stay optional","detail":"Songdo Cable Car and Busan Tower are useful upgrades, but they should not endanger cruise return timing when queues, traffic, or weather are unfavorable."}]},{"title":"How the sightseeing balance works","icon":"landmark","iconBg":"bg-emerald-50/80","iconColor":"text-emerald-600","items":[{"label":"Coast, culture, history, and local atmosphere","detail":"Yonggungsa gives coastal culture, UNMCK gives historical depth, Songdo gives ocean scenery, Gamcheon gives visual identity, and Jagalchi gives local market atmosphere."},{"label":"Not only photo stops","detail":"The route includes Korean War context and a real residential village etiquette note, so the day feels more meaningful than a simple sightseeing checklist."},{"label":"Better for active travelers than low-mobility guests","detail":"The strongest stops include stairs, slopes, alleys, and exposed coastal walking, so this route should not be sold as mobility-friendly."}]},{"title":"When the route should be shortened","icon":"clock","iconBg":"bg-slate-50/80","iconColor":"text-slate-600","items":[{"label":"Late disembarkation","detail":"If the ship clears late, the guide should reduce optional paid attractions first, then shorten lunch or the final downtown section."},{"label":"Traffic or port access delays","detail":"Busan cross-city travel can slow down around bridges, beaches, and downtown. The final port buffer should be protected."},{"label":"Bad weather","detail":"Coastal stops remain scenic but comfort and safety can drop in strong wind or heavy rain; cable car or skywalk-style options may be adjusted."}]}]},"practicalAccordionItems":[{"id":"pickup","title":"Cruise Port Pickup and Return","preview":"Direct pickup and drop-off at the assigned Busan cruise terminal","content":["Pickup is arranged according to your cruise ship arrival time.","Your guide will wait inside the terminal arrival area holding a clear Love Korea sign.","Please do not leave the terminal if you cannot find the guide.","The exact terminal must be confirmed before the tour because Busan cruise calls may use different port facilities.","Return is scheduled before your ship’s all-aboard time, with route adjustments made if needed."]},{"id":"cruise_schedule","title":"Ship Schedule and Route Adjustment","preview":"The route is flexible because cruise timing comes first","content":["The full route is best for a comfortable 7–9 hour port window.","For shorter calls, optional paid attractions such as Songdo Cable Car or Busan Tower may be skipped.","Late disembarkation may require the guide to shorten lunch, Songdo, or the final Nampo/Jagalchi section.","Traffic, weather, port controls, and group cooperation can affect exact timing.","The final decision on route order and duration is made to protect return-to-port timing."]},{"id":"walking","title":"Walking and Terrain","preview":"Moderate to active, with stairs, slopes, and alleys","content":["Haedong Yonggungsa includes stairs and uneven outdoor temple paths.","Gamcheon Culture Village includes hills, stairs, narrow alleys, and uneven surfaces.","Songdo is easier but can involve coastal wind, optional queues, and light walking.","Yongdusan/Nampo/Jagalchi is urban walking with possible crowds and stairs.","This route is not suitable for travelers who require a fully step-free itinerary."]},{"id":"weather","title":"Weather and Safety","preview":"Coastal stops are scenic but wind-sensitive","content":["Light rain usually does not cancel the tour.","Strong wind or heavy rain can reduce comfort at Haedong Yonggungsa and Songdo.","Songdo Marine Cable Car or skywalk-style coastal access may change due to weather or safety controls.","Gamcheon can be slippery on slopes and stairs when wet.","The guide may adjust the route if a stop becomes unsafe or too low-quality."]},{"id":"included","title":"What’s Included / Not Included","preview":"Port pickup, guide, transport, and main attraction support","variant":"included","content":["Busan cruise port pickup and drop-off","Experienced English-speaking guide","Tour vehicle and driver","Basic admission to included free/standard attractions","No shopping stops","Lunch is not included unless configured separately at checkout","Songdo Marine Cable Car is optional and payable on-site","Busan Tower/Diamond Tower admission is optional and payable on-site","Personal expenses and personal travel insurance are not included"]},{"id":"optional_upgrades","title":"Optional Paid Experiences","preview":"Cable car and tower only if timing works","content":["Songdo Marine Cable Car can be added only if time, weather, ticket availability, and ship schedule allow.","Busan Tower/Diamond Tower can be added only if the final return buffer remains safe.","Optional experiences should not be promised as guaranteed unless they are prebooked and the ship schedule is suitable.","On busy days, queues may make optional attractions impractical for cruise passengers."]}],"practicalWeatherStatic":{"today":{"temp":"—","label":"Live weather integration"},"tomorrow":{"temp":"—","label":"Updated daily"}},"seasonalVariations":[{"name":"Spring","icon":"flower","description":"Spring is one of the easiest seasons for this shore excursion, with comfortable walking conditions at Gamcheon and generally pleasant coastal stops.","tag":"Comfortable walking","bgClass":"bg-spring","iconColor":"text-pink-500"},{"name":"Summer","icon":"sun","description":"Summer gives strong coastal energy around Songdo, but humidity, sun exposure, and cruise crowds can make pacing more demanding.","tag":"Coastal energy","bgClass":"bg-summer","iconColor":"text-yellow-500"},{"name":"Autumn","icon":"leaf","description":"Autumn usually gives strong visibility and comfortable temperatures, making it one of the best seasons for the temple, memorial, and Gamcheon sections.","tag":"Best balance","bgClass":"bg-autumn","iconColor":"text-orange-500"},{"name":"Winter","icon":"snowflake","description":"Winter can be crisp and scenic, but coastal wind and shorter daylight make route timing and warm clothing more important.","tag":"Wind-sensitive","bgClass":"bg-winter","iconColor":"text-sky-500"}],"faqItems":[{"q":"Can the pickup time match our cruise arrival?","a":"Yes. Pickup is arranged according to your ship’s arrival and disembarkation flow. The exact meeting time is confirmed after checking the cruise schedule."},{"q":"Will we return to the ship on time?","a":"The tour is operated with a port-return-first rule. The guide may shorten optional stops, lunch, or the final downtown section if traffic, weather, or late disembarkation reduces the safe time window."},{"q":"Where do we meet the guide?","a":"Meet inside the assigned Busan cruise terminal arrival area. Look for the Love Korea sign. If you cannot find the guide, stay inside the terminal and contact the operator by WhatsApp."},{"q":"Is lunch included?","a":"No. Lunch time is included, but meal costs are not included unless your checkout configuration says otherwise. Please share dietary restrictions in advance."},{"q":"Are Songdo Cable Car and Busan Tower included?","a":"No. Songdo Marine Cable Car and Busan Tower/Diamond Tower are optional paid experiences. They are only recommended when time, weather, queues, and the ship schedule allow."},{"q":"Is this tour suitable for seniors?","a":"It can work for active seniors who are comfortable with stairs and slopes. It is not suitable for travelers requiring a fully step-free route because Yonggungsa and Gamcheon include stairs, hills, and uneven surfaces."},{"q":"Can the route change?","a":"Yes. The route may change depending on ship timing, port controls, traffic, weather, site safety, queue length, or guest pace. Cruise return timing always comes before completing every listed stop."},{"q":"What should I bring?","a":"Comfortable walking shoes, weather-appropriate layers, sun protection, a camera, and a small amount of Korean won or a card for lunch and optional paid experiences are recommended."}],"reviewsPreview":{"averageRating":0,"totalReviews":0,"highlights":[],"featured":[]},"stickyBooking":{"price":{"amountLabel":"79","currency":"USD","per":"person"}},"matching_profile":{"product_id":"busan-city-tour-shore-excursion-cruise-guests","product_type":"small_group","route_type":"flexible","region_type":"any","region_tags":["busan","busan_cruise_port","busan_international_passenger_terminal","east_busan","gijang","nam_gu","songdo","saha_gu","nampo","jagalchi","old_downtown_busan"],"theme_tags":["shore_excursion","cruise_port_pickup","port_return_priority","seaside_temple","korean_war_history","songdo_coast","optional_cable_car","culture_village","seafood_market","first_time_friendly","iconic_landmarks","no_shopping"],"poi_tags":["busan_cruise_terminal","haedong_yonggungsa_temple","un_memorial_cemetery","songdo_beach","songdo_cloud_walk","songdo_marine_cable_car_optional","gamcheon_culture_village","yongdusan_park","busan_tower_optional","nampo_dong","jagalchi_market"],"pace_level":5,"walking_level":4,"scenic_level":5,"photo_level":5,"culture_level":5,"relax_level":2,"first_time_fit":5,"family_fit":4,"senior_fit":2,"couple_fit":4,"active_traveler_fit":4,"one_day_fit":5,"same_day_flight_fit":1,"cruise_fit":5,"rain_fit":2,"value_for_money_fit":4,"iconic_landmark_fit":5,"cafe_fit":2,"adult_family_fit":4,"young_kids_fit":3,"senior_active_fit":3,"senior_general_fit":2,"mobility_friendly_fit":1,"stroller_fit":1,"indoor_ratio":14,"weather_sensitivity":4,"local_culture_fit":5,"shopping_fit":2,"storytelling_fit":5,"comfort_level":3,"budget_fit":4,"premium_fit":2,"small_group_fit":5,"private_fit":3,"bus_fit":3,"price_band":"mid","pickup_base":"busan_cruise_port","return_time_band":"ship_schedule_based","duration_band":"6-9h","min_recommended_age":7,"hard_constraints":{"avoidIf":["very_low_mobility_or_step_free_required","short_port_call_under_5_hours_if_full_route_expected","travelers_requiring_guaranteed_optional_cable_car_without_prebooked_ticket","travelers_wanting_long_shopping_time_over_port_return_buffer"],"notIdealFor":["stroller_heavy_groups","travelers_wanting_a_slow_luxury_pace","guests_who_dislike_stairs_hills_or_full_day_citywide_routes","travelers_wanting_mostly_indoor_sightseeing","guests_unwilling_to_allow_route_adjustments_for_ship_timing"]},"walking_notes":["This is a cruise-day sightseeing route, not a low-walking panoramic drive.","Haedong Yonggungsa includes stairs, uneven temple paths, and coastal exposure.","Gamcheon Culture Village includes slopes, steps, narrow alleys, and uneven surfaces.","Songdo and Nampo/Jagalchi are easier than Gamcheon but can still involve crowds, stairs, and urban walking.","Step-free access cannot be guaranteed; comfortable walking shoes are strongly recommended."],"keywords":["busan shore excursion","busan cruise port tour","busan cruise shore excursion temple gamcheon","haedong yonggungsa cruise excursion","busan port pickup day tour","busan cruise guests city tour","busan shore excursion on time return","busan gamcheon jagalchi cruise tour","busan no shopping cruise excursion","busan songdo shore excursion"],"synonym_hints":["busan cruise day tour","port pickup busan highlights","busan cruise layover tour","shore trip busan temple village market","busan cruise terminal pickup tour","ship-friendly busan sightseeing"],"profile_version":1,"is_active":true},"matching_metadata":{"matching_schema":"tour_matching_profiles_embedded_v1","embedded_for":["authoring","review","sql_backfill_reference"],"note":"Scores were tuned for a Busan cruise shore-excursion format: very high cruise fit, iconic landmark fit, photo value, and storytelling value; high pace and walking load due to Yonggungsa stairs, Gamcheon slopes, Songdo/Nampo urban movement, and port-return timing pressure; low mobility/stroller/rain fit because the strongest stops are outdoor, sloped, or weather-sensitive.","duration_hours":"6-9","stop_count":8,"price_note":"US$79 is used as the current Busan small-group reference price placeholder. Confirm live pricing before DB upsert or checkout activation."},"pickup_dropoff":{"pickupType":"cruise_port_meeting","dropoffType":"cruise_port_return","departure":[{"order":1,"time":"According to cruise arrival","name":"Busan International Passenger Terminal / Assigned Busan Cruise Terminal","type":"cruise_port","address":"Busan Port, Dong-gu or assigned cruise berth, Busan, South Korea","lat":35.1028,"lng":129.0393,"note":"Exact terminal and meeting point must be confirmed from the cruise ship schedule before the tour."}],"return":[{"order":1,"time":"Before ship all-aboard time","name":"Assigned Busan Cruise Terminal","type":"cruise_port","note":"Direct return to the cruise terminal. Route may be shortened to protect the return buffer."}],"notes":["Your guide will wait inside the terminal arrival area with a Love Korea sign.","If you cannot find the guide, do not walk away from the terminal; stay inside and contact the operator by WhatsApp.","Busan cruise calls may use different terminals or berth arrangements, so final meeting details must be reconfirmed before the tour.","The itinerary is flexible and may be shortened or reordered depending on ship timing, traffic, weather, port controls, and guest pace.","On-time port return is prioritized over optional paid attractions or shopping time."]}}'::jsonb
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
  7900,
  'USD',
  NULL,
  TRUE,
  TRUE
FROM public.tour_product_pages p
WHERE p.slug = 'busan-city-tour-shore-excursion-cruise-guests' AND p.locale = 'en'
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
  'busan-city-tour-shore-excursion-cruise-guests',
  'small_group',
  'flexible',
  'any',
  '["busan","busan_cruise_port","busan_international_passenger_terminal","east_busan","gijang","nam_gu","songdo","saha_gu","nampo","jagalchi","old_downtown_busan"]'::jsonb,
  '["shore_excursion","cruise_port_pickup","port_return_priority","seaside_temple","korean_war_history","songdo_coast","optional_cable_car","culture_village","seafood_market","first_time_friendly","iconic_landmarks","no_shopping"]'::jsonb,
  '["busan_cruise_terminal","haedong_yonggungsa_temple","un_memorial_cemetery","songdo_beach","songdo_cloud_walk","songdo_marine_cable_car_optional","gamcheon_culture_village","yongdusan_park","busan_tower_optional","nampo_dong","jagalchi_market"]'::jsonb,
  5,
  4,
  5,
  5,
  5,
  2,
  5,
  4,
  2,
  4,
  4,
  5,
  1,
  2,
  4,
  5,
  2,
  4,
  3,
  3,
  2,
  1,
  1,
  14,
  4,
  5,
  2,
  5,
  3,
  4,
  2,
  5,
  3,
  3,
  'mid',
  'busan_cruise_port',
  'ship_schedule_based',
  '6-9h',
  7,
  '{"avoidIf":["very_low_mobility_or_step_free_required","short_port_call_under_5_hours_if_full_route_expected","travelers_requiring_guaranteed_optional_cable_car_without_prebooked_ticket","travelers_wanting_long_shopping_time_over_port_return_buffer"],"notIdealFor":["stroller_heavy_groups","travelers_wanting_a_slow_luxury_pace","guests_who_dislike_stairs_hills_or_full_day_citywide_routes","travelers_wanting_mostly_indoor_sightseeing","guests_unwilling_to_allow_route_adjustments_for_ship_timing"]}'::jsonb,
  '["This is a cruise-day sightseeing route, not a low-walking panoramic drive.","Haedong Yonggungsa includes stairs, uneven temple paths, and coastal exposure.","Gamcheon Culture Village includes slopes, steps, narrow alleys, and uneven surfaces.","Songdo and Nampo/Jagalchi are easier than Gamcheon but can still involve crowds, stairs, and urban walking.","Step-free access cannot be guaranteed; comfortable walking shoes are strongly recommended."]'::jsonb,
  '["busan shore excursion","busan cruise port tour","busan cruise shore excursion temple gamcheon","haedong yonggungsa cruise excursion","busan port pickup day tour","busan cruise guests city tour","busan shore excursion on time return","busan gamcheon jagalchi cruise tour","busan no shopping cruise excursion","busan songdo shore excursion"]'::jsonb,
  '["busan cruise day tour","port pickup busan highlights","busan cruise layover tour","shore trip busan temple village market","busan cruise terminal pickup tour","ship-friendly busan sightseeing"]'::jsonb,
  1,
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

SELECT slug, title, is_active FROM public.tours WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests';
SELECT slug, locale, is_published, product_id FROM public.tour_product_pages WHERE slug = 'busan-city-tour-shore-excursion-cruise-guests' ORDER BY locale;
SELECT product_id, product_type, region_type, price_band, is_active FROM public.tour_matching_profiles WHERE product_id = 'busan-city-tour-shore-excursion-cruise-guests';
