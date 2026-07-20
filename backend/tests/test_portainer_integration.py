import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.base_ssh import deploy_stack_remote

class TestPortainerIntegration(unittest.TestCase):
    @patch('app.database.get_setting')
    @patch('app.services.base_ssh.run_ssh_command')
    @patch('app.services.base_ssh.tempfile.NamedTemporaryFile')
    @patch('os.path.exists')
    @patch('os.remove')
    def test_deploy_stack_fallback_to_ssh(self, mock_remove, mock_exists, mock_temp, mock_run_ssh, mock_get_setting):
        # Quando as configurações do Portainer não estão preenchidas, deve fazer deploy via SSH
        mock_get_setting.return_value = None
        mock_exists.return_value = True
        
        # Mocks para SSH SFTP
        mock_client = MagicMock()
        mock_client.get_transport().getpeername.return_value = ("1.2.3.4", 22)
        mock_sftp = MagicMock()
        mock_client.open_sftp.return_value = mock_sftp
        
        result = deploy_stack_remote(mock_client, "test_stack", "stack_content")
        
        # Deve ter chamado get_setting duas vezes (user e password)
        self.assertEqual(mock_get_setting.call_count, 2)
        
        # Deve executar o comando de deploy via SSH
        mock_run_ssh.assert_called_once()
        self.assertIn("docker stack deploy", mock_run_ssh.call_args[0][1])
        self.assertEqual(result["status"], "success")

    @patch('app.database.get_setting')
    @patch('app.portainer.get_portainer_token')
    @patch('app.portainer.get_first_swarm_endpoint_id')
    @patch('app.portainer.deploy_stack_portainer')
    @patch('app.services.base_ssh.run_ssh_command')
    def test_deploy_stack_via_portainer_api(self, mock_run_ssh, mock_deploy_portainer, mock_get_endpoint, mock_get_token, mock_get_setting):
        # Quando Portainer está configurado, deve tentar deploy via API do Portainer
        mock_get_setting.side_effect = lambda key, host: "admin" if key == "portainer_user" else "my_pass"
        mock_get_token.return_value = "jwt_token"
        mock_get_endpoint.return_value = 1
        mock_deploy_portainer.return_value = {"status": "success", "message": "Success"}
        
        mock_client = MagicMock()
        mock_client.get_transport().getpeername.return_value = ("1.2.3.4", 22)
        
        result = deploy_stack_remote(mock_client, "test_stack", "stack_content")
        
        # Deve chamar a autenticação e deploy do Portainer
        mock_get_token.assert_called_once()
        mock_get_endpoint.assert_called_once()
        mock_deploy_portainer.assert_called_once()
        
        # NÃO deve rodar comando de deploy via SSH
        mock_run_ssh.assert_not_called()
        self.assertEqual(result["status"], "success")
        self.assertIn("via Portainer API", result["message"])

if __name__ == '__main__':
    unittest.main()
