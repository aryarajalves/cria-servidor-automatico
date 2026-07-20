import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_oraculo

class TestOraculoInstaller(unittest.TestCase):
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('app.services.web_apps.get_stack_env_vars')
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_oraculo_new_install(self, mock_file, mock_exists, mock_get_stack_env, mock_get_env, mock_get_services, mock_get_path, mock_deploy, mock_create_db, mock_ssh):
        mock_exists.return_value = True
        yaml_content = """
        Senha_Postgres: {Senha_Postgres}
        Minio_User: {Minio_User}
        Minio_Password: {Minio_Password}
        Usuario_Rabbit: {Usuario_Rabbit}
        Senha_Rabbit: {Senha_Rabbit}
        OPENAI_API_KEY: {OPENAI_API_KEY}
        GEMINI_API_KEY: {GEMINI_API_KEY}
        ANTHROPIC_API_KEY: {ANTHROPIC_API_KEY}
        FAL_KEY: {FAL_KEY}
        ELEVENLABS_API_KEY: {ELEVENLABS_API_KEY}
        DASHBOARD_USER: {DASHBOARD_USER}
        DASHBOARD_USER_NAME: {DASHBOARD_USER_NAME}
        DASHBOARD_PASS: {DASHBOARD_PASS}
        JWT_SECRET: {JWT_SECRET}
        BaseUrl_Oraculo: {BaseUrl_Oraculo}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        mock_get_services.return_value = []
        
        def mock_get_env_side_effect(host, username, password, stack):
            if stack == "postgres":
                return {"POSTGRES_PASSWORD": "pg_pass_test"}
            elif stack == "rabbitmq":
                return {"RABBITMQ_DEFAULT_USER": "rabbit_user_test", "RABBITMQ_DEFAULT_PASS": "rabbit_pass_test"}
            elif stack == "minio":
                return {"MINIO_ROOT_USER": "minio_user_test", "MINIO_ROOT_PASSWORD": "minio_pass_test"}
            return {}
            
        mock_get_stack_env.side_effect = mock_get_env_side_effect
        
        result = install_oraculo(
            host="1.1.1.1",
            username="root",
            password="password",
            oraculo_domain="oraculo.test.com",
            openai_api_key="openai_key",
            gemini_api_key="gemini_key",
            anthropic_api_key="anthropic_key",
            fal_key="fal_key",
            elevenlabs_api_key="elevenlabs_key",
            dashboard_user="user@test.com",
            dashboard_pass="admin_pass",
            dashboard_user_name="SuperAdmin"
        )
        
        self.assertEqual(result['status'], 'success')
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("Senha_Postgres: pg_pass_test", deployed_content)
        self.assertIn("Minio_User: minio_user_test", deployed_content)
        self.assertIn("Minio_Password: minio_pass_test", deployed_content)
        self.assertIn("Usuario_Rabbit: rabbit_user_test", deployed_content)
        self.assertIn("Senha_Rabbit: rabbit_pass_test", deployed_content)
        self.assertIn("OPENAI_API_KEY: openai_key", deployed_content)
        self.assertIn("GEMINI_API_KEY: gemini_key", deployed_content)
        self.assertIn("ANTHROPIC_API_KEY: anthropic_key", deployed_content)
        self.assertIn("FAL_KEY: fal_key", deployed_content)
        self.assertIn("ELEVENLABS_API_KEY: elevenlabs_key", deployed_content)
        self.assertIn("DASHBOARD_USER: user@test.com", deployed_content)
        self.assertIn("DASHBOARD_PASS: admin_pass", deployed_content)
        self.assertIn("DASHBOARD_USER_NAME: SuperAdmin", deployed_content)
        self.assertIn("BaseUrl_Oraculo: oraculo.test.com", deployed_content)

if __name__ == '__main__':
    unittest.main()
