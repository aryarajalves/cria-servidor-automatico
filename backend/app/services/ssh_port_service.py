import logging
import time
from app.services.base_ssh import get_ssh_client, verify_ssh_connection, run_ssh_command, detect_active_ssh_port
from app.database import get_server_by_host, update_server

logger = logging.getLogger(__name__)

RESERVED_PORTS = {0, 80, 443, 5432, 6379, 5672, 15672, 9000, 9443}

def validate_ssh_port(port: int) -> int:
    try:
        port_num = int(port)
    except (ValueError, TypeError):
        raise ValueError("A porta deve ser um número inteiro válido.")
        
    if port_num < 1 or port_num > 65535:
        raise ValueError("A porta SSH deve estar no intervalo entre 1 e 65535.")
        
    if port_num in RESERVED_PORTS:
        raise ValueError(f"A porta {port_num} é reservada por serviços essenciais do sistema (Traefik/Banco/Portainer) e não pode ser usada para o SSH.")
        
    return port_num

def change_vps_ssh_port(host: str, username: str, new_port: int, current_port: int = 22, password: str = None, key_id: int = None, auth_type: str = "password"):
    """
    Altera a porta do serviço SSH na VPS e atualiza o registro no banco de dados com segurança:
    1. Valida a nova porta.
    2. Detecta automaticamente a porta SSH atualmente ativa no host remoto.
    3. Se a VPS já estiver na nova porta, sincroniza o banco e retorna sucesso.
    4. Conecta via SSH na porta ativa.
    5. Libera a nova porta no firewall (UFW/iptables/firewalld).
    6. Configura escuta simultânea (Dual-Port) para manter a porta antiga ativa enquanto valida a nova.
    7. Testa a conexão na nova porta.
    8. Confirmado o acesso, remove a porta antiga e finaliza a migração.
    9. Sincroniza com o banco de dados.
    """
    valid_port = validate_ssh_port(new_port)
    host_clean = host.strip() if host else ""
    server = get_server_by_host(host_clean)
    db_port = int(server["port"]) if server and server.get("port") else None

    # 1. Detecta ativamente qual porta está respondendo no servidor
    active_port = detect_active_ssh_port(
        host=host_clean,
        candidate_ports=[current_port, db_port, valid_port, 22, 22022, 2222, 5022],
        timeout=1.5
    )
    if not active_port:
        active_port = int(current_port or db_port or 22)

    logger.info(f"[SSH PORT] Host {host_clean} com porta ativa detectada: {active_port}. Porta desejada: {valid_port}")

    # Se o servidor já está operando na nova porta
    if active_port == valid_port:
        if server and server.get("port") != valid_port:
            update_server(server_id=server["id"], port=valid_port)
        return {
            "status": "success",
            "port": valid_port,
            "message": f"O servidor já está operando e configurado na porta {valid_port}!"
        }

    # 2. Conecta na porta ativa
    try:
        client = get_ssh_client(
            host=host_clean,
            username=username,
            password=password,
            key_id=key_id,
            port=active_port,
            timeout=20,
            auto_detect_port=True
        )
    except Exception as e:
        logger.error(f"[SSH PORT] Falha ao conectar na porta ativa {active_port}: {e}")
        raise ValueError(f"Não foi possível conectar ao servidor na porta {active_port}: {str(e)}")

    try:
        # 3. Backup do sshd_config
        run_ssh_command(client, "cp -n /etc/ssh/sshd_config /etc/ssh/sshd_config.bak_autoserver || true", timeout=10)

        # 4. Libera a nova porta no firewall
        firewall_cmd = f"""
        which ufw >/dev/null 2>&1 && ufw allow {valid_port}/tcp || true
        iptables -I INPUT -p tcp --dport {valid_port} -j ACCEPT 2>/dev/null || true
        which firewall-cmd >/dev/null 2>&1 && (firewall-cmd --add-port={valid_port}/tcp --permanent 2>/dev/null && firewall-cmd --reload 2>/dev/null) || true
        """
        run_ssh_command(client, firewall_cmd, timeout=15)

        # 5. Escuta simultânea (Dual-Port): adiciona valid_port e active_port
        dual_config_cmd = f"""
        mkdir -p /etc/ssh/sshd_config.d
        rm -f /etc/ssh/sshd_config.d/99-autoserver-port.conf
        cat << 'EOF' > /etc/ssh/sshd_config.d/00-autoserver-port.conf
Port {valid_port}
Port {active_port}
EOF
        chmod 644 /etc/ssh/sshd_config.d/00-autoserver-port.conf

        # Atualiza arquivo principal
        sed -i -E 's/^\\s*#?\\s*Port\\s+[0-9]+/Port {valid_port}/gI' /etc/ssh/sshd_config || true

        # Socket activation do systemd se aplicável
        if systemctl is-active --quiet ssh.socket || systemctl is-enabled --quiet ssh.socket 2>/dev/null; then
            mkdir -p /etc/systemd/system/ssh.socket.d
            cat << 'EOF' > /etc/systemd/system/ssh.socket.d/listen.conf
[Socket]
ListenStream=
ListenStream={valid_port}
ListenStream={active_port}
EOF
            systemctl daemon-reload || true
            systemctl restart ssh.socket || true
        fi
        true
        """
        run_ssh_command(client, dual_config_cmd, timeout=15)

        # Valida sintaxe
        run_ssh_command(client, "sshd -t || /usr/sbin/sshd -t", timeout=10)

        # Reinicia o serviço SSH com portas duplas
        run_ssh_command(client, "systemctl restart ssh || systemctl restart sshd || service ssh restart || service sshd restart || true", timeout=15)

    except Exception as e:
        logger.error(f"[SSH PORT] Erro durante reconfiguração inicial: {e}")
        try:
            client.close()
        except Exception:
            pass
        raise ValueError(f"Falha ao aplicar configuração na VPS: {str(e)}")

    # Aguarda inicialização dos sockets
    time.sleep(2)

    # 6. Testa conexão na nova porta (sem auto-detecção para validar especificamente a nova porta)
    logger.info(f"[SSH PORT] Testando conexão com {host_clean} na nova porta {valid_port}...")
    is_connected = verify_ssh_connection(
        host=host_clean,
        username=username,
        password=password,
        key_id=key_id,
        port=valid_port
    )

    if not is_connected:
        logger.error(f"[SSH PORT] Conexão na nova porta {valid_port} NÃO respondeu. Mantendo VPS na porta {active_port}...")
        try:
            # Reverte configuração mantendo a porta ativa
            rollback_cmd = f"""
            echo 'Port {active_port}' > /etc/ssh/sshd_config.d/00-autoserver-port.conf
            sed -i -E 's/^\\s*#?\\s*Port\\s+[0-9]+/Port {active_port}/gI' /etc/ssh/sshd_config || true
            if [ -f /etc/systemd/system/ssh.socket.d/listen.conf ]; then
                cat << 'EOF' > /etc/systemd/system/ssh.socket.d/listen.conf
[Socket]
ListenStream=
ListenStream={active_port}
EOF
                systemctl daemon-reload || true
                systemctl restart ssh.socket || true
            fi
            systemctl restart ssh || systemctl restart sshd || service ssh restart || service sshd restart || true
            """
            run_ssh_command(client, rollback_cmd, timeout=10)
        except Exception as rb_err:
            logger.warning(f"[SSH PORT] Rollback automático reportou: {rb_err}")
        finally:
            try:
                client.close()
            except Exception:
                pass

        raise ValueError(
            f"A porta foi configurada na VPS, mas a conexão de teste na porta {valid_port} não respondeu externamente. "
            f"O servidor permaneceu seguro e ativo na porta {active_port}. "
            f"Verifique se o firewall do provedor de nuvem (Hetzner Cloud Firewall, AWS Security Group, DigitalOcean, Oracle) permite tráfego TCP de entrada na porta {valid_port}."
        )

    # 7. Nova porta confirmada! Remove a porta antiga da configuração
    try:
        finalize_cmd = f"""
        echo 'Port {valid_port}' > /etc/ssh/sshd_config.d/00-autoserver-port.conf
        sed -i -E 's/^\\s*#?\\s*Port\\s+[0-9]+/Port {valid_port}/gI' /etc/ssh/sshd_config || true
        if [ -f /etc/systemd/system/ssh.socket.d/listen.conf ]; then
            cat << 'EOF' > /etc/systemd/system/ssh.socket.d/listen.conf
[Socket]
ListenStream=
ListenStream={valid_port}
EOF
            systemctl daemon-reload || true
            systemctl restart ssh.socket || true
        fi
        systemctl restart ssh || systemctl restart sshd || service ssh restart || service sshd restart || true
        """
        run_ssh_command(client, finalize_cmd, timeout=15)
    except Exception as fin_err:
        logger.warning(f"[SSH PORT] Aviso ao limpar porta legada da configuração: {fin_err}")
    finally:
        try:
            client.close()
        except Exception:
            pass

    # 8. Atualiza no banco de dados local
    if server:
        update_server(server_id=server["id"], port=valid_port)
        logger.info(f"[SSH PORT] Servidor ID {server['id']} ({host_clean}) atualizado com port={valid_port} no banco.")
    else:
        from app.database import add_server
        server_id = add_server(
            name=f"VPS ({host_clean})",
            host=host_clean,
            port=valid_port,
            username=username or "root",
            password=password,
            auth_type=auth_type or "password",
            key_id=key_id
        )
        logger.info(f"[SSH PORT] Servidor {host_clean} cadastrado com ID {server_id} e port={valid_port} no banco.")

    return {
        "status": "success",
        "port": valid_port,
        "message": f"Porta SSH alterada com sucesso para {valid_port} na VPS e no sistema!"
    }

