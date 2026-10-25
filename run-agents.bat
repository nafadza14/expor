@echo off
REM ============================================================
REM  EksporIn - jalankan SEMUA agent sekarang di GitHub Actions
REM  (migrasi DB, crawler Python, AI research agent, enrich, scrape)
REM  Butuh: gh auth login + secrets sudah diset (setup-github.bat)
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"
set "REPO=nafadza14/expor"

where gh >nul 2>&1
if errorlevel 1 (
  echo [X] GitHub CLI belum terinstall. Install: winget install GitHub.cli   lalu: gh auth login
  pause & exit /b 1
)

echo [1/5] Migrasi database...
gh workflow run migrate.yml --repo %REPO% || goto :fail
echo      tunggu 60 detik supaya tabel baru siap...
timeout /t 60 /nobreak >nul

echo [2/5] AI research agent (6 misi)...
gh workflow run agent.yml --repo %REPO% -f missions=6 -f minutes=40 || goto :fail

echo [3/5] Crawler Python (OSM, Companies House, SIRENE, SEC)...
gh workflow run crawl-py.yml --repo %REPO% -f minutes=35 -f concurrency=10 || goto :fail

echo [4/5] Enrichment kontak (website, email, AI klasifikasi)...
gh workflow run enrich.yml --repo %REPO% -f max=250 -f mode=contacts -f concurrency=6 || goto :fail

echo [5/5] Pipeline Node (GLEIF, Wikidata)...
gh workflow run scrape.yml --repo %REPO% -f command=run -f max=200 || goto :fail

echo.
timeout /t 10 /nobreak >nul
gh run list --repo %REPO% --limit 8
echo.
echo [OK] Semua agent jalan. Pantau di https://github.com/%REPO%/actions
echo      Data baru muncul di platform (Direktori Buyer + Admin) begitu agent menyimpan buyer.
pause
exit /b 0

:fail
echo [X] Gagal menjalankan workflow. Pastikan sudah push (push.bat) dan login gh dengan akses repo.
pause
exit /b 1
