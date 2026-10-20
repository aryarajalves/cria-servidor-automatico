from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
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
def get_system_settings(host: Optional[str] = None):
    from app.database import get_all_settings
    settings = get_all_settings(host or 'global')
    settings['cloudflare_token_env'] = False
    if not settings.get('cloudflare_token') and os.getenv("CLOUDFLARE_API_TOKEN"):
        settings['cloudflare_token'] = os.getenv("CLOUDFLARE_API_TOKEN")
    return settings

@router.post("/settings")
def save_system_settings(req: SettingsRequest):
    from app.database import save_setting, get_setting, save_stack_credentials
    try:
        host = req.host or 'global'
        if req.cloudflare_token is not None:
            token = req.cloudflare_token.strip()
            if host != 'global':
                save_setting("cloudflare_token", token, host)
            save_setting("cloudflare_token", token, 'global')
            
        if req.portainer_user is not None:
            save_setting("portainer_user", req.portainer_user, host)
            
        if req.portainer_password is not None:
            save_setting("portainer_password", req.portainer_password, host)

        # Sincroniza com stack_credentials se for Portainer
        if req.portainer_user is not None or req.portainer_password is not None:
            p_user = req.portainer_user if req.portainer_user is not None else get_setting("portainer_user", host)
            p_pass = req.portainer_password if req.portainer_password is not None else get_setting("portainer_password", host)
            
            if not p_user and not p_pass:
                from app.database import delete_stack_credentials
                delete_stack_credentials(host, "portainer")
            else:
                save_stack_credentials(host, "portainer", p_user or "", p_pass or "")

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
def generate_portainer_token_endpoint(req: PortainerTokenRequest):
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

class ChangeSshPortRequest(BaseModel):
    host: str
    username: str
    new_port: int
    current_port: Optional[int] = 22
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

class UpdateSshPortLocalRequest(BaseModel):
    host: str
    port: int
    server_id: Optional[int] = None
    username: Optional[str] = "root"
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

