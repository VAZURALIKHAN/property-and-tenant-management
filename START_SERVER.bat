@echo off
title Property & Tenant Management System - Production Server
color 0A
echo.
echo  ============================================================
echo    PROPERTY ^& TENANT MANAGEMENT SYSTEM
echo    Production Server (Waitress WSGI)
echo  ============================================================
echo.
echo  [1] Starting server...

cd /d "%~dp0"

:: Check if python exists
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found! Please install Python 3.10+
    pause
    exit /b 1
)

:: Install requirements if needed
echo  [2] Checking dependencies...
python -m pip install -r requirements.txt --quiet

:: Initialize database if not exists
echo  [3] Initializing database...
python database.py

echo.
echo  [4] Launching Production Server...
echo.
echo  ============================================================
echo    Open your browser at:  http://127.0.0.1:5000
echo    OR on your network at: http://%COMPUTERNAME%:5000
echo  ============================================================
echo.
echo  Demo Login Credentials:
echo    Admin   : admin@property.com    / admin123
echo    Manager : manager@property.com  / manager123
echo    Tenant  : tenant@property.com   / tenant123
echo.
echo  Press Ctrl+C to stop the server.
echo.

:: Auto-open browser
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5000"

:: Start server
python app.py

echo.
echo  Server stopped. Press any key to exit.
pause >nul
