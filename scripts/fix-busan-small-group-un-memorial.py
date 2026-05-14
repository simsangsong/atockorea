#!/usr/bin/env python3
"""
Fix the Taejongdae-content-mixed-into-UN-Memorial-Cemetery bug in
busan-small-group-sightseeing-tour-cruise-passengers.{en,ko,ja,zh,zh-TW,es}.json.

Source of truth for the clean UN Memorial Cemetery content:
  busan-top-attractions-day-tour (poi_key: un_memorial_cemetery)

Strategy
--------
For each locale, in the target stop where:
  - name contains "UN Memorial" / matching localized form, OR
  - _poi_meta.poi_key == "taejongdae"  (the contamination marker)

Replace the POLLUTED fields with the corresponding fields from the SOURCE
stop (poi_key=un_memorial_cemetery in busan-top-attractions-day-tour):
  - highlights, timeUsed, whyOnRoute, _poi_meta, smartNotes,
    visitBasics, convenience, image, images, imageCredits, galleryItems

PRESERVE from the existing target stop:
  - number, time, duration, name, description, category
  (these are either correct or are pacing slots that must stay aligned with
   the rest of the small-group itinerary)

Also fix the TOP-LEVEL galleryItems where location=="UN Memorial Cemetery in
Korea" but src points to /images/tours/taejongdae/... — replace src with the
correct UN cemetery image paths drawn from the source.
"""
import json
import copy
from pathlib import Path

ROOT = Path(r"C:\Users\sangsong\atockorea\components\product-tour-static")
TARGET_DIR = ROOT / "busan-small-group-sightseeing-tour-cruise-passengers"
SOURCE_DIR = ROOT / "busan-top-attractions-day-tour"

LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"]

# Fields to lift from the source (clean) UN Memorial stop into the target.
REPLACE_FIELDS = [
    "highlights",
    "timeUsed",
    "whyOnRoute",
    "_poi_meta",
    "smartNotes",
    "visitBasics",
    "convenience",
    "image",
    "images",
    "imageCredits",
    "galleryItems",
]


def find_un_stop_in_target(stops):
    """Find the target stop that should be UN Memorial but has taejongdae poi_key."""
    for stop in stops:
        meta = stop.get("_poi_meta") or {}
        if meta.get("poi_key") == "taejongdae":
            return stop
        # Fallback: name match
        name = (stop.get("name") or "").lower()
        if "un memorial" in name or "유엔" in name or "联合国" in name or "聯合國" in name or "国連" in name or "naciones unidas" in name:
            return stop
    return None


def find_un_stop_in_source(stops):
    for stop in stops:
        meta = stop.get("_poi_meta") or {}
        if meta.get("poi_key") == "un_memorial_cemetery":
            return stop
    return None


def fix_top_level_gallery(doc, correct_image_paths):
    """Replace polluted /images/tours/taejongdae/... srcs on items labelled 'UN Memorial'."""
    items = doc.get("galleryItems") or []
    fixed = 0
    next_idx = 0
    for item in items:
        loc = (item.get("location") or "").lower()
        is_un = ("un memorial" in loc or "유엔" in loc or "联合国" in loc or "聯合國" in loc or "国連" in loc or "naciones unidas" in loc)
        src = item.get("src") or ""
        if is_un and "/images/tours/taejongdae/" in src:
            replacement = correct_image_paths[next_idx % len(correct_image_paths)]
            item["src"] = replacement
            next_idx += 1
            fixed += 1
    return fixed


def main():
    for locale in LOCALES:
        tgt_path = TARGET_DIR / f"busan-small-group-sightseeing-tour-cruise-passengers.{locale}.json"
        src_path = SOURCE_DIR / f"busan-top-attractions-day-tour.{locale}.json"

        if not tgt_path.exists():
            print(f"[{locale}] target missing, skipping")
            continue
        if not src_path.exists():
            print(f"[{locale}] source missing, skipping")
            continue

        target = json.loads(tgt_path.read_text(encoding="utf-8"))
        source = json.loads(src_path.read_text(encoding="utf-8"))

        tgt_stops = target.get("itineraryStops") or []
        src_stops = source.get("itineraryStops") or []

        tgt_stop = find_un_stop_in_target(tgt_stops)
        src_stop = find_un_stop_in_source(src_stops)

        if not tgt_stop or not src_stop:
            print(f"[{locale}] couldn't find target or source UN stop; skipping")
            continue

        # Replace polluted fields
        replaced = []
        for field in REPLACE_FIELDS:
            if field in src_stop:
                tgt_stop[field] = copy.deepcopy(src_stop[field])
                replaced.append(field)

        # The category is "History / Memorial" — keep target's; description is fine in target.

        # Fix top-level galleryItems (only if any are polluted)
        # Collect clean UN Memorial image paths from the source stop
        correct_paths = src_stop.get("images") or []
        if not correct_paths and src_stop.get("image"):
            correct_paths = [src_stop["image"]]
        gallery_fixed = 0
        if correct_paths:
            gallery_fixed = fix_top_level_gallery(target, correct_paths)

        tgt_path.write_text(json.dumps(target, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[{locale}] fixed stop fields={len(replaced)}; top-level gallery items fixed={gallery_fixed}")


if __name__ == "__main__":
    main()
