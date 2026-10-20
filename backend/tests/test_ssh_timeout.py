import pytest
from unittest.mock import patch, MagicMock
import paramiko
import socket
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.services.base_ssh import get_ssh_client

def test_ssh_authentication_fails_attempts_fallbacks():
    # Testa que se houver falha de autenticação (AuthenticationException),
    # o client tenta o fallback e a conexão interativa.
    with patch("paramiko.SSHClient") as mock_ssh_class, \
         patch("paramiko.Transport") as mock_transport_class:
        
        mock_client = mock_ssh_class.return_value
        
        # Primeira tentativa falha com AuthenticationException
        # Segunda tentativa (fallback) falha com AuthenticationException
        mock_client.connect.side_effect = paramiko.AuthenticationException("Auth failed")
        
        # Terceira tentativa (interactive) falha no Transport.connect
        mock_transport = mock_transport_class.return_value
        mock_transport.connect.side_effect = Exception("Interactive failed")
        
        with pytest.raises(Exception, match="Interactive failed"):
            get_ssh_client("1.2.3.4", "root", "password", timeout=1)
        
        # Deve ter chamado connect 2 vezes no mock_client (primeira tentativa e fallback)
        assert mock_client.connect.call_count == 2
        # Deve ter inicializado o Transport para a tentativa interactive
        mock_transport_class.assert_called_once()

def test_ssh_network_error_fails_immediately():
    # Testa que se houver falha de rede física (ex: timeout/connection refused),
    # o client lança a exceção imediatamente sem tentar fallbacks.
    with patch("paramiko.SSHClient") as mock_ssh_class, \
         patch("paramiko.Transport") as mock_transport_class:
        
        mock_client = mock_ssh_class.return_value
        mock_client.connect.side_effect = socket.timeout("timeout")
        
        with pytest.raises(socket.timeout):
            get_ssh_client("1.2.3.4", "root", "password", timeout=1)
            
        # Deve ter chamado connect apenas 1 vez (primeira tentativa)
        assert mock_client.connect.call_count == 1
        # Não deve ter tentado o fallback nem o Transport interativo
        mock_transport_class.assert_not_called()
