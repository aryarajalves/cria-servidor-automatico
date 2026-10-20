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

def probe_ssh_port(host: str, port: int, timeout: float = 1.5) -> bool:
    """
    Testa se uma porta TCP responde e se exibe um banner SSH válido (SSH-2.0...).
    Retorna True se for um serviço SSH ativo, False caso contrário.
    """
    import socket
    s = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        if s.connect_ex((host, int(port))) == 0:
            try:
                banner = s.recv(128)
                if banner and b"SSH-" in banner:
                    return True
            except Exception:
                pass
            return True
        return False
    except Exception:
        return False
    finally:
        if s:
            try:
                s.close()
            except Exception:
                pass

def detect_active_ssh_port(host: str, candidate_ports: list = None, timeout: float = 1.5):
    """
    Analisa e detecta a porta SSH ativa em um host remoto testando portas candidatas.
    """
    from app.database import get_server_by_host
    
    candidates = []
    if candidate_ports:
        for p in candidate_ports:
            if p is not None:
                try:
                    p_int = int(p)
                    if 1 <= p_int <= 65535 and p_int not in candidates:
                        candidates.append(p_int)
                except (ValueError, TypeError):
                    pass

    # Inclui a porta cadastrada no banco de dados se houver
    server = get_server_by_host(host)
    if server and server.get("port"):
        try:
            db_port = int(server["port"])
            if db_port not in candidates:
                candidates.append(db_port)
        except (ValueError, TypeError):
            pass

    # Portas padrão comuns de SSH
    default_ssh_ports = [22, 22022, 2222, 5022, 22222]
    for dp in default_ssh_ports:
        if dp not in candidates:
            candidates.append(dp)

    logger.info(f"[SSH DETECT] Analisando portas SSH ativas para {host}. Candidatas: {candidates}")

    for candidate in candidates:
        if probe_ssh_port(host, candidate, timeout=timeout):
            logger.info(f"[SSH DETECT] Porta SSH ATIVA confirmada em {host}:{candidate}")
            return candidate

    logger.warning(f"[SSH DETECT] Nenhuma porta respondeu com SSH ativo em {host} (candidatas: {candidates}).")
    return None

