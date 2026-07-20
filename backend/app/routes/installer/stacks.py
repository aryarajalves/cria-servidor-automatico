from fastapi import APIRouter, HTTPException, BackgroundTasks
import logging
import asyncio
import secrets

from app.state import install_status, clear_system_status_cache
from app.database import get_setting, save_stack_credentials, save_setting, delete_stack_credentials
from app.installer import (
    check_stack_exists, get_active_stacks
)
from .schemas import (
    ServerCredentials, RedisInstallRequest, PortainerInstallRequest,
    TraefikInstallRequest, PostgresInstallRequest, RabbitMQInstallRequest,
    EnvUpdate, RestartStackRequest,
    AIAgentManagerInstallRequest, ZapVoiceRequest, GerenciadorWhatsAppInstallRequest,
    UninstallStackRequest, StackDomainUpdateRequest, ExternalStackRequest, MinioInstallRequest,
    BackupChatwooRabbitInstallRequest, OraculoInstallRequest
)

logger = logging.getLogger(__name__)
router = APIRouter()

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
        clear_system_status_cache(host)
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
        save_setting("stack_domain_rabbitmq", request.rabbit_base_url, request.host)
        if check_stack_exists(request.host, request.username, request.password, "rabbitmq") and not request.overwrite:
             return {"message": f"A stack 'rabbitmq' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        from app.installer import install_rabbitmq
        install_status['rabbitmq'] = {'status': 'pending', 'message': 'Iniciando instalação do RabbitMQ...'}
        background_tasks.add_task(run_generic_install_task, 'rabbitmq', install_rabbitmq, request.host, request.username, request.password, request.rabbit_user, request.rabbit_password, request.rabbit_base_url, stack_name="rabbitmq")
        return {"message": f"Instalação do RabbitMQ iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar RabbitMQ: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-minio")
def trigger_install_minio(request: MinioInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do MinIO em um servidor remoto.
    """
    try:
        if check_stack_exists(request.host, request.username, request.password, "minio") and not request.overwrite:
             return {"message": f"A stack 'minio' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        save_setting("stack_domain_minio", f"{request.minio_server_url},{request.minio_console_url}", request.host)
        from app.installer import install_minio
        install_status['minio'] = {'status': 'pending', 'message': 'Iniciando instalação do MinIO...'}
        background_tasks.add_task(
            run_generic_install_task, 
            'minio', 
            install_minio, 
            request.host, 
            request.username, 
            request.password, 
            request.minio_root_user, 
            request.minio_root_password, 
            request.minio_console_url, 
            request.minio_server_url, 
            stack_name="minio"
        )
        return {"message": f"Instalação do MinIO iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar MinIO: {e}")
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
def update_stack_env_endpoint(data: EnvUpdate):
    """
    Atualiza as variáveis de ambiente de uma stack.
    """
    from app.installer import update_stack_env_vars
    try:
        result = update_stack_env_vars(data.host, data.username, data.password, data.stack_name, data.env_vars)
        clear_system_status_cache(data.host)
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

@router.post("/install-backup-chatwoo-rabbit")
def install_backup_chatwoo_rabbit_endpoint(request: BackupChatwooRabbitInstallRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para instalar a stack do Backup Automático do Chatwoot com RabbitMQ em background.
    """
    try:
        save_setting("stack_domain_backup_chatwoo_rabbit", request.base_url, request.host)

        if not request.postgres_password:
            try:
                from app.installer import get_stack_env_vars
                pg_env = get_stack_env_vars(request.host, request.username, request.password, "postgres")
                request.postgres_password = pg_env.get("POSTGRES_PASSWORD")
            except Exception as e:
                logger.warning(f"Não foi possível obter senha do Postgres para Backup Chatwoot Rabbit: {e}")

        from app.installer import install_backup_chatwoo_rabbit
        install_status['backup_chatwoo_rabbit'] = {'status': 'pending', 'message': 'Iniciando instalação do Backup Automático do Chatwoot com RabbitMQ...'}
        background_tasks.add_task(
            run_generic_install_task, 'backup_chatwoo_rabbit', install_backup_chatwoo_rabbit,
            request.host, request.username, request.password,
            request.postgres_password, request.base_url,
            request.s3_endpoint_url, request.s3_access_key_id, request.s3_secret_access_key, request.s3_bucket_name,
            request.rabbitmq_host, request.rabbitmq_management_port, request.rabbitmq_user, request.rabbitmq_password,
            request.login_email, request.login_password, request.jwt_secret,
            stack_name="backup_chatwoo_rabbit"
        )

        return {"message": f"Instalação do Backup Automático do Chatwoot com RabbitMQ iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Backup Chatwoot Rabbit: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/uninstall-stack")
def trigger_uninstall_stack(request: UninstallStackRequest, background_tasks: BackgroundTasks):
    """
    Inicia o processo de desinstalação completa de uma stack (Zero Bala).
    """
    try:
        from app.database import get_setting
        is_external = get_setting(f"external_installed_{request.stack_id}", request.host) == "true"
        
        if is_external:
            logger.info(f"Removendo associação de stack externa: Stack={request.stack_id} no Host={request.host}")
            save_setting(f"external_installed_{request.stack_id}", "false", request.host)
            save_setting(f"external_urls_{request.stack_id}", "", request.host)
            save_setting(f"external_version_{request.stack_id}", "", request.host)
            save_setting(f"stack_domain_{request.stack_id}", "", request.host)
            delete_stack_credentials(request.host, request.stack_id)
            clear_system_status_cache(request.host)
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
                 clear_system_status_cache(request.host)
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
        clear_system_status_cache(request.host)
        return result
    except Exception as e:
        logger.error(f"Erro ao processar /update-stack-domain: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/mark-external-stack")
def mark_external_stack_endpoint(req: ExternalStackRequest):
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
        clear_system_status_cache(req.host)
        return {"status": "success", "message": f"Aplicação '{req.stack_name}' associada externamente com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao associar stack externa '{req.stack_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/install-oraculo")
def install_oraculo_endpoint(request: OraculoInstallRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para instalar a stack do Oráculo em background.
    """
    try:
        save_setting("stack_domain_oraculo", request.oraculo_domain, request.host)
        from app.installer import install_oraculo
        install_status['oraculo'] = {'status': 'pending', 'message': 'Iniciando instalação do Oráculo...'}
        background_tasks.add_task(run_generic_install_task, 'oraculo', install_oraculo,
                                 request.host, request.username, request.password,
                                 request.oraculo_domain, request.openai_api_key,
                                 request.gemini_api_key, request.anthropic_api_key,
                                 request.fal_key, request.elevenlabs_api_key,
                                 request.dashboard_user, request.dashboard_pass,
                                 request.dashboard_user_name, stack_name="oraculo")
        
        return {"message": f"Instalação do Oráculo iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Oráculo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

