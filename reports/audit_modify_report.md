# AtoC / Kursoflow EN Source Audit Report

**Audit date:** 2026-05-07
**Audit scope:** 30 customer-facing English JSON tour files at `components/product-tour-static/*/*.en.json`
**Audit phase:** Pre-translation (no modifications applied; translation should be blocked until P0 fixes ship)
**Method:** 4 parallel domain audits (Busan / Jeju-east-UNESCO-seasonal / Jeju-cruise-private-west / Seoul-Incheon-Gyeonggi-Gangwon)

---

## 1. Executive summary

- **30/30** files audited.
- **~120** distinct findings.
- **~40 P0** issues that must be fixed before any locale (ko / zh-CN / zh-TW / ja / es) translation, otherwise the wrong content / unsafe claims / OTA leaks will be propagated 5×.
- **3 files** carry severe `page_sections` content pollution (rendered customer page does not match the root product).
- **15+ priceNote fields** across the catalog leak the OTA listing source ("GetYourGuide", "operator listing", "listing snippet"); this is the single largest sweep-fix.
- **6 cruise/cruise-shore** customer copy points contain "guaranteed return" / "Guaranteed return" / "Sail-away timing guaranteed" — legal overclaim risk.
- **3 confirmed factual errors / hallucinations** (Seongeup mislabeled as UNESCO; Mutae eel placed at the wrong waterfall; Black Pig classified as Natural Monument instead of Cultural Heritage Material No. 5).
- Repeating internal-product-planning vocabulary across the catalog: `anchor`, `calibrated`, `fallback`, `variant`, `catalog`, `operating window`, `service window`, `competing`, `non-negotiable`. These are baked into customer-facing whyOnRoute / subtitle / description / FAQ fields. Translation locks them.

---

## 2. P0 — Translation-blocking issues

### 2.1 Customer page is the wrong product (page_sections vs root mismatch)

| File | Issue | Where |
|---|---|---|
| `busan-private-car-charter-cruise-shore.en.json` | **Entire `page_sections`** (hero, atmosphere gallery, timeline itineraryStops, day_flow, practical accordion, FAQ) is **Jeju** content. Hero says "Jeju Island Private", "9 hours", "All of Jeju", "East / West / South Routes". Root is 8-hour Busan cruise charter (UN Memorial / Taejongdae / Gamcheon / Yongdusan / Jagalchi). | lines 1175–1860 |
| `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json` | **page_sections (hero, glance, timeline, day_flow)** is the Gyeongju **UNESCO-Legacy template clone** (Ahopsan + Bulguksa + Lunch + Museum + Gyochon + Woljeonggyo). Polluted hero says "Korea's 1,000-year capital" + "Best season: Year-round" — directly contradicts the seasonal Feb 25 – Apr 10 plum/cherry product. Root is Tongdosa + Wondong + Bulguksa + Bomun Lake. | lines 1012–1372 |
| `busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json` | Same UNESCO-Legacy template clone in `page_sections`. Polluted hero text + "seven UNESCO sites cluster within 15 km" tagline. Root is Bomun Lake + Cheomseongdae + Daereungwon + Bulguksa cherry blossom. | lines 1000–1360 |

**Fix direction:** rebuild `page_sections[0]` (hero), `[2]` (glance), `[3]` (atmosphere), `[4]` (timeline), `[5]` (day_flow) entirely from the root `itineraryStops`. Do NOT touch matching scores or matching metadata. Record in change log.

### 2.2 Factual errors / hallucinations in customer-facing fields

