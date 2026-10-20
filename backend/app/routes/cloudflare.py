from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
import logging
from app.dns_manager import list_zones, create_dns_record, list_dns_records, delete_dns_record, update_dns_record
from app.database import get_setting

logger = logging.getLogger(__name__)
router = APIRouter()

class CloudflareAuth(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None

class DNSRecordRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    name: str # Subdomain or @
    content: str # IP
    proxied: bool = True

class DNSListRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    ip_filter: Optional[str] = None

class DNSRecordDeleteRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    record_id: str

class DNSRecordUpdateRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    record_id: str
    name: str
    content: str
    proxied: bool = True

def resolve_cf_token(auth_token: Optional[str] = None, host: Optional[str] = None) -> Optional[str]:
    """
    Resolve o token Cloudflare priorizando o valor enviado, configurações por host e banco global.
    """
    if auth_token and auth_token.strip() and auth_token.strip().lower() != "env":
        return auth_token.strip()
    if host:
        token = get_setting("cloudflare_token", host)
        if token and token.strip():
            return token.strip()
    global_token = get_setting("cloudflare_token", "global")
    if global_token and global_token.strip():
        return global_token.strip()
    env_token = os.getenv("CLOUDFLARE_API_TOKEN")
    if env_token and env_token.strip():
        return env_token.strip()
    return None

@router.post("/cloudflare/zones")
def get_cf_zones(auth: CloudflareAuth):
    try:
        token = resolve_cf_token(auth.api_token, auth.host)
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado. Vá em Configurações > Cloudflare API e insira o Token.")
            
        zones = list_zones(token)
        return {"zones": zones}
    except Exception as e:
        logger.error(f"Error fetching zones: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cloudflare/create")
def create_cf_record(req: DNSRecordRequest):
    try:
        token = resolve_cf_token(req.api_token, req.host)
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")
            
        result = create_dns_record(
            token, 
            req.zone_id, 
            req.name, 
            req.content, 
            req.proxied
        )
        return {"message": "Registro DNS criado com sucesso!", "details": result}
    except Exception as e:
        logger.error(f"Error creating record: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cloudflare/records")
def list_cf_records(req: DNSListRequest):
    try:
        token = resolve_cf_token(req.api_token, req.host)
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")

        records = list_dns_records(token, req.zone_id, req.ip_filter)
        return {"records": records}
    except Exception as e:
        logger.error(f"Error listing records: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cloudflare/delete")
def delete_cf_record(req: DNSRecordDeleteRequest):
    try:
        token = resolve_cf_token(req.api_token, req.host)
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")
            
        result = delete_dns_record(token, req.zone_id, req.record_id)
        return {"message": "Registro deletado com sucesso", "details": result}
    except Exception as e:
        logger.error(f"Error deleting record: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cloudflare/update")
def update_cf_record(req: DNSRecordUpdateRequest):
    try:
        token = resolve_cf_token(req.api_token, req.host)
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")

        result = update_dns_record(
            token, 
            req.zone_id, 
            req.record_id, 
            req.name, 
            req.content, 
            req.proxied
        )
        return {"message": "Registro atualizado com sucesso", "details": result}
    except Exception as e:
        logger.error(f"Error updating record: {e}")
        raise HTTPException(status_code=400, detail=str(e))

class SSLCheckRequest(BaseModel):
    domain: str

@router.post("/cloudflare/check-ssl")
def check_domain_ssl(req: SSLCheckRequest):
    import socket
    import ssl
    domain = req.domain.strip()
    # Remove prefixo de protocolo se o usuário enviou com http:// ou https://
    domain = domain.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
    
    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=4) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                return {"valid": True, "message": "SSL ativo e funcionando corretamente!"}
    except ssl.SSLError as e:
        logger.warning(f"SSL validation failed for {domain}: {e}")
        return {"valid": False, "message": f"Erro de validação SSL: {getattr(e, 'reason', str(e))}"}
    except Exception as e:
        logger.warning(f"Connection failed for check SSL on {domain}: {e}")
        return {"valid": False, "message": f"Não foi possível conectar de forma segura (HTTPS): {str(e)}"}
