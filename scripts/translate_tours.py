#!/usr/bin/env python3
"""
Tour Translation Pipeline  v2 — string-extraction approach
===========================================================
Extracts ONLY customer-facing text strings from EN JSON, translates them
as a numbered list, then reassembles the original JSON structure.

Why this beats full-JSON translation:
  • URLs, IDs, numbers, code values never sent → ~50% fewer tokens
  • Numbered list = zero JSON parsing errors
  • System prompt cached 1 h per language → reused across all 16 tours

Usage
-----
    python translate_tours.py            # start or resume
    python translate_tours.py --reset    # wipe queue, restart
    python translate_tours.py --status   # show progress
    python translate_tours.py --dry-run  # plan only, no API calls
    python translate_tours.py --tour <slug> --lang <code>
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR    = Path(
    r"C:\Users\sangsong\atockorea\components\product-tour-static"
)
SCRIPTS_DIR = Path(__file__).parent
# These are set dynamically in run() based on --queue-suffix
QUEUE_FILE  = SCRIPTS_DIR / "translate_queue.json"
LOG_FILE    = SCRIPTS_DIR / "translate.log"


# ─────────────────────────────────────────────────────────────────────────────
# SETTINGS
# ─────────────────────────────────────────────────────────────────────────────
MAX_STRINGS_PER_BATCH = 25   # strings per claude -p call  (safe: ~8 000 chars avg)
DELAY_BETWEEN_CALLS   = 2    # seconds between calls
MAX_RETRIES           = 3
MODEL                 = "sonnet"
# Change to "opus" for maximum quality (~5× more quota usage)


# ─────────────────────────────────────────────────────────────────────────────
# TOURS
# ─────────────────────────────────────────────────────────────────────────────
TOURS_A = [   # reserved for --queue-suffix a
    "seoul-dmz-private-3rd-tunnel-suspension-bridge",
    "seoul-private-nami-morning-calm-petite-france",
    "seoul-seoraksan-national-park-sokcho-beach-day-trip",
    "seoul-suburbs-private-chartered-car-10hr",
]

TOURS_B = [   # reserved for --queue-suffix b
    "seoul-suwon-hwaseong-folk-village-starfield-library",
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
    "seoul-suwon-hwaseong-waujeongsa-starfield",
]

TOURS = [
    # 서울 우선
    "seoul-dmz-private-3rd-tunnel-suspension-bridge",
    "seoul-private-nami-morning-calm-petite-france",
    "seoul-seoraksan-national-park-sokcho-beach-day-trip",
    "seoul-suburbs-private-chartered-car-10hr",
    "seoul-suwon-hwaseong-folk-village-starfield-library",
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
    "seoul-suwon-hwaseong-waujeongsa-starfield",
    # 이어서 나머지
    "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
    "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
    "east-signature-nature-core",
    "jeju-cherry-blossom-tour-east-route",
    "jeju-cruise-shore-excursion-bus-tour",
    "jeju-southern-top-unesco-spots-tour",
    "jeju-winter-southwest-tangerine-snow-camellia-tour",
]


# ─────────────────────────────────────────────────────────────────────────────
# LANGUAGES
# ─────────────────────────────────────────────────────────────────────────────
LANGUAGES = {
    "ko": {
        "name":   "Korean (한국어)",
        "locale": "ko",
        "suffix": "ko",
        "quality": """\
- 실제 한국 여행 예약 사이트(마이리얼트립, 클룩 KO) 문체.
- 해요체 (-해요 / -입니다 / -예요).
- 금지어: 최적의, 완벽한, 놀라운, 비교할 수 없는, 숨막히는, 신비로운, 황홀한.
- 관광지 고유명사: 한국관광공사 공식 표기 기준.
- 원문 내용 빠짐없이 번역 (요약·삭제·추가 금지).
- 가격·시간·숫자는 그대로.""",
    },
    "ja": {
        "name":   "Japanese (日本語)",
        "locale": "ja",
        "suffix": "ja",
        "quality": """\
- じゃらん・KKday JA スタイル。丁寧語 (です/ます体)。
- 禁止: 比類なき, 完璧な, 息をのむ, 唯一無二。
- 観光地名: 一般的な日本語表記。
- 原文を全て翻訳 (省略・要約・追記禁止)。
- 価格・時間・数値はそのまま。""",
    },
    "zh": {
        "name":   "Chinese Simplified (简体中文)",
        "locale": "zh",
        "suffix": "zh",
        "quality": """\