| File | Field / line | Wrong | Correct |
|---|---|---|---|
| `jeju-eastern-unesco-spots-day-tour.en.json` | metaDescription L9; itineraryStop L283; routeLogicSection L698-699 | "Seongeup Folk Village (UNESCO heritage)" / "(UNESCO)" | Seongeup is **Korean Important Folklore Cultural Heritage**, NOT UNESCO. Strip "(UNESCO)" tag everywhere. |
| `jeju-hydrangea-festival-tour-east-route.en.json` | page_sections timeline stop 3 | "Seongeup Folk Village (UNESCO)" | Same — strip "(UNESCO)". |
| `jeju-winter-southwest-tangerine-snow-camellia-tour.en.json` | L478 whyOnRoute (Cheonjeyeon Falls) | "**Yongyeon Pond** at Tier 1 is the protected habitat of the **Mutae eel** (marbled eel, NM 27)" | Mutae eel / NM 27 habitat is at **Cheonjiyeon Falls**, NOT Cheonjeyeon. Different falls. Remove Mutae eel reference at Cheonjeyeon. |
| `jeju-cruise-shore-excursion-bus-tour.en.json` & `…small-group-tour.en.json` | L727 lunch description | "the indigenous Black Pig was designated **Natural Monument** of Korea in 2015" | Jeju Black Pig is **Cultural Heritage Material No. 5 (2015)** (other Jeju files use the correct designation). |
| `seoul-private-nami-morning-calm-petite-france.en.json` | L243 vs L248 (same stop) | Two contradictory LED counts: "30,000+ LEDs" and "200,000+ environmentally-friendly LED bulbs" in adjacent highlight bullets | Pick one source-backed figure. |
| `seoul-suwon-hwaseong-folk-village-starfield-library.en.json` | L347/350 vs L1464/1467 | "260+ traditional houses" vs "270+ traditional houses" on the same product | KTO standard cite is "260+". Settle. |
| `incheon-seoul-private-car-shore-excursion-cruise.en.json` | catalog_card L37 vs page_sections meta L1191 vs SEO meta L9 | Duration: "8 hours" vs "7–9 hours" vs "Private 8-hour" | Pick one. |
| `from-incheon-seoul-day-tour-cruise-guests.en.json` | catalog_card L36 vs hero meta L67 / itineraryStops | stops: 6 vs 7 | Pick one (itinerary has 7). |
| `seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json` | catalog_card L23 + hero L54 vs body L353 | catalog asserts "220-meter" Gamak suspension bridge; body discloses 220m vs Visit Korea's 150m discrepancy | Either commit to one figure or drop the meter figure from catalog/hero. |

### 2.3 Legal-overclaim risk in customer-facing fields

| File | Field / line | Quote |
|---|---|---|
| `busan-private-car-charter-cruise-shore.en.json` | metaDescription L9, subtitle L23, shortCardDescription L37, tagline L55, multiple page_sections L585/595/607/751/788/854/947 | "**on-time return guaranteed**" / "Guaranteed on-time return" — repeated 11× |
| `incheon-seoul-private-car-shore-excursion-cruise.en.json` | tags L30, badges L45, SEO meta L9, stop-7 description L520, highlight L525, whyOnRoute L532, repeat L1128 | "**guaranteed_return**" / "**Guaranteed return**" / "**Sail-away timing guaranteed**" / "operator commits to your sail-away schedule" |
| `jeju-hydrangea-festival-tour-east-route.en.json` | L523 highlight | "Hydrangea greenhouse as **guaranteed indoor refuge**" |
| `jeju-southern-top-unesco-spots-tour.en.json` | L308 whyOnRoute | "Year-round bloom calendar **guarantees** the stop's photographic value regardless of season" |
| `busan-small-group-sightseeing-tour-cruise-passengers.en.json` | L222/254/L384 | "**100% wheelchair-accessible**" |
| `busan-top-attractions-day-tour.en.json` | L384/398 | "**100% wheelchair-accessible**" |
| `busan-private-car-charter-cruise-shore.en.json` | L225/257 | "**100% wheelchair-accessible**" |

**Fix direction:** replace `guaranteed return` → `60-min sail-away buffer` / `scheduled around your ship time`; `100% wheelchair-accessible` → `fully wheelchair-accessible`; `guarantees the photographic value` → `keeps the stop photogenic`.

### 2.4 OTA / source leakage in customer-facing fields

The same priceNote template is replicated across the catalog. **All instances are customer-rendered** (priceNote shows on price card / pricing tab):

