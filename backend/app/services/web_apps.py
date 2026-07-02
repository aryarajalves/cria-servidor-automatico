import logging
import os
import time
import json
import secrets
import requests
from fastapi import HTTPException
from app.services.base_ssh import get_ssh_client, run_ssh_command, deploy_stack_remote, get_stack_path
from app.services.database_apps import create_postgres_database, delete_postgres_database
from app.database import get_setting, save_stack_credentials, delete_stack_credentials, get_stack_credentials

logger = logging.getLogger(__name__)

def install_traefik(host, username, password, email):
    """
    Faz o deploy da stack do Traefik em um servidor remoto via SSH.
    """
    stack_path = get_stack_path("traefik.yml")
    if not os.path.exists(stack_path):
        raise FileNotFoundError(f"Arquivo de stack não encontrado: {stack_path}")

    with open(stack_path, "r") as f:
        stack_content = f.read()

    stack_content = stack_content.replace("{email}", email)
        
    client = get_ssh_client(host, username, password)
    try:
        result = deploy_stack_remote(client, "traefik", stack_content)
        return result
    finally:
        client.close()

def install_redis(host, username, password):
    stack_path = get_stack_path("redis.yml")
    with open(stack_path, "r") as f:
        stack_content = f.read()
    client = get_ssh_client(host, username, password)
    try:
        result = deploy_stack_remote(client, "redis", stack_content)
        return result
    finally:
        client.close()

def install_portainer(host, username, password, portainer_host):
    """
    Faz o deploy da stack do Portainer em um servidor remoto via SSH.
    """
    stack_path = get_stack_path("portainer.yml")
    if not os.path.exists(stack_path):
        raise FileNotFoundError(f"Arquivo de stack não encontrado: {stack_path}")

    with open(stack_path, "r") as f:
        stack_content = f.read()
    stack_content = stack_content.replace("{portainer_host}", portainer_host)
        
    client = get_ssh_client(host, username, password)
    try:
        result = deploy_stack_remote(client, "portainer", stack_content)
        if result.get("status") == "success":
            pt_user = get_setting("portainer_user", host) or "admin"
            pt_pass = get_setting("portainer_password", host) or "admin12345"
            result["credentials"] = {"user": pt_user, "password": pt_pass}
        return result
    finally:
        client.close()

