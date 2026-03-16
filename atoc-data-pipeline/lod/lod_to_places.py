"""
국문관광정보 LOD (NT) 파싱 → places 스키마 매핑 → 정제 → (선택) 임베딩·DB 적재.
샘플: --sample 시 sample_lod.nt 로 파서·정제만 검증.
"""

import argparse
import os
import re
import sys
from collections import defaultdict
from typing import Any

import pandas as pd

# 상위 디렉터리에서 data_pipeline import (정제·임베딩·Supabase 재사용)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_DIR = os.path.dirname(SCRIPT_DIR)
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)

# LOD predicate → places 컬럼 매핑 (실제 LOD 데이터 확인 후 URI 수정)
PREDICATE_MAP = {
    "http://www.w3.org/2000/01/rdf-schema#label": "title",
    "http://schema.org/name": "title",
    "http://schema.org/address": "address",
    "http://www.w3.org/2003/01/geo/wgs84_pos#lat": "mapy",   # 위도 → mapy
    "http://www.w3.org/2003/01/geo/wgs84_pos#long": "mapx",  # 경도 → mapx
    "http://schema.org/description": "overview",
    "http://schema.org/image": "image_url",
    "http://xmlns.com/foaf/0.1/depiction": "image_url",
}
# contentid 추출용 URI 패턴 (예: .../place/125405 → 125405)
ID_PATTERN = re.compile(r"/(\d+)\s*$|#(\d+)\s*$|contentid=(\d+)", re.I)


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


def extract_id_from_uri(uri: str) -> int | None:
    """URI에서 숫자 ID 추출 (예: .../place/125405 → 125405)."""
    uri = _strip_angle(uri) or uri.strip()
    m = ID_PATTERN.search(uri)
    if m:
        for g in m.groups():
            if g is not None:
                return int(g)
    # 마지막 경로 세그먼트가 숫자면 사용
    parts = uri.replace(">", "").split("/")
    for p in reversed(parts):
        if p.isdigit():
            return int(p)
    return None


def _strip_angle(s: str) -> str:
    s = (s or "").strip()
    if s.startswith("<") and s.endswith(">"):
        return s[1:-1]
    return s


def load_nt(path: str) -> dict[str, dict[str, Any]]:
    """NT 파일을 읽어 리소스별 속성 딕셔너리로 반환. key=주제 URI."""
    resources: dict[str, dict[str, Any]] = defaultdict(dict)
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            sub, pred, obj = parse_nt_line(line)
            if sub is None or pred is None or obj is None:
                continue
            pred_uri = _strip_angle(pred)
            col = PREDICATE_MAP.get(pred_uri)
            if col is None:
                continue
            if obj.startswith('"') and obj.endswith('"'):
                obj = obj[1:-1].replace('\\"', '"').strip()
            else:
                obj = obj.strip().strip("<>")
            if col in ("mapx", "mapy"):
                try:
                    resources[sub][col] = float(obj)
                except (ValueError, TypeError):
                    resources[sub][col] = 0.0
            else:
                resources[sub][col] = obj
    return dict(resources)


def resources_to_dataframe(resources: dict[str, dict[str, Any]], lang_type: str = "ko") -> pd.DataFrame:
    """리소스 딕셔너리 → places 스키마 DataFrame."""
    rows = []
    for uri, attrs in resources.items():
        place_id = extract_id_from_uri(uri)
        if place_id is None:
            continue
        row = {
            "id": place_id,
            "lang_type": lang_type,
            "title": attrs.get("title", ""),
            "address": attrs.get("address", ""),
            "mapx": float(attrs.get("mapx", 0) or 0),
            "mapy": float(attrs.get("mapy", 0) or 0),
            "overview": attrs.get("overview", ""),
            "image_url": attrs.get("image_url", ""),
        }
        rows.append(row)
    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="LOD NT → places 정제·적재")
    parser.add_argument("--sample", action="store_true", help="sample_lod.nt 로 파서·정제만 검증 (DB 미적재)")
    parser.add_argument("--input", type=str, default="", help="NT 파일 경로 또는 raw/ 디렉터리")
    parser.add_argument("--limit", type=int, default=0, help="처리 건수 제한 (0=전체)")
    parser.add_argument("--dry-run", action="store_true", help="DB 업서트 생략, 정제까지만")
    args = parser.parse_args()

    if args.sample:
        nt_path = os.path.join(SCRIPT_DIR, "sample_lod.nt")
        if not os.path.isfile(nt_path):
            print(f"[오류] 샘플 파일 없음: {nt_path}")
            sys.exit(1)
        print(f"[샘플] {nt_path} 로 파서·매핑·정제 검증 (DB 미적재)\n")
        resources = load_nt(nt_path)
        print(f"  파싱된 리소스 수: {len(resources)}")
        df = resources_to_dataframe(resources)
        if df.empty:
            print("  [경고] 매핑된 행 없음. PREDICATE_MAP 또는 NT 형식 확인.")
            sys.exit(0)
        # 정제 (간단 버전: 필수값·좌표·기본값)
        df["title"] = df["title"].astype(str).str.strip()
        df["address"] = df["address"].astype(str).str.strip()
        df["overview"] = df["overview"].astype(str).str.strip()
        df["image_url"] = df["image_url"].astype(str).str.strip()
        df = df[(df["title"] != "") & (df["address"] != "")]
        df["overview"] = df["overview"].replace("", "정보 준비 중입니다.")
        df["image_url"] = df["image_url"].replace("", None)
        print(f"  정제 후 건수: {len(df)}")
        print("\n  샘플 행 (처음 2건):")
        print(df.head(2).to_string())
        print("\n  샘플 검증 완료. 전체 실행 시: python lod_to_places.py --input raw/")
        return

    # 전체/실제 파일 처리
    input_path = (args.input or "").strip()
    if not input_path:
        print("[오류] --input 경로 필요. 예: --input raw/ 또는 --input raw/국문관광정보.nt")
        sys.exit(1)
    if not os.path.exists(input_path):
        print(f"[오류] 경로 없음: {input_path}")
        sys.exit(1)

    nt_files = []
    if os.path.isfile(input_path) and input_path.endswith(".nt"):
        nt_files.append(input_path)
    elif os.path.isdir(input_path):
        for name in os.listdir(input_path):
            if name.endswith(".nt"):
                nt_files.append(os.path.join(input_path, name))
    if not nt_files:
        print(f"[오류] NT 파일 없음: {input_path}")
        sys.exit(1)

    all_dfs = []
    for nt_path in nt_files:
        print(f"[LOD] 로드: {nt_path}")
        resources = load_nt(nt_path)
        df = resources_to_dataframe(resources)
        all_dfs.append(df)
    df = pd.concat(all_dfs, ignore_index=True)
    if df.empty:
        print("  매핑된 행 없음.")
        sys.exit(0)
    df = df.drop_duplicates(subset=["id"], keep="first").reset_index(drop=True)
    print(f"  리소스 → 행: {len(df)}건 (중복 제거 후)")

    if args.limit > 0:
        df = df.head(args.limit)
        print(f"  --limit 적용: {len(df)}건")

    # data_pipeline 정제·임베딩·적재 재사용
    import data_pipeline as dp
    df = dp.clean_places(df)
    if df.empty:
        print("  정제 후 0건.")
        sys.exit(0)
    if not args.dry_run:
        df = dp.create_embeddings(df)
        dp.upsert_to_supabase(df)
        print("  DB 적재 완료.")
    else:
        print("  [dry-run] 정제까지 완료. DB 미적재.")


if __name__ == "__main__":
    main()
