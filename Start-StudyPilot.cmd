@echo off
setlocal
cd /d "%~dp0"
title StudyPilot Local Server
echo Starting StudyPilot...
echo Keep this window open while using the app.
echo.
where node >nul 2>&1
if not errorlevel 1 (
  node tools\serve.cjs
  goto finished
)
where py >nul 2>&1
if not errorlevel 1 (
  echo Open http://127.0.0.1:5500/login.html after the server starts.
  py -3 -m http.server 5500 --bind 127.0.0.1
  goto finished
)
echo Node.js or Python 3 is required to start the local server.
echo Install Node.js LTS from https://nodejs.org and run this file again.
echo You can also serve this folder with VS Code Live Server on port 5500.
:finished
echo.
pause
