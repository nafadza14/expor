@echo off
REM ============================================================
REM  EksporIn - push perubahan ke GitHub (branch main)
REM  Pakai:  push.bat                      (ditanya pesan commit)
REM          push.bat "feat: pesan commit" (langsung)
REM  Setelah push, Vercel otomatis deploy versi terbaru (live).
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
  echo [X] Git belum terinstall. Download: https://git-scm.com/download/win
  pause & exit /b 1
)

REM Folder ini di-clone dari luar Windows; izinkan git memakainya.
git status >nul 2>&1
if errorlevel 1 git config --global --add safe.directory "%CD:\=/%"

REM Pastikan file rahasia tidak ikut ter-push.
if exist ".env.local" (
  git check-ignore -q .env.local
  if errorlevel 1 (
    echo [X] .env.local TIDAK di-ignore git. Push dibatalkan supaya API key tidak bocor.
    pause & exit /b 1
  )
)

set "MSG=%~1"
if "%MSG%"=="" set /p "MSG=Pesan commit (Enter = update): "
if "%MSG%"=="" set "MSG=update"

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
  if errorlevel 1 ( echo [X] Commit gagal. & pause & exit /b 1 )
) else (
  echo Tidak ada perubahan baru untuk di-commit, lanjut push commit yang ada.
)

echo.
echo Sinkronisasi dengan GitHub...
git pull --rebase origin main
if errorlevel 1 (
  echo [X] Gagal pull/rebase. Selesaikan konflik lalu jalankan push.bat lagi.
  pause & exit /b 1
)

git push origin main
if errorlevel 1 (
  echo [X] Push gagal. Login GitHub dulu: jalankan  gh auth login  atau masukkan token saat diminta.
  pause & exit /b 1
)

echo.
echo [OK] Kode sudah di GitHub. Vercel akan deploy otomatis dalam 1-2 menit.
echo      Workflow "Migrate Postgres" juga jalan otomatis jika ada migration baru.
pause
