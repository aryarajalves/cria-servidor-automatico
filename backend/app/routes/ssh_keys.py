from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import logging

from app.auth_middleware import verify_jwt
from app.database import (
    add_ssh_key,
    get_ssh_keys,
    get_ssh_key_by_id,
    update_ssh_key,
    delete_ssh_key
)
from app.services.ssh_keys import parse_private_key, extract_public_key, generate_key_pair

logger = logging.getLogger(__name__)
router = APIRouter()

class SshKeyCreateRequest(BaseModel):
    name: str
    private_key: str
    passphrase: Optional[str] = None

class SshKeyGenerateRequest(BaseModel):
    name: str
    key_type: Optional[str] = "RSA" # RSA or ED25519
    bits: Optional[int] = 2048

class SshKeyUpdateRequest(BaseModel):
    name: Optional[str] = None
    private_key: Optional[str] = None
    passphrase: Optional[str] = None

@router.get("/ssh-keys", dependencies=[Depends(verify_jwt)])
def list_ssh_keys_endpoint():
    """
    Lista todas as chaves SSH salvas com metadados e contagem de servidores associados.
    """
    try:
        keys = get_ssh_keys()
        return keys
    except Exception as e:
        logger.error(f"Erro ao listar chaves SSH: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao listar chaves SSH: {str(e)}")

@router.get("/ssh-keys/{key_id}", dependencies=[Depends(verify_jwt)])
def get_ssh_key_endpoint(key_id: int):
    """
    Retorna os detalhes de uma chave SSH específica.
    """
    try:
        key_record = get_ssh_key_by_id(key_id)
        if not key_record:
            raise HTTPException(status_code=404, detail="Chave SSH não encontrada.")
        return key_record
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao buscar chave SSH {key_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar chave SSH: {str(e)}")

@router.post("/ssh-keys", dependencies=[Depends(verify_jwt)])
def create_ssh_key_endpoint(req: SshKeyCreateRequest):
    """
    Valida e cadastra uma nova chave SSH privada existente.
    """
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="O nome da chave é obrigatório.")
    if not req.private_key or not req.private_key.strip():
        raise HTTPException(status_code=400, detail="A chave privada não pode ser vazia.")

    try:
        pkey, key_type = parse_private_key(req.private_key, req.passphrase)
        public_key = extract_public_key(pkey, comment=req.name.strip())
        
        key_id = add_ssh_key(
            name=req.name.strip(),
            private_key=req.private_key.strip(),
            public_key=public_key,
            key_type=key_type,
            passphrase=req.passphrase.strip() if req.passphrase else None
        )
        
        logger.info(f"Chave SSH '{req.name}' (ID: {key_id}, Tipo: {key_type}) cadastrada com sucesso.")
        return {
            "status": "success",
            "id": key_id,
            "name": req.name.strip(),
            "public_key": public_key,
            "key_type": key_type,
            "message": "Chave SSH cadastrada com sucesso!"
        }
    except ValueError as ve:
        logger.warning(f"Validação de chave SSH falhou: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Erro ao cadastrar chave SSH: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno ao salvar chave: {str(e)}")

@router.post("/ssh-keys/generate", dependencies=[Depends(verify_jwt)])
def generate_ssh_key_endpoint(req: SshKeyGenerateRequest):
    """
    Gera um novo par de chaves SSH (RSA ou ED25519) automaticamente e salva no banco.
    """
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="O nome da chave é obrigatório.")

    try:
        key_data = generate_key_pair(
            name=req.name.strip(),
            key_type=req.key_type or "RSA",
            bits=req.bits or 2048
        )
        
        key_id = add_ssh_key(
            name=key_data["name"],
            private_key=key_data["private_key"],
            public_key=key_data["public_key"],
            key_type=key_data["key_type"],
            passphrase=None
        )
        
        logger.info(f"Par de chaves SSH '{req.name}' gerado e salvo com sucesso (ID: {key_id}).")
        return {
            "status": "success",
            "id": key_id,
            "name": key_data["name"],
            "private_key": key_data["private_key"],
            "public_key": key_data["public_key"],
            "key_type": key_data["key_type"],
            "message": "Par de chaves SSH gerado com sucesso!"
        }
    except Exception as e:
        logger.error(f"Erro ao gerar par de chaves SSH: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar par de chaves: {str(e)}")

@router.put("/ssh-keys/{key_id}", dependencies=[Depends(verify_jwt)])
def update_ssh_key_endpoint(key_id: int, req: SshKeyUpdateRequest):
    """
    Atualiza uma chave SSH existente.
    """
    existing = get_ssh_key_by_id(key_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Chave SSH não encontrada.")

    try:
        public_key = None
        key_type = None
        
        # Se alterou a chave privada, valida e regera a chave pública
        if req.private_key and req.private_key.strip():
            passphrase = req.passphrase if req.passphrase is not None else existing.get("passphrase")
            pkey, key_type = parse_private_key(req.private_key, passphrase)
            name = req.name if req.name is not None else existing["name"]
            public_key = extract_public_key(pkey, comment=name)

        update_ssh_key(
            key_id=key_id,
            name=req.name.strip() if req.name is not None else None,
            private_key=req.private_key.strip() if req.private_key is not None else None,
            public_key=public_key,
            key_type=key_type,
            passphrase=req.passphrase.strip() if req.passphrase is not None else None
        )
        
        logger.info(f"Chave SSH ID {key_id} atualizada com sucesso.")
        return {"status": "success", "message": "Chave SSH atualizada com sucesso!"}
    except ValueError as ve:
        logger.warning(f"Erro de validação ao atualizar chave {key_id}: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Erro ao atualizar chave {key_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar chave: {str(e)}")

@router.delete("/ssh-keys/{key_id}", dependencies=[Depends(verify_jwt)])
def delete_ssh_key_endpoint(key_id: int):
    """
    Remove uma chave SSH do banco de dados.
    """
    existing = get_ssh_key_by_id(key_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Chave SSH não encontrada.")

    try:
        delete_ssh_key(key_id)
        logger.info(f"Chave SSH ID {key_id} deletada com sucesso.")
        return {"status": "success", "message": "Chave SSH removida com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao remover chave SSH {key_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao remover chave SSH: {str(e)}")