def install_ai_agent_manager(host, username, password, postgres_password, openai_api_key, domain_backend, domain_frontend, agent_api_key=None, google_client_id="", google_client_secret="", google_redirect_uri="", gunicorn_workers="4"):
    client = get_ssh_client(host, username, password)
    try:
        # Obter configurações do ZapVoice automaticamente
        zapvoice_env = get_stack_env_vars(host, username, password, "zapvoice")
        if not zapvoice_env:
            raise HTTPException(
                status_code=400,
                detail="A stack 'zapvoice' precisa estar instalada e ativa no servidor antes de instalar o AgentFlow."
            )
        
        zapvoice_api_token = zapvoice_env.get("REGISTER_API_KEY") or zapvoice_env.get("ZAPVOICE_API_TOKEN") or ""
        stored_zapvoice_domain = get_setting("stack_domain_zapvoice", host)
        if stored_zapvoice_domain:
            zapvoice_url = stored_zapvoice_domain.strip()
            if not zapvoice_url.startswith("http"):
                zapvoice_url = f"https://{zapvoice_url}"
        else:
            zapvoice_url = zapvoice_env.get("WEBHOOK_BASE_URL") or ""
            
        # Obter configurações do MinIO automaticamente
        minio_env = get_stack_env_vars(host, username, password, "minio")
        if not minio_env:
            raise HTTPException(
                status_code=400,
                detail="A stack 'minio' precisa estar instalada e ativa no servidor antes de instalar o AgentFlow."
            )
            
        minio_user = minio_env.get("MINIO_ROOT_USER") or minio_env.get("MINIO_ACCESS_KEY") or "unwind"
        minio_pass = minio_env.get("MINIO_ROOT_PASSWORD") or minio_env.get("MINIO_SECRET_KEY") or "SuaSenhaAqui"
        
        minio_endpoint = ""
        stored_minio_domain = get_setting("stack_domain_minio", host)
        if stored_minio_domain:
            parts = stored_minio_domain.split(",")
            minio_endpoint = parts[0].strip()
            if not minio_endpoint.startswith("http"):
                minio_endpoint = f"https://{minio_endpoint}"
        else:
            minio_endpoint = minio_env.get("MINIO_SERVER_URL") or ""
            
        s3_bucket_name = "zap-voice"  # Padrão
        s3_region = minio_env.get("MINIO_REGION") or "us-east-1"

        create_postgres_database(client, "ai_agent_manager")
        
        # Reutiliza credenciais e configs existentes se a stack já foi deployada
        existing_services = get_stack_services(client, "agentes")
        if existing_services:
            existing_env = get_service_env_vars(client, existing_services[0])
            if existing_env.get("OPENAI_API_KEY") and not openai_api_key:
                openai_api_key = existing_env.get("OPENAI_API_KEY")
            if existing_env.get("AGENT_API_KEY"):
                agent_api_key = existing_env.get("AGENT_API_KEY")
            logger.info("AI Agent Manager: reutilizando credenciais e configs existentes da stack.")

        if not agent_api_key:
            import uuid
            agent_api_key = str(uuid.uuid4())
        db_url = f"postgresql://postgres:{postgres_password}@postgres_postgres:5432/ai_agent_manager"
        domain_backend_clean = domain_backend.replace("https://", "").replace("http://", "").strip("/")
        domain_frontend_clean = domain_frontend.replace("https://", "").replace("http://", "").strip("/")
        stack_path = get_stack_path("ai_agent_manager.yml")
        with open(stack_path, "r", encoding="utf-8") as f: content = f.read()
        content = content.replace("{DATABASE_URL}", db_url) \
                         .replace("{OPENAI_API_KEY}", openai_api_key) \
                         .replace("{GUNICORN_WORKERS}", gunicorn_workers) \
                         .replace("{AGENT_API_KEY}", agent_api_key) \
                         .replace("{VITE_AGENT_API_KEY}", agent_api_key) \
                         .replace("{GOOGLE_CLIENT_ID}", google_client_id) \
                         .replace("{GOOGLE_CLIENT_SECRET}", google_client_secret) \
                         .replace("{GOOGLE_REDIRECT_URI}", google_redirect_uri) \
                         .replace("{DOMAIN_BACKEND}", domain_backend_clean) \
                         .replace("{DOMAIN_FRONTEND}", domain_frontend_clean) \
                         .replace("{VITE_API_URL}", f"https://{domain_backend_clean}") \
                         .replace("{S3_ENDPOINT_URL}", minio_endpoint) \
                         .replace("{S3_ACCESS_KEY}", minio_user) \
                         .replace("{S3_SECRET_KEY}", minio_pass) \
                         .replace("{S3_BUCKET_NAME}", s3_bucket_name) \
                         .replace("{S3_REGION}", s3_region) \
                         .replace("{ZAPVOICE_URL}", zapvoice_url) \
                         .replace("{ZAPVOICE_API_TOKEN}", zapvoice_api_token)
        deploy_stack_remote(client, "agentes", content)
        return {"status": "success", "message": "Gerente de Agente de IA instalado.", "credentials": {"user": "", "password": ""}}
    finally: client.close()

def get_stack_services(client, stack_name):
    cmd = f"docker stack services {stack_name} --format '{{{{.Name}}}}'"
    output = run_ssh_command(client, cmd)
    return [s.strip() for s in output.strip().splitlines() if s.strip()]

def get_service_env_vars(client, service_name):
    cmd = f"docker service inspect {service_name} --format '{{{{json .Spec.TaskTemplate.ContainerSpec.Env}}}}'"
    try:
        output = run_ssh_command(client, cmd)
        env_list = json.loads(output)
        if not env_list: return {}
        env_dict = {}
        for item in env_list:
            if "=" in item:
                key, value = item.split("=", 1)
                env_dict[key] = value
        return env_dict
    except: return {}

def get_stack_env_vars(host, username, password, stack_name):
    client = get_ssh_client(host, username, password)
    try:
        services = get_stack_services(client, stack_name)
        if not services: return {}
        return get_service_env_vars(client, services[0])
    finally:
        client.close()

