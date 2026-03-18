# Premium Readability Audit: Homepage & Tour Detail Page

**Scope:** Homepage (`app/page.tsx` and its section components), Tour detail page (`app/tour/[id]/page.tsx` and related components).  
**Focus:** Visual hierarchy, grey-text overuse, duplicated content, missing price on AI cards, mobile text density, and trust/consistency.  
**No code changes in this step** — audit only.

---

## 1. Visual hierarchy problems

### Homepage

- **Hero:** Headline, sub copy, trust list (4 items), and primary CTA sit in one block with similar visual weight. Trust items use `text-xs sm:text-sm text-white/90` and read as one flat list; there is no clear “primary vs supporting” distinction.
- **Section titles:** All section headings use the same band (`text-xl md:text-2xl font-bold`). Comparison, Tour types, How it works, Preview itinerary, Destinations, Classic bus, Reviews, and Final CTA feel like one level — no clear “hero section” vs “supporting section” differentiation.
- **ComparisonSection:** Single `h2` plus a list of 7 bullets in cards. All bullets share the same card style and typography; no emphasis on 1–2 key differentiators.
- **TourTypeCards:** Hierarchy is partly right (AI Private has border treatment, Classic Bus is muted with `opacity-95` and grey title). But AI Private and AI Small-Group Join cards use the same card variant and similar body styling, so the “primary vs secondary” product distinction could be stronger (e.g. one clear hero card).
- **Destinations:** The large Jeju “Semi-F.I.T” block and the three destination cards (Jeju, Busan, Seoul) compete for attention; the “Proposed tours” list below adds another layer without a clear reading order.

### Tour detail page

- **Left column:** Many sections use the same pattern: white card, rounded-2xl, shadow. “Why Choose Us” strip, Why this fits you, Booking timeline, Cancellation, Who this is best for, Gallery, Timeline, Meeting & Pickup, At a Glance, and bottom collapsibles all feel like siblings. Hard to tell what is “must read” vs “supporting.”
- **Section tags:** Small uppercase tags above sections (“Quick Info”, “YOUR DAY AT A GLANCE”, “Captured Moments”, “Logistics”) use different colors (amber, sky, rose, indigo, yellow) and similar size — they add noise rather than a clear hierarchy.
- **Price:** Price lives only in the sidebar and mobile sticky bar. In the main content there is no price callout near the hero or “Why Choose Us,” so users who scroll the left column first don’t get a clear price anchor.

---

## 2. Grey-text overuse

### Homepage

- **TourTypeCards:** All body copy uses `text-[#666666]` (AI Private, Join, and Classic Bus). Classic Bus card also uses `text-[#666666]` for the **title**, so the third option is visually downgraded more than necessary and grey dominates the section.
- **DestinationsCards:** Busan and Seoul cards use `text-[#666666]` for both title and body. “AI tours available now” under Jeju is `text-[#666666]`. Proposed tours: subtitle and metadata (participants, vehicle, price) use `text-[#666666]` or `text-xs text-[#666666]` — price is present but easy to miss.
- **PreviewItineraryCard:** Entire `CardContent` is `text-sm text-[#666666]` (traveler count, vehicle, deposit/balance) — all secondary info reads as one grey block.
- **ComparisonSection:** Uses `text-[#1A1A1A]` for bullets (good). **CompactTrustBar** uses `text-[#1A1A1A]` (good). These are the exceptions; elsewhere grey is overused for body and sometimes titles.

### Tour detail page

- **Why Choose Us strip:** All three subtitles use `text-[11px] sm:text-xs text-neutral-500` — support copy is very low contrast.
- **Cancellation policy:** Body `text-sm text-neutral-600`; autoChargeWarning `text-xs text-neutral-500` — policy feels de-emphasized.
- **Timeline cards:** Time badge `text-neutral-600`; “View Details” and popover body use neutral greys.
- **Subtitle and pickup copy:** “Cinematic day trip” and “Pickup points count” use `text-neutral-500`; itinerary empty state `text-neutral-500`.
- **At a Glance:** Labels “Duration” and “Languages” use `text-neutral-400` — very light.
- **Mobile sticky bar:** “/ person” uses `text-neutral-500`.
- **Bottom collapsible bodies:** Use `var(--cro-text-light)` and grey tones; combined with long copy, the page feels grey-heavy.

**Recommendation:** Reserve grey for true secondary/tertiary info (captions, hints). Use near-black (`#1A1A1A` / neutral-900) for all primary body and at least one level of titles so key content meets readability and contrast expectations.

---

## 3. Duplicated content layers

### Homepage

- **Trust copy repeated:** `COPY.hero.trust` (e.g. “AI-built itinerary in minutes”, “Smarter pickup flow”, “3–13 travelers only”, “Transparent deposit and balance rules”) appears in the Hero bullet list and again in **CompactTrustBar** in the same order. Users see the same four lines twice in quick succession.
- **Trust vs comparison:** Comparison bullets (e.g. small groups, transparent pricing, pickup, deposit) overlap with hero trust and with Tour type card value props. The same ideas appear in Hero, Trust bar, Comparison, and Tour type cards without a single “source of truth” and clear progression (e.g. trust → why us → product choice).
- **Flow explained twice:** “How it works” (4 steps) and “Example itinerary” (preview card with pickup area, vehicle, deposit/balance) both describe the booking/planning flow. Redundant for users who read both.
- **Dual Jeju CTA:** The Jeju destination card and the large dark “Semi-F.I.T” block both link to `/custom-join-tour` with similar messaging. Two big CTAs to the same action can feel repetitive.

