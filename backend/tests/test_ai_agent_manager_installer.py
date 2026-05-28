import pytest
from unittest.mock import patch, MagicMock
from app.installer import install_ai_agent_manager

@patch('app.services.web_apps.get_stack_path')
@patch('app.database.save_stack_credentials')
@patch('app.services.web_apps.deploy_stack_remote')
@patch('app.services.web_apps.create_postgres_database')
@patch('app.services.web_apps.get_ssh_client')
def test_install_ai_agent_manager_placeholders(
    mock_get_ssh,
    mock_create_db,
    mock_deploy,
    mock_save_creds,
    mock_get_stack_path
):
    # Setup
    mock_client = MagicMock()
    mock_get_ssh.return_value = mock_client
    mock_get_stack_path.return_value = "dummy_path.yml"
    
    # Mock do conteúdo do YAML com os novos placeholders
    yaml_content = """
    AGENT_API_KEY={AGENT_API_KEY}
    VITE_AGENT_API_KEY={VITE_AGENT_API_KEY}
    GOOGLE_CLIENT_ID={GOOGLE_CLIENT_ID}
    GOOGLE_CLIENT_SECRET={GOOGLE_CLIENT_SECRET}
    GOOGLE_REDIRECT_URI={GOOGLE_REDIRECT_URI}
    VITE_API_URL={VITE_API_URL}
    """
    
    with patch('builtins.open', pytest.importorskip('unittest.mock').mock_open(read_data=yaml_content)):
        # Execução
        result = install_ai_agent_manager(
            host="1.1.1.1",
            username="root",
            password="pass",
            postgres_password="pg_pass",
            openai_api_key="sk-key",
            domain_backend="api.test.com",
            domain_frontend="app.test.com",
            agent_api_key="fixed-key",
            google_client_id="g-id",
            google_client_secret="g-secret",
            google_redirect_uri="g-uri"
        )
        
        # Verificações
        assert result['status'] == "success"
        
        # Pega o conteúdo que foi enviado para o deploy_stack_remote
        sent_content = mock_deploy.call_args[0][2]
        
        # Verifica se os placeholders foram substituídos corretamente
        assert "AGENT_API_KEY=fixed-key" in sent_content
        assert "VITE_AGENT_API_KEY=fixed-key" in sent_content
        assert "GOOGLE_CLIENT_ID=g-id" in sent_content
        assert "GOOGLE_CLIENT_SECRET=g-secret" in sent_content
        assert "GOOGLE_REDIRECT_URI=g-uri" in sent_content
        assert "VITE_API_URL=https://api.test.com" in sent_content
        
        # Verifica se o VITE_AGENT_API_KEY é igual ao AGENT_API_KEY
        # (Neste teste usamos um agent_api_key fixo para facilitar a asserção)
