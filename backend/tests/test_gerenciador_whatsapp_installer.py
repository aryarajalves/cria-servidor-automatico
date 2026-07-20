import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_gerenciador_whatsapp

class TestGerenciadorWhatsAppInstaller(unittest.TestCase):
    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_gerenciador_whatsapp_new_install(self, mock_file, mock_exists, mock_get_env, mock_get_services, mock_get_path, mock_deploy, mock_create_db, mock_ssh, mock_save_creds):
        # Setup mocks
        mock_exists.return_value = True
        yaml_content = """
        DATABASE_URL: {Senha_Postgres}
        API_SECRET: {API_SECRET}
        EMAIL: {SUPER_ADMIN_EMAIL}
        PASSWORD: {SUPER_ADMIN_PASSWORD}
        BACKEND: {BACKEND_DOMAIN}
        FRONTEND: {FRONTEND_DOMAIN}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        mock_get_services.return_value = [] # Stack não existe
        
        # Chama a função
        result = install_gerenciador_whatsapp(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            super_admin_email="admin@test.com",
            backend_domain="api.test.com",
            frontend_domain="front.test.com"
        )
        
        # Verifica se gerou senhas limpas (vazias) para o retorno
        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['credentials']['user'], '')
        self.assertEqual(result['credentials']['password'], '') 
        
        # Verifica deploy
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("DATABASE_URL: pg_password", deployed_content)
        self.assertIn("EMAIL: admin@test.com", deployed_content)
        self.assertIn("BACKEND: api.test.com", deployed_content)
        self.assertIn("FRONTEND: front.test.com", deployed_content)
        
        # Verifica que NÃO salvou no banco
        mock_save_creds.assert_not_called()

    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_gerenciador_whatsapp_reuse_secrets(self, mock_file, mock_exists, mock_get_env, mock_get_services, mock_get_path, mock_deploy, mock_create_db, mock_ssh, mock_save_creds):
        # Setup mocks
        mock_exists.return_value = True
        yaml_content = "{API_SECRET} {SUPER_ADMIN_PASSWORD} {SUPER_ADMIN_EMAIL}"
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        
        # Simula stack existente
        mock_get_services.return_value = ["gerenciador_whatsapp_backend"]
        mock_get_env.return_value = {
            "API_SECRET": "EXISTING_SECRET",
            "SUPER_ADMIN_PASSWORD": "EXISTING_PASSWORD_22_CH",
            "SUPER_ADMIN_EMAIL": "existing@email.com"
        }
        
        # Chama a função
        result = install_gerenciador_whatsapp(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            super_admin_email="admin@test.com",
            backend_domain="api.test.com",
            frontend_domain="front.test.com"
        )
        
        # Verifica se as credenciais retornadas são limpas (vazias)
        self.assertEqual(result['credentials']['user'], '')
        self.assertEqual(result['credentials']['password'], '')
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("EXISTING_SECRET EXISTING_PASSWORD_22_CH", deployed_content)
        self.assertIn("existing@email.com", deployed_content)
        
        # Verifica que NÃO salvou no banco
        mock_save_creds.assert_not_called()

if __name__ == '__main__':
    unittest.main()