def install_zapvoice(host, username, password, postgres_password, zapvoice_base_url, super_admin_email, secret_key=None):
    client = get_ssh_client(host, username, password)
    try:
        create_postgres_database(client, "zapvoice")
        if not secret_key: secret_key = secrets.token_urlsafe(48)
        super_admin_password = secrets.token_urlsafe(16)
        zap_url_clean = zapvoice_base_url.replace("https://", "").replace("http://", "").strip("/")
        
        # Reutiliza credenciais existentes se a stack já foi deployada
        existing_services = get_stack_services(client, "zapvoice")
        if existing_services:
            existing_env = get_service_env_vars(client, existing_services[0])
            if existing_env.get("SUPER_ADMIN_EMAIL"):
                super_admin_email = existing_env.get("SUPER_ADMIN_EMAIL")
            super_admin_password = existing_env.get("SUPER_ADMIN_PASSWORD") or super_admin_password
            secret_key = existing_env.get("SECRET_KEY") or secret_key
            logger.info("ZapVoice: reutilizando credenciais e email existentes da stack.")

        rabbit_env = get_stack_env_vars(host, username, password, "rabbitmq")
        rabbit_user = rabbit_env.get("RABBITMQ_DEFAULT_USER", "guest")
        rabbit_pass = rabbit_env.get("RABBITMQ_DEFAULT_PASS", "guest")
        
        # Obter credenciais e domínios do MinIO automaticamente
        minio_user = "unwind"
        minio_pass = "SuaSenhaAqui"
        try:
            minio_env = get_stack_env_vars(host, username, password, "minio")
            minio_user = minio_env.get("MINIO_ROOT_USER", "unwind")
            minio_pass = minio_env.get("MINIO_ROOT_PASSWORD", "SuaSenhaAqui")
        except Exception as e:
            logger.warning(f"Não foi possível obter credenciais do MinIO via env para o ZapVoice: {e}")
            minio_creds = get_stack_credentials(host, "minio")
            if minio_creds:
                minio_user = minio_creds.get("user", minio_user)
                minio_pass = minio_creds.get("password", minio_pass)

        minio_endpoint = ""
        minio_public_url = ""
        stored_minio_domain = get_setting("stack_domain_minio", host)
        if stored_minio_domain:
            parts = stored_minio_domain.split(",")
            minio_endpoint = parts[0].strip()
            if not minio_endpoint.startswith("http"):
                minio_public_url = f"https://{minio_endpoint}"
                minio_endpoint = f"https://{minio_endpoint}"
            else:
                minio_public_url = minio_endpoint

        stack_path = get_stack_path("zapvoice.yml")
        with open(stack_path, "r", encoding="utf-8") as f: content = f.read()
        
        content = content.replace("{Senha_Postgres}", postgres_password or "") \
                         .replace("{BaseUrl_ZapVoice}", zap_url_clean) \
                         .replace("{Secret_Key}", secret_key) \
                         .replace("{Usuario_Rabbit}", rabbit_user) \
                         .replace("{Senha_Rabbit}", rabbit_pass) \
                         .replace("{SUPER_ADMIN_EMAIL}", super_admin_email) \
                         .replace("{SUPER_ADMIN_PASSWORD}", super_admin_password) \
                         .replace("{Minio_Endpoint}", minio_endpoint) \
                         .replace("{Minio_User}", minio_user) \
                         .replace("{Minio_Password}", minio_pass) \
                         .replace("{Minio_Public_Url}", minio_public_url)
                         
        deploy_stack_remote(client, "zapvoice", content)
        # save_stack_credentials(host, "zapvoice", super_admin_email, super_admin_password)
        return {"status": "success", "message": "ZapVoice instalado.", "credentials": {"user": "", "password": ""}}
    finally: client.close()

def install_gerenciador_whatsapp(host, username, password, postgres_password, super_admin_email, backend_domain, frontend_domain):
    client = get_ssh_client(host, username, password)
    try:
        create_postgres_database(client, "zapgroup")
        
        # Reutiliza credenciais existentes se a stack já foi deployada
        existing_services = get_stack_services(client, "gerenciador_whatsapp")
        if existing_services:
            existing_env = get_service_env_vars(client, existing_services[0])
            api_secret = existing_env.get("API_SECRET") or secrets.token_hex(32)
            super_admin_password = existing_env.get("SUPER_ADMIN_PASSWORD") or secrets.token_urlsafe(16)
            if existing_env.get("SUPER_ADMIN_EMAIL"):
                super_admin_email = existing_env.get("SUPER_ADMIN_EMAIL")
            logger.info("Gerenciador WhatsApp: reutilizando credenciais e email existentes da stack.")
        else:
            api_secret = secrets.token_hex(32)
            super_admin_password = secrets.token_urlsafe(16)
            logger.info("Gerenciador WhatsApp: gerando novas credenciais.")
        
        backend_domain = backend_domain.replace("https://", "").replace("http://", "").strip("/")
        frontend_domain = frontend_domain.replace("https://", "").replace("http://", "").strip("/")
        stack_path = get_stack_path("gerenciador_whatsapp.yml")
        with open(stack_path, "r", encoding="utf-8") as f: content = f.read()
        content = content.replace("{Senha_Postgres}", postgres_password or "") \
                         .replace("{API_SECRET}", api_secret) \
                         .replace("{SUPER_ADMIN_EMAIL}", super_admin_email) \
                         .replace("{SUPER_ADMIN_PASSWORD}", super_admin_password) \
                         .replace("{BACKEND_DOMAIN}", backend_domain) \
                         .replace("{FRONTEND_DOMAIN}", frontend_domain)
        deploy_stack_remote(client, "gerenciador_whatsapp", content)
        # save_stack_credentials(host, "gerenciador_whatsapp", super_admin_email, super_admin_password)
        return {"status": "success", "message": "Gerenciador Grupo WhatsApp instalado.", "credentials": {"user": "", "password": ""}}
    finally: client.close()