| File | Lines |
|---|---|
| `busan-gyeongju-unesco-legacy-tour-national-museum.en.json` | priceLabel L22 + priceNote L54 |
| `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json` | priceNote L1733 |
| `busan-private-car-charter-cruise-shore.en.json` | (no priceNote OTA — but `external_source` metadata is internal, OK) |
| `busan-small-group-sightseeing-tour-cruise-passengers.en.json` | priceNote L56 / L951 / L1997 |
| `busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json` | priceNote L1721 + customer-facing `sourcing` body L571 lists "GetYourGuide, Trazy, KoreaTravelEasy, Seoul Pass" |
| `busan-top-attractions-day-tour.en.json` | priceNote L52 / L952 / L1923 + smartNotes.tip L318 says **"reserve via Klook or bluelinepark.com"** |
| `from-busan-gyeongju-ancient-capital-day-tour.en.json` | priceLabel L21 + priceNote L52 |
| `from-incheon-seoul-day-tour-cruise-guests.en.json` | priceLabel L21 + priceNote L52 |
| `jeju-eastern-unesco-spots-day-tour.en.json` | priceNote L57 + reviewsAttribution L2212 ("Aggregate rating from the operator's GetYourGuide listing — read individual reviews there.") |
| `jeju-grand-highlights-loop.en.json` | reviewsAttribution L1324 / L2212 mentions "GetYourGuide" + "GYG" + "this catalog" |
| `jeju-hydrangea-festival-tour-southwest-route.en.json` | timeline stop card props L1525 / L1608 / L1666 / L1711 / L1712 contain visible OTA badges (Trazy / Klook / Trip.com) |
| `jeju-southern-top-unesco-spots-tour.en.json` | priceNote L61 / L956 / L2248 + customer notes L1002 ("Eongdeongmul Valley removed from the **GetYourGuide standard route**") |
| `jeju-winter-southwest-tangerine-snow-camellia-tour.en.json` | priceNote L59 + sources L291 ("Klook / Trazy / Mindtrip") |
| `pocheon-sanjeong-lake-herb-island-art-valley.en.json` | priceNote L54 / L731 / L1743 + highlight L197 ("**(Klook + Trip.com confirmed)**") |
| `seoul-seoraksan-national-park-sokcho-beach-day-trip.en.json` | priceNote L58 / L822 / L1790 |
| `seoul-suburbs-private-chartered-car-10hr.en.json` | admission L294 ("**Klook discounts often available**") |
| `seoul-suwon-hwaseong-folk-village-starfield-library.en.json` | priceNote L61 / L911 / L1961 + sources L331 / L1452 list "**Trazy**" |
| `seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.en.json` | priceNote L61 / L986 / L2102 + sources L1558 lists "**Trazy**" |
| `seoul-suwon-hwaseong-waujeongsa-starfield.en.json` | priceNote L54 / L743 / L1798 |
| `seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json` | competing_products L1273 includes "GetYourGuide" (verify if rendered) |

**Fix direction:** strip "GetYourGuide / GYG / Klook / Trazy / Trip.com / Booking.com / operator listing / listing snippet" from all customer-facing fields. Replace with "AtoC Korea sale price applies a flat 10% discount" or "Final price confirmed at booking". Move source-attribution to internal-only fields if needed.

### 2.5 Internal product-planning vocabulary baked into customer copy

The same internal phrasing has been ported wholesale into customer fields (description, subtitle, whyOnRoute, FAQ). Translators will faithfully translate it and produce 5 unnatural locales. Top offenders:

**`anchor`** — used in 10+ files, often as boilerplate:
- `jeju-grand-highlights-loop.en.json` lines 1568/1616/1664/1735/1783 use the identical fill-in: `"Featured anchor stop on this route — chosen for its cultural/scenic significance and fit with the day's pacing."` (5 stops, identical text)
- `jeju-southern-top-unesco-spots-tour.en.json` lines 1560/1616/1692/1739/1796 use the same boilerplate (5 stops, identical text)
- `jeju-cruise-shore-excursion-bus-tour.en.json` & `…small-group-tour.en.json` lines 2169/2216/2294 / 2184/2231/2309 use the same boilerplate
- `busan-gyeongju-unesco-legacy-tour-national-museum.en.json` L188/230/385/490/498/549 ("the catalog's strongest indoor cultural anchor", "Korean drama heritage anchor", "national heritage anchor", etc.)
- Hydrangea-east "Operational anchor for the eastern hydrangea loop" (L209), "the day's hydrangea anchor and the floral finale" (L537)

**`calibrated`** — `busan-small-group-cruise` 8+ uses (L23/68/643/675/1280/1327/1428/1690/1720); `incheon-seoul-private-car-shore` L62/69/671/1185; `from-incheon-seoul-day-tour-cruise-guests` L22/65/600/1123/1170/1267/1503; `jeju-cherry-blossom-tour-east-route` L282; `jeju-southern-top-unesco-spots-tour` L638/1933 ("calibrated for first-time Jeju visitors"); `southwest-hallasan-osulloc-aewol` L474.

**`catalog` / `catalog-leading` / `catalog-unique` / `catalog-best`**:
- `busan-gyeongju-unesco-legacy-tour-national-museum` L188/385/498 ("the catalog's most content-dense", "the catalog's strongest indoor anchor", "the catalog's signature 'sunset finale'") + page renders internal slugs `busan-top-attractions, from-busan-gyeongju-ancient-capital`
- `jeju-cherry-blossom-tour-east-route` L210/282/1210 ("the catalog-leading anchor", "catalog-best timing", "the catalog's spring-only east-Jeju anchor")
- `jeju-winter-southwest-tangerine-snow-camellia-tour` L478 ("a **catalog-unique 'winter twilight' photography window**")
- `jeju-west-south-full-day-authentic-tour` L612 ("this is the catalog's tightest evening-flight tour")
- `busan-top-attractions-day-tour` L1145 ("This is the most comprehensive Busan-only classic route in the catalog.")

