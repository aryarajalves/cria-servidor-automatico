import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_backup_chatwoo_rabbit

class TestBackupChatwooRabbitInstaller(unittest.TestCase):
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.run_ssh_command')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.get_setting')
    @patch('app.services.web_apps.get_stack_credentials')
    @patch('app.services.web_apps.get_stack_services')
    def test_install_backup_chatwoo_rabbit_explicit(self, mock_get_services, mock_get_creds, mock_get_setting, mock_create_db, mock_ssh, mock_deploy, mock_get_path, mock_run_ssh, mock_save_creds, mock_exists, mock_file):
        # Setup mocks
        mock_exists.return_value = True
        mock_get_services.return_value = []
        yaml_content = """
        version: "3.7"
        services:
          app:
            environment:
              - DATABASE_URL=postgresql://postgres:{Senha_Postgres}@postgres:5432/backup_manager
              - CHATWOOT_DB_PASSWORD={Senha_Postgres}
              - S3_ENDPOINT_URL={S3_Endpoint_URL}
              - S3_ACCESS_KEY_ID={S3_Access_Key_ID}
              - S3_SECRET_ACCESS_KEY={S3_Secret_Access_Key}
              - S3_BUCKET_NAME={S3_Bucket_Name}
              - RABBITMQ_HOST={RabbitMQ_Host}
              - RABBITMQ_MANAGEMENT_PORT={RabbitMQ_Management_Port}
              - RABBITMQ_USER={RabbitMQ_User}
              - RABBITMQ_PASSWORD={RabbitMQ_Password}
              - LOGIN_EMAIL={Login_Email}
              - LOGIN_PASSWORD={Login_Password}
              - JWT_SECRET={JWT_Secret}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        
        mock_ssh_client = MagicMock()
        mock_ssh.return_value = mock_ssh_client
        
        # Chama a função
        res = install_backup_chatwoo_rabbit(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_secure_password",
            base_url="https://backup.domain.com",
            s3_endpoint_url="s3.b2.com",
            s3_access_key_id="my_access_key",
            s3_secret_access_key="my_secret_key",
            s3_bucket_name="backup_bucket",
            rabbitmq_host="rabbitmq_explicit",
            rabbitmq_management_port=15672,
            rabbitmq_user="rabbit_admin",
            rabbitmq_password="rabbit_password",
            login_email="admin@example.com",
            login_password="admin_secure_password",
            jwt_secret="custom_jwt_secret"
        )
        
        # Verifica se create_postgres_database foi chamado para criar o banco backup_manager
        mock_create_db.assert_called_once_with(mock_ssh_client, "backup_manager")
        
        # Verifica se deploy_stack_remote foi chamado com o conteúdo correto
        mock_deploy.assert_called_once()
        deployed_content = mock_deploy.call_args[0][2]
        
        self.assertIn("postgres:pg_secure_password", deployed_content)
        self.assertIn("S3_ENDPOINT_URL=s3.b2.com", deployed_content)
        self.assertIn("S3_ACCESS_KEY_ID=my_access_key", deployed_content)
        self.assertIn("S3_SECRET_ACCESS_KEY=my_secret_key", deployed_content)
        self.assertIn("S3_BUCKET_NAME=backup_bucket", deployed_content)
        self.assertIn("RABBITMQ_HOST=rabbitmq_explicit", deployed_content)
        self.assertIn("RABBITMQ_MANAGEMENT_PORT=15672", deployed_content)
        self.assertIn("RABBITMQ_USER=rabbit_admin", deployed_content)
        self.assertIn("RABBITMQ_PASSWORD=rabbit_password", deployed_content)
        self.assertIn("LOGIN_EMAIL=admin@example.com", deployed_content)
        self.assertIn("LOGIN_PASSWORD=admin_secure_password", deployed_content)
        self.assertIn("JWT_SECRET=custom_jwt_secret", deployed_content)
        
        # Verifica o retorno
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["credentials"]["user"], "admin@example.com")
        self.assertEqual(res["credentials"]["password"], "admin_secure_password")

    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.run_ssh_command')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.get_setting')
    @patch('app.services.web_apps.get_stack_credentials')
    @patch('app.services.web_apps.get_stack_services')
    def test_install_backup_chatwoo_rabbit_defaults(self, mock_get_services, mock_get_creds, mock_get_setting, mock_create_db, mock_ssh, mock_deploy, mock_get_path, mock_run_ssh, mock_save_creds, mock_exists, mock_file):
        # Setup mocks
        mock_exists.return_value = True
        mock_get_services.return_value = []
        
        # Mock RabbitMQ settings / credentials
        mock_get_setting.side_effect = lambda key, host: "https://my-rabbit.shop" if key == "stack_domain_rabbitmq" else None
        mock_get_creds.side_effect = lambda host, name: {"user": "auto_rabbit_user", "password": "auto_rabbit_password"} if name == "rabbitmq" else None
        
        yaml_content = """
        version: "3.7"
        services:
          app:
            environment:
              - DATABASE_URL=postgresql://postgres:{Senha_Postgres}@postgres:5432/backup_manager
              - CHATWOOT_DB_PASSWORD={Senha_Postgres}
              - S3_ENDPOINT_URL={S3_Endpoint_URL}
              - S3_ACCESS_KEY_ID={S3_Access_Key_ID}
              - S3_SECRET_ACCESS_KEY={S3_Secret_Access_Key}
              - S3_BUCKET_NAME={S3_Bucket_Name}
              - RABBITMQ_HOST={RabbitMQ_Host}
              - RABBITMQ_MANAGEMENT_PORT={RabbitMQ_Management_Port}
              - RABBITMQ_USER={RabbitMQ_User}
              - RABBITMQ_PASSWORD={RabbitMQ_Password}
              - LOGIN_EMAIL={Login_Email}
              - LOGIN_PASSWORD={Login_Password}
              - JWT_SECRET={JWT_Secret}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        
        mock_ssh_client = MagicMock()
        mock_ssh.return_value = mock_ssh_client
        
        # Chama a função omitindo email, senha de login e detalhes do RabbitMQ
        res = install_backup_chatwoo_rabbit(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_secure_password",
            base_url="https://backup.domain.com",
            s3_endpoint_url="s3.b2.com",
            s3_access_key_id="my_access_key",
            s3_secret_access_key="my_secret_key",
            s3_bucket_name="backup_bucket",
            rabbitmq_host=None,
            rabbitmq_management_port=None,
            rabbitmq_user=None,
            rabbitmq_password=None,
            login_email=None,
            login_password=None,
            jwt_secret="custom_jwt_secret"
        )
        
        # Verifica se deploy_stack_remote foi chamado com o conteúdo correto
        mock_deploy.assert_called_once()
        deployed_content = mock_deploy.call_args[0][2]
        
        # Verifica se RabbitMQ auto-detectado foi injetado
        self.assertIn("RABBITMQ_HOST=my-rabbit.shop", deployed_content)
        self.assertIn("RABBITMQ_USER=auto_rabbit_user", deployed_content)
        self.assertIn("RABBITMQ_PASSWORD=auto_rabbit_password", deployed_content)
        
        # Verifica se e-mail padrão foi injetado
        self.assertIn("LOGIN_EMAIL=teste@gmail", deployed_content)
        
        # Verifica o retorno
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["credentials"]["user"], "teste@gmail")
        # Senha gerada aleatoriamente
        self.assertTrue(len(res["credentials"]["password"]) > 0)

    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.run_ssh_command')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.get_setting')
    @patch('app.services.web_apps.get_stack_credentials')
    @patch('app.services.web_apps.get_stack_services')
    def test_install_backup_chatwoo_rabbit_all_defaults(self, mock_get_services, mock_get_creds, mock_get_setting, mock_create_db, mock_ssh, mock_deploy, mock_get_path, mock_run_ssh, mock_save_creds, mock_exists, mock_file):
        # Setup mocks
        mock_exists.return_value = True
        mock_get_services.return_value = []
        
        # Mock RabbitMQ settings / credentials
        mock_get_setting.side_effect = lambda key, host: "https://my-rabbit.shop" if key == "stack_domain_rabbitmq" else None
        mock_get_creds.side_effect = lambda host, name: {"user": "auto_rabbit_user", "password": "auto_rabbit_password"} if name == "rabbitmq" else None
        
        yaml_content = """
        version: "3.7"
        services:
          app:
            environment:
              - DATABASE_URL=postgresql://postgres:{Senha_Postgres}@postgres:5432/backup_manager
              - CHATWOOT_DB_PASSWORD={Senha_Postgres}
              - S3_ENDPOINT_URL={S3_Endpoint_URL}
              - S3_ACCESS_KEY_ID={S3_Access_Key_ID}
              - S3_SECRET_ACCESS_KEY={S3_Secret_Access_Key}
              - S3_BUCKET_NAME={S3_Bucket_Name}
              - RABBITMQ_HOST={RabbitMQ_Host}
              - RABBITMQ_MANAGEMENT_PORT={RabbitMQ_Management_Port}
              - RABBITMQ_USER={RabbitMQ_User}
              - RABBITMQ_PASSWORD={RabbitMQ_Password}
              - LOGIN_EMAIL={Login_Email}
              - LOGIN_PASSWORD={Login_Password}
              - JWT_SECRET={JWT_Secret}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        
        mock_ssh_client = MagicMock()
        mock_ssh.return_value = mock_ssh_client
        
        # Chama a função omitindo TUDO exceto o base_url
        res = install_backup_chatwoo_rabbit(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_secure_password",
            base_url="https://backup.domain.com",
            s3_endpoint_url=None,
            s3_access_key_id=None,
            s3_secret_access_key=None,
            s3_bucket_name=None,
            rabbitmq_host=None,
            rabbitmq_management_port=None,
            rabbitmq_user=None,
            rabbitmq_password=None,
            login_email=None,
            login_password=None,
            jwt_secret="custom_jwt_secret"
        )
        
        # Verifica se deploy_stack_remote foi chamado com o conteúdo correto
        mock_deploy.assert_called_once()
        deployed_content = mock_deploy.call_args[0][2]
        
        # Verifica se os fallbacks S3 e RabbitMQ do backend foram usados
        self.assertIn("S3_ENDPOINT_URL=https://s3.us-west-004.backblazeb2.com", deployed_content)
        self.assertIn("S3_ACCESS_KEY_ID=0047daba280ace40000000019", deployed_content)
        self.assertIn("S3_SECRET_ACCESS_KEY=K004O4dV6WcJMazD2DwrUwAEE/OWiaY", deployed_content)
        self.assertIn("S3_BUCKET_NAME=zap-voice", deployed_content)
        self.assertIn("RABBITMQ_HOST=my-rabbit.shop", deployed_content)
        self.assertIn("LOGIN_EMAIL=teste@gmail", deployed_content)

if __name__ == '__main__':
    unittest.main()
