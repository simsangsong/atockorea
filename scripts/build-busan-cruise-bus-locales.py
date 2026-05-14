#!/usr/bin/env python3
"""
Rebuild busan-cruise-shore-excursion-bus-tour locale files (ko/ja/zh/zh-TW/es)
by reusing existing translations from other Busan tours that already have
the same attractions translated.

Source maps (by poi_key):
  haedong_yonggungsa            -> busan-top-attractions-day-tour
  un_memorial_cemetery          -> busan-top-attractions-day-tour
  jagalchi_market               -> busan-top-attractions-day-tour
  gamcheon_culture_village      -> busan-top-attractions-day-tour
  yongdusan_park                -> busan-private-car-charter-cruise-shore
  biff_square                   -> (no source — leave EN as-is)
  gukje_market                  -> (no source — leave EN as-is)
  songdo_beach                  -> (no source — leave EN as-is)

The Cruise Terminal pickup, Lunch stop, and Return stops have no source
(cruise-bus specific). They stay in EN.
"""
import json
import copy
from pathlib import Path

ROOT = Path(r"C:\Users\sangsong\atockorea\components\product-tour-static")
NEW_DIR = ROOT / "busan-cruise-shore-excursion-bus-tour"
EN_FILE = NEW_DIR / "busan-cruise-shore-excursion-bus-tour.en.json"

LOCALES = [
    ("ko", "ko"),
    ("ja", "ja"),
    ("zh", "zh"),
    ("zh-TW", "zh-TW"),
    ("es", "es"),
]

# (poi_key, source-tour-folder)
ATTRACTION_SOURCES = [
    ("haedong_yonggungsa",       "busan-top-attractions-day-tour"),
    ("un_memorial_cemetery",     "busan-top-attractions-day-tour"),
    ("jagalchi_market",          "busan-top-attractions-day-tour"),
    ("gamcheon_culture_village", "busan-top-attractions-day-tour"),
    ("yongdusan_park",           "busan-private-car-charter-cruise-shore"),
]

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


def find_stop_by_poi_key(stops, poi_key):
    for stop in stops:
        meta = stop.get("_poi_meta") or {}
        if meta.get("poi_key") == poi_key:
            return stop
    return None


def merge_translated_stop(target_stop, source_stop):
    for field in TRANSLATABLE_FIELDS:
        if field in source_stop:
            target_stop[field] = copy.deepcopy(source_stop[field])


def main():
    en = json.loads(EN_FILE.read_text(encoding="utf-8"))

    # Cache for source files: {(folder, locale_suffix): parsed json}
    source_cache = {}

    def load_source(folder, suffix):
        key = (folder, suffix)
        if key not in source_cache:
            path = ROOT / folder / f"{folder}.{suffix}.json"
            if not path.exists():
                source_cache[key] = None
            else:
                source_cache[key] = json.loads(path.read_text(encoding="utf-8"))
        return source_cache[key]

    for locale, suffix in LOCALES:
        target = copy.deepcopy(en)
        target["locale"] = locale

        merged_count = 0
        for poi_key, source_folder in ATTRACTION_SOURCES:
            src_doc = load_source(source_folder, suffix)
            if not src_doc:
                continue
            src_stops = src_doc.get("itineraryStops", [])
            src_stop = find_stop_by_poi_key(src_stops, poi_key)
            if not src_stop:
                continue
            # Find target stop with same poi_key
            for s in target.get("itineraryStops", []):
                s_meta = s.get("_poi_meta") or {}
                if s_meta.get("poi_key") == poi_key:
                    if "name" in src_stop:
                        s["name"] = src_stop["name"]
                    merge_translated_stop(s, src_stop)
                    merged_count += 1
                    break

        out_path = NEW_DIR / f"busan-cruise-shore-excursion-bus-tour.{suffix}.json"
        out_path.write_text(json.dumps(target, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{locale}] merged {merged_count}/5 attractions; wrote {out_path.name}")


if __name__ == "__main__":
    main()
