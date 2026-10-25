@echo off
REM ============================================================
REM  EksporIn - jalankan AI research agent di PC ini (opsional)
REM  Butuh Python 3.10+ dan .env.local berisi DATABASE_URL_POSTGRESS
REM  dan SUMOPOD_AI_KEY.  Contoh:
REM     run-agent-local.bat                 (6 misi pilihan planner)
REM     run-agent-local.bat --hs 1801 --country DE
REM     run-agent-local.bat --dry-run --hs 0901 --country JP   (tanpa DB)
REM ============================================================
setlocal
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 ( echo [X] Python belum terinstall: https://www.python.org/downloads/ & pause & exit /b 1 )
python -m pip install -q -r python_scrapers\requirements.txt
python -m python_scrapers.tests.test_agent >nul || ( echo [X] Self-test gagal. & pause & exit /b 1 )
if "%~1"=="" (
  python -m python_scrapers.agent.run --missions 6 --minutes 30 --concurrency 2
) else (
  python -m python_scrapers.agent.run %*
)
pause
