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

@router.post("/cloudflare/zones")
def get_cf_zones(auth: CloudflareAuth):
    try:
        # Prioridade absoluta: .env > Token enviado > Banco de Dados (Global)
        raw_token = os.getenv("CLOUDFLARE_API_TOKEN") or auth.api_token or get_setting("cloudflare_token", 'global')
        if not raw_token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado. Adicione CLOUDFLARE_API_TOKEN no .env ou vá em Configurações > Cloudflare API.")
            
        token = raw_token.strip()
        zones = list_zones(token)
        return {"zones": zones}
    except Exception as e:
        logger.error(f"Error fetching zones: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cloudflare/create")
def create_cf_record(req: DNSRecordRequest):
    try:
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
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
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
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
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
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
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
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
