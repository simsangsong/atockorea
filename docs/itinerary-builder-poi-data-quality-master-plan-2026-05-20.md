# Itinerary Builder POI Data Quality Master Plan

Date: 2026-05-20
Revised: 2026-05-21 (post code/DB verification — see Revision Note)

## Revision Note (2026-05-21)

This plan was reviewed twice (Claude → Codex) and then verified directly against
the codebase and the production `match_pois` table. The revision corrects three
classes of error and adds one structural finding the earlier drafts missed.

Corrected from v1:

- `scripts/wire-poi-images.mjs` does **not** exist on `main` (confirmed:
  `git ls-files "scripts/*wire*"` empty, file absent on disk). Any prescription
  that depends on it is not executable here. Removed.
- `scripts/seed-match-pois-snapshot.json` **is** a git-tracked file (confirmed:
  `git ls-files`). It is a **write-only output** of the seed script
  (`seed-match-pois-from-tour-jsons.mjs:204`, `writeFileSync`) and is never read
  back as input. So it is not a re-pollution vector, but a re-seed **will** dirty
  a tracked file → that diff must be handled (commit or gitignore).
- Total `match_pois` rows is **91** (not 82). Visible builder count is **44**
  (verified).

New structural finding (missed by both earlier reviews):

- `match_pois.default_image_url` is written by **at least two** pipelines, not one:
  1. `seed-match-pois-from-tour-jsons.mjs` — image from tour-JSON `stop.image`.
  2. `import-match-v18.mjs` — image from the KB
     `data/poi_kb/poi_knowledge_base_v1.29.json` via `kbEntry.default_image_url`.
  Plus a historical third writer (the now-absent `wire-poi-images.mjs`, which per
  its design wrote `match_pois` directly and mirrored into the snapshot).
- The KB contains **no** `ahopsan`/`ilchulland` image paths (grep-confirmed).
  Therefore `woljeonggyo_bridge`'s ahopsan image is an **orphan**: present in the
  DB and the committed snapshot, but in **neither** the current tour JSON **nor**
  the KB. No current pipeline reproduces it — and none repairs it. It must be
  wired explicitly.
- Consequence: the v1 assumption that "fix tour JSON + fix seed script ⇒ pipeline
  is clean" is **incomplete**. Provenance must be established first (Phase 0),
  because Phase "fix source JSON / seed logic" only affects POIs actually sourced
  from that pipeline.

## Goal

Clean and stabilize the POI data used by the itinerary builder so that every
visible POI has trustworthy:

- name and region
- location
- category and stay duration
- representative image
- image gallery when available
- description
- highlights
- visit basics
- convenience notes
- smart notes
- route rationale

The immediate quality issue is visual trust. A small, well-bounded set of POIs
render with missing or incorrect images, and exactly one has empty structured
fields. The longer-term goal is to make the POI **write paths** auditable so
future static-tour-JSON or KB updates do not reintroduce the same problems.

## Verified Defect Surface (2026-05-21)

This is the real, measured scope — not an estimate.

```text
match_pois total rows ................ 91
visible builder POIs ................. 44
visible POIs missing description ..... 0
visible POIs missing highlights ...... 0
visible POIs missing why_on_route .... 0
visible POIs with empty {} structured fields ... 1  (jeju_tangerine_picking_experience)
visible POIs with image problems ..... 8
  image is NULL ...................... 5
  image points to wrong POI folder ... 3
image path distribution (visible):
  /images/tours/* .................... 35
  /images/itinerary/* ................ 4
  null ............................... 5
```

So the actionable defect is **8 images + 1 row's structured fields**, not a broad
data-rot problem. The plan must stay proportionate to that.

## Current Data Flow

### Source Content

Primary detail-page source:

```text
components/product-tour-static/**/<slug>.en.json
```

Relevant field: `itineraryStops[*]`. Each useful stop can carry:

```text
_poi_meta.poi_key   (or _poi_metas[] for compound stops)
name / category / duration
image / images
description / highlights / whyOnRoute
visitBasics / convenience / smartNotes
```

### Secondary Source: POI Knowledge Base

```text
data/poi_kb/poi_knowledge_base_v1.29.json
```

Keyed by `poi_key`; carries `visitBasics`, `convenience`, `smart_notes`,
`default_image_url`, `stop_role`, etc. Consumed by `import-match-v18.mjs`.
**The plan must treat this as a first-class source, not just the tour JSONs.**

### Builder DB Table

Builder reads from `public.match_pois`. Verified columns include:

```text
poi_key, name_en, name_ko, names_other_locales,
region, category, default_image_url, default_stay_minutes,
lat, lng, stop_role, is_attraction, is_operational,
poi_meta, matching_profile, description, highlights, images,
why_on_route, visit_basics, convenience, smart_notes,
kb_version, builder_profile_source, builder_profile_version
```

`kb_version` and `builder_profile_source` are useful **provenance signals** for
Phase 0.

### Write Paths Into `match_pois` (CRITICAL — was missing in v1)

```text
1. scripts/seed-match-pois-from-tour-jsons.mjs
     default_image_url <- stop.image      (tour JSON)
     writes scripts/seed-match-pois-snapshot.json (output only)
2. scripts/import-match-v18.mjs
     default_image_url <- kbEntry.default_image_url  (poi_knowledge_base_v1.29.json)
     ON CONFLICT (poi_key) DO UPDATE; supports --dry-run / --single
3. scripts/enrich-match-pois-from-tour-jsons.mjs
     images <- union(stop.images, stop.image, stop.galleryItems[].src)
     visit_basics/convenience/smart_notes <- first non-null across tours
4. scripts/wire-poi-images.mjs   (ABSENT on main — historical)
     wrote match_pois directly + mirrored snapshot; likely origin of orphan values
5. ad-hoc SQL / migrations (e.g. region corrections — snapshot says woljeonggyo
     region "busan", DB says "gyeongju" ⇒ out-of-band edits have happened)
```

Any "scripts cannot reintroduce pollution" guarantee must account for **all** of
these, not only path 1.

### Builder UI

Main reader: `app/itinerary-builder/[region]/page.tsx`. The **actual** visible
filter (verified `page.tsx:66-80`) is:

```text
DB-level:   .in("region", cluster) AND name_en IS NOT NULL AND lat IS NOT NULL
client-side: is_attraction === true
             OR (is_attraction == null && isBuilderAttraction(poi_key))
```

This is **not** `is_attraction = true`. The taxonomy fallback
(`isBuilderAttraction`, from `lib/itinerary-match-engine/poi-taxonomy.ts`) is part
of the contract. The audit MUST import and reuse this exact predicate.

Region clusters (verified `lib/itinerary-builder/regions.ts:13-20`):

```text
REGION_SLUGS = ["busan", "jeju"]
busan -> [busan, yangsan, gyeongju, ulsan, miryang]
jeju  -> [jeju]
```

## Scope

### Phase 1 Scope: Visible Builder POIs

Fix only the POIs that can actually appear in the itinerary builder first.

Visible-builder criteria (use the real predicate, not `is_attraction = true`):

```text
region in builder cluster
name_en is not null
lat is not null
( is_attraction = true ) OR ( is_attraction is null AND isBuilderAttraction(poi_key) )
```

Observed visible count: **44**. (Today `is_attraction = true` happens to also
yield 44, but encoding that as the definition creates a future blind spot the
moment a POI relies on the taxonomy fallback — so do not encode it.)

### Out Of Scope For First Pass

Defer: hidden POIs, logistics-only POIs, route-variant metadata keys, non-builder
regions, full external fact re-verification, automated web search per POI.

## Known Issues

### Image Issues — with provenance (verified)

