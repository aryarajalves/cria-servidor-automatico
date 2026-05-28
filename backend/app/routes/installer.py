from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import os
import logging
import asyncio
import time
import secrets

from app.state import install_status
from app.database import get_all_settings, get_stack_credentials, save_stack_credentials, save_setting
from app.installer import (
    check_docker_installed, check_swarm_active, check_network_exists, 
    check_stack_exists, get_active_stacks
)

logger = logging.getLogger(__name__)
router = APIRouter()

class ServerCredentials(BaseModel):
    host: str
    username: str
    password: str

class NetworkCreateRequest(ServerCredentials):
    network_name: str = "network_swarm_public"
    overwrite: bool = False

class RedisInstallRequest(ServerCredentials):
    portainer_api_key: Optional[str] = None

class PortainerInstallRequest(ServerCredentials):
    portainer_host: str
    overwrite: bool = False

class TraefikInstallRequest(ServerCredentials):
    email: str
    overwrite: bool = False

class PostgresInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    overwrite: bool = False

class RabbitMQInstallRequest(ServerCredentials):
    rabbit_user: Optional[str] = None
    rabbit_password: Optional[str] = None
    rabbit_base_url: str
    overwrite: bool = False

class ChatwootInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    s3_bucket_name: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_region: Optional[str] = None
    s3_endpoint: Optional[str] = None
    chatwoot_base_url: str
    overwrite: bool = False

class EnvUpdate(BaseModel):
    host: str
    username: str
    password: str
    stack_name: str
    env_vars: dict

class RestartStackRequest(ServerCredentials):
    stack_name: str

class AIAgentManagerInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    openai_api_key: Optional[str] = ""
    domain_backend: str
    domain_frontend: str
    agent_api_key: Optional[str] = None
    google_client_id: Optional[str] = ""
    google_client_secret: Optional[str] = ""
    google_redirect_uri: Optional[str] = ""
    gunicorn_workers: Optional[str] = "4"
    overwrite: bool = False

class ZapVoiceRequest(BaseModel):
    host: str
    username: str
    password: str
    chatwoot_base_url: str 
    postgres_password: str
    super_admin_email: str
    secret_key: Optional[str] = None

class GerenciadorWhatsAppInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    super_admin_email: str
    backend_domain: str
    frontend_domain: str
    overwrite: bool = False

class UninstallStackRequest(ServerCredentials):
    stack_id: str
    stack_name: str

class StackDomainUpdateRequest(ServerCredentials):
    stack_name: str
    old_domain: str
    new_domain: str

class ExternalStackRequest(ServerCredentials):
    stack_name: str
    url: str
    email: Optional[str] = None
    password: Optional[str] = None
    version: Optional[str] = None

# System Status Cache settings
_system_status_cache = {}
_system_status_locks = {}
CACHE_TTL_SECONDS = 15

