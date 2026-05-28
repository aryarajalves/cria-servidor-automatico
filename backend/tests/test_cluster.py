import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import os
import sys

# Adiciona o diretório backend ao path para os imports funcionarem
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if "/" in sys.path:
    sys.path.remove("/")

from app.main import app
from app.database import init_db, add_server, delete_server, get_cluster_nodes

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_database_cluster_nodes():
    # 1. Cadastra servidores de teste
    server_parent_id = add_server("Parent Server", "10.0.0.1", "root", "pass1")
    server_child_id = add_server("Child Server", "10.0.0.2", "root", "pass2")
    
    try:
        from app.database import add_cluster_node, get_cluster_nodes, remove_cluster_node
        
        # 2. Adiciona nó de cluster
        add_cluster_node("10.0.0.1", server_child_id, "worker")
        
        # 3. Lista nós
        nodes = get_cluster_nodes("10.0.0.1")
        assert len(nodes) == 1
        assert nodes[0]["node_id"] == server_child_id
        assert nodes[0]["role"] == "worker"
        assert nodes[0]["host"] == "10.0.0.2"
        
        # 4. Remove nó
        remove_cluster_node("10.0.0.1", server_child_id)
        nodes = get_cluster_nodes("10.0.0.1")
        assert len(nodes) == 0
        
    finally:
        delete_server(server_parent_id)
        delete_server(server_child_id)

@patch("app.installer.get_ssh_client")
def test_api_list_and_status(mock_ssh):
    # Mock SSH client e o docker node ls
    mock_client = MagicMock()
    mock_ssh.return_value = mock_client
    
    # Mock retorno do comando para saber se o swarm está ativo
    # Mock para get_swarm_nodes_real_status
    # Retorno de docker info e docker node ls
    mock_client.exec_command.return_value = (
        MagicMock(), 
        MagicMock(read=lambda: b"active\nID-1\tNode-1\tReady\tActive\tLeader"), 
        MagicMock(read=lambda: b"")
    )
    
    # Teste list nodes API
    response = client.get("/api/cluster/nodes?parent_host=10.0.0.1")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    
    # Teste status API
    response = client.get(
        "/api/cluster/status?parent_host=10.0.0.1&parent_username=root&parent_password=pass"
    )
    assert response.status_code == 200
    data = response.json()
    assert "swarm_active" in data
    assert "real_nodes" in data

@patch("app.installer.check_docker_installed")
@patch("app.installer.get_swarm_join_tokens")
@patch("app.installer.join_swarm_cluster")
@patch("app.database.get_server_by_id")
@patch("app.database.add_cluster_node")
def test_api_add_node(mock_add_db, mock_get_server, mock_join, mock_tokens, mock_check_docker):
    mock_check_docker.return_value = "Docker version 24.0.5"
    mock_tokens.return_value = {"worker": "token-worker-123", "manager": "token-manager-123"}
    mock_get_server.return_value = {
        "id": 2,
        "name": "Child VPS",
        "host": "10.0.0.2",
        "username": "root",
        "password": "pass"
    }
    
    payload = {
        "parent_host": "10.0.0.1",
        "parent_username": "root",
        "parent_password": "pass",
        "node_id": 2,
        "role": "worker",
        "parent_ip": "10.0.0.1",
        "install_docker": True
    }
    
    # Chama o endpoint de adição
    response = client.post("/api/cluster/nodes", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

@patch("app.installer.change_swarm_node_hostname")
def test_api_change_hostname(mock_change_hostname):
    payload = {
        "parent_host": "10.0.0.1",
        "parent_username": "root",
        "parent_password": "pass",
        "node_swarm_id": "node-123",
        "old_hostname": "vps-old",
        "new_hostname": "vps-new"
    }
    
    response = client.post("/api/cluster/nodes/change-hostname", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    # Como roda em background, validamos se iniciou
    assert "iniciado com sucesso" in response.json()["message"]

@patch("app.installer.get_ssh_client")
@patch("app.installer.run_ssh_command")
@patch("app.database.get_servers")
def test_change_swarm_node_hostname_success(mock_get_servers, mock_run_ssh, mock_get_ssh):
    from app.installer import change_swarm_node_hostname
    
    # Configura o mock do banco de dados
    mock_get_servers.return_value = [
        {"host": "10.0.0.2", "username": "root", "password": "pass", "name": "Servidor Teste"}
    ]
    
    # Mock do SSH Client
    mock_client = MagicMock()
    mock_get_ssh.return_value = mock_client
    
    # Mock de comandos SSH
    # 1. docker node inspect -> retorna o IP 10.0.0.2
    # 2. hostnamectl set-hostname, sed, systemctl restart docker
    mock_run_ssh.side_effect = [
        "10.0.0.2", # IP do inspect
        "", # set-hostname
        "", # sed
        ""  # restart docker
    ]
    
    res = change_swarm_node_hostname(
        parent_host="10.0.0.1",
        parent_username="root",
        parent_password="pass",
        node_swarm_id="node-123",
        old_hostname="vps-old",
        new_hostname="vps-new"
    )
    
    assert res["status"] == "success"
    assert "Hostname alterado com sucesso" in res["message"]
    
    # Garante que rodou os comandos no target
    mock_run_ssh.assert_any_call(mock_client, "sudo hostnamectl set-hostname vps-new")
    mock_run_ssh.assert_any_call(mock_client, "sudo sed -i 's/vps-old/vps-new/g' /etc/hosts")
    mock_run_ssh.assert_any_call(mock_client, "sudo systemctl restart docker")

