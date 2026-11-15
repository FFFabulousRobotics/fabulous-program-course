@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22+ is required. Install Node.js and reopen this window. & pause & exit /b 1)
node server.mjs
pause
