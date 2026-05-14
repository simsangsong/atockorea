"""
Re-import visitBasics, smartNotes, convenience fields from JSON files
into Supabase tour_product_pages.detail_payload.itineraryStops.

For each (slug, locale) pair where supabase rows are missing these fields,
read the JSON file in components/product-tour-static/<slug>/<slug>.<locale>.json,
extract visitBasics/smartNotes/convenience for each stop (preferring top-level
itineraryStops, falling back to page_sections[*].props.itineraryStops, and
finally itinerary_variants[*].stops), build a name -> fields map, and merge
the missing fields into the supabase stops by name.

Idempotent: existing visitBasics/smartNotes/convenience on a stop are not overwritten.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv  # type: ignore

# --- env ---
ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

LOCALES = ["ko", "en", "ja", "zh", "zh-TW", "es"]
TARGET_KEYS = ("visitBasics", "smartNotes", "convenience")
STATIC_DIR = ROOT / "components" / "product-tour-static"


def collect_stop_fields_from_json(payload: dict) -> dict[str, dict]:
    """
    Walk payload and build {stop_name: {visitBasics, smartNotes, convenience}}.
    First match wins (top-level itineraryStops takes priority).
    """
    result: dict[str, dict] = {}

    def add_stops(stops: list, source_label: str) -> None:
        if not isinstance(stops, list):
            return
        for stop in stops:
            if not isinstance(stop, dict):
                continue
            name = stop.get("name")
            if not name or name in result:
                continue
            partial: dict = {}
            for k in TARGET_KEYS:
                v = stop.get(k)
                if isinstance(v, dict) and v:
                    partial[k] = v
            if partial:
                result[name] = partial

    # Highest priority: top-level itineraryStops
    add_stops(payload.get("itineraryStops") or [], "top")

    # page_sections[*].props.itineraryStops
    sections = payload.get("page_sections")
    if isinstance(sections, list):
        for sec in sections:
            if isinstance(sec, dict):
                props = sec.get("props") or {}
                add_stops(props.get("itineraryStops") or [], "page_section")

    # itinerary_variants[*].stops
    variants = payload.get("itinerary_variants")
    if isinstance(variants, list):
        for v in variants:
            if isinstance(v, dict):
                add_stops(v.get("stops") or [], "variant")

    return result


def fetch_row(slug: str, locale: str) -> dict | None:
    url = f"{SUPABASE_URL}/rest/v1/tour_product_pages"
    params = {
        "select": "id,slug,locale,detail_payload",
        "slug": f"eq.{slug}",
        "locale": f"eq.{locale}",
    }
    r = requests.get(url, headers=HEADERS, params=params, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def update_row(row_id: str, detail_payload: dict) -> None:
    url = f"{SUPABASE_URL}/rest/v1/tour_product_pages"
    params = {"id": f"eq.{row_id}"}
    r = requests.patch(
        url, headers=HEADERS, params=params, json={"detail_payload": detail_payload}, timeout=30
    )
    r.raise_for_status()


def merge_one(slug: str, locale: str) -> tuple[int, int, int]:
    """
    Returns (matched_stops, applied_fields, skipped_already_present).
    """
    json_path = STATIC_DIR / slug / f"{slug}.{locale}.json"
    if not json_path.exists():
        print(f"  [{slug} / {locale}] JSON file missing: {json_path}", file=sys.stderr)
        return (0, 0, 0)

    with json_path.open(encoding="utf-8") as f:
        try:
            payload = json.load(f)
        except json.JSONDecodeError as e:
            print(f"  [{slug} / {locale}] JSON parse error: {e}", file=sys.stderr)
            return (0, 0, 0)

    fields_by_name = collect_stop_fields_from_json(payload)
    if not fields_by_name:
        print(f"  [{slug} / {locale}] No visitBasics/smartNotes/convenience found in JSON")
        return (0, 0, 0)

    row = fetch_row(slug, locale)
    if row is None:
        print(f"  [{slug} / {locale}] Row not found in Supabase", file=sys.stderr)
        return (0, 0, 0)

    detail = row["detail_payload"] or {}
    stops = detail.get("itineraryStops")
    if not isinstance(stops, list):
        print(f"  [{slug} / {locale}] No itineraryStops array in detail_payload", file=sys.stderr)
        return (0, 0, 0)

    matched = 0
    applied = 0
    skipped = 0
    changed = False
    for stop in stops:
        if not isinstance(stop, dict):
            continue
        name = stop.get("name")
        if not name:
            continue
        bundle = fields_by_name.get(name)
        if not bundle:
            continue
        matched += 1
        for k, v in bundle.items():
            if k in stop and stop[k]:
                skipped += 1
                continue
            stop[k] = v
            applied += 1
            changed = True

    if changed:
        detail["itineraryStops"] = stops
        update_row(row["id"], detail)
        print(
            f"  [{slug} / {locale}] matched_stops={matched} applied={applied} "
            f"skipped_already_present={skipped} -> updated"
        )
    else:
        print(
            f"  [{slug} / {locale}] matched_stops={matched} applied={applied} "
            f"skipped_already_present={skipped} -> no change"
        )

    return (matched, applied, skipped)


def main() -> None:
    # Tours where ALL or some locales are missing visitBasics in supabase.
    # Determined by the diagnostic SELECT prior to running this script.
    target_slugs = [
        "busan-private-car-charter-cruise-shore",
        "busan-small-group-sightseeing-tour-cruise-passengers",
        "east-signature-nature-core",
        "from-busan-gyeongju-ancient-capital-day-tour",
        "jeju-cherry-blossom-tour-east-route",
        "jeju-cruise-shore-excursion-bus-tour",
        "jeju-cruise-shore-excursion-small-group-tour",
        "jeju-eastern-unesco-spots-day-tour",
        "jeju-grand-highlights-loop",
        "jeju-hydrangea-festival-tour-east-route",
        "jeju-hydrangea-festival-tour-southwest-route",
        "jeju-southern-top-unesco-spots-tour",
        "jeju-west-south-full-day-authentic-tour",
        "jeju-winter-southwest-tangerine-snow-camellia-tour",
        "southwest-hallasan-osulloc-aewol",
    ]

    total_matched = total_applied = total_skipped = 0
    for slug in target_slugs:
        print(f"== {slug} ==")
        for loc in LOCALES:
            m, a, s = merge_one(slug, loc)
            total_matched += m
            total_applied += a
            total_skipped += s

    print()
    print(
        f"TOTAL: matched_stops={total_matched} "
        f"applied_fields={total_applied} "
        f"skipped_already_present={total_skipped}"
    )


if __name__ == "__main__":
    main()
