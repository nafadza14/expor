@echo off
title EksporIn Server
cd /d "%~dp0"
echo ============================================
echo   EksporIn - Buyer Intelligence Platform
echo   Jangan tutup jendela ini selama preview!
echo ============================================
echo.
node server.js
echo.
echo Server berhenti. Tekan tombol apa saja untuk menutup.
pause >nul
