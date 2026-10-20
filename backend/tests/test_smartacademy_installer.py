import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_smartacademy
from fastapi.testclient import TestClient
from app.main import app

class TestSmartAcademyInstaller(unittest.TestCase):
    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_smartacademy_new_install_creates_smartacademy_db(
        self, mock_file, mock_get_env, mock_get_services, mock_get_path,
        mock_deploy, mock_create_db, mock_ssh, mock_save_creds
    ):
        yaml_content = """
        DATABASE_URL: {Senha_Postgres} / {DB_NAME}
        BACKEND: {BACKEND_DOMAIN}
        FRONTEND: {FRONTEND_DOMAIN}
        SECRET_KEY: {SECRET_KEY}
        PEPPER: {SECURITY_PASSWORD_PEPPER}
        NAME: {SUPERADMIN_NAME}
        EMAIL: {SUPERADMIN_EMAIL}
        PASS: {SUPERADMIN_PASSWORD}
        OPENAI: {OPENAI_API_KEY}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        mock_get_services.return_value = []  # Servidor novo (stack não existe)

        result = install_smartacademy(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_test_password",
            backend_domain="aulas-back.test.com",
            frontend_domain="aulas-front.test.com",
            superadmin_name="Aryaraj",
            superadmin_email="aryarajmarketing@gmail.com",
            openai_api_key=""
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['credentials']['user'], 'aryarajmarketing@gmail.com')
        self.assertTrue(len(result['credentials']['password']) > 0)

        # Em servidor novo, o banco deve ser criado como 'smartacademy'
        mock_create_db.assert_called_once()
        self.assertEqual(mock_create_db.call_args[0][1], "smartacademy")

        # Verifica deploy e substituições
        mock_deploy.assert_called_once()
        self.assertEqual(mock_deploy.call_args[0][1], "gestao-aulas")
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("DATABASE_URL: pg_test_password / smartacademy", deployed_content)
        self.assertIn("BACKEND: aulas-back.test.com", deployed_content)
        self.assertIn("FRONTEND: aulas-front.test.com", deployed_content)
        self.assertIn("EMAIL: aryarajmarketing@gmail.com", deployed_content)
        self.assertIn("NAME: Aryaraj", deployed_content)
        mock_save_creds.assert_called_once()

    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_smartacademy_existing_install_preserves_gestaoaulas_db(
        self, mock_file, mock_get_env, mock_get_services, mock_get_path,
        mock_deploy, mock_create_db, mock_ssh, mock_save_creds
    ):
        yaml_content = "{DB_NAME} {SECRET_KEY} {SECURITY_PASSWORD_PEPPER} {SUPERADMIN_PASSWORD} {SUPERADMIN_EMAIL} {OPENAI_API_KEY}"
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x

        # Servidor existente com gestaoaulas no DATABASE_URL
        mock_get_services.return_value = ["gestao-aulas_area_aulas_backend"]
        mock_get_env.return_value = {
            "DATABASE_URL": "postgresql://postgres:pass@postgres:5432/gestaoaulas",
            "SECRET_KEY": "PREVIOUS_SECRET_KEY_123",
            "SECURITY_PASSWORD_PEPPER": "PREVIOUS_PEPPER_456",
            "SUPERADMIN_PASSWORD": "PREVIOUS_ADMIN_PASS_XYZ",
            "SUPERADMIN_EMAIL": "saved_admin@test.com",
            "SUPERADMIN_NAME": "CustomAdmin",
            "OPENAI_API_KEY": "sk-proj-EXISTINGKEY"
        }

        result = install_smartacademy(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            backend_domain="aulas-back.test.com",
            frontend_domain="aulas-front.test.com"
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['credentials']['user'], 'saved_admin@test.com')
        self.assertEqual(result['credentials']['password'], 'PREVIOUS_ADMIN_PASS_XYZ')

        # Em servidor existente com gestaoaulas, preserva 'gestaoaulas'
        self.assertEqual(mock_create_db.call_args[0][1], "gestaoaulas")
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("gestaoaulas", deployed_content)
        self.assertIn("PREVIOUS_SECRET_KEY_123", deployed_content)
        self.assertIn("PREVIOUS_PEPPER_456", deployed_content)
        self.assertIn("sk-proj-EXISTINGKEY", deployed_content)

    @patch('app.routes.installer.stacks.run_generic_install_task')
    @patch('app.routes.installer.stacks.save_setting')
    def test_install_smartacademy_api_endpoint(self, mock_save, mock_task):
        client = TestClient(app)
        payload = {
            "host": "127.0.0.1",
            "username": "root",
            "password": "pwd",
            "postgres_password": "pgpwd",
            "backend_domain": "api.aulas.com",
            "frontend_domain": "aulas.com",
            "superadmin_name": "Aryaraj",
            "superadmin_email": "aryarajmarketing@gmail.com",
            "openai_api_key": ""
        }
        response = client.post("/install-smartacademy", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertIn("Instalação do Smart Academy iniciada", response.json()["message"])

if __name__ == '__main__':
    unittest.main()