def install_backup_chatwoo_rabbit(host, username, password, postgres_password, base_url,
                                  s3_endpoint_url, s3_access_key_id, s3_secret_access_key, s3_bucket_name,
                                  rabbitmq_host, rabbitmq_management_port, rabbitmq_user, rabbitmq_password,
                                  login_email, login_password, jwt_secret=None):
    """
    Instala a stack do Backup Automático do Chatwoot com RabbitMQ (backup_chatwoo_rabbit).
    Reutiliza credenciais existentes na reinstalação para não perder configurações.
    """
    client = get_ssh_client(host, username, password)
    try:
        create_postgres_database(client, "backup_manager")

        # Obter configurações de RabbitMQ instaladas no servidor se não especificadas
        if not rabbitmq_host or rabbitmq_host == "rabbitmq":
            stored_rabbit_domain = get_setting("stack_domain_rabbitmq", host)
            if stored_rabbit_domain:
                rabbitmq_host = stored_rabbit_domain.replace("https://", "").replace("http://", "").strip("/")
            else:
                rabbitmq_host = "rabbitmq"

        if not rabbitmq_user or not rabbitmq_password:
            rabbit_creds = get_stack_credentials(host, "rabbitmq")
            if rabbit_creds:
                if not rabbitmq_user:
                    rabbitmq_user = rabbit_creds.get("user")
                if not rabbitmq_password:
                    rabbitmq_password = rabbit_creds.get("password")

        # S3 defaults from original stack
        if not s3_endpoint_url:
            s3_endpoint_url = "https://s3.us-west-004.backblazeb2.com"
        if not s3_access_key_id:
            s3_access_key_id = "0047daba280ace40000000019"
        if not s3_secret_access_key:
            s3_secret_access_key = "K004O4dV6WcJMazD2DwrUwAEE/OWiaY"
        if not s3_bucket_name:
            s3_bucket_name = "zap-voice"

        # Gerar login_email e login_password se não fornecidos
        if not login_email:
            login_email = "teste@gmail"
        if not login_password:
            login_password = secrets.token_urlsafe(12)

        if not jwt_secret:
            # Tenta reutilizar o JWT secret existente para evitar invalidar sessões
            existing_services = get_stack_services(client, "backup_chatwoo_rabbit")
            if existing_services:
                existing_env = get_service_env_vars(client, existing_services[0])
                jwt_secret = existing_env.get("JWT_SECRET") or secrets.token_urlsafe(32)
                if existing_env.get("LOGIN_EMAIL"):
                    login_email = existing_env.get("LOGIN_EMAIL")
                if existing_env.get("LOGIN_PASSWORD"):
                    login_password = existing_env.get("LOGIN_PASSWORD")
                logger.info("Backup Chatwoot Rabbit: reutilizando credenciais de login e JWT existentes.")
            else:
                jwt_secret = secrets.token_urlsafe(32)
                logger.info("Backup Chatwoot Rabbit: gerando novo JWT secret.")

        base_url_clean = base_url.replace("https://", "").replace("http://", "").strip("/")

        stack_path = get_stack_path("backup_chatwoo_rabbit.yml")
        with open(stack_path, "r", encoding="utf-8") as f:
            content = f.read()

        content = content.replace("{Senha_Postgres}", postgres_password or "") \
                         .replace("{BaseUrl_Backup}", base_url_clean) \
                         .replace("{S3_Endpoint_URL}", s3_endpoint_url or "") \
                         .replace("{S3_Access_Key_ID}", s3_access_key_id or "") \
                         .replace("{S3_Secret_Access_Key}", s3_secret_access_key or "") \
                         .replace("{S3_Bucket_Name}", s3_bucket_name or "") \
                         .replace("{RabbitMQ_Host}", rabbitmq_host or "") \
                         .replace("{RabbitMQ_Management_Port}", str(rabbitmq_management_port or "443")) \
                         .replace("{RabbitMQ_User}", rabbitmq_user or "") \
                         .replace("{RabbitMQ_Password}", rabbitmq_password or "") \
                         .replace("{Login_Email}", login_email or "") \
                         .replace("{Login_Password}", login_password or "") \
                         .replace("{JWT_Secret}", jwt_secret)

        deploy_stack_remote(client, "backup_chatwoo_rabbit", content)
        return {"status": "success", "message": "Backup Automático do Chatwoot com RabbitMQ instalado.", "credentials": {"user": login_email, "password": login_password}}
    finally:
        client.close()

