@echo off
setlocal
node "%~dp0update-marketplace.mjs" %*
exit /b %errorlevel%