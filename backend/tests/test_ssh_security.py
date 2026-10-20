import pytest
from unittest.mock import patch, MagicMock
from app.services.ssh_security_service import get_password_auth_status, toggle_password_authentication
from app.database import save_setting, get_setting

def test_get_password_auth_status_from_sshd():
    with patch("app.services.ssh_security_service.get_ssh_client") as mock_get_client, \
         patch("app.services.ssh_security_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_run_cmd.return_value = "PasswordAuthentication no\n"

        res = get_password_auth_status(host="10.0.0.1", username="root", port=22)
        assert res["status"] == "success"
        assert res["password_auth_enabled"] is False
        assert get_setting("password_auth_enabled", "10.0.0.1") == "false"

def test_get_password_auth_status_fallback_on_error():
    with patch("app.services.ssh_security_service.get_ssh_client", side_effect=Exception("Timeout")):
        save_setting("password_auth_enabled", "false", "10.0.0.2")
        res = get_password_auth_status(host="10.0.0.2", username="root", port=22)
        assert res["status"] == "warning"
        assert res["password_auth_enabled"] is False

def test_toggle_password_authentication_disable_success():
    with patch("app.services.ssh_security_service.get_ssh_client") as mock_get_client, \
         patch("app.services.ssh_security_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_run_cmd.return_value = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5..."

        res = toggle_password_authentication(
            host="10.0.0.3",
            username="root",
            enabled=False,
            port=22022,
            key_id=1
        )
        assert res["status"] == "success"
        assert res["password_auth_enabled"] is False
        assert get_setting("password_auth_enabled", "10.0.0.3") == "false"

def test_toggle_password_authentication_lockout_prevented():
    with patch("app.services.ssh_security_service.get_ssh_client") as mock_get_client, \
         patch("app.services.ssh_security_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        # Simula ausência de chaves
        mock_run_cmd.return_value = "NO_KEYS"

        with pytest.raises(ValueError) as exc:
            toggle_password_authentication(
                host="10.0.0.4",
                username="root",
                enabled=False,
                port=22,
                key_id=None
            )
        assert "Segurança" in str(exc.value)

def test_toggle_password_authentication_enable_success():
    with patch("app.services.ssh_security_service.get_ssh_client") as mock_get_client, \
         patch("app.services.ssh_security_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_run_cmd.return_value = ""

        res = toggle_password_authentication(
            host="10.0.0.5",
            username="root",
            enabled=True,
            port=22
        )
        assert res["status"] == "success"
        assert res["password_auth_enabled"] is True
        assert get_setting("password_auth_enabled", "10.0.0.5") == "true"
