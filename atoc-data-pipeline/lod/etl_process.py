"""
국문 관광정보 LOD(.nt) → SQLite places.db ETL
대용량 파일을 한 줄씩 읽어 파싱 후 배치 삽입. rdflib 미사용.
"""

import re
import sqlite3
import os
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import threading
import queue

try:
    import h3
except ImportError:
    h3 = None  # pip install h3

INPUT_NT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "visitkorea.nt")
OUTPUT_DB = os.path.join(os.path.dirname(__file__), "places.db")
PROGRESS_FILE = os.path.join(os.path.dirname(__file__), "etl_progress.txt")
SKIPPED_LINES_LOG = os.path.join(os.path.dirname(__file__), "etl_skipped_lines.log")
ERROR_LOG = os.path.join(os.path.dirname(__file__), "etl_error_log.txt")  # 무적 인제스천: 줄별 실패 원인 상세 기록
LINE_TIMEOUT_SEC = 2.0  # 리딩/파싱/어떤 상태든 이 시간 초과 시 해당 줄만 스킵
LOG_PROGRESS_EVERY = 1000  # N줄마다 상세 진행 로그

# 한 줄이 이 길이를 넘으면 읽기 타임아웃 후 건너뜀 (새줄 없는 거대 라인)
MAX_LINE_BYTES = 2 * 1024 * 1024  # 2MB
READ_CHUNK_BYTES = 256  # 더 작게 해서 2초 체크를 더 자주 (417090 등 긴 줄 읽기 시 블로킹 완화)
READ_TIMEOUT_SEC = LINE_TIMEOUT_SEC  # 큐에서 줄 받기 대기도 동일 2초

# owl#sameAs, owl#inverseOf만 파싱 전 스킵 (places에 불필요 + 276600 등 지연 방지).
# rdf-schema#label/comment+\u 는 스킵하지 않음 → 한글 라벨/설명이 \u로 많아서 전부 스킵되면 절반 손실됨.
# ReDoS 4줄(297427 등)은 2초 파싱 타임아웃으로만 스킵.
def _is_skip_pattern(s: str) -> bool:
    if not s:
        return False
    if "owl#sameAs" in s or "owl#inverseOf" in s:
        return True
    return False

# Predicate URI → DB 컬럼 매핑 (실제 LOD 속성 기준)
PREDICATE_TO_COLUMN = {
    "http://www.w3.org/2000/01/rdf-schema#label": "title",
    "http://purl.org/dc/elements/1.1/title": "title",
    "http://purl.org/dc/terms/title": "title",
    "http://xmlns.com/foaf/0.1/name": "title",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns#type": "category",
    "http://data.visitkorea.or.kr/property/address": "address",
    "http://schema.org/address": "address",
    "http://data.visitkorea.or.kr/property/tel": "tel",
    "http://data.visitkorea.or.kr/property/openTime": "open_time",
    "http://data.visitkorea.or.kr/property/fee": "use_fee",
    "http://data.visitkorea.or.kr/property/overview": "overview",
    "http://purl.org/dc/elements/1.1/description": "overview",
    "http://www.w3.org/2003/01/geo/wgs84_pos#lat": "latitude",
    "http://www.w3.org/2003/01/geo/wgs84_pos#long": "longitude",
}

# NT 한 줄: subject predicate object . (object는 <uri> 또는 "literal")
RE_NT_LINE = re.compile(
    r'^\s*(<[^>]+>)\s+(<[^>]+>)\s+(<[^>]+>|"[^"]*(?:\\.[^"]*)*")\s*\.\s*$',
    re.DOTALL,
)


def parse_nt_line(line: str) -> tuple[str | None, str | None, str | None]:
    """정규식으로 NT 한 줄 파싱. (subject, predicate, object) 또는 None."""
    line = line.strip()
    if not line or line.startswith("#"):
        return None, None, None
    m = RE_NT_LINE.match(line)
    if not m:
        return None, None, None
    sub, pred, obj = m.group(1), m.group(2), m.group(3).strip()
    if obj.startswith('"') and obj.endswith('"'):
        obj = obj[1:-1].replace('\\"', '"').strip()
    else:
        obj = obj.strip()
    return sub, pred, obj


def parse_nt_line_safe(line: str) -> tuple[str | None, str | None, str | None]:
    """긴 줄용: 정규식 없이 < > 위치만으로 subject/predicate/object 추출. ReDoS 방지."""
    line = line.strip()
    if not line or line.startswith("#") or not line.endswith("."):
        return None, None, None
    body = line[:-1].strip()
    if not body.startswith("<"):
        return None, None, None
    try:
        i1 = body.index(">", body.index("<"))
        sub = body[: i1 + 1]
        rest = body[i1 + 1 :].lstrip()
        if not rest.startswith("<"):
            return None, None, None
        i2 = rest.index(">", rest.index("<"))
        pred = rest[: i2 + 1]
        obj = rest[i2 + 1 :].strip()
        return sub, pred, obj
    except ValueError:
        return None, None, None


