import logging
import os
import time
import json
import secrets
from app.services.base_ssh import get_ssh_client, run_ssh_command, deploy_stack_remote, get_stack_path
from app.services.database_apps import create_postgres_database, delete_postgres_database
from app.database import get_setting, save_stack_credentials, delete_stack_credentials

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
        if result.get("status") == "success":
            result["credentials"] = {"user": email, "password": "SSL/Let's Encrypt Email"}
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
    stack_content = stack_content.replace("{{PORTAINER_HOST}}", portainer_host)
        
    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"Criando volume portainer_data em {host}...")
        try:
            run_ssh_command(client, "docker volume create portainer_data")
        except Exception as e:
            logger.warning(f"Aviso ao criar volume portainer_data (pode já existir): {e}")

        result = deploy_stack_remote(client, "portainer", stack_content)
        if result.get("status") == "success":
            pt_user = get_setting("portainer_user", host) or "admin"
            pt_pass = get_setting("portainer_password", host) or "admin12345"
            result["credentials"] = {"user": pt_user, "password": pt_pass}
        return result
    finally:
        client.close()

def install_chatwoot(host, username, password, postgres_password, s3_bucket_name=None, s3_access_key_id=None, s3_secret_access_key=None, s3_region=None, s3_endpoint=None, chatwoot_base_url="", overwrite=False):
    """
    Faz o deploy das stacks do Chatwoot via SSH.
    """
    s3_endpoint = s3_endpoint or ""
    chatwoot_base_url = chatwoot_base_url or ""
    s3_endpoint_clean = s3_endpoint.replace("https://", "").replace("http://", "")
    chatwoot_base_url_clean = chatwoot_base_url.replace("https://", "").replace("http://", "")
    
    client = get_ssh_client(host, username, password)
    try:
        from app.database import get_next_install_id
        install_id = get_next_install_id(host, "chatwoot")
        db_name = f"chatwoot_db_{install_id}"
        volume_name = f"chatwoot_vol_{install_id}"
        stack_name_admin = f"chatwoot_admin_{install_id}"
        stack_name_sidekiq = f"chatwoot_sidekiq_{install_id}"
        redis_db_index = int(install_id)
        
        logger.info(f"Gerando recursos dinâmicos para Chatwoot: DB={db_name}, Volume={volume_name}, Stack={stack_name_admin}")
        create_postgres_database(client, db_name)
        
        secret_key_base = secrets.token_hex(64)

        stack_path_admin = get_stack_path("chatwoot_admin.yml")
        with open(stack_path_admin, "r") as f:
            content_admin = f.read()
        
        content_admin = content_admin.replace("{Senha_Postgres}", postgres_password or "")
        content_admin = content_admin.replace("{POSTGRES_DATABASE}", db_name)
        content_admin = content_admin.replace("{VOLUME_NAME}", volume_name)
        content_admin = content_admin.replace("{INSTALLATION_NAME}", f"chatwoot_{install_id}")
        content_admin = content_admin.replace("{Backblaze_Bucket_Name}", s3_bucket_name or "")
        content_admin = content_admin.replace("{Backblaze_Key_ID}", s3_access_key_id or "")
        content_admin = content_admin.replace("{Backblaze_Application_Key}", s3_secret_access_key or "")
        content_admin = content_admin.replace("{Backblaze_Region}", s3_region or "us-east-005")
        content_admin = content_admin.replace("{Backblaze_Endpoint}", s3_endpoint or "")
        content_admin = content_admin.replace("{BaseUrl_Chatwoot}", chatwoot_base_url_clean)
        content_admin = content_admin.replace("{Secret_Key_Base}", secret_key_base)
        content_admin = content_admin.replace("{REDIS_DB}", str(redis_db_index))
        
        deploy_stack_remote(client, stack_name_admin, content_admin)
        
        stack_path_sidekiq = get_stack_path("chatwoot_sidekiq.yml")
        with open(stack_path_sidekiq, "r") as f:
            content_sidekiq = f.read()
            
        content_sidekiq = content_sidekiq.replace("{Senha_Postgres}", postgres_password or "")
        content_sidekiq = content_sidekiq.replace("{POSTGRES_DATABASE}", db_name)
        content_sidekiq = content_sidekiq.replace("{VOLUME_NAME}", volume_name)
        content_sidekiq = content_sidekiq.replace("{INSTALLATION_NAME}", f"chatwoot_{install_id}")
        content_sidekiq = content_sidekiq.replace("{Backblaze_Bucket_Name}", s3_bucket_name or "")
        content_sidekiq = content_sidekiq.replace("{Backblaze_Key_ID}", s3_access_key_id or "")
        content_sidekiq = content_sidekiq.replace("{Backblaze_Application_Key}", s3_secret_access_key or "")
        content_sidekiq = content_sidekiq.replace("{Backblaze_Region}", s3_region or "us-east-005")
        content_sidekiq = content_sidekiq.replace("{Backblaze_Endpoint}", s3_endpoint or "")
        content_sidekiq = content_sidekiq.replace("{BaseUrl_Chatwoot}", chatwoot_base_url_clean)
        content_sidekiq = content_sidekiq.replace("{Secret_Key_Base}", secret_key_base)
        content_sidekiq = content_sidekiq.replace("{REDIS_DB}", str(redis_db_index))
        
        deploy_stack_remote(client, stack_name_sidekiq, content_sidekiq)
        
        logger.info(f"Limpando cache do Redis (DB {redis_db_index}) pós-deploy para garantir Onboarding...")
        try:
            redis_id_cmd = "docker ps -q -f name=redis_redis | head -n 1"
            redis_id = run_ssh_command(client, redis_id_cmd).strip()
            if redis_id:
                run_ssh_command(client, f"docker exec {redis_id} redis-cli -n {redis_db_index} flushdb")
                logger.info(f"Redis DB {redis_db_index} limpo com sucesso pós-deploy.")
        except: pass
        
        logger.info(f"Aguardando container {stack_name_admin}_chatwoot_admin ficar pronto para migrações...")
        container_id = None
        for i in range(12):
            get_container_cmd = f"docker ps -q -f name={stack_name_admin}_chatwoot_admin -f status=running | head -n 1"
            container_id = run_ssh_command(client, get_container_cmd).strip()
            if container_id:
                break
            logger.info(f"Tentativa {i+1}/12: Container ainda não pronto. Aguardando 5s...")
            time.sleep(5)

        if container_id:
            logger.info(f"Container encontrado: {container_id}. Iniciando db:prepare...")
            prepare_cmd = f"docker exec {container_id} bundle exec rails db:prepare"
            try:
                run_ssh_command(client, prepare_cmd, timeout=600)
                logger.info("Migrações (db:prepare) concluídas com sucesso.")
            except Exception as pe:
                logger.error(f"ERRO CRÍTICO ao rodar migrações: {pe}")
        else:
            logger.error(f"FALHA: Container {stack_name_admin}_chatwoot_admin não ficou pronto a tempo para migrações.")

        return {"status": "success", "message": "Chatwoot instalado. Acesse a URL para criar sua conta.", "credentials": {"user": "Aguardando Setup", "password": "Definido no Onboarding"}}
    finally:
        client.close()

