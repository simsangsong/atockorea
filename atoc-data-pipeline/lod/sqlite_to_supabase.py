"""
LOD ETL 결과(SQLite places.db) → Supabase places 테이블 적재.
- content_id → id, latitude→mapy, longitude→mapx, lang_type='ko', source_origin='lod'
- 임베딩 생성 후 upsert (data_pipeline.create_embeddings, upsert_to_supabase 재사용)
"""

import os
import sys
import sqlite3

import pandas as pd

# 환경 변수 로드 (atoc-data-pipeline/.env 또는 프로젝트 루트 .env.local)
for _env in (os.path.join(os.path.dirname(__file__), "..", ".env"), os.path.join(os.path.dirname(__file__), "..", "..", ".env.local")):
    if os.path.isfile(_env):
        try:
            from dotenv import load_dotenv
            load_dotenv(_env)
            break
        except ImportError:
            pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_DIR = os.path.dirname(SCRIPT_DIR)
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)

PLACES_DB = os.path.join(SCRIPT_DIR, "places.db")


def main() -> None:
    if not os.path.isfile(PLACES_DB):
        print(f"[오류] SQLite DB 없음. 먼저 etl_process.py 로 places.db 를 생성하세요: {PLACES_DB}")
        sys.exit(1)

    conn = sqlite3.connect(PLACES_DB)
    cur = conn.execute("PRAGMA table_info(places)")
    cols = [row[1] for row in cur.fetchall()]
    base_cols = "content_id, title, category, address, tel, open_time, use_fee, overview, latitude, longitude"
    if "h3_res7" in cols and "h3_res9" in cols:
        base_cols += ", h3_res7, h3_res9"
    df = pd.read_sql_query(f"SELECT {base_cols} FROM places", conn)
    conn.close()

    if df.empty:
        print("  적재할 행 없음.")
        sys.exit(0)

    # Supabase places 스키마에 맞게 매핑
    df = df.rename(columns={
        "content_id": "id",
        "latitude": "mapy",
        "longitude": "mapx",
    })
    df["lang_type"] = "ko"
    df["source_origin"] = "lod"
    df["image_url"] = None
    df["mapx"] = df["mapx"].fillna(0.0).astype(float)
    df["mapy"] = df["mapy"].fillna(0.0).astype(float)
    df["overview"] = df["overview"].fillna("").astype(str)
    df["title"] = df["title"].fillna("").astype(str)
    df["address"] = df["address"].fillna("").astype(str)
    # 필수값 없는 행 제거
    df = df[(df["title"] != "") & (df["address"] != "")]
    df["overview"] = df["overview"].replace("", "정보 준비 중입니다.")
    if "tel" in df.columns:
        df["tel"] = df["tel"].fillna("").astype(str).replace("", None)
    if "open_time" in df.columns:
        df["open_time"] = df["open_time"].fillna("").astype(str).replace("", None)
    if "use_fee" in df.columns:
        df["use_fee"] = df["use_fee"].fillna("").astype(str).replace("", None)

    print(f"[LOD→Supabase] 적재 대상: {len(df)}건 (source_origin=lod)")

    import data_pipeline as dp
    df = dp.clean_places(df)
    if df.empty:
        print("  정제 후 0건.")
        sys.exit(0)
    df = dp.create_embeddings(df)
    dp.upsert_to_supabase(df)
    print("  Supabase 적재 완료.")


if __name__ == "__main__":
    main()
