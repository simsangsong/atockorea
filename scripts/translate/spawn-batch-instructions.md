# Spawn Batch Instructions (Main Thread Operating Guide)

How to launch one language batch (30 tours in parallel) from the main Claude Code thread. Designed to maximize prompt-cache hit and minimize wall time.

## Prerequisites

Before spawning a batch:
- [x] `scripts/translate/glossary.json` exists and is parseable (Phase 1)
- [x] `scripts/translate/guidelines.md` exists (Phase 2)
- [x] `scripts/translate/template-prompt.md` exists (Phase 2)
- [x] `lib/tour-product/resolveTourProductDbLocale.ts` includes the target locale (Phase 3, only needed for fr/de/ru/pt/it/ar/th/vi)

## Tour slugs (the 30)

```
busan-gyeongju-unesco-legacy-tour-national-museum
busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju
busan-private-car-charter-cruise-shore
busan-small-group-sightseeing-tour-cruise-passengers
busan-spring-cherry-blossom-gyeongju-highlights-day-tour
busan-top-attractions-day-tour
east-signature-nature-core
from-busan-gyeongju-ancient-capital-day-tour
from-incheon-seoul-day-tour-cruise-guests
incheon-seoul-private-car-shore-excursion-cruise
jeju-cherry-blossom-tour-east-route
jeju-cruise-shore-excursion-bus-tour
jeju-cruise-shore-excursion-small-group-tour
jeju-eastern-unesco-spots-day-tour
jeju-grand-highlights-loop
jeju-hydrangea-festival-tour-east-route
jeju-hydrangea-festival-tour-southwest-route
jeju-island-private-car-charter-tour
jeju-southern-top-unesco-spots-tour
jeju-west-south-full-day-authentic-tour
jeju-winter-southwest-tangerine-snow-camellia-tour
pocheon-sanjeong-lake-herb-island-art-valley
seoul-dmz-private-3rd-tunnel-suspension-bridge
seoul-private-nami-morning-calm-petite-france
seoul-seoraksan-national-park-sokcho-beach-day-trip
seoul-suburbs-private-chartered-car-10hr
seoul-suwon-hwaseong-folk-village-starfield-library
seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library
seoul-suwon-hwaseong-waujeongsa-starfield
southwest-hallasan-osulloc-aewol
```

## Locale mapping table

| App locale | Locale label | URL segment |
|---|---|---|
| `ko` | 한국어 (Korean) | `ko` |
| `zh` | 简体中文 (Simplified Chinese) | `zh-CN` |
| `zh-TW` | 繁體中文 (Traditional Chinese) | `zh-TW` |
| `ja` | 日本語 (Japanese) | `ja` |
| `es` | Español (Spanish) | `es` |
| `fr` | Français (French) | `fr` |
| `de` | Deutsch (German) | `de` |
| `it` | Italiano (Italian) | `it` |
| `pt` | Português (Portuguese) | `pt` |
| `ru` | Русский (Russian) | `ru` |
| `vi` | Tiếng Việt (Vietnamese) | `vi` |
| `th` | ไทย (Thai) | `th` |
| `ar` | العربية (Arabic) | `ar` |

## Batch execution recipe

For one language batch (e.g., `ko`):

### Step 1: Build the cache prefix once

The cache prefix is the concatenation of:
1. The literal `<SYSTEM_ROLE_AND_RULES>...</SYSTEM_ROLE_AND_RULES>` block
2. The literal `<TRANSLATION_GUIDELINES>` content from `scripts/translate/guidelines.md`
3. The literal `<GLOSSARY>` content from `scripts/translate/glossary.json` as JSON-inlined
4. The literal `<STRUCTURAL_RULES>` block

**This prefix is byte-identical across all 30 sub-agents.** Substitute only `{TARGET_LOCALE_LABEL}` once at the top — all 30 sub-agents in the same batch share the same `{TARGET_LOCALE_LABEL}`, so the prefix stays cache-friendly within a single language batch.

