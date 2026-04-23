-- =============================================================================
-- east-signature-nature-core — small-group tour product (tour_product v2)
-- =============================================================================
-- Generated: 2026-04-22T14:08:15.786Z
-- Script: scripts/gen-tour-product-sql.mjs
-- Locales emitted: en
-- Idempotent: tours ON CONFLICT (slug); tour_product_pages ON CONFLICT (slug, locale);
--            tour_product_offers inserted only when no default offer exists;
--            tour_matching_profiles ON CONFLICT (product_id)
-- Web: /tour-product/east-signature-nature-core
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
  'East Jeju Volcano, Coast & Folk Village Small Group Day Tour',
  'east-signature-nature-core',
  'Jeju',
  'Small group · East Jeju',
  'From Jeju Stone Park to Seongsan Ilchulbong, follow East Jeju’s most balanced first-time route.',
  'A clearly structured East Jeju day route that starts with stone culture and volcanic context, moves through the coast and Seongsan Ilchulbong, and finishes with Ilchulland and Seongeup Folk Village for a more complete day.',
  'From Jeju Stone Park to Seongsan Ilchulbong, follow East Jeju’s most balanced first-time route.',
  58.00,
  NULL,
  'USD',
  'person',
  'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80',
  '["https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&q=80","https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80","https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80","https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80","https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80","https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80"]'::jsonb,
  '8 hours',
  'Moderate',
  'Small group',
  FALSE,
  FALSE,
  'Pickup confirmed after booking.',
  'Weather and operational conditions may shift the stop order or duration.',
  '["First-Time Friendly","East Jeju Signature"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"time":"09:00","title":"Jeju Stone Park","description":"Geology and Stone Culture"},{"time":"10:40","title":"Seopjikoji","description":"Open Coastal Headland"},{"time":"12:00","title":"Lunch","description":"Midday Reset"},{"time":"13:15","title":"Seongsan Ilchulbong","description":"Crater Walk and Haenyeo Context"},{"time":"15:00","title":"Ilchulland","description":"Lava Tube Garden"},{"time":"16:20","title":"Seongeup Folk Village","description":"Village and Cultural Finish"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  4.8,
  127,
  2,
  0,
  TRUE,
  FALSE,
  '{}'::jsonb,
  'East Jeju Volcano, Coast & Folk Village Small Group Day Tour | AtoC Korea',
  'A well-paced East Jeju small group day tour that moves from stone culture and volcanic landscapes to Seopjikoji, Seongsan Ilchulbong, Ilchulland, and Seongeup Folk Village. Ideal for first-time visitors who want East Jeju’s key scenery and local context in one day.'
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
  'east-signature-nature-core',
  'en',
  'east-signature-nature-core',
  TRUE,
  1,
  (SELECT id FROM public.tours WHERE slug = 'east-signature-nature-core' LIMIT 1),
  'East Jeju Volcano, Coast & Folk Village Small Group Day Tour',
  'From Jeju Stone Park to Seongsan Ilchulbong, follow East Jeju’s most balanced first-time route.',
  'East Jeju',
  '8 hours',
  6,
  4.8,
  127,
  ARRAY['First-Time Friendly', 'East Jeju Signature']::text[],
  'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80',
  'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=600&q=80',
  'A clearly structured East Jeju day route that starts with stone culture and volcanic context, moves through the coast and Seongsan Ilchulbong, and finishes with Ilchulland and Seongeup Folk Village for a more complete day.',
  'East Jeju Volcano, Coast & Folk Village Small Group Day Tour | AtoC Korea',
  'A well-paced East Jeju small group day tour that moves from stone culture and volcanic landscapes to Seopjikoji, Seongsan Ilchulbong, Ilchulland, and Seongeup Folk Village. Ideal for first-time visitors who want East Jeju’s key scenery and local context in one day.',
  'East Jeju Volcano, Coast',
  'and Folk Village Small Group Tour',
  '58',
  'USD',
  'person',
  '{"document_kind":"tour_product_full_page_v1","schema_version":1,"slug":"east-signature-nature-core","locale":"en","product_id":"east-signature-nature-core","seo":{"pageTitle":"East Jeju Volcano, Coast & Folk Village Small Group Day Tour | AtoC Korea","metaDescription":"A well-paced East Jeju small group day tour that moves from stone culture and volcanic landscapes to Seopjikoji, Seongsan Ilchulbong, Ilchulland, and Seongeup Folk Village. Ideal for first-time visitors who want East Jeju’s key scenery and local context in one day."},"catalog_card":{"slug":"east-signature-nature-core","title":"East Jeju Volcano, Coast & Folk Village Small Group Day Tour","subtitle":"From Jeju Stone Park to Seongsan Ilchulbong, follow East Jeju’s most balanced first-time route.","region":"East Jeju","duration":"8 hours","stopsCount":6,"rating":4.8,"reviewCount":127,"badges":["First-Time Friendly","East Jeju Signature"],"heroImage":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80","thumbnail":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=600&q=80","priceLabel":"From US$58 per person","shortCardDescription":"A clearly structured East Jeju day route that starts with stone culture and volcanic context, moves through the coast and Seongsan Ilchulbong, and finishes with Ilchulland and Seongeup Folk Village for a more complete day."},"headlineLine1":"East Jeju Volcano, Coast","headlineLine2":"and Folk Village Small Group Tour","price":{"amountLabel":"58","currency":"USD","per":"person"},"hero":{"imageUrl":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1920&q=80","imagePosition":"center 35%","tagline":"From stone culture and open coastlines to a volcanic crater, lava-tube gardens, and a traditional village, this balanced East Jeju route is built for first-time visitors who want more than a simple photo loop.","pills":["First-Time Friendly","East Jeju Signature","Small Group Day Tour"],"meta":{"duration":"8 hours","region":"East Jeju","stops":"6 stops","rating":4.8,"ratingStars":4}},"subnavItems":[{"id":"overview","label":"Overview"},{"id":"itinerary","label":"Itinerary"},{"id":"details","label":"Details"},{"id":"faq","label":"FAQ"},{"id":"reviews","label":"Reviews"}],"glanceItems":[{"icon":"camera","label":"Photo Potential","value":"High"},{"icon":"mountain","label":"Scenery Density","value":"High"},{"icon":"footprints","label":"Walking Difficulty","value":"Moderate"},{"icon":"cloud-rain","label":"Rain Suitability","value":"Moderate"},{"icon":"users","label":"Family Suitability","value":"Good"},{"icon":"gauge","label":"Pace","value":"Balanced"}],"galleryItems":[{"id":1,"type":"photo","src":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=1200&q=80","location":"Route Overview","atmosphere":"A route that opens gradually and makes sense as the day unfolds","alt":"Overview of an East Jeju coastline and crater day tour"},{"id":2,"type":"photo","src":"https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80","location":"Stone Culture Opening","atmosphere":"A calm geological start to the day","alt":"Stone sculptures and landscape at Jeju Stone Park"},{"id":3,"type":"photo","src":"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80","location":"Ilchulland Lava Tube Garden","atmosphere":"A cooler, more enclosed contrast after the crater section","alt":"Atmosphere of Ilchulland lava tube and garden areas"},{"id":4,"type":"photo","src":"https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80","location":"Village Finale","atmosphere":"A softer finish with traces of lived history","alt":"Traditional village atmosphere at Seongeup Folk Village"},{"id":5,"type":"photo","src":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80","location":"Crater and Coast","atmosphere":"The strongest volcanic highlight of the day","alt":"Seongsan Ilchulbong crater and coastline"},{"id":6,"type":"photo","src":"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80","location":"Open Coastline","atmosphere":"Sea wind and open views that change the mood of the route","alt":"Walking path and sea views at Seopjikoji"}],"itineraryStops":[{"number":1,"time":"09:00","duration":"60 min","name":"Jeju Stone Park","category":"Geology and Stone Culture","description":"This stop gives the entire day a clearer frame from the start. Beginning at Jeju Stone Park introduces Jeju through its volcanic landscape and stone culture, so the coast, crater, lava-tube section, and village later in the day all feel more connected.","image":"https://images.unsplash.com/photo-1548013146-72479768bada?w=800&q=80","highlights":["Stone sculptures, towers, and open lawns create strong visual layers","An ideal opening stop for understanding Jeju’s stone culture and volcanic background","Wide open spaces make photos easier and less crowded","Indoor exhibits help complete the geological story when time allows"],"timeUsed":["Short introduction in the main stone landscape zone","Photo stop and interpretation in the open sculpture area","Optional indoor exhibit viewing depending on timing"],"whyOnRoute":"Putting this first helps travelers read the later coastal, crater, and lava-tube stops with more context rather than as isolated sights.","visitBasics":{"hours":"09:00–18:00","closed":"Mondays","admission":"KRW 5,000 adults / KRW 3,500 teens","walking":"Easy to moderate"},"convenience":{"restroom":"At the entrance and inside the facilities","parking":"Parking available"},"smartNotes":{"photo":"Wider landscape compositions usually work better here than close-up portrait shots.","facilities":"Among the early stops, this one generally has the strongest restroom and indoor facility setup.","tip":"This stop works best as a calm, grounded opening rather than a rushed check-in-and-leave photo stop."}},{"number":2,"time":"10:40","duration":"60 min","name":"Seopjikoji","category":"Open Coastal Headland","description":"After Stone Park, the route opens toward the sea. Seopjikoji brings in sea wind, headland views, and an exposed coastal walking line, setting the mood before lunch and the stronger volcanic centerpiece at Seongsan Ilchulbong.","image":"https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80","highlights":["An open headland and coastal path with a distinctly East Jeju feel","Seasonal flower scenery may appear depending on the time of year","Lighthouse views and wide ocean framing work especially well for photos","A refreshing visual contrast after the more grounded Stone Park opening"],"timeUsed":["Brief walking-route introduction on arrival","Coastal walk and main viewpoint stop","Relaxed photo time before returning"],"whyOnRoute":"Opening the sea mood here helps Seongsan Ilchulbong land more strongly later as the day’s main volcanic highlight.","visitBasics":{"hours":"Open 24 hours","closed":"Open year-round","admission":"Free","walking":"Easy to moderate"},"convenience":{"restroom":"Near the entrance area","parking":"Parking available"},"smartNotes":{"photo":"Because the sky is wide and the wind is strong, side angles and wider framing often look better than straightforward posed shots.","facilities":"Facilities are limited, with restrooms mainly near the entrance zone.","tip":"Compared with the previous stop, this section feels much more exposed to wind and sun."}},{"number":3,"time":"12:00","duration":"60 min","name":"Lunch","category":"Midday Reset","description":"Lunch is not just a simple break. It is the point that resets the rhythm of the day, making the afternoon’s core Seongsan Ilchulbong section feel much more comfortable.","image":"https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80","highlights":["A useful energy reset before the day’s most active stop","Naturally separates the coastal walk from the crater section","More comfortable for mixed-age groups","Keeps the second half of the day feeling cleaner and better paced"],"timeUsed":["Arrival and seating","Meal and short rest","Preparation for departure to Seongsan Ilchulbong"],"whyOnRoute":"Placing lunch here makes the Seongsan section feel less rushed and gives the afternoon a stronger flow.","visitBasics":{"hours":"Depends on the restaurant","closed":"Varies by venue","admission":"Included or paid on site depending on product setup","walking":"Minimal"},"convenience":{"restroom":"Inside the restaurant","parking":"Parking available"},"smartNotes":{"photo":"If you want food photos, local Jeju dishes usually make the strongest images.","facilities":"Restaurant facilities are generally sufficient.","tip":"The most important function here is to reset the pace well, not to compress the schedule as much as possible."}},{"number":4,"time":"13:15","duration":"90 min","name":"Seongsan Ilchulbong","category":"Crater Walk and Haenyeo Context","description":"This is the day’s main volcanic landmark. Seongsan Ilchulbong concentrates crater scenery, coastal scale, and Jeju’s haenyeo context into one stop. When timing works, it can also feel especially local rather than simply iconic.","image":"https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=80","highlights":["A UNESCO-recognized volcanic crater landmark","Layered views from both the base area and uphill walking section","One of Jeju’s clearest examples of coastal volcanic geology","The stop can feel even richer when the haenyeo performance schedule aligns"],"timeUsed":["Arrival briefing on route and regrouping points","Main walking section adjusted to the group’s pace","Possible combination of crater viewing, lower viewpoints, and haenyeo performance timing"],"whyOnRoute":"Putting Seongsan after lunch makes the route’s strongest volcanic section land at the right moment in terms of energy, scenery, and emotional rhythm.","visitBasics":{"hours":"Varies by season; last ticketing is typically 1 hour before closing","closed":"First Monday of each month (or the following day if Monday is a holiday)","admission":"KRW 5,000 adults / KRW 2,500 teens and children","walking":"Moderate, or moderately demanding if the group chooses the summit"},"convenience":{"restroom":"At the base area and some upper sections","parking":"Large parking lot available"},"smartNotes":{"photo":"Wide-angle framing that includes both the crater and coastline usually feels stronger than summit selfies alone.","facilities":"Facilities are more developed near the base and more basic higher up.","tip":"Wind, crowd levels, and group fitness can all shift this stop toward more walking, more viewing, or more haenyeo-focused time."}},{"number":5,"time":"15:00","duration":"55 min","name":"Ilchulland","category":"Lava Tube Garden","description":"After Seongsan Ilchulbong, Ilchulland softens the rhythm of the day. With its mix of lava-tube atmosphere and landscaped garden spaces, it feels cooler, quieter, and more contained than the exposed crater stop before it.","image":"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80","highlights":["A chance to experience lava-tube atmosphere within a garden-style setting","A strong contrast with the open and exposed Seongsan section","More shade and an easier-feeling walk","Works especially well as a transition after the biggest landmark stop"],"timeUsed":["Route explanation after entering the grounds","Visit to the main lava-tube or theme areas","Short garden stop before regrouping and departure"],"whyOnRoute":"Ilchulland works best after Seongsan because it slows the pace down naturally instead of competing with the crater section for attention.","visitBasics":{"hours":"08:30–18:00","closed":"Open year-round","admission":"KRW 9,000 adults / KRW 6,000 teens / KRW 5,000 children","walking":"Moderate"},"convenience":{"restroom":"Near the entrance area","parking":"Parking available"},"smartNotes":{"photo":"The mixed indoor-outdoor light works well for atmospheric shots, but exposure can be trickier than at the open coastal stops.","facilities":"Basic facilities are concentrated near the entrance.","tip":"After Seongsan, many travelers immediately feel that the physical demand drops here."}},{"number":6,"time":"16:20","duration":"40 min","name":"Seongeup Folk Village","category":"Village and Cultural Finish","description":"Seongeup Folk Village keeps the day from ending at yet another big scenic landmark. After stone culture, coast, crater, and lava-tube sections, this stop brings the route back to the scale of everyday life, local history, and lived texture.","image":"https://images.unsplash.com/photo-1590077428593-a55bb07c4665?w=800&q=80","highlights":["Thatched houses and stone walls give it a distinctly traditional Jeju atmosphere","More cultural in tone than a pure nature stop","A slower walking rhythm that works well for the end of the day","A meaningful contrast with the stronger natural scenery earlier in the route"],"timeUsed":["Brief introduction on arrival","Walk along the main village paths while viewing traditional structures and traces of daily life","End-of-stop explanation and short free browse before departure"],"whyOnRoute":"Ending at the village gives the day a steadier, more memorable close after several high-impact natural stops.","visitBasics":{"hours":"10:00–17:00","closed":"Open year-round","admission":"Free (except some hands-on programs)","walking":"Easy and mostly flat"},"convenience":{"restroom":"Near the village center","parking":"Parking available nearby"},"smartNotes":{"photo":"Narrow lanes, roof lines, and stone-wall textures often make more rewarding images than broad centered compositions.","facilities":"Facilities inside the village are basic.","tip":"The less rushed this stop feels, the better the whole day tends to land emotionally."}}],"routeFlowStops":[{"id":"01","name":"Stone Park","theme":"Geology"},{"id":"02","name":"Seopjikoji","theme":"Coast"},{"id":"03","name":"Lunch","theme":"Reset"},{"id":"04","name":"Seongsan","theme":"Crater"},{"id":"05","name":"Ilchulland","theme":"Garden"},{"id":"06","name":"Seongeup","theme":"Culture"}],"routePhases":[{"label":"Morning","range":"1-2","theme":"From Stone Culture to the Coast","bgClass":"bg-sky-50/70","textClass":"text-sky-700","dotClass":"bg-sky-500"},{"label":"Midday to Afternoon","range":"3-4","theme":"Lunch and the Crater Highlight","bgClass":"bg-amber-50/70","textClass":"text-amber-700","dotClass":"bg-amber-500"},{"label":"Finish","range":"5-6","theme":"Garden and Folk Village","bgClass":"bg-emerald-50/70","textClass":"text-emerald-700","dotClass":"bg-emerald-500"}],"routeShapeIntro":{"title":"How the day flows","subtitle":"The route begins with stone culture, opens toward the coast, resets at lunch, moves into the crater highlight, and finishes with a garden-and-village close. Pickup usually runs between 08:30 and 09:00, with return to Jeju City around 17:30–18:00."},"whyTourWorks":{"bestFor":["First-time visitors to Jeju","Couples","Adult families","Older travelers in good shape who are comfortable with moderate walking"],"lessIdeal":["Travelers who want to avoid stairs or cave-like spaces","Families relying heavily on strollers","Very young children who may struggle with a full-day pace"],"routeLogicSections":[{"title":"Pacing and structure","icon":"sun","iconBg":"bg-amber-50/80","iconColor":"text-amber-600","items":[{"label":"Start with stone culture, then open toward the sea","detail":"Beginning at Stone Park creates a reading frame for the rest of the day, so the later coastal and volcanic stops feel more layered rather than random."},{"label":"Lunch lands at the right moment","detail":"Resetting the day at midday makes the Seongsan section feel more comfortable and better paced."},{"label":"The main landmark arrives after midday","detail":"Putting Seongsan Ilchulbong after lunch gives the route a clearer rise in intensity without making the morning feel overpacked."}]},{"title":"Why the route is ordered this way","icon":"mountain","iconBg":"bg-sky-50/80","iconColor":"text-sky-600","items":[{"label":"Coast first, crater second","detail":"Seopjikoji opens the sea mood first, which lets Seongsan Ilchulbong arrive with a stronger volcanic presence afterward."},{"label":"Slow the pace after the high point","detail":"Ilchulland works naturally after Seongsan because it brings the pace down instead of competing with the crater stop."},{"label":"Finish with lived history","detail":"Seongeup Folk Village makes the day feel more complete by adding human texture and historical atmosphere after the stronger natural scenery."}]},{"title":"When conditions change on site","icon":"wind","iconBg":"bg-slate-50/80","iconColor":"text-slate-600","items":[{"label":"Monday operating constraint","detail":"Because Jeju Stone Park is closed on Mondays, this route is usually not run on Mondays in its standard form."},{"label":"Wind and weather affect the exposed coastal sections","detail":"Seopjikoji and Seongsan Ilchulbong are the two stops most likely to be shaped by wind, rain, or crowd conditions."},{"label":"Walking intensity can be adjusted","detail":"The Seongsan section can be paced differently depending on group fitness, weather, and on-site crowd flow."}]}]},"practicalAccordionItems":[{"id":"pickup","title":"Pickup and Return Times","preview":"Jeju City hotel-lobby pickup","content":["Pickup from hotel lobbies in Jeju City between 08:30 and 09:00","Expected return and drop-off around 17:30–18:00","Airport pickup may be possible depending on circumstances","Final pickup time is confirmed the night before"]},{"id":"walking","title":"Walking and Terrain","preview":"Moderate overall and manageable for most travelers","content":["Total walking across the day is roughly 4–6 km","Jeju Stone Park is mostly flat, though some surfaces can be slightly uneven","Ilchulland combines garden paths and cave sections, and some areas can feel damp or uneven","Seongsan Ilchulbong includes an optional summit section that is steeper and more demanding","Comfortable walking shoes with good grip are strongly recommended"]},{"id":"weather","title":"Weather and Route Adjustments","preview":"Most weather conditions are workable, with adjustments when needed","content":["Light rain: the tour usually runs as planned","Heavy rain: time at exposed outdoor stops may be shortened, and Ilchulland may carry more value in the day","Strong wind: the Seopjikoji section may be shortened","If a stop closes unexpectedly, a substitute stop or revised timing may be used"]},{"id":"wear","title":"What to Wear and Bring","preview":"Comfortable walking shoes, layers, and a light outer layer","content":["Walking shoes with good grip","Layered clothing for changing temperatures","A light windproof jacket","Hat and sun protection","Water bottle"]},{"id":"included","title":"What’s Included / Not Included","preview":"Guide, vehicle, pickup, and admission tickets","variant":"included","content":["Professional English-speaking guide","Private vehicle or small-group vehicle","Jeju City hotel pickup and drop-off","All admission tickets","Bottled water","Lunch (paid at the restaurant unless otherwise specified)","Personal shopping expenses","Guide gratuities"]}],"practicalWeatherStatic":{"today":{"temp":"—","label":"Live weather integration"},"tomorrow":{"temp":"—","label":"Updated daily"}},"seasonalVariations":[{"name":"Spring","icon":"flower","description":"Canola flowers can add a bright yellow layer to the coastal sections.","tag":"Flower season","bgClass":"bg-spring","iconColor":"text-pink-500"},{"name":"Summer","icon":"sun","description":"Longer daylight and deeper greens make the route feel fuller and more open.","tag":"Longest daylight","bgClass":"bg-summer","iconColor":"text-sky-500"},{"name":"Autumn","icon":"leaf","description":"Skies are often clearer, and visibility across the coast and crater tends to feel especially strong.","tag":"Best visibility","bgClass":"bg-autumn","iconColor":"text-amber-600"},{"name":"Winter","icon":"snow","description":"There are usually fewer crowds, and the paths often feel quieter and calmer.","tag":"Quieter atmosphere","bgClass":"bg-winter","iconColor":"text-slate-500"}],"bookingTrustItems":[{"icon":"check-circle","title":"Licensed local operation","description":"Run by a Jeju-based licensed guiding team","iconBg":"bg-emerald-50/80","iconColor":"text-emerald-600"},{"icon":"route","title":"Built around real East Jeju pacing","description":"Planned with East Coast driving flow in mind","iconBg":"bg-sky-50/80","iconColor":"text-sky-600"},{"icon":"users","title":"Small-group format","description":"Usually capped at 8 guests","iconBg":"bg-amber-50/80","iconColor":"text-amber-600"}],"bookingSupportSteps":[{"timing":"After booking","title":"Instant confirmation","detail":"A confirmation message is sent with your booking summary and route overview."},{"timing":"12 hours before","title":"Pre-departure reminder","detail":"Weather notes and any necessary adjustments are shared in advance."},{"timing":"The night before","title":"Final pickup notice","detail":"Your exact pickup time and driver or guide contact details are confirmed."},{"timing":"Morning of departure","title":"Day-of route note","detail":"A short morning update is shared based on the latest conditions."},{"timing":"During the tour","title":"Stop-by-stop guidance","detail":"Useful information is shared at each stop as needed."},{"timing":"After the tour","title":"Post-tour support","detail":"Follow-up help and extra recommendations are available if needed."}],"staticQuestions":[{"id":"first-time","question":"Is this a good route for a first trip to Jeju?","answer":"Yes. It combines Jeju’s stone culture, volcanic narrative, East Coast scenery, and representative landmarks into one balanced day."},{"id":"walking","question":"Will this route feel tiring?","answer":"Usually not overly tiring. The most demanding section is the optional Seongsan summit climb; without that, most stops feel moderate for most travelers."},{"id":"rain","question":"Can the tour still run in rainy weather?","answer":"Yes. In slippery or windy conditions, extra care is taken at the exposed coastal stops, and Ilchulland often becomes even more valuable when the weather is less stable."},{"id":"parents","question":"Is it suitable for traveling with parents?","answer":"Yes. It is generally friendly for adult family groups as long as moderate walking and some stairs are acceptable."},{"id":"children","question":"Can I join with children?","answer":"Yes. It is more strongly recommended for children aged 8 and above who can handle moderate walking and a full-day tour rhythm."},{"id":"order","question":"Can the stop order change on the day?","answer":"Yes. The coastal sections are more affected by wind, traffic, and crowd flow, so the order may be adjusted slightly when needed to keep the day running smoothly."},{"id":"lunch","question":"Is lunch included in the price?","answer":"That depends on the product setup. The route always includes a lunch break, but whether the meal itself is included depends on the option you book."},{"id":"why-stone-park","question":"Why does the tour start at Jeju Stone Park?","answer":"Because it helps the rest of the day make more sense. Once you understand Jeju through its stone and volcanic story, the coast, crater, garden, and village all feel more meaningful."},{"id":"why-seopjikoji","question":"Why is Seopjikoji placed in the first half of the day?","answer":"Because it opens the coastal mood first, which lets Seongsan Ilchulbong arrive later with a stronger volcanic impact and a clearer contrast."},{"id":"why-lunch","question":"Why is lunch scheduled there?","answer":"Because it resets the rhythm before the Seongsan section, making the afternoon’s core highlight feel more comfortable and less rushed."},{"id":"later-structure","question":"Why is the second half structured this way?","answer":"After Seongsan, Ilchulland slows the pace down, and Seongeup Folk Village adds a cultural finish. That makes the whole day feel more complete instead of stacking scenic stops at the same intensity all the way through."}],"guestReviews":[],"reviewsSummary":{"averageRating":0,"totalReviews":0,"ratingDistribution":[{"stars":5,"count":0,"percentage":0},{"stars":4,"count":0,"percentage":0},{"stars":3,"count":0,"percentage":0},{"stars":2,"count":0,"percentage":0},{"stars":1,"count":0,"percentage":0}],"highlights":[]},"sticky_booking_bar":{"note":"checkout_tour_id resolves at runtime from Supabase / env; not part of static JSONB.","price":{"amountLabel":"58","currency":"USD","per":"person"}},"matching_profile":{"product_type":"small_group","route_type":"fixed_route","region_type":"east","region_tags":["jeju_east","stone_park_to_seongsan"],"theme_tags":["stone_culture","coast","crater","lava_tube","folk_village","balanced_paced","first_time"],"poi_tags":["stone_park","seopjikoji","seongsan","ilchulland","seongeup"],"pace_level":3,"walking_level":3,"scenic_level":4,"photo_level":4,"culture_level":4,"relax_level":3,"first_time_fit":5,"family_fit":4,"senior_fit":4,"couple_fit":4,"active_traveler_fit":4,"one_day_fit":4,"same_day_flight_fit":2,"rain_fit":3,"value_for_money_fit":5,"iconic_landmark_fit":5,"cafe_fit":2,"adult_family_fit":4,"young_kids_fit":3,"senior_active_fit":4,"senior_general_fit":3,"mobility_friendly_fit":3,"stroller_fit":2,"indoor_ratio":33,"weather_sensitivity":3,"local_culture_fit":4,"shopping_fit":1,"storytelling_fit":4,"comfort_level":3,"budget_fit":4,"premium_fit":3,"small_group_fit":5,"private_fit":1,"bus_fit":1,"price_band":"mid","pickup_base":"jeju_city","return_time_band":"17:30-18:00","duration_band":"8h","min_recommended_age":8,"hard_constraints":{"avoidIf":["monday_departure_required","tight_same_day_departure","strict_no_stairs_request"],"notIdealFor":["toddlers","stroller_heavy","very_low_mobility"]},"walking_notes":["Overall walking is moderate across an 8-hour route.","Seongsan Ilchulbong is the steepest section if the group chooses the summit.","Ilchulland combines garden paths and cave-like sections, and some surfaces may be damp.","Comfortable walking shoes with good grip are strongly recommended."],"keywords":["east jeju small group tour","east jeju day tour","jeju east coast day trip","seongsan ilchulbong small group tour","seopjikoji tour","jeju stone park tour","ilchulland tour","seongeup folk village tour","jeju volcano coast village tour","first time east jeju tour","east jeju highlights","east jeju itinerary"],"synonym_hints":["classic east jeju route","balanced east jeju day","essential east jeju tour","geology coast culture route","east jeju with crater and coast","first trip east jeju","east jeju signature day","east jeju highlights route"],"profile_version":3,"is_active":true},"matching_metadata":{"schema_version":"tour_matching_profile.v1","last_reviewed_at":"2026-04-22","score_rationale":{"pace_level":"Balanced rather than rushed, with one main high-impact stop and a softer second half.","walking_level":"Moderate overall. Seongsan is the main physical section, while the rest of the route stays manageable for most travelers.","scenic_level":"High scenic quality across stone landscape, open coast, crater views, garden sections, and a traditional village finish.","photo_level":"Strong for landmark and coastline photography, but not designed as a purely photo-first cafe or viewpoint route.","culture_level":"Higher than average because Stone Park, haenyeo context, and Seongeup add real interpretive depth beyond scenery alone.","relax_level":"Moderate. The route has structure and a headline landmark, but it settles into a calmer rhythm after Seongsan.","first_time_fit":"Very strong for first-time Jeju visitors who want East Jeju to feel coherent and representative in one day.","family_fit/young_kids_fit/stroller_fit":"Adult families fit well; younger children can still join, but strollers and toddlers are less ideal because of terrain changes and the optional summit section.","senior_fit/senior_general_fit/mobility_friendly_fit":"Active seniors can enjoy it comfortably, while low-mobility travelers may find the route less convenient.","same_day_flight_fit":"Possible only with a generous buffer, since the expected return window is still late enough to create risk for tight same-day departures.","rain_fit/indoor_ratio/weather_sensitivity":"The route is more weather-flexible than a pure outdoor scenic tour because Ilchulland and some Stone Park content help, but the coast and crater are still exposed.","small_group_fit/private_fit/bus_fit":"The route is optimized for small-group vehicle flow rather than being designed as a private-only or large-bus-first product.","price_band/budget_fit/premium_fit":"At US$58, it sits in the mid-price band while still offering strong perceived value for a first-time East Jeju day tour.","hard_constraints":"Monday operations are constrained by Jeju Stone Park closure, and the route is not ideal for travelers with very tight departure schedules or strict no-stairs requirements."}}}'::jsonb
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
WHERE p.slug = 'east-signature-nature-core' AND p.locale = 'en'
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
  'east-signature-nature-core',
  'small_group',
  'fixed_route',
  'east',
  '["jeju_east","stone_park_to_seongsan"]'::jsonb,
  '["stone_culture","coast","crater","lava_tube","folk_village","balanced_paced","first_time"]'::jsonb,
  '["stone_park","seopjikoji","seongsan","ilchulland","seongeup"]'::jsonb,
  3,
  3,
  4,
  4,
  4,
  3,
  5,
  4,
  4,
  4,
  4,
  4,
  2,
  3,
  5,
  5,
  2,
  4,
  3,
  4,
  3,
  3,
  2,
  33,
  3,
  4,
  1,
  4,
  3,
  4,
  3,
  5,
  1,
  1,
  'mid',
  'jeju_city',
  '17:30-18:00',
  '8h',
  8,
  '{"avoidIf":["monday_departure_required","tight_same_day_departure","strict_no_stairs_request"],"notIdealFor":["toddlers","stroller_heavy","very_low_mobility"]}'::jsonb,
  '["Overall walking is moderate across an 8-hour route.","Seongsan Ilchulbong is the steepest section if the group chooses the summit.","Ilchulland combines garden paths and cave-like sections, and some surfaces may be damp.","Comfortable walking shoes with good grip are strongly recommended."]'::jsonb,
  '["east jeju small group tour","east jeju day tour","jeju east coast day trip","seongsan ilchulbong small group tour","seopjikoji tour","jeju stone park tour","ilchulland tour","seongeup folk village tour","jeju volcano coast village tour","first time east jeju tour","east jeju highlights","east jeju itinerary"]'::jsonb,
  '["classic east jeju route","balanced east jeju day","essential east jeju tour","geology coast culture route","east jeju with crater and coast","first trip east jeju","east jeju signature day","east jeju highlights route"]'::jsonb,
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

SELECT slug, title, is_active FROM public.tours WHERE slug = 'east-signature-nature-core';
SELECT slug, locale, is_published, product_id FROM public.tour_product_pages WHERE slug = 'east-signature-nature-core' ORDER BY locale;
SELECT product_id, product_type, region_type, price_band, is_active FROM public.tour_matching_profiles WHERE product_id = 'east-signature-nature-core';
