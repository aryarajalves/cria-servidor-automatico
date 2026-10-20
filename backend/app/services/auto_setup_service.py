import logging
import time
import secrets
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.services.base_ssh import get_ssh_client, run_ssh_command
from app.services.docker_swarm import (
    install_docker, init_swarm, create_network, install_ctop, update_docker_version_config
)
from app.services.database_apps import (
    install_postgres, install_redis, install_rabbitmq, install_minio
)
from app.services.web_apps import (
    install_traefik, install_portainer, install_smartvsl,
    install_smartacademy, install_formulario_personalizado, install_zapvoice,
    install_gerenciador_whatsapp, install_oraculo, install_ai_agent_manager,
    install_backup_chatwoo_rabbit
)
from app.portainer import init_portainer_admin, get_portainer_token
from app.database import save_setting, save_stack_credentials, get_setting
from app.state import clear_system_status_cache

logger = logging.getLogger(__name__)

# Armazenamento em memória do estado de execução do Setup Automático por Host
auto_setup_states: Dict[str, Dict[str, Any]] = {}

def get_auto_setup_state(host: str) -> Dict[str, Any]:
    if host not in auto_setup_states:
        auto_setup_states[host] = {
            "status": "idle",
            "current_step": "",
            "step_index": 0,
            "total_steps": 0,
            "steps": [],
            "logs": [],
            "error": None
        }
    return auto_setup_states[host]

def _log_step(host: str, message: str):
    state = get_auto_setup_state(host)
    timestamp = datetime.now().strftime("%H:%M:%S")
    formatted = f"[{timestamp}] {message}"
    state["logs"].append(formatted)
    logger.info(f"[AutoSetup][{host}] {message}")