@router.post("/system-status")
async def system_status(credentials: ServerCredentials):
    """
    Verifica o estado completo do sistema (Docker, Swarm, Apps).
    Pesado: ~5-15 segundos.
    """
    cache_key = f"{credentials.host}_{credentials.username}"
    if cache_key not in _system_status_locks:
        _system_status_locks[cache_key] = asyncio.Lock()
        
    async with _system_status_locks[cache_key]:
        now = time.time()
        if cache_key in _system_status_cache:
            cached_data, timestamp = _system_status_cache[cache_key]
            if now - timestamp < CACHE_TTL_SECONDS:
                return cached_data

        print(f"DEBUG: Handling /system-status for {credentials.host}")
        logger.info(f"Fetching full system status for: {credentials.host}")
        from app.installer import get_full_system_status
        
        try:
            print("DEBUG: Calling get_full_system_status in thread...")
            # Run SSH operation in thread pool to avoid blocking event loop
            status_data = await asyncio.to_thread(
                get_full_system_status, 
                credentials.host, 
                credentials.username, 
                credentials.password
            )
            print("DEBUG: get_full_system_status returned.")
        except Exception as e:
            logger.error(f"Error in system_status (Server Offline?): {e}")
            # Retorna um estado offline em vez de 500 para não travar o frontend
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
        
        # Inject externally installed stacks and versions
        try:
            db_settings = get_all_settings(credentials.host)
            
            detected_stacks = response_data["detected_stacks"]
            stack_urls = response_data["stack_urls"]
            stack_credentials = response_data["stack_credentials"]
            stack_versions = response_data["stack_versions"]
            
            # 1. Inject versions and fallback domains for standard detected/active stacks
            for s_name in detected_stacks:
                # Version
                ver_key = f"stack_version_{s_name}"
                ver = db_settings.get(ver_key)
                if ver:
                    stack_versions[s_name] = ver
                
                # Fallback URL if inspect failed/timed out
                if s_name not in stack_urls or not stack_urls[s_name]:
                    stored_domain = db_settings.get(f"stack_domain_{s_name}")
                    if stored_domain:
                        domains = [d.strip() for d in stored_domain.split(",") if d.strip()]
                        stack_urls[s_name] = domains
            
            # 2. Inject external stacks
            for key, val in db_settings.items():
                if key.startswith("external_installed_") and val == "true":
                    s_name = key.replace("external_installed_", "")
                    if s_name not in detected_stacks:
                        detected_stacks.append(s_name)
                    
                    # Get external URL (fallback to stack_domain if set)
                    url_key = f"external_urls_{s_name}"
                    ext_url = db_settings.get(url_key) or db_settings.get(f"stack_domain_{s_name}")
                    if ext_url:
                        if s_name not in stack_urls:
                            stack_urls[s_name] = []
                        # Split in case it has multiple values
                        ext_domains = [d.strip() for d in ext_url.split(",") if d.strip()]
                        for d in ext_domains:
                            if d not in stack_urls[s_name]:
                                stack_urls[s_name].append(d)
                            
                    # Get external credentials
                    creds = get_stack_credentials(credentials.host, s_name)
                    if creds:
                        stack_credentials[s_name] = creds

                    # Get external version
                    ver_key = f"external_version_{s_name}"
                    ext_ver = db_settings.get(ver_key) or db_settings.get(f"stack_version_{s_name}")
                    if ext_ver:
                        stack_versions[s_name] = ext_ver
        except Exception as db_err:
            logger.error(f"Erro ao injetar stacks externas no status: {db_err}")
        
        _system_status_cache[cache_key] = (response_data, time.time())
        return response_data

def run_install_docker_task(host, username, password):
    install_status['docker'] = {'status': 'running', 'message': 'Iniciando instalação do Docker...'}
    
    def update_status(msg):
        install_status['docker'] = {'status': 'running', 'message': msg}
        
    try:
        from app.installer import install_docker, update_docker_version_config
        
        # 1. Instala o Docker (com updates de status)
        install_docker(host, username, password, status_callback=update_status)
        
        # 2. Atualiza a configuração da versão da API (Automático)
        install_status['docker'] = {'status': 'running', 'message': 'Atualizando configuração do Docker...'}
        update_docker_version_config(host, username, password)
        
        install_status['docker'] = {'status': 'success', 'message': 'Docker instalado e configurado com sucesso!'}
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

def run_generic_install_task(service_key, install_func, host, *args, stack_name=None, **kwargs):
    logger.info(f"TASK: Iniciando {service_key} em {host}")
    install_status[service_key] = {'status': 'running', 'message': f'Instalando {service_key}...'}
    try:
        result = install_func(host, *args, **kwargs)
        logger.info(f"TASK: Finalizado {service_key}. Result: {result}")
        msg = f'{service_key.capitalize()} instalado com sucesso!'
        install_status[service_key] = {'status': 'success', 'message': msg}
        
        if isinstance(result, dict):
            install_status[service_key].update(result)
            
            if "credentials" in result:
                creds = result["credentials"]
                target_stack = stack_name or service_key
                save_stack_credentials(host, target_stack, creds.get("user"), creds.get("password"))
                logger.info(f"TASK: Credenciais de {target_stack} salvas no banco para {host}")
    except Exception as e:
        logger.error(f"TASK ERROR: Erro na task de {service_key}: {e}")
        install_status[service_key] = {'status': 'error', 'message': str(e)}

@router.post("/install-redis")
def trigger_install_redis(request: RedisInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Redis.
    """
    try:
        if check_stack_exists(request.host, request.username, request.password, "redis"):
             return {"message": f"A stack 'redis' já está rodando em {request.host}"}

        from app.installer import install_redis
        install_status['redis'] = {'status': 'pending', 'message': 'Iniciando instalação do Redis via SSH...'}
        background_tasks.add_task(run_generic_install_task, 'redis', install_redis, request.host, request.username, request.password, stack_name="redis")
        return {"message": f"Instalação do Redis via SSH iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Redis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-portainer")
def trigger_install_portainer(request: PortainerInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Portainer em um servidor remoto.
    """
    try:
        from app.installer import install_portainer
        active_stacks = get_active_stacks(request.host, request.username, request.password)
        
        if "portainer" in active_stacks and not request.overwrite:
             return {
                 "message": f"A stack 'portainer' já está rodando em {request.host}. Use 'overwrite': true para forçar a reinstalação.",
                 "detected_stacks": active_stacks
             }

        install_status['portainer'] = {'status': 'pending', 'message': 'Iniciando instalação do Portainer...'}
        background_tasks.add_task(run_generic_install_task, 'portainer', install_portainer, request.host, request.username, request.password, request.portainer_host, stack_name="portainer")
        return {"message": f"Instalação do Portainer iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar o Portainer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-traefik")
def trigger_install_traefik(request: TraefikInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Traefik em um servidor remoto.
    """
    try:
        if check_stack_exists(request.host, request.username, request.password, "traefik") and not request.overwrite:
             return {"message": f"A stack 'traefik' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        from app.installer import install_traefik
        install_status['traefik'] = {'status': 'pending', 'message': 'Iniciando instalação do Traefik...'}
        background_tasks.add_task(run_generic_install_task, 'traefik', install_traefik, request.host, request.username, request.password, request.email, stack_name="traefik")
        return {"message": f"Instalação do Traefik iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar o Traefik: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-postgres")
def trigger_install_postgres(request: PostgresInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Postgres em um servidor remoto.
    """
    try:
        if check_stack_exists(request.host, request.username, request.password, "postgres") and not request.overwrite:
             return {"message": f"A stack 'postgres' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        if not request.postgres_password:
            request.postgres_password = secrets.token_urlsafe(32)
            logger.info(f"Senha do Postgres gerada automaticamente: {request.postgres_password}")

        from app.installer import install_postgres
        install_status['postgres'] = {'status': 'pending', 'message': 'Iniciando instalação do Postgres...'}
        background_tasks.add_task(run_generic_install_task, 'postgres', install_postgres, request.host, request.username, request.password, request.postgres_password, stack_name="postgres")
        return {"message": f"Instalação do Postgres iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Postgres: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-rabbitmq")
def trigger_install_rabbitmq(request: RabbitMQInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do RabbitMQ em um servidor remoto.
    """
    try:
        if check_stack_exists(request.host, request.username, request.password, "rabbitmq") and not request.overwrite:
             return {"message": f"A stack 'rabbitmq' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        from app.installer import install_rabbitmq
        install_status['rabbitmq'] = {'status': 'pending', 'message': 'Iniciando instalação do RabbitMQ...'}
        background_tasks.add_task(run_generic_install_task, 'rabbitmq', install_rabbitmq, request.host, request.username, request.password, request.rabbit_user, request.rabbit_password, request.rabbit_base_url, stack_name="rabbitmq")
        return {"message": f"Instalação do RabbitMQ iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar RabbitMQ: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-chatwoot")
def trigger_install_chatwoot(request: ChatwootInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy das stacks do Chatwoot (Admin e Sidekiq) em um servidor remoto.
    """
    try:
        save_setting("stack_domain_chatwoot_admin", request.chatwoot_base_url, request.host)
        active_stacks = get_active_stacks(request.host, request.username, request.password)
        existing_stack = next((s for s in active_stacks if s == "chatwoot_admin" or s.startswith("chatwoot_admin_")), None)
        
        if existing_stack and not request.overwrite:
             return {"message": f"A stack '{existing_stack}' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        if not request.postgres_password:
            try:
                from app.installer import get_stack_env_vars
                pg_env = get_stack_env_vars(request.host, request.username, request.password, "postgres")
                request.postgres_password = pg_env.get("POSTGRES_PASSWORD")
            except Exception as e:
                logger.warning(f"Não foi possível obter senha do Postgres para Chatwoot: {e}")

        request.postgres_password = request.postgres_password or ""

        from app.installer import install_chatwoot
        install_status['chatwoot'] = {'status': 'pending', 'message': 'Iniciando instalação do Chatwoot...'}
        background_tasks.add_task(
            run_generic_install_task, 
            'chatwoot', 
            install_chatwoot, 
            request.host, 
            request.username, 
            request.password, 
            request.postgres_password, 
            request.s3_bucket_name,
            request.s3_access_key_id,
            request.s3_secret_access_key,
            request.s3_region,
            request.s3_endpoint,
            request.chatwoot_base_url,
            overwrite=request.overwrite,
            stack_name="chatwoot_admin"
        )
        return {"message": f"Instalação do Chatwoot iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Chatwoot: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/get-stack-env/{stack_name}")
def get_stack_env(stack_name: str, credentials: ServerCredentials):
    """
    Obtém as variáveis de ambiente de uma stack.
    """
    from app.installer import get_stack_env_vars
    try:
        env_vars = get_stack_env_vars(credentials.host, credentials.username, credentials.password, stack_name)
        return {"env_vars": env_vars}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-stack-env")
def update_stack_env(data: EnvUpdate):
    """
    Atualiza as variáveis de ambiente de uma stack.
    """
    from app.installer import update_stack_env_vars
    try:
        result = update_stack_env_vars(data.host, data.username, data.password, data.stack_name, data.env_vars)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restart-stack")
def trigger_restart_stack(request: RestartStackRequest, background_tasks: BackgroundTasks):
    """
    Reinicia todos os serviços de uma stack específica.
    """
    try:
        from app.installer import restart_stack_services
        background_tasks.add_task(restart_stack_services, request.host, request.username, request.password, request.stack_name)
        return {"message": f"Reinício da stack '{request.stack_name}' iniciado em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao reiniciar stack: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-ai-agent-manager")
def trigger_install_ai_agent_manager(request: AIAgentManagerInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Gerente de Agente de IA em um servidor remoto.
    """
    try:
        save_setting("stack_domain_agentes", f"{request.domain_backend},{request.domain_frontend}", request.host)
        active_stacks = get_active_stacks(request.host, request.username, request.password)
        
        if "agentes" in active_stacks and not request.overwrite:
             return {"message": f"A stack 'agentes' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        if not request.postgres_password:
            try:
                from app.installer import get_stack_env_vars
                pg_env = get_stack_env_vars(request.host, request.username, request.password, "postgres")
                request.postgres_password = pg_env.get("POSTGRES_PASSWORD")
            except Exception as e:
                logger.warning(f"Não foi possível obter senha do Postgres para AI Agent Manager: {e}")

        from app.installer import install_ai_agent_manager
        install_status['ai_agent_manager'] = {'status': 'pending', 'message': 'Iniciando instalação do Gerente de Agente de IA...'}
        background_tasks.add_task(run_generic_install_task, 'ai_agent_manager', install_ai_agent_manager, 
                                 request.host, request.username, request.password, 
                                 request.postgres_password, request.openai_api_key, 
                                 request.domain_backend, request.domain_frontend,
                                 request.agent_api_key, request.google_client_id,
                                 request.google_client_secret, request.google_redirect_uri,
                                 request.gunicorn_workers, stack_name="agentes")
        
        return {"message": f"Instalação do Gerente de Agente de IA iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar AI Agent Manager: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-zapvoice")
def install_zapvoice_endpoint(request: ZapVoiceRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para instalar o ZapVoice em background.
    """
    try:
        save_setting("stack_domain_zapvoice", request.chatwoot_base_url, request.host)
        from app.installer import install_zapvoice
        install_status['zapvoice'] = {'status': 'pending', 'message': 'Iniciando instalação do ZapVoice...'}
        background_tasks.add_task(run_generic_install_task, 'zapvoice', install_zapvoice, 
                                 request.host, request.username, request.password, 
                                 request.postgres_password, request.chatwoot_base_url,
                                 request.super_admin_email, request.secret_key, stack_name="zapvoice")
        
        return {"message": f"Instalação do ZapVoice iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar ZapVoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-gerenciador-whatsapp")
def install_gerenciador_whatsapp_endpoint(request: GerenciadorWhatsAppInstallRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para instalar o Gerenciador Grupo WhatsApp em background.
    """
    try:
        save_setting("stack_domain_gerenciador_whatsapp", f"{request.backend_domain},{request.frontend_domain}", request.host)
        
        if not request.postgres_password:
            try:
                from app.installer import get_stack_env_vars
                pg_env = get_stack_env_vars(request.host, request.username, request.password, "postgres")
                request.postgres_password = pg_env.get("POSTGRES_PASSWORD")
            except Exception as e:
                logger.warning(f"Não foi possível obter senha do Postgres para Gerenciador Grupo WhatsApp: {e}")

        from app.installer import install_gerenciador_whatsapp
        install_status['gerenciador_whatsapp'] = {'status': 'pending', 'message': 'Iniciando instalação do Gerenciador Grupo WhatsApp...'}
        background_tasks.add_task(run_generic_install_task, 'gerenciador_whatsapp', install_gerenciador_whatsapp, 
                                 request.host, request.username, request.password, 
                                 request.postgres_password, request.super_admin_email,
                                 request.backend_domain, request.frontend_domain, stack_name="gerenciador_whatsapp")
        
        return {"message": f"Instalação do Gerenciador Grupo WhatsApp iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Gerenciador Grupo WhatsApp: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/uninstall-stack")
def trigger_uninstall_stack(request: UninstallStackRequest, background_tasks: BackgroundTasks):
    """
    Inicia o processo de desinstalação completa de uma stack (Zero Bala).
    """
    try:
        from app.database import get_setting, delete_stack_credentials
        is_external = get_setting(f"external_installed_{request.stack_id}", request.host) == "true"
        
        if is_external:
            logger.info(f"Removendo associação de stack externa: Stack={request.stack_id} no Host={request.host}")
            save_setting(f"external_installed_{request.stack_id}", "false", request.host)
            save_setting(f"external_urls_{request.stack_id}", "", request.host)
            save_setting(f"external_version_{request.stack_id}", "", request.host)
            save_setting(f"stack_domain_{request.stack_id}", "", request.host)
            delete_stack_credentials(request.host, request.stack_id)
            install_status[request.stack_id] = {'status': 'success', 'message': f'Associação externa de {request.stack_id} removida.'}
            return {"message": f"Associação externa de {request.stack_id} removida com sucesso."}
            
        from app.installer import uninstall_stack
        save_setting(f"stack_version_{request.stack_id}", "", request.host)
        save_setting(f"stack_domain_{request.stack_id}", "", request.host)
        logger.info(f"SOLICITAÇÃO DE DESINSTALAÇÃO: Stack={request.stack_id}, Name={request.stack_name} no Host={request.host}")
        install_status[request.stack_id] = {'status': 'pending', 'message': f'Iniciando desinstalação de {request.stack_id}...'}
        
        def run_uninstall():
             install_status[request.stack_id] = {'status': 'running', 'message': f'Desinstalando {request.stack_id} (Zero Bala)...'}
             try:
                 result = uninstall_stack(request.host, request.username, request.password, request.stack_id, request.stack_name)
                 install_status[request.stack_id] = {'status': 'success', 'message': result.get('message')}
             except Exception as e:
                 logger.error(f"Erro ao desinstalar {request.stack_id}: {e}")
                 install_status[request.stack_id] = {'status': 'error', 'message': str(e)}

        background_tasks.add_task(run_uninstall)
        return {"message": f"Desinstalação de {request.stack_id} iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao desinstalar stack: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update-stack-domain")
async def update_stack_domain_endpoint(request: StackDomainUpdateRequest):
    """
    Atualiza o domínio configurado nas labels e variáveis de ambiente de uma stack.
    """
    try:
        save_setting(f"stack_domain_{request.stack_name}", request.new_domain, request.host)
        from app.installer import update_stack_domain
        logger.info(f"POST /update-stack-domain recebido para stack '{request.stack_name}'")
        
        result = await asyncio.to_thread(
            update_stack_domain,
            request.host,
            request.username,
            request.password,
            request.stack_name,
            request.old_domain,
            request.new_domain
        )
        return result
    except Exception as e:
        logger.error(f"Erro ao processar /update-stack-domain: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-external-stack")
def mark_external_stack(req: ExternalStackRequest):
    """
    Associa uma stack instalada externamente no banco de dados.
    """
    try:
        logger.info(f"POST /mark-external-stack recebido para stack '{req.stack_name}' no Host '{req.host}'")
        save_setting(f"external_installed_{req.stack_name}", "true", req.host)
        save_setting(f"external_urls_{req.stack_name}", req.url, req.host)
        
        if req.version:
            save_setting(f"external_version_{req.stack_name}", req.version, req.host)
        else:
            save_setting(f"external_version_{req.stack_name}", "", req.host)
            
        if req.email or req.password:
            save_stack_credentials(req.host, req.stack_name, req.email or "", req.password or "")
            
        logger.info(f"Stack '{req.stack_name}' associada externamente com URL '{req.url}' e versão '{req.version}'")
        return {"status": "success", "message": f"Aplicação '{req.stack_name}' associada externamente com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao associar stack externa '{req.stack_name}': {e}")
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
