from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import sys
import time
import uuid

from app.database import init_db
from app.routes import auth, servers, settings, cloudflare, installer, cluster, logs, ssh_keys
from app.core.logger import setup_logging, logger

# Configura logging (formato + horário de Brasília em todos os logs)
setup_logging()

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


# Middleware de Debug: registra início, fim e erros de TODA requisição HTTP
@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    logger.debug(
        f"[{request_id}] -> {request.method} {request.url.path} "
        f"| query={dict(request.query_params)} | client={request.client.host if request.client else '?'}"
    )

    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            f"[{request_id}] <- {request.method} {request.url.path} "
            f"| ERRO NÃO TRATADO após {duration_ms:.1f}ms: {exc}",
            exc_info=True,
        )
        raise

    duration_ms = (time.time() - start_time) * 1000
    status_code = response.status_code

    if status_code >= 500:
        log_fn = logger.error
    elif status_code >= 400:
        log_fn = logger.warning
    else:
        log_fn = logger.info

    log_fn(
        f"[{request_id}] <- {request.method} {request.url.path} "
        f"| status={status_code} | {duration_ms:.1f}ms"
    )

    return response


# Exception Handler Global
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Erro inesperado em {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Tente novamente mais tarde."}
    )

from fastapi import Depends
from app.auth_middleware import verify_jwt

# Inclusão dos roteadores modulares
app.include_router(auth.router)
app.include_router(servers.router, dependencies=[Depends(verify_jwt)])
app.include_router(settings.router, dependencies=[Depends(verify_jwt)])
app.include_router(cloudflare.router, dependencies=[Depends(verify_jwt)])
app.include_router(installer.router, dependencies=[Depends(verify_jwt)])
app.include_router(cluster.router, dependencies=[Depends(verify_jwt)])
app.include_router(logs.router, dependencies=[Depends(verify_jwt)])
app.include_router(ssh_keys.router, dependencies=[Depends(verify_jwt)])

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