### Tour detail page

- **Trust messaging:** Hero badge “Trusted by 50,000+ Travelers” plus “Why Choose Us” (Secure deposit, Expert guides, Verified LLC) repeats trust themes that also appear on the homepage.
- **Booking and payment:** Booking timeline, Cancellation policy, “Deposit Today” in sidebar/mobile bar, and payment options in the sidebar all explain deposit/balance and cancellation. Concepts are repeated in several places.
- **Who this is for / Why this fits:** “Why this fits you” and “Who this is best for” are adjacent; both are audience/target segments and could be merged or clearly differentiated.
- **Meeting & Pickup notices:** Five separate notice cards (exact times, arrive early, no-show, airport, Jeju outside-city cost) use the same pattern (icon + short text). Could be one concise “Pickup tips” block with bullets to reduce repetition and length.
- **Included/Excluded vs Highlights vs Full Description:** “At a Glance” (Included/Excluded), collapsible “Highlights,” and “Full Description” can overlap in content. Users may see the same benefits or details in multiple sections.
- **Bottom collapsibles:** Highlights, Full Description, FAQ, Important Notes, Child eligibility are five separate sections. Combined with the rest of the page, the amount of text and number of “layers” can feel overwhelming and redundant.

---

## 4. Missing visible price on AI cards

### Homepage (AI-related cards only)

- **TourTypeCards — AI Private and AI Small-Group Join:** No price or price range. Only body copy and CTAs (“Start Private Tour”, “Join Small Group”). Users cannot compare cost to Classic Bus or decide without leaving the page.
- **PreviewItineraryCard:** Shows “Example Jeju day tour” with pickup area, traveler count, vehicle, deposit/balance note — **no price or “from ₩X”**. Missed opportunity to set expectations.
- **DestinationsCards — large Jeju CTA block:** “Semi-F.I.T (Beta)”, title, description, three steps, and CTA. **No price or “from ₩X”.** The block is the main AI/custom-tour hero on the section; lack of price weakens intent.
- **DestinationsCards — proposed tours list:** Price **is** shown (`(pt.total_price_krw / 10000).toFixed(0)만 원`) but in `text-xs text-[#666666]` on the second line with participants and vehicle type. Easy to miss; should be more prominent (e.g. primary line or bold) for quick scanning.

**Note:** Classic bus tours on the homepage (TourCard in HomeTourSections) do show price clearly (`text-sm font-bold text-slate-700`). The gap is specific to **AI** positioning (Tour type cards, preview itinerary, Jeju CTA block) and to the proposed-tours list treatment.

---

## 5. Sections that feel too text-heavy on mobile

### Homepage

- **ComparisonSection:** Seven bullets in a single or two-column grid. On small screens this is a long scroll of similar-looking cards with no visuals — feels like a wall of text.
- **TourTypeCards:** Each card has a title, a body paragraph, and 4 bullet points. On mobile, three such cards stacked make the section very text-dense; bullets could be shortened or collapsed (e.g. “See benefits”).
- **DestinationsCards — Jeju CTA block:** Title, short description, three step bullets, and CTA. On narrow viewports this is a lot of copy in one block; consider shortening or showing steps in a more compact way (e.g. icons only with tooltips).
- **ReviewsSection:** Four quote blocks in a 2×2 grid. On mobile, four long quotes in a row can feel heavy; consider 2 visible + “Read more” or a carousel.

### Tour detail page

- **Why Choose Us:** Three items, each with icon + title + subtitle. On mobile the strip wraps; three lines of subtitle copy add to text load.
- **Cancellation policy:** Full paragraph + autoChargeWarning. Dense for a single card.
- **Who this is best for / Why this fits you:** Two list-heavy blocks in a row.
- **Timeline:** Multiple StyledTimelineCards with “View Details” and popover text. Each card has title, time, and expandable details — many words on small screens.
- **Meeting & Pickup:** List of pickup points + map + five notice cards (icon + text). The five notices alone are a lot of copy in one section.
- **At a Glance:** Two info cards plus two lists (Included / Excluded). Acceptable but still a lot of list text.
- **Bottom section:** Five collapsible sections (Highlights, Full Description, FAQ, Important Notes, Child). Each can be long; opening several makes the page feel endless and text-heavy on mobile.

**Recommendation:** Shorten or collapse secondary copy on mobile (e.g. “Read more” for policies, accordions for pickup tips, limit visible review count). Keep one clear primary message per section.

---

## 6. Sections that reduce trust (too long, redundant, or inconsistent)

### Homepage

