@echo off
chcp 65001 >nul
title 도파민플레이션 서버
cd /d "%~dp0"
node server\index.js
echo.
echo 서버가 꺼졌습니다. 이 창을 닫아도 됩니다.
pause
