"""
LOD 국문(SQLite places.db) → 언어별 번역 후 Supabase 적재.
- SQLite에서 ko 데이터 읽어서 title, overview, open_time, use_fee, address 를 Gemini로 번역
- en, ja, chs, cht 행 생성 → create_embeddings → upsert_to_supabase

요금/한도 방지:
  - 기본으로 최대 100건만 번역 (TRANSLATE_MAX_ROWS=100). 테스트 후 필요 시 상향.
  - 전부 번역하려면: TRANSLATE_MAX_ROWS=0 TRANSLATE_UNLIMITED=1 python translate_lod.py
  - 예: 1만 건 × 4언어 = 번역 약 8천 회 + 임베딩 4만 회 → Gemini 한도/요금 확인 필수.

사용법:
  1) etl_process.py 로 places.db 생성, sqlite_to_supabase.py 로 국문 업로드
  2) lod 폴더에서: python translate_lod.py
  (GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 필요.)
"""

import os
import sys
import json
import sqlite3
import time

import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_DIR = os.path.dirname(SCRIPT_DIR)
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)

PLACES_DB = os.path.join(SCRIPT_DIR, "places.db")

# 번역 대상 언어 (Supabase places.lang_type)
TARGET_LANGS = [
    ("en", "English"),
    ("ja", "Japanese"),
    ("chs", "Simplified Chinese"),
    ("cht", "Traditional Chinese"),
]

# 배치 크기: 한 번에 이 개수만큼 번역 후 API 대기
TRANSLATE_BATCH_SIZE = 5
SLEEP_BETWEEN_BATCHES = 1.5

# 기본 상한: 요금/한도 방지. 0 = 전부(TRANSLATE_UNLIMITED=1 일 때만 허용)
def _get_max_rows() -> int:
    raw = (os.getenv("TRANSLATE_MAX_ROWS") or "100").strip()
    if raw == "0":
        if os.getenv("TRANSLATE_UNLIMITED") != "1":
            return 100  # 0이어도 무제한은 명시적 허용 없으면 100으로
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 100


def get_genai_client():
    from google import genai
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise SystemExit("[오류] GEMINI_API_KEY 환경 변수를 설정하세요.")
    return genai.Client(api_key=key)


def translate_batch(client, rows_batch: list[dict], target_lang: str, target_lang_name: str) -> list[dict]:
    """한국어 행 여러 개를 한 번에 target_lang 로 번역. 반환: [{title, overview, open_time, use_fee, address}, ...]"""
    if not rows_batch:
        return []
    prompts = []
    for r in rows_batch:
        t = (r.get("title") or "").strip() or "(없음)"
        o = (r.get("overview") or "").strip()[:800] or "(없음)"
        ot = (r.get("open_time") or "").strip()[:200] or "(없음)"
        uf = (r.get("use_fee") or "").strip()[:200] or "(없음)"
        a = (r.get("address") or "").strip()[:300] or "(없음)"
        prompts.append(f"[장소]\n제목: {t}\n설명: {o}\n개폐장시간: {ot}\n이용요금: {uf}\n주소: {a}")

    combined = "\n\n---\n\n".join(prompts)
    prompt = f"""Translate the following Korean tourist place entries into {target_lang_name}.
Each entry is separated by "---". For each entry, output a single JSON object with keys: "title", "overview", "open_time", "use_fee", "address".
Return a JSON array of exactly {len(rows_batch)} objects, one per entry. No markdown, no code fence, only the JSON array.

Entries:
{combined}"""

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
                config={"max_output_tokens": 8192, "temperature": 0.2},
            )
            text = (response.text or "").strip()
            if not text:
                raise ValueError("Gemini returned empty")
            # 코드펜스 제거
            if "```" in text:
                start = text.find("[")
                end = text.rfind("]") + 1
                if start >= 0 and end > start:
                    text = text[start:end]
            arr = json.loads(text)
            if not isinstance(arr, list) or len(arr) != len(rows_batch):
                raise ValueError(f"Expected array of {len(rows_batch)}, got {len(arr) if isinstance(arr, list) else 'non-list'}")
            out = []
            for i, obj in enumerate(arr):
                if not isinstance(obj, dict):
                    obj = {}
                out.append({
                    "title": str(obj.get("title", "")).strip() or (rows_batch[i].get("title") or ""),
                    "overview": str(obj.get("overview", "")).strip() or (rows_batch[i].get("overview") or "")[:500],
                    "open_time": str(obj.get("open_time", "")).strip() or None,
                    "use_fee": str(obj.get("use_fee", "")).strip() or None,
                    "address": str(obj.get("address", "")).strip() or (rows_batch[i].get("address") or ""),
                })
            return out
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt + 1)
                continue
            print(f"  [경고] 배치 번역 실패 ({target_lang}): {e}")
            return [
                {
                    "title": (r.get("title") or ""),
                    "overview": (r.get("overview") or "")[:500],
                    "open_time": r.get("open_time"),
                    "use_fee": r.get("use_fee"),
                    "address": (r.get("address") or ""),
                }
                for r in rows_batch
            ]
    return []


