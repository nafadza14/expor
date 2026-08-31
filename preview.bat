@echo off
cd /d "C:\Users\USER\Claude\Projects\Platform ekspor\eksporin"

echo Menyiapkan preview lokal...

:: Swap db.js ke versi node:sqlite untuk lokal
copy /Y src\db.js src\db-vercel.bak >nul 2>&1
copy /Y src\db-local.js src\db.js >nul 2>&1

:: Hapus database lama agar seed ulang
rmdir /s /q data >nul 2>&1

:: Jalankan server
echo.
echo ========================================
echo   Membuka EksporIn di browser...
echo ========================================
echo.
start http://localhost:3000
node server.js

:: Kembalikan db.js ke versi Vercel saat server ditutup
copy /Y src\db-vercel.bak src\db.js >nul 2>&1
del src\db-vercel.bak >nul 2>&1
