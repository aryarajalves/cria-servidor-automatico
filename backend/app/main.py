from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import sys

from app.database import init_db
from app.routes import auth, servers, settings, cloudflare, installer, cluster

# Configura logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializa Banco de Dados
init_db()

# Inicializa FastAPI
app = FastAPI()

# Configuração do CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler Global
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Erro inesperado em {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Tente novamente mais tarde."}
    )

# Inclusão dos roteadores modulares
app.include_router(auth.router)
app.include_router(servers.router)
app.include_router(settings.router)
app.include_router(cloudflare.router)
app.include_router(installer.router)
app.include_router(cluster.router)

# Configuração de arquivos estáticos
if getattr(sys, 'frozen', False):
    base_dir = os.path.join(sys._MEIPASS, "app")
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

static_dir = os.path.join(base_dir, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

# Rota fallback para SPA
@app.get("/{full_path:path}")
def read_root(full_path: str = ""):
    return FileResponse(os.path.join(static_dir, "index.html"))
