"""Re-merge all combined translation maps into 30 tour files × 5 locales."""
import os, json

base = r'C:\Users\sangsong\atockorea'
work_dir = os.path.join(base, 'scripts', 'translate', 'work')
tour_dir = os.path.join(base, 'components', 'product-tour-static')

LOCALES = ['ko','ja','zh','zh-TW','es']
GAP_FIELDS = ['description','whyOnRoute','convenience','smartNotes','visitBasics','highlights','transitNote']

def stop_key(stop):
    if not isinstance(stop, dict): return None
    meta = stop.get('_poi_meta') or {}
    if isinstance(meta, dict):
        pk = meta.get('poi_key')
        if pk: return f'poi:{pk}'
    name = stop.get('name','').strip().lower()
    return f'name:{name}' if name else None

def flat(node):
    if isinstance(node,str): return [node]
    if isinstance(node,dict): return [s for v in node.values() for s in flat(v)]
    if isinstance(node,list): return [s for v in node for s in flat(v)]
    return []

def stop_size(s):
    if not isinstance(s,dict): return 0
    return sum(len(x) for f in GAP_FIELDS for x in flat(s.get(f) if s.get(f) is not None else []))

def itin_size(d):
    t = 0
    for s in d.get('itineraryStops',[]): t += stop_size(s)
    for v in d.get('itinerary_variants',[]):
        if isinstance(v,dict):
            for s in v.get('stops',[]): t += stop_size(s)
    return t

trans = {}
for loc in LOCALES:
    p = os.path.join(work_dir, f'{loc}-translations-combined.json')
    with open(p,'r',encoding='utf-8') as f: trans[loc] = json.load(f)
    print(f"{loc}: {len(trans[loc])} POIs in combined map")

bad_files = []

def apply_to_stop(s, tm, counter):
    k = stop_key(s)
    if k not in tm: return
    for fname, fval in tm[k].items():
        s[fname] = fval
    counter[0] += 1

for loc in LOCALES:
    tm = trans[loc]
    total_p = 0
    n_files = 0
    for tour in sorted(os.listdir(tour_dir)):
        tdir = os.path.join(tour_dir, tour)
        if not os.path.isdir(tdir): continue
        loc_path = os.path.join(tdir, f'{tour}.{loc}.json')
        bak = loc_path + '.bak'
        if not os.path.exists(loc_path) or not os.path.exists(bak): continue
        with open(bak,'r',encoding='utf-8') as f: doc = json.load(f)
        counter = [0]
        for s in doc.get('itineraryStops',[]): apply_to_stop(s, tm, counter)
        for v in doc.get('itinerary_variants',[]):
            if isinstance(v,dict):
                for s in v.get('stops',[]): apply_to_stop(s, tm, counter)
        with open(loc_path,'w',encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        try:
            with open(loc_path,'r',encoding='utf-8') as f: json.load(f)
        except Exception as e:
            bad_files.append((loc_path, str(e)))
        total_p += counter[0]
        n_files += 1
    print(f"[{loc}] {n_files} files, {total_p} stop patches")

if bad_files:
    print("\nBAD FILES:")
    for p, err in bad_files: print(f"  {p}: {err}")
else:
    print("\nAll JSON valid.")

totals = {l:0 for l in ['en','ko','ja','zh','zh-TW','es']}
for tour in sorted(os.listdir(tour_dir)):
    tdir = os.path.join(tour_dir, tour)
    if not os.path.isdir(tdir): continue
    for loc in totals:
        p = os.path.join(tdir, f'{tour}.{loc}.json')
        if not os.path.exists(p): continue
        with open(p,'r',encoding='utf-8') as f: d = json.load(f)
        totals[loc] += itin_size(d)
print("\n=== Final itinerary char totals ===")
for loc in totals:
    pct = totals[loc]/totals['en']*100 if totals['en'] else 0
    print(f"  {loc:>6}: {totals[loc]:>9,}  ({pct:>4.0f}% of EN)")