**`fallback`** — `jeju-hydrangea-festival-tour-east-route` L527/707/1973 ("weather fallback", "Built-in fallback when flowers underperform", "swap in the strongest available flower fields based on real-time bloom intel"); `incheon-seoul-private-car-shore` L216 ("weather-fallback detour").

**`operating window`** — `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju` L525/569/640/666/693/714; `busan-spring-cherry-blossom-gyeongju-highlights-day-tour` L640/680.

**`service window`** — `seoul-suburbs-private-chartered-car-10hr` L522/785/1488 ("Strict 10-hour service window from pickup"); `jeju-island-private-car-charter-tour` L519/747 ("Strict 9-hour service window").

**`variant`** (system-tone, NOT the legitimate "East / West / South Route" feature in private-car):
- `jeju-cruise-shore-excursion-bus-tour` & `…small-group-tour` 20+ uses each (L23 "Port-aware cruise day tour with Jeju and Gangjeong **route variants**", L47/562/1283/1320/1331/1343-1346/1355/1946/1950/2406/…)
- `pocheon-sanjeong-lake-herb-island-art-valley` L554/566/572 ("operator variants")

**`competing` / `competing tour`**:
- `jeju-eastern-unesco-spots-day-tour` & `jeju-grand-highlights-loop` L707/1952 ("competing tours")
- `busan-gyeongju-unesco-legacy-tour-national-museum` L385/498/549 ("no competing Gyeongju tour matches", "this is the route's strongest differentiation against …", "matches competing Busan-Gyeongju products")

**`non-negotiable`** — both Jeju cruise files L1346/2498/2513 ("Cruise return is non-negotiable").

**`hydrangea-coded` / `heritage-coded` / `compound stop` / `buffer absorber` / `Operational midday stop` / `routing buffer`** — Jeju hydrangea east (L246) and southwest (L318/344/364) — pure pitch-deck vocabulary in customer text.

**`atockorea's segments` (internal audience targeting bleed)**:
- `seoul-private-nami-morning-calm-petite-france` L201/316 ("atockorea's overseas-Chinese-diaspora and SE-Asia segments")
- `seoul-seoraksan-national-park-sokcho-beach-day-trip` "atockorea's family-with-young-children and senior-mobility segments"
- `pocheon-sanjeong-lake-herb-island-art-valley` L206/323 ("atockorea's family-with-young-children and senior-mobility segments", "atockorea's K-drama-fan segment")

### 2.6 Unverified superlatives ("Korea's largest / first / only / world's largest")

