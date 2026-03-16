# 제주 + 국문(KorService2) 전 테마·전 정보 수집 (기존 건 건너뛰기 RESUME=1)
# 테마: 관광지(12), 문화시설(14), 축제(15), 여행코스(25), 레포츠(28), 숙박(32), 쇼핑(38), 음식점(39)
# 사용법: .\run_jeju_ko_all.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 한글 로그가 깨지지 않도록 터미널 UTF-8 사용
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"
if ($Host.UI.RawUI) { chcp 65001 | Out-Null }

$env:REGION_FILTER = "jeju"
$env:LANG_FILTER = "ko"
$env:COLLECT_ALL_NINE = "1"
$env:CONTENT_TYPE_IDS = "12,14,32,39,38,28,15,25"
$env:RESUME = "1"

Write-Host "REGION=jeju, LANG=ko (국문), NO.1~9, 모든 테마, RESUME=1" -ForegroundColor Cyan
python data_pipeline.py
exit $LASTEXITCODE
