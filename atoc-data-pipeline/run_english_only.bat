@echo off
REM AtoC Korea 데이터 파이프라인 — 영어(EngService2)만 수집
REM 사용법: run_english_only.bat
REM 디버그(API 응답 JSON 저장): set TOUR_API_DEBUG=1 후 실행

cd /d "%~dp0"
set LANG_FILTER=en
echo LANG_FILTER=%LANG_FILTER% (영어만 수집)
if defined TOUR_API_DEBUG echo TOUR_API_DEBUG=1 — API 응답 디버그 파일 저장됨

python data_pipeline.py
exit /b %ERRORLEVEL%