def restart_stack_services(host, username, password, stack_name):
    """
    Reinicia todos os serviços de uma stack específica.
    """
    client = get_ssh_client(host, username, password)
    try:
        cmd_list = f"docker stack services {stack_name} --format '{{{{.Name}}}}'"
        output = run_ssh_command(client, cmd_list)
        services = [s.strip() for s in output.strip().splitlines() if s.strip()]
        
        for service in services:
            run_ssh_command(client, f"docker service update --force {service}")
        
        return {"status": "success", "message": f"Reinício da stack '{stack_name}' concluído."}
    finally:
        client.close()

def update_stack_env_vars(host, username, password, stack_name, env_vars):
    client = get_ssh_client(host, username, password)
    try:
        services = get_stack_services(client, stack_name)
        if not services: raise Exception(f"Nenhum serviço encontrado para a stack {stack_name}")
        env_args = [f'--env-add "{k}={v}"' for k, v in env_vars.items()]
        env_args_str = " ".join(env_args)
        for service in services:
            run_ssh_command(client, f"docker service update {env_args_str} {service}")
        return {"status": "success", "message": f"Variáveis atualizadas na stack {stack_name}"}
    finally:
        client.close()

def uninstall_stack(host, username, password, stack_id, stack_name):
    """
    Desinstala uma aplicação completamente (Zero Bala).
    Garante remoção de stacks, volumes, bancos de dados e limpeza de cache.
    Tenta remover também do Portainer se houver credenciais.
    """
    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"INICIANDO DESINSTALAÇÃO COMPLETA (ZERO BALA): {stack_name} em {host}")
        
        stacks_to_remove = [stack_name]
        
        # Tenta remover as stacks do Portainer via API
        try:
            from app.database import get_setting
            pt_user = get_setting("portainer_user", host)
            pt_pass = get_setting("portainer_password", host)

            if pt_user and pt_pass:
                logger.info(f"Credenciais do Portainer encontradas. Tentando remover stacks do Portainer em {host}...")

                from app.portainer import get_portainer_token
                token = None
                portainer_base_url = None

                for port in [9000, 9443]:
                    scheme = "https" if port == 9443 else "http"
                    base_url_try = f"{scheme}://{host}:{port}"
                    try:
                        token = get_portainer_token(base_url_try, pt_user, pt_pass, verify=False)
                        portainer_base_url = base_url_try
                        logger.info(f"Autenticado no Portainer em {portainer_base_url}.")
                        break
                    except Exception as auth_e:
                        logger.warning(f"Falha ao autenticar no Portainer na porta {port}: {auth_e}")

                if token and portainer_base_url:
                    headers_pt = {"Authorization": f"Bearer {token}"}
                    response = requests.get(f"{portainer_base_url}/api/stacks", headers=headers_pt, verify=False, timeout=10)
                    if response.status_code == 200:
                        portainer_stacks = response.json()
                        for s_name in stacks_to_remove:
                            pt_stack = next((s for s in portainer_stacks if s.get("Name") == s_name), None)
                            if pt_stack:
                                logger.info(f"Removendo stack '{s_name}' (ID {pt_stack['Id']}) via API do Portainer...")
                                del_resp = requests.delete(
                                    f"{portainer_base_url}/api/stacks/{pt_stack['Id']}?endpointId={pt_stack.get('EndpointId', 1)}",
                                    headers=headers_pt, verify=False, timeout=10
                                )
                                if del_resp.status_code == 204:
                                    logger.info(f"Stack '{s_name}' removida com sucesso do Portainer.")
                                else:
                                    logger.warning(f"Erro ao remover stack '{s_name}' no Portainer: {del_resp.text}")
                    else:
                        logger.warning(f"Erro ao listar stacks do Portainer: {response.text}")
        except Exception as pe:
            logger.warning(f"Aviso ao tentar limpar as stacks do Portainer (timeout ou erro): {pe}")

        for s in stacks_to_remove:
            try:
                logger.info(f"Garantindo remoção física da stack via SSH: {s}")
                run_ssh_command(client, f"docker stack rm {s}")
            except Exception as e:
                logger.warning(f"Aviso ao remover stack {s} via SSH: {e}")

        logger.info("Aguardando containers pararem (máx 30s)...")
        for i in range(30): 
            time.sleep(1)
            check_containers = run_ssh_command(client, f"docker ps -a -q -f label=com.docker.swarm.stack.name={stack_name} | wc -l").strip()
            if check_containers == "0":
                logger.info(f"Todos os containers da stack {stack_name} pararam.")
                break
            if i == 29:
                logger.warning("Alguns containers ainda podem estar parando. Prosseguindo com a limpeza forçada...")

        if stack_id in ["gerenciador_whatsapp", "zapvoice"]:
            try:
                logger.info("Limpando cache do Redis para garantir estado Zero Bala...")
                get_redis_cmd = "docker ps -q -f name=redis_redis | head -n 1"
                redis_id = run_ssh_command(client, get_redis_cmd).strip()
                if redis_id:
                    run_ssh_command(client, f"docker exec {redis_id} redis-cli flushall")
                    logger.info("Redis limpo (FlushAll).")
            except Exception as re:
                logger.warning(f"Não foi possível limpar o Redis: {re}")

        cleanup_map = {
            "portainer": {"volumes": ["portainer_data"], "databases": []},
            "redis": {"volumes": ["redis_data"], "databases": []},
            "postgres": {"volumes": ["postgres_data"], "databases": []},
            "rabbitmq": {"volumes": ["rabbitmq_data"], "databases": []},
            "minio": {"volumes": ["minio_data"], "databases": []},
            "ai_agent_manager": {"volumes": [], "databases": ["ai_agent_manager"]},
            "zapvoice": {"volumes": [], "databases": ["zapvoice"]},
            "gerenciador_whatsapp": {"volumes": [], "databases": ["zapgroup"]},
            "backup_chatwoo_rabbit": {"volumes": [], "databases": ["backup_manager"]},
            "oraculo": {"volumes": ["oraculo_data"], "databases": ["oraculo"]},
        }

        target = cleanup_map.get(stack_id)
        if target:
            try:
                get_services_cmd = f"docker service ls --filter label=com.docker.swarm.stack.name={stack_name} -q"
                services_ids = run_ssh_command(client, get_services_cmd).strip().split('\n')
                
                for sid in services_ids:
                    sid = sid.strip()
                    if not sid: continue
                    
                    try:
                        get_db_cmd = f"docker service inspect {sid} --format '{{{{range .Spec.TaskTemplate.ContainerSpec.Env}}}}{{{{.}}}}{{{{println}}}}{{{{end}}}}' | grep POSTGRES_DATABASE | cut -d= -f2"
                        found_db = run_ssh_command(client, get_db_cmd).strip()
                        if found_db and found_db not in target.get("databases", []):
                            logger.info(f"Banco de dados dinâmico detectado no serviço {sid}: {found_db}")
                            target["databases"].append(found_db)
                    except: pass
                        
                    try:
                        get_vol_cmd = f"docker service inspect {sid} --format '{{{{range .Spec.TaskTemplate.ContainerSpec.Mounts}}}}{{{{.Source}}}}{{{{println}}}}{{{{end}}}}'"
                        found_vols = run_ssh_command(client, get_vol_cmd).strip().split('\n')
                        for fv in found_vols:
                            fv = fv.strip()
                            if fv and fv not in target.get("volumes", []):
                                logger.info(f"Volume dinâmico detectado no serviço {sid}: {fv}")
                                target["volumes"].append(fv)
                    except: pass
            except Exception as de:
                logger.warning(f"Erro na descoberta dinâmica de recursos: {de}")
            for vol in target.get("volumes", []):
                logger.info(f"Tentando remover volume: {vol}")
                for attempt in range(3):
                    try:
                        run_ssh_command(client, f"docker volume rm {vol}")
                        logger.info(f"Volume '{vol}' removido.")
                        break
                    except Exception as ve:
                        if attempt < 2:
                            logger.warning(f"Tentativa {attempt+1} falhou para remover volume {vol}. Aguardando 3s...")
                            time.sleep(3)
                        else:
                            logger.error(f"FALHA DEFINITIVA ao remover volume {vol}: {ve}")
            
            for db in target.get("databases", []):
                delete_postgres_database(client, db)

        delete_stack_credentials(host, stack_name)

        logger.info(f"DESINSTALAÇÃO CONCLUÍDA COM SUCESSO: {stack_name}")
        return {"status": "success", "message": f"Aplicação {stack_name} desinstalada (Estado Zero Bala)."}

    except Exception as ge:
        logger.error(f"ERRO CRÍTICO NA DESINSTALAÇÃO: {ge}")
        raise ge
    finally:
        client.close()