```text
poi_key                            region    current image            source of truth      fix path
---------------------------------  --------  -----------------------  -------------------  ---------------------------
woljeonggyo_bridge                 gyeongju  /tours/ahopsan-bamboo/.. ORPHAN (none)        wire local /itinerary asset
tongdosa_temple                    yangsan   NULL                     none                 wire local /itinerary asset
jeonnong_ro_cherry_blossom_street  jeju      /tours/ilchulland/..     tour JSON stop.image fix JSON + need photo
noksan_ro_gasiri_blossom_road      jeju      /tours/ilchulland/..     tour JSON stop.image fix JSON + need photo
biff_square                        busan     NULL                     none                 need photo
hallasan_eorimok_trail             jeju      NULL                     none                 need photo
hallim_park                        jeju      NULL                     none                 need photo
jeju_tangerine_picking_experience  jeju      NULL                     none                 need photo (+ {} cleanup)
```

Two distinct provenances ⇒ two distinct fixes:

- `jeonnong_ro` / `noksan_ro` — the ilchulland image is **live in the current tour
  JSON `stop.image`**. Re-seeding reproduces it. Fixing the JSON (below) genuinely
  prevents re-pollution. But no correct local asset exists, so the JSON fix alone
  leaves them empty until a real photo is sourced.
- `woljeonggyo_bridge` — **orphan**. Not in tour JSON (no `image` field at all),
  not in KB. Re-seeding will NOT reproduce ahopsan, but also will NOT fix it
  (would go null). Correct local assets already exist
  (`/images/itinerary/woljeonggyo-{reflection,front-day,pavilion-night}.webp`) →
  must be wired explicitly. v1 listing this under "fix wrong image in source JSON"
  was a misdiagnosis.

Local assets that already exist (so these need no photo sourcing — just wiring):

```text
woljeonggyo_bridge -> woljeonggyo-front-day.webp (+ reflection, pavilion-night)
tongdosa_temple    -> tongdosa-iljumun.webp (+ yeongsanjeon)
```

The other six need real photos per the photo-quality policy (16:9, OTA-bright, NO
AI feel, real-photo detail q95). Note: the current ilchulland/ahopsan images are
`chatgpt-image-*.webp` (AI-generated) — they violate that policy regardless of
being the wrong POI.

### Empty Structured Objects — exactly one POI

Only `jeju_tangerine_picking_experience` has empty `{}` for
`visit_basics` / `convenience` / `smart_notes` among the 44 visible POIs. Zero
visible POIs are missing `description`, `highlights`, or `why_on_route`. The
`{}`→null normalization rule is still correct, but it is a one-row fix, not a
theme.

### Source JSON Pollution — narrowed

```text
jeju-cherry-blossom-tour-east-route.en.json
  jeonnong_ro_cherry_blossom_street -> stop.image = ilchulland   (CONFIRMED, fix here)
  noksan_ro_gasiri_blossom_road     -> stop.image = ilchulland   (CONFIRMED, fix here)

busan-gyeongju-unesco-legacy-tour-national-museum.en.json
from-busan-gyeongju-ancient-capital-day-tour.en.json
  woljeonggyo_bridge -> NO image field present  (NOT a JSON fix — orphan in DB)
```

### Surfaced by the Phase 1 audit (2026-05-21)

```text
un_memorial_cemetery   tour-JSON stop borrows haedong-yonggungsa/* + taejongdae/*
                       gallery images (cross-POI). DB default_image_url is its OWN
                       (AI) folder so NOT a strict fail; seed Signal-A rejects the
                       borrowed ones. Gallery/source hygiene only.
_metadata              two NON-POI rows in match_pois (KB top-level metadata keys
_kb_metadata           seeded as POIs). Not visible (no region/name) so the builder
                       UI is unaffected — catalog junk, candidate DELETE.
```

## Data Quality Rules

### POI Visibility Contract

