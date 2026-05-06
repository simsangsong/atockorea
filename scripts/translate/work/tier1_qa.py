"""Tier 1 auto QA for canonical translation maps."""
import json, os, re
from collections import defaultdict
from opencc import OpenCC

BASE = r'C:\Users\sangsong\atockorea'
WORK = os.path.join(BASE, 'scripts', 'translate', 'work')

LOCALES = ['ko', 'ja', 'zh', 'zh-TW', 'es']
GAP_FIELDS = ['description', 'whyOnRoute', 'convenience', 'smartNotes', 'visitBasics', 'highlights', 'transitNote']

cc_s2t = OpenCC('s2t')

def load(p):
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

# Load EN canonical fields per POI
manifest = load(os.path.join(WORK, 'poi-manifest.json'))
en_by_key = {p['poi_key']: p['en_fields'] for p in manifest if 'en_fields' in p}

# Load combined translation maps
trans = {}
for loc in LOCALES:
    p = os.path.join(WORK, f'{loc}-translations-combined.json')
    if os.path.exists(p):
        trans[loc] = load(p)
    else:
        trans[loc] = {}
    print(f"{loc}: {len(trans[loc])} POIs")

# Glossary — flatten EN -> {locale: target}
glossary_raw = load(os.path.join(BASE, 'scripts', 'translate', 'glossary.json'))
glossary = {}  # en_term -> {locale: target}
def walk_glossary(node):
    if isinstance(node, dict):
        # Detect leaf: dict with 'en' key + locale codes
        if 'en' in node and any(k in node for k in ['ko','ja','zh','zh-TW','es']):
            en = node.get('en', '').strip()
            if en:
                glossary[en.lower()] = {k: node.get(k, '') for k in ['ko','ja','zh','zh-TW','es']}
            return
        for v in node.values():
            walk_glossary(v)
    elif isinstance(node, list):
        for v in node:
            walk_glossary(v)
walk_glossary(glossary_raw)
print(f"Glossary entries: {len(glossary)}")
# Build AUTO_WL from glossary EN tokens (computed after glossary loads but used in mixed-script check)
AUTO_WL = set()
for _term in glossary.keys():
    for _tok in re.findall(r"[A-Za-z][A-Za-z\-']{2,}", _term):
        AUTO_WL.add(_tok.lower())
print(f"Auto Latin whitelist tokens: {len(AUTO_WL)}")

findings = []  # list of {locale, poi_key, field, issue_type, severity, snippet, detail, suggested_fix?}

def add(locale, poi_key, field, issue_type, severity, snippet, detail='', suggested=None):
    findings.append({
        'locale': locale,
        'poi_key': poi_key,
        'field': field,
        'issue_type': issue_type,
        'severity': severity,
        'snippet': snippet[:200] if isinstance(snippet, str) else str(snippet)[:200],
        'detail': detail,
        'suggested_fix': suggested,
    })

