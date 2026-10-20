import pytest
from unittest.mock import patch, MagicMock
from app.services.ssh_port_service import validate_ssh_port, change_vps_ssh_port, update_ssh_port_local
from app.database import add_server, get_server_by_host, update_server

def test_validate_ssh_port():
    assert validate_ssh_port(22) == 22
    assert validate_ssh_port("2222") == 2222
    assert validate_ssh_port(65535) == 65535

    # Inválidos
    with pytest.raises(ValueError, match="intervalo entre 1 e 65535"):
        validate_ssh_port(0)

    with pytest.raises(ValueError, match="intervalo entre 1 e 65535"):
        validate_ssh_port(70000)

    with pytest.raises(ValueError, match="número inteiro válido"):
        validate_ssh_port("invalid")

    # Reservados
    with pytest.raises(ValueError, match="reservada"):
        validate_ssh_port(80)

    with pytest.raises(ValueError, match="reservada"):
        validate_ssh_port(443)

def test_update_ssh_port_local():
    host = "test-port-host.com"
    add_server("Test Port Server", host, "root", "secret", port=22)
    
    res = update_ssh_port_local(host, 22022)
    assert res["status"] == "success"
    assert res["port"] == 22022

    server = get_server_by_host(host)
    assert server["port"] == 22022

def test_update_ssh_port_local_creates_if_not_exists():
    host = "test-new-port-upsert.com"
    res = update_ssh_port_local(host, 5022, username="root", password="mypassword")
    assert res["status"] == "success"
    assert res["port"] == 5022

    server = get_server_by_host(host)
    assert server is not None
    assert server["port"] == 5022
    assert server["host"] == host

@patch("app.services.ssh_port_service.verify_ssh_connection", return_value=True)
@patch("app.services.ssh_port_service.get_ssh_client")
def test_change_vps_ssh_port_success(mock_get_client, mock_verify):
    mock_client = MagicMock()
    mock_stdout = MagicMock()
    mock_stdout.channel.recv_exit_status.return_value = 0
    mock_stdout.read.return_value = b"success"
    mock_stderr = MagicMock()
    mock_stderr.read.return_value = b""
    mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)
    mock_get_client.return_value = mock_client

    host = "test-change-port.com"
    add_server("Change Port VPS", host, "root", "secret", port=22)

    res = change_vps_ssh_port(
        host=host,
        username="root",
        new_port=2222,
        current_port=22,
        password="secret"
    )

    assert res["status"] == "success"
    assert res["port"] == 2222
    mock_verify.assert_called_once_with(
        host=host,
        username="root",
        password="secret",
        key_id=None,
        port=2222
    )

    server = get_server_by_host(host)
    assert server["port"] == 2222

@patch("app.services.ssh_port_service.verify_ssh_connection", return_value=False)
@patch("app.services.ssh_port_service.get_ssh_client")
def test_change_vps_ssh_port_verification_fails(mock_get_client, mock_verify):
    mock_client = MagicMock()
    mock_stdout = MagicMock()
    mock_stdout.channel.recv_exit_status.return_value = 0
    mock_stdout.read.return_value = b"success"
    mock_stderr = MagicMock()
    mock_stderr.read.return_value = b""
    mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)
    mock_get_client.return_value = mock_client

    host = "test-fail-port.com"
    add_server("Fail Port VPS", host, "root", "secret", port=22)

    with pytest.raises(ValueError, match="conexão de teste na porta 2222 não respondeu"):
        change_vps_ssh_port(
            host=host,
            username="root",
            new_port=2222,
            current_port=22,
            password="secret"
        )