Every visible builder POI must have: `poi_key, name_en, region, lat, lng,
category, default_stay_minutes, default_image_url, description, highlights,
visit_basics, convenience, smart_notes, why_on_route`.

Allowed exceptions: `images` may be null if `default_image_url` exists; `name_ko`
and `names_other_locales` may be incomplete for MVP; `why_on_route` may be generic
but not absent.

Audit MUST evaluate "visible" via the imported `isBuilderAttraction` predicate
(see Builder UI), never a hardcoded `is_attraction = true`.

### Image Selection Rule

For builder POIs, prefer:

```text
1. curated POI image override
2. stop.images[0] if present and valid
3. stop.image if present and valid
4. KB default_image_url if present and valid
5. known safe fallback by region/category
6. null only if hidden from builder
```

This changes current seed behavior (which trusts `stop.image` first) and adds the
KB tier (4), since `import-match-v18` already sources from it.

### Image Validity — TWO separate signals (do not conflate)

The repo convention is generic `chatgpt-image-*.webp` filenames, so a pure
"path token vs poi_key" test flags almost every tours-folder image (35/44). Split
the heuristic:

```text
SIGNAL A — wrong-POI image (hard):
  default_image_url folder token has no overlap with poi_key/name_en
  AND the source (tour stop / KB) for this poi_key does not reference that file.
  e.g. woljeonggyo -> /tours/ahopsan-bamboo/..., jeonnong_ro -> /tours/ilchulland/...
  -> strict fail

SIGNAL B — AI / unverified image (soft):
  filename matches chatgpt-image-*.webp (or other AI/unverified markers)
  -> warning only; feeds the photo-quality backlog, NOT the strict gate
```

Both are warnings by default. Only Signal A (plus missing image, missing
description/highlights) escalates to a non-zero `--strict` exit.

### Empty Object Rule

Treat `{}`, `[]`, `""`, `null` as missing for `visit_basics`, `convenience`,
`smart_notes`, `poi_meta.builder`, `matching_profile`. Audit checks "has
meaningful keys," not only "is non-null."

## Implementation Plan

### Phase 0: Provenance Gate (NEW — mandatory before any write)

Goal: know, per visible POI, where `default_image_url` (and the structured
fields) actually came from, and which pipeline feeds production.

Steps:

```text
1. Inspect provenance signals on the 8 target rows + a sample:
     select poi_key, kb_version, builder_profile_source, default_image_url
     from match_pois where poi_key in (...);
2. Dry-run both writers and diff against prod:
     node scripts/seed-match-pois-from-tour-jsons.mjs   (writes snapshot only; diff it)
     node scripts/import-match-v18.mjs --dry-run
   Determine which pipeline's output matches prod for the image column.
3. Classify each target: sourced-from-tour-JSON | sourced-from-KB | orphan.
4. Confirm the woljeonggyo orphan: not in tour JSON, not in KB (already verified).
```

Exit criterion (go/no-go): a per-POI provenance map exists, and the authoritative
pipeline for production is named. Do not start Phase 3/4 until this is known —
otherwise those edits may target a pipeline that does not feed prod.

### Phase 1: Add POI Audit Script

**STATUS: DONE 2026-05-21** (commit `00b2c17b`). Built as **`.ts`** (not `.mjs`)
so it imports the real `isBuilderAttraction` taxonomy + the override map; run via
tsx. Added:

```json
"itinerary:poi-audit": "node --env-file=.env.local --import tsx scripts/audit-itinerary-builder-pois.ts"
```

First run (post-Track-A, busan+jeju) — confirms Track A landed and sets the
Track B baseline:

