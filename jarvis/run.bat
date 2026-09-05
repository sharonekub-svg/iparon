@echo off
REM הרצת ג'ארוויס בווינדוס. לחיצה כפולה על הקובץ הזה מספיקה.
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo פייתון לא מותקן, או שלא סומן "Add python.exe to PATH" בהתקנה.
  echo הורד מ- https://www.python.org/downloads/
  echo סמן את התיבה Add python.exe to PATH, ואז סגור את החלון הזה ופתח מחדש.
  echo.
  pause
  exit /b 1
)

if not exist "data\demo" (
  echo בונה את נתוני הדמו...
  python data\generate_demo.py
)

echo.
echo פתח בדפדפן:  http://127.0.0.1:8765
echo לעצירה: Ctrl+C
echo.
python agent\main.py
pause
