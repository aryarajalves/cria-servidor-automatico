import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_zapvoice

class TestZapVoiceInstaller(unittest.TestCase):
    @patch('app.services.web_apps.get_setting')
    @patch('app.services.web_apps.get_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('app.services.web_apps.get_stack_env_vars')
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_zapvoice_new_install(self, mock_file, mock_exists, mock_get_stack_env, mock_get_env, mock_get_services, mock_get_path, mock_deploy, mock_create_db, mock_ssh, mock_get_creds, mock_get_setting):
        mock_exists.return_value = True
        yaml_content = """
        Senha_Postgres: {Senha_Postgres}
        BaseUrl_ZapVoice: {BaseUrl_ZapVoice}
        Secret_Key: {Secret_Key}
        SUPER_ADMIN_EMAIL: {SUPER_ADMIN_EMAIL}
        SUPER_ADMIN_PASSWORD: {SUPER_ADMIN_PASSWORD}
        Minio_Endpoint: {Minio_Endpoint}
        Minio_User: {Minio_User}
        Minio_Password: {Minio_Password}
        Minio_Public_Url: {Minio_Public_Url}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        mock_get_services.return_value = []
        
        # Mock behavior for rabbitmq and minio env vars
        def side_effect_get_stack_env(h, u, p, stack_name):
            if stack_name == "rabbitmq":
                return {"RABBITMQ_DEFAULT_USER": "guest", "RABBITMQ_DEFAULT_PASS": "guest"}
            elif stack_name == "minio":
                return {"MINIO_ROOT_USER": "minio_admin", "MINIO_ROOT_PASSWORD": "minio_password"}
            return {}
        mock_get_stack_env.side_effect = side_effect_get_stack_env
        mock_get_setting.return_value = "minio-api.test.com,minio-console.test.com"
        mock_get_creds.return_value = None
        
        result = install_zapvoice(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            zapvoice_base_url="zap.test.com",
            super_admin_email="admin@test.com"
        )
        
        self.assertEqual(result['status'], 'success')
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("Senha_Postgres: pg_password", deployed_content)
        self.assertIn("BaseUrl_ZapVoice: zap.test.com", deployed_content)
        self.assertIn("SUPER_ADMIN_EMAIL: admin@test.com", deployed_content)
        self.assertIn("Minio_User: minio_admin", deployed_content)
        self.assertIn("Minio_Password: minio_password", deployed_content)
        self.assertIn("Minio_Endpoint: https://minio-api.test.com", deployed_content)
        self.assertIn("Minio_Public_Url: https://minio-api.test.com", deployed_content)

    @patch('app.services.web_apps.get_setting')
    @patch('app.services.web_apps.get_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('app.services.web_apps.get_stack_env_vars')
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_zapvoice_reuse_existing(self, mock_file, mock_exists, mock_get_stack_env, mock_get_env, mock_get_services, mock_get_path, mock_deploy, mock_create_db, mock_ssh, mock_get_creds, mock_get_setting):
        mock_exists.return_value = True
        yaml_content = """
        Senha_Postgres: {Senha_Postgres}
        SUPER_ADMIN_EMAIL: {SUPER_ADMIN_EMAIL}
        SUPER_ADMIN_PASSWORD: {SUPER_ADMIN_PASSWORD}
        Secret_Key: {Secret_Key}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        
        mock_get_services.return_value = ["zapvoice_app"]
        mock_get_env.return_value = {
            "SUPER_ADMIN_EMAIL": "existing_zap@email.com",
            "SUPER_ADMIN_PASSWORD": "existing_password_zap",
            "SECRET_KEY": "existing_secret_key"
        }
        
        # Mock behavior for rabbitmq and minio env vars
        def side_effect_get_stack_env(h, u, p, stack_name):
            if stack_name == "rabbitmq":
                return {"RABBITMQ_DEFAULT_USER": "guest", "RABBITMQ_DEFAULT_PASS": "guest"}
            elif stack_name == "minio":
                return {"MINIO_ROOT_USER": "minio_admin", "MINIO_ROOT_PASSWORD": "minio_password"}
            return {}
        mock_get_stack_env.side_effect = side_effect_get_stack_env
        mock_get_setting.return_value = "minio-api.test.com,minio-console.test.com"
        mock_get_creds.return_value = None
        
        result = install_zapvoice(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            zapvoice_base_url="zap.test.com",
            super_admin_email="new@test.com"
        )
        
        self.assertEqual(result['status'], 'success')
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("SUPER_ADMIN_EMAIL: existing_zap@email.com", deployed_content)
        self.assertIn("SUPER_ADMIN_PASSWORD: existing_password_zap", deployed_content)
        self.assertIn("Secret_Key: existing_secret_key", deployed_content)

if __name__ == '__main__':
    unittest.main()
