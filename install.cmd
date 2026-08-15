@echo off
rem ===========================================================================
rem  dsh-sound-alert installer for Windows.
rem
rem  Double-click this file (or run it from cmd / PowerShell) to install the
rem  plugin into your DSH profile. It invokes install.ps1 with
rem  -ExecutionPolicy Bypass, so no PowerShell policy change is needed and
rem  downloaded (Mark-of-the-Web) copies run fine.
rem
rem  Usage:  install.cmd [profile]      (default profile: web)
rem ===========================================================================

setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "RC=%ERRORLEVEL%"

rem Always pause so the window stays open after a double-click (when stdin is
rem redirected or closed, pause returns immediately instead of waiting).
echo.
pause
exit /b %RC%