### Step 2: Send a SINGLE message with 30 Agent tool calls

Multi-tool-call dispatch is required for cache hit:
- All 30 prompts share the cache prefix
- All 30 are dispatched within the same wall-clock instant
- The first reaches the API → cache write
- Remaining 29 → cache hit
- All complete in parallel (bounded by Sonnet's per-request latency, not serialization)

In Claude Code, this means the assistant message must contain 30 `Agent` tool-use blocks, not a sequence of separate messages.

### Step 3: Per-sub-agent payload

Each Agent call receives:
- `description`: short label like `"Translate {SLUG} to ko"`
- `subagent_type`: `"general-purpose"`
- `model`: `"sonnet"`
- `prompt`: the full template-prompt.md content with the 4 placeholders substituted

Example for one sub-agent (Korean, busan-gyeongju-unesco-legacy):
```
description: "Translate busan-gyeongju-unesco-legacy to ko"
subagent_type: "general-purpose"
model: "sonnet"
prompt: <full template content with placeholders substituted:
  TARGET_LOCALE = ko
  TARGET_LOCALE_LABEL = "한국어 (Korean)"
  SLUG = "busan-gyeongju-unesco-legacy-tour-national-museum"
  SOURCE_PATH = "components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.en.json"
  OUTPUT_PATH = "components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.ko.json">
```

### Step 4: Post-batch checks (after all 30 sub-agents complete)

Run these from the main thread:

```bash
# Count expected output files
ls components/product-tour-static/*/*.{TARGET_LOCALE}.json | wc -l   # should be 30

# Validate every output is parseable JSON
for f in components/product-tour-static/*/*.{TARGET_LOCALE}.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo "BROKEN: $f"
done
```

### Step 5: Quality sample

Pick 5 random output files, Read them, and check:
- `seo.pageTitle` reads naturally and is ≤60 chars
- `seo.primaryKeywords[]` are native-language search phrases (not literal translations)
- `headlineLine1` / `headlineLine2` carry marketing voice in the target language
- `itineraryStops[].description` flows naturally
- All image URLs unchanged
- `locale` field equals `{TARGET_LOCALE}`

If any sample fails the quality bar, re-spawn that sub-agent with corrective feedback.

### Step 6: Bundle registry update

Add 30 imports to `components/product-tour-static/_shared/tourProductBundleRegistry.ts`:

```ts
import busanGyeongjuUnescoLegacy{TARGET_LOCALE_CAMEL} from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.{TARGET_LOCALE}.json";
// ... 29 more
```

And add `{TARGET_LOCALE}: asBundleEntry(...{TARGET_LOCALE_CAMEL})` to each of the 30 entries in `STATIC_TOUR_PRODUCT_BUNDLES`.

### Step 7: Build verification

```bash
npm run build
```

If TypeScript errors, the most likely cause is the new locale not yet in `TourProductPageLocale` enum (only relevant for fr/de/ru/pt/it/ar/th/vi — see Phase 3).

## Order of language batches

Recommended execution order (Korean first as quality pilot):

1. `ko` — pilot, validates the whole pipeline + caching
2. `ja`
3. `zh`
4. `zh-TW`
5. `es`
6. `fr`
7. `de`
8. `it`
9. `pt`
10. `ru`
11. `vi`
12. `th`
13. `ar` — last (RTL handling will need extra layout review)

## Common pitfalls

- **Sub-agents not running in parallel**: if you call them in separate messages, you lose cache hits and serialize wall time. Always single-message multi-tool-call.
- **Glossary drift**: do NOT modify `glossary.json` between language batches. The cache hash includes its content. If you must update, accept that the next batch will be a cache miss.
- **Mismatched locale label**: if you set TARGET_LOCALE_LABEL inconsistently (e.g., `"Korean"` for one sub-agent and `"한국어 (Korean)"` for another), the prefix differs and breaks cache hits within the batch.
- **5-minute idle gap**: if you pause more than 5 min between sub-agent dispatches, cache TTL expires. Single-message dispatch avoids this.
