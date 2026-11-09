@echo off
REM Levanta Fukusuke (pagina + backend) y abre el navegador. Presiona Ctrl+C o cierra esta ventana para detenerlo.
chcp 65001 >nul
cd /d "%~dp0"
node scripts\start.js --abrir
pause