@router.post("/settings/change-ssh-port")
def change_ssh_port_endpoint(req: ChangeSshPortRequest):
    """
    Altera a porta do serviço SSH diretamente na VPS remota e sincroniza com o banco de dados.
    """
    from app.services.ssh_port_service import change_vps_ssh_port
    try:
        res = change_vps_ssh_port(
            host=req.host,
            username=req.username,
            new_port=req.new_port,
            current_port=req.current_port or 22,
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
        return res
    except ValueError as e:
        logger.warning(f"Erro de validação ao trocar porta SSH: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro inesperado ao trocar porta SSH: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao trocar porta SSH: {str(e)}")

class DetectSshPortRequest(BaseModel):
    host: str
    candidate_ports: Optional[List[int]] = None

@router.post("/settings/detect-ssh-port")
def detect_ssh_port_endpoint(req: DetectSshPortRequest):
    """
    Analisa e detecta em tempo real qual porta SSH está respondendo ativamente na VPS.
    """
    from app.services.base_ssh import detect_active_ssh_port
    try:
        active_port = detect_active_ssh_port(req.host, candidate_ports=req.candidate_ports)
        if active_port:
            return {
                "status": "success",
                "host": req.host,
                "active_port": active_port,
                "message": f"Porta SSH ativa detectada: {active_port}"
            }
        return {
            "status": "not_found",
            "host": req.host,
            "active_port": None,
            "message": "Nenhuma porta SSH padrão ou cadastrada respondeu à sondagem."
        }
    except Exception as e:
        logger.error(f"Erro ao detectar porta SSH ativa em {req.host}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/settings/update-ssh-port-local")
def update_ssh_port_local_endpoint(req: UpdateSshPortLocalRequest):
    """
    Atualiza apenas o registro da porta SSH no banco de dados local do AutoServer.
    """
    from app.services.ssh_port_service import update_ssh_port_local
    try:
        res = update_ssh_port_local(
            host=req.host,
            port=req.port,
            server_id=req.server_id,
            username=req.username or "root",
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
        return res
    except ValueError as e:
        logger.warning(f"Erro de validação ao atualizar porta local: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro inesperado ao atualizar porta local: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class SshPasswordAuthStatusRequest(BaseModel):
    host: str
    username: str = "root"
    port: Optional[int] = 22
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

class SshPasswordAuthToggleRequest(BaseModel):
    host: str
    username: str = "root"
    enabled: bool
    port: Optional[int] = 22
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

@router.post("/settings/ssh-password-auth/status")
def get_ssh_password_auth_status_endpoint(req: SshPasswordAuthStatusRequest):
    """
    Verifica o status atual da autenticação por senha do SSH diretamente na VPS remota.
    """
    from app.services.ssh_security_service import get_password_auth_status
    try:
        return get_password_auth_status(
            host=req.host,
            username=req.username,
            port=req.port or 22,
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
    except Exception as e:
        logger.error(f"Erro ao consultar status de autenticação por senha: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/settings/ssh-password-auth/toggle")
def toggle_ssh_password_auth_endpoint(req: SshPasswordAuthToggleRequest):
    """
    Ativa ou desativa a autenticação por senha no serviço SSH da VPS remota.
    """
    from app.services.ssh_security_service import toggle_password_authentication
    try:
        return toggle_password_authentication(
            host=req.host,
            username=req.username,
            enabled=req.enabled,
            port=req.port or 22,
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
    except ValueError as e:
        logger.warning(f"Erro de validação ao alterar autenticação por senha: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro inesperado ao alterar autenticação por senha: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao alterar segurança do SSH: {str(e)}")

class Fail2banStatusRequest(BaseModel):
    host: str
    username: str = "root"
    port: Optional[int] = 22
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

class Fail2banSaveRequest(BaseModel):
    host: str
    username: str = "root"
    maxretry: int = 5
    findtime: int = 600
    bantime: int = 3600
    ssh_port: Optional[int] = 22
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

class Fail2banUnbanRequest(BaseModel):
    host: str
    ip: str
    jail: Optional[str] = "sshd"
    username: str = "root"
    port: Optional[int] = 22
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

class Fail2banToggleRequest(BaseModel):
    host: str
    enable: bool
    username: str = "root"
    port: Optional[int] = 22
    password: Optional[str] = None
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

@router.post("/settings/fail2ban/status")
def fail2ban_status_endpoint(req: Fail2banStatusRequest):
    """
    Consulta o status, configurações e IPs banidos pelo Fail2ban na VPS.
    """
    from app.services.fail2ban_service import get_fail2ban_status
    try:
        return get_fail2ban_status(
            host=req.host,
            username=req.username,
            port=req.port or 22,
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
    except Exception as e:
        logger.error(f"Erro ao consultar status do Fail2ban: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/settings/fail2ban/save")
def fail2ban_save_endpoint(req: Fail2banSaveRequest):
    """
    Instala ou reconfigura as regras do Fail2ban na VPS (limite de tentativas, janela e ban time).
    """
    from app.services.fail2ban_service import install_and_configure_fail2ban
    try:
        return install_and_configure_fail2ban(
            host=req.host,
            username=req.username,
            maxretry=req.maxretry,
            findtime=req.findtime,
            bantime=req.bantime,
            ssh_port=req.ssh_port or 22,
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
    except ValueError as e:
        logger.warning(f"Erro de validação no Fail2ban: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao salvar configurações do Fail2ban: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao configurar Fail2ban: {str(e)}")

@router.post("/settings/fail2ban/unban")
def fail2ban_unban_endpoint(req: Fail2banUnbanRequest):
    """
    Desbane um IP bloqueado pelo Fail2ban.
    """
    from app.services.fail2ban_service import unban_ip
    try:
        return unban_ip(
            host=req.host,
            ip_to_unban=req.ip,
            jail=req.jail or "sshd",
            username=req.username,
            port=req.port or 22,
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
    except ValueError as e:
        logger.warning(f"Erro de validação ao desbanir IP: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao desbanir IP no Fail2ban: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao desbanir IP: {str(e)}")

@router.post("/settings/fail2ban/toggle")
def fail2ban_toggle_endpoint(req: Fail2banToggleRequest):
    """
    Inicia ou encerra o serviço do Fail2ban na VPS.
    """
    from app.services.fail2ban_service import toggle_fail2ban_service
    try:
        return toggle_fail2ban_service(
            host=req.host,
            enable=req.enable,
            username=req.username,
            port=req.port or 22,
            password=req.password,
            key_id=req.key_id,
            auth_type=req.auth_type or "password"
        )
    except ValueError as e:
        logger.warning(f"Erro de validação no toggle do Fail2ban: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Erro ao alternar status do Fail2ban: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao alternar Fail2ban: {str(e)}")