def create_chatwoot_admin_terminal(host, username, password, stack_name, admin_email, admin_password, full_name, company_name):
    """
    Cria um usuário administrador no Chatwoot via rails runner.
    """
    client = get_ssh_client(host, username, password)
    try:
        get_container_cmd = "docker ps --filter name=chatwoot_admin --format '{{.Names}}' | head -n 1"
        container_name = run_ssh_command(client, get_container_cmd).strip()
        
        if not container_name:
            container_name = run_ssh_command(client, "docker ps --filter name=chatwoot --format '{{.Names}}' | head -n 1").strip()
            
        if not container_name:
            raise Exception("Container do Chatwoot Admin não encontrado ou não está rodando.")

        logger.info(f"Criando administrador '{admin_email}' para a empresa '{company_name}' via terminal no container {container_name}...")
        
        ruby_script = f"""
        begin
          user = User.find_by(email: '{admin_email}')
          if user
            user.password = '{admin_password}'
            user.password_confirmation = '{admin_password}'
            user.save!(validate: false)
          else
            user = User.new(
              email: '{admin_email}',
              password: '{admin_password}',
              password_confirmation: '{admin_password}',
              name: '{full_name}',
              confirmed_at: Time.now.utc
            )
            user.save!(validate: false)
          end
          
          user.update_columns(type: 'SuperAdmin', confirmed_at: Time.now.utc)
          
          account = Account.first
          unless account
            account = Account.create!(name: '{company_name}')
          end
          
          AccountUser.find_or_create_by!(account: account, user: user) do |au|
            au.role = :administrator
          end
          
          puts 'SUCCESS: Admin created and promoted to SuperAdmin'
        rescue => e
          puts "ERROR: " + e.message
        end
        """
        
        ruby_script_escaped = ruby_script.replace("'", "'\\''")
        create_cmd = f"docker exec {container_name} bundle exec rails runner '{ruby_script_escaped}'"
        
        result = run_ssh_command(client, create_cmd, timeout=120)
        logger.info(f"Resultado da criação de admin: {result}")
        
        if "SUCCESS" in result:
            save_stack_credentials(host, "chatwoot_admin", admin_email, admin_password)
            return {"status": "success", "message": "Administrador criado com sucesso! Agora você pode fazer login."}
        else:
            return {"status": "error", "message": f"Erro ao criar admin: {result}"}
            
    finally:
        client.close()