```text
match_pois total ........ 91      visible builder POIs ... 44   (matches measured scope)
missing image ........... 6       = the exact Track B targets (biff_square,
                                    hallasan_eorimok_trail, hallim_park,
                                    jeju_tangerine, jeonnong_ro, noksan_ro)
Signal A orphan wrong ... 0       Track A fixed the woljeonggyo->ahopsan orphan
Signal B AI/unverified .. 17      chatgpt-image-* backlog (warning, never strict)
source-JSON image wrong . 3       jeonnong_ro + noksan_ro (ilchulland) + NEW un_memorial_cemetery
empty vb/conv/sn (1 POI)  3       jeju_tangerine_picking_experience (null after A3)
--strict ................ FAIL on 9 (6 photos + 3 jeju_tangerine fields) — expected until Track B
```

Determinism fix: the script sets `process.exitCode` + closes the fetch
dispatcher instead of calling `process.exit()`, which raced libuv socket teardown
on Windows and produced a spurious exit 127 (a flaky `--strict` is useless as a
CI gate).

**Two findings the earlier defect surface missed (logged in Known Issues):**

1. `un_memorial_cemetery` — its tour-JSON stop borrows haedong-yonggungsa +
   taejongdae gallery images (cross-POI). Its DB representative image is its own
   (AI) folder, so NOT a strict fail and the seed Signal-A already rejects the
   borrowed ones from `default_image_url`. Source/gallery hygiene, not a
   builder-image bug.
2. `_metadata` + `_kb_metadata` — two NON-POI rows sit in `match_pois` (KB
   top-level metadata keys seeded as POIs). Not visible (no region/name), so the
   builder UI is unaffected, but they are catalog junk → candidate DELETE.

