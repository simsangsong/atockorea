#!/usr/bin/env python3
"""
Build seoul-seoraksan-nami-island-morning-calm-day-tour locale files
by reusing existing translations from the two source tours:
  - seoul-seoraksan-national-park-sokcho-beach-day-trip (Seoraksan)
  - seoul-private-nami-morning-calm-petite-france      (Nami, Morning Calm)

Strategy:
  - Start from a deep copy of EN
  - For each locale L (ko, ja, zh, zh-TW, es):
      * Load source locale files
      * Find the matching itineraryStops entry by `name` containing the attraction key
      * Replace TRANSLATABLE fields (description, whyOnRoute, highlights,
        smartNotes, visitBasics, convenience, _poi_meta.sources, category) into the
        target stop. PRESERVE pacing fields (time, number, duration, timeUsed)
        from EN so the new tour's bus-tour schedule stays intact.
      * Set locale = L
      * Save
"""
import json
import copy
from pathlib import Path

ROOT = Path(r"C:\Users\sangsong\atockorea\components\product-tour-static")
NEW_DIR = ROOT / "seoul-seoraksan-nami-island-morning-calm-day-tour"
EN_FILE = NEW_DIR / "seoul-seoraksan-nami-island-morning-calm-day-tour.en.json"

# (locale, suffix) pairs
LOCALES = [
    ("ko", "ko"),
    ("ja", "ja"),
    ("zh", "zh"),
    ("zh-TW", "zh-TW"),
    ("es", "es"),
]

SEORAK_SRC_DIR = ROOT / "seoul-seoraksan-national-park-sokcho-beach-day-trip"
NAMI_SRC_DIR = ROOT / "seoul-private-nami-morning-calm-petite-france"

# Fields to copy from source attraction blocks into target.
# These are the "translatable" / content fields. We keep pacing fields
# (number, time, duration, timeUsed, name) from EN target.
TRANSLATABLE_FIELDS = [
    "category",
    "description",
    "highlights",
    "smartNotes",
    "whyOnRoute",
    "convenience",
    "visitBasics",
    "_poi_meta",
]

def find_stop_by_keyword(stops, keyword):
    """Find first itineraryStops entry whose name contains keyword (case-insensitive)."""
    keyword_low = keyword.lower()
    for stop in stops:
        name = stop.get("name", "")
        if keyword_low in name.lower():
            return stop
    return None


def find_stop_by_poi_key(stops, poi_key):
    """Find first itineraryStops entry by _poi_meta.poi_key — locale-invariant match."""
    for stop in stops:
        meta = stop.get("_poi_meta") or {}
        if meta.get("poi_key") == poi_key:
            return stop
    return None


def merge_translated_stop(target_stop, source_stop):
    """Copy translatable fields from source_stop into target_stop in place."""
    for field in TRANSLATABLE_FIELDS:
        if field in source_stop:
            target_stop[field] = copy.deepcopy(source_stop[field])


def main():
    en = json.loads(EN_FILE.read_text(encoding="utf-8"))

    for locale, suffix in LOCALES:
        target = copy.deepcopy(en)
        target["locale"] = locale

        # Load source locale files (fallback to EN if locale file missing)
        seorak_src_path = SEORAK_SRC_DIR / f"seoul-seoraksan-national-park-sokcho-beach-day-trip.{suffix}.json"
        nami_src_path = NAMI_SRC_DIR / f"seoul-private-nami-morning-calm-petite-france.{suffix}.json"

        if not seorak_src_path.exists():
            print(f"  WARN: no source {seorak_src_path.name}, skipping Seoraksan translation for {locale}")
            seorak_src = None
        else:
            seorak_src = json.loads(seorak_src_path.read_text(encoding="utf-8"))

        if not nami_src_path.exists():
            print(f"  WARN: no source {nami_src_path.name}, skipping Nami/Morning Calm translation for {locale}")
            nami_src = None
        else:
            nami_src = json.loads(nami_src_path.read_text(encoding="utf-8"))

        # Match by poi_key (locale-invariant) rather than name (varies per locale)
        # Replace Seoraksan stop
        if seorak_src:
            seorak_stops = seorak_src.get("itineraryStops", [])
            src_stop = find_stop_by_poi_key(seorak_stops, "seoraksan_national_park")
            if src_stop:
                for s in target["itineraryStops"]:
                    s_meta = s.get("_poi_meta") or {}
                    if s_meta.get("poi_key") == "seoraksan_national_park":
                        # Preserve EN's translated 'name' if source has same poi_key
                        # but copy the localized name too so the page shows it in language
                        if "name" in src_stop:
                            s["name"] = src_stop["name"]
                        merge_translated_stop(s, src_stop)
                        print(f"  [{locale}] Seoraksan stop merged")
                        break

        # Replace Nami + Morning Calm stops
        if nami_src:
            nami_stops = nami_src.get("itineraryStops", [])
            # Nami
            src_nami = find_stop_by_poi_key(nami_stops, "nami_island")
            if src_nami:
                for s in target["itineraryStops"]:
                    s_meta = s.get("_poi_meta") or {}
                    if s_meta.get("poi_key") == "nami_island":
                        if "name" in src_nami:
                            s["name"] = src_nami["name"]
                        merge_translated_stop(s, src_nami)
                        print(f"  [{locale}] Nami stop merged")
                        break
            # Morning Calm
            src_mc = find_stop_by_poi_key(nami_stops, "garden_of_morning_calm")
            if src_mc:
                for s in target["itineraryStops"]:
                    s_meta = s.get("_poi_meta") or {}
                    if s_meta.get("poi_key") == "garden_of_morning_calm":
                        if "name" in src_mc:
                            s["name"] = src_mc["name"]
                        merge_translated_stop(s, src_mc)
                        print(f"  [{locale}] Morning Calm stop merged")
                        break

        # Save
        out_path = NEW_DIR / f"seoul-seoraksan-nami-island-morning-calm-day-tour.{suffix}.json"
        out_path.write_text(json.dumps(target, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{locale}] wrote {out_path.name}")


if __name__ == "__main__":
    main()
