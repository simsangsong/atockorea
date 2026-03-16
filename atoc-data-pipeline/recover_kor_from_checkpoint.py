"""
체크포인트에서 국문(KorService2) 수집 내용을 복구하여 KorService2.json 으로 저장.
사용법: python recover_kor_from_checkpoint.py
"""
import json
import os

_script_dir = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(_script_dir, "output")
CHECKPOINT_PATH = os.path.join(OUTPUT_DIR, "checkpoint_KorService2.json")
OUT_PATH = os.path.join(OUTPUT_DIR, "KorService2.json")


def main() -> None:
    if not os.path.isfile(CHECKPOINT_PATH):
        print(f"체크포인트 없음: {CHECKPOINT_PATH}")
        return
    with open(CHECKPOINT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    lang_rows = data.get("lang_rows") or []
    stopped = data.get("stopped_at") or {}
    updated = stopped.get("updated_at", "")
    print(f"체크포인트 저장 시각: {updated}")
    print(f"lang_rows 건수: {len(lang_rows)}")
    if not lang_rows:
        print("복구할 데이터 없음.")
        return
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(lang_rows, f, ensure_ascii=False, indent=2)
    print(f"  → 복구 저장: {OUT_PATH} ({len(lang_rows)}건)")


if __name__ == "__main__":
    main()
