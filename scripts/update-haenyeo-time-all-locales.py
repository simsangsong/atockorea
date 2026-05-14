#!/usr/bin/env python3
"""
Update haenyeo performance time mentions across ALL locales.

Target: 1일 1회, 오후 2시 (14:00) + 악천후 시 취소 가능

Replaces a small, well-defined set of customer-facing time phrases. Leaves
internal scoring/reasoning metadata fields alone (those describe historical
schedules and are not displayed to customers).
"""
import json
import re
from pathlib import Path

ROOT = Path(r"C:\Users\sangsong\atockorea\components\product-tour-static")

# Each entry: (regex, replacement). Use (?P<head>) groups when we want to
# preserve a leading hook like "**해녀 물질 시연".
PATTERNS = {
    "en": [
        # "Haenyeo demonstrations daily 13:30 + 15:00 at the seaside cove" / "Haenyeo ... 13:30 / 15:00"
        (
            re.compile(
                r"(\*\*)?[Hh]aenyeo[\w\s]*?(?:demonstrations?|shows?|performance|diving|viewing)[\w\s]*?"
                r"(?:daily|twice daily|2 times daily)?[\s,]*"
                r"\d{1,2}:\d{2}\s*(?:[+/·,]|and)\s*\d{1,2}:\d{2}"
                r"(\*\*)?",
                re.IGNORECASE,
            ),
            r"\1Haenyeo demonstration once daily at 14:00 (subject to bad-weather cancellation)\2",
        ),
        # "(15:00 demo)" / "(14:00 show)" → "(14:00 show; may be canceled in bad weather)"
        (
            re.compile(r"\(\s*\d{1,2}:\d{2}\s+(?:demo|show|performance)\s*\)", re.IGNORECASE),
            "(14:00 show; may be canceled in bad weather)",
        ),
        # "Optional haenyeo viewing at base (15:00 demo)"
        (
            re.compile(r"(haenyeo[\w\s]+at base)\s*\(\s*\d{1,2}:\d{2}\s+(?:demo|show)\s*\)", re.IGNORECASE),
            r"\1 (14:00, 1/day; may be canceled in bad weather)",
        ),
    ],
    "ko": [
        # "**해녀 물질 시연 매일 13:30·15:00** ..."
        (
            re.compile(
                r"(\*\*)?(해녀\s*(?:물질\s*시연|공연|쇼))\s*(?:매일|하루)?\s*"
                r"\d{1,2}:\d{2}\s*[·,/+&]\s*\d{1,2}:\d{2}"
                r"(\*\*)?"
            ),
            r"\1\2 1일 1회 오후 2시 (악천후 시 취소 가능)\3",
        ),
        # "(15:00 공연)" "(13:30 시연)"
        (
            re.compile(r"\(\s*\d{1,2}:\d{2}\s*(?:공연|시연|쇼)\s*\)"),
            "(1일 1회 오후 2시, 악천후 시 취소 가능)",
        ),
        # "해녀 공연 관람 (15:00 공연)"
        (
            re.compile(r"(해녀\s*(?:공연|쇼|시연)\s*관람)\s*\(\s*\d{1,2}:\d{2}[^)]*\)"),
            r"\1 (1일 1회 오후 2시, 악천후 시 취소 가능)",
        ),
    ],
    "ja": [
        # "**海女 ... 毎日 13:30・15:00**"
        (
            re.compile(
                r"(\*\*)?(海女[\w\s]*?(?:実演|公演|ショー|素潜り))\s*(?:毎日|1日)?\s*"
                r"\d{1,2}:\d{2}\s*[・,/+&]\s*\d{1,2}:\d{2}"
                r"(\*\*)?"
            ),
            r"\1\2 1日1回14:00（悪天候時は中止の可能性あり）\3",
        ),
        # "（15:00の回）" / "（15:00デモ）" / "（15:00公演）"
        (
            re.compile(r"（\s*\d{1,2}:\d{2}\s*(?:の回|デモ|公演|ショー|実演|の部)\s*）"),
            "（1日1回14:00、悪天候時は中止の可能性あり）",
        ),
        # "麓での海女実演見学（15:00デモ）"
        (
            re.compile(r"(海女(?:実演|公演|ショー)見学)\s*[（(]\s*\d{1,2}:\d{2}[^)）]*[)）]"),
            r"\1（1日1回14:00、悪天候時は中止の可能性あり）",
        ),
    ],
    "zh": [
        # "**海女 ... 每日 13:30·15:00**"
        (
            re.compile(
                r"(\*\*)?(海女[\w\s]*?(?:表演|演出|秀|海女活动))\s*(?:每日|每天|1日)?\s*"
                r"\d{1,2}:\d{2}\s*[·,/+&]\s*\d{1,2}:\d{2}"
                r"(\*\*)?"
            ),
            r"\1\2 每日1场，下午2点举行（恶劣天气时可能取消）\3",
        ),
        # "（15:00场次）"
        (
            re.compile(r"（\s*\d{1,2}:\d{2}\s*(?:场次|表演|演出|场)\s*）"),
            "（每日1场，下午2点；恶劣天气时可能取消）",
        ),
    ],
    "zh-TW": [
        # Traditional Chinese: 場次/表演/演出
        (
            re.compile(
                r"(\*\*)?(海女[\w\s]*?(?:表演|演出|秀))\s*(?:每日|每天|1日)?\s*"
                r"\d{1,2}:\d{2}\s*[·,/+&]\s*\d{1,2}:\d{2}"
                r"(\*\*)?"
            ),
            r"\1\2 每日1場，下午2點舉行（惡劣天氣時可能取消）\3",
        ),
        (
            re.compile(r"（\s*\d{1,2}:\d{2}\s*(?:場次|表演|演出|場)\s*）"),
            "（每日1場，下午2點；惡劣天氣時可能取消）",
        ),
    ],
    "es": [
        (
            re.compile(
                r"(\*\*)?([Hh]aenyeo[\w\s]*?(?:demostraci(?:ón|ones)?|funci(?:ón|ones)?|espect[áa]culo|inmersi[óo]n))\s*"
                r"(?:diaria(?:s)?|al d[íi]a)?\s*\d{1,2}:\d{2}\s*[·,/+&]\s*\d{1,2}:\d{2}"
                r"(\*\*)?"
            ),
            r"\1\2 1 vez al día a las 14:00 (puede cancelarse por mal tiempo)\3",
        ),
        (
            re.compile(r"\(\s*\d{1,2}:\d{2}\s+(?:demo|funci[óo]n|espect[áa]culo)\s*\)", re.IGNORECASE),
            "(14:00, 1 función/día; puede cancelarse por mal tiempo)",
        ),
    ],
}