| File | Line | Claim | Verification status |
|---|---|---|---|
| `busan-gyeongju-unesco-legacy-tour-national-museum` | L60 / L482 | "**seven UNESCO sites cluster within 15 km**" + "**Korea's largest wooden bridge** — 60.57 m original length" (Woljeonggyo) | Both unverified / contestable |
| `busan-private-car-charter-cruise-shore` | L192 | "**Asia's second-largest passenger terminal after Shanghai**" (Busan Port) | Unverified vs Tokyo, Hong Kong |
| `busan-small-group-cruise` | L215 | "**the ONLY UN memorial cemetery in the world**" | Widely cited; likely correct |
| `busan-top-attractions-day-tour` | L294 | "**world's first battery-charged eco-friendly sightseeing train**" (Sky Capsule / Blue Line) | Unverified |
| `jeju-cherry-blossom-tour-east-route` | L272 | "**the only road in Korea where pink cherry blossoms and yellow canola flowers bloom simultaneously**", "**Korea's single most photogenic spring road-trip**" | Multiple Korean roads have mixed-bloom (Jindo, Hwagae). Indefensible "only/single most". |
| `jeju-island-private-car-charter-tour` | L184 / L205 | "**world's largest 7.6 m lava column**" + "**world's-tallest lava column**" (Manjanggul) — wording inconsistent within file | Standard cite is "world's tallest known lava column"; reconcile. |
| `jeju-island-private-car-charter-tour` | L274 / L278 | "Yakcheonsa — **largest Buddhist temple complex in East Asia**", "**Asia's largest Buddhist temple complex**" | Overclaim. L1195 in same file already softens to "one of the largest". |
| `jeju-west-south-full-day-authentic-tour` | L171/491/492/549/1584/1708/1883 | "**Korea's largest beauty company**", "**Korea's largest green-tea field**", "**Korea's largest visitable tea estate**", "**Korea's only large-scale visitable tea estate**", "**Korea's most-photographed columnar lava feature**", "**Korea's first carbon-free island certification**" (Biyangdo — process not yet awarded) | All overclaim; soften globally |
| `southwest-hallasan-osulloc-aewol` | L250/256 | "**East Asia's premier columnar-jointing site** — peer to Giant's Causeway, Devils Postpile, Fingal's Cave" | Overclaim — Japan also has notable sites. Soften. |
| `southwest-hallasan-osulloc-aewol` | L344/349 | "the **120 m × 78 m Seonimgyo Bridge**" | 78 m height suspect; commonly cited as ≈128 m long. Verify. |
| `southwest-hallasan-osulloc-aewol` | L454 | "**Korea's most concentrated 'sea-view cafe' destination**" | Overclaim vs Songdo, Anmok. Soften. |
| `seoul-private-nami-morning-calm-petite-france` | L191/297/454 | "**Korea's first natural-environment light festival**", "**Korea's only Saint-Exupéry Foundation-licensed organization**", "**Korea's largest garden lighting festival**" | Each contested |
| `seoul-seoraksan-national-park-sokcho-beach-day-trip` | L222/226/191-194 | "**world's largest seated bronze Buddha**" (Tongildaebul, 14.6m / 108 tons), "**world's oldest Seon (Zen) temple**" (Sinheungsa 652 CE), "**Korea's longest road tunnel**" (Inje-Yangyang, 11 km) | Tongildaebul and Sinheungsa overclaim; tunnel claim was true 2017 but verify 2026 status |
| `seoul-suwon-hwaseong-folk-village-starfield-library` | L194/225/232/347/349/412 | "**largest existing royal gate in Korea, larger than Seoul's Sungnyemun**" (Janganmun); "**Korea's largest open-air museum**" (Korean Folk Village); "**Korea's tallest cylindrical bookshelves**" (Starfield Suwon 22m) | All plausible; require source-back |
| `seoul-suwon-hwaseong-folk-village-starfield-library` | L366 | "Jewel in the Palace … **50 million domestic viewers**" | Likely refers to cumulative reach or peak rating; verify before locking translation |
| `seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library` | L476/478/484 | "**Korea's first government-owned cave-tourism**", "**Korea's largest underground wine cellar**", "**Korea's tallest indoor sculpture in any cave**", "**Korea's deepest indoor freshwater aquarium**" — 4 superlatives in one paragraph | Verify each |
| `seoul-suwon-hwaseong-waujeongsa-starfield` | L310/315 | "**the largest wooden reclining Buddha in the world**" (3 m, "Korean Buddhist Association certified") | Indefensible — many Asian wooden reclining Buddhas exceed 3m |
| `seoul-suwon-hwaseong-waujeongsa-starfield` | L310/316/317 | "**8-m outdoor Buddha head — Korea's tallest**", "**3-m jade Buddha = largest in Korea**" | Verify |
| `pocheon-sanjeong-lake-herb-island-art-valley` | L197 | "every winter the frozen lake becomes **Korea's signature traditional-sledding venue**" | Overclaim |
| `pocheon-sanjeong-lake-herb-island-art-valley` | L253 | "Light Fairy Tale Festival uses **3 million LED lights**" | High figure; verify with Herb Island |
| `pocheon-sanjeong-lake-herb-island-art-valley` | L302/304/310 | "**Pocheonseok used for Blue House, the National Assembly, and Incheon International Airport**" + "**Korea's first ecological-restoration project of an abandoned granite quarry**" | Pocheonseok claim is partially true (Korean granite generally is used; "Pocheon-specifically" is over-attributed) |
| `busan-private-car-charter-cruise-shore` & `busan-small-group-cruise` | L482 / L479 | "**Sannakji (live cut octopus) is Busan's culinary signature**" | Overclaim — sannakji is a Korean specialty, not specifically Busan's. |
| `busan-top-attractions-day-tour` | L137 | "Korea's most distinctive coastal temple" (Haedong Yonggungsa) | Soften |

### 2.7 Pickup / meeting-point inconsistency