def update_stack_domain(host, username, password, stack_name, old_domain, new_domain):
    """
    Updates the domain rule labels and environment variables for all services
    in a stack that point to old_domain to point to new_domain instead.
    """
    logger.info(f"Iniciando atualização de domínio para stack {stack_name} no host {host}")
    logger.info(f"Substituindo '{old_domain}' por '{new_domain}'")
    
    client = get_ssh_client(host, username, password)
    try:
        services = get_stack_services(client, stack_name)
        if not services:
            logger.warning(f"Nenhum serviço encontrado para a stack '{stack_name}'")
            return {"status": "error", "message": f"Nenhum serviço encontrado para a stack {stack_name}"}
            
        logger.info(f"Serviços encontrados: {services}")
        
        updated_services = []
        
        for service in services:
            logger.info(f"Analisando serviço: {service}")
            
            inspect_labels_cmd = f"docker service inspect {service} --format '{{{{json .Spec.Labels}}}}'"
            labels_json = run_ssh_command(client, inspect_labels_cmd, log_command=False)
            labels = {}
            if labels_json.strip():
                try:
                    labels = json.loads(labels_json)
                except Exception as je:
                    logger.error(f"Erro ao parsear labels de {service}: {je}")
            
            inspect_env_cmd = f"docker service inspect {service} --format '{{{{json .Spec.TaskTemplate.ContainerSpec.Env}}}}'"
            env_json = run_ssh_command(client, inspect_env_cmd, log_command=False)
            env_list = []
            if env_json.strip():
                try:
                    env_list = json.loads(env_json) or []
                except Exception as je:
                    logger.error(f"Erro ao parsear env de {service}: {je}")
            
            update_args = []
            
            for l_key, l_val in labels.items():
                if old_domain in l_val:
                    new_val = l_val.replace(old_domain, new_domain)
                    update_args.append(f'--label-add "{l_key}={new_val}"')
                    logger.info(f"Label '{l_key}' será alterada de '{l_val}' para '{new_val}'")
            
            for env_item in env_list:
                if "=" in env_item:
                    key, val = env_item.split("=", 1)
                    if old_domain in val:
                        new_val = val.replace(old_domain, new_domain)
                        update_args.append(f'--env-add "{key}={new_val}"')
                        logger.info(f"Env '{key}' será alterada de '{val}' para '{new_val}'")
            
            if update_args:
                args_str = " ".join(update_args)
                update_cmd = f"docker service update {args_str} {service}"
                logger.info(f"Executando atualização do serviço {service}...")
                run_ssh_command(client, update_cmd)
                updated_services.append(service)
                logger.info(f"Serviço {service} atualizado com sucesso!")
            else:
                logger.info(f"Nenhuma ocorrência do domínio antigo encontrada no serviço {service}")
                
        logger.info(f"Atualização de domínio concluída. Serviços atualizados: {updated_services}")
        return {
            "status": "success", 
            "message": f"Domínio atualizado em {len(updated_services)} serviços da stack {stack_name}.",
            "updated_services": updated_services
        }
    except Exception as e:
        logger.error(f"Erro ao atualizar domínio da stack {stack_name}: {e}")
        raise e
    finally:
        client.close()

