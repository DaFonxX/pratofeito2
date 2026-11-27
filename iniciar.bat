@echo off
chcp 65001 >nul
title PratoFeito
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%APPDATA%\fnm\aliases\default\node.exe" set "NODE_EXE=%APPDATA%\fnm\aliases\default\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\fnm\aliases\default\node.exe" set "NODE_EXE=%LOCALAPPDATA%\fnm\aliases\default\node.exe"

if not defined NODE_EXE (
  echo.
  echo   Nao encontrei o Node.js neste computador.
  echo   Instale a versao LTS em https://nodejs.org ^(ou rode "fnm install 26"^)
  echo   e depois abra este arquivo de novo.
  echo.
  pause
  exit /b 1
)

"%NODE_EXE%" server\index.js --open
echo.
echo   O servidor parou. Veja a mensagem acima.
pause
