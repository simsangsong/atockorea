"""Extract specific line ranges from visitkorea.nt for ETL analysis."""
import os

path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "visitkorea.nt")
ranges = [(276595, 276610), (325540, 325550), (329080, 329090)]

with open(path, "r", encoding="utf-8", errors="replace") as f:
    for i, line in enumerate(f, 1):
        for (lo, hi) in ranges:
            if lo <= i <= hi:
                b = len(line.encode("utf-8"))
                print(f"--- line {i} (len={len(line)}, bytes={b}) ---")
                if len(line) > 600:
                    print(repr(line[:600]) + "...")
                else:
                    print(repr(line))
                print()
                break
        if i > 329095:
            break
