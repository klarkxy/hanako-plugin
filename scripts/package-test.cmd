@echo off
setlocal
node "%~dp0sync-all.mjs" --test %*
