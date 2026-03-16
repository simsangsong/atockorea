"""
visitkorea.nt 대용량 파일 분석 (rdflib 미사용, open + 줄 단위 파싱).
- 상위 1000줄 → sample.nt 저장
- 전체 파일에서 모든 Predicate(속성 URI) 중복 없이 추출 및 개수
- 특정 관광지 1개 샘플의 모든 정보 출력
"""

import os
from collections import defaultdict

INPUT_NT = r"C:\Users\sangsong\Downloads\visitkorea.nt"
SAMPLE_NT = os.path.join(os.path.dirname(__file__), "sample.nt")


def parse_nt_line(line: str) -> tuple[str | None, str | None, str | None]:
    """NT 한 줄 파싱. (주제, 속성, 값) 또는 None. 토큰: <uri> 또는 "literal"."""
    line = line.strip()
    if not line or line.startswith("#"):
        return None, None, None
    if not line.endswith(" ."):
        return None, None, None
    line = line[:-2].strip()
    parts = []
    i = 0
    while i < len(line):
        if line[i] == "<":
            end = line.index(">", i + 1)
            if end == -1:
                break
            parts.append(line[i : end + 1])
            i = end + 1
            continue
        if line[i] == '"':
            i += 1
            cur = []
            while i < len(line):
                if line[i] == "\\" and i + 1 < len(line):
                    cur.append(line[i + 1])
                    i += 2
                    continue
                if line[i] == '"':
                    i += 1
                    break
                cur.append(line[i])
                i += 1
            parts.append('"' + "".join(cur) + '"')
            continue
        i += 1
    if len(parts) >= 3:
        return parts[0], parts[1], parts[2]
    return None, None, None


def main() -> None:
    if not os.path.isfile(INPUT_NT):
        print(f"[오류] 파일 없음: {INPUT_NT}")
        return

    predicates: set[str] = set()
    by_subject: dict[str, list[tuple[str, str]]] = defaultdict(list)
    first_1000_lines: list[str] = []
    line_count = 0

    print(f"[1] 읽는 중: {INPUT_NT}")
    with open(INPUT_NT, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line_count += 1
            if line_count <= 1000:
                first_1000_lines.append(line)
            sub, pred, obj = parse_nt_line(line)
            if sub is None or pred is None or obj is None:
                continue
            pred_uri = pred[1:-1] if pred.startswith("<") and pred.endswith(">") else pred
            predicates.add(pred_uri)
            by_subject[sub].append((pred_uri, obj))

    # (1) 상위 1000줄 → sample.nt
    os.makedirs(os.path.dirname(SAMPLE_NT) or ".", exist_ok=True)
    with open(SAMPLE_NT, "w", encoding="utf-8") as out:
        for ln in first_1000_lines:
            out.write(ln)
    print(f"  → 상위 1000줄 저장: {SAMPLE_NT}")

    # (2) Predicate 개수
    print(f"\n[2] 전체 사용된 Predicate(속성 URI) 개수: {len(predicates)}")
    for p in sorted(predicates):
        print(f"  - {p}")

    # (3) 관광지 하나 샘플: 트리플 수가 많은 주제 하나 선택 (관광지일 가능성 높음)
    if not by_subject:
        print("\n[3] 파싱된 주제 없음.")
        return
    sample_subject = max(by_subject.keys(), key=lambda s: len(by_subject[s]))
    triples = by_subject[sample_subject]
    print(f"\n[3] 샘플 관광지 1개 (트리플 수 최대 주제): {sample_subject}")
    print(f"    트리플 수: {len(triples)}")
    print("    ---")
    for pred_uri, obj in triples:
        obj_display = obj[:80] + "..." if len(obj) > 80 else obj
        print(f"    {pred_uri}")
        print(f"      → {obj_display}")
    print(f"    총 {len(triples)}개 속성")

    print(f"\n[요약] 전체 처리 줄 수: {line_count}, 고유 주제 수: {len(by_subject)}")


if __name__ == "__main__":
    main()