# --- Helpers to flatten translations
def iter_strings(node, path=''):
    """Yield (path, text) leaves recursively."""
    if isinstance(node, str):
        yield (path, node)
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from iter_strings(v, f'{path}.{k}' if path else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from iter_strings(v, f'{path}[{i}]')

# --- Check 1: Markdown integrity (** balanced)
def check_markdown(loc, poi, field, text):
    # Count ** pairs (must be even)
    pairs = text.count('**')
    if pairs % 2 != 0:
        add(loc, poi, field, 'markdown_unbalanced_bold', 'major', text,
            detail=f'count of "**" = {pairs} (odd)')

# --- Check 2: System/code leak
# Camel-case JSON keys + uppercase-only debug markers (case-sensitive to avoid es 'todo' FP)
SYSTEM_TOKENS_CASESENSITIVE = re.compile(r'\b(?:whyOnRoute|itineraryStops|itinerary_variants|en_fields|ko_fields|ja_fields|zh_fields|es_fields|_poi_meta|poi_key|name_en|smartNotes|visitBasics|gap_field|stop_drawer)\b')
SYSTEM_TOKENS_UPPER = re.compile(r'\b(?:TODO|FIXME|XXX|TRANSLATE_THIS|PLACEHOLDER_TEXT)\b')
PLACEHOLDER_LIKE = re.compile(r'\{\{[^}]+\}\}|\$\{[^}]+\}|<!--.*?-->')

def check_system_leak(loc, poi, field, text):
    for rx, label in [(SYSTEM_TOKENS_CASESENSITIVE, 'system token'), (SYSTEM_TOKENS_UPPER, 'debug marker')]:
        for m in rx.finditer(text):
            s, e = m.start(), m.end()
            before = text[:s]
            backticks_before = before.count('`')
            if backticks_before % 2 == 0:
                add(loc, poi, field, 'system_leak_token', 'major',
                    text[max(0,s-30):min(len(text),e+30)],
                    detail=f'{label} "{m.group(0)}" in prose')
    for m in PLACEHOLDER_LIKE.finditer(text):
        add(loc, poi, field, 'placeholder_leak', 'critical',
            text[max(0,m.start()-30):min(len(text),m.end()+30)],
            detail=f'placeholder "{m.group(0)}"')

# --- Check 3: Numbers/dates/prices match EN
NUM_RE = re.compile(r'\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+')

def normalize_number(s):
    """Strip thousands separators; keep decimal."""
    s = s.replace(',', '').replace('.', '')
    return s

def extract_numbers(text):
    return [m.group(0) for m in NUM_RE.finditer(text)]

def expand_target_numbers_with_units(target_text, loc):
    """Extract numbers, including 만/万 unit recognition for CJK locales."""
    nums = set(normalize_number(n) for n in extract_numbers(target_text) if normalize_number(n).isdigit())
    if loc in ('ko', 'ja', 'zh', 'zh-TW'):
        # Patterns like "25만", "25万", "25萬", "5만", "1.4만" (decimal man = 4 zeros + decimal shift)
        # 만 = 10000, so "25만" = 250000, "1.4만" = 14000
        man_chars = '만萬万'
        for m in re.finditer(rf'(\d+(?:\.\d+)?)([{man_chars}])', target_text):
            base = float(m.group(1))
            full = int(base * 10000)
            nums.add(str(full))
            # Also add forms like "250000" by stripping zeros if needed
        # 천 = 1000, e.g., "5천" = 5000
        for m in re.finditer(r'(\d+(?:\.\d+)?)([천千])', target_text):
            base = float(m.group(1))
            full = int(base * 1000)
            nums.add(str(full))
        # 억 = 100,000,000
        for m in re.finditer(r'(\d+(?:\.\d+)?)([억億])', target_text):
            base = float(m.group(1))
            full = int(base * 100000000)
            nums.add(str(full))
    return nums

def check_numbers(loc, poi, field, en_text, target_text):
    if not en_text or not target_text:
        return
    en_nums = set()
    for n in extract_numbers(en_text):
        norm = normalize_number(n)
        if len(norm) >= 2 and norm.isdigit():
            en_nums.add(norm)
    target_nums = expand_target_numbers_with_units(target_text, loc)
    # Only flag salient numbers (>= 3 digits, exclude common 4-digit years if context unclear)
    missing = set()
    for n in en_nums:
        if len(n) < 3:
            continue
        if n in target_nums:
            continue
        # Try matching with trailing-zeros stripped (e.g., 5000 vs 5)
        if n.rstrip('0') in target_nums:
            continue
        # Match against truncated forms: "140000" might appear as "14" if "만" is implicit
        # Only flag if the digit sequence isn't a substring of a target number
        if any(n in tn or tn in n for tn in target_nums if len(tn) >= 3):
            continue
        missing.add(n)
    if missing:
        add(loc, poi, field, 'number_missing', 'major', target_text,
            detail=f'EN numbers not in target: {sorted(missing)}')

# --- Check 4: Glossary violations (fuzzy match)
def normalize_for_match(s):
    """Lowercase + strip whitespace + strip common punctuation for fuzzy match."""
    return re.sub(r'[\s\-·,.()\[\]{}『』「」（）]', '', s.lower())

def check_glossary(loc, poi, field, en_text, target_text):
    if not en_text or not target_text or loc not in ['ko','ja','zh','zh-TW','es']:
        return
    en_lower = en_text.lower()
    target_norm = normalize_for_match(target_text)
    for term, locales in glossary.items():
        if not term or len(term) < 4:  # raise minimum length to reduce noise
            continue
        if term not in en_lower:
            continue
        expected = locales.get(loc, '').strip()
        if not expected:
            continue
        expected_norm = normalize_for_match(expected)
        if expected_norm in target_norm:
            continue
        # Try matching the core (last word or longest 2+ char run) of expected
        # E.g. expected="천제연 폭포" -> try "천제연" and "폭포" separately
        parts = re.split(r'\s+', expected)
        # Accept if MOST significant part is in target (longest part)
        parts = [p for p in parts if len(p) >= 2]
        if parts:
            longest = max(parts, key=len)
            if normalize_for_match(longest) in target_norm:
                continue
        # Or accept if expected without parenthetical extras matches
        expected_core = re.sub(r'\([^)]*\)', '', expected).strip()
        if expected_core and normalize_for_match(expected_core) in target_norm:
            continue
        add(loc, poi, field, 'glossary_term_missing', 'major', target_text,
            detail=f'EN term "{term}" present, but expected "{expected}" not in target')

# --- Check 5: Mixed-language tokens
SCRIPT_RANGES = {
    'hangul': re.compile(r'[㄰-㆏가-힯]'),
    'kana': re.compile(r'[぀-ゟ゠-ヿ]'),
    'han': re.compile(r'[㐀-䶿一-鿿豈-﫿]'),
    'latin': re.compile(r'[A-Za-z]'),
}

# Auto-extract brand whitelist from glossary (entries whose en is Latin and target is Latin too get free pass)
def auto_brand_whitelist():
    """Add Latin tokens that appear as glossary EN keys (likely proper nouns/brands)."""
    extra = set()
    for term in glossary.keys():
        # tokenize EN term
        for tok in re.findall(r"[A-Za-z][A-Za-z\-']{2,}", term):
            extra.add(tok)
    return sorted(extra)

# Allowed Latin runs per locale (brand-style + acronym whitelist)
LATIN_WHITELIST = {
    'ko': ['UNESCO','DMZ','BTS','BBQ','OK','GAP','CGV','MEGABOX','BCHO','COEX','LED','GPS','VIP','SUV','USD','KRW','JPY','EUR','RMB','HKD','AtoC','Korea','GetYourGuide','Stripe','Klook','Trip','Petite','France','Yangsan','Jeju','Busan','Seoul','Incheon','Suwon','Pocheon','Hwaseong','Bulguksa','Hallasan','Daereungwon','Cheomseongdae','Bukchon','Gyeongju','Gangnam','Hongdae','Itaewon','Insadong','Gangnam','Coex','Lotte','Hyundai','Kia','Samsung','Innisfree','Olive','Young','Tony','Moly','Etude','House','Laneige','Missha','POPMART','Adora','Magic','City','HICO','MICE','UNESCO','BIFF','Cheongju','Aewol','Gimpo','Daegu','Daejeon','Gwangju','Jeju','Mokpo','Ulsan','Sokcho','Yangju','Yongin','Pyeongtaek','Iksan','Jeonju','Gunsan','Cheongsapo','Songjeong','Gangneung','Hyangwonjeong','Geunjeongjeon','Gyeonghoeru','MV','UN','LOCODE','UNESCO','GT','GHQ','POI'],
    'ja': ['UNESCO','DMZ','BTS','BBQ','OK','GAP','CGV','MEGABOX','BCHO','COEX','LED','GPS','VIP','SUV','USD','KRW','JPY','EUR','RMB','HKD','AtoC','Korea','GetYourGuide','Stripe','Klook','Trip','Petite','France','Coex','POPMART','Adora','HICO','MICE','BIFF','UN','LOCODE','MV','GT','POI','ATM','WiFi','Wi-Fi'],
    'zh': ['UNESCO','DMZ','BTS','BBQ','OK','GAP','CGV','MEGABOX','BCHO','COEX','LED','GPS','VIP','SUV','USD','KRW','JPY','EUR','RMB','HKD','AtoC','Korea','GetYourGuide','Stripe','Klook','Trip','Petite','France','Coex','POPMART','Adora','HICO','MICE','BIFF','UN','LOCODE','MV','GT','POI','ATM','WiFi','Wi-Fi','Innisfree','Eatopia','Toy','Kingdom','Aquafield','Starfield','Ssamzigil'],
    'zh-TW': ['UNESCO','DMZ','BTS','BBQ','OK','GAP','CGV','MEGABOX','BCHO','COEX','LED','GPS','VIP','SUV','USD','KRW','JPY','EUR','RMB','HKD','AtoC','Korea','GetYourGuide','Stripe','Klook','Trip','Petite','France','Coex','POPMART','Adora','HICO','MICE','BIFF','UN','LOCODE','MV','GT','POI','ATM','WiFi','Wi-Fi','Innisfree','Eatopia','Toy','Kingdom','Aquafield','Starfield','Ssamzigil'],
    'es': [],  # Spanish allows Latin freely
}

def check_mixed_script(loc, poi, field, text):
    if loc == 'es':
        return  # no script-mix check for es
    # Hangul in non-ko (allowed in CJK as parenthetical glossary, but flag if dominant)
    if loc in ['ja','zh','zh-TW']:
        hangul_count = len(SCRIPT_RANGES['hangul'].findall(text))
        han_count = len(SCRIPT_RANGES['han'].findall(text))
        kana_count = len(SCRIPT_RANGES['kana'].findall(text))
        target_count = han_count + (kana_count if loc == 'ja' else 0)
        if hangul_count > 20 and target_count > 0 and hangul_count / max(target_count, 1) > 0.3:
            add(loc, poi, field, 'excess_hangul', 'minor', text,
                detail=f'hangul_count={hangul_count}, target_script={target_count}')
    # Kana in non-ja
    if loc != 'ja':
        kana_count = len(SCRIPT_RANGES['kana'].findall(text))
        if kana_count > 5:
            add(loc, poi, field, 'unexpected_kana', 'minor', text,
                detail=f'kana_count={kana_count}')
    # Excessive Latin in CJK locales (not on whitelist)
    if loc in ['ko','ja','zh','zh-TW']:
        latin_runs = re.findall(r'[A-Za-z][A-Za-z\-\']{2,}', text)
        wl = set(w.lower() for w in LATIN_WHITELIST.get(loc, []))
        wl |= AUTO_WL  # add auto-extracted brand whitelist
        # Common English food/cuisine words always OK in CJK travel content
        wl |= {'cafe','coffee','tea','market','tour','plaza','park','street','beach','bridge','mountain','tower','hotel','hall','house','center','village','garden','museum','observatory','tunnel','library','square','road','line','exit','station','express','shuttle','arrival','departure','pickup','drop','off','set','menu','course','open','close','only','optional','required','recommended','village','district','area','path','trail','cave','falls','waterfall','river','lake','rock','peak','summit','viewpoint','bus','taxi','subway','metro','express','train','korean','japanese','chinese','english','french','spanish','minutes','hour','hours','meter','meters','kilometer','kilometers','national','heritage','site','famous','popular','traditional','modern','design','art','old','new'}
        suspicious = [w for w in latin_runs if w.lower() not in wl]
        # Higher threshold: more than 8 unwhitelisted tokens
        if len(suspicious) > 8:
            add(loc, poi, field, 'excess_latin_tokens', 'minor', text,
                detail=f'unwhitelisted Latin tokens: {suspicious[:8]} (and {max(0,len(suspicious)-8)} more)')

# --- Check 11: zh vs zh-TW vocabulary inconsistency
def check_zh_pair(poi_key, zh_node, zhtw_node):
    """Compare zh and zh-TW canonical translations — only flag significant divergences."""
    zh_strings = dict(iter_strings(zh_node))
    zhtw_strings = dict(iter_strings(zhtw_node))
    for path in zh_strings.keys() & zhtw_strings.keys():
        zh_text = zh_strings[path]
        zhtw_text = zhtw_strings[path]
        if not zh_text or not zhtw_text:
            continue
        zh_converted = cc_s2t.convert(zh_text)
        if zh_converted == zhtw_text:
            continue
        # Strip whitespace + punctuation differences before comparing
        def strip_trivial(s):
            return re.sub(r'[\s —\-,.、。:：;；()（）「」『』""\'\'·]', '', s)
        zh_clean = strip_trivial(zh_converted)
        zhtw_clean = strip_trivial(zhtw_text)
        if zh_clean == zhtw_clean:
            continue  # only punctuation/spacing differs
        len_ratio = abs(len(zh_clean) - len(zhtw_clean)) / max(len(zh_clean), len(zhtw_clean), 1)
        # Only flag substantial length divergence
        if len_ratio > 0.25:
            add('zh-pair', poi_key, path, 'zh_zhtw_length_diff', 'minor',
                f'zh: {zh_converted[:80]} | zh-TW: {zhtw_text[:80]}',
                detail=f'length_ratio={len_ratio:.2f}')
            continue
        # Char-level diff (post-cleanup)
        from difflib import SequenceMatcher
        sm = SequenceMatcher(None, zh_clean, zhtw_clean)
        diffs = []
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag != 'equal':
                a = zh_clean[i1:i2]
                b = zhtw_clean[j1:j2]
                if (len(a) >= 2 or len(b) >= 2):
                    diffs.append((a, b))
        # Filter: only flag if at least 2 multi-char divergences exist (to skip trivial single-char synonyms)
        major_diffs = [(a,b) for a,b in diffs if (len(a) >= 2 and len(b) >= 2) or (len(a) >= 3 or len(b) >= 3)]
        if len(major_diffs) >= 2 and len(major_diffs) <= 20:
            add('zh-pair', poi_key, path, 'zh_zhtw_term_diff', 'minor',
                f'zh: {zh_converted[:120]} | zh-TW: {zhtw_text[:120]}',
                detail=f'diffs (zh→zh-TW): {major_diffs[:5]}')

# --- Run all checks
print()
print("Running Tier 1 checks...")

for loc in LOCALES:
    for poi_key, fields in trans[loc].items():
        en_fields = en_by_key.get(poi_key, {})
        for path, text in iter_strings(fields):
            field_root = path.split('.')[0].split('[')[0]
            if not isinstance(text, str):
                continue
            check_markdown(loc, poi_key, path, text)
            check_system_leak(loc, poi_key, path, text)
            # Compare with EN: walk EN structure to find matching path
            en_text = None
            try:
                node = en_fields
                # Resolve path through dict/list
                tokens = re.findall(r'[^.\[\]]+|\[\d+\]', path)
                for tok in tokens:
                    if tok.startswith('['):
                        idx = int(tok[1:-1])
                        if isinstance(node, list) and idx < len(node):
                            node = node[idx]
                        else:
                            node = None; break
                    else:
                        if isinstance(node, dict):
                            node = node.get(tok)
                        else:
                            node = None; break
                if isinstance(node, str):
                    en_text = node
            except Exception:
                en_text = None
            if en_text:
                check_numbers(loc, poi_key, path, en_text, text)
                check_glossary(loc, poi_key, path, en_text, text)
            check_mixed_script(loc, poi_key, path, text)

# zh-pair checks
for poi_key in trans.get('zh', {}):
    if poi_key in trans.get('zh-TW', {}):
        check_zh_pair(poi_key, trans['zh'][poi_key], trans['zh-TW'][poi_key])

# Output
out_path = os.path.join(WORK, 'qa-tier1-findings.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(findings, f, ensure_ascii=False, indent=2)

# Summary
print(f"\nTotal findings: {len(findings)}")
print(f"\n=== By locale × type ===")
counts = defaultdict(lambda: defaultdict(int))
for f in findings:
    counts[f['locale']][f['issue_type']] += 1

types = sorted({f['issue_type'] for f in findings})
locales = ['ko','ja','zh','zh-TW','es','zh-pair']
header = f"{'issue_type':<32} " + ' '.join(f'{l:>8}' for l in locales)
print(header)
print('-' * len(header))
for t in types:
    row = f"{t:<32} " + ' '.join(f'{counts[l].get(t,0):>8}' for l in locales)
    print(row)

print(f"\n=== Severity ===")
sev = defaultdict(int)
for f in findings: sev[f['severity']] += 1
for s in ['critical','major','minor']:
    print(f"  {s}: {sev[s]}")

print(f"\nWritten: {out_path}")
