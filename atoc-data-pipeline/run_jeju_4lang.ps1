# AtoC Korea 데이터 파이프라인 — 제주만, 4개 언어(영/중간/중번/일) 수집
# 사용법: .\run_jeju_4lang.ps1
# 일 1000건 한도 대비: 언어당 약 200건 이하로 제한하려면 MAX_ITEMS_PER_LANG=200 설정

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$env:REGION_FILTER = "jeju"
$env:LANG_FILTER = "en,chs,cht,ja"
# 일 1000건 한도 시 권장: $env:MAX_ITEMS_PER_LANG = "200"
if (-not $env:MAX_ITEMS_PER_LANG) {
    $env:MAX_ITEMS_PER_LANG = "200"
}
Write-Host "REGION_FILTER=$env:REGION_FILTER (제주만)" -ForegroundColor Cyan
Write-Host "LANG_FILTER=$env:LANG_FILTER (영/중간/중번/일)" -ForegroundColor Cyan
Write-Host "MAX_ITEMS_PER_LANG=$env:MAX_ITEMS_PER_LANG (언어당 상한)" -ForegroundColor Cyan

python data_pipeline.py
exit $LASTEXITCODE
