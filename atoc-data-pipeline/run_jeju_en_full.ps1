# 제주 지역 + 영어만 + 상세 4종 전부 수집 (areaBasedList2 + detailCommon2 + detailIntro2 + detailInfo2 + detailImage2)
# 사용법: .\run_jeju_en_full.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$env:REGION_FILTER = "jeju"
$env:LANG_FILTER = "en"
$env:FULL_DETAIL_COLLECT = "1"

Write-Host "REGION_FILTER=$env:REGION_FILTER (제주만)" -ForegroundColor Cyan
Write-Host "LANG_FILTER=$env:LANG_FILTER (영어만)" -ForegroundColor Cyan
Write-Host "FULL_DETAIL_COLLECT=1 (detailIntro2, detailInfo2, detailImage2 포함)" -ForegroundColor Cyan

python data_pipeline.py
exit $LASTEXITCODE
