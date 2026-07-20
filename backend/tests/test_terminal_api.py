import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from app.main import app

class TestTerminalAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch('app.services.base_ssh.get_ssh_client')
    def test_run_command_success(self, mock_get_ssh):
        # Configura mocks para conexão SSH e comandos de sucesso
        mock_ssh_client = MagicMock()
        mock_get_ssh.return_value = mock_ssh_client
        
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 0
        mock_stdout.read.return_value = b"docker ps output"
        
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b""
        
        mock_ssh_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)
        
        payload = {
            "host": "1.2.3.4",
            "username": "root",
            "password": "my-password",
            "command": "docker ps"
        }
        
        response = self.client.post("/servers/run-command", json=payload)
        
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data["exit_status"], 0)
        self.assertEqual(json_data["output"], "docker ps output")
        self.assertEqual(json_data["error"], "")
        
        # Verifica se o cliente SSH foi fechado
        mock_ssh_client.close.assert_called_once()

    @patch('app.services.base_ssh.get_ssh_client')
    def test_run_command_failure(self, mock_get_ssh):
        # Configura mocks para conexão SSH e comandos de erro
        mock_ssh_client = MagicMock()
        mock_get_ssh.return_value = mock_ssh_client
        
        mock_stdout = MagicMock()
        mock_stdout.channel.recv_exit_status.return_value = 127
        mock_stdout.read.return_value = b""
        
        mock_stderr = MagicMock()
        mock_stderr.read.return_value = b"command not found"
        
        mock_ssh_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)
        
        payload = {
            "host": "1.2.3.4",
            "username": "root",
            "password": "my-password",
            "command": "invalidcmd"
        }
        
        response = self.client.post("/servers/run-command", json=payload)
        
        self.assertEqual(response.status_code, 200)
        json_data = response.json()
        self.assertEqual(json_data["exit_status"], 127)
        self.assertEqual(json_data["output"], "")
        self.assertEqual(json_data["error"], "command not found")
        
        # Verifica se o cliente SSH foi fechado
        mock_ssh_client.close.assert_called_once()

if __name__ == '__main__':
    unittest.main()
