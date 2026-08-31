@echo off
cd /d "C:\Users\USER\Claude\Projects\Platform ekspor\eksporin"
echo.
echo ========================================
echo   Pushing EksporIn ke GitHub...
echo ========================================
echo.
git add -A
git commit -m "fix: onboarding wizard resilience - fallback HS codes, timeout, error handling"
git push -u origin main --force
echo.
if %errorlevel%==0 (
    echo ✅ BERHASIL! Kode sudah di GitHub.
    echo Sekarang buka https://vercel.com untuk deploy.
) else (
    echo ❌ Gagal push. Coba login GitHub dulu.
)
echo.
pause
