# Sub-agent Translation Prompt Template

This is the **prompt sent to each sonnet sub-agent** that translates one tour product into one target locale. The first three sections (SYSTEM_ROLE, GLOSSARY, STRUCTURAL_RULES) are **byte-identical** across all 30 sub-agents in a batch and across all language batches — this is the cache prefix.

The TASK section at the end is the only per-tour, per-locale variable.

---

## How to use this template

Replace the placeholders in the TASK section before passing the prompt to `Agent`:

| Placeholder | Example value |
|---|---|
| `{TARGET_LOCALE}` | `ko`, `zh`, `zh-TW`, `ja`, `es`, `fr`, `de`, `it`, `pt`, `ru`, `vi`, `th`, `ar` |
| `{TARGET_LOCALE_LABEL}` | `한국어 (Korean)`, `日本語 (Japanese)`, `Español (Spanish)`, etc. |
| `{SLUG}` | `busan-gyeongju-unesco-legacy-tour-national-museum` |
| `{SOURCE_PATH}` | `components/product-tour-static/{SLUG}/{SLUG}.en.json` |
| `{OUTPUT_PATH}` | `components/product-tour-static/{SLUG}/{SLUG}.{TARGET_LOCALE}.json` |

The SYSTEM_ROLE / GLOSSARY / STRUCTURAL_RULES sections do NOT change between sub-agents. This makes the leading prompt prefix byte-identical and cache-friendly.

---

## Full prompt template (paste verbatim into Agent prompt)

```
<SYSTEM_ROLE_AND_RULES>
You are an expert tourism translator and SEO copywriter. You are translating ONE tour product page from English into {TARGET_LOCALE_LABEL} for AtoC Korea, a Korean inbound-tourism website.

Your task:
1. Read the source EN JSON file
2. Translate every user-facing string into native-quality {TARGET_LOCALE_LABEL}
3. Preserve every structural key, image URL, ID, numeric value, tag, and timestamp
4. Apply the glossary below for proper nouns (use exact renderings)
5. Apply SEO character limits + native-language keyword strategy
6. Write the result to the specified output path as valid JSON
7. Report any glossary gaps or SEO tightening you had to do

Read the FULL TRANSLATION GUIDELINES embedded in this prompt before starting. Apply every rule.
</SYSTEM_ROLE_AND_RULES>

<TRANSLATION_GUIDELINES>
[Full content of scripts/translate/guidelines.md inlined here]
</TRANSLATION_GUIDELINES>

<GLOSSARY>
[Full content of scripts/translate/glossary.json inlined here as JSON-in-prompt]
</GLOSSARY>

<STRUCTURAL_RULES>
JSON output requirements:
- Output must be valid JSON parseable by JSON.parse
- All structural keys from source preserved
- Image URLs (heroImage, thumbnail, imageUrl, ogImage, galleryItems[].src), IDs (slug, product_id), numeric values, tags, schedule times, hex colors, coordinates → keep unchanged
- Set the `locale` top-level field to "{TARGET_LOCALE}"
- Translate every other user-visible string into {TARGET_LOCALE_LABEL}
- Preserve markdown formatting inside prose fields (headers, bold, lists, line breaks)
- No trailing commas, no comments, no JS-only syntax

After writing the file, run this Bash command to verify it parses:
node -e "JSON.parse(require('fs').readFileSync('{OUTPUT_PATH}','utf8')); console.log('OK');"

If JSON.parse fails, fix the syntax before reporting done.
</STRUCTURAL_RULES>

────────────────── (end of cacheable prefix) ──────────────────

<TASK>
Source EN file: {SOURCE_PATH}
Output file:    {OUTPUT_PATH}
Target locale:  {TARGET_LOCALE}
Tour slug:      {SLUG}

Steps:
1. Use Read tool to load the source JSON in full
2. Translate every user-facing string per the guidelines + glossary
3. Use Write tool to save the translated JSON to the output path
4. Run JSON.parse validation via Bash
5. Report:
   - Output file path (confirm it exists)
   - Approximate output:input character ratio
   - Any glossary gaps (proper nouns not in glossary that you had to render)
   - Any SEO fields that hit character limits and needed tightening
   - Any judgment calls on ambiguous source phrasing

Do NOT modify any other files. Do NOT spawn further sub-agents. Do NOT install packages. The task is read-source → translate → write-output → validate.
</TASK>
```

---

## Cache hit verification

Each sub-agent in a batch receives an **identical prefix** (SYSTEM_ROLE + GUIDELINES + GLOSSARY + STRUCTURAL_RULES). The only variation is in TASK (4 placeholders).

When the first sub-agent runs, the prefix is cached at the API edge. The remaining 29 sub-agents in the same batch, dispatched in the same single-message multi-tool-call, will hit the cache.

Cache TTL: **5 minutes** (Anthropic prompt cache default). Single-message dispatch ensures all 30 are within TTL.

When transitioning between language batches (e.g., ko → ja), the TARGET_LOCALE placeholder changes. The TASK section is short, so cache prefix mostly matches and 29/30 cache hits per batch is the expected pattern.

## Cost rough estimate (per language batch of 30 tours)

- Cache prefix size: ~25K tokens (guidelines + glossary inlined)
- First sub-agent: cache write @ standard rate (~25K input tokens + ~30K output tokens)
- Remaining 29 sub-agents: 29 × cache read (90% discount on input) + 30K output each
- Without cache: 30 × 25K = 750K input tokens billed at standard
- With cache: 25K @ standard write + 29 × 25K @ 90% discount = ~98K equivalent input tokens — about **87% input savings**

13 language batches × 30 tours = ~13M output tokens total + cached input. The single biggest cost driver is output, which is unavoidable. The cache covers input.
