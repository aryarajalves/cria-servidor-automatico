import pytest
from unittest.mock import patch, MagicMock
from app.services.fail2ban_service import (
    parse_banned_ips,
    get_fail2ban_status,
    install_and_configure_fail2ban,
    unban_ip,
    toggle_fail2ban_service
)
from app.database import get_setting, save_setting

def test_parse_banned_ips():
    sample_output = """
Status for the jail: sshd
|- Filter
|  |- Currently failed: 2
|  |- Total failed:     10
`- Actions
   |- Currently banned: 2
   |- Total banned:     5
   `- Banned IP list:   192.168.1.100 10.0.0.50
"""
    ips = parse_banned_ips(sample_output)
    assert ips == ["192.168.1.100", "10.0.0.50"]

def test_get_fail2ban_status_installed_and_active():
    with patch("app.services.fail2ban_service.get_ssh_client") as mock_get_client, \
         patch("app.services.fail2ban_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        def side_effect(client, cmd, timeout=10):
            if "which fail2ban-client" in cmd:
                return "/usr/bin/fail2ban-client"
            if "systemctl is-active fail2ban" in cmd:
                return "active"
            if "fail2ban-client status sshd" in cmd:
                return "   `- Banned IP list:   1.2.3.4"
            if "fail2ban-client status" in cmd:
                return "Jail list: sshd"
            return ""

        mock_run_cmd.side_effect = side_effect

        res = get_fail2ban_status(host="10.0.0.1", username="root", port=22)
        assert res["status"] == "success"
        assert res["installed"] is True
        assert res["active"] is True
        assert res["jails"] == ["sshd"]
        assert len(res["banned_ips"]) == 1
        assert res["banned_ips"][0]["ip"] == "1.2.3.4"

def test_install_and_configure_fail2ban():
    with patch("app.services.fail2ban_service.get_ssh_client") as mock_get_client, \
         patch("app.services.fail2ban_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_run_cmd.return_value = ""

        res = install_and_configure_fail2ban(
            host="10.0.0.2",
            username="root",
            maxretry=5,
            findtime=600,
            bantime=3600,
            ssh_port=22022
        )
        assert res["status"] == "success"
        assert res["maxretry"] == 5
        assert res["findtime"] == 600
        assert get_setting("fail2ban_maxretry", "10.0.0.2") == "5"

def test_unban_ip_success():
    with patch("app.services.fail2ban_service.get_ssh_client") as mock_get_client, \
         patch("app.services.fail2ban_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_run_cmd.return_value = "1.2.3.4"

        res = unban_ip(host="10.0.0.3", ip_to_unban="1.2.3.4")
        assert res["status"] == "success"
        assert res["ip"] == "1.2.3.4"

def test_toggle_fail2ban_service():
    with patch("app.services.fail2ban_service.get_ssh_client") as mock_get_client, \
         patch("app.services.fail2ban_service.run_ssh_command") as mock_run_cmd:
        
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_run_cmd.return_value = ""

        res = toggle_fail2ban_service(host="10.0.0.4", enable=True)
        assert res["status"] == "success"
        assert res["active"] is True
        assert get_setting("fail2ban_active", "10.0.0.4") == "true"
