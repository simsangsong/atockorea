# AtoC Korea 데이터 파이프라인 — 영어(EngService2)만 수집
# 사용법: .\run_english_only.ps1
# 디버그(API 응답 JSON 저장): $env:TOUR_API_DEBUG="1"; .\run_english_only.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$env:LANG_FILTER = "en"
Write-Host "LANG_FILTER=$env:LANG_FILTER (영어만 수집)" -ForegroundColor Cyan
if ($env:TOUR_API_DEBUG) {
    Write-Host "TOUR_API_DEBUG=1 — API 응답 디버그 파일 저장됨" -ForegroundColor Yellow
}

python data_pipeline.py
exit $LASTEXITCODE
