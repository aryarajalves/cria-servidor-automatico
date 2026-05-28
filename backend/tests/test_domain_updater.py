import unittest
from unittest.mock import MagicMock, patch
import os
import sys
import json

# Adiciona o diretório backend ao path para importar app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.installer import update_stack_domain

class TestDomainUpdater(unittest.TestCase):
    @patch('app.services.web_apps.get_ssh_client')
    @patch('app.services.web_apps.run_ssh_command')
    @patch('app.services.web_apps.get_stack_services')
    def test_update_stack_domain_updates_labels_and_env(self, mock_get_services, mock_run, mock_get_ssh):
        # Mock SSH Client
        mock_client = MagicMock()
        mock_get_ssh.return_value = mock_client
        
        # Simula a lista de serviços da stack
        mock_get_services.return_value = ["agentes_backend"]
        
        # Simula o retorno de docker service inspect para labels e variáveis de ambiente
        labels_mock = json.dumps({
            "traefik.enable": "true",
            "traefik.http.routers.agentes_backend.rule": "Host(`old.domain.com`)"
        })
        env_mock = json.dumps([
            "DATABASE_URL=postgresql://db",
            "FRONTEND_URL=https://old.domain.com",
            "VITE_API_URL=https://old.domain.com/api"
        ])
        
        # Configura as respostas dos comandos SSH simulados
        def run_ssh_mock_side_effect(client, command, **kwargs):
            if "Labels" in command:
                return labels_mock
            elif "Env" in command:
                return env_mock
            elif "docker service update" in command:
                return "updated"
            return ""
            
        mock_run.side_effect = run_ssh_mock_side_effect
        
        # Executa a função de atualização de domínio
        result = update_stack_domain(
            host="1.2.3.4",
            username="root",
            password="password",
            stack_name="agentes",
            old_domain="old.domain.com",
            new_domain="new.domain.com"
        )
        
        # Validações
        self.assertEqual(result["status"], "success")
        self.assertIn("agentes_backend", result["updated_services"])
        
        # Verifica se o comando de update continha os parâmetros corretos
        update_calls = [call.args[1] for call in mock_run.call_args_list if "docker service update" in call.args[1]]
        self.assertEqual(len(update_calls), 1)
        
        update_cmd = update_calls[0]
        self.assertIn('--label-add "traefik.http.routers.agentes_backend.rule=Host(`new.domain.com`)"', update_cmd)
        self.assertIn('--env-add "FRONTEND_URL=https://new.domain.com"', update_cmd)
        self.assertIn('--env-add "VITE_API_URL=https://new.domain.com/api"', update_cmd)
        self.assertIn('agentes_backend', update_cmd)

if __name__ == '__main__':
    unittest.main()
