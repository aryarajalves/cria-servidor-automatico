import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from app.installer import install_ai_agent_manager

@patch('app.services.web_apps.get_stack_path')
@patch('app.database.save_stack_credentials')
@patch('app.services.web_apps.deploy_stack_remote')
@patch('app.services.web_apps.create_postgres_database')
@patch('app.services.web_apps.get_ssh_client')
@patch('app.services.web_apps.get_stack_services')
@patch('app.services.web_apps.get_service_env_vars')
@patch('app.services.web_apps.get_stack_env_vars')
@patch('app.services.web_apps.get_setting')
def test_install_ai_agent_manager_placeholders(
    mock_get_setting,
    mock_get_stack_env_vars,
    mock_get_env,
    mock_get_services,
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
    mock_get_services.return_value = [] # Stack não existe
    mock_get_env.return_value = {}
    
    # Mock para get_stack_env_vars
    def side_effect_env(host, user, pwd, stack):
        if stack == "zapvoice":
            return {"REGISTER_API_KEY": "zap-token"}
        if stack == "minio":
            return {"MINIO_ROOT_USER": "minio-user", "MINIO_ROOT_PASSWORD": "minio-password"}
        return {}
    mock_get_stack_env_vars.side_effect = side_effect_env
    
    # Mock para get_setting
    def side_effect_setting(key, host):
        if key == "stack_domain_zapvoice":
            return "zapvoice.test.com"
        if key == "stack_domain_minio":
            return "minio.test.com"
        return None
    mock_get_setting.side_effect = side_effect_setting
    
    # Mock do conteúdo do YAML com os novos placeholders
    yaml_content = """
    AGENT_API_KEY={AGENT_API_KEY}
    VITE_AGENT_API_KEY={VITE_AGENT_API_KEY}
    GOOGLE_CLIENT_ID={GOOGLE_CLIENT_ID}
    GOOGLE_CLIENT_SECRET={GOOGLE_CLIENT_SECRET}
    GOOGLE_REDIRECT_URI={GOOGLE_REDIRECT_URI}
    VITE_API_URL={VITE_API_URL}
    S3_ENDPOINT_URL={S3_ENDPOINT_URL}
    S3_ACCESS_KEY={S3_ACCESS_KEY}
    S3_SECRET_KEY={S3_SECRET_KEY}
    ZAPVOICE_URL={ZAPVOICE_URL}
    ZAPVOICE_API_TOKEN={ZAPVOICE_API_TOKEN}
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
        assert "S3_ENDPOINT_URL=https://minio.test.com" in sent_content
        assert "S3_ACCESS_KEY=minio-user" in sent_content
        assert "S3_SECRET_KEY=minio-password" in sent_content
        assert "ZAPVOICE_URL=https://zapvoice.test.com" in sent_content
        assert "ZAPVOICE_API_TOKEN=zap-token" in sent_content

@patch('app.services.web_apps.get_stack_path')
@patch('app.database.save_stack_credentials')
@patch('app.services.web_apps.deploy_stack_remote')
@patch('app.services.web_apps.create_postgres_database')
@patch('app.services.web_apps.get_ssh_client')
@patch('app.services.web_apps.get_stack_services')
@patch('app.services.web_apps.get_service_env_vars')
@patch('app.services.web_apps.get_stack_env_vars')
@patch('app.services.web_apps.get_setting')
def test_install_ai_agent_manager_reuse_existing(
    mock_get_setting,
    mock_get_stack_env_vars,
    mock_get_env,
    mock_get_services,
    mock_get_ssh,
    mock_create_db,
    mock_deploy,
    mock_save_creds,
    mock_get_stack_path
):
    mock_client = MagicMock()
    mock_get_ssh.return_value = mock_client
    mock_get_stack_path.return_value = "dummy_path.yml"
    
    mock_get_services.return_value = ["agentes_app"]
    mock_get_env.return_value = {
        "OPENAI_API_KEY": "existing-openai-key",
        "AGENT_API_KEY": "existing-agent-key"
    }
    
    # Mock para get_stack_env_vars
    def side_effect_env(host, user, pwd, stack):
        if stack == "zapvoice":
            return {"REGISTER_API_KEY": "zap-token"}
        if stack == "minio":
            return {"MINIO_ROOT_USER": "minio-user", "MINIO_ROOT_PASSWORD": "minio-password"}
        return {}
    mock_get_stack_env_vars.side_effect = side_effect_env
    
    # Mock para get_setting
    def side_effect_setting(key, host):
        if key == "stack_domain_zapvoice":
            return "zapvoice.test.com"
        if key == "stack_domain_minio":
            return "minio.test.com"
        return None
    mock_get_setting.side_effect = side_effect_setting
    
    yaml_content = """
    OPENAI_API_KEY={OPENAI_API_KEY}
    AGENT_API_KEY={AGENT_API_KEY}
    """
    
    with patch('builtins.open', pytest.importorskip('unittest.mock').mock_open(read_data=yaml_content)):
        result = install_ai_agent_manager(
            host="1.1.1.1",
            username="root",
            password="pass",
            postgres_password="pg_pass",
            openai_api_key="", # Vazio para forçar o reuso
            domain_backend="api.test.com",
            domain_frontend="app.test.com"
        )
        
        assert result['status'] == "success"
        sent_content = mock_deploy.call_args[0][2]
        assert "OPENAI_API_KEY=existing-openai-key" in sent_content
        assert "AGENT_API_KEY=existing-agent-key" in sent_content

@patch('app.services.web_apps.get_stack_env_vars')
@patch('app.services.web_apps.get_ssh_client')
def test_install_ai_agent_manager_missing_zapvoice(
    mock_get_ssh,
    mock_get_stack_env_vars
):
    # ZapVoice não está instalado/ativo
    mock_get_stack_env_vars.return_value = {}
    
    with pytest.raises(HTTPException) as exc_info:
        install_ai_agent_manager(
            host="1.1.1.1",
            username="root",
            password="pass",
            postgres_password="pg_pass",
            openai_api_key="sk-key",
            domain_backend="api.test.com",
            domain_frontend="app.test.com"
        )
    assert exc_info.value.status_code == 400
    assert "zapvoice" in exc_info.value.detail.lower()

@patch('app.services.web_apps.get_stack_env_vars')
@patch('app.services.web_apps.get_ssh_client')
def test_install_ai_agent_manager_missing_minio(
    mock_get_ssh,
    mock_get_stack_env_vars
):
    # ZapVoice está instalado, mas MinIO não está
    def side_effect_env(host, user, pwd, stack):
        if stack == "zapvoice":
            return {"REGISTER_API_KEY": "zap-token"}
        return {} # minio retorna vazio
    mock_get_stack_env_vars.side_effect = side_effect_env
    
    with pytest.raises(HTTPException) as exc_info:
        install_ai_agent_manager(
            host="1.1.1.1",
            username="root",
            password="pass",
            postgres_password="pg_pass",
            openai_api_key="sk-key",
            domain_backend="api.test.com",
            domain_frontend="app.test.com"
        )
    assert exc_info.value.status_code == 400
    assert "minio" in exc_info.value.detail.lower()

