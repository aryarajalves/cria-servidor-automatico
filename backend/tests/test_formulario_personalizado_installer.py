import unittest
from unittest.mock import patch, MagicMock, mock_open
import os
import sys

# Adiciona o diretório backend ao path para poder importar o app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import install_formulario_personalizado
from fastapi.testclient import TestClient
from app.main import app

class TestFormularioPersonalizadoInstaller(unittest.TestCase):
    @patch('app.services.web_apps.save_stack_credentials')
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.create_postgres_database')
    @patch('app.services.web_apps.deploy_stack_remote')
    @patch('app.services.web_apps.get_stack_path')
    @patch('app.services.web_apps.get_stack_services')
    @patch('app.services.web_apps.get_service_env_vars')
    @patch('builtins.open', new_callable=mock_open)
    def test_install_formulario_personalizado_new_install(
        self, mock_file, mock_get_env, mock_get_services, mock_get_path,
        mock_deploy, mock_create_db, mock_ssh, mock_save_creds
    ):
        yaml_content = """
        DATABASE_URL: {Senha_Postgres}
        BACKEND: {BACKEND_DOMAIN}
        FRONTEND: {FRONTEND_DOMAIN}
        SECRET_KEY: {SECRET_KEY}
        PEPPER: {SECURITY_PASSWORD_PEPPER}
        KEY: {SECURITY_ENCRYPTION_KEY}
        EMAIL: {SUPERADMIN_EMAIL}
        PASS: {SUPERADMIN_PASSWORD}
        """
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x
        mock_get_services.return_value = []  # Stack nova

        result = install_formulario_personalizado(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_test_password",
            backend_domain="api.forms.test.com",
            frontend_domain="forms.test.com",
            super_admin_name="Aryaraj",
            super_admin_email="aryarajmarketing@gmail.com"
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['credentials']['user'], 'aryarajmarketing@gmail.com')
        self.assertTrue(len(result['credentials']['password']) > 0)

        # Verifica chamada ao banco de dados
        mock_create_db.assert_called_once()
        self.assertEqual(mock_create_db.call_args[0][1], "formulario")

        # Verifica deploy e substituições
        mock_deploy.assert_called_once()
        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("DATABASE_URL: pg_test_password", deployed_content)
        self.assertIn("BACKEND: api.forms.test.com", deployed_content)
        self.assertIn("FRONTEND: forms.test.com", deployed_content)
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
    def test_install_formulario_personalizado_reuse_credentials(
        self, mock_file, mock_get_env, mock_get_services, mock_get_path,
        mock_deploy, mock_create_db, mock_ssh, mock_save_creds
    ):
        yaml_content = "{SECRET_KEY} {SECURITY_ENCRYPTION_KEY} {SUPERADMIN_PASSWORD} {SUPERADMIN_EMAIL}"
        mock_file.return_value.read.return_value = yaml_content
        mock_get_path.side_effect = lambda x: x

        mock_get_services.return_value = ["formulario-personalizado_formulario_backend"]
        mock_get_env.return_value = {
            "SECRET_KEY": "EXISTING_SECRET_KEY_123",
            "SECURITY_ENCRYPTION_KEY": "EXISTING_FERNET_KEY_ABC=",
            "SUPERADMIN_PASSWORD": "EXISTING_PASSWORD_XYZ",
            "SUPERADMIN_EMAIL": "saved@email.com"
        }

        result = install_formulario_personalizado(
            host="1.1.1.1",
            username="root",
            password="password",
            postgres_password="pg_password",
            backend_domain="api.test.com",
            frontend_domain="front.test.com"
        )

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['credentials']['user'], 'saved@email.com')
        self.assertEqual(result['credentials']['password'], 'EXISTING_PASSWORD_XYZ')

        deployed_content = mock_deploy.call_args[0][2]
        self.assertIn("EXISTING_SECRET_KEY_123", deployed_content)
        self.assertIn("EXISTING_FERNET_KEY_ABC=", deployed_content)

    @patch('app.routes.installer.stacks.save_setting')
    @patch('app.installer.get_stack_env_vars')
    @patch('app.routes.installer.stacks.run_generic_install_task')
    def test_endpoint_install_formulario_personalizado(self, mock_run_task, mock_get_env, mock_save_setting):
        client = TestClient(app)
        mock_get_env.return_value = {"POSTGRES_PASSWORD": "auto_fetched_password"}

        payload = {
            "host": "10.0.0.1",
            "username": "root",
            "password": "secret_password",
            "frontend_domain": "forms.example.com",
            "backend_domain": "api-forms.example.com",
            "super_admin_email": "admin@example.com"
        }

        response = client.post("/install-formulario-personalizado", json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertIn("iniciada", response.json()["message"])
        mock_save_setting.assert_called()
