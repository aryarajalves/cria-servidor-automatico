import pytest
from unittest.mock import patch, MagicMock
from app.services.base_ssh import probe_ssh_port, detect_active_ssh_port, get_ssh_client
from app.database import add_server, get_server_by_host, update_server

def test_probe_ssh_port_success():
    with patch("socket.socket") as mock_sock_cls:
        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 0
        mock_sock.recv.return_value = b"SSH-2.0-OpenSSH_9.2p1 Debian\r\n"
        mock_sock_cls.return_value = mock_sock

        assert probe_ssh_port("1.2.3.4", 22) is True

def test_probe_ssh_port_connection_refused():
    with patch("socket.socket") as mock_sock_cls:
        mock_sock = MagicMock()
        mock_sock.connect_ex.return_value = 111  # Connection refused
        mock_sock_cls.return_value = mock_sock

        assert probe_ssh_port("1.2.3.4", 22) is False

def test_detect_active_ssh_port_finds_open_port():
    host = "test-detect-host.com"
    add_server("Detect Server", host, "root", "secret", port=22)

    # Simula porta 22 fechada e porta 22022 aberta
    def fake_probe(h, p, timeout=1.5):
        return p == 22022

    with patch("app.services.base_ssh.probe_ssh_port", side_effect=fake_probe):
        active = detect_active_ssh_port(host, candidate_ports=[22, 22022])
        assert active == 22022

def test_detect_active_ssh_port_none_found():
    host = "test-unreachable-host.com"
    with patch("app.services.base_ssh.probe_ssh_port", return_value=False):
        active = detect_active_ssh_port(host, candidate_ports=[22, 22022])
        assert active is None

@patch("app.services.base_ssh.detect_active_ssh_port", return_value=22022)
@patch("paramiko.SSHClient")
def test_get_ssh_client_auto_recovers_and_syncs_db(mock_client_cls, mock_detect):
    host = "test-autorecover-host.com"
    add_server("AutoRecover VPS", host, "root", "secret", port=22)

    mock_client = MagicMock()
    # Primeira chamada na porta 22 falha com timeout/NoValidConnectionsError
    # Segunda chamada na porta 22022 tem sucesso
    def fake_connect(**kwargs):
        if kwargs.get("port") == 22:
            raise Exception("Unable to connect to port 22")
        # Porta 22022 passa
        return None

    mock_client.connect.side_effect = fake_connect
    mock_client_cls.return_value = mock_client

    client = get_ssh_client(host=host, username="root", password="secret", port=22, auto_detect_port=True)
    assert client is not None
    mock_detect.assert_called_once()

    # Verifica se o banco foi atualizado para a porta detectada (22022)
    server = get_server_by_host(host)
    assert server["port"] == 22022
