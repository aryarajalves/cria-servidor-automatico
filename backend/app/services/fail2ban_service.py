import logging
import re
from typing import Optional, Dict, Any, List
from app.services.base_ssh import get_ssh_client, run_ssh_command
from app.database import get_setting, save_setting

logger = logging.getLogger(__name__)

def parse_banned_ips(output: str) -> List[str]:
    """
    Extrai lista de IPs banidos da saída do comando `fail2ban-client status <jail>`.
    Exemplo de linha: '   `- Banned IP list:  192.168.1.100 10.0.0.5'
    """
    banned_ips = []
    for line in output.splitlines():
        if "banned ip list:" in line.lower():
            parts = line.split(":", 1)
            if len(parts) > 1:
                ips = parts[1].strip().split()
                banned_ips = [ip.strip() for ip in ips if ip.strip()]
    return banned_ips

def get_fail2ban_status(
    host: str,
    username: str = "root",
    port: int = 22,
    password: Optional[str] = None,
    key_id: Optional[int] = None,
    auth_type: str = "password"
) -> Dict[str, Any]:
    """
    Consulta o status do Fail2ban na VPS remota.
    """
    port = int(port or 22)
    logger.info(f"[FAIL2BAN] Consultando status em {username}@{host}:{port}")

    # Configurações salvas no banco como fallback
    saved_maxretry = int(get_setting("fail2ban_maxretry", host) or "5")
    saved_findtime = int(get_setting("fail2ban_findtime", host) or "600")
    saved_bantime = int(get_setting("fail2ban_bantime", host) or "3600")

    client = None
    try:
        client = get_ssh_client(
            host=host,
            username=username,
            password=password,
            key_id=key_id,
            port=port,
            timeout=15
        )

        # 1. Verifica se está instalado
        check_installed = run_ssh_command(client, "which fail2ban-client || echo 'NOT_INSTALLED'", timeout=10).strip()
        if "NOT_INSTALLED" in check_installed:
            return {
                "status": "success",
                "installed": False,
                "active": False,
                "maxretry": saved_maxretry,
                "findtime": saved_findtime,
                "bantime": saved_bantime,
                "jails": [],
                "banned_ips": [],
                "message": "Fail2ban não está instalado na VPS."
            }

        # 2. Verifica se o serviço está ativo
        check_active = run_ssh_command(client, "systemctl is-active fail2ban || echo 'inactive'", timeout=10).strip()
        is_active = (check_active == "active")

        # 3. Se ativo, lista as jails e os IPs banidos
        jails = []
        banned_ips = []
        if is_active:
            status_out = run_ssh_command(client, "fail2ban-client status || true", timeout=10)
            for line in status_out.splitlines():
                if "jail list:" in line.lower():
                    parts = line.split(":", 1)
                    if len(parts) > 1:
                        jails = [j.strip() for j in parts[1].replace(",", "").split() if j.strip()]

            for jail in jails:
                jail_out = run_ssh_command(client, f"fail2ban-client status {jail} || true", timeout=10)
                ips = parse_banned_ips(jail_out)
                for ip in ips:
                    if ip not in banned_ips:
                        banned_ips.append({"ip": ip, "jail": jail})

        return {
            "status": "success",
            "installed": True,
            "active": is_active,
            "maxretry": saved_maxretry,
            "findtime": saved_findtime,
            "bantime": saved_bantime,
            "jails": jails,
            "banned_ips": banned_ips,
            "message": "Proteção ativa e monitorando a VPS." if is_active else "Fail2ban instalado, porém o serviço está inativo."
        }

    except Exception as e:
        logger.warning(f"[FAIL2BAN] Falha ao consultar VPS: {e}")
        return {
            "status": "warning",
            "installed": False,
            "active": False,
            "maxretry": saved_maxretry,
            "findtime": saved_findtime,
            "bantime": saved_bantime,
            "jails": [],
            "banned_ips": [],
            "message": f"Não foi possível conectar à VPS ({str(e)})."
        }
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


