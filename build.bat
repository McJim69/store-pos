@echo off
echo Installing PyInstaller...
call .\venv\Scripts\activate.bat
pip install pyinstaller

echo.
echo Compiling POS Server...
pyinstaller --onefile --add-data "index.html;." --add-data "style.css;." --add-data "app.js;." --add-data "fonts.css;." --add-data "fonts;fonts" server.py

echo.
echo Build complete! The executable is located at: dist\server.exe
pause
