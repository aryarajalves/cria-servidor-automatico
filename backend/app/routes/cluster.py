from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
import logging
import asyncio

from app.state import install_status

logger = logging.getLogger(__name__)
router = APIRouter()

class ClusterNodeAddRequest(BaseModel):
    parent_host: str
    parent_username: str
    parent_password: str
    node_id: int
    role: str
    parent_ip: str
    install_docker: bool = True

class ClusterNodeRemoveRequest(BaseModel):
    parent_host: str
    parent_username: str
    parent_password: str
    node_id: int

class ClusterNodeChangeHostnameRequest(BaseModel):
    parent_host: str
    parent_username: str
    parent_password: str
    node_swarm_id: str
    old_hostname: str
    new_hostname: str

@router.get("/api/cluster/nodes")
def list_cluster_nodes_endpoint(parent_host: str):
    """
    Retorna os nós associados ao cluster do pai no banco de dados.
    """
    try:
        from app.database import get_cluster_nodes
        logger.info(f"Listando nós cadastrados no banco para o cluster do pai: {parent_host}")
        return get_cluster_nodes(parent_host)
    except Exception as e:
        logger.error(f"Erro ao listar nós do banco de dados: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/cluster/status")
async def get_cluster_status_endpoint(parent_host: str, parent_username: str, parent_password: str):
    """
    Verifica se o Swarm está ativo no pai e retorna os status reais dos nós no swarm.
    """
    try:
        from app.installer import check_swarm_active, get_swarm_nodes_real_status
        logger.info(f"Verificando status real do Swarm para o pai: {parent_host}")
        
        # Verifica se o host atual é um nó filho de algum outro cluster no banco
        from app.database import get_db_path
        import sqlite3
        is_child = False
        parent_info = None
        
        try:
            conn = sqlite3.connect(get_db_path(), timeout=20)
            cursor = conn.cursor()
            cursor.execute('''
                SELECT cn.parent_host, cn.role, s.name 
                FROM cluster_nodes cn
                LEFT JOIN servers s ON s.host = cn.parent_host
                WHERE cn.node_id = (SELECT id FROM servers WHERE host = ?)
            ''', (parent_host,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                is_child = True
                parent_info = {
                    "parent_host": row[0],
                    "role": row[1],
                    "parent_name": row[2] or row[0]
                }
        except Exception as dberr:
            logger.error(f"Erro ao verificar se o host é filho: {dberr}")

        # Se for filho, não precisamos checar se o swarm está ativo ou buscar nós reais
        if is_child:
            return {
                "swarm_active": False,
                "real_nodes": [],
                "is_child": True,
                "parent_info": parent_info
            }
        
        swarm_active = await asyncio.to_thread(check_swarm_active, parent_host, parent_username, parent_password)
        real_nodes = []
        if swarm_active:
            real_nodes = await asyncio.to_thread(get_swarm_nodes_real_status, parent_host, parent_username, parent_password)
            
        return {
            "swarm_active": swarm_active,
            "real_nodes": real_nodes,
            "is_child": False,
            "parent_info": None
        }
    except Exception as e:
        logger.error(f"Erro ao consultar status real do Swarm: {e}")
        return {
            "swarm_active": False,
            "real_nodes": [],
            "is_child": False,
            "parent_info": None,
            "error": str(e)
        }

def run_cluster_node_add_task(req: ClusterNodeAddRequest):
    """
    Task executada em background para instalar o docker (se necessário) e dar join no swarm.
    """
    install_status['cluster-add'] = {'status': 'running', 'message': 'Iniciando processo de adesão ao cluster...'}
    
    try:
        from app.database import get_server_by_id, add_cluster_node
        from app.installer import check_docker_installed, install_docker, update_docker_version_config, get_swarm_join_tokens, join_swarm_cluster
        
        child = get_server_by_id(req.node_id)
        if not child:
            raise Exception("Servidor filho não encontrado no banco de dados.")
            
        logger.info(f"[CLUSTER] Iniciando adesão do nó {child['name']} ({child['host']}) ao pai {req.parent_host}")
        
        # 1. Instalar Docker se selecionado e necessário
        if req.install_docker:
            install_status['cluster-add'] = {'status': 'running', 'message': f"Verificando Docker no filho {child['name']}..."}
            has_docker = check_docker_installed(child['host'], child['username'], child['password'])
            if not has_docker:
                install_status['cluster-add'] = {'status': 'running', 'message': f"Instalando Docker no filho {child['name']}..."}
                
                def update_status_func(msg):
                    install_status['cluster-add'] = {'status': 'running', 'message': f"Docker ({child['name']}): {msg}"}
                
                install_docker(child['host'], child['username'], child['password'], status_callback=update_status_func)
                update_docker_version_config(child['host'], child['username'], child['password'])
                
        # 2. Obter token de join do pai
        install_status['cluster-add'] = {'status': 'running', 'message': f"Obtendo tokens de join do Swarm pai..."}
        tokens = get_swarm_join_tokens(req.parent_host, req.parent_username, req.parent_password)
        token = tokens.get(req.role)
        if not token:
            raise Exception(f"Token para o papel '{req.role}' não foi gerado pelo Swarm pai.")
            
        # 3. Dar join no swarm
        install_status['cluster-add'] = {'status': 'running', 'message': f"Executando docker swarm join no filho {child['name']}..."}
        join_swarm_cluster(child['host'], child['username'], child['password'], req.parent_ip, token)
        
        # 4. Registrar no banco local
        add_cluster_node(req.parent_host, req.node_id, req.role)
        
        install_status['cluster-add'] = {'status': 'success', 'message': f"Servidor {child['name']} adicionado ao cluster como {req.role} com sucesso!"}
        logger.info(f"[CLUSTER] Adesão concluída com sucesso para o nó {child['name']} ({child['host']})")
    except Exception as e:
        logger.error(f"[CLUSTER] Erro ao adicionar nó ao cluster: {e}")
        install_status['cluster-add'] = {'status': 'error', 'message': str(e)}

@router.post("/api/cluster/nodes")
def add_cluster_node_endpoint(req: ClusterNodeAddRequest, background_tasks: BackgroundTasks):
    """
    Inicia a task assíncrona para instalar o docker e associar o nó ao Swarm.
    """
    try:
        install_status['cluster-add'] = {'status': 'pending', 'message': 'Preparando tarefa de adesão...'}
        background_tasks.add_task(run_cluster_node_add_task, req)
        return {"status": "success", "message": "Processo de adesão iniciado com sucesso no background."}
    except Exception as e:
        logger.error(f"Falha ao iniciar adesão do nó: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_cluster_node_remove_task(req: ClusterNodeRemoveRequest):
    """
    Task executada em background para fazer o leave no filho e node rm no pai.
    """
    install_status['cluster-remove'] = {'status': 'running', 'message': 'Iniciando remoção do nó do cluster...'}
    try:
        from app.database import get_server_by_id, remove_cluster_node
        from app.installer import leave_swarm_cluster, remove_swarm_node_from_parent, get_server_hostname
        
        child = get_server_by_id(req.node_id)
        if not child:
            raise Exception("Servidor filho não encontrado no banco de dados.")
            
        logger.info(f"[CLUSTER] Iniciando desassociação do nó {child['name']} ({child['host']}) do pai {req.parent_host}")
        
        # 1. Tentar obter hostname do filho
        node_name = child['name']
        try:
            install_status['cluster-remove'] = {'status': 'running', 'message': 'Obtendo hostname do nó filho...'}
            node_name = get_server_hostname(child['host'], child['username'], child['password'])
        except Exception as he:
            logger.warning(f"Não foi possível obter o hostname real do filho via SSH, usando nome cadastrado: {he}")
            
        # 2. Executar leave no filho
        try:
            install_status['cluster-remove'] = {'status': 'running', 'message': 'Executando docker swarm leave no filho...'}
            leave_swarm_cluster(child['host'], child['username'], child['password'])
        except Exception as le:
            logger.warning(f"Erro ao forçar leave no filho (pode estar offline): {le}")
            
        # 3. Executar rm no pai
        try:
            install_status['cluster-remove'] = {'status': 'running', 'message': 'Forçando remoção do nó no Swarm pai...'}
            remove_swarm_node_from_parent(req.parent_host, req.parent_username, req.parent_password, node_name)
        except Exception as pe:
            logger.warning(f"Erro ao remover nó no Swarm pai (pode não existir): {pe}")
            
        # 4. Remover do banco local
        remove_cluster_node(req.parent_host, req.node_id)
        
        install_status['cluster-remove'] = {'status': 'success', 'message': f"Servidor {child['name']} removido do cluster com sucesso."}
        logger.info(f"[CLUSTER] Desassociação concluída para o nó {child['name']}")
    except Exception as e:
        logger.error(f"[CLUSTER] Erro ao remover nó do cluster: {e}")
        install_status['cluster-remove'] = {'status': 'error', 'message': str(e)}

@router.post("/api/cluster/nodes/remove")
def remove_cluster_node_endpoint(req: ClusterNodeRemoveRequest, background_tasks: BackgroundTasks):
    """
    Inicia a task assíncrona para remover o nó do Swarm.
    """
    try:
        install_status['cluster-remove'] = {'status': 'pending', 'message': 'Preparando tarefa de desassociação...'}
        background_tasks.add_task(run_cluster_node_remove_task, req)
        return {"status": "success", "message": "Processo de remoção iniciado com sucesso no background."}
    except Exception as e:
        logger.error(f"Falha ao iniciar remoção do nó: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_cluster_node_change_hostname_task(req: ClusterNodeChangeHostnameRequest):
    install_status['cluster-hostname'] = {'status': 'running', 'message': 'Iniciando processo de alteração de hostname...'}
    try:
        from app.installer import change_swarm_node_hostname
        logger.info(f"[CLUSTER] Alterando hostname do nó Swarm {req.node_swarm_id} de '{req.old_hostname}' para '{req.new_hostname}'")
        
        change_swarm_node_hostname(
            req.parent_host, 
            req.parent_username, 
            req.parent_password, 
            req.node_swarm_id, 
            req.old_hostname, 
            req.new_hostname
        )
        
        install_status['cluster-hostname'] = {
            'status': 'success', 
            'message': f"Hostname do servidor alterado para '{req.new_hostname}' com sucesso!"
        }
        logger.info(f"[CLUSTER] Hostname alterado com sucesso para o nó {req.node_swarm_id}")
    except Exception as e:
        logger.error(f"[CLUSTER] Erro ao alterar hostname do nó: {e}")
        install_status['cluster-hostname'] = {'status': 'error', 'message': str(e)}

@router.post("/api/cluster/nodes/change-hostname")
def change_cluster_node_hostname_endpoint(req: ClusterNodeChangeHostnameRequest, background_tasks: BackgroundTasks):
    """
    Inicia a task assíncrona para alterar o hostname de um servidor do cluster Swarm.
    """
    try:
        install_status['cluster-hostname'] = {'status': 'pending', 'message': 'Preparando alteração de hostname...'}
        background_tasks.add_task(run_cluster_node_change_hostname_task, req)
        return {"status": "success", "message": "Processo de alteração de hostname iniciado com sucesso no background."}
    except Exception as e:
        logger.error(f"Falha ao iniciar alteração de hostname: {e}")
        raise HTTPException(status_code=500, detail=str(e))
