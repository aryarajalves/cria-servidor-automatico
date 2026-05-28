import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Adiciona o diretório backend ao path para os imports funcionarem
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

client = TestClient(app)

def test_check_ssl_success():
    payload = {"domain": "exemplo.com"}
    with patch("socket.create_connection") as mock_conn, \
         patch("ssl.create_default_context") as mock_context:
        
        mock_sock = MagicMock()
        mock_conn.return_value.__enter__.return_value = mock_sock
        
        mock_ssock = MagicMock()
        mock_ssock.getpeercert.return_value = {"subject": "exemplo.com"}
        mock_context.return_value.wrap_socket.return_value.__enter__.return_value = mock_ssock
        
        response = client.post("/cloudflare/check-ssl", json=payload)
        assert response.status_code == 200
        assert response.json() == {"valid": True, "message": "SSL ativo e funcionando corretamente!"}

def test_check_ssl_ssl_error():
    import ssl
    payload = {"domain": "exemplo.com"}
    with patch("socket.create_connection") as mock_conn, \
         patch("ssl.create_default_context") as mock_context:
        
        mock_sock = MagicMock()
        mock_conn.return_value.__enter__.return_value = mock_sock
        
        # Simula SSLError
        mock_context.return_value.wrap_socket.return_value.__enter__.side_effect = ssl.SSLError("cert expired")
        
        response = client.post("/cloudflare/check-ssl", json=payload)
        assert response.status_code == 200
        assert response.json()["valid"] is False
        assert "Erro de validação SSL" in response.json()["message"]

def test_check_ssl_connection_error():
    payload = {"domain": "exemplo-invalido.com"}
    with patch("socket.create_connection", side_effect=Exception("Connection timed out")):
        response = client.post("/cloudflare/check-ssl", json=payload)
        assert response.status_code == 200
        assert response.json()["valid"] is False
        assert "Não foi possível conectar" in response.json()["message"]
