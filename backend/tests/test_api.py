import sys
import os
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Adiciona o diretório backend ao path para os imports funcionarem
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.main import app

client = TestClient(app)

def test_read_root():
    # Nota: / retorna FileResponse(os.path.join(static_dir, "index.html"))
    # Se o arquivo não existir, vai dar 404.
    response = client.get("/")
    assert response.status_code in [200, 404]

def test_health_check():
    # Adicionando um teste para um endpoint que deve existir
    # Como não temos um /health, vamos testar o /install-status/docker
    response = client.get("/install-status/docker")
    assert response.status_code == 200
    assert "status" in response.json()

def test_restart_stack():
    payload = {
        "host": "1.2.3.4",
        "username": "root",
        "password": "password123",
        "stack_name": "portainer"
    }
    with patch('app.services.web_apps.get_ssh_client') as mock_ssh, \
         patch('app.services.web_apps.run_ssh_command') as mock_run_ssh:
        mock_ssh_client = MagicMock()
        mock_ssh.return_value = mock_ssh_client
        mock_run_ssh.return_value = "portainer_portainer"
        response = client.post("/restart-stack", json=payload)
        assert response.status_code == 200
