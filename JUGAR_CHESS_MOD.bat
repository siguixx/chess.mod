@echo off
title CHESS.MOD — Iniciando...
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
node desktop\launch.mjs
if errorlevel 1 (
  echo.
  echo Ocurrio un error al iniciar CHESS.MOD.
  pause
)
