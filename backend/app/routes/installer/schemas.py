from pydantic import BaseModel
from typing import Optional

class ServerCredentials(BaseModel):
    host: str
    username: str
    password: str

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

class ChatwootInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    s3_bucket_name: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_region: Optional[str] = None
    s3_endpoint: Optional[str] = None
    chatwoot_base_url: str
    overwrite: bool = False

class ChatwootAdminCreateRequest(ServerCredentials):
    stack_name: str
    admin_email: str
    admin_password: str
    full_name: str
    company_name: str

class EnvUpdate(BaseModel):
    host: str
    username: str
    password: str
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
    username: str
    password: str
    chatwoot_base_url: str 
    postgres_password: str
    super_admin_email: str
    secret_key: Optional[str] = None

class GerenciadorWhatsAppInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    super_admin_email: str
    backend_domain: str
    frontend_domain: str
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
