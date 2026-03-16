# 국문관광정보 LOD → places 파이프라인

공공데이터포털 **국문관광정보 LOD 데이터셋**(약 15만 건)을 다운로드한 뒤,
NT 파일을 파싱·매핑·정제하여 Supabase `places` 테이블에 적재합니다.

## 1. LOD 데이터 다운로드

- **공공데이터포털**: https://www.data.go.kr/data/15043617/fileData.do
- 회원가입 후 해당 데이터셋 **활용신청** → **파일데이터** 탭에서 다운로드
- 다운로드한 파일(ZIP 또는 NT)을 `lod/raw/` 폴더에 넣고, 아래 스크립트로 압축 해제 또는 경로 지정

또는 터미널에서:
```bash
cd atoc-data-pipeline/lod
python download_lod.py
```
(자동 다운로드가 불가하면 안내 메시지대로 수동 다운로드 후 `raw/`에 넣기)

## 2. 샘플로 파서·정제 검증

```bash
python lod_to_places.py --sample
```
- `sample_lod.nt` 로 파서 + 매핑 + 정제만 수행 (DB 적재 없음, 로그로 확인)

## 3. 전체 실행 (정제 후 DB 적재)

```bash
python lod_to_places.py --input raw/국문관광정보.nt
# 또는
python lod_to_places.py --input raw/
```
- `--dry-run`: DB 업서트 생략, 파일만 출력
- `--limit N`: 처음 N건만 처리 (테스트용)

## 4. 매핑 (LOD → places)

| places 컬럼 | LOD 예시 (실제 데이터에 맞게 수정 가능) |
|-------------|----------------------------------------|
| id | contentid 또는 URI에서 추출한 숫자 |
| lang_type | ko (국문 LOD) |
| title | 제목/이름 속성 |
| address | 주소 속성 |
| mapx, mapy | 위경도 (geo 또는 WKT) |
| overview | 설명/개요 |
| image_url | 대표 이미지 URL |

실제 NT 파일의 predicate를 확인한 뒤 `lod_to_places.py` 내 매핑 테이블을 수정하세요.
