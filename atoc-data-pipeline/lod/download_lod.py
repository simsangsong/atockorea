"""
국문관광정보 LOD 데이터셋 다운로드 시도.
공공데이터포털은 로그인/활용신청이 필요해 자동 다운로드가 불가할 수 있음.
이 경우 README 안내대로 수동 다운로드 후 raw/ 폴더에 넣어 두세요.
"""

import os
import sys
import zipfile
import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(SCRIPT_DIR, "raw")
DATA_GO_KR_FILE = "https://www.data.go.kr/data/15043617/fileData.do"


def main() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    print(f"[LOD] raw 디렉터리: {RAW_DIR}")

    # 이미 raw/ 안에 .nt 또는 .zip 있으면 사용
    for name in os.listdir(RAW_DIR):
        if name.endswith(".nt"):
            print(f"  → NT 파일 발견: {name}")
            return
        if name.endswith(".zip"):
            zpath = os.path.join(RAW_DIR, name)
            print(f"  → ZIP 발견: {name}, 압축 해제 시도...")
            try:
                with zipfile.ZipFile(zpath, "r") as z:
                    z.extractall(RAW_DIR)
                print("  → 압축 해제 완료. raw/ 내 .nt 파일을 lod_to_places.py --input raw/ 로 지정하세요.")
            except Exception as e:
                print(f"  → 압축 해제 실패: {e}")
            return

    # 자동 다운로드 시도 (공공데이터포털은 보통 인증 필요로 실패할 수 있음)
    print("[LOD] 자동 다운로드 시도 (실패 시 수동 다운로드 필요)...")
    try:
        r = requests.get(DATA_GO_KR_FILE, timeout=30)
        if r.status_code == 200 and len(r.content) > 1000:
            out = os.path.join(RAW_DIR, "lod_15043617.html")
            with open(out, "wb") as f:
                f.write(r.content)
            print(f"  → 페이지 저장됨 (다운로드 링크는 로그인 후 해당 페이지에서): {out}")
        else:
            print("  → 직접 다운로드 필요 (상태코드 또는 본문 없음)")
    except Exception as e:
        print(f"  → 요청 실패: {e}")

    print("\n[수동 다운로드 안내]")
    print("  1. https://www.data.go.kr/data/15043617/fileData.do 접속")
    print("  2. 로그인 후 활용신청(이미 했다면 생략)")
    print("  3. 파일데이터 탭에서 NT/ZIP 다운로드")
    print(f"  4. 다운로드한 파일을 아래 폴더에 넣기: {RAW_DIR}")
    print("  5. python lod_to_places.py --input raw/ 실행")


if __name__ == "__main__":
    main()
    sys.exit(0)
