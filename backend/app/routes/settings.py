from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)
router = APIRouter()

class SettingsRequest(BaseModel):
    cloudflare_token: Optional[str] = None
    portainer_user: Optional[str] = None
    portainer_password: Optional[str] = None
    default_domain_id: Optional[str] = None
    default_domain_name: Optional[str] = None
    stack_export_path: Optional[str] = None
    host: Optional[str] = None

class PortainerTokenRequest(BaseModel):
    portainer_url: str
    username: str
    password: str

class StackCredentialsUpdateRequest(BaseModel):
    host: str
    stack_name: str
    admin_email: str
    admin_password: str
    version: Optional[str] = None

@router.get("/settings")
async def get_system_settings(host: Optional[str] = None):
    from app.database import get_all_settings
    settings = get_all_settings(host)
    settings['cloudflare_token_env'] = bool(os.getenv("CLOUDFLARE_API_TOKEN"))
    return settings

@router.post("/settings")
async def save_system_settings(req: SettingsRequest):
    from app.database import save_setting, get_setting, save_stack_credentials
    try:
        host = req.host or 'global'
        if req.cloudflare_token:
            token = req.cloudflare_token.strip()
            save_setting("cloudflare_token", token, 'global')
            
        if req.portainer_user:
            save_setting("portainer_user", req.portainer_user, host)
            
        if req.portainer_password:
            save_setting("portainer_password", req.portainer_password, host)

        # Sincroniza com stack_credentials se for Portainer
        if req.portainer_user or req.portainer_password:
            p_user = req.portainer_user or get_setting("portainer_user", host)
            p_pass = req.portainer_password or get_setting("portainer_password", host)
            save_stack_credentials(host, "portainer", p_user, p_pass)

        if req.default_domain_id is not None:
            save_setting("default_domain_id", req.default_domain_id, host)
            
        if req.default_domain_name is not None:
            save_setting("default_domain_name", req.default_domain_name, host)

        if req.stack_export_path is not None:
            save_setting("stack_export_path", req.stack_export_path, host)

        return {"status": "success", "message": "Configurações salvas com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao salvar configurações: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/portainer/token")
async def generate_portainer_token_endpoint(req: PortainerTokenRequest):
    from app.portainer import get_portainer_token
    try:
        token = get_portainer_token(req.portainer_url, req.username, req.password, verify=False)
        return {"status": "success", "token": token, "message": "Autenticação no Portainer realizada com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao gerar token do Portainer: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/update-stack-credentials")
def update_stack_credentials_endpoint(req: StackCredentialsUpdateRequest):
    from app.database import save_stack_credentials, save_setting
    try:
        save_stack_credentials(req.host, req.stack_name, req.admin_email, req.admin_password)
        if req.version is not None:
            save_setting(f"stack_version_{req.stack_name}", req.version, req.host)
        return {"status": "success", "message": "Credenciais atualizadas com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao atualizar credenciais da stack: {e}")
        raise HTTPException(status_code=500, detail=str(e))