| File | Issue |
|---|---|
| `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json` | Three different pickup-point lists in one document: highlights L196 says "Busan Station, Seomyeon, **Haeundae**"; pickup_dropoff Schema A L590 says "Busan Station, Seomyeon Station Exit 7, **Nopo Station Exit 3**" with explicit note "Nopo Station replaces Haeundae"; **polluted** timeline L1168 says "Busan Station Exit 4, Seomyeon Station Exit 4, **Haeundae Station Exit 5**". Fix by aligning to actual pickup_dropoff data (Nopo, since route is Yangsan-first). |
| `seoul-suburbs-private-chartered-car-10hr.en.json` | L170/L1118 image caption "Imjingak Peace Park — **Route 2 anchor**" exposes internal route id. Drop "Route 2 anchor". |
| `seoul-suburbs-private-chartered-car-10hr.en.json` | L348 mentions "Heyri Art Valley (Paju)" — Heyri is in Paju, but the file is otherwise about Pocheon Art Valley. Verify whether Heyri stop is really in this product or a copy-paste from the Paju tour. |

### 2.8 Image-caption / asset mismatch

| File | Issue |
|---|---|
| `jeju-cruise-shore-excursion-bus-tour.en.json` & `…small-group-tour.en.json` | L171 alt: "**Hexagonal basalt columns at Daepo Jusangjeolli cliff**"; L172 caption (same image): "**Cheonjiyeon waterfall**". Caption / image mismatch. |
| `seoul-private-nami-morning-calm-petite-france.en.json` | L243 vs L248 — see §2.2. Internal contradiction in highlight bullets. |

---

## 3. P1 — Should-fix patterns (high-volume, predictable)

### 3.1 priceNote / priceLabel sweep
A single template-edit removes "GetYourGuide / Klook / Trazy / Trip.com / operator listing / listing snippet" from ~20 priceNote/priceLabel hits across the catalog (see §2.4). Recommend running this as one batch before any other P1 work.

### 3.2 Customer-facing internal vocabulary sweep
A second template-edit replaces:

- `anchor` → describe the stop's role specifically; drop the boilerplate filler
- `calibrated` → `timed to` / `matched to`
- `fallback` → `bad-weather alternative` / `indoor cover`
- `operating window` / `service window` → `season` / `tour period` / `8-hour booking`
- `catalog` / `catalog-leading` / `catalog-unique` → drop the prefix; describe the merit
- `competing tour` → drop the comparison or use `typical day tours`
- `non-negotiable` → `fixed` / `the schedule doesn't move`
- `variant` (in cruise files only — keep East/West/South Route in private-car) → `route` / `option`
- `hydrangea-coded` / `heritage-coded` / `compound stop` / `buffer absorber` → rewrite descriptively
- `atockorea's [segments]` → drop entirely; describe the experience instead
- `Built-in fallback when flowers underperform` → `If the bloom is early or late, heritage stops still carry the day; the guide picks the best-blooming gardens that morning`

### 3.3 Spelling normalization (per-locale impact)

| Term | Variants found | Recommended canonical |
|---|---|---|
| Ilchul Land | "Ilchul Land", "Ilchulland", "Ilchul land" | **Ilchul Land** (matches `ilchulland.com`) |
| Osulloc | "O'sulloc", "O'Sulloc", "Osulloc" (3 variants in one file) | **Osulloc** (matches `osulloc.com` brand) |
| Manjanggul | "Manjanggul", "Manjang Cave", "Manjanggul Cave" | **Manjanggul Cave** |
| Cheonjeyeon vs Cheonjiyeon | Different waterfalls (NM 378 vs NM 379) — confused at least once | Keep distinct; cross-reference disambiguation |
| Jusangjeolli | "Jusangjeolli", "Daepo Jusangjeolli" | **Daepo Jusangjeolli** on first mention; `Jusangjeolli` thereafter |
| King Cherry / king cherry | mixed | Pick capitalization |
| Le Petit Prince / the Little Prince | mixed | Pick per locale |
| Starfield / StarField | clean — already consistent |
| Sky Capsule / Haeundae / Cheongsapo / Woljeonggyo | clean — no typos found in current set |

The original audit guide lists `Sky Captule`, `Haeunde`, `Seonsang`, `conceniemce` typos. **None of these were found in current EN source.** Either previously fixed or never present.

### 3.4 Sister-product / cross-tour leakage

- `from-busan-gyeongju-ancient-capital-day-tour.en.json` L22 shortCardDescription: `"Same classic six-attraction route as the **UNESCO Legacy version**"` — references sister product internally. Rewrite without "UNESCO Legacy version".
- `busan-gyeongju-unesco-legacy-tour-national-museum.en.json` L498 page renders product slugs `busan-top-attractions, from-busan-gyeongju-ancient-capital`. Drop slug references.

---

## 4. P2 — Minor / cosmetic

