# 제주 + 영어 + NO.1~NO.9 전부 수집
# 목록: NO.3 areaBasedSyncList2, NO.6 areaBasedList2, NO.7 locationBasedList2, NO.8 searchKeyword2
# 상세: NO.1 detailIntro2, NO.2 detailInfo2, NO.4 detailCommon2(전체), NO.5 detailImage2
# 참조: NO.9 lclsSystmCode2 (분류코드, 1회 저장)
# 건수 늘리기: $env:CONTENT_TYPE_IDS = "76,14,32,39,38" (관광지,문화시설,숙박,음식점,쇼핑). API 지원 시 더 많이 수집됨.
# 사용법: .\run_jeju_en_all_nine.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$env:REGION_FILTER = "jeju"
$env:LANG_FILTER = "en"
$env:COLLECT_ALL_NINE = "1"
# 일 1000건 한도 시 건수 제한 권장: $env:MAX_ITEMS_PER_LANG = "30"

Write-Host "REGION_FILTER=$env:REGION_FILTER (제주만)" -ForegroundColor Cyan
Write-Host "LANG_FILTER=$env:LANG_FILTER (영어만)" -ForegroundColor Cyan
Write-Host "COLLECT_ALL_NINE=1 (NO.1~9 전부 수집)" -ForegroundColor Cyan

python data_pipeline.py
exit $LASTEXITCODE