def install_and_configure_fail2ban(
    host: str,
    username: str = "root",
    maxretry: int = 5,
    findtime: int = 600,
    bantime: int = 3600,
    ssh_port: int = 22,
    password: Optional[str] = None,
    key_id: Optional[int] = None,
    auth_type: str = "password"
) -> Dict[str, Any]:
    """
    Instala o Fail2ban (se necessário) e configura regras de proteção contra força bruta.
    """
    ssh_port = int(ssh_port or 22)
    maxretry = max(1, int(maxretry or 5))
    findtime = max(30, int(findtime or 600))
    bantime = max(60, int(bantime or 3600))

    logger.info(f"[FAIL2BAN] Configurando Fail2ban em {username}@{host}:{ssh_port} (maxretry={maxretry}, findtime={findtime}s, bantime={bantime}s)")

    client = None
    try:
        client = get_ssh_client(
            host=host,
            username=username,
            password=password,
            key_id=key_id,
            port=ssh_port,
            timeout=25
        )
    except Exception as e:
        logger.error(f"[FAIL2BAN] Erro ao conectar na VPS: {e}")
        raise ValueError(f"Não foi possível conectar à VPS para configurar o Fail2ban: {str(e)}")

    try:
        # 1. Instala fail2ban e iptables se não estiverem presentes
        install_cmd = """
        if ! which fail2ban-client >/dev/null 2>&1; then
            export DEBIAN_FRONTEND=noninteractive
            apt-get update -y && apt-get install -y fail2ban iptables || yum install -y fail2ban || true
        fi
        """
        run_ssh_command(client, install_cmd, timeout=90)

        # 2. Configura /etc/fail2ban/jail.local
        jail_local_content = f"""# Configurado automaticamente pelo AutoServer Deployer
[DEFAULT]
bantime = {bantime}
findtime = {findtime}
maxretry = {maxretry}
backend = systemd
banaction = iptables-multiport
banaction_allports = iptables-allports

[sshd]
enabled = true
port = {ssh_port}
filter = sshd
maxretry = {maxretry}
findtime = {findtime}
bantime = {bantime}
"""

        apply_config_cmd = f"""
        mkdir -p /etc/fail2ban/jail.d
        cat << 'EOF' > /etc/fail2ban/jail.local
{jail_local_content}EOF
        systemctl enable fail2ban
        systemctl restart fail2ban
        """
        run_ssh_command(client, apply_config_cmd, timeout=30)

        # 3. Salva no banco de dados local
        save_setting("fail2ban_maxretry", str(maxretry), host)
        save_setting("fail2ban_findtime", str(findtime), host)
        save_setting("fail2ban_bantime", str(bantime), host)
        save_setting("fail2ban_active", "true", host)

        return {
            "status": "success",
            "installed": True,
            "active": True,
            "maxretry": maxretry,
            "findtime": findtime,
            "bantime": bantime,
            "message": f"Fail2ban configurado com sucesso! Limite de {maxretry} tentativas a cada {findtime // 60} minutos (ban de {bantime // 60} min)."
        }

    except Exception as e:
        logger.error(f"[FAIL2BAN] Erro ao aplicar configuração: {e}")
        raise ValueError(f"Falha ao configurar o Fail2ban na VPS: {str(e)}")
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


def unban_ip(
    host: str,
    ip_to_unban: str,
    jail: str = "sshd",
    username: str = "root",
    port: int = 22,
    password: Optional[str] = None,
    key_id: Optional[int] = None,
    auth_type: str = "password"
) -> Dict[str, Any]:
    """
    Desbane um endereço IP que foi bloqueado pelo Fail2ban.
    """
    ip_to_unban = ip_to_unban.strip()
    if not ip_to_unban:
        raise ValueError("O endereço IP para desbanir não foi informado.")

    port = int(port or 22)
    logger.info(f"[FAIL2BAN] Desbanindo IP {ip_to_unban} (jail={jail}) em {username}@{host}:{port}")

    client = None
    try:
        client = get_ssh_client(
            host=host,
            username=username,
            password=password,
            key_id=key_id,
            port=port,
            timeout=15
        )

        unban_cmd = f"fail2ban-client set {jail} unbanip {ip_to_unban} || fail2ban-client unban {ip_to_unban} || true"
        res = run_ssh_command(client, unban_cmd, timeout=10)
        logger.info(f"[FAIL2BAN] Resultado unban: {res}")

        return {
            "status": "success",
            "ip": ip_to_unban,
            "message": f"Endereço IP {ip_to_unban} desbanido com sucesso!"
        }

    except Exception as e:
        logger.error(f"[FAIL2BAN] Erro ao desbanir IP {ip_to_unban}: {e}")
        raise ValueError(f"Não foi possível desbanir o IP na VPS: {str(e)}")
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


def toggle_fail2ban_service(
    host: str,
    enable: bool,
    username: str = "root",
    port: int = 22,
    password: Optional[str] = None,
    key_id: Optional[int] = None,
    auth_type: str = "password"
) -> Dict[str, Any]:
    """
    Inicia ou para o serviço do Fail2ban na VPS.
    """
    port = int(port or 22)
    action = "start" if enable else "stop"
    logger.info(f"[FAIL2BAN] Executando systemctl {action} fail2ban em {username}@{host}:{port}")

    client = None
    try:
        client = get_ssh_client(
            host=host,
            username=username,
            password=password,
            key_id=key_id,
            port=port,
            timeout=15
        )

        cmd = f"systemctl {action} fail2ban"
        run_ssh_command(client, cmd, timeout=15)
        save_setting("fail2ban_active", "true" if enable else "false", host)

        return {
            "status": "success",
            "active": enable,
            "message": "Proteção do Fail2ban ativada!" if enable else "Proteção do Fail2ban pausada."
        }

    except Exception as e:
        logger.error(f"[FAIL2BAN] Erro ao alterar estado do serviço: {e}")
        raise ValueError(f"Falha ao alterar estado do Fail2ban na VPS: {str(e)}")
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass
