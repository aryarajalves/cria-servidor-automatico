from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class ServerCreateRequest(BaseModel):
    name: str
    host: str
    port: Optional[int] = 22
    username: str
    password: Optional[str] = None
    auth_type: Optional[str] = "password"
    key_id: Optional[int] = None

class ServerUpdateRequest(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    auth_type: Optional[str] = None
    key_id: Optional[int] = None

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
        server_id = add_server(
            name=req.name, 
            host=req.host,
            port=req.port or 22,
            username=req.username, 
            password=req.password,
            auth_type=req.auth_type or "password",
            key_id=req.key_id
        )
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
        update_server(
            server_id=server_id, 
            name=req.name, 
            host=req.host,
            port=req.port,
            username=req.username, 
            password=req.password,
            auth_type=req.auth_type,
            key_id=req.key_id
        )
        logger.info(f"Servidor {server_id} atualizado com sucesso no banco de dados.")
        return {"status": "success", "message": "Servidor atualizado com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao atualizar servidor {server_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class CommandExecutionRequest(BaseModel):
    host: str
    port: Optional[int] = 22
    username: str
    password: Optional[str] = None
    command: str
    key_id: Optional[int] = None
    auth_type: Optional[str] = "password"

@router.post("/servers/run-command")
def run_command_on_server(req: CommandExecutionRequest):
    from app.services.base_ssh import get_ssh_client
    try:
        client = get_ssh_client(
            host=req.host,
            port=req.port,
            username=req.username, 
            password=req.password, 
            key_id=req.key_id,
            timeout=15
        )
    except Exception as e:
        logger.error(f"Erro ao conectar via SSH: {e}")
        raise HTTPException(status_code=400, detail=f"Falha na conexão SSH: {str(e)}")

    try:
        stdin, stdout, stderr = client.exec_command(req.command, timeout=30, get_pty=True)
        stdout.channel.settimeout(30)
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode(errors="replace")
        error = stderr.read().decode(errors="replace")
        
        return {
            "exit_status": exit_status,
            "output": output,
            "error": error
        }
    except Exception as e:
        logger.error(f"Erro ao executar comando: {e}")
        return {
            "exit_status": -1,
            "output": "",
            "error": f"Erro de execução/Timeout: {str(e)}"
        }
    finally:
        client.close()

