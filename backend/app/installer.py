import paramiko
import logging
import os
import tempfile
import requests
import secrets
import string
import json
import time
import random
import re
from typing import Optional
from app.database import get_setting, save_stack_credentials, get_stack_credentials, get_all_stack_credentials

# Configura o logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_stack_path(filename):
    """Retorna o caminho absoluto para um arquivo de stack, compatível com PyInstaller."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Lista de subdiretórios para procurar de forma organizada
    subdirs = ["stacks_gerais", "aplicativos_proprios", ""]
    
    for subdir in subdirs:
        path = os.path.join(base_dir, "stack", "stacks", subdir, filename)
        if os.path.exists(path):
            return path
            
    # Fallback padrão caso não encontre nas subpastas
    return os.path.join(base_dir, "stack", "stacks", filename)

def get_ssh_client(host, username, password, timeout=30):
    """
    Cria e retorna uma conexão SSH usando Paramiko.
    """
    import time
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
    try:
        logger.info(f"[SSH] Iniciando conexão SSH com {host}")
        logger.info(f"[SSH] Parâmetros: User={username}, Timeout={timeout}s")
        logger.info(f"[SSH] look_for_keys=False, allow_agent=False")
        
        print(f"DEBUG: [SSH] Connecting to {host} (timeout={timeout})...")
        start = time.time()
        client.connect(
            hostname=host, 
            username=username, 
            password=password, 
            timeout=timeout,
            look_for_keys=False,
            allow_agent=False,
            banner_timeout=30,
            auth_timeout=30
        )
        print(f"DEBUG: [SSH] Connected successfully!")
        elapsed = time.time() - start
        logger.info(f"[SSH] Conexão estabelecida em {elapsed:.2f}s")
        return client
        
    except Exception as e:
        print(f"DEBUG: [SSH] First attempt FAILED: {str(e)}")
        logger.warning(f"[SSH] Primeira tentativa falhou via Paramiko: {e}")
        
        # Tentativa de fallback com parâmetros relaxados
        try:
            print(f"DEBUG: [SSH] Tentando conexão de fallback com allow_agent=True e look_for_keys=True...")
            logger.info("[SSH] Tentando conexão de fallback...")
            client.connect(
                hostname=host, 
                username=username, 
                password=password, 
                timeout=timeout,
                look_for_keys=True,  # Tenta usar chaves se existirem
                allow_agent=True,    # Tenta usar ssh-agent
                banner_timeout=30,
                auth_timeout=30
            )
            print(f"DEBUG: [SSH] Fallback connected successfully!")
            elapsed = time.time() - start
            logger.info(f"[SSH] Conexão de fallback estabelecida em {elapsed:.2f}s")
            return client
        except Exception as e2:
            print(f"DEBUG: [SSH] Fallback connection FAILED: {str(e2)}")
            logger.warning(f"[SSH] Fallback também falhou: {e2}")
            
            # Tentativa final: Keyboard-Interactive
            try:
                print(f"DEBUG: [SSH] Tentando conexão final via keyboard-interactive...")
                
                def interactive_handler(title, instructions, prompt_list):
                    resp = []
                    for prompt, echo in prompt_list:
                        resp.append(password)
                    return resp

                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                # Manual transport setup
                t = paramiko.Transport((host, 22))
                t.connect()
                t.auth_interactive(username, interactive_handler)
                
                client._transport = t
                print(f"DEBUG: [SSH] Interactive connection successful!")
                logger.info("[SSH] Conexão interativa estabelecida com sucesso.")
                return client

            except Exception as e3:
                print(f"DEBUG: [SSH] Interactive connection FAILED: {str(e3)}")
                elapsed = time.time() - start if 'start' in locals() else 0
                logger.error(f"[SSH] TODAS TENTATIVAS FALHARAM após {elapsed:.2f}s: {str(e3)}")
                raise e3

def verify_ssh_connection(host, username, password):
    """
    Testa se as credenciais SSH são válidas.
    """
    import time
    start_time = time.time()
    logger.info(f"[VERIFY] Iniciando verificação SSH para {username}@{host}")
    
    try:
        logger.info(f"[VERIFY] Chamando get_ssh_client com timeout=30s")
        client = get_ssh_client(host, username, password, timeout=30)
        
        elapsed = time.time() - start_time
        logger.info(f"[VERIFY] Conexão SSH estabelecida com sucesso em {elapsed:.2f}s")
        
        client.close()
        logger.info(f"[VERIFY] Conexão SSH fechada. Verificação completa.")
        return True
        
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"[VERIFY] FALHA na verificação SSH após {elapsed:.2f}s")
        logger.error(f"[VERIFY] Tipo de erro: {type(e).__name__}")
        logger.error(f"[VERIFY] Mensagem de erro: {str(e)}")
        import traceback
        logger.error(f"[VERIFY] Traceback completo:\n{traceback.format_exc()}")
        return False

def run_ssh_command(client, command, timeout=10, log_command=True):
    """
    Executa um comando no servidor remoto via SSH com timeout.
    """
    if log_command:
        logger.info(f"CMD: {command}")
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    
    # Define timeout no canal para leitura
    stdout.channel.settimeout(timeout)
    
    try:
        # Aguarda o comando finalizar e pega o status de saída
        # recv_exit_status pode bloquear, mas o timeout do canal deve ajudar
        exit_status = stdout.channel.recv_exit_status()
        
        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()

        if exit_status != 0:
            if log_command:
                logger.error(f"ERRO CMD: {command}")
            else:
                logger.error("ERRO CMD: [OCULTADO POR SEGURANÇA]")
            logger.error(f"STDERR: {error}")
            raise Exception(f"Comando falhou: {error}")
        
        logger.info(f"OUTPUT: {output[:100]}..." if len(output) > 100 else f"OUTPUT: {output}")
        return output

    except Exception as e:
        logger.error(f"Timeout ou erro ao executar '{command}': {e}")
        # Se for timeout, stdout.channel lança timeout
        raise Exception(f"Erro/Timeout ao executar comando: {str(e)}")

def get_active_stacks(host, username, password):
    """
    Retorna uma lista com os nomes das stacks ativas no servidor remoto.
    """
    client = get_ssh_client(host, username, password)
    try:
        # Tenta via Portainer primeiro (se configurado)
        try:
            p_stacks = list_stacks_portainer_ssh(client)
            if p_stacks:
                print(f"DEBUG: Stacks ativas via Portainer SSH: {p_stacks}", flush=True)
                return p_stacks
        except Exception as pe:
            print(f"DEBUG: Falha ao listar via Portainer: {pe}")

        try:
            output = run_ssh_command(client, "docker stack ls --format '{{.Name}}'")
            stacks = [s.strip() for s in output.strip().splitlines() if s.strip()]
            print(f"DEBUG: Stacks ativas no servidor {host} (SSH direto): {stacks}", flush=True)
            return stacks
        except Exception as e:
            print(f"ERRO ao listar stacks: {e}", flush=True)
            return []
    finally:
        client.close()

def check_stack_exists(host, username, password, stack_name):
    """
    Verifica se a stack Docker já existe no servidor remoto.
    Retorna True se existir, False caso contrário.
    """
    stacks = get_active_stacks(host, username, password)
    exists = stack_name in stacks
    print(f"CHECK STACK '{stack_name}': {exists}", flush=True)
    return exists

def check_docker_installed(host, username, password):
    """
    Verifica se o Docker já está instalado no servidor remoto.
    Retorna a string de versão se instalado, None caso contrário.
    """
    client = get_ssh_client(host, username, password)
    try:
        try:
            version = run_ssh_command(client, "docker --version")
            return version
        except Exception:
            return None
    finally:
        client.close()

def install_docker(host, username, password, status_callback=None):
    """
    Instala o Docker em um sistema remoto baseado em Debian via SSH.
    """
    commands_map = [
        ("Atualizando repositórios (apt-get update)...", "sudo DEBIAN_FRONTEND=noninteractive apt-get update"),
        ("Instalando dependências...", "sudo DEBIAN_FRONTEND=noninteractive apt install -y sudo gnupg2 wget ca-certificates apt-transport-https curl gnupg nano htop"),
        ("Configurando chaveiros...", "sudo install -m 0755 -d /etc/apt/keyrings"),
        ("Baixando chave GPG do Docker...", "curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true"),
        ("Ajustando permissões da chave...", "sudo chmod a+r /etc/apt/keyrings/docker.gpg"),
        ("Adicionando repositório Docker...", 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null'),
        ("Atualizando repositórios com Docker...", "sudo DEBIAN_FRONTEND=noninteractive apt-get update"),
        ("Instalando Docker Engine (pode demorar)...", "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"),
        ("Habilitando serviço Docker...", "sudo systemctl enable docker.service"),
        ("Habilitando serviço Containerd...", "sudo systemctl enable containerd.service")
    ]

    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"Iniciando instalação do Docker em {host}...")
        for msg, cmd in commands_map:
            logger.info(f"[Step] {msg}")
            if status_callback:
                status_callback(msg)
            run_ssh_command(client, cmd, timeout=300)
        logger.info("Instalação do Docker concluída com sucesso.")
        return {"status": "success", "message": "Docker instalado com sucesso"}
    finally:
        client.close()

def upgrade_docker_engine(host, username, password):
    """
    Atualiza o Docker Engine no servidor remoto via SSH.
    """
    commands = [
        "sudo apt-get update",
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install --only-upgrade -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
    ]

    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"Iniciando atualização do Docker em {host}...")
        for cmd in commands:
            run_ssh_command(client, cmd)
        logger.info("Atualização do Docker concluída com sucesso.")
        return {"status": "success", "message": "Docker atualizado com sucesso"}
    finally:
        client.close()

def check_swarm_active(host, username, password):
    """
    Verifica se o Docker Swarm já está ativo no servidor remoto.
    """
    client = get_ssh_client(host, username, password)
    try:
        try:
            output = run_ssh_command(client, "docker info --format '{{.Swarm.LocalNodeState}}'")
            return output.strip() == "active"
        except Exception:
            return False
    finally:
        client.close()

def init_swarm(host, username, password, advertise_addr):
    """
    Inicializa o Docker Swarm em um servidor remoto.
    """
    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"Inicializando Swarm em {host} ({advertise_addr})...")
        try:
            run_ssh_command(client, f"docker swarm init --advertise-addr {advertise_addr}")
            return {"status": "success", "message": "Swarm inicializado"}
        except Exception as e:
            if "This node is already part of a swarm" in str(e):
                logger.info("Nó já faz parte de um swarm.")
                return {"status": "success", "message": "Nó já faz parte de um swarm"}
            raise e
    finally:
        client.close()

def check_network_exists(host, username, password, network_name):
    """
    Verifica se a rede Docker já existe no servidor remoto.
    """
    client = get_ssh_client(host, username, password)
    try:
        try:
            output = run_ssh_command(client, f"docker network ls --filter name=^{network_name}$ --format '{{{{.Name}}}}'")
            return output.strip() == network_name
        except Exception:
            return False
    finally:
        client.close()

def create_network(host, username, password, network_name):
    """
    Cria uma rede overlay Docker em um servidor remoto.
    """
    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"Criando rede {network_name} em {host}...")
        try:
            run_ssh_command(client, f"docker network create --driver overlay --attachable {network_name}")
            return {"status": "success", "message": f"Rede {network_name} criada"}
        except Exception as e:
             if "network with name" in str(e) and "already exists" in str(e):
                 logger.info(f"Rede {network_name} já existe.")
                 return {"status": "success", "message": f"Rede {network_name} já existe"}
             raise e
    finally:
        client.close()

def deploy_stack_remote(client, stack_name, stack_content):
    """
    Faz o deploy de uma stack Docker em um servidor remoto.
    """
    logger.info(f"Fazendo deploy da stack {stack_name}...")
    sftp = client.open_sftp()
    remote_path = f"/root/{stack_name}.yml"
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yml', delete=False, encoding='utf-8') as temp_file:
        temp_file.write(stack_content)
        temp_file_path = temp_file.name
    
    try:
        sftp.put(temp_file_path, remote_path)
        run_ssh_command(client, f"docker stack deploy -c {remote_path} {stack_name}")
        return {"status": "success", "message": f"Stack {stack_name} deployada"}
    finally:
        sftp.close()
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

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

def update_docker_version_config(host, username, password):
    """
    Aplica a correção de versão da API do Docker.
    """
    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"Aplicando correção de versão da API do Docker em {host}...")
        run_ssh_command(client, "sudo mkdir -p /etc/systemd/system/docker.service.d")
        override_content = "[Service]\nEnvironment=DOCKER_MIN_API_VERSION=1.24"
        cmd_create_file = f'echo -e "{override_content}" | sudo tee /etc/systemd/system/docker.service.d/override.conf'
        run_ssh_command(client, cmd_create_file)
        run_ssh_command(client, "sudo systemctl daemon-reexec")
        run_ssh_command(client, "sudo systemctl daemon-reload")
        run_ssh_command(client, "sudo systemctl restart docker")
        return {"status": "success", "message": "Configuração do Docker atualizada com sucesso"}
    finally:
        client.close()

def install_redis(host, username, password):
    """
    Faz o deploy da stack do Redis em um servidor remoto via SSH.
    """
    stack_path = get_stack_path("redis.yml")
    if not os.path.exists(stack_path):
        raise FileNotFoundError(f"Arquivo de stack não encontrado: {stack_path}")

    with open(stack_path, "r") as f:
        stack_content = f.read()
        
    client = get_ssh_client(host, username, password)
    try:
        result = deploy_stack_remote(client, "redis", stack_content)
        if result.get("status") == "success":
            result["credentials"] = {"user": "Default", "password": "Sem Senha (Interno)"}
        return result
    finally:
        client.close()

def install_postgres(host, username, password, postgres_password):
    """
    Faz o deploy da stack do Postgres em um servidor remoto via SSH.
    """
    stack_path = get_stack_path("postgres.yml")
    if not os.path.exists(stack_path):
        raise FileNotFoundError(f"Arquivo de stack não encontrado: {stack_path}")

    with open(stack_path, "r") as f:
        stack_content = f.read()
    stack_content = stack_content.replace("${POSTGRES_PASSWORD}", postgres_password)
        
    client = get_ssh_client(host, username, password)
    try:
        result = deploy_stack_remote(client, "postgres", stack_content)
        save_stack_credentials(host, "postgres", "postgres", postgres_password)
        return result
    finally:
        client.close()

def install_rabbitmq(host, username, password, rabbit_user=None, rabbit_password=None, rabbit_base_url=""):
    """
    Faz o deploy da stack do RabbitMQ em um servidor remoto via SSH.
    """
    stack_path = get_stack_path("rabbit.yml")
    if not os.path.exists(stack_path):
        raise FileNotFoundError(f"Arquivo de stack não encontrado: {stack_path}")

    if not rabbit_user:
        rabbit_user = ''.join(secrets.choice(string.ascii_lowercase) for _ in range(10))
    if not rabbit_password:
        rabbit_password = secrets.token_hex(16)

    with open(stack_path, "r") as f:
        stack_content = f.read()
    
    rabbit_base_url_clean = rabbit_base_url.replace("https://", "").replace("http://", "")
    stack_content = stack_content.replace("{Usuario_Rabbit}", rabbit_user)
    stack_content = stack_content.replace("{Senha_Rabbit}", rabbit_password)
    stack_content = stack_content.replace("{BaseUrl_Rabbit}", rabbit_base_url_clean)
        
    client = get_ssh_client(host, username, password)
    try:
        result = deploy_stack_remote(client, "rabbitmq", stack_content)
        save_stack_credentials(host, "rabbitmq", rabbit_user, rabbit_password)
        return {
            "status": "success", 
            "message": "RabbitMQ instalado com sucesso",
            "credentials": {"user": rabbit_user, "password": rabbit_password}
        }
    finally:
        client.close()

def create_postgres_database(client, db_name, overwrite=False):
    """
    Cria um banco de dados no container do Postgres, se não existir.
    Se overwrite for True, remove o banco antes de criar.
    """
    logger.info(f"Verificando/Criando banco de dados '{db_name}' no Postgres...")
    get_container_cmd = "docker ps -q -f name=postgres_postgres | head -n 1"
    container_id = run_ssh_command(client, get_container_cmd).strip()
    
    if not container_id:
        logger.warning("Container do Postgres não encontrado.")
        return

    if overwrite:
        logger.info(f"Removendo banco de dados '{db_name}' para reinstalação limpa...")
        # Força o drop do banco mesmo com conexões ativas
        drop_db_cmd = f'docker exec {container_id} psql -U postgres -c "DROP DATABASE IF EXISTS {db_name} WITH (FORCE);"'
        try:
            run_ssh_command(client, drop_db_cmd)
        except Exception as e:
            logger.warning(f"Aviso ao remover banco {db_name}: {e}")

    check_db_cmd = f'docker exec {container_id} psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname=\'{db_name}\'"'
    try:
        exists = run_ssh_command(client, check_db_cmd)
        if exists.strip() == "1" and not overwrite:
            return
    except Exception:
        pass

    create_db_cmd = f'docker exec {container_id} psql -U postgres -c "CREATE DATABASE {db_name};"'
    try:
        run_ssh_command(client, create_db_cmd)
    except Exception as e:
        if "already exists" not in str(e):
            raise e

    # SINCRONIZAÇÃO DE SENHA: Garante que a senha interna do Postgres 
    # seja a mesma que está nas variáveis de ambiente (evita erro de volumes antigos)
    pg_pass = get_setting("postgres_password", 'global') or get_setting("postgres_password", client.get_transport().getpeername()[0])
    if pg_pass:
        sync_pass_cmd = f'docker exec {container_id} psql -U postgres -c "ALTER USER postgres WITH PASSWORD \'{pg_pass}\';"'
        try:
            run_ssh_command(client, sync_pass_cmd)
            logger.info("Senha do Postgres sincronizada com sucesso.")
        except Exception as se:
            logger.warning(f"Não foi possível sincronizar senha do Postgres: {se}")

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
        # Nomes dinâmicos sequenciais (01, 02...) por servidor
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
        
        # LIMPEZA AGRESSIVA PÓS-DEPLOY (Garante que o boot inicial não suje o estado no Redis)
        logger.info(f"Limpando cache do Redis (DB {redis_db_index}) pós-deploy para garantir Onboarding...")
        try:
            redis_id_cmd = "docker ps -q -f name=redis_redis | head -n 1"
            redis_id = run_ssh_command(client, redis_id_cmd).strip()
            if redis_id:
                # Limpa apenas o banco de dados específico da instalação
                run_ssh_command(client, f"docker exec {redis_id} redis-cli -n {redis_db_index} flushdb")
                logger.info(f"Redis DB {redis_db_index} limpo com sucesso pós-deploy.")
        except: pass
        
        # AGUARDA CONTAINER ESTAR PRONTO E RODA MIGRAÇÕES
        logger.info(f"Aguardando container {stack_name_admin}_chatwoot_admin ficar pronto para migrações...")
        container_id = None
        for i in range(12): # Tenta por 60 segundos (12 * 5s)
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
                run_ssh_command(client, prepare_cmd, timeout=600) # Timeout longo para migrações pesadas
                logger.info("Migrações (db:prepare) concluídas com sucesso.")
                
                # Diagnóstico opcional
                try:
                    check_user_cmd = f"docker exec {container_id} bundle exec rails runner 'puts \"User Count: #{User.count}\"'"
                    user_count_log = run_ssh_command(client, check_user_cmd, timeout=60).strip()
                    logger.info(f"LOG DE USUÁRIOS PÓS-MIGRAÇÃO: {user_count_log}")
                except: pass
            except Exception as pe:
                logger.error(f"ERRO CRÍTICO ao rodar migrações: {pe}")
        else:
            logger.error(f"FALHA: Container {stack_name_admin}_chatwoot_admin não ficou pronto a tempo para migrações.")

        # Não salvamos credenciais padrão pois o Chatwoot exige criação manual no primeiro acesso (onboarding)
        return {"status": "success", "message": "Chatwoot instalado. Acesse a URL para criar sua conta.", "credentials": {"user": "Aguardando Setup", "password": "Definido no Onboarding"}}
    finally:
        client.close()

def create_chatwoot_admin_terminal(host, username, password, stack_name, admin_email, admin_password, full_name, company_name):
    """
    Cria um usuário administrador no Chatwoot via rails runner.
    """
    client = get_ssh_client(host, username, password)
    try:
        # Busca o container (prefixo da stack + serviço)
        get_container_cmd = f"docker ps -q -f name={stack_name}_chatwoot_admin -f status=running | head -n 1"
        container_id = run_ssh_command(client, get_container_cmd).strip()
        
        if not container_id:
            raise Exception("Container do Chatwoot Admin não encontrado ou não está rodando.")

        logger.info(f"Criando administrador '{admin_email}' para a empresa '{company_name}' via terminal no container {container_id}...")
        
        # Comando Ruby para criar o usuário e a conta inicial
        # Nota: O primeiro usuário criado no Chatwoot assume o papel de Super Admin e dono da primeira conta.
        ruby_script = f"""
        begin
          user = User.find_by(email: '{admin_email}')
          unless user
            user = User.create!(email: '{admin_email}', password: '{admin_password}', name: '{full_name}', confirmed_at: Time.now.utc)
          end
          user.update_column(:type, 'SuperAdmin')
          
          account = Account.first
          unless account
            account = Account.create!(name: '{company_name}')
          end
          
          AccountUser.find_or_create_by!(account: account, user: user) do |au|
            au.role = :administrator
          end
          
          puts 'SUCCESS: Admin created and promoted to SuperAdmin'
        rescue => e
          puts "ERROR: #{{e.message}}"
        end
        """
        
        # Escapa as aspas simples para o comando shell
        ruby_script_escaped = ruby_script.replace("'", "'\\''")
        create_cmd = f"docker exec {container_id} bundle exec rails runner '{ruby_script_escaped}'"
        
        result = run_ssh_command(client, create_cmd, timeout=120)
        logger.info(f"Resultado da criação de admin: {result}")
        
        if "SUCCESS" in result:
            return {"status": "success", "message": "Administrador criado com sucesso! Agora você pode fazer login."}
        else:
            return {"status": "error", "message": f"Erro ao criar admin: {result}"}
            
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

def get_full_system_status(host, username, password):
    """
    Realiza todas as verificações de estado do sistema em UMA ÚNICA conexão SSH.
    """
    client = get_ssh_client(host, username, password, timeout=30)
    status = {"docker": None, "swarm": False, "network": False, "ctop": False, "active_stacks": []}
    
    try:
        try:
            output = run_ssh_command(client, "docker --version", timeout=5)
            status["docker"] = output.strip()
        except: return status

        try:
            output = run_ssh_command(client, "docker info --format '{{.Swarm.LocalNodeState}}'", timeout=5)
            status["swarm"] = (output.strip() == "active")
        except: pass

        try:
            cmd = "export PATH=$PATH:/usr/local/bin; ctop --help"
            stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
            full_req = (stdout.read().decode('utf-8') + stderr.read().decode('utf-8')).lower()
            status["ctop"] = not ("command not found" in full_req or ("not found" in full_req and "sh:" in full_req))
        except: pass

        if status["swarm"]:
            try:
                output = run_ssh_command(client, "docker network ls --filter name=^network_swarm_public$ --format '{{.Name}}'", timeout=5)
                status["network"] = (output.strip() == "network_swarm_public")
                
                output_stacks = run_ssh_command(client, "docker stack ls --format '{{.Name}}'", timeout=5)
                status["active_stacks"] = [s.strip() for s in output_stacks.strip().splitlines() if s.strip()]

                check_services_cmd = "docker service ls -q"
                service_ids = run_ssh_command(client, check_services_cmd, timeout=5).strip().split('\n')
                
                lines = []
                if service_ids and service_ids[0]:
                    ids_str = " ".join(service_ids[:50])
                    service_cmd = f"docker service inspect {ids_str} --format '{{{{.Spec.Name}}}}|{{{{json .Spec.Labels}}}}'"
                    output_services = run_ssh_command(client, service_cmd, timeout=15)
                    lines = [s.strip() for s in output_services.strip().splitlines() if s.strip()]
                
                stack_urls = {}
                host_regex = re.compile(r"Host\([`'\"](.*?)[`'\"]\)")
                for line in lines:
                    parts = line.split("|", 1)
                    if len(parts) < 2: continue
                    labels = json.loads(parts[1])
                    current_stack = labels.get("com.docker.stack.namespace")
                    if not current_stack: continue
                    for l_key, l_val in labels.items():
                        if "traefik" in l_key and "rule" in l_key:
                            match_host = host_regex.search(l_val)
                            if match_host:
                                url = match_host.group(1)
                                if current_stack not in stack_urls: stack_urls[current_stack] = []
                                if url not in stack_urls[current_stack]: stack_urls[current_stack].append(url)
                status["stack_urls"] = stack_urls
                
                # Fallback para Portainer URL se não encontrado via Traefik labels
                if "portainer" not in stack_urls or not stack_urls["portainer"]:
                    pt_host = get_setting("portainer_host", host) or get_setting("portainer_host", "global")
                    if pt_host:
                        if "portainer" not in stack_urls: stack_urls["portainer"] = []
                        if pt_host not in stack_urls["portainer"]:
                            stack_urls["portainer"].append(pt_host)

                status["stack_credentials"] = get_all_stack_credentials(host)
            except Exception as e:
                logger.error(f"Erro ao processar detalhes das stacks: {e}")
                
    except Exception as e:
        logger.error(f"Erro ao buscar status do sistema: {e}")
    finally: client.close()
    return status

def check_ctop_installed(host, username, password):
    client = get_ssh_client(host, username, password)
    try:
        cmd = "export PATH=$PATH:/usr/local/bin; ctop --help"
        stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
        full_output = (stdout.read().decode('utf-8') + stderr.read().decode('utf-8')).lower()
        return not ("command not found" in full_output or "not found" in full_output)
    except: return False
    finally: client.close()

def install_ctop(host, username, password):
    commands = [
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg lsb-release",
        "curl -fsSL https://azlux.fr/repo.gpg.key | sudo gpg --dearmor --batch --yes -o /usr/share/keyrings/azlux-archive-keyring.gpg",
        'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/azlux-archive-keyring.gpg] http://packages.azlux.fr/debian $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/azlux.list >/dev/null',
        "sudo apt-get update",
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ctop"
    ]
    client = get_ssh_client(host, username, password)
    try:
        for cmd in commands: run_ssh_command(client, cmd, timeout=60)
        return {"status": "success", "message": "Ctop instalado com sucesso"}
    finally: client.close()

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
        save_stack_credentials(host, "agentes", "Agent API Key", agent_api_key)
        return {"status": "success", "message": "Gerente de Agente de IA instalado.", "credentials": {"user": "Agent API Key", "password": agent_api_key}}
    finally: client.close()

def install_zapvoice(host, username, password, postgres_password, zapvoice_base_url, super_admin_email, secret_key=None):
    client = get_ssh_client(host, username, password)
    try:
        create_postgres_database(client, "zapvoice")
        if not secret_key: secret_key = secrets.token_urlsafe(48)
        super_admin_password = secrets.token_urlsafe(16)
        zap_url_clean = zapvoice_base_url.replace("https://", "").replace("http://", "").strip("/")
        
        # Busca credenciais do RabbitMQ
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
        save_stack_credentials(host, "zapvoice", super_admin_email, super_admin_password)
        return {"status": "success", "message": "ZapVoice instalado.", "credentials": {"user": super_admin_email, "password": super_admin_password}}
    finally: client.close()

def install_gerenciador_whatsapp(host, username, password, postgres_password, super_admin_email, backend_domain, frontend_domain):
    client = get_ssh_client(host, username, password)
    try:
        create_postgres_database(client, "zapgroup")
        api_secret = secrets.token_hex(32)
        super_admin_password = secrets.token_urlsafe(16)
        backend_domain = backend_domain.replace("https://", "").replace("http://", "").strip("/")
        frontend_domain = frontend_domain.replace("https://", "").replace("http://", "").strip("/")
        stack_path = get_stack_path("gerenciador_whatsapp.yml")
        with open(stack_path, "r", encoding="utf-8") as f: content = f.read()
        content = content.replace("{Senha_Postgres}", postgres_password or "").replace("{API_SECRET}", api_secret).replace("{SUPER_ADMIN_EMAIL}", super_admin_email).replace("{SUPER_ADMIN_PASSWORD}", super_admin_password).replace("{BACKEND_DOMAIN}", backend_domain).replace("{FRONTEND_DOMAIN}", frontend_domain)
        deploy_stack_remote(client, "gerenciador_whatsapp", content)
        save_stack_credentials(host, "gerenciador_whatsapp", super_admin_email, super_admin_password)
        return {"status": "success", "message": "Gerenciador Grupo WhatsApp instalado.", "credentials": {"user": super_admin_email, "password": super_admin_password}}
    finally: client.close()

def change_ssh_password(host, username, old_password, new_password):
    client = get_ssh_client(host, username, old_password)
    try:
        cmd = f'echo "{username}:{new_password}" | sudo chpasswd'
        if username == 'root': cmd = f'echo "{username}:{new_password}" | chpasswd'
        run_ssh_command(client, cmd, timeout=20, log_command=False)
        return {"status": "success", "message": "Senha do servidor alterada."}
    finally: client.close()

# =================================================================================================
# Portainer SSH Helpers
# =================================================================================================

def _run_portainer_curl(client, method, endpoint, token=None, data=None):
    url = f"http://127.0.0.1:9000/api{endpoint}"
    headers = ["-H 'Content-Type: application/json'"]
    if token: headers.append(f"-H 'Authorization: Bearer {token}'")
    header_str = " ".join(headers)
    remote_base = f"/tmp/portainer_{int(time.time())}_{random.randint(1000,9999)}"
    remote_json_path = f"{remote_base}.json"
    remote_out_path = f"{remote_base}.out"
    cleanup_files = [remote_out_path]
    data_arg = ""
    if data:
        sftp = client.open_sftp()
        with sftp.file(remote_json_path, 'w') as f: f.write(json.dumps(data))
        sftp.close()
        data_arg = f"-d @{remote_json_path}"
        cleanup_files.append(remote_json_path)
    cmd = f"curl --max-time 30 -s -S -X {method} {header_str} {data_arg} '{url}' -o {remote_out_path}"
    stdin, stdout, stderr = client.exec_command(cmd)
    exit_status = stdout.channel.recv_exit_status()
    if exit_status != 0:
        err = stderr.read().decode('utf-8')
        run_ssh_command(client, f"rm {' '.join(cleanup_files)}", timeout=5)
        raise Exception(f"CURL failed: {err}")
    stdin_cat, stdout_cat, stderr_cat = client.exec_command(f"cat {remote_out_path}")
    out_content = stdout_cat.read().decode('utf-8').strip()
    run_ssh_command(client, f"rm {' '.join(cleanup_files)}", timeout=5)
    if not out_content: return {}
    try: return json.loads(out_content)
    except: raise Exception(f"Invalid JSON from Portainer: {out_content[:100]}...")

def get_portainer_token_ssh(client):
    host = client.get_transport().getpeername()[0]
    user = get_setting("portainer_user", host)
    password = get_setting("portainer_password", host)
    if not user or not password: return None
    try:
        resp = _run_portainer_curl(client, "POST", "/auth", data={"Username": user, "Password": password})
        return resp.get("jwt")
    except: return None

def list_stacks_portainer_ssh(client):
    token = get_portainer_token_ssh(client)
    if not token: return []
    try:
        stacks = _run_portainer_curl(client, "GET", "/stacks", token=token)
        return [s.get("Name") for s in stacks if s.get("Name")]
    except: return []

def deploy_stack_portainer_ssh(client, stack_name, stack_content):
    token = get_portainer_token_ssh(client)
    if not token: return False
    try:
        endpoints = _run_portainer_curl(client, "GET", "/endpoints", token=token)
        endpoint_id = next((ep.get("Id") for ep in endpoints if ep.get("Status") == 1), None)
        if not endpoint_id: return False
        stacks = _run_portainer_curl(client, "GET", "/stacks", token=token)
        existing_stack = next((s for s in stacks if s.get("Name") == stack_name), None)
        if existing_stack:
            stack_id = existing_stack["Id"]
            update_payload = {"StackFileContent": stack_content, "Prune": False, "PullImage": True}
            _run_portainer_curl(client, "PUT", f"/stacks/{stack_id}?endpointId={endpoint_id}", token=token, data=update_payload)
            return True
        else:
            info = _run_portainer_curl(client, "GET", f"/endpoints/{endpoint_id}/docker/info", token=token)
            swarm_id = info.get("Swarm", {}).get("Cluster", {}).get("ID")
            payload = {"Name": stack_name, "StackFileContent": stack_content, "SwarmID": swarm_id, "Env": []}
            _run_portainer_curl(client, "POST", f"/stacks?type=1&method=string&endpointId={endpoint_id}", token=token, data=payload)
            return True
    except: return False

def delete_postgres_database(client, db_name):
    """
    Remove um banco de dados no container do Postgres de forma agressiva.
    """
    logger.info(f"Removendo banco de dados '{db_name}' no Postgres...")
    # Busca o container do postgres de forma mais robusta
    get_container_cmd = "docker ps -q -f name=postgres_postgres | head -n 1"
    container_id = run_ssh_command(client, get_container_cmd).strip()
    
    if not container_id:
        # Tenta buscar por label se não achar por nome exato
        get_container_cmd = "docker ps -q -f label=com.docker.swarm.service.name=postgres_postgres | head -n 1"
        container_id = run_ssh_command(client, get_container_cmd).strip()

    if not container_id:
        logger.warning("Container do Postgres não encontrado. O banco de dados pode persistir se o volume do Postgres não for removido.")
        return

    # Validação inicial
    list_dbs_cmd = f'docker exec {container_id} psql -U postgres -lqt | cut -d \| -f 1'
    dbs_before = run_ssh_command(client, list_dbs_cmd)
    logger.info(f"Bancos de dados existentes antes do DROP: {dbs_before.strip().split()}")

    # Força o drop do banco mesmo com conexões ativas
    drop_db_cmd = f'docker exec {container_id} psql -U postgres -c "REVOKE CONNECT ON DATABASE {db_name} FROM public;" && ' \
                  f'docker exec {container_id} psql -U postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = \'{db_name}\' AND pid <> pg_backend_pid();" && ' \
                  f'docker exec {container_id} psql -U postgres -c "DROP DATABASE IF EXISTS {db_name};"'
    
    try:
        run_ssh_command(client, drop_db_cmd)
        logger.info(f"Comando de remoção do banco '{db_name}' executado.")
        
        # Validação
        check_cmd = f'docker exec {container_id} psql -U postgres -lqt | cut -d \| -f 1 | grep -w {db_name} | wc -l'
        exists = run_ssh_command(client, check_cmd).strip()
        if exists == "0":
            logger.info(f"BANCO DE DADOS '{db_name}' REMOVIDO COM SUCESSO.")
        else:
            logger.error(f"FALHA AO REMOVER BANCO '{db_name}'. Ele ainda aparece na lista.")
    except Exception as e:
        logger.error(f"Erro ao processar remoção do banco {db_name}: {e}")

def uninstall_stack(host, username, password, stack_id, stack_name):
    """
    Desinstala uma aplicação completamente (Zero Bala).
    Garante remoção de stacks, volumes, bancos de dados e limpeza de cache.
    """
    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"INICIANDO DESINSTALAÇÃO COMPLETA (ZERO BALA): {stack_name} em {host}")
        
        # 1. Identifica Stacks Relacionadas
        stacks_to_remove = [stack_name]
        if stack_id == "chatwoot":
            stacks_to_remove.append("chatwoot_sidekiq")
        
        # 2. Remove as Stacks
        for s in stacks_to_remove:
            try:
                logger.info(f"Removendo stack: {s}")
                run_ssh_command(client, f"docker stack rm {s}")
            except Exception as e:
                logger.warning(f"Aviso ao remover stack {s}: {e}")

        # 3. Aguarda a liberação dos recursos (Aumentado para 30 segundos)
        logger.info("Aguardando containers pararem (máx 30s)...")
        for i in range(30): 
            time.sleep(1)
            check_containers = run_ssh_command(client, f"docker ps -a -q -f label=com.docker.swarm.stack.name={stack_name} | wc -l").strip()
            if check_containers == "0":
                logger.info(f"Todos os containers da stack {stack_name} pararam.")
                break
            if i == 29:
                logger.warning("Alguns containers ainda podem estar parando. Prosseguindo com a limpeza forçada...")

        # 4. Limpeza de Redis (Especialmente para Chatwoot e Apps que usam cache)
        # Limpamos o Redis global se a stack removida for uma que o utilize intensamente
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

        # 5. Mapeamento de Volumes e Bancos de Dados
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
            # Descoberta Dinâmica de Recursos (Melhoria Zero Bala)
            try:
                # Busca todos os serviços da stack para inspecionar volumes e envs
                get_services_cmd = f"docker service ls --filter label=com.docker.swarm.stack.name={stack_name} -q"
                services_ids = run_ssh_command(client, get_services_cmd).strip().split('\n')
                
                for sid in services_ids:
                    sid = sid.strip()
                    if not sid: continue
                    
                    # Tenta descobrir o banco de dados pelas variáveis de ambiente
                    try:
                        get_db_cmd = f"docker service inspect {sid} --format '{{{{range .Spec.TaskTemplate.ContainerSpec.Env}}}}{{{{.}}}}{{{{println}}}}{{{{end}}}}' | grep POSTGRES_DATABASE | cut -d= -f2"
                        found_db = run_ssh_command(client, get_db_cmd).strip()
                        if found_db and found_db not in target.get("databases", []):
                            logger.info(f"Banco de dados dinâmico detectado no serviço {sid}: {found_db}")
                            target["databases"].append(found_db)
                    except: pass
                        
                    # Tenta descobrir os volumes reais mapeados
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
            
            # 5.2 Remove Bancos de Dados
            for db in target.get("databases", []):
                delete_postgres_database(client, db)

        # 6. Remove credenciais do banco local
        from app.database import delete_stack_credentials
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
        # 1. Obter todos os serviços pertencentes à stack
        services = get_stack_services(client, stack_name)
        if not services:
            logger.warning(f"Nenhum serviço encontrado para a stack '{stack_name}'")
            return {"status": "error", "message": f"Nenhum serviço encontrado para a stack {stack_name}"}
            
        logger.info(f"Serviços encontrados: {services}")
        
        updated_services = []
        
        for service in services:
            logger.info(f"Analisando serviço: {service}")
            
            # Obter labels do serviço
            inspect_labels_cmd = f"docker service inspect {service} --format '{{{{json .Spec.Labels}}}}'"
            labels_json = run_ssh_command(client, inspect_labels_cmd, log_command=False)
            labels = {}
            if labels_json.strip():
                try:
                    labels = json.loads(labels_json)
                except Exception as je:
                    logger.error(f"Erro ao parsear labels de {service}: {je}")
            
            # Obter variáveis de ambiente do serviço
            inspect_env_cmd = f"docker service inspect {service} --format '{{{{json .Spec.TaskTemplate.ContainerSpec.Env}}}}'"
            env_json = run_ssh_command(client, inspect_env_cmd, log_command=False)
            env_list = []
            if env_json.strip():
                try:
                    env_list = json.loads(env_json) or []
                except Exception as je:
                    logger.error(f"Erro ao parsear env de {service}: {je}")
            
            update_args = []
            
            # 2. Verificar labels
            for l_key, l_val in labels.items():
                if old_domain in l_val:
                    new_val = l_val.replace(old_domain, new_domain)
                    update_args.append(f'--label-add "{l_key}={new_val}"')
                    logger.info(f"Label '{l_key}' será alterada de '{l_val}' para '{new_val}'")
            
            # 3. Verificar variáveis de ambiente
            for env_item in env_list:
                if "=" in env_item:
                    key, val = env_item.split("=", 1)
                    if old_domain in val:
                        new_val = val.replace(old_domain, new_domain)
                        update_args.append(f'--env-add "{key}={new_val}"')
                        logger.info(f"Env '{key}' será alterada de '{val}' para '{new_val}'")
            
            # 4. Executar o update se houver argumentos
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

# Cluster Swarm SSH helper functions
def get_swarm_join_tokens(host, username, password):
    """
    Obtém os tokens de adesão do Swarm para worker e manager no servidor pai.
    """
    client = get_ssh_client(host, username, password)
    try:
        # Se o Swarm não estiver ativo, lança erro
        output_state = run_ssh_command(client, "docker info --format '{{.Swarm.LocalNodeState}}'")
        if output_state.strip() != "active":
            raise Exception("Docker Swarm não está ativo no servidor pai.")
            
        worker_token = run_ssh_command(client, "docker swarm join-token worker -q").strip()
        manager_token = run_ssh_command(client, "docker swarm join-token manager -q").strip()
        return {"worker": worker_token, "manager": manager_token}
    finally:
        client.close()

def join_swarm_cluster(child_host, child_username, child_password, parent_ip, token):
    """
    Faz um servidor filho ingressar no cluster Swarm do pai.
    """
    client = get_ssh_client(child_host, child_username, child_password)
    try:
        # Verifica se o filho já é parte de um swarm
        output_state = run_ssh_command(client, "docker info --format '{{.Swarm.LocalNodeState}}'")
        if output_state.strip() == "active":
            return {"status": "success", "message": "O servidor filho já faz parte do cluster."}
            
        join_cmd = f"docker swarm join --token {token} {parent_ip}:2377"
        run_ssh_command(client, join_cmd)
        return {"status": "success", "message": "Nó adicionado ao cluster com sucesso."}
    except Exception as e:
        if "already part of a swarm" in str(e):
            return {"status": "success", "message": "O servidor filho já faz parte do cluster."}
        raise e
    finally:
        client.close()

def get_server_hostname(host, username, password):
    """
    Obtém o hostname do servidor para gerenciar no cluster do pai.
    """
    client = get_ssh_client(host, username, password)
    try:
        return run_ssh_command(client, "hostname").strip()
    finally:
        client.close()

def leave_swarm_cluster(child_host, child_username, child_password):
    """
    Faz o servidor filho sair do cluster Swarm.
    """
    client = get_ssh_client(child_host, child_username, child_password)
    try:
        run_ssh_command(client, "docker swarm leave --force")
        return {"status": "success", "message": "O servidor saiu do cluster Swarm."}
    finally:
        client.close()

def remove_swarm_node_from_parent(parent_host, parent_username, parent_password, node_name):
    """
    Remove o registro do nó do Swarm no servidor pai.
    """
    client = get_ssh_client(parent_host, parent_username, parent_password)
    try:
        # Remove o nó do Swarm no gerenciador
        run_ssh_command(client, f"docker node rm --force {node_name}")
        return {"status": "success", "message": f"Nó '{node_name}' removido do Swarm pai."}
    except Exception as e:
        # Se o nó não existir ou já tiver sido removido, podemos tolerar o erro
        logger.warning(f"Erro ao remover nó {node_name} do Swarm pai: {e}")
        return {"status": "warning", "message": str(e)}
    finally:
        client.close()

def get_swarm_nodes_real_status(host, username, password):
    """
    Executa docker node ls no manager pai para obter o status real dos nós no swarm.
    """
    client = get_ssh_client(host, username, password)
    try:
        # Verifica se o Swarm está ativo
        output_state = run_ssh_command(client, "docker info --format '{{.Swarm.LocalNodeState}}'")
        if output_state.strip() != "active":
            return []
        
        # Lista os nós em formato tabulado
        # Formato: ID \t HOSTNAME \t STATUS \t AVAILABILITY \t MANAGER STATUS
        output = run_ssh_command(client, "docker node ls --format '{{.ID}}\\t{{.Hostname}}\\t{{.Status}}\\t{{.Availability}}\\t{{.ManagerStatus}}'")
        nodes = []
        for line in output.strip().splitlines():
            if not line.strip():
                continue
            parts = line.split("\t")
            if len(parts) >= 4:
                nodes.append({
                    "id": parts[0].strip(),
                    "hostname": parts[1].strip(),
                    "status": parts[2].strip(),
                    "availability": parts[3].strip(),
                    "manager_status": parts[4].strip() if len(parts) > 4 else ""
                })
        return nodes
    except Exception as e:
        logger.warning(f"Erro ao listar nós do Swarm real: {e}")
        return []
    finally:
        client.close()

def change_swarm_node_hostname(parent_host, parent_username, parent_password, node_swarm_id, old_hostname, new_hostname):
    """
    Descobre o IP e credenciais do nó do Swarm, conecta via SSH e altera o hostname.
    """
    from app.database import get_servers
    
    # 1. Descobrir o IP do nó usando docker node inspect no pai
    node_ip = None
    client_parent = get_ssh_client(parent_host, parent_username, parent_password)
    try:
        try:
            # Tenta obter o IP do nó via inspect
            cmd_ip = f"docker node inspect {node_swarm_id} --format '{{{{.Status.Addr}}}}'"
            node_ip = run_ssh_command(client_parent, cmd_ip, log_command=False).strip()
            # Se retornar loopback ou vazio, ignora
            if node_ip in ["", "127.0.0.1", "0.0.0.0"]:
                node_ip = None
        except Exception as e:
            logger.warning(f"Erro ao obter IP do nó Swarm via inspect: {e}")
    finally:
        client_parent.close()

    # 2. Buscar no banco o servidor VPS correspondente
    servers_list = get_servers()
    target_server = None
    
    # Se encontramos um IP válido, procura pelo host correspondente
    if node_ip:
        for s in servers_list:
            if s["host"] == node_ip:
                target_server = s
                break

    # Se não encontrou pelo IP (ou inspect falhou), faz fallback procurando pelo hostname antigo
    if not target_server:
        # Se for o pai ativo
        try:
            # Verifica se o hostname do pai coincide
            client_parent_test = get_ssh_client(parent_host, parent_username, parent_password)
            parent_real_hostname = run_ssh_command(client_parent_test, "hostname").strip()
            client_parent_test.close()
            if parent_real_hostname == old_hostname:
                target_server = {
                    "host": parent_host,
                    "username": parent_username,
                    "password": parent_password
                }
        except:
            pass

    if not target_server:
        # Varre os servidores cadastrados testando a conexão SSH e o hostname
        for s in servers_list:
            try:
                client_test = get_ssh_client(s["host"], s["username"], s["password"], timeout=10)
                current_host = run_ssh_command(client_test, "hostname").strip()
                client_test.close()
                if current_host == old_hostname:
                    target_server = s
                    break
            except Exception as test_err:
                logger.warning(f"Falha ao checar hostname no host {s['host']}: {test_err}")

    if not target_server:
        raise Exception(f"Não foi possível localizar o servidor correspondente ao hostname '{old_hostname}' no banco de dados.")

    # 3. Conectar na VPS selecionada e alterar o hostname
    client_target = get_ssh_client(target_server["host"], target_server["username"], target_server["password"])
    try:
        logger.info(f"Alterando hostname de {target_server['host']} de '{old_hostname}' para '{new_hostname}'...")
        
        # 3.1 Define o novo hostname
        run_ssh_command(client_target, f"sudo hostnamectl set-hostname {new_hostname}")
        
        # 3.2 Atualiza o /etc/hosts
        run_ssh_command(client_target, f"sudo sed -i 's/{old_hostname}/{new_hostname}/g' /etc/hosts")
        
        # 3.3 Reinicia o daemon do Docker para relatar o novo hostname ao Swarm imediatamente
        run_ssh_command(client_target, "sudo systemctl restart docker")
        
        return {"status": "success", "message": f"Hostname alterado com sucesso para '{new_hostname}'."}
    finally:
        client_target.close()



