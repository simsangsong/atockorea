# Tour Product Translation Guidelines

You are translating a Korean tourism product page from English (`en`) into a target locale. The source is a `tour_product_full_page_v1` JSON document used by AtoC Korea's Next.js website.

## Role + Voice

- **Native-speaker tone** in the target locale — never sound like a translation
- **SEO-friendly** — write for both human readers and search engines
- **Trust-marketing voice** — confident, specific, evidence-based (avoid hyperbole)
- **Concrete > abstract** — keep place names, durations, distances, prices precise

## Structural Fidelity (CRITICAL)

The output JSON must:

1. **Preserve every key** in the source, in the same nesting and order
2. **Preserve every non-translatable value as-is**:
   - Image URLs (`heroImage`, `thumbnail`, `imageUrl`, `ogImage`, `galleryItems[].src`, etc.)
   - IDs (`id`, `product_id`, `slug`)
   - Numeric values (`rating`, `reviewCount`, `stopsCount`, `discountPercent`, `amountLabel` if it's a number-as-string like "78", `lat`, `lng`, etc.)
   - Tags / enum-like keys (`tags[]`, `pills[]`, `category` enums, `document_kind`, `schema_version`)
   - Schedule times (`08:10`, `19:45`, etc.)
   - URL paths (`href`, `path`)
3. **Change exactly one field**: `locale` → set to the target locale code
4. **Output valid JSON**: parseable by `JSON.parse`. No trailing commas. No comments.
5. **Match key ordering** when feasible (keep readability for diff review)

## SEO Constraints (HARD LIMITS)

- `seo.pageTitle`: ≤ 60 characters (Google SERP truncation point)
- `seo.metaDescription`: ≤ 155 characters
- `headlineLine1`: ≤ 80 characters
- `headlineLine2`: ≤ 80 characters
- `catalog_card.title`: ≤ 60 characters
- `catalog_card.shortCardDescription`: ≤ 300 characters, with key terms in the **first 100**

If your translation exceeds these limits, rewrite tighter — do not truncate.

## SEO Keyword Strategy

`seo.primaryKeywords[]` (5 entries) — **DO NOT TRANSLATE LITERALLY**.

Instead, write 5 keyword phrases that real users in the target market would type into Google for this exact tour. Use:
- Native search idiom and word order
- Locally common spelling of place names (use the **glossary** below)
- Mix of broad + long-tail queries

Examples:
- EN: `"Gyeongju from Busan"` → ja: `"釜山発 慶州ツアー"`, ko: `"부산 출발 경주 투어"`, zh: `"釜山到庆州一日游"`
- EN: `"Bulguksa Temple tour"` → ja: `"仏国寺 ツアー"`, ko: `"불국사 투어"`, fr: `"visite temple Bulguksa"`

## Currency + Pricing

- `price.amountLabel`, `priceLabel`, `priceNote`: keep `US$XX` / `USD XX` format. **Do NOT convert** to local currency.
- Only translate the **surrounding label text** (e.g., "per person" → "por persona" / "1名様あたり" / "한 명당")
- Keep `discountPercent` as a number

## Brand Names + Acronyms

Keep these as-is in **all locales**:
- `Starfield Library`
- `Stripe`
- `GetYourGuide`
- Hotel names (e.g., "Lotte Hotel"), unless the glossary specifies a localized form
- Brand names that are English in the source (e.g., "Petite France")

Acronyms:
- `UNESCO` → keep in Latin-script locales; for CJK use the locally established form (consult glossary)
- `DMZ` → keep as `DMZ` everywhere

## Proper Nouns — USE THE GLOSSARY

**Below is the master glossary** with 119 terms across 8 categories. When you encounter a term from this glossary in the source, use **exactly** the rendering listed for the target locale.

If you encounter a proper noun that's NOT in the glossary:
1. Use phonetic transliteration appropriate for the target locale's script
2. Add a classifier word if helpful (e.g., Spanish "Templo", French "Temple", German "-Tempel")
3. Note it in your final report as a "glossary gap" so we can add it

## Translation Method (ITERATIVE PER FIELD)

For each translatable string in the source:

1. **Read the surrounding context** (which key, which array, what nearby fields say)
2. **Identify proper nouns** — replace via glossary
3. **Translate the rest** in native voice
4. **Check length limit** if SEO field
5. **Verify it reads naturally** to a target-locale native speaker

## Markdown Inside JSON Strings

Some fields (like `overview`, `cancellationPolicy`) contain Markdown. Preserve:
- Heading levels (`##`, `###`)
- Bold/italic markers (`**`, `*`, `_`)
- Bullet lists (`-`, `*`)
- Numbered lists (`1.`, `2.`)
- Line breaks (`\n\n`)
- Backtick code spans

Translate the **prose** but keep the **markup** intact.

## What Stays English (Even in Non-English Locales)

- Image URLs and any URL
- Slugs (e.g., `busan-gyeongju-unesco-legacy-tour-national-museum`)
- Tags and enum values (e.g., `"small_group"`, `"unesco"`, `"from_busan"`)
- Hex color codes
- Numeric labels that are just numbers (`"78"`, `"5"`, `"11.5"`)
- Coordinate values
- Brand names (see above)

## Output Validation Checklist

Before reporting done:

- [ ] Output file is valid JSON (`JSON.parse` succeeds)
- [ ] `locale` field equals target locale code
- [ ] All structural keys preserved
- [ ] All image URLs preserved unchanged
- [ ] SEO fields under their character limits
- [ ] No trailing commas
- [ ] No literal "TODO" or "[TRANSLATE]" markers left in output
- [ ] Markdown markup preserved in prose fields

## Reporting Format

After writing the translated file, report:
1. Output file path
2. Source-to-output character ratio (rough, e.g., "ko output is 0.7× source length")
3. Any glossary gaps encountered (proper nouns NOT in glossary)
4. Any SEO field that hit its character limit and needed tightening
5. Any field where you made a judgment call about ambiguous source phrasing
