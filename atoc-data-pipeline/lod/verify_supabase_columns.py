"""
Supabase places 테이블에 LOD 업로드 후 컬럼 확인.
- source_origin='lod' 인 행 1건 조회해 모든 컬럼 이름과 샘플 값 출력.

실행: lod 폴더에서 python verify_supabase_columns.py
환경 변수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
"""

import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 환경 변수 로드 (상위 .env.local 등)
try:
    from dotenv import load_dotenv
    for _ in [SCRIPT_DIR, os.path.dirname(SCRIPT_DIR), os.path.join(os.path.dirname(SCRIPT_DIR), "..")]:
        load_dotenv(os.path.join(_, ".env"))
        load_dotenv(os.path.join(_, ".env.local"))
except Exception:
    pass
PIPELINE_DIR = os.path.dirname(SCRIPT_DIR)
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)

# data_pipeline에서 create_client 사용
def main() -> None:
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        print("[오류] NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 설정 필요")
        sys.exit(1)

    from supabase import create_client
    client = create_client(url, key)

    r = client.table("places").select("*").eq("source_origin", "lod").limit(1).execute()
    rows = (r.data or []) if hasattr(r, "data") else []
    if not rows:
        print("[확인] source_origin='lod' 인 행이 없습니다. sqlite_to_supabase.py 를 먼저 실행하세요.")
        sys.exit(0)

    row = rows[0]
    print("[Supabase places] LOD 행 1건 컬럼 확인")
    print("-" * 50)
    expected = [
        "id", "lang_type", "title", "address", "image_url",
        "mapx", "mapy", "overview", "open_time", "use_fee", "tel",
        "category", "source_origin", "embedding"
    ]
    for col in expected:
        val = row.get(col)
        if val is None:
            display = "NULL"
        elif col == "embedding" and isinstance(val, list):
            display = f"<vector len={len(val)}>"
        elif isinstance(val, str) and len(val) > 60:
            display = val[:60] + "..."
        else:
            display = val
        status = "OK" if col in row else "MISSING"
        print(f"  {col}: {status}  -> {display}")
    print("-" * 50)
    all_keys = sorted(row.keys())
    print(f"실제 컬럼 수: {len(all_keys)}")
    missing = [c for c in expected if c not in row]
    if missing:
        print(f"누락된 항목: {missing}")
    else:
        print("필수 컬럼 모두 존재합니다.")


if __name__ == "__main__":
    main()
