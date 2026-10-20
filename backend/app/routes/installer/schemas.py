from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ServerCredentials(BaseModel):
    host: str
    port: Optional[int] = 22
    username: str
    password: Optional[str] = None
    auth_type: Optional[str] = "password"
    key_id: Optional[int] = None

class NetworkCreateRequest(ServerCredentials):
    network_name: str = "network_swarm_public"
    overwrite: bool = False

class RedisInstallRequest(ServerCredentials):
    portainer_api_key: Optional[str] = None

class PortainerInstallRequest(ServerCredentials):
    portainer_host: str
    overwrite: bool = False

class TraefikInstallRequest(ServerCredentials):
    email: str
    overwrite: bool = False

class PostgresInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    overwrite: bool = False

class RabbitMQInstallRequest(ServerCredentials):
    rabbit_user: Optional[str] = None
    rabbit_password: Optional[str] = None
    rabbit_base_url: str
    overwrite: bool = False

class EnvUpdate(BaseModel):
    host: str
    port: Optional[int] = 22
    username: str
    password: Optional[str] = None
    auth_type: Optional[str] = "password"
    key_id: Optional[int] = None
    stack_name: str
    env_vars: dict

class RestartStackRequest(ServerCredentials):
    stack_name: str

class AIAgentManagerInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    openai_api_key: Optional[str] = ""
    domain_backend: str
    domain_frontend: str
    agent_api_key: Optional[str] = None
    google_client_id: Optional[str] = ""
    google_client_secret: Optional[str] = ""
    google_redirect_uri: Optional[str] = ""
    gunicorn_workers: Optional[str] = "4"
    overwrite: bool = False

class ZapVoiceRequest(BaseModel):
    host: str
    port: Optional[int] = 22
    username: str
    password: Optional[str] = None
    auth_type: Optional[str] = "password"
    key_id: Optional[int] = None
    chatwoot_base_url: str 
    postgres_password: str
    super_admin_email: Optional[str] = "aryarajmarketing@gmail.com"
    secret_key: Optional[str] = None

class GerenciadorWhatsAppInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    super_admin_email: Optional[str] = "aryarajmarketing@gmail.com"
    backend_domain: str
    frontend_domain: str
    overwrite: bool = False

class FormularioPersonalizadoInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    super_admin_name: Optional[str] = "Aryaraj"
    super_admin_email: Optional[str] = "aryarajmarketing@gmail.com"
    backend_domain: str
    frontend_domain: str
    overwrite: bool = False

class SmartVSLInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    super_admin_email: Optional[str] = "aryarajmarketing@gmail.com"
    backend_domain: str
    frontend_domain: str
    overwrite: bool = False

class SmartAcademyInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    superadmin_name: Optional[str] = "Aryaraj"
    superadmin_email: Optional[str] = "aryarajmarketing@gmail.com"
    backend_domain: str
    frontend_domain: str
    openai_api_key: Optional[str] = ""
    overwrite: bool = False

class MinioInstallRequest(ServerCredentials):
    minio_root_user: Optional[str] = None
    minio_root_password: Optional[str] = None
    minio_console_url: str
    minio_server_url: str
    overwrite: bool = False

class UninstallStackRequest(ServerCredentials):
    stack_id: str
    stack_name: str

class StackDomainUpdateRequest(ServerCredentials):
    stack_name: str
    old_domain: str
    new_domain: str

class ExternalStackRequest(ServerCredentials):
    stack_name: str
    url: str
    email: Optional[str] = None
    password: Optional[str] = None
    version: Optional[str] = None

class BackupChatwooRabbitInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    base_url: str
    s3_endpoint_url: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_bucket_name: Optional[str] = None
    rabbitmq_host: Optional[str] = None
    rabbitmq_management_port: Optional[int] = 15672
    rabbitmq_user: Optional[str] = None
    rabbitmq_password: Optional[str] = None
    login_email: Optional[str] = "teste@gmail"
    login_password: Optional[str] = None
    jwt_secret: Optional[str] = None
    overwrite: bool = False

class OraculoInstallRequest(ServerCredentials):
    oraculo_domain: str
    openai_api_key: Optional[str] = ""
    gemini_api_key: Optional[str] = ""
    anthropic_api_key: Optional[str] = ""
    fal_key: Optional[str] = ""
    elevenlabs_api_key: Optional[str] = ""
    dashboard_user: Optional[str] = ""
    dashboard_pass: Optional[str] = ""
    dashboard_user_name: Optional[str] = "Admin"
    overwrite: bool = False

class AutoSetupRequest(ServerCredentials):
    install_docker: bool = True
    install_swarm: bool = True
    install_network: bool = True
    install_ctop: bool = True
    install_traefik: bool = True
    traefik_email: Optional[str] = "aryarajmarketing@gmail.com"
    install_portainer: bool = True
    portainer_domain: Optional[str] = None
    portainer_password: Optional[str] = None
    install_postgres: bool = True
    postgres_password: Optional[str] = None
    install_redis: bool = True
    install_rabbitmq: bool = True
    rabbitmq_user: Optional[str] = "admin"
    rabbitmq_password: Optional[str] = None
    install_minio: bool = False
    minio_console_url: Optional[str] = None
    minio_server_url: Optional[str] = None
    minio_root_user: Optional[str] = "admin"
    minio_root_password: Optional[str] = None
    custom_apps: Optional[List[Dict[str, Any]]] = []