def update_ssh_port_local(host: str, port: int, server_id: int = None, username: str = "root", password: str = None, key_id: int = None, auth_type: str = "password"):
    """
    Atualiza apenas o registro local da porta SSH no banco de dados.
    Caso o servidor ainda não conste na tabela, realiza o auto-cadastro.
    """
    valid_port = validate_ssh_port(port)
    host_clean = host.strip() if host else ""

    server = None
    if server_id:
        from app.database import get_server_by_id
        server = get_server_by_id(server_id)
    if not server and host_clean:
        server = get_server_by_host(host_clean)
        
    if server:
        update_server(server_id=server["id"], port=valid_port)
        logger.info(f"[SSH PORT] Servidor ID {server['id']} ({server['host']}) atualizado localmente para port={valid_port}")
    else:
        if host_clean:
            from app.database import add_server
            new_id = add_server(
                name=f"VPS ({host_clean})",
                host=host_clean,
                port=valid_port,
                username=username or "root",
                password=password,
                auth_type=auth_type or "password",
                key_id=key_id
            )
            logger.info(f"[SSH PORT] Servidor {host_clean} não existia e foi registrado com ID {new_id} e port={valid_port}")
        else:
            raise ValueError("Host do servidor não informado.")

    return {
        "status": "success",
        "port": valid_port,
        "message": f"Porta SSH atualizada para {valid_port} no sistema!"
    }
