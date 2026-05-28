from fastapi import APIRouter, HTTPException, BackgroundTasks
import logging
import asyncio
import time

from app.state import install_status, system_status_cache, system_status_locks, clear_system_status_cache
from app.database import get_all_settings, get_stack_credentials, save_stack_credentials, save_setting
from app.installer import (
    check_docker_installed, check_swarm_active, check_network_exists
)
from .schemas import ServerCredentials, NetworkCreateRequest

logger = logging.getLogger(__name__)
router = APIRouter()

CACHE_TTL_SECONDS = 15

@router.post("/system-status")
async def system_status(credentials: ServerCredentials):
    """
    Verifica o estado completo do sistema (Docker, Swarm, Apps).
    Pesado: ~5-15 segundos.
    """
    cache_key = f"{credentials.host}_{credentials.username}"
    if cache_key not in system_status_locks:
        system_status_locks[cache_key] = asyncio.Lock()
        
    async with system_status_locks[cache_key]:
        now = time.time()
        if cache_key in system_status_cache:
            cached_data, timestamp = system_status_cache[cache_key]
            if now - timestamp < CACHE_TTL_SECONDS:
                return cached_data

        print(f"DEBUG: Handling /system-status for {credentials.host}")
        logger.info(f"Fetching full system status for: {credentials.host}")
        from app.installer import get_full_system_status
        
        try:
            print("DEBUG: Calling get_full_system_status in thread...")
            status_data = await asyncio.to_thread(
                get_full_system_status, 
                credentials.host, 
                credentials.username, 
                credentials.password
            )
            print("DEBUG: get_full_system_status returned.")
        except Exception as e:
            logger.error(f"Error in system_status (Server Offline?): {e}")
            return {
                "offline": True,
                "error_message": str(e),
                "system_status": {
                    "docker": False,
                    "swarm": False,
                    "network": False,
                    "ctop": False
                },
                "detected_stacks": [],
                "stack_urls": {},
                "stack_credentials": {},
                "stack_versions": {}
            }
        
        response_data = {
            "system_status": {
                "docker": status_data.get("docker"),
                "swarm": status_data.get("swarm", False),
                "network": status_data.get("network", False),
                "ctop": status_data.get("ctop", False)
            },
            "detected_stacks": status_data.get("active_stacks", []),
            "stack_urls": status_data.get("stack_urls", {}),
            "stack_credentials": status_data.get("stack_credentials", {}),
            "stack_versions": status_data.get("stack_versions", {})
        }
        
        try:
            db_settings = get_all_settings(credentials.host)
            
            detected_stacks = response_data["detected_stacks"]
            stack_urls = response_data["stack_urls"]
            stack_credentials = response_data["stack_credentials"]
            stack_versions = response_data["stack_versions"]
            
            for s_name in detected_stacks:
                ver_key = f"stack_version_{s_name}"
                ver = db_settings.get(ver_key)
                if ver:
                    stack_versions[s_name] = ver
                
                if s_name not in stack_urls or not stack_urls[s_name]:
                    stored_domain = db_settings.get(f"stack_domain_{s_name}")
                    if stored_domain:
                        domains = [d.strip() for d in stored_domain.split(",") if d.strip()]
                        stack_urls[s_name] = domains
            
            for key, val in db_settings.items():
                if key.startswith("external_installed_") and val == "true":
                    s_name = key.replace("external_installed_", "")
                    if s_name not in detected_stacks:
                        detected_stacks.append(s_name)
                    
                    url_key = f"external_urls_{s_name}"
                    ext_url = db_settings.get(url_key) or db_settings.get(f"stack_domain_{s_name}")
                    if ext_url:
                        if s_name not in stack_urls:
                            stack_urls[s_name] = []
                        ext_domains = [d.strip() for d in ext_url.split(",") if d.strip()]
                        for d in ext_domains:
                            if d not in stack_urls[s_name]:
                                stack_urls[s_name].append(d)
                            
                    creds = get_stack_credentials(credentials.host, s_name)
                    if creds:
                        stack_credentials[s_name] = creds

                    ver_key = f"external_version_{s_name}"
                    ext_ver = db_settings.get(ver_key) or db_settings.get(f"stack_version_{s_name}")
                    if ext_ver:
                        stack_versions[s_name] = ext_ver
        except Exception as db_err:
            logger.error(f"Erro ao injetar stacks externas no status: {db_err}")
        
        system_status_cache[cache_key] = (response_data, time.time())
        return response_data

def run_install_docker_task(host, username, password):
    install_status['docker'] = {'status': 'running', 'message': 'Iniciando instalação do Docker...'}
    
    def update_status(msg):
        install_status['docker'] = {'status': 'running', 'message': msg}
        
    try:
        from app.installer import install_docker, update_docker_version_config
        
        install_docker(host, username, password, status_callback=update_status)
        
        install_status['docker'] = {'status': 'running', 'message': 'Atualizando configuração do Docker...'}
        update_docker_version_config(host, username, password)
        
        install_status['docker'] = {'status': 'success', 'message': 'Docker instalado e configurado com sucesso!'}
        clear_system_status_cache(host)
    except Exception as e:
        logger.error(f"Erro na task de instalação do Docker: {e}")
        install_status['docker'] = {'status': 'error', 'message': str(e)}