def extract_content_id(subject_uri: str) -> int | None:
    """Subject URI 마지막 숫자 부분을 content_id로 추출. 예: .../resource/1826457 → 1826457."""
    if not subject_uri or not subject_uri.startswith("<"):
        return None
    uri = subject_uri[1:-1].strip()
    m = re.search(r"/(\d+)\s*$", uri)
    if m:
        return int(m.group(1))
    m = re.search(r"#(\d+)\s*$", uri)
    if m:
        return int(m.group(1))
    parts = uri.split("/")
    for p in reversed(parts):
        if p.isdigit():
            return int(p)
    return None


def extract_category_from_type(object_uri_or_literal: str) -> str:
    """rdf:type 객체(URI)에서 마지막 클래스 명칭만 추출. 예: .../ModenHotel → ModenHotel."""
    s = (object_uri_or_literal or "").strip()
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1]
    if "/" in s:
        return s.rsplit("/", 1)[-1].strip()
    if "#" in s:
        return s.rsplit("#", 1)[-1].strip()
    return s


def read_lines_bounded(filepath: str):
    """청크 단위로 읽어 줄 단위로 yield. 한 줄 읽기가 2초 넘으면 해당 줄 스킵."""
    buf = ""
    line_count = 0
    skipped = 0
    line_start_time = time.monotonic()
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        while True:
            # 한 줄 읽기가 2초 넘어가면 (아직 \n 못 만남) 해당 줄 스킵
            if buf and time.monotonic() - line_start_time > LINE_TIMEOUT_SEC:
                skipped += 1
                if skipped <= 5:
                    print(f"  [경고] {line_count}줄 근처 리딩 타임아웃({LINE_TIMEOUT_SEC}초) → 건너뜀", flush=True)
                t0 = time.monotonic()
                while buf and "\n" not in buf:
                    if time.monotonic() - t0 > LINE_TIMEOUT_SEC:
                        buf = ""
                        break
                    more = f.read(READ_CHUNK_BYTES)
                    if not more:
                        buf = ""
                        break
                    buf += more
                if buf and "\n" in buf:
                    _, _, buf = buf.partition("\n")
                elif buf:
                    buf = ""
                line_start_time = time.monotonic()
                continue
            chunk = f.read(READ_CHUNK_BYTES)
            if not chunk:
                if buf.strip():
                    line_count += 1
                    yield buf, line_count
                return
            buf += chunk
            # 50KB 넘는 줄은 새줄 없는 거대 라인으로 간주하고 \n까지 버림 (40만줄 등 리딩 멈춤 방지)
            if len(buf) > 50_000 and "\n" not in buf:
                skipped += 1
                if skipped <= 5:
                    print(f"  [경고] {line_count}줄 근처 거대 라인(>{50_000//1024}KB) 건너뜀", flush=True)
                while "\n" not in buf:
                    more = f.read(READ_CHUNK_BYTES)
                    if not more:
                        buf = ""
                        break
                    buf += more
                if "\n" in buf:
                    _, _, buf = buf.partition("\n")
                else:
                    buf = ""
                line_start_time = time.monotonic()
                continue
            # ReDoS 패턴은 subject/predicate 쪽에 있어서 줄 앞 4KB만 보면 됨. 전체 buf 검사하면 느려짐.
            if len(buf) <= 4096 and _is_skip_pattern(buf):
                skipped += 1
                while "\n" not in buf:
                    more = f.read(READ_CHUNK_BYTES)
                    if not more:
                        buf = ""
                        break
                    buf += more
                if "\n" in buf:
                    _, _, buf = buf.partition("\n")
                else:
                    buf = ""
                line_start_time = time.monotonic()
                continue
            while "\n" in buf:
                line, _, buf = buf.partition("\n")
                line_count += 1
                line_start_time = time.monotonic()
                yield line + "\n", line_count
            if len(buf) > MAX_LINE_BYTES:
                # 거대한 줄: 2초 안에 \n 못 찾으면 해당 줄 스킵
                skipped += 1
                t0 = time.monotonic()
                while buf and "\n" not in buf:
                    if time.monotonic() - t0 > LINE_TIMEOUT_SEC:
                        if skipped <= 5:
                            print(f"  [경고] {line_count}줄 근처 리딩 타임아웃({LINE_TIMEOUT_SEC}초) → 건너뜀", flush=True)
                        buf = ""
                        break
                    more = f.read(READ_CHUNK_BYTES)
                    if not more:
                        break
                    buf += more
                if buf and "\n" in buf:
                    _, _, buf = buf.partition("\n")
                elif buf and "\n" not in buf:
                    buf = ""
                line_start_time = time.monotonic()


