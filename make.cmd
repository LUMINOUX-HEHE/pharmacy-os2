@echo off
setlocal EnableDelayedExpansion

if "%~1"=="dev" (
  docker compose up --build
  exit /b !ERRORLEVEL!
)

if "%~1"=="build" (
  "C:\Program Files\nodejs\npm.cmd" run build
  exit /b !ERRORLEVEL!
)

if "%~1"=="migrate" (
  if not defined DATABASE_URL set DATABASE_URL=postgresql://pharmacy:pharmacy@localhost:5432/pharmacy_os?schema=public
  "C:\Program Files\nodejs\node.exe" .\node_modules\prisma\build\index.js migrate deploy --schema=apps/api/prisma/schema.prisma
  exit /b !ERRORLEVEL!
)

if "%~1"=="seed" (
  if not defined DATABASE_URL set DATABASE_URL=postgresql://pharmacy:pharmacy@localhost:5432/pharmacy_os?schema=public
  "C:\Program Files\nodejs\node.exe" .\node_modules\tsx\dist\cli.mjs apps/api/prisma/seed.ts
  exit /b !ERRORLEVEL!
)

if "%~1"=="test" (
  "C:\Program Files\nodejs\npm.cmd" test
  exit /b !ERRORLEVEL!
)

if "%~1"=="lint" (
  "C:\Program Files\nodejs\npm.cmd" run lint
  exit /b !ERRORLEVEL!
)

echo Usage: make ^<dev^|build^|migrate^|seed^|test^|lint^>
exit /b 1
