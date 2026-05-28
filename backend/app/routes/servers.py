from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ServerCreateRequest(BaseModel):
    name: str
    host: str
    username: str
    password: str

class ServerUpdateRequest(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

@router.get("/servers")
def list_servers_endpoint():
    """
    Lista todos os servidores VPS cadastrados no banco local.
    """
    from app.database import get_servers
    return get_servers()

@router.post("/servers")
def add_server_endpoint(req: ServerCreateRequest):
    """
    Cadastra um novo servidor VPS no banco local.
    """
    from app.database import add_server
    try:
        server_id = add_server(req.name, req.host, req.username, req.password)
        return {"status": "success", "id": server_id, "message": "Servidor adicionado com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao adicionar servidor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/servers/{server_id}")
def delete_server_endpoint(server_id: int):
    """
    Remove um servidor VPS do banco local.
    """
    from app.database import delete_server
    try:
        delete_server(server_id)
        return {"status": "success", "message": "Servidor removido com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao remover servidor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/servers/{server_id}")
def update_server_endpoint(server_id: int, req: ServerUpdateRequest):
    """
    Atualiza um servidor VPS no banco local.
    """
    from app.database import update_server
    try:
        update_server(server_id, req.name, req.host, req.username, req.password)
        logger.info(f"Servidor {server_id} atualizado com sucesso no banco de dados.")
        return {"status": "success", "message": "Servidor atualizado com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao atualizar servidor {server_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
