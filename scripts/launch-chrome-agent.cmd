@echo off
REM Launches Chrome with remote-debugging enabled on port 9222 and an isolated
REM AgentProfile so the agent can drive it via CDP. Works around Chrome 136+
REM behavior where --remote-debugging-port is silently dropped if the default
REM profile is already in use.
REM
REM Usage: double-click this file, or set a Windows shortcut Target to its
REM full path.

set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not defined CHROME_EXE (
    echo ERROR: chrome.exe not found in any of the standard install paths.
    echo   - %ProgramFiles%\Google\Chrome\Application\chrome.exe
    echo   - %LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
    echo   - C:\Program Files ^(x86^)\Google\Chrome\Application\chrome.exe
    echo.
    echo Install Chrome or set CHROME_EXE manually before launching.
    pause
    exit /b 1
)

start "" "%CHROME_EXE%" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\AgentProfile"