- 携程/美团旅行风格，自然简体中文。
- 禁止: 无与伦比, 完美无缺, 令人窒息, 叹为观止。
- 景点名: 中国大陆通用译名。
- 原文完整翻译，不省略不缩减不添加。
- 价格时间数字原样保留。""",
    },
    "zh-TW": {
        "name":   "Traditional Chinese (繁體中文)",
        "locale": "zh-TW",
        "suffix": "zh-TW",
        "quality": """\
- 雄獅旅遊/易遊網風格，自然繁體中文。
- 台灣用語: 計程車/飯店/捷運/行程。
- 禁止: AI誇張詞彙。
- 原文完整翻譯，不省略不縮減不添加。
- 價格時間數字原樣保留。""",
    },
    "es": {
        "name":   "Spanish (Español)",
        "locale": "es",
        "suffix": "es",
        "quality": """\
- Español internacional, estilo Viator/GetYourGuide ES.
- Tono amigable e informativo; evitar regionalismos.
- Prohibido: incomparable, perfecto, asombroso, sin igual.
- Traducir TODO sin omitir ni añadir nada.
- Conservar cifras, horarios y precios tal cual.""",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# SKIP RULES — keys/sections that are NOT customer-facing
# ─────────────────────────────────────────────────────────────────────────────

# Top-level JSON keys copied from EN as-is (internal / technical)
PASSTHROUGH_KEYS = {
    "document_kind", "schema_version", "slug", "product_id",
    "matching_profile", "matching_metadata",   # internal scoring data
    "_publication",                             # version history / dev notes
    "itinerary_variants", "guestReviews",       # always empty
}

# JSON keys whose STRING values are technical (not customer text)
NON_TRANSLATABLE_VALUE_KEYS = {
    # identifiers & codes
    "id", "slug", "product_id", "locale", "document_kind",
    # media / URLs
    "src", "imageUrl", "heroImage", "thumbnail", "ogImage",
    "imagePosition", "href", "url", "bookingUrl",
    # pricing technical fields
    "priceSource", "currency", "per", "amountLabel",
    # numeric / boolean stored as strings
    "number", "time", "rating", "level", "discountPercent",
    "originalPriceUsd", "salePriceUsd", "reviewCount", "stopsCount",
    # UI code values
    "icon", "type", "theme_tags", "region_tags",
    # HTML/CSS identifiers
    "section_html_id", "anchor", "html_id",
}

# Regex: values that look like code (even if key isn't in the list above)
_CODE_RE = re.compile(
    r'^('
    r'https?://.*'                      # URLs
    r'|//.*'                            # protocol-relative URLs
    r'|[a-z][a-z0-9_]{2,}[_][a-z0-9_]+' # snake_case codes like nature__photo_trip
    r'|[a-z][a-z0-9-]{2,}[-][a-z0-9-]+'  # kebab-case codes
    r'|[A-Z]{2,6}'                      # currency codes: USD, KRW
    r'|center \d+%'                     # CSS values
    r'|v\d+.*'                          # version strings
    r'|\d{4}-\d{2}-\d{2}'              # dates
    r')$'
)

NL_MARKER = "[[NL]]"   # placeholder for newlines inside strings

# OTA brand names to scrub from all customer-facing text
_OTA_RE = re.compile(
    r'\b(GetYourGuide|Klook|Trip\.com|Ctrip|Viator|TripAdvisor|'
    r'Expedia|KKday|Booking\.com|Airbnb\s+Experiences?|Airbnb)\b',
    re.IGNORECASE,
)


# Price sub-keys to blank out (user will fill manually)
_PRICE_CLEAR = {
    "amountLabel", "originalPriceUsd", "salePriceUsd",
    "discountPercent", "priceNote", "priceSource",
}


# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────
def log(msg: str, level: str = "INFO"):
    ts   = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] [{level}] {msg}"
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        sys.stdout.buffer.write((line + "\n").encode("utf-8", errors="replace"))
        sys.stdout.buffer.flush()
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# QUEUE
# ─────────────────────────────────────────────────────────────────────────────
def create_queue(tours=None, langs=None) -> dict:
    t_list = tours or TOURS
    l_list = langs  or list(LANGUAGES.keys())
    # Language-first: all 16 tours share the 1h cached system prompt per language
    tasks = [
        {"tour": t, "lang": l, "status": "pending", "attempts": 0, "error": None}
        for l in l_list
        for t in t_list
    ]
    q = {"created_at": datetime.now().isoformat(), "tasks": tasks}
    _save_queue(q)
    log(f"Queue created: {len(tasks)} tasks  ({len(l_list)} langs × {len(t_list)} tours)")
    return q


def load_queue() -> dict:
    if not QUEUE_FILE.exists():
        return create_queue()
    with open(QUEUE_FILE, encoding="utf-8") as f:
        return json.load(f)


def _save_queue(q: dict):
    q["updated_at"] = datetime.now().isoformat()
    with open(QUEUE_FILE, "w", encoding="utf-8") as f:
        json.dump(q, f, ensure_ascii=False, indent=2)


def queue_counts(q: dict) -> dict:
    c = {"pending": 0, "in_progress": 0, "done": 0, "failed": 0}
    for t in q["tasks"]:
        c[t["status"]] = c.get(t["status"], 0) + 1
    return c


# ─────────────────────────────────────────────────────────────────────────────
# STRING EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────
def _should_translate(value: str, parent_key) -> bool:
    """True if this string is customer-facing text that needs translation."""
    if not isinstance(value, str) or not value.strip():
        return False
    pk = str(parent_key)
    if pk in NON_TRANSLATABLE_VALUE_KEYS:
        return False
    if _CODE_RE.match(value):
        return False
    return True


def extract_strings(data) -> tuple:
    """
    Walk data recursively and collect all translatable strings.

    Returns
    -------
    strings : list[str]   — extracted text values (in traversal order)
    paths   : list[tuple] — JSON path tuple for each string (for reconstruction)
    """
    strings: list = []
    paths:   list = []

    def _walk(obj, path):
        if isinstance(obj, dict):
            for k, v in obj.items():
                # Skip internal/private fields (underscore-prefixed keys like _poi_meta)
                if str(k).startswith("_"):
                    continue
                _walk(v, path + (k,))
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                _walk(item, path + (i,))
        elif isinstance(obj, str):
            pk = path[-1] if path else ""
            if _should_translate(obj, pk):
                # Encode embedded newlines so numbered-list format survives
                strings.append(obj.replace("\n", NL_MARKER))
                paths.append(path)

    _walk(data, ())
    return strings, paths


def apply_translations(data, paths: list, translated: list):
    """
    Return a deep copy of data with the extracted strings replaced
    by their translations.
    """
    lookup = {p: t for p, t in zip(paths, translated)}

    def _rebuild(obj, path):
        if isinstance(obj, dict):
            return {k: _rebuild(v, path + (k,)) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [_rebuild(item, path + (i,)) for i, item in enumerate(obj)]
        elif isinstance(obj, str):
            return lookup.get(path, obj)
        return obj

    return _rebuild(data, ())


# ─────────────────────────────────────────────────────────────────────────────
# PREPROCESSING — OTA removal + price field clearing
# ─────────────────────────────────────────────────────────────────────────────
def _clear_price_block(block: dict):
    """Zero-out price fields in a price dict in-place."""
    if not isinstance(block, dict):
        return
    for field in _PRICE_CLEAR:
        if field in block:
            orig = block[field]
            block[field] = "" if isinstance(orig, str) else None


def _strip_ota(text: str) -> str:
    cleaned = _OTA_RE.sub("", text)
    cleaned = re.sub(r'[ \t]{2,}', ' ', cleaned)     # collapse double spaces
    cleaned = re.sub(r'\s+([.,;:])', r'\1', cleaned)  # fix " ," artifacts
    return cleaned.strip()


def _strip_otas_recursive(obj):
    if isinstance(obj, dict):
        return {k: _strip_otas_recursive(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_strip_otas_recursive(item) for item in obj]
    if isinstance(obj, str):
        return _strip_ota(obj)
    return obj


def preprocess_data(data: dict) -> dict:
    """
    Deep-copy data, then:
      1. Clear price fields (user fills manually).
      2. Strip OTA brand names from all string values.
    """
    import copy
    data = copy.deepcopy(data)

    # Clear top-level price block
    _clear_price_block(data.get("price"))

    # Clear catalog_card price + fake review numbers
    cc = data.get("catalog_card")
    if isinstance(cc, dict):
        if "priceLabel" in cc:
            cc["priceLabel"] = ""
        cc["rating"]      = 0
        cc["reviewCount"] = 0

    # Clear sticky_booking_bar.price block
    sbb = data.get("sticky_booking_bar")
    if isinstance(sbb, dict):
        _clear_price_block(sbb.get("price"))

    # Strip OTA names from all string values
    return _strip_otas_recursive(data)


# ─────────────────────────────────────────────────────────────────────────────
# CLAUDE CLI
# ─────────────────────────────────────────────────────────────────────────────
def _find_claude_cmd() -> list:
    for candidate in [
        r"C:\Users\sangsong\AppData\Roaming\npm\claude.cmd",
        shutil.which("claude.cmd"),
        shutil.which("claude"),
    ]:
        if candidate and Path(candidate).exists():
            return [candidate]
    raise RuntimeError("claude CLI not found. Ensure Claude Code is installed.")


# ─────────────────────────────────────────────────────────────────────────────
# TRANSLATION  (numbered-list format)
# ─────────────────────────────────────────────────────────────────────────────
_SYSTEM_TMPL = """\
Travel content translator → {name}. Translate each numbered line.
Return ONLY numbered translations (same count, same order). No extra text.
{quality}"""


def _parse_numbered(raw: str, expected: int) -> list:
    """Parse '1. text\\n2. text…' response into a plain list."""
    results = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r'^\d+[.)]\s*(.*)', line)
        if m:
            results.append(m.group(1).strip())
        elif results:
            results[-1] += " " + line   # continuation of previous item
    return results


def translate_batch(strings: list, lang_code: str) -> list:
    """Translate a list of strings, return same-length translated list."""
    cfg    = LANGUAGES[lang_code]
    system = _SYSTEM_TMPL.format(name=cfg["name"], quality=cfg["quality"])
    numbered_input = "\n".join(f"{i+1}. {s}" for i, s in enumerate(strings))
    prompt = f"Translate to {cfg['name']}:\n\n{numbered_input}"

    claude_cmd = _find_claude_cmd()
    last_err   = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            proc = subprocess.run(
                claude_cmd + [
                    "-p",
                    "--output-format", "json",
                    "--model",         MODEL,
                    "--system-prompt", system,
                ],
                input          = prompt,
                capture_output = True,
                text           = True,
                encoding       = "utf-8",
                timeout        = 360,
            )
            if proc.returncode != 0:
                raise RuntimeError(f"claude exit {proc.returncode}: {proc.stderr[:300]}")

            outer = json.loads(proc.stdout)
            if outer.get("is_error"):
                raise RuntimeError(f"claude error: {outer.get('result','')[:200]}")

            raw = outer.get("result", "").strip()

            # Strip accidental code fences
            if raw.startswith("```"):
                raw = "\n".join(raw.split("\n")[1:-1]).strip()

            translations = _parse_numbered(raw, len(strings))

            if len(translations) != len(strings):
                raise ValueError(
                    f"Count mismatch: sent {len(strings)}, got {len(translations)}"
                )

            # Restore encoded newlines
            return [t.replace(NL_MARKER, "\n") for t in translations]

        except Exception as exc:
            last_err = exc
            if attempt < MAX_RETRIES:
                wait = 8 * attempt
                log(f"      Attempt {attempt} failed ({exc}). Retry in {wait}s…", "WARN")
                time.sleep(wait)

    raise RuntimeError(f"All {MAX_RETRIES} attempts failed: {last_err}")


# ─────────────────────────────────────────────────────────────────────────────
# PROCESS ONE TASK
# ─────────────────────────────────────────────────────────────────────────────
def process_task(tour: str, lang_code: str, dry_run: bool = False):
    cfg      = LANGUAGES[lang_code]
    tour_dir = BASE_DIR / tour
    en_path  = tour_dir / f"{tour}.en.json"
    out_path = tour_dir / f"{tour}.{cfg['suffix']}.json"

    if not en_path.exists():
        raise FileNotFoundError(f"EN source missing: {en_path}")

    with open(en_path, encoding="utf-8") as f:
        original = json.load(f)

    # Data that will go through translation (passthrough keys are excluded)
    translatable_data = {
        k: v for k, v in original.items()
        if k not in PASSTHROUGH_KEYS and k != "locale"
    }

    # Strip OTA names + clear price fields before translation
    translatable_data = preprocess_data(translatable_data)

    strings, paths = extract_strings(translatable_data)
    total_chars    = sum(len(s) for s in strings)
    total_batches  = (len(strings) + MAX_STRINGS_PER_BATCH - 1) // MAX_STRINGS_PER_BATCH

    log(f"  {len(strings)} strings  |  {total_chars:,} chars  |  {total_batches} batches")

    if dry_run:
        for b in range(total_batches):
            s = b * MAX_STRINGS_PER_BATCH
            e = min(s + MAX_STRINGS_PER_BATCH, len(strings))
            bc = sum(len(x) for x in strings[s:e])
            log(f"    [DRY-RUN] batch {b+1}/{total_batches}: {e-s} strings, {bc:,} chars")
        log(f"  [DRY-RUN] Would write → {out_path.name}")
        return

    # Translate in batches
    all_translated: list = []
    for b in range(total_batches):
        s     = b * MAX_STRINGS_PER_BATCH
        e     = min(s + MAX_STRINGS_PER_BATCH, len(strings))
        batch = strings[s:e]
        bc    = sum(len(x) for x in batch)
        log(f"    [{b+1:02d}/{total_batches:02d}] {len(batch)} strings  {bc:,} chars")

        translated = translate_batch(batch, lang_code)
        all_translated.extend(translated)
        time.sleep(DELAY_BETWEEN_CALLS)

    # Reconstruct JSON
    translated_data = apply_translations(translatable_data, paths, all_translated)

    # Assemble final file preserving original key order
    final = {}
    for key in original:
        if key == "locale":
            final["locale"] = cfg["locale"]
        elif key in PASSTHROUGH_KEYS:
            final[key] = original[key]
        else:
            final[key] = translated_data.get(key, original[key])

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    size_kb = out_path.stat().st_size // 1024
    log(f"  Written → {out_path.name}  ({size_kb} KB)")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def run(args):
    global QUEUE_FILE, LOG_FILE, TOURS

    # --queue-suffix b  →  separate queue/log files + TOURS_B
    if getattr(args, 'queue_suffix', None):
        s = args.queue_suffix
        QUEUE_FILE = SCRIPTS_DIR / f"translate_queue_{s}.json"
        LOG_FILE   = SCRIPTS_DIR / f"translate_{s}.log"
        if s == "b":
            TOURS = TOURS_B

    if args.status:
        if not QUEUE_FILE.exists():
            print("No queue yet. Run without --status to start.")
            return
        q = load_queue()
        c = queue_counts(q)
        total = len(q["tasks"])
        print(f"\n  done       : {c['done']:3d} / {total}")
        print(f"  pending    : {c['pending']:3d}")
        print(f"  in_progress: {c['in_progress']:3d}")
        print(f"  failed     : {c['failed']:3d}")
        if c["failed"]:
            print("\nFailed tasks:")
            for t in q["tasks"]:
                if t["status"] == "failed":
                    print(f"  {t['tour']} → {t['lang']}  {(t['error'] or '')[:80]}")
        return

    if args.reset:
        if QUEUE_FILE.exists():
            QUEUE_FILE.unlink()
        log("Queue reset.")

    # Single-task mode
    if args.tour or args.lang:
        if not (args.tour and args.lang):
            print("ERROR: --tour and --lang must be used together.")
            sys.exit(1)
        log(f"Single task: {args.tour} → {args.lang}")
        process_task(args.tour, args.lang, dry_run=args.dry_run)
        return

    # Batch mode
    q     = load_queue()
    c     = queue_counts(q)
    log(f"Starting.  Queue: {c}")
    start = time.time()

    for task in q["tasks"]:
        if task["status"] == "done":
            continue
        if task["status"] == "failed" and task["attempts"] >= MAX_RETRIES:
            continue

        tour = task["tour"]
        lang = task["lang"]
        elapsed = (time.time() - start) / 60
        log(f"\n{'='*65}")
        log(f"  {tour}  →  {lang}  (attempt {task['attempts']+1}, {elapsed:.1f}m elapsed)")

        task["status"]    = "in_progress"
        task["attempts"] += 1
        _save_queue(q)

        try:
            process_task(tour, lang, dry_run=args.dry_run)
            task["status"] = "done"
            task["error"]  = None
            log("  ✓ done")
        except Exception as exc:
            exhausted      = task["attempts"] >= MAX_RETRIES
            task["status"] = "failed" if exhausted else "pending"
            task["error"]  = str(exc)[:500]
            log(f"  {'✗ FAILED' if exhausted else '⚠ error (will retry)'}: {exc}", "ERROR")

        _save_queue(q)

    total_min = (time.time() - start) / 60
    c = queue_counts(q)
    log(f"\n{'='*65}")
    log(f"DONE.  done={c['done']}  failed={c['failed']}  pending={c['pending']}  {total_min:.1f}m")
    if c["failed"]:
        log("Re-run to retry failed tasks.", "WARN")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Tour translation pipeline v2")
    p.add_argument("--reset",        action="store_true")
    p.add_argument("--status",       action="store_true")
    p.add_argument("--dry-run",      action="store_true")
    p.add_argument("--tour")
    p.add_argument("--lang")
    p.add_argument("--queue-suffix", dest="queue_suffix", default=None,
                   help="'b' → use TOURS_B + separate queue/log files")
    run(p.parse_args())