def main() -> None:
    # 터미널에서 출력이 바로 보이도록 버퍼링 끔
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    if not os.path.isfile(INPUT_NT):
        print(f"[오류] 파일 없음: {INPUT_NT}", flush=True)
        return
    if h3 is None:
        print("[안내] h3 미설치 → h3_res7, h3_res9는 NULL로 저장됩니다. pip install h3 권장.", flush=True)

    # DB 스키마 생성
    conn = sqlite3.connect(OUTPUT_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS places (
            content_id INTEGER PRIMARY KEY,
            title TEXT,
            category TEXT,
            address TEXT,
            tel TEXT,
            open_time TEXT,
            use_fee TEXT,
            overview TEXT,
            latitude REAL,
            longitude REAL,
            h3_res7 TEXT,
            h3_res9 TEXT
        )
    """)
    # 기존 DB에 H3 컬럼이 없으면 추가
    if h3:
        for col in ("h3_res7", "h3_res9"):
            try:
                conn.execute(f"ALTER TABLE places ADD COLUMN {col} TEXT")
                conn.commit()
                print(f"  [스키마] 컬럼 추가: {col}", flush=True)
            except sqlite3.OperationalError:
                pass
    conn.commit()

    # content_id별로 속성 모음 (Dictionary)
    records: dict[int, dict[str, str | float | None]] = defaultdict(lambda: {
        "title": None, "category": None, "address": None, "tel": None,
        "open_time": None, "use_fee": None, "overview": None,
        "latitude": None, "longitude": None,
    })

    line_count = 0

    def write_progress(lines: int, resources: int, status: str = "reading") -> None:
        try:
            with open(PROGRESS_FILE, "w", encoding="utf-8") as pf:
                pf.write(f"lines={lines}\nresources={resources}\nstatus={status}\n")
                pf.flush()
                if hasattr(os, "fsync") and hasattr(pf, "fileno"):
                    os.fsync(pf.fileno())
        except Exception:
            pass

    write_progress(0, 0, "started")
    print(f"[ETL] 읽는 중: {INPUT_NT}", flush=True)
    print(f"[ETL] DB 출력: {OUTPUT_DB}", flush=True)
    print(f"[ETL] 진행 모니터: {PROGRESS_FILE}", flush=True)
    print(f"[ETL] 실패/스킵 상세 로그: {ERROR_LOG}", flush=True)
    print("[ETL] 무적 인제스천: 에러 나면 해당 줄만 버리고 다음으로 진행합니다.", flush=True)

    def log_skip(line_num: int, reason: str, detail: str = "") -> None:
        """한 줄 스킵 시 상세 로그 (멈춤 위치·원인 파악용)."""
        msg = f"Line {line_num}: {reason}"
        if detail:
            msg += f" | {detail}"
        try:
            with open(ERROR_LOG, "a", encoding="utf-8") as el:
                el.write(msg.strip() + "\n")
                el.flush()
        except Exception:
            pass
        try:
            with open(SKIPPED_LINES_LOG, "a", encoding="utf-8") as sl:
                sl.write(f"line={line_num} # {reason}\n")
                sl.flush()
        except Exception:
            pass

    def parse_one(line: str, use_safe: bool):
        if use_safe:
            return parse_nt_line_safe(line)
        return parse_nt_line(line)

    skipped_count = 0
    line_queue = queue.Queue()

    def produce_lines():
        for line, lc in read_lines_bounded(INPUT_NT):
            line_queue.put((line, lc))
        line_queue.put(None)

    prod_thread = threading.Thread(target=produce_lines, daemon=True)
    prod_thread.start()
    last_line_count = 0
    read_timeout_logged = False

    with ThreadPoolExecutor(max_workers=1) as executor:
        while True:
            try:
                item = line_queue.get(timeout=READ_TIMEOUT_SEC)
            except queue.Empty:
                write_progress(last_line_count, len(records), "stuck_io")
                if not read_timeout_logged:
                    read_timeout_logged = True
                    print(f"[안내] {READ_TIMEOUT_SEC}초 리딩 타임아웃 (마지막 줄: {last_line_count:,}) → 해당 줄 스킵 후 계속.", flush=True)
                skipped_count += 1
                log_skip(last_line_count + 1, "read_timeout", "queue.get timeout, producer stuck")
                continue
            if item is None:
                break
            line, line_count = item
            last_line_count = line_count

            # 진행은 매 10줄마다 기록 (정확한 멈춤 위치 파악)
            if line_count % 10 == 0:
                write_progress(line_count, len(records), "reading")
            if line_count % LOG_PROGRESS_EVERY == 0:
                print(f"[ETL] 처리 중... ({line_count:,}줄 완료 / 리소스 {len(records):,}개 / 스킵 {skipped_count:,}개)", flush=True)

            try:
                # 276600(owl#inverseOf), rdf-schema#label/comment+\u 등: 파싱 시도 없이 스킵
                if _is_skip_pattern(line):
                    skipped_count += 1
                    log_skip(line_count, "reodos_skip_pattern")
                    continue

                # 모든 줄에 안전 파서만 사용 (정규식 ReDoS 제거 → 40만줄 등 어디서든 멈춤 방지)
                try:
                    future = executor.submit(parse_one, line, True)
                    sub, pred, obj = future.result(timeout=LINE_TIMEOUT_SEC)
                except FuturesTimeoutError:
                    skipped_count += 1
                    log_skip(line_count, "parse_timeout", f">{LINE_TIMEOUT_SEC}s")
                    continue
                except Exception as e:
                    skipped_count += 1
                    log_skip(line_count, "parse_error", str(e)[:200])
                    continue

                if sub is None or pred is None:
                    continue

                pred_uri = pred[1:-1] if pred.startswith("<") and pred.endswith(">") else pred
                col = PREDICATE_TO_COLUMN.get(pred_uri)
                if col is None:
                    continue

                content_id = extract_content_id(sub)
                if content_id is None:
                    continue

                rec = records[content_id]

                if col == "category":
                    rec["category"] = extract_category_from_type(obj)
                elif col in ("latitude", "longitude"):
                    try:
                        rec[col] = float(obj)
                    except (ValueError, TypeError):
                        pass
                else:
                    # 동일 속성 여러 값: 첫 값 유지 (또는 이어붙이기 가능)
                    if rec[col] is None or rec[col] == "":
                        rec[col] = obj
                    else:
                        rec[col] = str(rec[col]) + " / " + obj

            except Exception as e:
                # 어떤 예외든 해당 줄만 버리고 다음으로 (무적 인제스천)
                skipped_count += 1
                log_skip(line_count, "exception", str(e)[:300])
                continue

    line_count = last_line_count
    print("---", flush=True)
    print(f"[ETL] 작업 완료! (무적 인제스천)", flush=True)
    print(f"  총 라인: {line_count:,} | 리소스(성공): {len(records):,} | 스킵(실패): {skipped_count:,}", flush=True)
    if skipped_count > 0:
        print(f"  실패/스킵 원인 상세: {ERROR_LOG}", flush=True)
    write_progress(line_count, len(records), "parsed")

    # 위경도 → H3 인덱스 변환 (h3 패키지 있을 때만)
    def _latlng_to_h3(lat: float, lng: float, res: int) -> str | None:
        try:
            if hasattr(h3, "latlng_to_cell"):
                return h3.latlng_to_cell(lat, lng, res)
            return h3.geo_to_h3(lat, lng, res)  # h3-py 3.x
        except Exception:
            return None

    def get_h3_cells(lat: float | None, lng: float | None) -> tuple[str | None, str | None]:
        if h3 is None or lat is None or lng is None:
            return None, None
        try:
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                return None, None
            return _latlng_to_h3(lat, lng, 7), _latlng_to_h3(lat, lng, 9)
        except Exception:
            return None, None

    # 배치 Upsert (1000개 단위 executemany)
    BATCH_SIZE = 1000
    rows = []
    for cid, rec in records.items():
        lat, lng = rec.get("latitude"), rec.get("longitude")
        h3_7, h3_9 = get_h3_cells(lat, lng) if h3 else (None, None)
        rows.append((
            cid,
            rec["title"] or None,
            rec["category"] or None,
            rec["address"] or None,
            rec["tel"] or None,
            rec["open_time"] or None,
            rec["use_fee"] or None,
            rec["overview"] or None,
            rec["latitude"],
            rec["longitude"],
            h3_7,
            h3_9,
        ))

    print(f"[ETL] DB 적재 중 (배치 크기 {BATCH_SIZE})...", flush=True)
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        conn.executemany(
            """
            INSERT OR REPLACE INTO places
            (content_id, title, category, address, tel, open_time, use_fee, overview, latitude, longitude, h3_res7, h3_res9)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            batch,
        )
        if (i + BATCH_SIZE) % 50_000 == 0 or i + BATCH_SIZE >= len(rows):
            print(f"  삽입: {min(i + BATCH_SIZE, len(rows)):,} / {len(rows):,}건", flush=True)
    conn.commit()
    conn.close()
    write_progress(line_count, len(records), "done")
    print(f"[ETL] 완료: {OUTPUT_DB}", flush=True)


if __name__ == "__main__":
    main()
