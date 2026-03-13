"""
AtoC Korea 데이터 파이프라인 (다국어, 국문 제외)
한국관광공사 Tour API Service2 → 영/중(간·번)/일 수집 → 언어별 개별 파일 저장 → 정제 → Gemini 임베딩 → Supabase(pgvector)
"""

import json
import os
import re
import time
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
BASE_URL = "https://apis.data.go.kr/B551011"

# 다국어 엔드포인트만 (국문 KorService2 제외) → (서비스명, DB lang_type, 로그 표시명)
# EngService2(영어), ChsService2(중어 간체), ChtService2(중어 번체), JpnService2(일어)
_LANG_CONFIG_FULL: list[tuple[str, str, str]] = [
    ("EngService2", "en", "영문"),
    ("ChsService2", "chs", "중문(간체)"),
    ("ChtService2", "cht", "중문(번체)"),
    ("JpnService2", "ja", "일문"),
]


def _get_lang_config() -> list[tuple[str, str, str]]:
    """LANG_FILTER(예: en)가 있으면 해당 언어만, 없으면 전체."""
    lang_filter = (os.getenv("LANG_FILTER") or "").strip().lower()
    if not lang_filter:
        return _LANG_CONFIG_FULL
    return [t for t in _LANG_CONFIG_FULL if t[1] == lang_filter]


# 런타임에 LANG_FILTER 반영된 설정 사용
def _lang_config() -> list[tuple[str, str, str]]:
    return _get_lang_config()

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

# 2026.01.12~ 대체 파라미터 사용 여부(True면 lDongRegnCd/lDongSignguCd로 요청)
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

NUM_OF_ROWS = 100  # API 한 페이지당 건수
MAX_PAGES_PER_REGION = 10000  # 상한(비상용)

# 공공 API 요청 제한 회피: 요청 간 최소 간격(초), 429 시 대기(초)
API_DELAY_SEC = 1.2
API_429_WAIT_SEC = 60
API_429_MAX_RETRIES = 3

# 수집 결과 저장 디렉터리 (언어별 개별 파일)
OUTPUT_DIR = os.path.join(_script_dir, "output")

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
    """요청 간격 유지 + 429 시 대기 후 재시도."""
    r = None
    for attempt in range(1, API_429_MAX_RETRIES + 1):
        elapsed = time.time() - _last_tour_api_time[0]
        if elapsed < API_DELAY_SEC:
            time.sleep(API_DELAY_SEC - elapsed)
        _last_tour_api_time[0] = time.time()
        r = requests.get(url, params=params, timeout=timeout)
        if r.status_code == 429:
            if attempt < API_429_MAX_RETRIES:
                print(f"\n  [429 Too Many Requests] {API_429_WAIT_SEC}초 대기 후 재시도 ({attempt}/{API_429_MAX_RETRIES})...")
                time.sleep(API_429_WAIT_SEC)
                continue
        r.raise_for_status()
        return r
    if r is not None:
        r.raise_for_status()
    raise RuntimeError("API 요청 실패")


_debug_logged_urls: set[str] = set()


def _log_list_response_debug(list_url: str, data: Any, page_no: int, reason: str) -> None:
    """첫 페이지에서 0건일 때 API 응답 구조/에러 확인용 로그 (서비스당 1회만)."""
    if page_no != 1 or list_url in _debug_logged_urls:
        return
    _debug_logged_urls.add(list_url)
    try:
        resp = data.get("response") or {}
        header = resp.get("header") if isinstance(resp, dict) else None
        body = resp.get("body") if isinstance(resp, dict) else None
        code = header.get("resultCode", "") if isinstance(header, dict) else ""
        msg = header.get("resultMsg", header.get("resultMessage", "")) if isinstance(header, dict) else ""
        print(f"\n  [디버그] {reason} | URL: {list_url}")
        print(f"  [디버그] response.header: resultCode={code!r}, resultMsg={msg!r}")
        if not isinstance(body, dict):
            print(f"  [디버그] response.body 타입: {type(body).__name__}, 값(앞 200자): {str(body)[:200]!r}")
        elif body:
            print(f"  [디버그] response.body 키: {list(body.keys())}")
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
) -> tuple[list[dict[str, Any]], int]:
    """목록 API 한 페이지 조회. (items, totalCount) 반환."""
    extra: dict[str, Any] = {
        "contentTypeId": 12,
        "pageNo": page_no,
        "numOfRows": NUM_OF_ROWS,
    }
    if USE_NEW_REGION_PARAMS:
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
        _log_list_response_debug(list_url, data, page_no, "body가 dict가 아님")
        return [], 0
    total_count = int(body.get("totalCount", 0) or 0)
    raw_items = body.get("items", {})
    # 다국어 API는 데이터 없을 때 items를 ""(빈 문자열)로 주는 경우 있음 → dict로 통일
    items = raw_items if isinstance(raw_items, dict) else {}
    if not isinstance(raw_items, dict) and page_no == 1 and list_url not in _debug_logged_urls:
        _debug_logged_urls.add(list_url)
        print(f"\n  [디버그] items 타입이 dict 아님: type={type(raw_items).__name__!r}, totalCount={total_count}, items값(앞 80자)={str(raw_items)[:80]!r}")
    item = items.get("item")
    if item is None:
        _log_list_response_debug(list_url, data, page_no, "item 없음(빈 결과 또는 키 다름)")
        return [], total_count
    if isinstance(item, dict):
        return [item], total_count
    if isinstance(item, list):
        return [x for x in item if isinstance(x, dict)], total_count
    _log_list_response_debug(list_url, data, page_no, "item이 dict/list가 아님")
    return [], total_count