- Stop-count mismatches between catalog_card and hero meta (Files 1 & 2 in Seoul/Incheon batch).
- Boilerplate `whyOnRoute` filler used identically across 5 stops (`jeju-grand-highlights-loop`, `jeju-southern-top-unesco-spots-tour`, both Jeju cruise files).
- Tagline absolutes ("**Three things only Jeju does well in winter**") — soften to "Three things Jeju does best…".
- Triple-UNESCO framing for Hallasan acceptable; for stops that have only one UNESCO designation it should not be extended.
- Designboom "Top 10 art museums" decorative claim (`southwest-hallasan-osulloc-aewol` L404/419) — soft sourcing, acceptable.

---

## 5. Confirmed-clean categories

- **Spelling typos** from the original audit-guide list (Sky Captule, Haeunde, Seonsang, conceniemce) — **0 hits** in current set.
- **Page_section pollution** — only 3 files affected (all Busan), Jeju and Seoul/Incheon files clean on this dimension.
- **Internal `external_source` / `external_source_url` / `audit_summary` / `_methodology` / `reasoning` / `matching_metadata`** — present in many files, but these fields are NOT customer-rendered; out of scope for translation. Do NOT modify per audit guide §2.

---

## 6. Per-file P0 quick index

| File | P0 count | Top issue |
|---|---|---|
| busan-gyeongju-unesco-legacy-tour-national-museum | 0 (P1 heavy) | OTA priceNote + "anchor / catalog / competing" tone |
| busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju | 2 | page_sections pollution + 3-way pickup-point conflict |
| busan-private-car-charter-cruise-shore | 2 | page_sections is wholly Jeju; "on-time return guaranteed" 11× |
| busan-small-group-sightseeing-tour-cruise-passengers | 1 | "Sannakji is Busan's signature" + 8× "calibrated" + 3× "100%" |
| busan-spring-cherry-blossom-gyeongju-highlights-day-tour | 1 | page_sections is UNESCO-Legacy clone |
| busan-top-attractions-day-tour | 1 | Klook + bluelinepark.com tip in customer copy |
| from-busan-gyeongju-ancient-capital-day-tour | 0 | priceLabel OTA leak; sister-product slug leakage |
| east-signature-nature-core | 0 | "Ilchul Land" / "Ilchulland" inconsistency |
| jeju-cherry-blossom-tour-east-route | 1 | "the only road in Korea" superlative; "calibrated" / "Crater Last, As Anchor" tone |
| jeju-cruise-shore-excursion-bus-tour | 2 | gallery caption mismatch + Black Pig Natural Monument error + 20+ "variant" |
| jeju-cruise-shore-excursion-small-group-tour | 2 | Same as bus-tour |
| jeju-eastern-unesco-spots-day-tour | 2 | **Seongeup mislabeled UNESCO** in metaDescription/timeline; OTA priceNote |
| jeju-grand-highlights-loop | 1 | reviewsAttribution exposes "GetYourGuide / GYG / this catalog"; Hallasan UNESCO framing |
| jeju-hydrangea-festival-tour-east-route | 3 | **Seongeup labeled UNESCO** in timeline; "guaranteed indoor refuge"; "Built-in fallback when flowers underperform" |
| jeju-hydrangea-festival-tour-southwest-route | 2 | OTA badges (Trazy/Klook/Trip.com) on customer timeline cards; "compound stop / buffer absorber" |
| jeju-island-private-car-charter-tour | 2 | "world's tallest/largest lava column" inconsistency; "Asia's largest Buddhist temple complex" overclaim |
| jeju-southern-top-unesco-spots-tour | 2 | "Original price 43 USD on GetYourGuide" priceNote; "Eongdeongmul Valley removed from the GetYourGuide standard route" customer notes |
| jeju-west-south-full-day-authentic-tour | 4 | 7+ "Korea's largest/only/most" overclaims; Biyangdo "Korea's first carbon-free island certification"; O'sulloc 1979→25-year math error |
| jeju-winter-southwest-tangerine-snow-camellia-tour | 2 | **Mutae eel / NM 27 placed at wrong falls** (Cheonjeyeon ≠ Cheonjiyeon); "catalog-unique" |
| southwest-hallasan-osulloc-aewol | 3 | "East Asia's premier columnar-jointing site" superlative; Seonimgyo 78m suspect; O'Sulloc/Osulloc/O'sulloc 3-way mix |
| from-incheon-seoul-day-tour-cruise-guests | 1 | priceLabel OTA leak; "calibrated" repeats; stops-count 6 vs 7 |
| incheon-seoul-private-car-shore-excursion-cruise | 4 | "guaranteed_return" tag + "Guaranteed return" badge + "Sail-away timing guaranteed" highlight + "operator commits" whyOnRoute |
| seoul-dmz-private-3rd-tunnel-suspension-bridge | 1 | catalog asserts "220-m bridge" while body discloses 220m vs 150m discrepancy |
| seoul-private-nami-morning-calm-petite-france | 2 | 30k vs 200k LED contradiction; "Korea's largest garden lighting festival" |
| seoul-seoraksan-national-park-sokcho-beach-day-trip | 3 | priceNote OTA leak ×3; "world's largest seated bronze Buddha"; "world's oldest Seon temple" |
| seoul-suburbs-private-chartered-car-10hr | 1 | "Klook discounts often available" in admission text |
| seoul-suwon-hwaseong-folk-village-starfield-library | 4 | priceNote OTA leak ×3; Trazy in source list; 260 vs 270 houses |
| seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library | 4 | priceNote OTA leak ×3; Trazy in source list; 4-superlative cave stack |
| seoul-suwon-hwaseong-waujeongsa-starfield | 4 | priceNote OTA leak ×3; "world's largest wooden reclining Buddha"; "Korea's tallest 8m Buddha head"; "largest jade Buddha in Korea" |
| pocheon-sanjeong-lake-herb-island-art-valley | 5 | priceNote OTA leak ×3; "(Klook + Trip.com confirmed)" in highlight; Pocheonseok over-attribution; 3M LED claim; Heyri / Pocheon Art Valley confusion |

