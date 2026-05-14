#!/usr/bin/env python3
"""
Update Seongsan Ilchulbong / haenyeo performance content across all tour JSONs:

1) For every itineraryStop whose _poi_meta.poi_key is one of
   {seongsan_ilchulbong, seongsan_ilchulbong_peak, sunrise_peak} OR
   whose name contains Seongsan in any locale ("Seongsan", "성산", "城山"),
   add field `liveStatusWidget: "haenyeo"` so the detail-drawer renders
   the live-status button.

2) Update haenyeo performance time descriptions across all locales to
   reflect: ONE show per day at 14:00, may be canceled in bad weather.
   We do conservative string replacements on known phrasings.

Run from repo root: `python scripts/update-haenyeo-content.py`
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\sangsong\atockorea\components\product-tour-static")

# Stop identification — anything matching any of these signals counts as a
# Seongsan Ilchulbong stop (which is the only place haenyeo is performed in
# this catalog).
SEONGSAN_POI_KEYS = {
    "seongsan_ilchulbong",
    "seongsan_ilchulbong_peak",
    "sunrise_peak",
}
SEONGSAN_NAME_FRAGMENTS = (
    "seongsan",
    "성산",
    "城山",
    "ilchulbong",
    "일출봉",
    "sunrise peak",
)


def is_seongsan_stop(stop: dict) -> bool:
    meta = stop.get("_poi_meta") or {}
    pk = (meta.get("poi_key") or "").lower()
    if pk in SEONGSAN_POI_KEYS:
        return True
    name = (stop.get("name") or "").lower()
    return any(frag in name for frag in SEONGSAN_NAME_FRAGMENTS)


# Time-phrase rewrites. Order matters — apply more-specific first.
# Each entry is (compiled_regex, replacement_template_per_locale).
LOCALE_REWRITES: dict[str, list[tuple[re.Pattern, str]]] = {
    "en": [
        # "haenyeo viewing at base (15:00 demo)" / "(14:00 show)" etc → "(14:00 show; may be canceled in bad weather)"
        (
            re.compile(r"(haenyeo[\w\s]*?\(\s*)\d{1,2}:\d{2}(\s*(?:demo|show|performance)\s*\))", re.IGNORECASE),
            r"\g<1>14:00\g<2>",
        ),
        # "afternoon" / "morning" haenyeo demo / show → "14:00 (1/day)"
        (
            re.compile(r"haenyeo demonstrations?\s+are\s+(?:often\s+)?scheduled\s+in\s+the\s+afternoon", re.IGNORECASE),
            "haenyeo demonstrations run once daily at 14:00 (1 show/day) and may be canceled in bad weather",
        ),
        (
            re.compile(r"haenyeo show(?:s)?\s+(?:typically\s+)?(?:held|run|scheduled)\s+(?:in the )?(?:morning|afternoon)", re.IGNORECASE),
            "haenyeo show runs once daily at 14:00 and may be canceled in bad weather",
        ),
        # Plain "2 daily shows" / "twice daily" phrasing for haenyeo within a 60-char window
        (
            re.compile(
                r"(haenyeo[^.\n]{0,80}?)"
                r"(twice\s+daily|2\s+(?:daily\s+)?(?:shows?|performances?)|two\s+(?:daily\s+)?shows?)",
                re.IGNORECASE,
            ),
            r"\g<1>once daily at 14:00 (subject to weather cancellation)",
        ),
    ],
    "ko": [
        (
            re.compile(r"해녀\s*(?:공연|쇼|시연)[^。.\n]{0,30}?(?:오전|오후)?\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?"),
            "해녀공연 1일 1회 오후 2시 (악천후 시 취소될 수 있음)",
        ),
        (
            re.compile(r"해녀\s*(?:공연|쇼|시연)[^。.\n]{0,30}?(?:오전|오후|아침|점심|저녁)"),
            "해녀공연 1일 1회 오후 2시 (악천후 시 취소될 수 있음)",
        ),
        (
            re.compile(r"해녀\s*(?:공연|쇼|시연)[^。.\n]{0,40}?(?:하루\s*\d회|일\s*\d회|\d회\s*공연)"),
            "해녀공연 1일 1회 오후 2시 (악천후 시 취소될 수 있음)",
        ),
    ],
    "ja": [
        (
            re.compile(r"海女(?:ショー|公演|実演)[^。\n]{0,30}?(?:午前|午後)?\s*\d{1,2}\s*時"),
            "海女ショーは1日1回、14時に開催（悪天候時は中止の可能性あり）",
        ),
        (
            re.compile(r"海女(?:ショー|公演|実演)[^。\n]{0,30}?(?:午前|午後|朝|昼|夕方)"),
            "海女ショーは1日1回、14時に開催（悪天候時は中止の可能性あり）",
        ),
    ],
    "zh": [
        (
            re.compile(r"海女(?:表演|演出|秀)[^。\n]{0,30}?(?:上午|下午)?\s*\d{1,2}\s*[点點]"),
            "海女表演每日1场，下午2点举行（恶劣天气时可能取消）",
        ),
    ],
    "zh-TW": [
        (
            re.compile(r"海女(?:表演|演出|秀)[^。\n]{0,30}?(?:上午|下午)?\s*\d{1,2}\s*[點点]"),
            "海女表演每日1場，下午2點舉行（惡劣天氣時可能取消）",
        ),
    ],
    "es": [
        (
            re.compile(r"haenyeo[^.\n]{0,100}?(?:por la mañana|por la tarde|matinal|vespertina)", re.IGNORECASE),
            "haenyeo (1 función/día a las 14:00; puede cancelarse por mal tiempo)",
        ),
        (
            re.compile(
                r"(haenyeo[^.\n]{0,80}?)"
                r"(dos\s+veces\s+al\s+día|2\s+funciones?|dos\s+funciones?)",
                re.IGNORECASE,
            ),
            r"\g<1>1 función al día a las 14:00 (puede cancelarse por mal tiempo)",
        ),
    ],
}


def rewrite_strings_in_obj(obj, rewrites):
    """Walk the JSON object and apply each regex rewrite to any string leaf."""
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if isinstance(v, str):
                new_v = v
                for rx, repl in rewrites:
                    new_v = rx.sub(repl, new_v)
                if new_v != v:
                    obj[k] = new_v
            else:
                rewrite_strings_in_obj(v, rewrites)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str):
                new_v = v
                for rx, repl in rewrites:
                    new_v = rx.sub(repl, new_v)
                if new_v != v:
                    obj[i] = new_v
            else:
                rewrite_strings_in_obj(v, rewrites)


def process_file(path: Path) -> tuple[int, bool]:
    """Return (#stops_marked, content_rewritten_flag)."""
    suffix = path.name.rsplit(".", 2)[-2]  # e.g. "en", "ko", "zh-TW"
    if suffix not in LOCALE_REWRITES:
        return (0, False)
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"  [SKIP] {path.name}: JSON decode error: {e}")
        return (0, False)

    marked = 0
    for stop in (doc.get("itineraryStops") or []):
        if is_seongsan_stop(stop):
            if stop.get("liveStatusWidget") != "haenyeo":
                stop["liveStatusWidget"] = "haenyeo"
                marked += 1

    orig_str = json.dumps(doc, ensure_ascii=False, sort_keys=True)
    rewrite_strings_in_obj(doc, LOCALE_REWRITES[suffix])
    new_str = json.dumps(doc, ensure_ascii=False, sort_keys=True)
    content_changed = new_str != orig_str

    if marked or content_changed:
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    return (marked, content_changed)


def main():
    total_marked = 0
    total_files_rewritten = 0
    for json_path in sorted(ROOT.rglob("*.json")):
        # Skip backups
        if json_path.suffix == ".bak" or json_path.name.endswith(".bak2"):
            continue
        # Only main tour JSONs (live locale files)
        if not re.match(r".*\.(en|ko|ja|zh|zh-TW|es)\.json$", json_path.name):
            continue
        marked, content_changed = process_file(json_path)
        if marked or content_changed:
            tag = f"[mark={marked} rewrite={'Y' if content_changed else 'n'}]"
            print(f"{tag} {json_path.relative_to(ROOT)}")
            total_marked += marked
            if content_changed:
                total_files_rewritten += 1
    print(f"\nTotal: {total_marked} stops marked with liveStatusWidget=haenyeo")
    print(f"Total: {total_files_rewritten} files had time-phrase rewrites")


if __name__ == "__main__":
    main()