def install_ai_agent_manager(host, username, password, postgres_password, openai_api_key, domain_backend, domain_frontend, agent_api_key=None, google_client_id="", google_client_secret="", google_redirect_uri="", gunicorn_workers="4"):
    client = get_ssh_client(host, username, password)
    try:
        create_postgres_database(client, "ai_agent_manager")
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
                         .replace("{VITE_API_URL}", f"https://{domain_backend_clean}")
        deploy_stack_remote(client, "agentes", content)
        # save_stack_credentials(host, "agentes", "Agent API Key", agent_api_key)
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
        
        rabbit_env = get_stack_env_vars(host, username, password, "rabbitmq")
        rabbit_user = rabbit_env.get("RABBITMQ_DEFAULT_USER", "guest")
        rabbit_pass = rabbit_env.get("RABBITMQ_DEFAULT_PASS", "guest")
        
        stack_path = get_stack_path("zapvoice.yml")
        with open(stack_path, "r", encoding="utf-8") as f: content = f.read()
        
        content = content.replace("{Senha_Postgres}", postgres_password or "") \
                         .replace("{BaseUrl_ZapVoice}", zap_url_clean) \
                         .replace("{Secret_Key}", secret_key) \
                         .replace("{Usuario_Rabbit}", rabbit_user) \
                         .replace("{Senha_Rabbit}", rabbit_pass) \
                         .replace("{SUPER_ADMIN_EMAIL}", super_admin_email) \
                         .replace("{SUPER_ADMIN_PASSWORD}", super_admin_password)
                         
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
            logger.info("Gerenciador WhatsApp: reutilizando credenciais existentes da stack.")
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
    """
    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"INICIANDO DESINSTALAÇÃO COMPLETA (ZERO BALA): {stack_name} em {host}")
        
        stacks_to_remove = [stack_name]
        if stack_id == "chatwoot":
            stacks_to_remove.append("chatwoot_sidekiq")
        
        for s in stacks_to_remove:
            try:
                logger.info(f"Removendo stack: {s}")
                run_ssh_command(client, f"docker stack rm {s}")
            except Exception as e:
                logger.warning(f"Aviso ao remover stack {s}: {e}")

        logger.info("Aguardando containers pararem (máx 30s)...")
        for i in range(30): 
            time.sleep(1)
            check_containers = run_ssh_command(client, f"docker ps -a -q -f label=com.docker.swarm.stack.name={stack_name} | wc -l").strip()
            if check_containers == "0":
                logger.info(f"Todos os containers da stack {stack_name} pararam.")
                break
            if i == 29:
                logger.warning("Alguns containers ainda podem estar parando. Prosseguindo com a limpeza forçada...")

        if stack_id in ["chatwoot", "gerenciador_whatsapp", "zapvoice"]:
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
            "chatwoot": {"volumes": ["chatwoot_data"], "databases": ["chatwoot"]},
            "ai_agent_manager": {"volumes": [], "databases": ["ai_agent_manager"]},
            "zapvoice": {"volumes": [], "databases": ["zapvoice"]},
            "gerenciador_whatsapp": {"volumes": [], "databases": ["zapgroup"]},
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
        if stack_id == "chatwoot":
            delete_stack_credentials(host, "chatwoot_sidekiq")

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