- **Repetition of trust and value props:** Seeing the same four trust lines in Hero and CompactTrustBar, then similar ideas again in Comparison and Tour type cards, can feel like padding rather than proof. Trust is stronger with one clear trust strip and then differentiated “why us” vs “product choice” content.
- **Multiple CTAs to same action:** “Plan My Trip” (Hero), “Start Private Tour” / “Join Small Group” (Tour type cards), Jeju card, Jeju big block, “Plan My Trip” (Final CTA) — all lead to the same or similar flows. Without clear differentiation (e.g. “Private” vs “Join” vs “See tours”), it can feel repetitive or unclear.
- **Reviews:** Generic quotes only; no names, dates, or sources. Reduces credibility; consider at least “— Traveler” or “— [Month]” and, if possible, link to a review platform.
- **Classic bus placement:** “Prefer a classic group tour instead?” followed immediately by a row of classic bus cards can feel like two competing products with no clear positioning (e.g. “If you prefer fixed itineraries and lower price, see these” vs “Or build your own”).

### Tour detail page

- **Trusted by 50,000+:** Single badge in hero with no link or proof. If unverifiable, it can hurt trust; consider removing or replacing with something verifiable (e.g. review count, partner logos).
- **Why Choose Us:** Same three points (deposit, guides, LLC) as generic trust; could be tour-specific (e.g. “Free cancellation for this tour”, “Guide speaks X”) to feel less generic.
- **Cancellation + deposit + payment:** Same rules stated in cancellation card, sidebar payment options, and mobile bar “Deposit Today.” Repetition is good for clarity but the number of places can feel defensive or legal-heavy.
- **Meeting & Pickup:** Five separate notice cards (exact times, arrive early, no-show, airport, Jeju cost) feel like a long list of rules and can imply “things that go wrong” rather than “smooth experience.”
- **Bottom collapsibles:** Highlights, Full Description, FAQ, Important Notes, Child eligibility — many sections with overlapping content (e.g. highlights vs full description). Inconsistent tone: some sections are short bullets, others long prose; “儿童资格 / Child eligibility” is bilingual while the rest of the page may be one language. This can feel inconsistent and overwhelming.
- **Important Notes:** Full component content may be long or legal; if it’s a wall of text, it can reduce trust. Consider a short summary + “Full terms” expandable.

---

## Summary table

| Issue | Homepage | Tour detail |
|-------|----------|-------------|
| **Visual hierarchy** | Flat section titles; hero and trust blend; no clear “hero product” card | Flat left column; many same-style cards; price only in sidebar/bar |
| **Grey-text overuse** | TourTypeCards, Destinations, Preview itinerary, proposed tours metadata | Why Choose Us subtitles, cancellation, timeline, At a Glance labels, mobile bar |
| **Duplicated content** | Hero trust = Trust bar; comparison/tour types overlap; dual Jeju CTA; How it works + Example itinerary | Trust + booking/deposit in several places; pickup notices ×5; Highlights/Description/FAQ overlap |
| **Missing price (AI)** | Tour type cards, Preview itinerary, Jeju CTA block; proposed tours price too subtle | N/A (single product; price in sidebar/bar) |
| **Text-heavy on mobile** | Comparison 7 bullets, Tour type cards ×3, Jeju block, 4 reviews | Why Choose Us, cancellation, timeline, Meeting & Pickup notices, 5 collapsibles |
| **Trust / length / inconsistency** | Repeated trust; generic reviews; multiple same CTAs; classic bus vs AI unclear | “50,000+” badge; generic Why Choose Us; many deposit/cancellation mentions; 5 collapsibles + mixed tone/language |

---

## Next steps (for implementation phase)

1. **Hierarchy:** Introduce a clear level above current section titles (e.g. one “hero” section with a larger heading or visual) and demote secondary sections (e.g. smaller or lighter headings). On tour detail, add a clear price callout in the main column and reduce same-style card repetition.
2. **Grey text:** Replace `#666666` / neutral-500/600 for primary body and key labels with near-black; reserve grey for captions and hints only. Ensure proposed-tour price is bold or on the first line.
3. **Duplication:** Use hero trust once (e.g. only in Trust bar and remove from hero list, or vice versa). Differentiate Comparison (reasons) vs Tour type cards (products). Merge or shorten “How it works” and “Example itinerary.” On tour detail, consolidate deposit/cancellation messaging and merge the five pickup notices into one block.
4. **Price on AI cards:** Add “From ₩X” or a range to AI Private and AI Small-Group Join cards, Preview itinerary card, and the Jeju CTA block. Make proposed-tour price prominent (e.g. bold, first line).
5. **Mobile text:** Shorten Comparison bullets or show 3 + “More reasons”; collapse Tour type card bullets on mobile; shorten Jeju block steps; limit visible reviews (e.g. 2 + “More”). On tour detail, collapse or shorten cancellation, merge pickup notices, and consider fewer or merged bottom collapsibles.
6. **Trust:** One clear trust strip on homepage; differentiate “why us” vs “product.” Add reviewer attribution where possible; clarify or remove “50,000+.” Make Why Choose Us tour-specific. Unify tone and language in bottom sections (e.g. single language for Child eligibility heading).
