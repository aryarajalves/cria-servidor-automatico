import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_smartvsl
from fastapi.testclient import TestClient
from app.main import app

class TestSmartVSLInstaller(unittest.TestCase):
    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_smartvsl_new_install_creates_smartvsl_db(
        self, mock_file, mock_get_env, mock_get_services, mock_get_path,
        mock_deploy, mock_create_db, mock_ssh, mock_save_creds
    ):
        yaml_content = """
        DATABASE_URL: {Senha_Postgres} / {DB_NAME}
        BACKEND: {BACKEND_DOMAIN}
        FRONTEND: {FRONTEND_DOMAIN}
        JWT: {JWT_SECRET_KEY}
        EMAIL: {SUPER_ADMIN_EMAIL}
        PASS: {SUPER_ADMIN_PASSWORD}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        mock_get_services.return_value = []  # Servidor novo (stack não existe)

        result = install_smartvsl(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_test_password",
            backend_domain="turb-back.test.com",
            frontend_domain="turb-front.test.com",
            super_admin_email="aryarajmarketing@gmail.com"
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['credentials']['user'], 'aryarajmarketing@gmail.com')
        self.assertTrue(len(result['credentials']['password']) > 0)

        # Em servidor novo, a tabela/base deve ser criada como 'smartvsl'
        mock_create_db.assert_called_once()
        self.assertEqual(mock_create_db.call_args[0][1], "smartvsl")

        # Verifica deploy e substituições
        mock_deploy.assert_called_once()
        self.assertEqual(mock_deploy.call_args[0][1], "clone-vturb")
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("DATABASE_URL: pg_test_password / smartvsl", deployed_content)
        self.assertIn("BACKEND: turb-back.test.com", deployed_content)
        self.assertIn("FRONTEND: turb-front.test.com", deployed_content)
        self.assertIn("EMAIL: aryarajmarketing@gmail.com", deployed_content)
        mock_save_creds.assert_called_once()

    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_smartvsl_existing_install_preserves_vturb_db(
        self, mock_file, mock_get_env, mock_get_services, mock_get_path,
        mock_deploy, mock_create_db, mock_ssh, mock_save_creds
    ):
        yaml_content = "{DB_NAME} {JWT_SECRET_KEY} {SUPER_ADMIN_PASSWORD} {SUPER_ADMIN_EMAIL}"
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x

        # Servidor existente com vturb_db no DATABASE_URL
        mock_get_services.return_value = ["clone-vturb_backend"]
        mock_get_env.return_value = {
            "DATABASE_URL": "postgresql://postgres:pass@postgres:5432/vturb_db",
            "JWT_SECRET_KEY": "PREVIOUS_JWT_KEY_999",
            "SUPER_ADMIN_PASSWORD": "PREVIOUS_ADMIN_PASS_XYZ",
            "SUPER_ADMIN_EMAIL": "saved_admin@test.com"
        }

        result = install_smartvsl(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            backend_domain="turb-back.test.com",
            frontend_domain="turb-front.test.com"
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['credentials']['user'], 'saved_admin@test.com')
        self.assertEqual(result['credentials']['password'], 'PREVIOUS_ADMIN_PASS_XYZ')

        # Em servidor existente com vturb_db, preserva o banco vturb_db
        self.assertEqual(mock_create_db.call_args[0][1], "vturb_db")
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("vturb_db", deployed_content)
        self.assertIn("PREVIOUS_JWT_KEY_999", deployed_content)

    @patch('app.routes.installer.stacks.save_setting')
    @patch('app.installer.get_stack_env_vars')
    @patch('app.routes.installer.stacks.run_generic_install_task')
    def test_endpoint_install_smartvsl(self, mock_run_task, mock_get_env, mock_save_setting):
        client = TestClient(app)
        mock_get_env.return_value = {"POSTGRES_PASSWORD": "auto_fetched_password"}

        payload = {
            "host": "10.0.0.1",
            "username": "root",
            "password": "secret_password",
            "frontend_domain": "turb-front.example.com",
            "backend_domain": "turb-back.example.com",
            "super_admin_email": "admin@example.com"
        }

        response = client.post("/install-smartvsl", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertIn("iniciada", response.json()["message"])
        mock_save_setting.assert_called()

if __name__ == '__main__':
    unittest.main()
