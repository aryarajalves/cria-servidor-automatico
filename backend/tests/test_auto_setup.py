import unittest
from unittest.mock import patch, MagicMock
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.auto_setup_service import (
    run_auto_setup_pipeline, get_auto_setup_state, auto_setup_states
)
from fastapi.testclient import TestClient
from app.main import app

class TestAutoSetupService(unittest.TestCase):
    def setUp(self):
        auto_setup_states.clear()

    @patch('app.services.auto_setup_service.install_rabbitmq')
    @patch('app.services.auto_setup_service.install_redis')
    @patch('app.services.auto_setup_service.install_postgres')
    @patch('app.services.auto_setup_service.init_portainer_admin')
    @patch('app.services.auto_setup_service.install_portainer')
    @patch('app.services.auto_setup_service.install_traefik')
    @patch('app.services.auto_setup_service.install_ctop')
    @patch('app.services.auto_setup_service.create_network')
    @patch('app.services.auto_setup_service.init_swarm')
    @patch('app.services.auto_setup_service.update_docker_version_config')
    @patch('app.services.auto_setup_service.install_docker')
    @patch('app.services.auto_setup_service.time.sleep', return_value=None)
    def test_auto_setup_pipeline_execution(
        self, mock_sleep, mock_docker, mock_update_docker, mock_swarm, mock_net,
        mock_ctop, mock_traefik, mock_portainer, mock_admin_init, mock_postgres,
        mock_redis, mock_rabbitmq
    ):
        mock_admin_init.return_value = {"status": "success"}

        run_auto_setup_pipeline(
            host="1.2.3.4",
            username="root",
            password="pwd",
            install_docker_flag=True,
            install_swarm_flag=True,
            install_network_flag=True,
            install_ctop_flag=True,
            install_traefik_flag=True,
            install_portainer_flag=True,
            portainer_domain="portainer.example.com",
            portainer_password="adminpassword123",
            install_postgres_flag=True,
            postgres_password="pg_password",
            install_redis_flag=True,
            install_rabbitmq_flag=True,
            rabbitmq_user="admin",
            rabbitmq_password="rabbit_password"
        )

        state = get_auto_setup_state("1.2.3.4")
        self.assertEqual(state["status"], "completed")
        self.assertEqual(state["error"], None)
        self.assertEqual(len(state["steps"]), 9)

        mock_docker.assert_called_once()
        mock_swarm.assert_called_once()
        mock_net.assert_called_once()
        mock_ctop.assert_called_once()
        mock_traefik.assert_called_once()
        mock_portainer.assert_called_once()
        mock_postgres.assert_called_once()
        mock_redis.assert_called_once()
        mock_rabbitmq.assert_called_once()

    @patch('app.services.auto_setup_service.install_smartvsl')
    @patch('app.services.auto_setup_service.install_ai_agent_manager')
    @patch('app.services.auto_setup_service.install_zapvoice')
    @patch('app.services.auto_setup_service.update_docker_version_config')
    @patch('app.services.auto_setup_service.install_docker')
    @patch('app.services.auto_setup_service.init_swarm')
    @patch('app.services.auto_setup_service.create_network')
    @patch('app.services.auto_setup_service.time.sleep', return_value=None)
    def test_auto_setup_pipeline_custom_apps(
        self, mock_sleep, mock_net, mock_swarm, mock_docker, mock_update_docker, mock_zapvoice, mock_ai_agent, mock_smartvsl
    ):
        custom_apps = [
            {
                "id": "smartvsl",
                "title": "SmartVSL",
                "params": {
                    "backend_domain": "turb-back.com",
                    "frontend_domain": "turb-front.com",
                    "super_admin_email": "aryarajmarketing@gmail.com"
                }
            },
            {
                "id": "ai_agent_manager",
                "title": "Gerente de Agente de IA",
                "params": {
                    "domain_backend": "ai-api.com",
                    "domain_frontend": "ai-front.com",
                    "openai_api_key": "sk-123"
                }
            },
            {
                "id": "zapvoice",
                "title": "ZapVoice",
                "params": {
                    "chatwoot_base_url": "zap.com",
                    "super_admin_email": "aryarajmarketing@gmail.com"
                }
            }
        ]

        run_auto_setup_pipeline(
            host="1.2.3.4",
            username="root",
            password="pwd",
            install_docker_flag=True,
            install_swarm_flag=True,
            install_network_flag=True,
            install_ctop_flag=False,
            install_traefik_flag=False,
            install_portainer_flag=False,
            install_postgres_flag=False,
            install_redis_flag=False,
            install_rabbitmq_flag=False,
            custom_apps=custom_apps
        )

        state = get_auto_setup_state("1.2.3.4")
        self.assertEqual(state["status"], "completed")
        mock_smartvsl.assert_called_once()
        mock_ai_agent.assert_called_once()
        mock_zapvoice.assert_called_once()

    @patch('app.routes.installer.auto_setup.run_auto_setup_pipeline')
    def test_auto_setup_api_endpoints(self, mock_pipeline):
        client = TestClient(app)

        # 1. Status inicial (idle)
        status_res = client.get("/auto-setup-status?host=10.0.0.1")
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.json()["status"], "idle")

        # 2. Trigger auto-setup
        payload = {
            "host": "10.0.0.1",
            "username": "root",
            "password": "pwd",
            "install_docker": True,
            "install_swarm": True,
            "install_network": True,
            "install_portainer": False
        }
        post_res = client.post("/auto-setup", json=payload)
        self.assertEqual(post_res.status_code, 200)
        self.assertEqual(post_res.json()["status"], "success")

        # 3. Reset auto-setup
        reset_res = client.post("/auto-setup-reset?host=10.0.0.1")
        self.assertEqual(reset_res.status_code, 200)

if __name__ == '__main__':
    unittest.main()
