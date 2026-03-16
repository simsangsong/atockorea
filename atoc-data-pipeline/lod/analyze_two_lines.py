"""Analyze 325540-325550 and 329080-329090 (10-line blocks) for common pattern."""
import os
path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "visitkorea.nt")

def block(start, end):
    out = []
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for i, line in enumerate(f):
            num = i + 1
            if num < start:
                continue
            if num > end:
                break
            out.append((num, len(line), line))
    return out

for name, start, end in [("325540-325550", 325540, 325550), ("329080-329090", 329080, 329090)]:
    print("=== block", name, "===")
    for num, L, line in block(start, end):
        has_label = "rdf-schema#label" in line
        backslash_u = line.count("\\u")
        pred = "label" if "rdf-schema#label" in line else ("sameAs" if "owl#sameAs" in line else "other")
        print(num, "len=%d" % L, "pred=%s" % pred, "\\\\u=%d" % backslash_u, "|", repr(line[:100]))
    print()