---

## 7. Recommended fix order

1. **Sweep 1 — priceNote / priceLabel OTA stripping** (~20 hits, lowest-risk template edit, biggest win)
2. **Sweep 2 — Cruise / shore-excursion legal-overclaim cleanup** (~15 hits across busan-private-car-charter-cruise-shore, incheon-seoul-private-car-shore-excursion-cruise, busan-small-group-cruise, jeju-hydrangea-east-route)
3. **P0 §2.1 — Rebuild 3 polluted page_sections** (busan-private-car-charter-cruise-shore, busan-plum-cherry, busan-spring-cherry). Use root `itineraryStops` as source of truth.
4. **P0 §2.2 — Fix the 3 confirmed factual errors** (Seongeup ≠ UNESCO ×2 files; Mutae eel ≠ Cheonjeyeon; Black Pig = Cultural Heritage Material No. 5 ×2 files)
5. **P0 §2.6 — Soften the unverified superlatives or source-back each one before translation**
6. **Sweep 3 — Customer-facing internal vocabulary cleanup** (~80 hits — anchor / calibrated / fallback / variant / catalog / operating window / etc.)
7. **P0 §2.7 — Reconcile the plum-cherry pickup-point 3-way conflict** using actual `pickup_dropoff` data
8. **P1 §3.3 — Spelling normalization** (Ilchul Land / Osulloc / Manjanggul / Daepo Jusangjeolli)
9. **Sweep 4 — Numeric contradictions** (LED count, house count, duration, stops count, bridge dimensions)

After each sweep, re-run the §15 risk-scan terms and confirm clean before moving to the next.

---

## 8. Open questions for product team

1. **`reviews_attribution` rendering** — does `page_sections` route trust block render `reviews_attribution`? If yes, `jeju-grand-highlights-loop` and `jeju-eastern-unesco` need GYG references stripped from this field, not just internal metadata.
2. **`_poi_meta.sources` rendering** — does any UI surface render the `_poi_meta.sources` arrays? If yes, ~25 OTA-name entries need stripping; if no, they are internal and out of scope.
3. **`competing_products` rendering** — `seoul-dmz-private-3rd-tunnel-suspension-bridge` L1273 and `busan-private-car-charter-cruise-shore` L1114 contain `competing_products` blocks naming sister tours / GetYourGuide. Confirm internal-only.
4. **`cruise_context_note` rendering** — `incheon-seoul-private-car-shore-excursion-cruise` L1163 contains a customer-readable string that mentions "shared schema across the catalog". If rendered, strip the schema-mechanics half.
5. **`matching_profile.note` / `matching_profile.reasoning` rendering** — many files contain calibration / scoring narrative in these fields. Confirm internal-only.

These five questions affect ~30 additional findings that are conditionally P0 (if rendered) vs P3 (if internal).

---

## 9. Status

- ✅ Audit complete, 30/30 files
- ⏸ No modifications applied. Original files unchanged.
- ➡ Ready for fix-pass once user confirms priority order and renders for §8 questions.
