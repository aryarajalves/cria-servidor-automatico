import os
import sys
import uvicorn
from app.main import app
import multiprocessing

# Necessary for PyInstaller to handle multiprocessing if used (FastAPI/Uvicorn might use it)
multiprocessing.freeze_support()

if __name__ == "__main__":
    # Ensure port 8000.
    # In a frozen app, reload=True is not available.
    print("Iniciando AutoServer Deployer...")
    print("Acesse o painel em: http://localhost:8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="info", reload=True)
