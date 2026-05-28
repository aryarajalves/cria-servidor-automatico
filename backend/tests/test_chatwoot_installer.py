import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_chatwoot

class TestChatwootInstaller(unittest.TestCase):
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    @patch('app.database.get_next_install_id')
    @patch('app.services.web_apps.run_ssh_command')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.get_ssh_client')
    def test_install_chatwoot_placeholders(self, mock_ssh, mock_create_db, mock_deploy, mock_get_path, mock_run_ssh, mock_get_install_id, mock_exists, mock_file):
        # Setup mocks
        mock_exists.return_value = True
        yaml_content = """
        bucket: {Backblaze_Bucket_Name}
        key: {Backblaze_Key_ID}
        secret: {Backblaze_Application_Key}
        region: {Backblaze_Region}
        endpoint: {Backblaze_Endpoint}
        """
        mock_file.return_value.read.return_value = yaml_content
        
        # Setup outros mocks
        mock_get_install_id.return_value = "01"
        mock_get_path.side_effect = lambda x: x
        mock_ssh_client = MagicMock()
        mock_ssh.return_value = mock_ssh_client
        mock_run_ssh.return_value = "container_id"
        
        # Chama a função
        install_chatwoot(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            s3_bucket_name="my-bucket",
            s3_access_key_id="my-key",
            s3_secret_access_key="my-secret",
            s3_region="us-west-001",
            s3_endpoint="https://s3.us-west-001.backblazeb2.com",
            chatwoot_base_url="chat.example.com"
        )
        
        # Verifica se deploy_stack_remote foi chamado com o conteúdo correto
        # (Admin e Sidekiq)
        self.assertEqual(mock_deploy.call_count, 2)
        
        # Verifica o primeiro call (admin)
        admin_content = mock_deploy.call_args_list[0][0][2]
        self.assertIn("bucket: my-bucket", admin_content)
        self.assertIn("key: my-key", admin_content)
        self.assertIn("secret: my-secret", admin_content)
        self.assertIn("region: us-west-001", admin_content)
        self.assertIn("endpoint: https://s3.us-west-001.backblazeb2.com", admin_content)

if __name__ == '__main__':
    unittest.main()