@router.post("/install-docker")
def trigger_docker_install(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Inicia o processo de instalação do Docker em um servidor remoto.
    """
    try:
        existing_version = check_docker_installed(credentials.host, credentials.username, credentials.password)
        if existing_version:
             return {"message": f"Docker já está instalado com sucesso. Versão: {existing_version}"}

        install_status['docker'] = {'status': 'pending', 'message': 'Iniciando instalação...'}
        background_tasks.add_task(run_install_docker_task, credentials.host, credentials.username, credentials.password)
        return {"message": f"Instalação do Docker iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao iniciar a instalação: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_upgrade_docker_task(host, username, password):
    install_status['docker-upgrade'] = {'status': 'running', 'message': 'Atualizando Docker...'}
    try:
        from app.installer import upgrade_docker_engine
        result = upgrade_docker_engine(host, username, password)
        install_status['docker-upgrade'] = {'status': 'success', 'message': result.get('message', 'Docker atualizado com sucesso!')}
    except Exception as e:
        logger.error(f"Erro na task de atualização do Docker: {e}")
        install_status['docker-upgrade'] = {'status': 'error', 'message': str(e)}

@router.post("/upgrade-docker")
def trigger_docker_upgrade(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Inicia o processo de atualização do Docker Engine em um servidor remoto.
    """
    try:
        background_tasks.add_task(run_upgrade_docker_task, credentials.host, credentials.username, credentials.password)
        return {"message": f"Atualização do Docker iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao iniciar a atualização: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_init_swarm_task(host, username, password, advertise_addr):
    install_status['swarm'] = {'status': 'running', 'message': 'Inicializando Swarm...'}
    try:
        from app.installer import init_swarm
        result = init_swarm(host, username, password, advertise_addr)
        install_status['swarm'] = {'status': 'success', 'message': result.get('message', 'Swarm inicializado com sucesso!')}
        clear_system_status_cache(host)
    except Exception as e:
        logger.error(f"Erro na task de Swarm: {e}")
        install_status['swarm'] = {'status': 'error', 'message': str(e)}

@router.post("/init-swarm")
def trigger_swarm_init(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Inicializa o Docker Swarm em um servidor remoto.
    """
    try:
        if check_swarm_active(credentials.host, credentials.username, credentials.password):
             return {"message": f"Swarm já está ativo e inicializado em {credentials.host}"}

        install_status['swarm'] = {'status': 'pending', 'message': 'Iniciando Swarm...'}
        background_tasks.add_task(run_init_swarm_task, credentials.host, credentials.username, credentials.password, credentials.host)
        return {"message": f"Inicialização do Swarm iniciada para {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao inicializar o swarm: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_create_network_task(host, username, password, network_name):
    install_status['network'] = {'status': 'running', 'message': 'Criando rede...'}
    try:
        from app.installer import create_network
        result = create_network(host, username, password, network_name)
        install_status['network'] = {'status': 'success', 'message': result.get('message', 'Rede criada com sucesso!')}
        clear_system_status_cache(host)
    except Exception as e:
        logger.error(f"Erro na task de Rede: {e}")
        install_status['network'] = {'status': 'error', 'message': str(e)}

@router.post("/create-network")
def trigger_create_network(request: NetworkCreateRequest, background_tasks: BackgroundTasks):
    """
    Cria uma rede overlay Docker em um servidor remoto.
    """
    try:
        if check_network_exists(request.host, request.username, request.password, request.network_name) and not request.overwrite:
             return {"message": f"A rede '{request.network_name}' já existe em {request.host}. Use 'overwrite': true para forçar."}

        install_status['network'] = {'status': 'pending', 'message': 'Criando rede...'}
        background_tasks.add_task(run_create_network_task, request.host, request.username, request.password, request.network_name)
        return {"message": f"Criação da rede iniciada para {request.network_name} em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao criar a rede: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_install_ctop_task(host, username, password):
    install_status['ctop'] = {'status': 'running', 'message': 'Instalando Ctop...'}
    try:
        from app.installer import install_ctop
        result = install_ctop(host, username, password)
        install_status['ctop'] = {'status': 'success', 'message': result.get('message', 'Ctop instalado com sucesso!')}
        clear_system_status_cache(host)
    except Exception as e:
        logger.error(f"Erro na task de Ctop: {e}")
        install_status['ctop'] = {'status': 'error', 'message': str(e)}

@router.post("/install-ctop")
def trigger_ctop_install(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Instala o Ctop em um servidor remoto.
    """
    try:
        install_status['ctop'] = {'status': 'pending', 'message': 'Iniciando instalação do Ctop...'}
        background_tasks.add_task(run_install_ctop_task, credentials.host, credentials.username, credentials.password)
        return {"message": f"Instalação do Ctop iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao iniciar instalação do Ctop: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/atualiza_versao_docker")
def trigger_update_docker_version(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Aplica a correção de versão da API do Docker (DOCKER_MIN_API_VERSION=1.24) para compatibilidade.
    """
    try:
        existing_version = check_docker_installed(credentials.host, credentials.username, credentials.password)
        if not existing_version:
             return {"message": f"Docker não está instalado em {credentials.host}. Instale o Docker primeiro."}

        from app.installer import update_docker_version_config
        background_tasks.add_task(update_docker_version_config, credentials.host, credentials.username, credentials.password)
        return {"message": f"Atualização da configuração do Docker iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao atualizar configuração do Docker: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/install-status/{service_key}")
def get_install_status(service_key: str):
    """
    Retorna o status da instalação de um serviço.
    """
    status = install_status.get(service_key)
    if not status:
        return {"status": "unknown", "message": "O serviço não está sendo instalado no momento."}
    return status
