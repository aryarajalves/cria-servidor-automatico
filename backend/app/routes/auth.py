from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import os
import logging
import asyncio
import time

logger = logging.getLogger(__name__)
router = APIRouter()

class ServerCredentials(BaseModel):
    host: str
    username: str
    password: str

class VerifyConnectionRequest(BaseModel):
    host: str
    username: str
    password: str

class PasswordChangeRequest(BaseModel):
    host: str
    username: str
    password: str
    new_password: str

from app.auth_middleware import create_access_token, verify_jwt

class LoginRequest(BaseModel):
    email: str
    password: str
@router.post("/login")
def login_endpoint(req: LoginRequest):
    """
    Autenticação mestre da aplicação via variáveis de ambiente com geração de token JWT.
    """
    admin_email = os.getenv("ADMIN_EMAIL", "admin@admin.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    
    if req.email == admin_email and req.password == admin_password:
        token = create_access_token(data={"sub": req.email})
        return {
            "status": "success",
            "message": "Logado com sucesso!",
            "token": token
        }
    
    raise HTTPException(status_code=401, detail="Email ou senha incorretos.")

@router.post("/change-server-password", dependencies=[Depends(verify_jwt)])
def change_server_password_endpoint(req: PasswordChangeRequest):
    """
    Altera a senha SSH do servidor.
    """
    try:
        from app.installer import change_ssh_password
        result = change_ssh_password(req.host, req.username, req.password, req.new_password)
        return result
    except Exception as e:
        logger.error(f"Falha ao alterar senha do servidor: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-connection", dependencies=[Depends(verify_jwt)])
async def verify_connection(credentials: ServerCredentials):
    """
    Verifica APENAS se é possível conectar via SSH (Login).
    Rápido: ~1-3 segundos.
    """
    start_time = time.time()
    
    logger.info("="*60)
    logger.info(f"[ENDPOINT] /verify-connection recebido")
    logger.info(f"[ENDPOINT] Host: {credentials.host}")
    logger.info(f"[ENDPOINT] Username: {credentials.username}")
    logger.info(f"[ENDPOINT] Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    from app.installer import verify_ssh_connection
    
    try:
        logger.info(f"[ENDPOINT] Chamando verify_ssh_connection em thread separado...")
        # Run SSH operation in thread pool to avoid blocking event loop
        result = await asyncio.to_thread(
            verify_ssh_connection, 
            credentials.host, 
            credentials.username, 
            credentials.password
        )
        
        elapsed = time.time() - start_time
        
        if result:
            logger.info(f"[ENDPOINT] ✓ Conexão bem-sucedida em {elapsed:.2f}s")
            return {"message": "Conectado com sucesso!"}
        else:
            logger.error(f"[ENDPOINT] ✗ Conexão falhou em {elapsed:.2f}s")
            raise HTTPException(status_code=401, detail="Falha na autenticação ou host inacessível")
            
    except HTTPException:
        raise
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[ENDPOINT] ✗ Exceção após {elapsed:.2f}s: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
