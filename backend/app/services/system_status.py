import logging
import re
import json
from app.services.base_ssh import get_ssh_client, run_ssh_command
from app.database import get_setting, get_all_stack_credentials, get_stack_credentials

logger = logging.getLogger(__name__)

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

def check_ctop_installed(host, username, password):
    client = get_ssh_client(host, username, password)
    try:
        cmd = "export PATH=$PATH:/usr/local/bin; ctop --help"
        stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
        full_output = (stdout.read().decode('utf-8') + stderr.read().decode('utf-8')).lower()
        return not ("command not found" in full_output or "not found" in full_output)
    except: return False
    finally: client.close()

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

def get_server_hostname(host, username, password):
    """
    Obtém o hostname do servidor para gerenciar no cluster do pai.
    """
    client = get_ssh_client(host, username, password)
    try:
        return run_ssh_command(client, "hostname").strip()
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

# Portainer SSH Helpers para verificação

def _run_portainer_curl(client, method, endpoint, token=None, data=None):
    url = f"http://127.0.0.1:9000/api{endpoint}"
    headers = ["-H 'Content-Type: application/json'"]
    if token: headers.append(f"-H 'Authorization: Bearer {token}'")
    header_str = " ".join(headers)
    import random
    import time
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
