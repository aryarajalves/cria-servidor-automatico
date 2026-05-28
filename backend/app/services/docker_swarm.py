import logging
from app.services.base_ssh import get_ssh_client, run_ssh_command

logger = logging.getLogger(__name__)

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
        return {"status": "success", "message": "Docker updated successfully"}
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
        for cmd in commands: 
            run_ssh_command(client, cmd, timeout=60)
        return {"status": "success", "message": "Ctop instalado com sucesso"}
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

def change_swarm_node_hostname(parent_host, parent_username, parent_password, node_swarm_id, old_hostname, new_hostname):
    """
    Descobre o IP e credenciais do nó do Swarm, conecta via SSH e altera o hostname.
    """
    from app.database import get_servers
    
    node_ip = None
    client_parent = get_ssh_client(parent_host, parent_username, parent_password)
    try:
        try:
            cmd_ip = f"docker node inspect {node_swarm_id} --format '{{{{.Status.Addr}}}}'"
            node_ip = run_ssh_command(client_parent, cmd_ip, log_command=False).strip()
            if node_ip in ["", "127.0.0.1", "0.0.0.0"]:
                node_ip = None
        except Exception as e:
            logger.warning(f"Erro ao obter IP do nó Swarm via inspect: {e}")
    finally:
        client_parent.close()

    servers_list = get_servers()
    target_server = None
    
    if node_ip:
        for s in servers_list:
            if s["host"] == node_ip:
                target_server = s
                break

    if not target_server:
        try:
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

    client_target = get_ssh_client(target_server["host"], target_server["username"], target_server["password"])
    try:
        logger.info(f"Alterando hostname de {target_server['host']} de '{old_hostname}' para '{new_hostname}'...")
        run_ssh_command(client_target, f"sudo hostnamectl set-hostname {new_hostname}")
        run_ssh_command(client_target, f"sudo sed -i 's/{old_hostname}/{new_hostname}/g' /etc/hosts")
        run_ssh_command(client_target, "sudo systemctl restart docker")
        return {"status": "success", "message": f"Hostname alterado com sucesso para '{new_hostname}'."}
    finally:
        client_target.close()

def get_swarm_join_tokens(host, username, password):
    """
    Obtém os tokens de adesão do Swarm para worker e manager no servidor pai.
    """
    client = get_ssh_client(host, username, password)
    try:
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
        run_ssh_command(client, f"docker node rm --force {node_name}")
        return {"status": "success", "message": f"Nó '{node_name}' removido do Swarm pai."}
    except Exception as e:
        logger.warning(f"Erro ao remover nó {node_name} do Swarm pai: {e}")
        return {"status": "warning", "message": str(e)}
    finally:
        client.close()
