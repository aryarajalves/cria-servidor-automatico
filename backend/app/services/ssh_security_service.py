import logging
import time
from typing import Optional, Dict, Any
from app.services.base_ssh import get_ssh_client, run_ssh_command
from app.database import get_setting, save_setting, get_server_by_host

logger = logging.getLogger(__name__)

def get_password_auth_status(
    host: str,
    username: str,
    port: int = 22,
    password: Optional[str] = None,
    key_id: Optional[int] = None,
    auth_type: str = "password"
) -> Dict[str, Any]:
    """
    Verifica o status atual da autenticação por senha diretamente na VPS através do sshd -T.
    """
    port = int(port or 22)
    logger.info(f"[SSH SECURITY] Consultando status de autenticação por senha em {username}@{host}:{port}")

    # Fallback inicial via banco de dados
    db_status = get_setting("password_auth_enabled", host)
    enabled_default = True if db_status is None else (db_status.lower() == "true")

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

        # Consulta configuração efetiva do SSH daemon
        cmd = "sshd -T 2>/dev/null | grep -i '^passwordauthentication' || echo 'unknown'"
        output = run_ssh_command(client, cmd, timeout=10).strip().lower()

        logger.info(f"[SSH SECURITY] Resposta sshd -T: '{output}'")

        if "passwordauthentication no" in output:
            is_enabled = False
        elif "passwordauthentication yes" in output:
            is_enabled = True
        else:
            is_enabled = enabled_default

        # Sincroniza com o banco de dados
        save_setting("password_auth_enabled", "true" if is_enabled else "false", host)

        actual_port = port
        try:
            peer = client.get_transport().getpeername()
            if peer and len(peer) > 1:
                actual_port = peer[1]
        except Exception:
            pass

        return {
            "status": "success",
            "host": host,
            "port": actual_port,
            "password_auth_enabled": is_enabled,
            "message": "Autenticação por senha ativa na VPS." if is_enabled else "Autenticação por senha desativada (Apenas Chaves SSH)."
        }

    except Exception as e:
        logger.warning(f"[SSH SECURITY] Não foi possível consultar a VPS ao vivo ({e}). Usando status local.")
        return {
            "status": "warning",
            "host": host,
            "port": port,
            "password_auth_enabled": enabled_default,
            "message": f"Status obtido do banco local (VPS inacessível no momento: {str(e)})"
        }
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


def toggle_password_authentication(
    host: str,
    username: str,
    enabled: bool,
    port: int = 22,
    password: Optional[str] = None,
    key_id: Optional[int] = None,
    auth_type: str = "password"
) -> Dict[str, Any]:
    """
    Ativa ou desativa a autenticação por senha no serviço SSH da VPS.
    
    Se enabled == False:
      1. Verifica se há uma chave SSH pública funcional ou autorizada para evitar lockout.
      2. Configura /etc/ssh/sshd_config.d/99-autoserver-security.conf com PasswordAuthentication no.
      3. Valida a sintaxe com sshd -t.
      4. Recarrega o serviço SSH.
      5. Salva a configuração no banco.
    """
    port = int(port or 22)
    action_desc = "Ativando" if enabled else "Desativando"
    logger.info(f"[SSH SECURITY] {action_desc} autenticação por senha para {username}@{host}:{port}")

    client = None
    try:
        client = get_ssh_client(
            host=host,
            username=username,
            password=password,
            key_id=key_id,
            port=port,
            timeout=20
        )
    except Exception as e:
        logger.error(f"[SSH SECURITY] Falha ao conectar na VPS: {e}")
        raise ValueError(f"Não foi possível conectar à VPS para alterar as configurações SSH: {str(e)}")

    try:
        # 1. Se estiver desativando a senha, checa se existe pelo menos uma chave autorizada
        if not enabled:
            check_keys_cmd = "test -s ~/.ssh/authorized_keys || test -s /root/.ssh/authorized_keys || echo 'NO_KEYS'"
            keys_check = run_ssh_command(client, check_keys_cmd, timeout=10).strip()
            if "NO_KEYS" in keys_check and not key_id:
                raise ValueError(
                    "Segurança: Nenhuma Chave SSH pública foi detectada no servidor (~/.ssh/authorized_keys). "
                    "Desativar a senha agora causaria perda permanente de acesso à VPS. "
                    "Vincule uma Chave SSH antes de desativar a senha."
                )

        # 2. Backup do sshd_config
        run_ssh_command(client, "cp -n /etc/ssh/sshd_config /etc/ssh/sshd_config.bak_security || true", timeout=10)

        # 3. Configura diretiva no arquivo dedicado de drop-in com prioridade máxima (00-)
        val_str = "yes" if enabled else "no"
        config_content = f"""# Gerenciado pelo AutoServer Deployer
PasswordAuthentication {val_str}
KbdInteractiveAuthentication {val_str}
ChallengeResponseAuthentication {val_str}
PubkeyAuthentication yes
"""

        apply_config_cmd = f"""
        mkdir -p /etc/ssh/sshd_config.d
        cat << 'EOF' > /etc/ssh/sshd_config.d/00-autoserver-security.conf
{config_content}EOF
        chmod 644 /etc/ssh/sshd_config.d/00-autoserver-security.conf
        rm -f /etc/ssh/sshd_config.d/99-autoserver-security.conf
        if [ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ]; then
            sed -i -E 's/PasswordAuthentication\\s+(yes|no)/PasswordAuthentication {val_str}/gI' /etc/ssh/sshd_config.d/50-cloud-init.conf || true
        fi
        sed -i -E 's/^#?PasswordAuthentication\\s+(yes|no)/PasswordAuthentication {val_str}/gI' /etc/ssh/sshd_config || true
        """
        run_ssh_command(client, apply_config_cmd, timeout=15)

        # 4. Testa a sintaxe da configuração
        check_syntax = run_ssh_command(client, "sshd -t || /usr/sbin/sshd -t", timeout=10)
        logger.info(f"[SSH SECURITY] Validação de sintaxe: {check_syntax}")

        # 5. Reinicia o serviço SSH para aplicar efetivamente
        restart_cmd = "systemctl restart ssh || systemctl restart sshd || service ssh restart || service sshd restart"
        run_ssh_command(client, restart_cmd, timeout=15)

        # 6. Salva no banco de dados local
        save_setting("password_auth_enabled", "true" if enabled else "false", host)

        actual_port = port
        try:
            peer = client.get_transport().getpeername()
            if peer and len(peer) > 1:
                actual_port = peer[1]
        except Exception:
            pass

        msg = "Autenticação por senha ativada com sucesso na VPS." if enabled else "Autenticação por senha desativada com sucesso! Acesso agora permitido apenas por Chave SSH."
        return {
            "status": "success",
            "host": host,
            "port": actual_port,
            "password_auth_enabled": enabled,
            "message": msg
        }

    except ValueError:
        raise
    except Exception as e:
        logger.error(f"[SSH SECURITY] Erro ao aplicar configuração na VPS: {e}")
        # Rollback se necessário
        try:
            run_ssh_command(client, "rm -f /etc/ssh/sshd_config.d/00-autoserver-security.conf && systemctl restart ssh || systemctl restart sshd", timeout=10)
        except Exception:
            pass
        raise ValueError(f"Falha ao reconfigurar a segurança do SSH na VPS: {str(e)}")
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass
