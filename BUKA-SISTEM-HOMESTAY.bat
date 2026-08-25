@echo off
title Pelancar Sistem Tempahan SofiaRizqi Homestay
color 0A
cls
echo ====================================================
echo    SISTEM TEMPAHAN & RESIT SOFIARIZQI HOMESTAY
echo ====================================================
echo.
echo  Membuka pelayan tempatan (Node.js Express)...
echo.

cd /d "%~dp0"
start "" http://localhost:3000
node server.js

pause