# Internal metadata fields we should NOT touch — these contain historical
# scheduling for scoring algorithms, not customer copy.
SKIP_KEYS = {
    "_publication",
    "matching_metadata",
    "matching_profile",  # large scoring profile that may carry internal references
    "_poi_meta",  # internal POI scoring fields (different from customer description)
}


def rewrite(value: str, rules):
    new_v = value
    for rx, repl in rules:
        new_v = rx.sub(repl, new_v)
    return new_v


def walk(obj, rules, skip_keys):
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            if k in skip_keys:
                continue
            if isinstance(v, str):
                new_v = rewrite(v, rules)
                if new_v != v:
                    obj[k] = new_v
            else:
                walk(v, rules, skip_keys)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str):
                new_v = rewrite(v, rules)
                if new_v != v:
                    obj[i] = new_v
            else:
                walk(v, rules, skip_keys)


def process_file(path: Path) -> bool:
    suffix = path.name.rsplit(".", 2)[-2]
    if suffix not in PATTERNS:
        return False
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False

    orig = json.dumps(doc, ensure_ascii=False, sort_keys=True)
    walk(doc, PATTERNS[suffix], SKIP_KEYS)
    new = json.dumps(doc, ensure_ascii=False, sort_keys=True)
    if new != orig:
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        return True
    return False


def main():
    total = 0
    for json_path in sorted(ROOT.rglob("*.json")):
        if json_path.name.endswith(".bak") or json_path.name.endswith(".bak2"):
            continue
        if not re.match(r".*\.(en|ko|ja|zh|zh-TW|es)\.json$", json_path.name):
            continue
        if process_file(json_path):
            print(f"rewrite: {json_path.relative_to(ROOT)}")
            total += 1
    print(f"\nTotal: {total} files rewritten")


if __name__ == "__main__":
    main()
