@echo off
chcp 65001 >nul
title PratoFeito
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :sem_node

node server\index.js --open
echo.
pause
exit /b 0

:sem_node
echo.
echo   O PratoFeito precisa do Node.js 22.13 ou mais novo.
echo   Tentando instalar a versão LTS pelo winget...
echo.
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
  echo.
  echo   Não deu para instalar automaticamente. Abrindo a página de download...
  start "" https://nodejs.org/pt-br/download
  pause
  exit /b 1
)
echo.
echo   Node.js instalado. Feche esta janela e abra o iniciar.bat de novo.
pause
exit /b 0
