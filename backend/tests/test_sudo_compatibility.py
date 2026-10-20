import pytest
from unittest.mock import MagicMock
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.base_ssh import normalize_ssh_command, run_ssh_command

def test_normalize_ssh_command_without_sudo():
    cmd = "docker ps -a"
    normalized = normalize_ssh_command(cmd)
    assert normalized == "docker ps -a"

def test_normalize_ssh_command_with_sudo():
    cmd = "sudo DEBIAN_FRONTEND=noninteractive apt-get update"
    normalized = normalize_ssh_command(cmd)
    assert "command -v sudo" in normalized
    assert "sudo() {" in normalized
    assert cmd in normalized

def test_run_ssh_command_uses_normalized_command():
    mock_client = MagicMock()
    mock_stdout = MagicMock()
    mock_stderr = MagicMock()
    mock_channel = MagicMock()

    mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)
    mock_stdout.channel = mock_channel
    mock_channel.recv_exit_status.return_value = 0
    mock_stdout.read.return_value = b"success output\n"
    mock_stderr.read.return_value = b""

    out = run_ssh_command(mock_client, "sudo systemctl restart docker")
    assert out == "success output"

    # Verifica que exec_command recebeu o comando normalizado com fallback
    called_cmd = mock_client.exec_command.call_args[0][0]
    assert "command -v sudo" in called_cmd
    assert "sudo systemctl restart docker" in called_cmd
