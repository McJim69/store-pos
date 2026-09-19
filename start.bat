@echo off
echo Starting Convenience Store POS Server...
echo The POS is now running at http://localhost:5000
echo.
echo To access from other devices on the network, find this computer's IPv4 address.
echo.
call .\venv\Scripts\activate.bat
start http://localhost:5000
python server.py
pause