def main() -> None:
    if not os.path.isfile(PLACES_DB):
        print(f"[오류] SQLite DB 없음. 먼저 etl_process.py 로 places.db 를 생성하세요: {PLACES_DB}")
        sys.exit(1)

    conn = sqlite3.connect(PLACES_DB)
    df_ko = pd.read_sql_query(
        "SELECT content_id, title, category, address, tel, open_time, use_fee, overview, latitude, longitude FROM places",
        conn,
    )
    conn.close()

    if df_ko.empty:
        print("  번역할 국문 행 없음.")
        sys.exit(0)

    # 필수값 있는 행만
    df_ko["title"] = df_ko["title"].fillna("").astype(str).str.strip()
    df_ko["address"] = df_ko["address"].fillna("").astype(str).str.strip()
    df_ko = df_ko[(df_ko["title"] != "") & (df_ko["address"] != "")]
    if df_ko.empty:
        print("  title/address 있는 행 없음.")
        sys.exit(0)

    df_ko = df_ko.rename(columns={"content_id": "id", "latitude": "mapy", "longitude": "mapx"})
    df_ko["mapx"] = pd.to_numeric(df_ko["mapx"], errors="coerce").fillna(0.0).astype(float)
    df_ko["mapy"] = pd.to_numeric(df_ko["mapy"], errors="coerce").fillna(0.0).astype(float)
    df_ko["overview"] = df_ko["overview"].fillna("").astype(str)
    df_ko.loc[df_ko["overview"] == "", "overview"] = "정보 준비 중입니다."

    max_rows = _get_max_rows()
    total_available = len(df_ko)
    if max_rows > 0 and total_available > max_rows:
        df_ko = df_ko.head(max_rows).copy()
        print(f"[LOD 번역] 상한 적용: {total_available}건 중 {max_rows}건만 번역 (TRANSLATE_MAX_ROWS 변경 또는 TRANSLATE_UNLIMITED=1 로 전부 실행)")
    elif max_rows == 0:
        print(f"[LOD 번역] TRANSLATE_UNLIMITED=1 → 전부 번역 ({total_available}건). 한도/요금 확인하세요.")

    num_rows = len(df_ko)
    num_langs = len(TARGET_LANGS)
    est_translate = ((num_rows + TRANSLATE_BATCH_SIZE - 1) // TRANSLATE_BATCH_SIZE) * num_langs
    est_embed = num_rows * num_langs
    print(f"[LOD 번역] 국문 {num_rows}건 → {', '.join(t[0] for t in TARGET_LANGS)} 번역 후 Supabase 적재 (번역 호출 약 {est_translate}회, 임베딩 약 {est_embed}회 예상)")

    client = get_genai_client()
    translated_rows: list[dict] = []

    for lang_code, lang_name in TARGET_LANGS:
        print(f"\n  [{lang_name}({lang_code})] 번역 중...")
        for start in range(0, len(df_ko), TRANSLATE_BATCH_SIZE):
            batch_df = df_ko.iloc[start : start + TRANSLATE_BATCH_SIZE]
            batch_list = batch_df.to_dict("records")
            result = translate_batch(client, batch_list, lang_code, lang_name)
            for i, r in enumerate(result):
                row_orig = batch_list[i]
                translated_rows.append({
                    "id": int(row_orig["id"]),
                    "lang_type": lang_code,
                    "title": r["title"],
                    "address": r["address"],
                    "overview": r["overview"],
                    "open_time": r.get("open_time"),
                    "use_fee": r.get("use_fee"),
                    "tel": row_orig.get("tel") if pd.notna(row_orig.get("tel")) else None,
                    "category": row_orig.get("category") if pd.notna(row_orig.get("category")) else None,
                    "mapx": float(row_orig["mapx"]),
                    "mapy": float(row_orig["mapy"]),
                    "image_url": None,
                    "source_origin": "lod",
                })
            if (start + TRANSLATE_BATCH_SIZE) % 50 == 0 or start + TRANSLATE_BATCH_SIZE >= len(df_ko):
                print(f"    진행: {min(start + TRANSLATE_BATCH_SIZE, len(df_ko))}/{len(df_ko)}")
            time.sleep(SLEEP_BETWEEN_BATCHES)

    df = pd.DataFrame(translated_rows)
    if df.empty:
        print("  번역 결과 없음.")
        sys.exit(0)

    print(f"\n  번역 완료: {len(df)}건 (언어별 {len(df_ko)}건)")

    # data_pipeline: 임베딩 생성 후 Supabase upsert (LANG_FILTER로 언어 제한)
    import data_pipeline as dp
    df = dp.create_embeddings(df)
    dp.upsert_to_supabase(df)
    print("  Supabase 적재 완료.")


if __name__ == "__main__":
    main()