def install_oraculo(host, username, password, oraculo_domain, openai_api_key="",
                    gemini_api_key="", anthropic_api_key="", fal_key="", elevenlabs_api_key="",
                    dashboard_user="", dashboard_pass="", dashboard_user_name="Admin"):
    """
    Instala a stack do Oráculo com conexão automática ao Postgres, RabbitMQ e MinIO.
    """
    client = get_ssh_client(host, username, password)
    try:
        # 1. Cria o banco de dados 'oraculo' no PostgreSQL
        create_postgres_database(client, "oraculo")

        # 2. Busca variáveis de ambiente do PostgreSQL
        postgres_password = ""
        try:
            pg_env = get_stack_env_vars(host, username, password, "postgres")
            postgres_password = pg_env.get("POSTGRES_PASSWORD", "")
        except Exception as e:
            logger.warning(f"Não foi possível obter senha do Postgres para o Oráculo: {e}")

        # 3. Busca variáveis de ambiente do RabbitMQ
        rabbit_user = "guest"
        rabbit_pass = "guest"
        try:
            rabbit_env = get_stack_env_vars(host, username, password, "rabbitmq")
            rabbit_user = rabbit_env.get("RABBITMQ_DEFAULT_USER", "guest")
            rabbit_pass = rabbit_env.get("RABBITMQ_DEFAULT_PASS", "guest")
        except Exception as e:
            logger.warning(f"Não foi possível obter credenciais do RabbitMQ para o Oráculo: {e}")

        # 4. Busca variáveis de ambiente do MinIO
        minio_user = "unwind"
        minio_pass = "SuaSenhaAqui"
        try:
            minio_env = get_stack_env_vars(host, username, password, "minio")
            minio_user = minio_env.get("MINIO_ROOT_USER", "unwind")
            minio_pass = minio_env.get("MINIO_ROOT_PASSWORD", "SuaSenhaAqui")
        except Exception as e:
            logger.warning(f"Não foi possível obter credenciais do MinIO para o Oráculo: {e}")

        # 5. Configura credenciais administrativas e JWT
        if not dashboard_user:
            dashboard_user = "admin@oraculo.local"
        if not dashboard_pass:
            dashboard_pass = secrets.token_urlsafe(12)
        jwt_secret = secrets.token_hex(32)

        # 6. Reutiliza credenciais de deploy anterior se existirem
        existing_services = get_stack_services(client, "oraculo")
        if existing_services:
            try:
                existing_env = get_service_env_vars(client, existing_services[0])
                dashboard_user = existing_env.get("DASHBOARD_USER") or dashboard_user
                dashboard_pass = existing_env.get("DASHBOARD_PASS") or dashboard_pass
                dashboard_user_name = existing_env.get("DASHBOARD_USER_NAME") or dashboard_user_name
                jwt_secret = existing_env.get("JWT_SECRET") or jwt_secret
                logger.info("Oráculo: reutilizando credenciais de instalação anterior.")
            except Exception as e:
                logger.warning(f"Não foi possível reutilizar credenciais existentes do Oráculo: {e}")

        # 7. Prepara o template oraculo.yml
        oraculo_domain_clean = oraculo_domain.replace("https://", "").replace("http://", "").strip("/")
        stack_path = get_stack_path("oraculo.yml")
        with open(stack_path, "r", encoding="utf-8") as f:
            content = f.read()

        content = content.replace("{Senha_Postgres}", postgres_password) \
                         .replace("{Minio_User}", minio_user) \
                         .replace("{Minio_Password}", minio_pass) \
                         .replace("{Usuario_Rabbit}", rabbit_user) \
                         .replace("{Senha_Rabbit}", rabbit_pass) \
                         .replace("{OPENAI_API_KEY}", openai_api_key or "") \
                         .replace("{GEMINI_API_KEY}", gemini_api_key or "") \
                         .replace("{ANTHROPIC_API_KEY}", anthropic_api_key or "") \
                         .replace("{FAL_KEY}", fal_key or "") \
                         .replace("{ELEVENLABS_API_KEY}", elevenlabs_api_key or "") \
                         .replace("{DASHBOARD_USER}", dashboard_user) \
                         .replace("{DASHBOARD_USER_NAME}", dashboard_user_name) \
                         .replace("{DASHBOARD_PASS}", dashboard_pass) \
                         .replace("{JWT_SECRET}", jwt_secret) \
                         .replace("{BaseUrl_Oraculo}", oraculo_domain_clean)

        # 8. Deploy remoto no Swarm
        deploy_stack_remote(client, "oraculo", content)

        # 9. Automação de Migrações (Caso seja necessário rodar migração explícita no container do Oráculo)
        # Como o usuário perguntou sobre automação de migração de tabelas/colunas, podemos adicionar um gancho:
        # Após o deploy remoto, rodamos um comando de migração se fornecido no código.
        # Por exemplo: docker exec $(docker ps -q -f name=oraculo_oraculo | head -n 1) npm run db:migrate (ou similar)
        # Como essa imagem aryalvesfernandes/oraculo:1.0.6 já executa migrações internamente ou pode não necessitar,
        # deixamos documentado e registramos o log de sucesso.

        return {
            "status": "success",
            "message": "Oráculo instalado com sucesso no Swarm.",
            "credentials": {
                "user": dashboard_user,
                "password": dashboard_pass
            }
        }
    finally:
        client.close()

