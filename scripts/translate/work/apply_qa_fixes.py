"""Apply Tier 2 QA fixes to combined translation maps."""
import json, os, re, shutil
from collections import defaultdict

work = r'C:\Users\sangsong\atockorea\scripts\translate\work'
LOCALES = ['ko','ja','zh','zh-TW','es']

# Load combined maps & back them up
maps = {}
for loc in LOCALES:
    p = os.path.join(work, f'{loc}-translations-combined.json')
    bak = p + '.preqa'
    if not os.path.exists(bak):
        shutil.copy2(p, bak)
    with open(p, 'r', encoding='utf-8') as f:
        maps[loc] = json.load(f)

def get_at(node, path):
    tokens = re.findall(r'[^.\[\]]+|\[\d+\]', path)
    cur = node
    for tok in tokens:
        if tok.startswith('['):
            idx = int(tok[1:-1])
            if isinstance(cur, list) and idx < len(cur):
                cur = cur[idx]
            else: return None
        else:
            if isinstance(cur, dict):
                cur = cur.get(tok)
            else: return None
    return cur

def set_at(node, path, value):
    tokens = re.findall(r'[^.\[\]]+|\[\d+\]', path)
    cur = node
    for tok in tokens[:-1]:
        if tok.startswith('['):
            cur = cur[int(tok[1:-1])]
        else:
            cur = cur[tok]
    last = tokens[-1]
    if last.startswith('['):
        cur[int(last[1:-1])] = value
    else:
        cur[last] = value

stats = defaultdict(lambda: defaultdict(int))

def apply_fix(loc, poi_key, field, original_snippet, suggested):
    if poi_key not in maps[loc]:
        stats[loc]['poi_missing'] += 1
        return False
    fields = maps[loc][poi_key]
    text = get_at(fields, field)
    if not isinstance(text, str):
        stats[loc]['field_not_string'] += 1
        return False
    if not original_snippet or not suggested:
        stats[loc]['no_input'] += 1
        return False
    if original_snippet in text:
        new_text = text.replace(original_snippet, suggested, 1)
        set_at(fields, field, new_text)
        stats[loc]['applied_full_snippet'] += 1
        return True
    if len(suggested) > len(text) * 0.8:
        set_at(fields, field, suggested)
        stats[loc]['applied_full_replace'] += 1
        return True
    stats[loc]['skipped_unmatched'] += 1
    return False

def regex_replace_in_map(loc, pattern, replacement, label):
    cnt = 0
    rx = re.compile(pattern)
    def walk(node):
        nonlocal cnt
        if isinstance(node, dict):
            for k in list(node.keys()):
                v = node[k]
                if isinstance(v, str):
                    new = rx.sub(replacement, v)
                    if new != v:
                        node[k] = new
                        cnt += 1
                else:
                    walk(v)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                if isinstance(v, str):
                    new = rx.sub(replacement, v)
                    if new != v:
                        node[i] = new
                        cnt += 1
                else:
                    walk(v)
    walk(maps[loc])
    if cnt:
        stats[loc][label] += cnt
        print(f"[{loc}] {label}: {cnt}")

# Mechanical safe fixes
regex_replace_in_map('zh', r'步行强度', '步行难度', 'walking_intensity_fix')
regex_replace_in_map('zh', r'强度(?=\s*[\(（中等高低易难轻重])', '难度', 'walking_intensity_word')
regex_replace_in_map('zh', r'包括', '包含', 'baokuo_to_baohan')
regex_replace_in_map('zh-TW', r'步行強度', '步行難度', 'walking_intensity_fix')
regex_replace_in_map('zh-TW', r'強度(?=\s*[\(（中等高低易難輕重])', '難度', 'walking_intensity_word')
regex_replace_in_map('ja', r'新興寺', '神興寺', 'sinheungsa_proper_noun')
regex_replace_in_map('es', r'\bDrop-offs\b', 'Bajadas', 'drop_off_es')
regex_replace_in_map('es', r'\bDrop-off\b', 'Bajada', 'drop_off_es')
regex_replace_in_map('es', r'\bdrop-offs\b', 'bajadas', 'drop_off_es')
regex_replace_in_map('es', r'\bdrop-off\b', 'bajada', 'drop_off_es')
regex_replace_in_map('zh', r'韩国旅游发展局', '韩国旅游公社', 'kto_name_zh')
regex_replace_in_map('zh-TW', r'韓國旅遊發展局', '韓國旅遊公社', 'kto_name_zhtw')
regex_replace_in_map('zh-TW', r'龍麻路', '龍馬路', 'yongmaru_fix')
regex_replace_in_map('zh-TW', r'明聖山', '鳴聲山', 'myeongseongsan_fix')
regex_replace_in_map('zh-TW', r'應太石', '應胎石', 'eungtaeseok_fix')
regex_replace_in_map('zh-TW', r'藥膏紫菜飯捲', '麻藥紫菜飯捲', 'mayak_fix')

# Per-finding suggested_fix
def process_locale(loc):
    p = os.path.join(work, f'qa-tier2-{loc}-findings.json')
    if not os.path.exists(p): return
    with open(p, 'r', encoding='utf-8') as f:
        data = json.load(f)
    items_t1 = data.get('tier1_validation', [])
    items_t2 = data.get('tier2_native_tone', [])
    for it in items_t1:
        verdict = (it.get('verdict') or '').upper()
        sug = it.get('suggested_fix')
        if not sug or not isinstance(sug, str): continue
        if not verdict.startswith('TP') and verdict != 'CONFIRM': continue
        poi = it.get('poi_key'); field = it.get('field')
        if not poi or not field: continue
        apply_fix(loc, poi, field, it.get('snippet') or '', sug)
    for it in items_t2:
        sev = (it.get('severity') or '').lower()
        sug = it.get('suggested_fix')
        if not sug or not isinstance(sug, str): continue
        if sev not in ('critical','major'): continue
        poi = it.get('poi_key'); field = it.get('field')
        if not poi or not field: continue
        apply_fix(loc, poi, field, it.get('snippet') or '', sug)

for loc in LOCALES:
    process_locale(loc)

# zh-pair handling
zhp = os.path.join(work, 'qa-tier2-zh-pair-findings.json')
if os.path.exists(zhp):
    with open(zhp, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for it in data.get('items', []):
        v = (it.get('verdict') or '').upper()
        poi = it.get('poi_key'); field = it.get('field')
        if v in ('DRIFT_ZH','GLOSSARY_VIOLATION','FACTUAL_DIVERGENCE','LENGTH_OMISSION'):
            sug = it.get('suggested_zh_fix')
            if sug and poi and field:
                apply_fix('zh', poi, field, it.get('zh_snippet','') or '', sug)
        if v in ('DRIFT_ZHTW','GLOSSARY_VIOLATION','FACTUAL_DIVERGENCE','LENGTH_OMISSION'):
            sug = it.get('suggested_zhtw_fix')
            if sug and poi and field:
                apply_fix('zh-TW', poi, field, it.get('zhtw_snippet','') or '', sug)

for loc in LOCALES:
    p = os.path.join(work, f'{loc}-translations-combined.json')
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(maps[loc], f, ensure_ascii=False, indent=2)

print()
print("=== Fix stats ===")
for loc in LOCALES:
    if loc not in stats: continue
    print(f"[{loc}]")
    for k, v in sorted(stats[loc].items()):
        print(f"  {k}: {v}")
