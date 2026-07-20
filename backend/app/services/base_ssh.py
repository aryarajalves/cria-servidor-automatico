import paramiko
import logging
import os
import time
import tempfile

logger = logging.getLogger(__name__)

def get_stack_path(filename):
    """Retorna o caminho absoluto para um arquivo de stack, compatível com PyInstaller."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Lista de subdiretórios para procurar de forma organizada
    subdirs = ["stacks_gerais", "aplicativos_proprios", ""]
    
    for subdir in subdirs:
        path = os.path.join(base_dir, "stacks", subdir, filename)
        if os.path.exists(path):
            return path
            
    # Fallback padrão caso não encontre nas subpastas
    return os.path.join(base_dir, "stacks", filename)

def get_ssh_client(host, username, password, timeout=30):
    """
    Cria e retorna uma conexão SSH usando Paramiko.
    """
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
        raise Exception(f"Erro/Timeout ao executar comando: {str(e)}")

def deploy_stack_remote(client, stack_name, stack_content):
    """
    Faz o deploy de uma stack Docker em um servidor remoto, tentando usar a API do Portainer se configurada,
    caso contrário faz o fallback para SSH com docker stack deploy.
    """
    try:
        host = client.get_transport().getpeername()[0]
    except Exception as e:
        logger.warning(f"Não foi possível obter o IP do SSHClient: {e}")
        host = None

    if host:
        from app.database import get_setting
        p_user = get_setting("portainer_user", host)
        p_pass = get_setting("portainer_password", host)

        if p_user and p_pass:
            logger.info(f"Portainer configurado para o host {host}. Realizando deploy via API...")
            from app.portainer import get_portainer_token, get_first_swarm_endpoint_id, deploy_stack_portainer
            
            last_exception = None
            # Tenta primeiro a porta HTTP 9000 (sem SSL) para evitar falhas de certificado/handshake
            for port in [9000, 9443]:
                scheme = "https" if port == 9443 else "http"
                base_url = f"{scheme}://{host}:{port}"
                try:
                    logger.info(f"Tentando autenticar no Portainer em {base_url} (verify=False)...")
                    token = get_portainer_token(base_url, p_user, p_pass, verify=False)
                    endpoint_id = get_first_swarm_endpoint_id(base_url, token=token, verify=False)
                    logger.info(f"Realizando deploy via Portainer API em {base_url} (Endpoint={endpoint_id})...")
                    res = deploy_stack_portainer(base_url, stack_name, stack_content, endpoint_id, token=token, verify=False)
                    if res.get("status") == "success":
                        return {"status": "success", "message": f"Stack {stack_name} implantada com sucesso via Portainer API"}
                except Exception as pe:
                    logger.warning(f"Falha ao implantar no Portainer na porta {port}: {pe}")
                    last_exception = pe

            logger.warning(f"Todas as tentativas de deploy via API do Portainer falharam para {host}. Fazendo fallback para SSH direto...")

    logger.info(f"Fazendo deploy da stack {stack_name} via SSH...")
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

def change_ssh_password(host, username, old_password, new_password):
    client = get_ssh_client(host, username, old_password)
    try:
        cmd = f'echo "{username}:{new_password}" | sudo chpasswd'
        if username == 'root': cmd = f'echo "{username}:{new_password}" | chpasswd'
        run_ssh_command(client, cmd, timeout=20, log_command=False)
        return {"status": "success", "message": "Senha do servidor alterada."}
    finally: client.close()
