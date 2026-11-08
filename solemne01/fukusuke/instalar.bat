@echo off
REM Instala dependencias y prepara la base de datos (ejecutar una sola vez). Requiere Node 20+ y MySQL/MariaDB encendido (XAMPP).
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo No se encontro Node.js. Instalalo desde https://nodejs.org ^(version LTS^) y vuelve a intentar. & pause & exit /b 1)
call npm install --no-audit --no-fund || (pause & exit /b 1)
call npm run setup || (pause & exit /b 1)
echo.
echo Instalacion lista. Ahora haz doble clic en iniciar.bat
pause
