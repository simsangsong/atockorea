@echo off
title Tour Translation Pipeline
echo ======================================================
echo  AtoC Korea - Tour Translation Pipeline
echo  16 tours x 5 languages = 80 tasks
echo  Do NOT close this window while running overnight!
echo ======================================================
echo.

cd /d "%~dp0"
python translate_tours.py %*

echo.
echo Pipeline finished. Press any key to exit.
pause > nul