def run_auto_setup_pipeline(
    host: str,
    username: str,
    password: Optional[str] = None,
    install_docker_flag: bool = True,
    install_swarm_flag: bool = True,
    install_network_flag: bool = True,
    install_ctop_flag: bool = True,
    install_traefik_flag: bool = True,
    traefik_email: str = "aryarajmarketing@gmail.com",
    install_portainer_flag: bool = True,
    portainer_domain: Optional[str] = None,
    portainer_password: Optional[str] = None,
    install_postgres_flag: bool = True,
    postgres_password: Optional[str] = None,
    install_redis_flag: bool = True,
    install_rabbitmq_flag: bool = True,
    rabbitmq_user: str = "admin",
    rabbitmq_password: Optional[str] = None,
    install_minio_flag: bool = False,
    minio_console_url: Optional[str] = None,
    minio_server_url: Optional[str] = None,
    minio_root_user: str = "admin",
    minio_root_password: Optional[str] = None,
    custom_apps: Optional[List[Dict[str, Any]]] = None
):
    """
    Executa a pipeline sequencial de setup automatizado do servidor.
    """
    state = get_auto_setup_state(host)
    state["status"] = "running"
    state["error"] = None
    state["logs"] = []

    # Monta a lista de etapas planejadas
    steps = []
    if install_docker_flag:
        steps.append({"id": "docker", "title": "Docker Engine", "status": "pending"})
    if install_swarm_flag:
        steps.append({"id": "swarm", "title": "Ativar Swarm", "status": "pending"})
    if install_network_flag:
        steps.append({"id": "network", "title": "Rede Overlay (network_swarm_public)", "status": "pending"})
    if install_ctop_flag:
        steps.append({"id": "ctop", "title": "Monitor Ctop", "status": "pending"})
    if install_traefik_flag:
        steps.append({"id": "traefik", "title": "Traefik Proxy (SSL)", "status": "pending"})
    if install_portainer_flag and portainer_domain:
        steps.append({"id": "portainer", "title": "Portainer CE & API", "status": "pending"})
    if install_postgres_flag:
        steps.append({"id": "postgres", "title": "Banco PostgreSQL", "status": "pending"})
    if install_redis_flag:
        steps.append({"id": "redis", "title": "Cache Redis", "status": "pending"})
    if install_rabbitmq_flag:
        steps.append({"id": "rabbitmq", "title": "Fila RabbitMQ", "status": "pending"})
    if install_minio_flag and minio_console_url and minio_server_url:
        steps.append({"id": "minio", "title": "Storage MinIO S3", "status": "pending"})

    if custom_apps:
        for app in custom_apps:
            app_id = app.get("id")
            app_title = app.get("title") or app_id.capitalize()
            steps.append({"id": f"app_{app_id}", "title": app_title, "status": "pending", "app_data": app})

    state["steps"] = steps
    state["total_steps"] = len(steps)
    state["step_index"] = 0

    _log_step(host, f"Iniciando Setup Automático com {len(steps)} etapas planejadas...")

    # Senhas automáticas se não informadas
    if not postgres_password:
        postgres_password = secrets.token_urlsafe(16)
    if not portainer_password:
        portainer_password = secrets.token_urlsafe(16)
    if not rabbitmq_password:
        rabbitmq_password = secrets.token_urlsafe(16)

    try:
        for idx, step in enumerate(steps, start=1):
            state["step_index"] = idx
            state["current_step"] = step["title"]
            step["status"] = "running"
            step_id = step["id"]

            _log_step(host, f"[{idx}/{len(steps)}] Executando: {step['title']}...")

            # 1. Docker
            if step_id == "docker":
                try:
                    install_docker(host, username, password)
                    update_docker_version_config(host, username, password)
                    _log_step(host, "Docker Engine instalado e configurado com sucesso!")
                except Exception as e:
                    if "already installed" in str(e).lower():
                        _log_step(host, "Docker Engine já estava instalado no servidor.")
                    else:
                        raise e

            # 2. Swarm
            elif step_id == "swarm":
                init_swarm(host, username, password, advertise_addr=host)
                _log_step(host, "Cluster Swarm ativo e pronto!")

            # 3. Rede Overlay
            elif step_id == "network":
                create_network(host, username, password, "network_swarm_public")
                _log_step(host, "Rede overlay 'network_swarm_public' criada com sucesso!")

            # 4. Ctop
            elif step_id == "ctop":
                try:
                    install_ctop(host, username, password)
                    _log_step(host, "Ctop CLI instalado com sucesso!")
                except Exception as ce:
                    _log_step(host, f"Aviso ao instalar Ctop (não-bloqueante): {ce}")

            # 5. Traefik
            elif step_id == "traefik":
                install_traefik(host, username, password, email=traefik_email)
                _log_step(host, f"Traefik Proxy instalado com e-mail {traefik_email}!")

            # 6. Portainer
            elif step_id == "portainer":
                portainer_clean_domain = portainer_domain.replace("https://", "").replace("http://", "").strip("/")
                save_setting("stack_domain_portainer", portainer_clean_domain, host)
                install_portainer(host, username, password, portainer_clean_domain)
                _log_step(host, f"Stack do Portainer implantada com domínio {portainer_clean_domain}!")

                # Aguarda alguns segundos para o container do Portainer subir
                _log_step(host, "Aguardando inicialização da API do Portainer...")
                time.sleep(12)

                # Inicializa admin do Portainer via API
                admin_created = False
                for port in [9000, 9443]:
                    scheme = "https" if port == 9443 else "http"
                    base_url = f"{scheme}://{host}:{port}"
                    res = init_portainer_admin(base_url, "admin", portainer_password, verify=False, timeout=8)
                    if res:
                        admin_created = True
                        _log_step(host, f"Conta de Administrador do Portainer configurada com sucesso em {base_url}!")
                        break

                if not admin_created:
                    # Tenta via Traefik HTTPS domain
                    domain_url = f"https://{portainer_clean_domain}"
                    res = init_portainer_admin(domain_url, "admin", portainer_password, verify=False, timeout=8)
                    if res:
                        _log_step(host, f"Conta de Administrador do Portainer configurada via domínio {domain_url}!")

                # Salva credenciais do Portainer
                save_setting("portainer_user", "admin", host)
                save_setting("portainer_password", portainer_password, host)
                save_stack_credentials(host, "portainer", "admin", portainer_password)
                _log_step(host, "Credenciais do Portainer salvas. Stacks seguintes serão gerenciadas via Portainer API!")

            # 7. PostgreSQL
            elif step_id == "postgres":
                install_postgres(host, username, password, postgres_password)
                save_stack_credentials(host, "postgres", "postgres", postgres_password)
                _log_step(host, "PostgreSQL instalado e credenciais registradas com segurança!")

            # 8. Redis
            elif step_id == "redis":
                install_redis(host, username, password)
                _log_step(host, "Redis instalado com sucesso!")

            # 9. RabbitMQ
            elif step_id == "rabbitmq":
                install_rabbitmq(host, username, password, rabbitmq_user, rabbitmq_password)
                save_stack_credentials(host, "rabbitmq", rabbitmq_user, rabbitmq_password)
                _log_step(host, f"RabbitMQ instalado com usuário '{rabbitmq_user}'!")

            # 10. MinIO
            elif step_id == "minio":
                if not minio_root_password:
                    minio_root_password = secrets.token_urlsafe(16)
                install_minio(host, username, password, minio_root_user, minio_root_password, minio_console_url, minio_server_url)
                save_stack_credentials(host, "minio", minio_root_user, minio_root_password)
                _log_step(host, "MinIO instalado com sucesso!")

            # 11. Apps Próprios Customizados
            elif step_id.startswith("app_"):
                app_data = step.get("app_data", {})
                a_id = app_data.get("id")
                params = app_data.get("params", {})

                if a_id == "smartvsl":
                    b_domain = params.get("backend_domain", "")
                    f_domain = params.get("frontend_domain", "")
                    s_email = params.get("super_admin_email", "aryarajmarketing@gmail.com")
                    install_smartvsl(host, username, password, postgres_password, b_domain, f_domain, s_email)
                    _log_step(host, f"SmartVSL instalado com sucesso ({f_domain})!")

                elif a_id == "smartacademy":
                    b_domain = params.get("backend_domain", "")
                    f_domain = params.get("frontend_domain", "")
                    s_email = params.get("superadmin_email", "aryarajmarketing@gmail.com")
                    s_name = params.get("superadmin_name", "Aryaraj")
                    o_key = params.get("openai_api_key", "")
                    install_smartacademy(host, username, password, postgres_password, b_domain, f_domain, s_name, s_email, o_key)
                    _log_step(host, f"Smart Academy instalado com sucesso ({f_domain})!")

                elif a_id == "formulario_personalizado":
                    b_domain = params.get("backend_domain", "")
                    f_domain = params.get("frontend_domain", "")
                    install_formulario_personalizado(host, username, password, postgres_password, b_domain, f_domain)
                    _log_step(host, f"Formulário Personalizado instalado com sucesso ({f_domain})!")

                elif a_id == "zapvoice":
                    z_domain = params.get("chatwoot_base_url") or params.get("zapvoice_domain", "")
                    s_email = params.get("super_admin_email", "aryarajmarketing@gmail.com")
                    install_zapvoice(host, username, password, postgres_password, z_domain, s_email)
                    _log_step(host, f"ZapVoice instalado com sucesso ({z_domain})!")

                elif a_id == "gerenciador_whatsapp":
                    b_domain = params.get("backend_domain", "")
                    f_domain = params.get("frontend_domain", "")
                    s_email = params.get("super_admin_email", "aryarajmarketing@gmail.com")
                    install_gerenciador_whatsapp(host, username, password, postgres_password, s_email, b_domain, f_domain)
                    _log_step(host, f"Gerenciador de WhatsApp instalado com sucesso ({f_domain})!")

                elif a_id == "ai_agent_manager":
                    b_domain = params.get("domain_backend", "")
                    f_domain = params.get("domain_frontend", "")
                    o_key = params.get("openai_api_key", "")
                    install_ai_agent_manager(host, username, password, postgres_password, o_key, b_domain, f_domain)
                    _log_step(host, f"Gerente de Agente de IA instalado com sucesso ({f_domain})!")

                elif a_id == "backup_chatwoo_rabbit":
                    b_url = params.get("base_url", "")
                    install_backup_chatwoo_rabbit(
                        host, username, password, postgres_password, b_url,
                        s3_endpoint_url=params.get("s3_endpoint_url", ""),
                        s3_access_key_id=params.get("s3_access_key_id", ""),
                        s3_secret_access_key=params.get("s3_secret_access_key", ""),
                        s3_bucket_name=params.get("s3_bucket_name", ""),
                        rabbitmq_host="rabbitmq",
                        rabbitmq_management_port=15672,
                        rabbitmq_user=rabbitmq_user,
                        rabbitmq_password=rabbitmq_password,
                        login_email=params.get("login_email", "aryarajmarketing@gmail.com"),
                        login_password=secrets.token_urlsafe(16)
                    )
                    _log_step(host, f"Backup instalado com sucesso ({b_url})!")

                elif a_id == "oraculo":
                    o_domain = params.get("oraculo_domain", "")
                    o_key = params.get("openai_api_key", "")
                    g_key = params.get("gemini_api_key", "")
                    a_key = params.get("anthropic_api_key", "")
                    f_key = params.get("fal_key", "")
                    e_key = params.get("elevenlabs_api_key", "")
                    install_oraculo(host, username, password, o_domain, openai_api_key=o_key, gemini_api_key=g_key, anthropic_api_key=a_key, fal_key=f_key, elevenlabs_api_key=e_key)
                    _log_step(host, f"Oráculo instalado com sucesso ({o_domain})!")

            step["status"] = "completed"

        state["status"] = "completed"
        state["current_step"] = "Setup Automático Concluído com Sucesso!"
        _log_step(host, "🎉 PARABÉNS! Todas as etapas do Setup Automático foram finalizadas com sucesso!")
        clear_system_status_cache(host)

    except Exception as e:
        logger.error(f"Erro no Setup Automático em {host}: {e}")
        state["status"] = "error"
        state["error"] = str(e)
        _log_step(host, f"❌ ERRO CRÍTICO: {e}")
        for s in state["steps"]:
            if s["status"] == "running":
                s["status"] = "error"
                s["error"] = str(e)
                break
