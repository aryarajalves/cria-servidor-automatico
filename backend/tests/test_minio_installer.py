import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_minio

class TestMinioInstaller(unittest.TestCase):
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    @patch('app.services.database_apps.save_stack_credentials')
    @patch('app.services.database_apps.run_ssh_command')
    @patch('app.services.database_apps.get_stack_path')
    @patch('app.services.database_apps.deploy_stack_remote')
    @patch('app.services.database_apps.get_ssh_client')
    def test_install_minio_placeholders(self, mock_ssh, mock_deploy, mock_get_path, mock_run_ssh, mock_save_creds, mock_exists, mock_file):
        # Setup mocks
        mock_exists.return_value = True
        yaml_content = """
        user: {Minio_User}
        pass: {Minio_Password}
        console: {BaseUrl_Minio_Console}
        api: {BaseUrl_Minio_Api}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        
        mock_ssh_client = MagicMock()
        mock_ssh.return_value = mock_ssh_client
        mock_run_ssh.return_value = "volume_created"
        
        # Chama a função
        install_minio(
            host="1.1.1.1",
            username="root",
            password="password",
            minio_root_user="admin_user",
            minio_root_password="admin_password",
            minio_console_url="https://console.example.com",
            minio_server_url="https://s3.example.com"
        )
        
        # Verifica se deploy_stack_remote foi chamado com o conteúdo correto
        mock_deploy.assert_called_once()
        deployed_content = mock_deploy.call_args[0][2]
        
        self.assertIn("user: admin_user", deployed_content)
        self.assertIn("pass: admin_password", deployed_content)
        self.assertIn("console: console.example.com", deployed_content)
        self.assertIn("api: s3.example.com", deployed_content)
        
        # Verifica se o volume foi criado
        mock_run_ssh.assert_called_once_with(mock_ssh_client, "docker volume create minio_data")
        
        # Verifica se as credenciais foram salvas
        mock_save_creds.assert_called_once_with("1.1.1.1", "minio", "admin_user", "admin_password")

if __name__ == '__main__':
    unittest.main()
