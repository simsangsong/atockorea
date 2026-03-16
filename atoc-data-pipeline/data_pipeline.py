"""
AtoC Korea 데이터 파이프라인 (다국어, 국문 제외)
한국관광공사 Tour API Service2 → 영/중(간·번)/일 수집 → 언어별 개별 파일 저장 → 정제 → Gemini 임베딩 → Supabase(pgvector)
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import urlencode
from typing import Any

from google import genai
import pandas as pd
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client

# ========== 환경 변수 로드 ==========
load_dotenv()
load_dotenv(".env.local")
_script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(os.path.dirname(_script_dir), ".env.local"))

TOUR_API_KEY = os.getenv("TOUR_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Gemini 임베딩 (google-genai, 3072차원)
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 3072

# API 베이스 URL (Service2)
# 인증: 개발계정 일 1,000건, 활용신청 후 약 10분 후 사용 가능. JSON 요청 시 &_type=json, MobileApp 필수 기재.
BASE_URL = "https://apis.data.go.kr/B551011"

# 다국어 + 국문 엔드포인트 (서비스명, DB lang_type, 로그 표시명)
# LANG_FILTER=ko 시 KorService2(국문)만 수집. 기본(필터 없음)은 영/중간/중번/일 4개만.
_LANG_CONFIG_FULL: list[tuple[str, str, str]] = [
    ("EngService2", "en", "영문"),
    ("ChsService2", "chs", "중문(간체)"),
    ("ChtService2", "cht", "중문(번체)"),
    ("JpnService2", "ja", "일문"),
]
_LANG_CONFIG_KOR: list[tuple[str, str, str]] = [
    ("KorService2", "ko", "국문"),
]
_LANG_CONFIG_ALL: list[tuple[str, str, str]] = _LANG_CONFIG_FULL + _LANG_CONFIG_KOR


def _get_lang_config() -> list[tuple[str, str, str]]:
    """LANG_FILTER: 단일(ko, en 등) 또는 쉼표구분. 없으면 영/중간/중번/일 4개. ko 포함 시 KorService2 사용."""
    raw = (os.getenv("LANG_FILTER") or "").strip().lower()
    if not raw:
        return _LANG_CONFIG_FULL
    want = [s.strip() for s in raw.split(",") if s.strip()]
    if not want:
        return _LANG_CONFIG_FULL
    # ko 요청 시 전체 목록에서 ko 포함해 반환 (KorService2)
    config = _LANG_CONFIG_ALL if "ko" in want else _LANG_CONFIG_FULL
    return [t for t in config if t[1] in want]


# 런타임에 LANG_FILTER 반영된 설정 사용
def _lang_config() -> list[tuple[str, str, str]]:
    return _get_lang_config()


def _get_region_config() -> list[tuple[int, int | None, str]]:
    """REGION_FILTER=jeju 또는 39 이면 제주만, 없으면 REGION_CONFIG 전체."""
    raw = (os.getenv("REGION_FILTER") or "").strip().lower()
    if not raw:
        return REGION_CONFIG
    if raw in ("jeju", "39", "제주"):
        return [(39, None, "제주")]
    # 숫자만 있으면 해당 areaCode만 (시군구는 None)
    try:
        ac = int(raw)
        return [(r[0], r[1], r[2]) for r in REGION_CONFIG if r[0] == ac]
    except ValueError:
        return REGION_CONFIG

# 목록 API: NO6 지역기반 areaBasedList2, NO3 동기화 목록 areaBasedSyncList2
LIST_API_PATH_BY_SERVICE: dict[str, str] = {}
DEFAULT_LIST_API_PATH = "areaBasedList2"
LIST_API_PATH_SYNC = "areaBasedSyncList2"  # NO.3

# 관광타입 ID: 문서 76=관광지, 기존 12=관광지(구코드). 서비스별로 다를 수 있음.
CONTENT_TYPE_ID_BY_SERVICE: dict[str, int] = {
    "EngService2": 76,   # 문서 샘플 기준 관광지
    "ChsService2": 76,    # 중문 간체
    "ChtService2": 76,    # 중문 번체
    "JpnService2": 76,    # 일문
}
DEFAULT_CONTENT_TYPE_ID = 12

# 여러 관광타입 수집 시 사용. 비어 있으면 기존대로 1개만. 예: 76,14,32,39,38 → 관광지,문화시설,숙박,음식점,쇼핑
# 공공데이터 관광타입: 12 관광지, 14 문화시설, 15 축제행사, 25 여행코스, 28 레포츠, 32 숙박, 38 쇼핑, 39 음식점. 영문서비스는 76 등 별도 코드 가능.
_CONTENT_TYPE_IDS_RAW = (os.getenv("CONTENT_TYPE_IDS") or "").strip()
CONTENT_TYPE_IDS: list[int] = []
if _CONTENT_TYPE_IDS_RAW:
    for s in _CONTENT_TYPE_IDS_RAW.split(","):
        s = s.strip()
        if s.isdigit():
            CONTENT_TYPE_IDS.append(int(s))

# 수집 지역: (areaCode, sigunguCode, 표시명)
# 2026.01.12~ 요청은 lDongRegnCd/lDongSignguCd 사용 권장(areaCode/sigunguCode 미표출)
REGION_CONFIG: list[tuple[int, int | None, str]] = [
    (1, None, "서울"),
    (2, None, "인천"),
    (6, None, "부산"),
    (31, None, "경기"),
    (39, None, "제주"),
    (32, 1, "강원-강릉"),
    (32, 5, "강원-속초"),
    (32, 11, "강원-정선"),
    (32, 12, "강원-평창"),
    (35, 2, "경북-경주"),
]

# 2026.01.12~ 대체 파라미터 사용(문서: areaCode/sigunguCode 삭제예정 → lDongRegnCd/lDongSignguCd 사용)
USE_NEW_REGION_PARAMS = True

# 관광공사 areaCode → 법정동 시도코드(lDongRegnCd). 매핑 없으면 그대로 사용
AREA_TO_LDONG_REGION: dict[int, int] = {
    1: 11,   # 서울
    2: 28,   # 인천
    6: 26,   # 부산
    31: 31,  # 경기
    39: 50,  # 제주
    32: 42,  # 강원
    35: 47,  # 경북
}

# 문서 요청/응답 예제와 동일한 파라미터로 1회 호출 검증용 (TOUR_API_DOC_EXAMPLE=1 시 EngService2 첫 지역만)
# 예: areaBasedList2?arrange=C&contentTypeId=85&lDongRegnCd=47&lDongSignguCd=130&lclsSystm1=EV&lclsSystm2=EV02&lclsSystm3=EV021000
USE_DOC_EXAMPLE_PARAMS = (os.getenv("TOUR_API_DOC_EXAMPLE") or "").strip() in ("1", "true", "yes")
DOC_EXAMPLE_LCLS = {"lclsSystm1": "EV", "lclsSystm2": "EV02", "lclsSystm3": "EV021000"}

# 페이지네이션: Tour API는 1회당 최대 100건 지원 → 한 번에 최대치로 요청해 호출 횟수 최소화
NUM_OF_ROWS = min(100, max(10, int(os.getenv("TOUR_API_NUM_OF_ROWS", "100"))))
MAX_PAGES_PER_REGION = 10000  # 상한(비상용)

# 클라이언트 측 호출 간격(Sleep): 단시간 과다 요청 방지. 429가 자주 나면 이 값을 올리면 오히려 빨리 끝남.
# 2.5초 = 분당 24회, 429 거의 없이 수집 가능. 1.2초는 한도에 걸리기 쉬움.
_API_DELAY_DEFAULT = 2.5
API_DELAY_SEC = max(1.0, float(os.getenv("TOUR_API_DELAY_SEC", str(_API_DELAY_DEFAULT))))
# 429 수신 시 대기(초). 환경변수 TOUR_API_429_WAIT_SEC 로 변경 가능(기본 90초 권장)
API_429_WAIT_SEC = max(30, int(os.getenv("TOUR_API_429_WAIT_SEC", "90")))
API_429_MAX_RETRIES = 10

# 수집 결과 저장 디렉터리 (언어별 개별 파일)
OUTPUT_DIR = os.path.join(_script_dir, "output")

# 언어당 최대 수집 건수. 0=제한 없음. 일 1000건 한도 시 예: 4언어×약 200건 이하로 설정
_MAX_ITEMS_DEFAULT = 0
_MAX_ITEMS_RAW = os.getenv("MAX_ITEMS_PER_LANG", str(_MAX_ITEMS_DEFAULT)).strip()
MAX_ITEMS_PER_LANG = max(0, int(_MAX_ITEMS_RAW)) if _MAX_ITEMS_RAW.isdigit() else _MAX_ITEMS_DEFAULT

# TOUR_API_DEBUG=1 이면 목록 API 응답 전체를 파일로 저장 + 상세 로그
TOUR_API_DEBUG = (os.getenv("TOUR_API_DEBUG") or "").strip() in ("1", "true", "yes")

# FULL_DETAIL_COLLECT=1 이면 건별로 detailIntro2, detailInfo2, detailImage2 추가 호출 후 수집 (API 호출 4배)
FULL_DETAIL_COLLECT = (os.getenv("FULL_DETAIL_COLLECT") or "").strip() in ("1", "true", "yes")

# COLLECT_ALL_NINE=1 이면 문서 NO.1~NO.9 전부 사용: 목록(NO3+NO6), 상세(NO1,2,4전체,5), 위치목록(NO7), 키워드목록(NO8), 분류코드(NO9)
COLLECT_ALL_NINE = (os.getenv("COLLECT_ALL_NINE") or "").strip() in ("1", "true", "yes")

# RESUME=1 이면 output/checkpoint_<서비스>.json 에서 이어받아 수집 (한도로 중단된 뒤 다음날 재실행용)
RESUME = (os.getenv("RESUME") or "").strip() in ("1", "true", "yes")

# BACKFILL_DETAIL_IMAGES=1 이면 기존 places(id, lang_type)만 조회 후 detailImage2로 상세 이미지만 수집·업데이트 (전체 파이프라인 생략)
BACKFILL_DETAIL_IMAGES = (os.getenv("BACKFILL_DETAIL_IMAGES") or "").strip() in ("1", "true", "yes")

# lang_type → Tour API 서비스명 (백필 시 detailImage2 URL 구성용)
_LANG_TYPE_TO_SERVICE: dict[str, str] = {
    "ko": "KorService2",
    "en": "EngService2",
    "chs": "ChsService2",
    "cht": "ChtService2",
    "ja": "JpnService2",
}

# N건 수집할 때마다 체크포인트 저장 (완전 튕겨도 최근까지 복구 가능)
CHECKPOINT_SAVE_EVERY_N = 5
# 상세 수집(건별 NO.1/2/5 등) 시에는 건당 API 호출 많으므로 더 자주 저장
CHECKPOINT_SAVE_EVERY_N_DETAIL = 2

# NO.7 위치기반 목록용 지역 중심 좌표 (경도, 위도, 반경m). 비어 있으면 NO.7 미호출
REGION_CENTERS: dict[str, tuple[float, float, int]] = {
    "제주": (126.56, 33.43, 80_000),
}

# NO.8 키워드 검색용 지역별 키워드 (다국어 서비스면 해당 언어 키워드). 비어 있으면 NO.8 미호출
REGION_KEYWORDS: dict[str, str] = {
    "제주": "Jeju",
}

# 정제 기본값
DEFAULT_OVERVIEW = "정보 준비 중입니다."
DEFAULT_IMAGE_URL = ""


def ensure_env() -> None:
    """필수 환경 변수 검사."""
    missing = []
    if not TOUR_API_KEY:
        missing.append("TOUR_API_KEY")
    if not SUPABASE_URL:
        missing.append("NEXT_PUBLIC_SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    if missing:
        raise SystemExit(f"[오류] .env에 다음 변수를 설정해 주세요: {', '.join(missing)}")


# ========== 1. 다국어 데이터 수집 (Tour API Service2) ==========

_last_tour_api_time: list[float] = [0.0]


def _tour_api_get(url: str, params: dict[str, Any], timeout: int = 30) -> requests.Response:
    """클라이언트 측 호출 간격(Sleep) 적용 + 429 시 대기 후 재시도(최대 10회). 10회 후에도 429면 예외 발생 → 상위에서 체크포인트 저장 후 종료."""
    r = None
    for attempt in range(1, API_429_MAX_RETRIES + 1):
        elapsed = time.time() - _last_tour_api_time[0]
        if elapsed < API_DELAY_SEC:
            time.sleep(API_DELAY_SEC - elapsed)
        _last_tour_api_time[0] = time.time()
        r = requests.get(url, params=params, timeout=timeout)
        if r.status_code == 429:
            if attempt < API_429_MAX_RETRIES:
                print(f"\n  [429 Too Many Requests] {API_429_WAIT_SEC}초 대기 후 재시도 ({attempt}/{API_429_MAX_RETRIES}).")
                time.sleep(API_429_WAIT_SEC)
                continue
        r.raise_for_status()
        return r
    if r is not None:
        r.raise_for_status()
    raise RuntimeError("API 요청 실패")


_debug_logged_urls: set[str] = set()
_debug_dump_count: int = 0


def _dump_response_debug(list_url: str, data: Any, request_params: dict[str, Any] | None, reason: str) -> None:
    """TOUR_API_DEBUG 시 전체 응답 JSON을 파일로 저장."""
    if not TOUR_API_DEBUG:
        return
    global _debug_dump_count
    _debug_dump_count += 1
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    safe_name = re.sub(r"[^\w\-]", "_", list_url.split("/")[-2] or "api")
    path = os.path.join(OUTPUT_DIR, f"debug_list_response_{safe_name}_{_debug_dump_count}.json")
    try:
        payload = {"reason": reason, "list_url": list_url, "request_params": request_params, "response": data}
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"\n  [디버그] 전체 응답 저장: {path}")
    except Exception as e:
        print(f"\n  [디버그] 응답 저장 실패: {e}")


def _log_list_response_debug(list_url: str, data: Any, page_no: int, reason: str, request_params: dict[str, Any] | None = None) -> None:
    """첫 페이지에서 0건일 때 API 응답 구조/에러 확인용 로그 (서비스당 1회만). TOUR_API_DEBUG 시 전체 JSON 저장."""
    if page_no != 1 or list_url in _debug_logged_urls:
        return
    _debug_logged_urls.add(list_url)
    _dump_response_debug(list_url, data, request_params, reason)
    try:
        resp = data.get("response") or {}
        header = resp.get("header") if isinstance(resp, dict) else None
        body = resp.get("body") if isinstance(resp, dict) else None
        code = header.get("resultCode", "") if isinstance(header, dict) else ""
        msg = header.get("resultMsg", header.get("resultMessage", "")) if isinstance(header, dict) else ""
        print(f"\n  [디버그] {reason} | URL: {list_url}")
        print(f"  [디버그] response.header: resultCode={code!r}, resultMsg={msg!r}")
        if not isinstance(body, dict):
            raw_preview = str(body)[:500] if body is not None else "None"
            print(f"  [디버그] response.body 타입: {type(body).__name__}, 값(앞 500자): {raw_preview!r}")
        elif body:
            print(f"  [디버그] response.body 키: {list(body.keys())}")
            total_count = body.get("totalCount")
            items_val = body.get("items")
            print(f"  [디버그] response.body.totalCount={total_count!r}, items 타입={type(items_val).__name__!r}")
            if items_val is not None and not isinstance(items_val, dict):
                print(f"  [디버그] response.body.items 값(앞 400자): {str(items_val)[:400]!r}")
        # 전체 응답 앞 800자 (구조 파악용)
        raw_json = json.dumps(data, ensure_ascii=False)[:800]
        print(f"  [디버그] response 전체(앞 800자): {raw_json}...")
    except Exception as e:
        print(f"  [디버그] 로그 출력 중 오류: {e}")


def _build_tour_api_request(list_url: str, extra_params: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """공공 API 인증키: 이미 인코딩된 키(% 포함)는 URL에 그대로 붙여 이중 인코딩 방지."""
    params = {
        "MobileOS": "ETC",
        "MobileApp": "AtoCKorea",
        "_type": "json",
        **extra_params,
    }
    if TOUR_API_KEY and "%" in TOUR_API_KEY:
        # 인코딩된 키는 requests가 한 번 더 인코딩하면 깨지므로, 키만 URL에 그대로 붙임
        q = "serviceKey=" + TOUR_API_KEY + "&" + urlencode(params)
        return f"{list_url}?{q}", {}
    params["serviceKey"] = TOUR_API_KEY
    return list_url, params


def fetch_list_page(
    list_url: str,
    area_code: int,
    sigungu_code: int | None,
    page_no: int,
    content_type_id: int = DEFAULT_CONTENT_TYPE_ID,
    doc_example_override: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """목록 API 한 페이지 조회. (items, totalCount) 반환. doc_example_override 시 문서 예제 파라미터로 요청."""
    extra: dict[str, Any] = {
        "contentTypeId": content_type_id,
        "pageNo": page_no,
        "numOfRows": NUM_OF_ROWS,
        "arrange": "C",  # 문서: C=수정일순
    }
    if doc_example_override:
        extra.update(doc_example_override)
    elif USE_NEW_REGION_PARAMS:
        # 2026.01.12~ areaCode/sigunguCode 미표출 → lDongRegnCd/lDongSignguCd 사용
        l_region = AREA_TO_LDONG_REGION.get(area_code, area_code)
        extra["lDongRegnCd"] = l_region
        if sigungu_code is not None:
            extra["lDongSignguCd"] = sigungu_code
    else:
        extra["areaCode"] = area_code
        if sigungu_code is not None:
            extra["sigunguCode"] = sigungu_code
    url, params = _build_tour_api_request(list_url, extra)
    r = _tour_api_get(url, params, timeout=30)
    data = r.json()
    body = data.get("response", {}).get("body", {})
    if not isinstance(body, dict):
        _log_list_response_debug(list_url, data, page_no, "body가 dict가 아님", extra)
        return [], 0
    total_count = int(body.get("totalCount", 0) or 0)
    raw_items = body.get("items", {})
    # 다국어 API는 데이터 없을 때 items를 ""(빈 문자열)로 주는 경우 있음 → dict로 통일
    items = raw_items if isinstance(raw_items, dict) else {}
    if not isinstance(raw_items, dict) and page_no == 1 and list_url not in _debug_logged_urls:
        _debug_logged_urls.add(list_url)
        _dump_response_debug(list_url, data, extra, "items 타입이 dict 아님")
        print(f"\n  [디버그] items 타입이 dict 아님: type={type(raw_items).__name__!r}, totalCount={total_count}, items값(앞 80자)={str(raw_items)[:80]!r}")
        print(f"  [디버그] response 전체(앞 600자): {json.dumps(data, ensure_ascii=False)[:600]}...")
    item = items.get("item")
    if item is None:
        _log_list_response_debug(list_url, data, page_no, "item 없음(빈 결과 또는 키 다름)", extra)
        return [], total_count
    if isinstance(item, dict):
        return [item], total_count
    if isinstance(item, list):
        return [x for x in item if isinstance(x, dict)], total_count
    _log_list_response_debug(list_url, data, page_no, "item이 dict/list가 아님", extra)
    return [], total_count


def fetch_list_page_sync(
    base_url: str,
    area_code: int,
    sigungu_code: int | None,
    page_no: int,
    content_type_id: int = DEFAULT_CONTENT_TYPE_ID,
) -> tuple[list[dict[str, Any]], int]:
    """NO.3 관광정보 동기화 목록 areaBasedSyncList2. (items, totalCount) 반환."""
    list_url = f"{base_url}/{LIST_API_PATH_SYNC}"
    return fetch_list_page(list_url, area_code, sigungu_code, page_no, content_type_id, None)


def fetch_location_based_list(
    base_url: str,
    map_x: float,
    map_y: float,
    radius_m: int,
    page_no: int = 1,
    content_type_id: int = DEFAULT_CONTENT_TYPE_ID,
) -> tuple[list[dict[str, Any]], int]:
    """NO.7 위치기반 관광정보조회 locationBasedList2. (items, totalCount) 반환."""
    list_url = f"{base_url}/locationBasedList2"
    extra: dict[str, Any] = {
        "mapX": map_x,
        "mapY": map_y,
        "radius": radius_m,
        "contentTypeId": content_type_id,
        "pageNo": page_no,
        "numOfRows": NUM_OF_ROWS,
        "arrange": "C",
        "listYN": "Y",
    }
    url, params = _build_tour_api_request(list_url, extra)
    try:
        r = _tour_api_get(url, params, timeout=30)
        data = r.json()
    except (requests.RequestException, ValueError):
        return [], 0
    body = data.get("response", {}).get("body", {})
    if not isinstance(body, dict):
        return [], 0
    total_count = int(body.get("totalCount", 0) or 0)
    raw_items = body.get("items", {})
    items = raw_items if isinstance(raw_items, dict) else {}
    item = items.get("item")
    if item is None:
        return [], total_count
    if isinstance(item, dict):
        return [item], total_count
    if isinstance(item, list):
        return [x for x in item if isinstance(x, dict)], total_count
    return [], total_count


def fetch_keyword_list(
    base_url: str,
    keyword: str,
    page_no: int = 1,
    content_type_id: int = DEFAULT_CONTENT_TYPE_ID,
) -> tuple[list[dict[str, Any]], int]:
    """NO.8 키워드조회 searchKeyword2. (items, totalCount) 반환."""
    list_url = f"{base_url}/searchKeyword2"
    extra: dict[str, Any] = {
        "keyword": keyword,
        "contentTypeId": content_type_id,
        "pageNo": page_no,
        "numOfRows": NUM_OF_ROWS,
        "arrange": "C",
        "listYN": "Y",
    }
    url, params = _build_tour_api_request(list_url, extra)
    try:
        r = _tour_api_get(url, params, timeout=30)
        data = r.json()
    except (requests.RequestException, ValueError):
        return [], 0
    body = data.get("response", {}).get("body", {})
    if not isinstance(body, dict):
        return [], 0
    total_count = int(body.get("totalCount", 0) or 0)
    raw_items = body.get("items", {})
    items = raw_items if isinstance(raw_items, dict) else {}
    item = items.get("item")
    if item is None:
        return [], total_count
    if isinstance(item, dict):
        return [item], total_count
    if isinstance(item, list):
        return [x for x in item if isinstance(x, dict)], total_count
    return [], total_count


def fetch_lcls_systm_codes(base_url: str) -> dict[str, Any] | None:
    """NO.9 분류체계 코드조회 lclsSystmCode2. 전체 응답 body 반환."""
    list_url = f"{base_url}/lclsSystmCode2"
    extra: dict[str, Any] = {"numOfRows": 1000, "pageNo": 1}
    url, params = _build_tour_api_request(list_url, extra)
    try:
        r = _tour_api_get(url, params, timeout=15)
        data = r.json()
    except (requests.RequestException, ValueError):
        return None
    body = data.get("response", {}).get("body", {})
    return body if isinstance(body, dict) else None


def _fetch_detail_endpoint(
    detail_url: str,
    content_id: int,
    extra_params: dict[str, Any] | None = None,
) -> dict[str, Any] | list[dict[str, Any]] | None:
    """상세 API 한 엔드포인트 조회. response.body.items.item 또는 items 목록 반환."""
    extra: dict[str, Any] = {
        "contentId": content_id,
        "defaultYN": "Y",
    }
    if extra_params:
        extra.update(extra_params)
    try:
        url, params = _build_tour_api_request(detail_url, extra)
        r = _tour_api_get(url, params, timeout=15)
        data = r.json()
    except (requests.RequestException, ValueError):
        return None
    try:
        body = data.get("response", {}).get("body", {})
        if not isinstance(body, dict):
            return None
        items = body.get("items", {})
        if items is None:
            return None
        if isinstance(items, dict):
            item = items.get("item")
            if item is None:
                return None
            if isinstance(item, dict):
                return item
            if isinstance(item, list):
                return [x for x in item if isinstance(x, dict)]
            return None
        if isinstance(items, list):
            return [x for x in items if isinstance(x, dict)]
        return None
    except (AttributeError, TypeError):
        return None


def fetch_detail_overview(content_id: int, detail_url: str) -> str | None:
    """상세 API로 해당 contentid의 overview 조회 (해당 언어 원문)."""
    extra = {"overviewYN": "Y"}
    result = _fetch_detail_endpoint(detail_url, content_id, extra)
    if not isinstance(result, dict):
        return None
    overview = result.get("overview")
    return overview if overview and str(overview).strip() else None


def fetch_detail_common_full(
    detail_common_url: str, content_id: int
) -> tuple[str, dict[str, Any] | None]:
    """NO.4 공통정보조회 전체. (overview 텍스트, 전체 item dict) 반환."""
    result = _fetch_detail_endpoint(detail_common_url, content_id, {"overviewYN": "Y"})
    if not isinstance(result, dict):
        return "", None
    overview = (result.get("overview") or "").strip() or ""
    return overview, result


def fetch_detail_intro(
    base_url: str, content_id: int, content_type_id: int | None = None
) -> dict[str, Any] | None:
    """소개정보조회 detailIntro2. 반환값이 dict가 아니면 None."""
    url = f"{base_url}/detailIntro2"
    extra: dict[str, Any] = {}
    if content_type_id is not None:
        extra["contentTypeId"] = content_type_id
    out = _fetch_detail_endpoint(url, content_id, extra if extra else None)
    return out if isinstance(out, dict) else None


def fetch_detail_info(
    base_url: str, content_id: int, content_type_id: int | None = None
) -> dict[str, Any] | list[dict[str, Any]] | None:
    """반복정보조회 detailInfo2. item 하나면 dict, 여러 개면 list."""
    url = f"{base_url}/detailInfo2"
    extra: dict[str, Any] = {}
    if content_type_id is not None:
        extra["contentTypeId"] = content_type_id
    return _fetch_detail_endpoint(url, content_id, extra if extra else None)


def fetch_detail_images(base_url: str, content_id: int) -> list[dict[str, Any]] | None:
    """이미지정보조회 detailImage2. 항목 목록 반환."""
    url = f"{base_url}/detailImage2"
    out = _fetch_detail_endpoint(url, content_id)
    if out is None:
        return None
    if isinstance(out, dict):
        return [out]
    if isinstance(out, list):
        return out
    return None


def _checkpoint_path(service_name: str) -> str:
    return os.path.join(OUTPUT_DIR, f"checkpoint_{service_name}.json")


def _save_checkpoint(
    service_name: str,
    lang_rows: list[dict[str, Any]],
    collected_ids: set[int],
    reason: str,
    region_label: str,
    quiet: bool = False,
) -> None:
    """한도 등으로 중단 시 진행 상황 저장. RESUME=1로 재실행 시 이어받음. quiet=True면 주기 저장(출력 생략)."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = _checkpoint_path(service_name)
    try:
        data = {
            "service_name": service_name,
            "collected_ids": sorted(collected_ids),
            "lang_rows": lang_rows,
            "stopped_at": {
                "reason": reason,
                "region_label": region_label,
                "message": "일일 한도 등으로 중단. 내일 RESUME=1 로 재실행하면 이어서 수집합니다."
                if reason == "429"
                else "진행 중 주기 저장. RESUME=1 로 재실행하면 이어서 수집합니다.",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        if not quiet:
            print(f"\n  [체크포인트] 저장됨: {path} (수집 완료 {len(lang_rows)}건)")
    except Exception as e:
        if not quiet:
            print(f"\n  [오류] 체크포인트 저장 실패 {path}: {e}")


def _load_checkpoint(
    service_name: str,
) -> tuple[list[dict[str, Any]], set[int]] | None:
    """RESUME=1 시 저장된 진행 상황 로드. (lang_rows, collected_ids) 또는 None."""
    path = _checkpoint_path(service_name)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        rows = data.get("lang_rows") or []
        ids = set(data.get("collected_ids") or [])
        if not rows and not ids:
            return None
        return (rows, ids)
    except Exception as e:
        print(f"  [경고] 체크포인트 로드 실패 {path}: {e}")
        return None


def _save_lang_file(service_name: str, lang_rows: list[dict[str, Any]]) -> None:
    """언어별 수집 데이터를 엔드포인트 이름으로 파일 저장 (덮어쓰기 방지)."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"{service_name}.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(lang_rows, f, ensure_ascii=False, indent=2)
        print(f"  → 저장: {path} ({len(lang_rows)}건)")
    except Exception as e:
        print(f"  [오류] 파일 저장 실패 {path}: {e}")


def _save_lcls_codes(service_name: str, body: dict[str, Any]) -> None:
    """NO.9 분류체계 코드 응답 저장."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = os.path.join(OUTPUT_DIR, f"lclsSystmCode2_{service_name}.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(body, f, ensure_ascii=False, indent=2)
        print(f"  → NO.9 분류코드 저장: {path}")
    except Exception as e:
        print(f"  [오류] 분류코드 저장 실패 {path}: {e}")


def _merge_items_by_contentid(
    *item_lists: list[dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    """여러 목록을 contentid 기준으로 병합. 첫 출현 항목 유지."""
    merged: dict[int, dict[str, Any]] = {}
    for lst in item_lists:
        for it in lst:
            if not isinstance(it, dict):
                continue
            try:
                cid = it.get("contentid")
                if cid is None:
                    continue
                content_id = int(cid)
            except (TypeError, ValueError):
                continue
            if content_id not in merged:
                merged[content_id] = it
    return merged


def collect_places() -> pd.DataFrame:
    """다국어·지역별 수집 (국문 제외). totalCount 기반 전 페이지 수집, 언어별 개별 파일 저장."""
    active_regions = _get_region_config()
    lang_list = _lang_config()
    print("\n[1단계] 다국어 데이터 수집 (Tour API Service2, 국문 제외)")
    print(f"  [요청 간격] {API_DELAY_SEC}초 (429 자주 나오면 TOUR_API_DELAY_SEC=3 또는 4, TOUR_API_429_WAIT_SEC=120 설정 후 재실행)")
    print("  - 대상:", ", ".join(f"{t[0]}({t[2]})" for t in lang_list))
    print("  - 지역:", ", ".join(r[2] for r in active_regions))
    print(f"  - 저장: 언어별 {OUTPUT_DIR}/<엔드포인트명>.json")

    rows: list[dict[str, Any]] = []

    for service_name, lang_type, lang_label in lang_list:
        lang_rows: list[dict[str, Any]] = []
        collected_ids: set[int] = set()
        if RESUME:
            loaded = _load_checkpoint(service_name)
            if loaded is not None:
                lang_rows, collected_ids = loaded[0], loaded[1]
                print(f"  [{lang_label}] 이어받기: 기존 {len(lang_rows)}건 (contentid {len(collected_ids)}개 건너뜀)")
        try:
            list_path = LIST_API_PATH_BY_SERVICE.get(service_name, DEFAULT_LIST_API_PATH)
            list_url = f"{BASE_URL}/{service_name}/{list_path}"
            base_url = f"{BASE_URL}/{service_name}"
            detail_common_url = f"{base_url}/detailCommon2"
            if list_path != DEFAULT_LIST_API_PATH:
                print(f"  [{lang_label}] 목록 API: {list_path} (서비스별 경로 사용)")
            content_type_id = CONTENT_TYPE_ID_BY_SERVICE.get(service_name, DEFAULT_CONTENT_TYPE_ID)
            if content_type_id != DEFAULT_CONTENT_TYPE_ID:
                print(f"  [{lang_label}] contentTypeId: {content_type_id} (서비스별)")

            # COLLECT_ALL_NINE 시 NO.9 분류체계 코드 1회 수집·저장
            if COLLECT_ALL_NINE:
                codes = fetch_lcls_systm_codes(base_url)
                if codes is not None:
                    _save_lcls_codes(service_name, codes)

            # TOUR_API_DOC_EXAMPLE=1 이고 EngService2일 때: 문서 예제 파라미터로 1회만 호출 후 종료
            doc_example_one_shot = USE_DOC_EXAMPLE_PARAMS and service_name == "EngService2"
            if doc_example_one_shot:
                print(f"  [{lang_label}] 문서 예제 파라미터로 1회 호출 (TOUR_API_DOC_EXAMPLE=1)")

            sync_list_url = f"{base_url}/{LIST_API_PATH_SYNC}"

            for area_code, sigungu_code, region_label in active_regions:
                if doc_example_one_shot and area_code != active_regions[0][0]:
                    break  # 문서 예제는 첫 지역에서 1회만 수행 후 스킵
                try:
                    region_collected = 0

                    if COLLECT_ALL_NINE:
                        # 관광타입 여러 개면 각각 목록 수집 후 병합 (CONTENT_TYPE_IDS=76,14,32,39,38 등)
                        content_types_to_use = CONTENT_TYPE_IDS if CONTENT_TYPE_IDS else [content_type_id]
                        merged: dict[int, dict[str, Any]] = {}
                        for ctype in content_types_to_use:
                            all_no6 = []
                            page_no = 1
                            total_pages_no6 = None
                            while True:
                                try:
                                    items, total_count = fetch_list_page(
                                        list_url, area_code, sigungu_code, page_no, ctype, None
                                    )
                                except Exception as e:
                                    print(f"\n  [경고] [{lang_label}] [{region_label}] NO.6 contentTypeId={ctype} page {page_no} 실패: {e}")
                                    break
                                if page_no == 1 and total_count > 0:
                                    total_pages_no6 = max(1, (total_count + NUM_OF_ROWS - 1) // NUM_OF_ROWS)
                                    total_pages_no6 = min(total_pages_no6, MAX_PAGES_PER_REGION)
                                all_no6.extend(items)
                                if not items or (total_pages_no6 is not None and page_no >= total_pages_no6):
                                    break
                                page_no += 1
                                time.sleep(0.3)
                            all_no3 = []
                            page_no = 1
                            total_pages_no3 = None
                            while True:
                                try:
                                    items, total_count = fetch_list_page_sync(
                                        base_url, area_code, sigungu_code, page_no, ctype
                                    )
                                except Exception as e:
                                    print(f"\n  [경고] [{lang_label}] [{region_label}] NO.3 contentTypeId={ctype} page {page_no} 실패: {e}")
                                    break
                                if page_no == 1 and total_count > 0:
                                    total_pages_no3 = max(1, (total_count + NUM_OF_ROWS - 1) // NUM_OF_ROWS)
                                    total_pages_no3 = min(total_pages_no3, MAX_PAGES_PER_REGION)
                                all_no3.extend(items)
                                if not items or (total_pages_no3 is not None and page_no >= total_pages_no3):
                                    break
                                page_no += 1
                                time.sleep(0.3)
                            merged = _merge_items_by_contentid(
                                list(merged.values()), all_no6, all_no3
                            )
                            if region_label in REGION_CENTERS:
                                map_x, map_y, radius_m = REGION_CENTERS[region_label]
                                page_no = 1
                                while True:
                                    try:
                                        items, _ = fetch_location_based_list(
                                            base_url, map_x, map_y, radius_m, page_no, ctype
                                        )
                                    except Exception as e:
                                        print(f"\n  [경고] [{lang_label}] NO.7 contentTypeId={ctype} 실패: {e}")
                                        break
                                    for it in items:
                                        try:
                                            cid = it.get("contentid")
                                            if cid is not None:
                                                merged.setdefault(int(cid), it)
                                        except (TypeError, ValueError):
                                            pass
                                    if len(items) < NUM_OF_ROWS:
                                        break
                                    page_no += 1
                                    time.sleep(0.3)
                            if region_label in REGION_KEYWORDS:
                                keyword = REGION_KEYWORDS[region_label]
                                page_no = 1
                                while True:
                                    try:
                                        items, _ = fetch_keyword_list(
                                            base_url, keyword, page_no, ctype
                                        )
                                    except Exception as e:
                                        print(f"\n  [경고] [{lang_label}] NO.8 contentTypeId={ctype} 실패: {e}")
                                        break
                                    for it in items:
                                        try:
                                            cid = it.get("contentid")
                                            if cid is not None:
                                                merged.setdefault(int(cid), it)
                                        except (TypeError, ValueError):
                                            pass
                                    if len(items) < NUM_OF_ROWS:
                                        break
                                    page_no += 1
                                    time.sleep(0.3)
                        print(f"\n  [{lang_label}] [{region_label}] NO.3+6(+7+8) 병합 건수: {len(merged)} (관광타입 {len(content_types_to_use)}종)")
                        for it in merged.values():
                            try:
                                cid = it.get("contentid")
                                if not cid:
                                    continue
                                content_id = int(cid)
                            except (TypeError, ValueError):
                                continue
                            if content_id in collected_ids:
                                continue
                            title = (it.get("title") or "").strip()
                            addr1 = (it.get("addr1") or "").strip()
                            firstimage = (it.get("firstimage") or "").strip()
                            mapx, mapy = it.get("mapx"), it.get("mapy")
                            try:
                                overview, detail_common = fetch_detail_common_full(
                                    detail_common_url, content_id
                                )
                            except Exception as e:
                                print(f"\n  [경고] contentId={content_id} NO.4 실패: {e}")
                                overview, detail_common = "", None
                            row = {
                                "id": content_id,
                                "lang_type": lang_type,
                                "title": title,
                                "address": addr1,
                                "image_url": firstimage,
                                "mapx": mapx,
                                "mapy": mapy,
                                "overview": overview or "",
                                "detail_common": detail_common,
                            }
                            try:
                                ctype_id = it.get("contenttypeid")
                                if ctype_id is not None:
                                    try:
                                        ctype_id = int(ctype_id)
                                    except (TypeError, ValueError):
                                        ctype_id = content_type_id
                                else:
                                    ctype_id = content_type_id
                                intro = fetch_detail_intro(base_url, content_id, ctype_id)
                                if intro is not None:
                                    row["detail_intro"] = intro
                                info = fetch_detail_info(base_url, content_id, ctype_id)
                                if info is not None:
                                    row["detail_info"] = info
                                imgs = fetch_detail_images(base_url, content_id)
                                if imgs is not None:
                                    row["detail_images"] = imgs
                            except Exception as e:
                                print(f"\n  [경고] contentId={content_id} NO.1/2/5 실패: {e}")
                            lang_rows.append(row)
                            collected_ids.add(content_id)
                            region_collected += 1
                            if region_collected % CHECKPOINT_SAVE_EVERY_N_DETAIL == 0:
                                _save_checkpoint(
                                    service_name, lang_rows, collected_ids,
                                    "progress", region_label, quiet=True,
                                )
                            if MAX_ITEMS_PER_LANG and len(lang_rows) >= MAX_ITEMS_PER_LANG:
                                break
                            print(
                                f"\r  [{lang_label}] [{region_label}] 상세 수집 중... ({region_collected}/{len(merged)})",
                                end="",
                                flush=True,
                            )
                        if region_collected > 0:
                            print(f"\n  → [{lang_label}] - [{region_label}] 완료: {region_collected}건")
                        if MAX_ITEMS_PER_LANG and len(lang_rows) >= MAX_ITEMS_PER_LANG:
                            print(f"\n  [상한] [{lang_label}] 언어당 {MAX_ITEMS_PER_LANG}건 도달, 수집 중단")
                            break
                        continue
                    # 일반 모드: NO.6만 페이지 단위 수집
                    page_no = 1
                    total_pages: int | None = None
                    doc_override: dict[str, Any] | None = None
                    if doc_example_one_shot:
                        doc_override = {
                            "lDongRegnCd": 47,
                            "lDongSignguCd": 130,
                            "contentTypeId": 85,
                            **DOC_EXAMPLE_LCLS,
                        }

                    while True:
                        try:
                            override = doc_override if (doc_override and page_no == 1) else None
                            if doc_override and page_no > 1:
                                break
                            items, total_count = fetch_list_page(
                                list_url, area_code, sigungu_code, page_no, content_type_id, override
                            )
                            if override:
                                doc_override = None  # 다음 페이지부터는 일반 파라미터
                        except requests.HTTPError as e:
                            if e.response is not None and e.response.status_code == 429:
                                print(f"\n  [429 한도] [{lang_label}] [{region_label}] pageNo={page_no} — 일일 한도 소진.")
                                _save_checkpoint(
                                    service_name, lang_rows, collected_ids, "429", region_label
                                )
                                print("  진행 상황을 저장했습니다. 내일 RESUME=1 로 재실행하면 이어서 수집합니다.")
                                sys.exit(0)
                            else:
                                print(f"\n  [오류] [{lang_label}] [{region_label}] pageNo={page_no} 요청 실패: {e}")
                            page_no += 1
                            if total_pages is not None and page_no > total_pages:
                                break
                            time.sleep(2.0)
                            continue
                        except Exception as e:
                            print(f"\n  [오류] [{lang_label}] [{region_label}] pageNo={page_no} 요청 실패: {e}")
                            page_no += 1
                            if total_pages is not None and page_no > total_pages:
                                break
                            time.sleep(2.0)
                            continue

                        if page_no == 1 and total_count > 0:
                            total_pages = max(1, (total_count + NUM_OF_ROWS - 1) // NUM_OF_ROWS)
                            total_pages = min(total_pages, MAX_PAGES_PER_REGION)

                        if not items:
                            if total_pages is None or page_no >= total_pages:
                                break
                            page_no += 1
                            time.sleep(0.3)
                            continue

                        for it in items:
                            if not isinstance(it, dict):
                                continue
                            try:
                                cid = it.get("contentid")
                                if not cid:
                                    continue
                                content_id = int(cid)
                            except (TypeError, ValueError):
                                continue
                            if content_id in collected_ids:
                                continue

                            title = (it.get("title") or "").strip()
                            addr1 = (it.get("addr1") or "").strip()
                            firstimage = (it.get("firstimage") or "").strip()
                            mapx, mapy = it.get("mapx"), it.get("mapy")
                            try:
                                overview = fetch_detail_overview(content_id, detail_common_url) or ""
                            except Exception as e:
                                print(f"\n  [경고] contentId={content_id} overview 조회 실패: {e}")
                                overview = ""

                            row: dict[str, Any] = {
                                "id": content_id,
                                "lang_type": lang_type,
                                "title": title,
                                "address": addr1,
                                "image_url": firstimage,
                                "mapx": mapx,
                                "mapy": mapy,
                                "overview": overview,
                            }
                            if FULL_DETAIL_COLLECT:
                                try:
                                    ctype_id = it.get("contenttypeid")
                                    if ctype_id is not None:
                                        try:
                                            ctype_id = int(ctype_id)
                                        except (TypeError, ValueError):
                                            ctype_id = content_type_id
                                    else:
                                        ctype_id = content_type_id
                                    intro = fetch_detail_intro(base_url, content_id, ctype_id)
                                    if intro is not None:
                                        row["detail_intro"] = intro
                                    info = fetch_detail_info(base_url, content_id, ctype_id)
                                    if info is not None:
                                        row["detail_info"] = info
                                    imgs = fetch_detail_images(base_url, content_id)
                                    if imgs is not None:
                                        row["detail_images"] = imgs
                                except Exception as e:
                                    print(f"\n  [경고] contentId={content_id} 상세(Intro/Info/Image) 조회 실패: {e}")
                            lang_rows.append(row)
                            collected_ids.add(content_id)
                            region_collected += 1
                            if region_collected % CHECKPOINT_SAVE_EVERY_N == 0:
                                _save_checkpoint(
                                    service_name, lang_rows, collected_ids,
                                    "progress", region_label, quiet=True,
                                )
                            if MAX_ITEMS_PER_LANG and len(lang_rows) >= MAX_ITEMS_PER_LANG:
                                break

                        if MAX_ITEMS_PER_LANG and len(lang_rows) >= MAX_ITEMS_PER_LANG:
                            break
                        total_display = total_count if total_count > 0 else region_collected
                        print(
                            f"\r  현재 [{lang_label}] - [{region_label}] 수집 중... ({region_collected}/{total_display})",
                            end="",
                            flush=True,
                        )

                        if total_pages is not None and page_no >= total_pages:
                            break
                        if len(items) < NUM_OF_ROWS:
                            break
                        if doc_example_one_shot and region_collected > 0:
                            break  # 문서 예제는 1페이지만 수집 후 종료
                        page_no += 1
                        time.sleep(0.3)

                    if region_collected > 0:
                        print(f"\n  → [{lang_label}] - [{region_label}] 완료: {region_collected}건")
                    if MAX_ITEMS_PER_LANG and len(lang_rows) >= MAX_ITEMS_PER_LANG:
                        print(f"\n  [상한] [{lang_label}] 언어당 {MAX_ITEMS_PER_LANG}건 도달, 수집 중단")
                        break
                    if doc_example_one_shot:
                        doc_example_one_shot = False
                        break  # 문서 예제 1회 수행 후 지역 루프 종료

                except requests.HTTPError as e:
                    if e.response is not None and e.response.status_code == 429:
                        print(f"\n  [429 한도] [{lang_label}] [{region_label}] — 일일 한도 소진.")
                        _save_checkpoint(
                            service_name, lang_rows, collected_ids, "429", region_label
                        )
                        print("  진행 상황을 저장했습니다. 내일 RESUME=1 로 재실행하면 이어서 수집합니다.")
                        sys.exit(0)
                    print(f"\n  [오류] [{lang_label}] [{region_label}] HTTP: {e}")
                    continue
                except Exception as e:
                    print(f"\n  [오류] [{lang_label}] [{region_label}] 지역 수집 중 예외: {e}")
                    continue

            if lang_rows:
                _save_lang_file(service_name, lang_rows)
                rows.extend(lang_rows)
                # 정상 완료 시 체크포인트 삭제 (다음 실행 시 처음부터가 아닌 이어받기 방지)
                cp_path = _checkpoint_path(service_name)
                if os.path.isfile(cp_path):
                    try:
                        os.remove(cp_path)
                        print(f"  [체크포인트] 정상 완료로 삭제: {cp_path}")
                    except OSError:
                        pass
            print(f"  [{lang_label}] 언어 수집 합계: {len(lang_rows)}건")

        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 429:
                _save_checkpoint(service_name, lang_rows, collected_ids, "429", "(서비스 루프)")
                print("  [429] 진행 상황 저장. 내일 RESUME=1 로 재실행하세요.")
                sys.exit(0)
            print(f"\n  [오류] [{lang_label}] 언어 HTTP 실패: {e}")
            continue
        except Exception as e:
            print(f"\n  [오류] [{lang_label}] 언어 전체 수집 실패: {e}")
            continue

    df = pd.DataFrame(rows)
    if not df.empty:
        df = df.drop_duplicates(subset=["id", "lang_type"], keep="first").reset_index(drop=True)
    print(f"\n  수집 완료: 총 {len(df)}건 (중복 제거 후)")
    return df


# ========== 2. 데이터 정제 ==========


def clean_overview(text: str) -> str:
    """overview에서 HTML 제거 후 순수 텍스트만 반환."""
    if not text or not str(text).strip():
        return ""
    text = str(text)
    soup = BeautifulSoup(text, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def clean_places(df: pd.DataFrame) -> pd.DataFrame:
    """필수: title, address만. overview/image_url 비어 있으면 기본값 채움. 삭제 시 사유 로그."""
    print("\n[2단계] 데이터 정제 (Cleaning)")

    if df.empty:
        print("  정제할 데이터 없음.")
        return df

    df = df.copy()
    before = len(df)

    # 1) overview: 비어 있으면 기본 문구로 채움
    df["overview"] = df["overview"].astype(str).str.strip()
    empty_overview = df["overview"].isin(["", "nan", "None"])
    df.loc[empty_overview, "overview"] = DEFAULT_OVERVIEW
    df["overview"] = df["overview"].map(clean_overview)
    df.loc[df["overview"] == "", "overview"] = DEFAULT_OVERVIEW
    print(f"  - overview 비어있던 행 기본값 채움: {empty_overview.sum()}건 → '{DEFAULT_OVERVIEW}'")

    # 2) image_url: 비어 있으면 기본값(빈 문자열 또는 기본 URL)
    df["image_url"] = df["image_url"].astype(str).str.strip()
    empty_image = df["image_url"].isin(["", "nan", "None"])
    df.loc[empty_image, "image_url"] = DEFAULT_IMAGE_URL
    print(f"  - image_url 비어있던 행 기본값 채움: {empty_image.sum()}건")

    # 3) 필수값: title, address만 검사 (비어 있으면 해당 행만 제거)
    df["title"] = df["title"].astype(str).str.strip()
    df["address"] = df["address"].astype(str).str.strip()
    missing_title = (df["title"] == "") | (df["title"] == "nan") | (df["title"] == "None")
    missing_addr = (df["address"] == "") | (df["address"] == "nan") | (df["address"] == "None")

    drop_title = missing_title & ~missing_addr
    drop_addr = missing_addr & ~missing_title
    drop_both = missing_title & missing_addr
    n_drop_title = drop_title.sum()
    n_drop_addr = drop_addr.sum()
    n_drop_both = drop_both.sum()

    df = df[~missing_title & ~missing_addr]
    after_required = len(df)
    removed = before - after_required
    if removed > 0:
        print(f"  - [삭제] 필수값 부족으로 제거: 총 {removed}건")
        if n_drop_both:
            print(f"    - title·address 둘 다 비어있음: {n_drop_both}건")
        if n_drop_title:
            print(f"    - title 비어있음: {n_drop_title}건")
        if n_drop_addr:
            print(f"    - address 비어있음: {n_drop_addr}건")
    print(f"  - 필수값(title, address) 적용 후: {before} → {after_required}건")

    # 4) mapx, mapy: 변환 실패 시 0.0으로 채움 (삭제하지 않음)
    for col in ("mapx", "mapy"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    invalid_map = df["mapx"].isna() | df["mapy"].isna()
    n_invalid_map = invalid_map.sum()
    if n_invalid_map > 0:
        print(f"  - [유의] 좌표(mapx/mapy) 변환 불가: {n_invalid_map}건 → 0.0으로 채움 (삭제하지 않음)")
    df["mapx"] = df["mapx"].fillna(0.0).astype(float)
    df["mapy"] = df["mapy"].fillna(0.0).astype(float)

    print(f"  - 좌표 처리 후 최종: {len(df)}건")
    if len(df) == 0:
        print("  - [원인] 0건이 된 이유: title 또는 address가 비어있는 행만 있어 모두 제거됨.")

    return df.reset_index(drop=True)


# ========== 3. AI 임베딩 생성 (Google Gemini) ==========


def build_context(row: pd.Series) -> str:
    """임베딩용 문맥 문자열. overview 없어도 title·address만으로 생성 (에러 방지)."""
    title = (row.get("title") or "").strip() or "장소명 없음"
    address = (row.get("address") or "").strip() or "주소 없음"
    overview = (row.get("overview") or "").strip()
    if not overview or overview == "nan" or overview == "None":
        overview = DEFAULT_OVERVIEW
    text = "장소명: {}, 주소: {}, 설명: {}".format(title, address, overview)
    if not text or len(text.strip()) < 2:
        text = "장소 정보 없음"
    return text


def _embed_batch_with_retry(
    client: genai.Client,
    batch: list[str],
    lang_label: str,
    region_label: str,
    done: int,
    total: int,
) -> list[list[float]]:
    """한 배치 임베딩. 429 시 지수 백오프 재시도."""
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            result = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=batch,
                config=genai.types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
            )
            out = []
            for emb in result.embeddings or []:
                out.append(list(emb.values) if emb.values else [])
            return out
        except Exception as e:
            err_str = str(e)
            if attempt < max_attempts - 1 and (
                "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower()
            ):
                wait = min(2 ** attempt + 1, 60)
                print(f"\n  - [한도] [{lang_label}] 지수 백오프 재시도 {attempt + 1}/{max_attempts} ({wait}초)...")
                time.sleep(wait)
            else:
                raise
    return []


def create_embeddings(df: pd.DataFrame) -> pd.DataFrame:
    """100개씩 배치 임베딩. 언어별 진행 로그, 429 시 지수 백오프만 적용."""
    print("\n[3단계] AI 임베딩 생성 (Google Gemini, google-genai)")

    if df.empty:
        print("  임베딩할 데이터 없음.")
        return df

    client = genai.Client(api_key=GEMINI_API_KEY)
    df = df.copy()
    df["embedding"] = None
    batch_size = 100
    batch_delay_sec = 1.2

    for _service_name, lang_type, lang_label in _lang_config():
        sub = df[df["lang_type"] == lang_type]
        if sub.empty:
            continue
        indices = sub.index.tolist()
        texts = sub.apply(build_context, axis=1).tolist()
        lang_embeddings: list[list[float]] = []
        total_lang = len(texts)

        for i in range(0, total_lang, batch_size):
            batch = texts[i : i + batch_size]
            end = min(i + batch_size, total_lang)
            print(f"\r  현재 [{lang_label}] 임베딩 중... ({end}/{total_lang})", end="", flush=True)
            emb_list = _embed_batch_with_retry(client, batch, lang_label, "", end, total_lang)
            lang_embeddings.extend(emb_list)
            if i + batch_size < total_lang:
                time.sleep(batch_delay_sec)

        for idx, emb in zip(indices, lang_embeddings):
            df.at[idx, "embedding"] = emb
        print(f"\n  → [{lang_label}] 완료: {len(lang_embeddings)}건")

    print(f"  완료: 총 {len(df)}개 벡터 ({EMBEDDING_DIM}차원)")
    return df


# ========== 4. Supabase 적재 (Upsert) ==========


def upsert_to_supabase(df: pd.DataFrame) -> None:
    """places 테이블에 upsert. (id, lang_type) 조합 기준 중복 시 업데이트."""
    print("\n[4단계] Supabase 적재 (Upsert)")

    if df.empty:
        print("  적재할 데이터 없음.")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    records = []
    for _, row in df.iterrows():
        rec = {
            "id": int(row["id"]),
            "lang_type": str(row["lang_type"]),
            "title": str(row["title"]),
            "address": str(row["address"]) if pd.notna(row["address"]) else None,
            "image_url": str(row["image_url"]) if pd.notna(row["image_url"]) else None,
            "mapx": float(row["mapx"]),
            "mapy": float(row["mapy"]),
            "overview": str(row["overview"]),
        }
        emb = row.get("embedding")
        if emb is not None and (isinstance(emb, (list, tuple)) or hasattr(emb, "__iter__")):
            try:
                rec["embedding"] = list(emb)
            except (TypeError, ValueError):
                pass
        detail_imgs = row.get("detail_images", None)
        if detail_imgs is not None and isinstance(detail_imgs, list) and len(detail_imgs) > 0:
            rec["detail_images"] = detail_imgs
        if "source_origin" in row and pd.notna(row.get("source_origin")):
            rec["source_origin"] = str(row["source_origin"])
        if "category" in row and pd.notna(row.get("category")):
            rec["category"] = str(row["category"])
        if "open_time" in row and pd.notna(row.get("open_time")):
            rec["open_time"] = str(row["open_time"]).strip() or None
        if "use_fee" in row and pd.notna(row.get("use_fee")):
            rec["use_fee"] = str(row["use_fee"]).strip() or None
        if "tel" in row and pd.notna(row.get("tel")):
            rec["tel"] = str(row["tel"]).strip() or None
        if "h3_res7" in row and pd.notna(row.get("h3_res7")):
            rec["h3_res7"] = str(row["h3_res7"]).strip() or None
        if "h3_res9" in row and pd.notna(row.get("h3_res9")):
            rec["h3_res9"] = str(row["h3_res9"]).strip() or None
        records.append(rec)

    try:
        supabase.table("places").upsert(
            records,
            on_conflict="id,lang_type",
            ignore_duplicates=False,
        )
        print(f"  upsert 완료: {len(records)}건")
    except Exception as e:
        print(f"  [오류] Supabase upsert 실패: {e}")
        raise


def run_backfill_detail_images() -> None:
    """기존 places(id, lang_type)만 조회한 뒤 detailImage2로 상세 이미지 수집 후 detail_images만 업데이트."""
    print("\n[백필] 상세 이미지만 수집 (기존 places 대상, detailImage2)")
    missing = [k for k, v in [("TOUR_API_KEY", TOUR_API_KEY), ("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL), ("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_KEY)] if not v]
    if missing:
        raise SystemExit(f"[오류] 백필에 필요한 환경 변수: {', '.join(missing)}")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        r = supabase.table("places").select("id, lang_type").order("id").execute()
    except Exception as e:
        print(f"  [오류] places 목록 조회 실패: {e}")
        raise
    rows = (r.data or []) if hasattr(r, "data") else []
    if not rows:
        print("  적재된 places가 없습니다.")
        return
    print(f"  대상 {len(rows)}건 (id, lang_type)")
    updated = 0
    failed = 0
    for i, row in enumerate(rows):
        place_id = row.get("id")
        lang_type = (row.get("lang_type") or "ko").strip() or "ko"
        if place_id is None:
            continue
        service = _LANG_TYPE_TO_SERVICE.get(lang_type, "KorService2")
        base_url = f"{BASE_URL}/{service}"
        try:
            imgs = fetch_detail_images(base_url, int(place_id))
        except Exception as e:
            print(f"  [{i+1}/{len(rows)}] id={place_id} lang={lang_type} 조회 실패: {e}")
            failed += 1
            time.sleep(API_DELAY_SEC)
            continue
        if imgs:
            try:
                supabase.table("places").update({"detail_images": imgs}).eq("id", place_id).eq("lang_type", lang_type).execute()
                updated += 1
            except Exception as e:
                print(f"  [{i+1}/{len(rows)}] id={place_id} 업데이트 실패: {e}")
                failed += 1
        if (i + 1) % 50 == 0:
            print(f"  진행: {i+1}/{len(rows)} (업데이트 {updated}건)")
        time.sleep(API_DELAY_SEC)
    print(f"  완료: 업데이트 {updated}건, 실패 {failed}건")


# ========== 메인 ==========


def main() -> None:
    if BACKFILL_DETAIL_IMAGES:
        run_backfill_detail_images()
        return
    print("=" * 60)
    print("AtoC Korea 데이터 파이프라인 (Tour API → 정제 → 임베딩 → Supabase)")
    print("=" * 60)
    if TOUR_API_DEBUG:
        print("  [디버그] TOUR_API_DEBUG=1 → 목록 API 응답 전체를 output/debug_list_response_*.json 에 저장합니다.")
    if USE_DOC_EXAMPLE_PARAMS:
        print("  [문서 예제] TOUR_API_DOC_EXAMPLE=1 → EngService2만 문서 예제(lDongRegnCd=47, contentTypeId=85, lclsSystm)로 1회 호출합니다.")
    reg_filter = (os.getenv("REGION_FILTER") or "").strip() or "(전체)"
    lang_filter = (os.getenv("LANG_FILTER") or "").strip() or "(전체 4개: en,chs,cht,ja)"
    print(f"  [수집 범위] REGION_FILTER={reg_filter}, LANG_FILTER={lang_filter}")
    if MAX_ITEMS_PER_LANG:
        print(f"  [상한] MAX_ITEMS_PER_LANG={MAX_ITEMS_PER_LANG} (언어당, 일 1000건 한도 시 4언어×약 200건 이하 권장)")
    if FULL_DETAIL_COLLECT:
        print("  [전체 상세] FULL_DETAIL_COLLECT=1 → 건별 detailIntro2, detailInfo2, detailImage2 추가 수집 (API 호출 증가)")
    if COLLECT_ALL_NINE:
        print("  [NO.1~9] COLLECT_ALL_NINE=1 → 목록(NO.3+6+7+8), 상세(NO.1,2,4전체,5), 분류코드(NO.9) 전부 수집 (건당 API 약 4회+ → 전국 시 수 시간 소요)")
    if RESUME:
        print("  [이어받기] RESUME=1 → output/checkpoint_<서비스>.json 에서 중단 시점부터 재개")
    if CONTENT_TYPE_IDS:
        print(f"  [관광타입] CONTENT_TYPE_IDS={CONTENT_TYPE_IDS} → 여러 타입 수집 (건수 증가)")
    print(f"  [호출 제어] numOfRows={NUM_OF_ROWS} (1회 최대), 요청 간격 {API_DELAY_SEC}초 (TOUR_API_DELAY_SEC 변경 가능)")

    ensure_env()

    df = collect_places()
    if df.empty:
        print("\n수집된 데이터가 없어 파이프라인을 종료합니다.")
        return

    df = clean_places(df)
    if df.empty:
        print("\n정제 후 남은 데이터가 없어 파이프라인을 종료합니다.")
        return

    df = create_embeddings(df)
    upsert_to_supabase(df)

    print("\n" + "=" * 60)
    print("파이프라인 완료.")
    print("=" * 60)


if __name__ == "__main__":
    main()
