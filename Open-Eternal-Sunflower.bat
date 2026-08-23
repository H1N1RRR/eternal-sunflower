@echo off
setlocal
cd /d "%~dp0"

set "PROJECT_DIR=%~dp0"
set "NODE_EXE="

where node.exe >nul 2>&1
if not errorlevel 1 set "NODE_EXE=node.exe"

if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)

if not defined NODE_EXE (
  echo Node.js was not found.
  echo Install Node.js 20 or newer, then run npm install in this folder.
  pause
  exit /b 1
)

if not exist "%PROJECT_DIR%node_modules\vite\bin\vite.js" (
  echo Project dependencies are missing.
  echo Run npm install in this folder first.
  pause
  exit /b 1
)

start "Eternal Sunflower server - keep this window open" cmd /k ""%NODE_EXE%" "%PROJECT_DIR%node_modules\vite\bin\vite.js" --host 127.0.0.1 --port 4173"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:4173/"
endlocal