**Provenance correction (verified 2026-05-21, supersedes the write-paths note):**
the KB (`poi_knowledge_base_v1.29.json`) carries **NO** image field on any of its
82 entries (only `visitBasics`/`convenience`/`smartNotes`). `import-match-v18.mjs:345`
reads `kbEntry.default_image_url` (always undefined -> writes `null`). So
import-match-v18 is **not** a real KB->image source — it is a no-op, and worse a
potential null-wiper, for `default_image_url`. The KB contributes only
key-presence + structured facts to the audit; the only image sources are
tour-JSON stops + the override map + out-of-band writes. (Phase 6 must neutralise
import-match-v18's null image write before any re-run.)

Inputs: local static tour JSONs, **the KB JSON**, `public.match_pois`, builder
region cluster, builder taxonomy (`isBuilderAttraction`).

Checks (visible = imported predicate):

```text
missing default_image_url
missing images AND default_image_url
Signal A wrong-POI image (source cross-checked against BOTH tour JSON and KB)
Signal B AI/unverified image (chatgpt-image-*) — warning lane
missing description / highlights / why_on_route
empty {} visit_basics / convenience / smart_notes
lat/lng missing, name_en missing
source key in detail JSON or KB but not in DB
DB builder key with no detail/KB source (orphan flag)
```

Output: summary counts, critical/high/medium buckets, `--json`. Flags: `--json`,
`--strict`, `--region=<slug>`.

Strict mode fails non-zero ONLY for: missing image on visible POI; Signal A
wrong-POI image; missing description/highlights on visible POI; empty
visit_basics/convenience/smart_notes on visible POI. Signal B never fails strict.

Note: `--strict` cannot be a green CI gate until Track B photos land (6 POIs will
legitimately have no image). Wire it into CI only after Track B completes.

### Track A — Immediate, code-only (parallel with Track B)

Small N (8 images + 1 row) ⇒ prefer **targeted, reviewable writes** over a full
re-seed dance. Given Phase 0 may show prod was KB-seeded, a blanket re-seed of the
tour-JSON pipeline is the wrong tool.

**Status 2026-05-21:** A1–A5 DONE (verified). A1–A3 applied to DB + verified
(rollback snapshot captured first). A4 reframed (no tour-JSON edit; the seed's
Signal-A heuristic nulls jeonnong/noksan instead). A5: `poi-image-overrides.mjs`
(`.mjs` so plain-node seed/enrich can import it) + seed/enrich rewritten
(override-wins image selection, Signal-A wrong-POI reject, `{}`→null, omit-null
payload so good DB data is never wiped). Verified via seed `--dry-run`: 5 POIs
pinned by override (woljeonggyo, tongdosa, gukje_market, bomun_lake, songaksan),
jeonnong/noksan null, legit ilchulland/ahopsan/busan-tower images preserved (no
Signal-A false positives). Remaining null visible POIs all need Track B photos.
NEXT: Phase 1 audit script.

```text
A1. woljeonggyo_bridge -> /images/itinerary/woljeonggyo-front-day.webp
      (+ reflection, pavilion-night as images[]). Via override map OR direct
      UPDATE OR KB entry. NOT via tour-JSON edit (nothing to edit there).
A2. tongdosa_temple -> /images/itinerary/tongdosa-iljumun.webp (+ yeongsanjeon).
A3. jeju_tangerine_picking_experience -> normalize {} visit_basics/convenience/
      smart_notes to null (only POI affected).
A4. jeonnong_ro / noksan_ro -> match_pois image set to null (DONE 2026-05-21).
      Re-seed prevention handled by A5 (seed Signal-A heuristic), NOT a tour-JSON
      edit — the tour is wholesale ilchulland-illustrated (see Phase 3 note).
A5. seed/enrich minimal change: image precedence (override -> images[0] -> image
      -> KB -> null) + {}->null normalization. Keep deterministic.
```

### Track B — Photo sourcing (the real critical path)

```text
Need real, policy-compliant photos (16:9, OTA-bright, no AI feel, q95):
  biff_square, hallasan_eorimok_trail, hallim_park,
  jeju_tangerine_picking_experience, jeonnong_ro_cherry_blossom_street,
  noksan_ro_gasiri_blossom_road
```

Injection mechanism (since `wire-poi-images.mjs` is absent — verify before
assuming it returned): put each photo into the **authoritative** source named in
Phase 0 (tour-JSON stop or KB entry) then re-run that pipeline, OR add to the
override map. Do not block on rebuilding a one-shot wiring script; the override
map + the chosen pipeline already cover injection.

### Phase 2: Curated Image Override Map (reframed)

Create `lib/itinerary-builder/poi-image-overrides.mjs` (`.mjs`, not `.ts` — the
seed/enrich scripts are plain-node `.mjs` and cannot import a `.ts` module; `.mjs`
is importable by node, by tsx, and by Next/TS if ever needed):

```ts
export const BUILDER_POI_IMAGE_OVERRIDES: Record<string, {
  defaultImageUrl: string;
  images?: string[];
  note?: string;
}> = {
  woljeonggyo_bridge: {
    defaultImageUrl: "/images/itinerary/woljeonggyo-front-day.webp",
    images: [
      "/images/itinerary/woljeonggyo-reflection.webp",
      "/images/itinerary/woljeonggyo-pavilion-night.webp",
    ],
    note: "Orphan in DB (ahopsan); not in tour JSON or KB. Wire local asset.",
  },
  tongdosa_temple: {
    defaultImageUrl: "/images/itinerary/tongdosa-iljumun.webp",
    images: ["/images/itinerary/tongdosa-yeongsanjeon.webp"],
    note: "Local asset exists but is in no source stop.",
  },
};
```

Role (corrected): the override map is the **standing injection point for images
that exist locally but are referenced by no source stop/KB entry** — not a
"temporary backstop." Cases fixable at source (jeonnong_ro/noksan_ro tour JSON) go
to source, not here. Keep it small, reviewed, importable by UI/audit/scripts.

### Phase 3: Fix Source Static JSON (jeonnong_ro / noksan_ro ONLY)

```text
components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json
  jeonnong_ro_cherry_blossom_street : clear ilchulland stop.image (leave empty pending photo)
  noksan_ro_gasiri_blossom_road     : clear ilchulland stop.image (leave empty pending photo)
```

woljeonggyo is intentionally absent here (orphan — handled in Track A/override).
Do not invent external images. External sourcing is Track B.

**REVISED 2026-05-21 (verified by grep):** `ilchulland` is NOT 2 stray stop images —
it is this tour's ENTIRE image set: tour-level `ogImage`/`heroImage`/`thumbnail`/
`imageUrl`, 11 gallery `src`s, the 2 cherry stops (jeonnong/noksan), AND the 2
*legitimate* Ilchulland stops (`ilchulland_micheon_cave`, `ilchulland_themed_gardens`)
whose ilchulland images are CORRECT. Therefore (a) a blanket replace would destroy the
legit Ilchulland stop images; (b) surgically blanking only the 2 cherry `stop.image`s
leaves broken/empty images on an otherwise all-ilchulland tour detail page — marginal
benefit, possible tour-page degradation. **Decision: do NOT edit the tour JSON for
re-seed prevention; rely on the A5 seed Signal-A heuristic** (rejects
ilchulland-for-jeonnong/noksan at seed time). The wholesale AI-illustrated tour imagery
is a separate tour-detail / AI-policy issue requiring real cherry photos = Track B.

### Phase 4: Update Seed Logic

`scripts/seed-match-pois-from-tour-jsons.mjs` — change representative image
selection to the precedence in the Image Selection Rule; add helpers
`firstValidImage(stop, poiKey, name)` and `isProbablyWrongPoiImage(poiKey, name,
url)` (Signal A logic). Keep deterministic. Remember the snapshot it writes is a
tracked file — see Phase 6 note.

### Phase 5: Update Enrichment Logic

`scripts/enrich-match-pois-from-tour-jsons.mjs` — filter Signal-A `stop.image`;
keep `stop.images`; prepend override images; de-dupe; normalize `{}`→null and
`[]`→null. Do not wipe good DB data unless the replacement is non-empty or an
override exists.

### Phase 6: Backfill (and the import-match-v18 question)

Run the **authoritative** pipeline identified in Phase 0 — which may be
`import-match-v18.mjs`, not the seed script. For this small N, a reviewed, direct
SQL UPDATE of the 8 rows (plus the Phase 3 JSON fix to stop regression) is the
simpler and safer option and avoids a broad re-seed.

If re-seeding:

```bash
node --env-file=.env.local scripts/seed-match-pois-from-tour-jsons.mjs
node --env-file=.env.local scripts/enrich-match-pois-from-tour-jsons.mjs
npm run itinerary:profiles:migration:check
npm run itinerary:poi-audit -- --strict   # only after Track B photos exist
```

Snapshot handling: `seed-match-pois-snapshot.json` is git-tracked and is a
write-only output. A re-seed WILL produce a diff in it. Decide once: either
`.gitignore` it (it is generated) or treat the diff as a reviewed artifact each
run. Do not silently commit a churned snapshot.

Suggested migration name (data-only): `20260521_fix_itinerary_builder_poi_images_and_empty_fields.sql`.
Include before/after issue counts.

### Phase 7: UI Fallback — VERIFY ONLY (downgraded)

Verified 2026-05-21: all four components already handle missing/null images
safely — no edits required.

```text
POICatalogGrid.tsx        default_image_url || images?.[0] || ImageIcon placeholder  OK
POIDetailModal.tsx        images || [default_image_url] || header-only layout         OK (already does "default as gallery item")
POIInfoWindowContent.tsx  renders <img> only if default_image_url                     OK
AIRecommendPanel.tsx      default_image_url || images?.[0] || ImageIcon placeholder   OK
```

Action: confirm no regression after data changes. Do not refactor working UI.

### Phase 8: Visual QA

Run `/itinerary-builder/jeju` and `/itinerary-builder/busan`. Inspect catalog
cards, map info windows, AI recommendation pills, result timeline, detail-modal
gallery, quote-modal stop summary. Viewports 390 / 768 / 1440. Verify the eight
target POIs.

## File-Level Worklist

### New Files

```text
scripts/audit-itinerary-builder-pois.mjs
lib/itinerary-builder/poi-image-overrides.mjs
```

### Modified Files

```text
package.json
scripts/seed-match-pois-from-tour-jsons.mjs
scripts/enrich-match-pois-from-tour-jsons.mjs
components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json
(.gitignore OR a snapshot-handling decision for scripts/seed-match-pois-snapshot.json)
```

NOT modified for the null-image case (already safe): the four
`components/itinerary-builder/*` UI files. Possibly touched in Track B / Phase 0:
`data/poi_kb/poi_knowledge_base_v1.29.json` and `scripts/import-match-v18.mjs` if
the KB is the authoritative pipeline.

The two `busan-gyeongju-*` tour JSONs are NOT edited (woljeonggyo has no image
field to fix there).

## Audit Severity Model

```text
Critical: wrong representative image (Signal A) | missing name_en | missing lat/lng
          | cross-POI text pollution | orphan image with no source
High:     missing default_image_url | missing description | missing highlights
          | empty visit_basics/convenience/smart_notes | source JSON image known wrong
Medium:   missing gallery images | generic category | missing default_stay_minutes
          | why_on_route too tour-specific | locale names missing
          | Signal B AI/unverified image
Low:      non-visible POI missing image/locale/metadata
```

## Testing

```bash
npm run itinerary:poi-audit
npm run itinerary:poi-audit -- --strict     # green only after Track B
npm run itinerary:pressure
npm run match:regression
npm run build
```

Run a full build after script/UI changes (Next can catch server/client boundary
issues around imported constants).

## Rollback Strategy

1. Before any DB write, export the affected rows:
   `select * from public.match_pois where poi_key in (...)`.
2. If backfill regresses: revert the migration / restore exported rows.
3. Keep the audit script and source-JSON patches.
4. Re-run seed/enrich in dry-run; diff the generated payload before re-applying.

## Definition Of Done

- `npm run itinerary:poi-audit -- --strict` passes for visible builder POIs
  (achievable only after Track B photos land for the six photo-less POIs).
- All 44 visible builder POIs have valid representative images.
- Known wrong/orphan image mappings are gone:
  - Jeonnong-ro / Noksan-ro no longer use the Ilchulland image.
  - Woljeonggyo no longer uses the Ahopsan image (wired to its real asset).
- The one empty-structured-field POI (jeju_tangerine) no longer renders `{}` as
  content.
- **No documented `match_pois` write path** — `seed-match-pois-from-tour-jsons`,
  `import-match-v18` (KB), enrichment, or the override map — can reintroduce known
  pollution. (The absent `wire-poi-images.mjs` is an out-of-tree risk: if it
  returns, it must consume the override map / corrected sources.)
- The snapshot diff is handled deliberately (gitignored or reviewed).
- `/itinerary-builder/jeju` and `/itinerary-builder/busan` pass visually on mobile
  and desktop.
- Hidden / non-builder POIs untouched unless explicitly promoted.

## Recommended Order

1. Phase 0 provenance gate (name the authoritative pipeline; classify the 8).
2. Build the audit script (isBuilderAttraction predicate; Signal A/B split).
3. Track A immediate fixes (woljeonggyo + tongdosa wiring, jeju_tangerine {}
   cleanup, jeonnong/noksan JSON cleanup, minimal seed/enrich change) — via direct
   UPDATE for small N.
4. Track B photo sourcing for the six photo-less POIs (parallel; the real
   bottleneck).
5. Add/curate the override map for assets-not-in-source.
6. Backfill via the authoritative pipeline (or reviewed SQL); handle snapshot diff.
7. Verify UI fallbacks (no edits expected).
8. Visual QA the eight target POIs; flip `--strict` into CI only once green.
