import logging
import secrets
import string
import os
from app.services.base_ssh import get_ssh_client, run_ssh_command, deploy_stack_remote, get_stack_path
from app.database import save_stack_credentials, get_setting

logger = logging.getLogger(__name__)

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

def delete_postgres_database(client, db_name):
    """
    Remove um banco de dados no container do Postgres de forma agressiva.
    """
    logger.info(f"Removendo banco de dados '{db_name}' no Postgres...")
    get_container_cmd = "docker ps -q -f name=postgres_postgres | head -n 1"
    container_id = run_ssh_command(client, get_container_cmd).strip()
    
    if not container_id:
        get_container_cmd = "docker ps -q -f label=com.docker.swarm.service.name=postgres_postgres | head -n 1"
        container_id = run_ssh_command(client, get_container_cmd).strip()

    if not container_id:
        logger.warning("Container do Postgres não encontrado. O banco de dados pode persistir se o volume do Postgres não for removido.")
        return

    list_dbs_cmd = f'docker exec {container_id} psql -U postgres -lqt | cut -d \| -f 1'
    dbs_before = run_ssh_command(client, list_dbs_cmd)
    logger.info(f"Bancos de dados existentes antes do DROP: {dbs_before.strip().split()}")

    drop_db_cmd = f'docker exec {container_id} psql -U postgres -c "REVOKE CONNECT ON DATABASE {db_name} FROM public;" && ' \
                  f'docker exec {container_id} psql -U postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = \'{db_name}\' AND pid <> pg_backend_pid();" && ' \
                  f'docker exec {container_id} psql -U postgres -c "DROP DATABASE IF EXISTS {db_name};"'
    
    try:
        run_ssh_command(client, drop_db_cmd)
        logger.info(f"Comando de remoção do banco '{db_name}' executado.")
        
        check_cmd = f'docker exec {container_id} psql -U postgres -lqt | cut -d \| -f 1 | grep -w {db_name} | wc -l'
        exists = run_ssh_command(client, check_cmd).strip()
        if exists == "0":
            logger.info(f"BANCO DE DADOS '{db_name}' REMOVIDO COM SUCESSO.")
        else:
            logger.error(f"FALHA AO REMOVER BANCO '{db_name}'. Ele ainda aparece na lista.")
    except Exception as e:
        logger.error(f"Erro ao processar remoção do banco {db_name}: {e}")

def install_minio(host, username, password, minio_root_user=None, minio_root_password=None, minio_console_url="", minio_server_url=""):
    """
    Faz o deploy da stack do MinIO em um servidor remoto via SSH.
    """
    stack_path = get_stack_path("minio.yml")
    if not os.path.exists(stack_path):
        raise FileNotFoundError(f"Arquivo de stack não encontrado: {stack_path}")

    if not minio_root_user:
        minio_root_user = "unwind"
    if not minio_root_password:
        minio_root_password = secrets.token_hex(16)

    with open(stack_path, "r", encoding="utf-8") as f:
        stack_content = f.read()

    minio_console_url_clean = minio_console_url.replace("https://", "").replace("http://", "").strip("/")
    minio_server_url_clean = minio_server_url.replace("https://", "").replace("http://", "").strip("/")

    stack_content = stack_content.replace("{Minio_User}", minio_root_user)
    stack_content = stack_content.replace("{Minio_Password}", minio_root_password)
    stack_content = stack_content.replace("{BaseUrl_Minio_Console}", minio_console_url_clean)
    stack_content = stack_content.replace("{BaseUrl_Minio_Api}", minio_server_url_clean)

    client = get_ssh_client(host, username, password)
    try:
        logger.info(f"Criando volume minio_data em {host}...")
        try:
            run_ssh_command(client, "docker volume create minio_data")
        except Exception as e:
            logger.warning(f"Aviso ao criar volume minio_data (pode já existir): {e}")

        result = deploy_stack_remote(client, "minio", stack_content)
        save_stack_credentials(host, "minio", minio_root_user, minio_root_password)
        return {
            "status": "success",
            "message": "MinIO instalado com sucesso",
            "credentials": {"user": minio_root_user, "password": minio_root_password}
        }
    finally:
        client.close()

