@echo off
REM ============================================================
REM  EksporIn - setel GitHub Secrets/Variables untuk crawler + AI agent
REM  Butuh GitHub CLI (gh): https://cli.github.com  lalu  gh auth login
REM  Nilai dibaca dari .env.local (TIDAK pernah di-commit).
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "REPO=nafadza14/expor"

where gh >nul 2>&1
if errorlevel 1 (
  echo [X] GitHub CLI belum terinstall. Install: winget install GitHub.cli   lalu: gh auth login
  pause & exit /b 1
)
gh auth status >nul 2>&1
if errorlevel 1 ( gh auth login )

if not exist ".env.local" (
  echo [X] .env.local tidak ditemukan. Salin .env.example menjadi .env.local lalu isi nilainya.
  pause & exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env.local") do (
  set "K=%%a"
  set "V=%%b"
  if not "!V!"=="" (
    if /i "!K!"=="SUMOPOD_AI_KEY"         ( gh secret set SUMOPOD_AI_KEY --repo %REPO% --body "!V!" && echo [OK] secret SUMOPOD_AI_KEY )
    if /i "!K!"=="DATABASE_URL_POSTGRESS" ( gh secret set DATABASE_URL_POSTGRESS --repo %REPO% --body "!V!" && echo [OK] secret DATABASE_URL_POSTGRESS )
    if /i "!K!"=="BRAVE_API_KEY"          ( gh secret set BRAVE_API_KEY --repo %REPO% --body "!V!" && echo [OK] secret BRAVE_API_KEY )
    if /i "!K!"=="WORKFLOW_PAT"           ( gh secret set WORKFLOW_PAT --repo %REPO% --body "!V!" && echo [OK] secret WORKFLOW_PAT )
    if /i "!K!"=="AGENT_MODEL"            ( gh variable set AGENT_MODEL --repo %REPO% --body "!V!" && echo [OK] variable AGENT_MODEL )
  )
)
echo.
echo Selesai. Jalankan run-agents.bat untuk menyalakan semua agent.
pause
