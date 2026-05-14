#!/usr/bin/env python3
"""
Overlay Gamcheon Culture Village translated content from
busan-top-attractions-day-tour.<locale>.json into the corresponding stop in
busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.<locale>.json.

Match by _poi_meta.poi_key == "gamcheon_culture_village".
Preserve target's pacing fields (number/time/duration/timeUsed).
Replace translatable fields (category, description, highlights, smartNotes,
whyOnRoute, convenience, visitBasics, _poi_meta, image, images, imageCredits,
galleryItems, name).
"""
import json
import copy
from pathlib import Path

ROOT = Path(r"C:\Users\sangsong\atockorea\components\product-tour-static")
TARGET_DIR = ROOT / "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour"
SOURCE_DIR = ROOT / "busan-top-attractions-day-tour"

LOCALES = ["ko", "ja", "zh", "zh-TW", "es"]

REPLACE_FIELDS = [
    "name",
    "category",
    "description",
    "highlights",
    "smartNotes",
    "whyOnRoute",
    "convenience",
    "visitBasics",
    "_poi_meta",
    "image",
    "images",
    "imageCredits",
    "galleryItems",
]


def find_stop_by_poi_key(stops, poi_key):
    for stop in stops:
        meta = stop.get("_poi_meta") or {}
        if meta.get("poi_key") == poi_key:
            return stop
    return None


def main():
    for locale in LOCALES:
        tgt_path = TARGET_DIR / f"busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.{locale}.json"
        src_path = SOURCE_DIR / f"busan-top-attractions-day-tour.{locale}.json"
        if not tgt_path.exists() or not src_path.exists():
            print(f"[{locale}] missing file, skip")
            continue

        target = json.loads(tgt_path.read_text(encoding="utf-8"))
        source = json.loads(src_path.read_text(encoding="utf-8"))

        tgt_stop = find_stop_by_poi_key(target.get("itineraryStops") or [], "gamcheon_culture_village")
        src_stop = find_stop_by_poi_key(source.get("itineraryStops") or [], "gamcheon_culture_village")
        if not tgt_stop or not src_stop:
            print(f"[{locale}] Gamcheon stop not found, skip")
            continue

        for field in REPLACE_FIELDS:
            if field in src_stop:
                tgt_stop[field] = copy.deepcopy(src_stop[field])

        tgt_path.write_text(json.dumps(target, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{locale}] Gamcheon overlaid")


if __name__ == "__main__":
    main()