def fetch_detail_overview(content_id: int, detail_url: str) -> str | None:
    """상세 API로 해당 contentid의 overview 조회 (해당 언어 원문)."""
    extra = {
        "contentId": content_id,
        "defaultYN": "Y",
        "overviewYN": "Y",
    }
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
        if not isinstance(items, dict):
            return None
        item = items.get("item")
        if not item or not isinstance(item, dict):
            return None
        overview = item.get("overview")
        return overview if overview and str(overview).strip() else None
    except (AttributeError, TypeError):
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


def collect_places() -> pd.DataFrame:
    """다국어·지역별 수집 (국문 제외). totalCount 기반 전 페이지 수집, 언어별 개별 파일 저장."""
    print("\n[1단계] 다국어 데이터 수집 (Tour API Service2, 국문 제외)")
    print("  - 대상: EngService2(영어), ChsService2(중어 간체), ChtService2(중어 번체), JpnService2(일어)")
    print("  - 지역: 서울·인천·부산·경기·제주 전체 + 강원(강릉/속초/정선/평창), 경북(경주)")
    print(f"  - 저장: 언어별 {OUTPUT_DIR}/<엔드포인트명>.json")

    rows: list[dict[str, Any]] = []

    for service_name, lang_type, lang_label in _lang_config():
        lang_rows: list[dict[str, Any]] = []
        try:
            list_url = f"{BASE_URL}/{service_name}/areaBasedList2"
            detail_url = f"{BASE_URL}/{service_name}/detailCommon2"

            for area_code, sigungu_code, region_label in REGION_CONFIG:
                try:
                    page_no = 1
                    total_pages: int | None = None
                    region_collected = 0

                    while True:
                        try:
                            items, total_count = fetch_list_page(
                                list_url, area_code, sigungu_code, page_no
                            )
                        except requests.HTTPError as e:
                            if e.response is not None and e.response.status_code == 429:
                                print(f"\n  [429 한도] [{lang_label}] [{region_label}] pageNo={page_no} — 일일 한도 소진 가능. 잠시 후 재실행하세요.")
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

                            title = (it.get("title") or "").strip()
                            addr1 = (it.get("addr1") or "").strip()
                            firstimage = (it.get("firstimage") or "").strip()
                            mapx, mapy = it.get("mapx"), it.get("mapy")
                            try:
                                overview = fetch_detail_overview(content_id, detail_url) or ""
                            except Exception as e:
                                print(f"\n  [경고] contentId={content_id} overview 조회 실패: {e}")
                                overview = ""

                            lang_rows.append({
                                "id": content_id,
                                "lang_type": lang_type,
                                "title": title,
                                "address": addr1,
                                "image_url": firstimage,
                                "mapx": mapx,
                                "mapy": mapy,
                                "overview": overview,
                            })
                            region_collected += 1

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
                        page_no += 1
                        time.sleep(0.3)

                    if region_collected > 0:
                        print(f"\n  → [{lang_label}] - [{region_label}] 완료: {region_collected}건")

                except Exception as e:
                    print(f"\n  [오류] [{lang_label}] [{region_label}] 지역 수집 중 예외: {e}")
                    continue

            if lang_rows:
                _save_lang_file(service_name, lang_rows)
                rows.extend(lang_rows)
            print(f"  [{lang_label}] 언어 수집 합계: {len(lang_rows)}건")

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
        records.append({
            "id": int(row["id"]),
            "lang_type": str(row["lang_type"]),
            "title": str(row["title"]),
            "address": str(row["address"]) if pd.notna(row["address"]) else None,
            "image_url": str(row["image_url"]) if pd.notna(row["image_url"]) else None,
            "mapx": float(row["mapx"]),
            "mapy": float(row["mapy"]),
            "overview": str(row["overview"]),
            "embedding": list(row["embedding"]),
        })

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


# ========== 메인 ==========


def main() -> None:
    print("=" * 60)
    print("AtoC Korea 데이터 파이프라인 (Tour API → 정제 → 임베딩 → Supabase)")
    print("=" * 60)

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