def get_ssh_client(host, username, password=None, private_key=None, passphrase=None, key_id=None, port=None, timeout=30, auto_detect_port=True):
    """
    Cria e retorna uma conexão SSH usando Paramiko, suportando autenticação por Senha ou Chave Privada (RSA, Ed25519, ECDSA),
    portas customizadas e auto-detecção resiliente de porta em caso de desincronização.
    """
    from app.services.ssh_keys import parse_private_key
    from app.database import get_ssh_key_by_id, get_server_by_host, update_server

    pkey = None

    # 1. Se foi passado key_id específico, busca no banco de dados
    if key_id:
        key_record = get_ssh_key_by_id(key_id)
        if key_record:
            pkey, _ = parse_private_key(key_record["private_key"], key_record.get("passphrase") or passphrase)

    # 2. Se foi passado texto da chave privada diretamente
    if not pkey and private_key:
        pkey, _ = parse_private_key(private_key, passphrase)

    # 3. Se não tem chave explícita, senha ou porta, tenta resolver automaticamente pelo servidor cadastrado
    server = None
    if not pkey or not password or port is None:
        server = get_server_by_host(host)

    if not pkey and not password and server:
        if server.get("key_id"):
            key_record = get_ssh_key_by_id(server["key_id"])
            if key_record:
                pkey, _ = parse_private_key(key_record["private_key"], key_record.get("passphrase"))
        elif server.get("password"):
            password = server["password"]

    # Resolve porta inicial
    target_port = None
    if port is not None:
        try:
            target_port = int(port)
        except (ValueError, TypeError):
            target_port = 22
    elif server and server.get("port"):
        try:
            target_port = int(server["port"])
        except (ValueError, TypeError):
            target_port = 22
    else:
        target_port = 22

    auth_method = "Chave Privada" if pkey else "Senha"
    logger.info(f"[SSH] Parâmetros: User={username}, Port={target_port}, Auth={auth_method}, Timeout={timeout}s")
    
    connect_kwargs = {
        "hostname": host,
        "port": target_port,
        "username": username,
        "timeout": timeout,
        "look_for_keys": False,
        "allow_agent": False,
        "banner_timeout": 30,
        "auth_timeout": 30
    }
    
    if pkey:
        connect_kwargs["pkey"] = pkey
    else:
        connect_kwargs["password"] = password

    def _try_connect_on_port(p):
        kwargs = dict(connect_kwargs)
        kwargs["port"] = p
        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            start = time.time()
            try:
                logger.info(f"[SSH] Conectando a {host}:{p} via {auth_method} (tentativa {attempt}/{max_attempts})...")
                client.connect(**kwargs)
                elapsed = time.time() - start
                logger.info(f"[SSH] Conexão estabelecida com sucesso em {elapsed:.2f}s na porta {p}")
                return client
            except paramiko.AuthenticationException as e:
                logger.warning(f"[SSH] Autenticação falhou na porta {p}: {e}")
                if pkey:
                    logger.error(f"[SSH] Falha de autenticação com a chave privada fornecida para {username}@{host}:{p}.")
                    raise e
                break
            except Exception as e:
                if attempt < max_attempts and ("banner" in str(e).lower() or isinstance(e, (EOFError, ConnectionResetError, paramiko.SSHException))):
                    logger.warning(f"[SSH] Oscilação transitória de banner/socket na porta {p} (tentativa {attempt}): {e}. Retentando...")
                    time.sleep(0.5)
                    continue
                logger.error(f"[SSH] Falha de conexão na porta {p} (tentativa {attempt}): {e}")
                raise e

        # Fallback para autenticação por senha
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        start = time.time()
        try:
            logger.info(f"[SSH] Tentando conexão de fallback na porta {p}...")
            client.connect(
                hostname=host,
                port=p,
                username=username, 
                password=password, 
                timeout=timeout,
                look_for_keys=True,
                allow_agent=True,
                banner_timeout=30,
                auth_timeout=30
            )
            elapsed = time.time() - start
            logger.info(f"[SSH] Conexão de fallback estabelecida em {elapsed:.2f}s na porta {p}")
            return client
        except Exception as e2:
            logger.warning(f"[SSH] Fallback falhou na porta {p}: {e2}")
            # Tentativa final: Keyboard-Interactive
            try:
                def interactive_handler(title, instructions, prompt_list):
                    resp = []
                    for prompt, echo in prompt_list:
                        resp.append(password)
                    return resp

                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                t = paramiko.Transport((host, p))
                t.connect()
                t.auth_interactive(username, interactive_handler)
                
                client._transport = t
                logger.info(f"[SSH] Conexão interativa estabelecida com sucesso na porta {p}.")
                return client
            except Exception as e3:
                raise e3

    # Tentativa na porta primária
    try:
        return _try_connect_on_port(target_port)
    except paramiko.AuthenticationException:
        raise
    except Exception as primary_err:
        if not auto_detect_port:
            raise primary_err

        logger.warning(f"[SSH] Falha ao conectar em {host}:{target_port} ({primary_err}). Iniciando auto-detecção de porta ativa...")
        active_port = detect_active_ssh_port(
            host=host,
            candidate_ports=[target_port, server.get("port") if server else None, 22, 22022, 2222, 5022],
            timeout=1.5
        )

        if active_port and active_port != target_port:
            logger.info(f"[SSH] Auto-detecção localizou porta ativa {active_port} para {host}. Reconectando...")
            try:
                client = _try_connect_on_port(active_port)
                # Auto-sincroniza o banco de dados se o servidor estiver cadastrado com a porta antiga
                if server and server.get("id") and server.get("port") != active_port:
                    try:
                        update_server(server_id=server["id"], port=active_port)
                        logger.info(f"[SSH] Banco de dados atualizado automaticamente: Servidor ID {server['id']} ({host}) agora com port={active_port}")
                    except Exception as db_sync_err:
                        logger.warning(f"[SSH] Não foi possível atualizar porta no banco: {db_sync_err}")
                return client
            except Exception as active_port_err:
                logger.error(f"[SSH] Falha ao conectar também na porta detectada {active_port}: {active_port_err}")
                raise active_port_err

        raise primary_err

def verify_ssh_connection(host, username, password=None, private_key=None, passphrase=None, key_id=None, port=None):
    """
    Testa se as credenciais SSH (Senha ou Chave) são válidas na porta informada.
    """
    start_time = time.time()
    auth_desc = f"KeyID={key_id}" if key_id else ("PrivateKey" if private_key else "Password")
    logger.info(f"[VERIFY] Iniciando verificação SSH para {username}@{host}:{port or 22} ({auth_desc})")
    
    try:
        logger.info(f"[VERIFY] Chamando get_ssh_client com timeout=30s")
        client = get_ssh_client(
            host=host,
            username=username,
            password=password,
            private_key=private_key,
            passphrase=passphrase,
            key_id=key_id,
            port=port,
            timeout=30
        )
        
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

def normalize_ssh_command(command: str) -> str:
    """
    Garante que comandos com 'sudo' não quebrem em servidores sem o pacote sudo instalado.
    Se 'sudo' não estiver disponível no PATH, injeta uma função fallback inteligente
    que extrai flags e variáveis de ambiente e executa o comando diretamente.
    """
    if "sudo" in command:
        fallback = 'if ! command -v sudo >/dev/null 2>&1; then sudo() { while [ "$#" -gt 0 ]; do case "$1" in -*) shift ;; *=*) export "$1"; shift ;; *) break ;; esac; done; "$@"; }; fi; '
        return f'{fallback}{command}'
    return command

def run_ssh_command(client, command, timeout=10, log_command=True):
    """
    Executa um comando no servidor remoto via SSH com timeout.
    """
    command_to_run = normalize_ssh_command(command)
    if log_command:
        logger.info(f"CMD: {command}")
    stdin, stdout, stderr = client.exec_command(command_to_run, timeout=timeout)
    
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
