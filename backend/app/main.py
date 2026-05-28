from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from app.installer import install_docker, init_swarm, create_network, install_traefik, install_portainer, check_docker_installed, check_swarm_active, check_network_exists, check_stack_exists, install_redis, install_postgres, install_rabbitmq, install_chatwoot, verify_ssh_connection, change_ssh_password, install_ai_agent_manager, install_zapvoice, install_gerenciador_whatsapp
from app.dns_manager import list_zones, create_dns_record, list_dns_records, delete_dns_record, update_dns_record
from app.database import init_db, save_setting, get_setting, get_all_settings, save_stack_credentials
from app.portainer import get_portainer_token
import logging
import os
import sys

# Configura logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializa Banco de Dados
init_db()

# Inicializa FastAPI
app = FastAPI()

class SettingsRequest(BaseModel):
    cloudflare_token: Optional[str] = None
    portainer_user: Optional[str] = None
    portainer_password: Optional[str] = None
    default_domain_id: Optional[str] = None
    default_domain_name: Optional[str] = None
    stack_export_path: Optional[str] = None
    host: Optional[str] = None

class PortainerTokenRequest(BaseModel):
    portainer_url: str
    username: str
    password: str

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ServerCredentials(BaseModel):
    host: str
    username: str
    password: str

class VerifyConnectionRequest(BaseModel):
    host: str
    username: str
    password: str

class PasswordChangeRequest(BaseModel):
    host: str
    username: str
    password: str
    new_password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ServerCreateRequest(BaseModel):
    name: str
    host: str
    username: str
    password: str

class ServerUpdateRequest(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

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

class ChatwootAdminCreateRequest(BaseModel):
    host: str
    username: str
    password: str
    stack_name: str
    admin_email: str
    admin_password: str
    full_name: str
    company_name: str

@app.post("/stacks/chatwoot/create-admin")
def create_chatwoot_admin_endpoint(req: ChatwootAdminCreateRequest):
    """
    Cria um administrador no Chatwoot via terminal.
    """
    try:
        from app.installer import create_chatwoot_admin_terminal
        result = create_chatwoot_admin_terminal(
            req.host, req.username, req.password, 
            req.stack_name, req.admin_email, req.admin_password,
            req.full_name, req.company_name
        )
        return result
    except Exception as e:
        logger.error(f"Erro ao criar admin Chatwoot: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StackCredentialsUpdateRequest(BaseModel):
    host: str
    stack_name: str
    admin_email: str
    admin_password: str
    version: Optional[str] = None

@app.post("/change-server-password")
def change_server_password_endpoint(req: PasswordChangeRequest):
    """
    Altera a senha SSH do servidor.
    """
    try:
        result = change_ssh_password(req.host, req.username, req.password, req.new_password)
        return result
    except Exception as e:
        logging.error(f"Falha ao alterar senha do servidor: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/login")
def login_endpoint(req: LoginRequest):
    """
    Autenticação mestre da aplicação via variáveis de ambiente.
    """
    admin_email = os.getenv("ADMIN_EMAIL", "admin@admin.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    
    if req.email == admin_email and req.password == admin_password:
        return {"status": "success", "message": "Login realizado com sucesso!"}
    else:
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

@app.get("/servers")
def list_servers_endpoint():
    """
    Lista todos os servidores VPS cadastrados no banco local.
    """
    from app.database import get_servers
    return get_servers()

@app.post("/servers")
def add_server_endpoint(req: ServerCreateRequest):
    """
    Cadastra um novo servidor VPS no banco local.
    """
    from app.database import add_server
    try:
        server_id = add_server(req.name, req.host, req.username, req.password)
        return {"status": "success", "id": server_id, "message": "Servidor adicionado com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao adicionar servidor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/servers/{server_id}")
def delete_server_endpoint(server_id: int):
    """
    Remove um servidor VPS do banco local.
    """
    from app.database import delete_server
    try:
        delete_server(server_id)
        return {"status": "success", "message": "Servidor removido com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao remover servidor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/servers/{server_id}")
def update_server_endpoint(server_id: int, req: ServerUpdateRequest):
    """
    Atualiza um servidor VPS no banco local.
    """
    from app.database import update_server
    try:
        update_server(server_id, req.name, req.host, req.username, req.password)
        logger.info(f"Servidor {server_id} atualizado com sucesso no banco de dados.")
        return {"status": "success", "message": "Servidor atualizado com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao atualizar servidor {server_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update-stack-credentials")
def update_stack_credentials_endpoint(req: StackCredentialsUpdateRequest):
    from app.database import save_stack_credentials, save_setting
    try:
        save_stack_credentials(req.host, req.stack_name, req.admin_email, req.admin_password)
        if req.version is not None:
            save_setting(f"stack_version_{req.stack_name}", req.version, req.host)
        return {"status": "success", "message": "Credenciais atualizadas com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao atualizar credenciais da stack: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Logging já configurado no início do arquivo (linha 12)

# Mount static files
@app.get("/settings")
async def get_system_settings(host: Optional[str] = None):
    # Se um host foi passado, pegamos as configurações específicas dele
    settings = get_all_settings(host)
    # Adiciona flag se o token está vindo do .env
    settings['cloudflare_token_env'] = bool(os.getenv("CLOUDFLARE_API_TOKEN"))
    return settings

@app.post("/settings")
async def save_system_settings(req: SettingsRequest):
    try:
        host = req.host or 'global'
        if req.cloudflare_token:
            token = req.cloudflare_token.strip()
            save_setting("cloudflare_token", token, 'global')
            
        if req.portainer_user:
            save_setting("portainer_user", req.portainer_user, host)
            
        if req.portainer_password:
            save_setting("portainer_password", req.portainer_password, host)

        # Sincroniza com stack_credentials se for Portainer
        if req.portainer_user or req.portainer_password:
            p_user = req.portainer_user or get_setting("portainer_user", host)
            p_pass = req.portainer_password or get_setting("portainer_password", host)
            save_stack_credentials(host, "portainer", p_user, p_pass)

        if req.default_domain_id is not None:
            save_setting("default_domain_id", req.default_domain_id, host)
            
        if req.default_domain_name is not None:
            save_setting("default_domain_name", req.default_domain_name, host)

        if req.stack_export_path is not None:
            save_setting("stack_export_path", req.stack_export_path, host)

        return {"status": "success", "message": "Configurações salvas com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao salvar configurações: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/portainer/token")
async def generate_portainer_token_endpoint(req: PortainerTokenRequest):
    try:
        token = get_portainer_token(req.portainer_url, req.username, req.password, verify=False)
        # Se validar, salvamos automaticamente o token gerado (opcional) ou apenas retornamos sucesso
        # O pedido do usuário diz "gerar um token dele de forma 100% automatica". 
        # Vamos salvar o token gerado no banco para uso futuro se precisar.
        # Mas tokens expiram. Melhor salvar as credenciais (feito no /settings) e gerar token on-demand.
        return {"status": "success", "token": token, "message": "Autenticação no Portainer realizada com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao gerar token do Portainer: {e}")
        raise HTTPException(status_code=400, detail=str(e))
if getattr(sys, 'frozen', False):
    # If the application is run as a bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app 
    # path into variable _MEIPASS'.
    # We assume 'app/static' is added to the bundle.
    base_dir = os.path.join(sys._MEIPASS, "app")
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

static_dir = os.path.join(base_dir, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

class CloudflareAuth(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None

class DNSRecordRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    name: str # Subdomain or @
    content: str # IP
    proxied: bool = True

@app.post("/cloudflare/zones")
def get_cf_zones(auth: CloudflareAuth):
    try:
        # Prioridade absoluta: .env > Token enviado > Banco de Dados (Global)
        raw_token = os.getenv("CLOUDFLARE_API_TOKEN") or auth.api_token or get_setting("cloudflare_token", 'global')
        if not raw_token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado. Adicione CLOUDFLARE_API_TOKEN no .env ou vá em Configurações > Cloudflare API.")
            
        token = raw_token.strip()
        zones = list_zones(token)
        return {"zones": zones}
    except Exception as e:
        # Log error for debugging
        logging.error(f"Error fetching zones: {e}")
        # Return 400 so frontend catches it
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/cloudflare/create")
def create_cf_record(req: DNSRecordRequest):
    try:
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")
            
        result = create_dns_record(
            token, 
            req.zone_id, 
            req.name, 
            req.content, 
            req.proxied
        )
        return {"message": "Registro DNS criado com sucesso!", "details": result}
    except Exception as e:
        logging.error(f"Error creating record: {e}")
        raise HTTPException(status_code=400, detail=str(e))




class DNSListRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    ip_filter: Optional[str] = None



@app.post("/cloudflare/records")
def list_cf_records(req: DNSListRequest):
    try:
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")

        records = list_dns_records(token, req.zone_id, req.ip_filter)
        return {"records": records}
    except Exception as e:
        logging.error(f"Error listing records: {e}")
        raise HTTPException(status_code=400, detail=str(e))


class DNSRecordDeleteRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    record_id: str

@app.post("/cloudflare/delete")
def delete_cf_record(req: DNSRecordDeleteRequest):
    try:
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")
            
        result = delete_dns_record(token, req.zone_id, req.record_id)
        return {"message": "Registro deletado com sucesso", "details": result}
    except Exception as e:
        logging.error(f"Error deleting record: {e}")
        raise HTTPException(status_code=400, detail=str(e))

class DNSRecordUpdateRequest(BaseModel):
    api_token: Optional[str] = None
    host: Optional[str] = None
    zone_id: str
    record_id: str
    name: str
    content: str
    proxied: bool = True

@app.post("/cloudflare/update")
def update_cf_record(req: DNSRecordUpdateRequest):
    try:
        token = os.getenv("CLOUDFLARE_API_TOKEN") or req.api_token or get_setting("cloudflare_token", 'global')
        if not token:
            raise HTTPException(status_code=400, detail="Token da Cloudflare não configurado.")

        result = update_dns_record(
            token, 
            req.zone_id, 
            req.record_id, 
            req.name, 
            req.content, 
            req.proxied
        )
        return {"message": "Registro atualizado com sucesso", "details": result}
    except Exception as e:
        logging.error(f"Error updating record: {e}")
        raise HTTPException(status_code=400, detail=str(e))


class NetworkCreateRequest(ServerCredentials):
    network_name: str = "network_swarm_public"
    overwrite: bool = False


@app.post("/verify-connection")
async def verify_connection(credentials: ServerCredentials):
    """
    Verifica APENAS se é possível conectar via SSH (Login).
    Rápido: ~1-3 segundos.
    """
    import time
    import asyncio
    start_time = time.time()
    
    logging.info("="*60)
    logging.info(f"[ENDPOINT] /verify-connection recebido")
    logging.info(f"[ENDPOINT] Host: {credentials.host}")
    logging.info(f"[ENDPOINT] Username: {credentials.username}")
    logging.info(f"[ENDPOINT] Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    from app.installer import verify_ssh_connection
    
    try:
        logging.info(f"[ENDPOINT] Chamando verify_ssh_connection em thread separado...")
        # Run SSH operation in thread pool to avoid blocking event loop
        result = await asyncio.to_thread(
            verify_ssh_connection, 
            credentials.host, 
            credentials.username, 
            credentials.password
        )
        
        elapsed = time.time() - start_time
        
        if result:
            logging.info(f"[ENDPOINT] ✓ Conexão bem-sucedida em {elapsed:.2f}s")
            return {"message": "Conectado com sucesso!"}
        else:
            logging.error(f"[ENDPOINT] ✗ Conexão falhou em {elapsed:.2f}s")
            raise HTTPException(status_code=401, detail="Falha na autenticação ou host inacessível")
            
    except HTTPException:
        raise
    except Exception as e:
        elapsed = time.time() - start_time
        logging.error(f"[ENDPOINT] ✗ Exceção após {elapsed:.2f}s: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

import time

_system_status_cache = {}
_system_status_locks = {}
CACHE_TTL_SECONDS = 15

@app.post("/system-status")
async def system_status(credentials: ServerCredentials):
    """
    Verifica o estado completo do sistema (Docker, Swarm, Apps).
    Pesado: ~5-15 segundos.
    """
    import asyncio
    
    cache_key = f"{credentials.host}_{credentials.username}"
    if cache_key not in _system_status_locks:
        _system_status_locks[cache_key] = asyncio.Lock()
        
    async with _system_status_locks[cache_key]:
        now = time.time()
        if cache_key in _system_status_cache:
            cached_data, timestamp = _system_status_cache[cache_key]
            if now - timestamp < CACHE_TTL_SECONDS:
                return cached_data

        print(f"DEBUG: Handling /system-status for {credentials.host}")
        logging.info(f"Fetching full system status for: {credentials.host}")
        from app.installer import get_full_system_status
        
        try:
            print("DEBUG: Calling get_full_system_status in thread...")
            # Run SSH operation in thread pool to avoid blocking event loop
            status_data = await asyncio.to_thread(
                get_full_system_status, 
                credentials.host, 
                credentials.username, 
                credentials.password
            )
            print("DEBUG: get_full_system_status returned.")
        except Exception as e:
            logger.error(f"Error in system_status (Server Offline?): {e}")
            # Retorna um estado offline em vez de 500 para não travar o frontend
            return {
                "offline": True,
                "error_message": str(e),
                "system_status": {
                    "docker": False,
                    "swarm": False,
                    "network": False,
                    "ctop": False
                },
                "detected_stacks": [],
                "stack_urls": {},
                "stack_credentials": {},
                "stack_versions": {}
            }
        
        response_data = {
            "system_status": {
                "docker": status_data.get("docker"),
                "swarm": status_data.get("swarm", False),
                "network": status_data.get("network", False),
                "ctop": status_data.get("ctop", False)
            },
            "detected_stacks": status_data.get("active_stacks", []),
            "stack_urls": status_data.get("stack_urls", {}),
            "stack_credentials": status_data.get("stack_credentials", {}),
            "stack_versions": status_data.get("stack_versions", {})
        }
        
        # Inject externally installed stacks and versions
        try:
            from app.database import get_all_settings, get_stack_credentials
            db_settings = get_all_settings(credentials.host)
            
            detected_stacks = response_data["detected_stacks"]
            stack_urls = response_data["stack_urls"]
            stack_credentials = response_data["stack_credentials"]
            stack_versions = response_data["stack_versions"]
            
            # 1. Inject versions and fallback domains for standard detected/active stacks
            for s_name in detected_stacks:
                # Version
                ver_key = f"stack_version_{s_name}"
                ver = db_settings.get(ver_key)
                if ver:
                    stack_versions[s_name] = ver
                
                # Fallback URL if inspect failed/timed out
                if s_name not in stack_urls or not stack_urls[s_name]:
                    stored_domain = db_settings.get(f"stack_domain_{s_name}")
                    if stored_domain:
                        domains = [d.strip() for d in stored_domain.split(",") if d.strip()]
                        stack_urls[s_name] = domains
            
            # 2. Inject external stacks
            for key, val in db_settings.items():
                if key.startswith("external_installed_") and val == "true":
                    s_name = key.replace("external_installed_", "")
                    if s_name not in detected_stacks:
                        detected_stacks.append(s_name)
                    
                    # Get external URL (fallback to stack_domain if set)
                    url_key = f"external_urls_{s_name}"
                    ext_url = db_settings.get(url_key) or db_settings.get(f"stack_domain_{s_name}")
                    if ext_url:
                        if s_name not in stack_urls:
                            stack_urls[s_name] = []
                        # Split in case it has multiple values
                        ext_domains = [d.strip() for d in ext_url.split(",") if d.strip()]
                        for d in ext_domains:
                            if d not in stack_urls[s_name]:
                                stack_urls[s_name].append(d)
                            
                    # Get external credentials
                    creds = get_stack_credentials(credentials.host, s_name)
                    if creds:
                        stack_credentials[s_name] = creds

                    # Get external version
                    ver_key = f"external_version_{s_name}"
                    ext_ver = db_settings.get(ver_key) or db_settings.get(f"stack_version_{s_name}")
                    if ext_ver:
                        stack_versions[s_name] = ext_ver
        except Exception as db_err:
            logger.error(f"Erro ao injetar stacks externas no status: {db_err}")
        
        _system_status_cache[cache_key] = (response_data, time.time())
        return response_data

# Dicionário para armazenar o status das instalações
install_status = {}

def run_install_docker_task(host, username, password):
    install_status['docker'] = {'status': 'running', 'message': 'Iniciando instalação do Docker...'}
    
    def update_status(msg):
        install_status['docker'] = {'status': 'running', 'message': msg}
        
    try:
        from app.installer import install_docker, update_docker_version_config
        
        # 1. Instala o Docker (com updates de status)
        result = install_docker(host, username, password, status_callback=update_status)
        
        # 2. Atualiza a configuração da versão da API (Automático)
        install_status['docker'] = {'status': 'running', 'message': 'Atualizando configuração do Docker...'}
        update_docker_version_config(host, username, password)
        
        install_status['docker'] = {'status': 'success', 'message': 'Docker instalado e configurado com sucesso!'}
    except Exception as e:
        logger.error(f"Erro na task de instalação do Docker: {e}")
        install_status['docker'] = {'status': 'error', 'message': str(e)}

@app.post("/install-docker")
def trigger_docker_install(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Inicia o processo de instalação do Docker em um servidor remoto.
    """
    try:
        # Verifica se o Docker já está instalado
        existing_version = check_docker_installed(credentials.host, credentials.username, credentials.password)
        if existing_version:
             return {"message": f"Docker já está instalado com sucesso. Versão: {existing_version}"}

        # Inicia a task com o wrapper para atualizar o status
        install_status['docker'] = {'status': 'pending', 'message': 'Iniciando instalação...'}
        background_tasks.add_task(run_install_docker_task, credentials.host, credentials.username, credentials.password)
        return {"message": f"Instalação do Docker iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao iniciar a instalação: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_upgrade_docker_task(host, username, password):
    install_status['docker-upgrade'] = {'status': 'running', 'message': 'Atualizando Docker...'}
    try:
        from app.installer import upgrade_docker_engine
        result = upgrade_docker_engine(host, username, password)
        install_status['docker-upgrade'] = {'status': 'success', 'message': result.get('message', 'Docker atualizado com sucesso!')}
    except Exception as e:
        logger.error(f"Erro na task de atualização do Docker: {e}")
        install_status['docker-upgrade'] = {'status': 'error', 'message': str(e)}

def run_init_swarm_task(host, username, password, advertise_addr):
    install_status['swarm'] = {'status': 'running', 'message': 'Inicializando Swarm...'}
    try:
        from app.installer import init_swarm
        result = init_swarm(host, username, password, advertise_addr)
        install_status['swarm'] = {'status': 'success', 'message': result.get('message', 'Swarm inicializado com sucesso!')}
    except Exception as e:
        logger.error(f"Erro na task de Swarm: {e}")
        install_status['swarm'] = {'status': 'error', 'message': str(e)}

def run_create_network_task(host, username, password, network_name):
    install_status['network'] = {'status': 'running', 'message': 'Criando rede...'}
    try:
        from app.installer import create_network
        result = create_network(host, username, password, network_name)
        install_status['network'] = {'status': 'success', 'message': result.get('message', 'Rede criada com sucesso!')}
    except Exception as e:
        logger.error(f"Erro na task de Rede: {e}")
        install_status['network'] = {'status': 'error', 'message': str(e)}

def run_install_ctop_task(host, username, password):
    install_status['ctop'] = {'status': 'running', 'message': 'Instalando Ctop...'}
    try:
        from app.installer import install_ctop
        result = install_ctop(host, username, password)
        install_status['ctop'] = {'status': 'success', 'message': result.get('message', 'Ctop instalado com sucesso!')}
    except Exception as e:
        logger.error(f"Erro na task de Ctop: {e}")
        install_status['ctop'] = {'status': 'error', 'message': str(e)}


@app.post("/upgrade-docker")
def trigger_docker_upgrade(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Inicia o processo de atualização do Docker Engine em um servidor remoto.
    """
    try:
        background_tasks.add_task(run_upgrade_docker_task, credentials.host, credentials.username, credentials.password)
        return {"message": f"Atualização do Docker iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao iniciar a atualização: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/init-swarm")
def trigger_swarm_init(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Inicializa o Docker Swarm em um servidor remoto.
    """
    try:
        # Verifica se o Swarm já está ativo
        if check_swarm_active(credentials.host, credentials.username, credentials.password):
             return {"message": f"Swarm já está ativo e inicializado em {credentials.host}"}

        # Usa o próprio IP do host como advertise_addr
        install_status['swarm'] = {'status': 'pending', 'message': 'Iniciando Swarm...'}
        background_tasks.add_task(run_init_swarm_task, credentials.host, credentials.username, credentials.password, credentials.host)
        return {"message": f"Inicialização do Swarm iniciada para {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao inicializar o swarm: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-network")
def trigger_create_network(request: NetworkCreateRequest, background_tasks: BackgroundTasks):
    """
    Cria uma rede overlay Docker em um servidor remoto.
    """
    try:
        # Verifica se a rede já existe
        if check_network_exists(request.host, request.username, request.password, request.network_name) and not request.overwrite:
             return {"message": f"A rede '{request.network_name}' já existe em {request.host}. Use 'overwrite': true para forçar."}

        install_status['network'] = {'status': 'pending', 'message': 'Criando rede...'}
        background_tasks.add_task(run_create_network_task, request.host, request.username, request.password, request.network_name)
        return {"message": f"Criação da rede iniciada para {request.network_name} em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao criar a rede: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/install-ctop")
def trigger_ctop_install(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Instala o Ctop em um servidor remoto.
    """
    try:
        install_status['ctop'] = {'status': 'pending', 'message': 'Iniciando instalação do Ctop...'}
        background_tasks.add_task(run_install_ctop_task, credentials.host, credentials.username, credentials.password)
        return {"message": f"Instalação do Ctop iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao iniciar instalação do Ctop: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/atualiza_versao_docker")
def trigger_update_docker_version(credentials: ServerCredentials, background_tasks: BackgroundTasks):
    """
    Aplica a correção de versão da API do Docker (DOCKER_MIN_API_VERSION=1.24) para compatibilidade.
    """
    try:
        # Verifica se o Docker está instalado
        existing_version = check_docker_installed(credentials.host, credentials.username, credentials.password)
        if not existing_version:
             return {"message": f"Docker não está instalado em {credentials.host}. Instale o Docker primeiro."}

        from app.installer import update_docker_version_config
        background_tasks.add_task(update_docker_version_config, credentials.host, credentials.username, credentials.password)
        return {"message": f"Atualização da configuração do Docker iniciada em {credentials.host}"}
    except Exception as e:
        logger.error(f"Falha ao atualizar configuração do Docker: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_generic_install_task(service_key, install_func, host, *args, stack_name=None, **kwargs):
    logger.info(f"TASK: Iniciando {service_key} em {host}")
    install_status[service_key] = {'status': 'running', 'message': f'Instalando {service_key}...'}
    try:
        result = install_func(host, *args, **kwargs)
        logger.info(f"TASK: Finalizado {service_key}. Result: {result}")
        msg = f'{service_key.capitalize()} instalado com sucesso!'
        install_status[service_key] = {'status': 'success', 'message': msg}
        
        if isinstance(result, dict):
            install_status[service_key].update(result)
            
            # Salva credenciais no banco local para persistência
            if "credentials" in result:
                creds = result["credentials"]
                # Se stack_name não for passado, usa service_key
                target_stack = stack_name or service_key
                save_stack_credentials(host, target_stack, creds.get("user"), creds.get("password"))
                logger.info(f"TASK: Credenciais de {target_stack} salvas no banco para {host}")

    except Exception as e:
        logger.error(f"TASK ERROR: Erro na task de {service_key}: {e}")
        install_status[service_key] = {'status': 'error', 'message': str(e)}

class RedisInstallRequest(ServerCredentials):
    portainer_api_key: Optional[str] = None

@app.post("/install-redis")
def trigger_install_redis(request: RedisInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Redis.
    """
    try:
        # Verifica se a stack já existe
        if check_stack_exists(request.host, request.username, request.password, "redis"):
             return {"message": f"A stack 'redis' já está rodando em {request.host}"}

        if check_stack_exists(request.host, request.username, request.password, "redis"):
             return {"message": f"A stack 'redis' já está rodando em {request.host}"}

        # Revertendo para instalação padrão via SSH (docker stack deploy)
        from app.installer import install_redis
        install_status['redis'] = {'status': 'pending', 'message': 'Iniciando instalação do Redis via SSH...'}
        background_tasks.add_task(run_generic_install_task, 'redis', install_redis, request.host, request.username, request.password, stack_name="redis")
        return {"message": f"Instalação do Redis via SSH iniciada em {request.host}"}
            
    except Exception as e:
        logger.error(f"Falha ao instalar Redis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class PortainerInstallRequest(ServerCredentials):
    portainer_host: str
    overwrite: bool = False

@app.post("/install-portainer")
def trigger_install_portainer(request: PortainerInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Portainer em um servidor remoto.
    """
    try:
        from app.installer import get_active_stacks, install_portainer
        
        # Verifica se a stack já existe
        active_stacks = get_active_stacks(request.host, request.username, request.password)
        
        if "portainer" in active_stacks and not request.overwrite:
             return {
                 "message": f"A stack 'portainer' já está rodando em {request.host}. Use 'overwrite': true para forçar a reinstalação.",
                 "detected_stacks": active_stacks
             }

        install_status['portainer'] = {'status': 'pending', 'message': 'Iniciando instalação do Portainer...'}
        background_tasks.add_task(run_generic_install_task, 'portainer', install_portainer, request.host, request.username, request.password, request.portainer_host, stack_name="portainer")
        return {"message": f"Instalação do Portainer iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar o Portainer: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class TraefikInstallRequest(ServerCredentials):
    email: str
    overwrite: bool = False

@app.post("/install-traefik")
def trigger_install_traefik(request: TraefikInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Traefik em um servidor remoto.
    """
    try:
        # Verifica se a stack já existe
        if check_stack_exists(request.host, request.username, request.password, "traefik") and not request.overwrite:
             return {"message": f"A stack 'traefik' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        install_status['traefik'] = {'status': 'pending', 'message': 'Iniciando instalação do Traefik...'}
        background_tasks.add_task(run_generic_install_task, 'traefik', install_traefik, request.host, request.username, request.password, request.email, stack_name="traefik")
        return {"message": f"Instalação do Traefik iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar o Traefik: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class PostgresInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    overwrite: bool = False

@app.post("/install-postgres")
def trigger_install_postgres(request: PostgresInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Postgres em um servidor remoto.
    """
    try:
        # Verifica se a stack já existe
        if check_stack_exists(request.host, request.username, request.password, "postgres") and not request.overwrite:
             return {"message": f"A stack 'postgres' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        # Geração automática de senha se não fornecida
        if not request.postgres_password:
            import secrets
            request.postgres_password = secrets.token_urlsafe(32)
            logger.info(f"Senha do Postgres gerada automaticamente: {request.postgres_password}")

        from app.installer import install_postgres
        install_status['postgres'] = {'status': 'pending', 'message': 'Iniciando instalação do Postgres...'}
        background_tasks.add_task(run_generic_install_task, 'postgres', install_postgres, request.host, request.username, request.password, request.postgres_password, stack_name="postgres")
        return {"message": f"Instalação do Postgres iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Postgres: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RabbitMQInstallRequest(ServerCredentials):
    rabbit_user: Optional[str] = None
    rabbit_password: Optional[str] = None
    rabbit_base_url: str
    overwrite: bool = False

@app.post("/install-rabbitmq")
def trigger_install_rabbitmq(request: RabbitMQInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do RabbitMQ em um servidor remoto.
    """
    try:
        # Verifica se a stack já existe
        if check_stack_exists(request.host, request.username, request.password, "rabbitmq") and not request.overwrite:
             return {"message": f"A stack 'rabbitmq' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        from app.installer import install_rabbitmq
        install_status['rabbitmq'] = {'status': 'pending', 'message': 'Iniciando instalação do RabbitMQ...'}
        background_tasks.add_task(run_generic_install_task, 'rabbitmq', install_rabbitmq, request.host, request.username, request.password, request.rabbit_user, request.rabbit_password, request.rabbit_base_url, stack_name="rabbitmq")
        return {"message": f"Instalação do RabbitMQ iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar RabbitMQ: {e}")
        raise HTTPException(status_code=500, detail=str(e))



class ChatwootInstallRequest(ServerCredentials):
    postgres_password: Optional[str] = None
    s3_bucket_name: Optional[str] = None
    s3_access_key_id: Optional[str] = None
    s3_secret_access_key: Optional[str] = None
    s3_region: Optional[str] = None
    s3_endpoint: Optional[str] = None
    chatwoot_base_url: str
    overwrite: bool = False

@app.post("/install-chatwoot")
def trigger_install_chatwoot(request: ChatwootInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy das stacks do Chatwoot (Admin e Sidekiq) em um servidor remoto.
    """
    try:
        from app.database import save_setting
        save_setting("stack_domain_chatwoot_admin", request.chatwoot_base_url, request.host)
        
        # Verifica se a stack já existe (incluindo nomes dinâmicos com prefixo)
        from app.installer import get_active_stacks
        active_stacks = get_active_stacks(request.host, request.username, request.password)
        existing_stack = next((s for s in active_stacks if s == "chatwoot_admin" or s.startswith("chatwoot_admin_")), None)
        
        if existing_stack and not request.overwrite:
             return {"message": f"A stack '{existing_stack}' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        if not request.postgres_password:
            try:
                from app.installer import get_stack_env_vars
                pg_env = get_stack_env_vars(request.host, request.username, request.password, "postgres")
                request.postgres_password = pg_env.get("POSTGRES_PASSWORD")
            except Exception as e:
                logger.warning(f"Não foi possível obter senha do Postgres para Chatwoot: {e}")

        # Garante que postgres_password não seja None
        request.postgres_password = request.postgres_password or ""

        from app.installer import install_chatwoot
        install_status['chatwoot'] = {'status': 'pending', 'message': 'Iniciando instalação do Chatwoot...'}
        background_tasks.add_task(
            run_generic_install_task, 
            'chatwoot', 
            install_chatwoot, 
            request.host, 
            request.username, 
            request.password, 
            request.postgres_password, 
            request.s3_bucket_name,
            request.s3_access_key_id,
            request.s3_secret_access_key,
            request.s3_region,
            request.s3_endpoint,
            request.chatwoot_base_url,
            overwrite=request.overwrite,
            stack_name="chatwoot_admin"
        )
        return {"message": f"Instalação do Chatwoot iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Chatwoot: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class EnvUpdate(BaseModel):
    host: str
    username: str
    password: str
    stack_name: str
    env_vars: dict

@app.post("/get-stack-env/{stack_name}")
def get_stack_env(stack_name: str, credentials: ServerCredentials):
    """
    Obtém as variáveis de ambiente de uma stack.
    """
    from app.installer import get_stack_env_vars
    try:
        env_vars = get_stack_env_vars(credentials.host, credentials.username, credentials.password, stack_name)
        return {"env_vars": env_vars}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update-stack-env")
def update_stack_env(data: EnvUpdate):
    """
    Atualiza as variáveis de ambiente de uma stack.
    """
    from app.installer import update_stack_env_vars
    try:
        result = update_stack_env_vars(data.host, data.username, data.password, data.stack_name, data.env_vars)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RestartStackRequest(ServerCredentials):
    stack_name: str

@app.post("/restart-stack")
def trigger_restart_stack(request: RestartStackRequest, background_tasks: BackgroundTasks):
    """
    Reinicia todos os serviços de uma stack específica.
    """
    try:
        from app.installer import restart_stack_services
        background_tasks.add_task(restart_stack_services, request.host, request.username, request.password, request.stack_name)
        return {"message": f"Reinício da stack '{request.stack_name}' iniciado em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao reiniciar stack: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

@app.post("/install-ai-agent-manager")
def trigger_install_ai_agent_manager(request: AIAgentManagerInstallRequest, background_tasks: BackgroundTasks):
    """
    Faz o deploy da stack do Gerente de Agente de IA em um servidor remoto.
    """
    try:
        from app.database import save_setting
        save_setting("stack_domain_agentes", f"{request.domain_backend},{request.domain_frontend}", request.host)
        
        from app.installer import get_active_stacks
        active_stacks = get_active_stacks(request.host, request.username, request.password)
        
        # Verifica se a stack já existe
        if "agentes" in active_stacks and not request.overwrite:
             return {"message": f"A stack 'agentes' já está rodando em {request.host}. Use 'overwrite': true para forçar."}

        # Tenta buscar a senha do Postgres se não for enviada
        if not request.postgres_password:
            try:
                from app.installer import get_stack_env_vars
                pg_env = get_stack_env_vars(request.host, request.username, request.password, "postgres")
                request.postgres_password = pg_env.get("POSTGRES_PASSWORD")
            except Exception as e:
                logger.warning(f"Não foi possível obter senha do Postgres para AI Agent Manager: {e}")

        from app.installer import install_ai_agent_manager
        install_status['ai_agent_manager'] = {'status': 'pending', 'message': 'Iniciando instalação do Gerente de Agente de IA...'}
        background_tasks.add_task(run_generic_install_task, 'ai_agent_manager', install_ai_agent_manager, 
                                 request.host, request.username, request.password, 
                                 request.postgres_password, request.openai_api_key, 
                                 request.domain_backend, request.domain_frontend,
                                 request.agent_api_key, request.google_client_id,
                                 request.google_client_secret, request.google_redirect_uri,
                                 request.gunicorn_workers, stack_name="agentes")
        
        return {"message": f"Instalação do Gerente de Agente de IA iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar AI Agent Manager: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/install-zapvoice")
def install_zapvoice_endpoint(request: ZapVoiceRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para instalar o ZapVoice em background.
    """
    try:
        from app.database import save_setting
        save_setting("stack_domain_zapvoice", request.chatwoot_base_url, request.host)
        
        install_status['zapvoice'] = {'status': 'pending', 'message': 'Iniciando instalação do ZapVoice...'}
        background_tasks.add_task(run_generic_install_task, 'zapvoice', install_zapvoice, 
                                 request.host, request.username, request.password, 
                                 request.postgres_password, request.chatwoot_base_url,
                                 request.super_admin_email, request.secret_key, stack_name="zapvoice")
        
        return {"message": f"Instalação do ZapVoice iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar ZapVoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/install-gerenciador-whatsapp")
def install_gerenciador_whatsapp_endpoint(request: GerenciadorWhatsAppInstallRequest, background_tasks: BackgroundTasks):
    """
    Endpoint para instalar o Gerenciador Grupo WhatsApp em background.
    """
    try:
        from app.database import save_setting
        save_setting("stack_domain_gerenciador_whatsapp", f"{request.backend_domain},{request.frontend_domain}", request.host)
        
        # Tenta buscar a senha do Postgres se não for enviada
        if not request.postgres_password:
            try:
                from app.installer import get_stack_env_vars
                pg_env = get_stack_env_vars(request.host, request.username, request.password, "postgres")
                request.postgres_password = pg_env.get("POSTGRES_PASSWORD")
            except Exception as e:
                logger.warning(f"Não foi possível obter senha do Postgres para Gerenciador Grupo WhatsApp: {e}")

        from app.installer import install_gerenciador_whatsapp
        install_status['gerenciador_whatsapp'] = {'status': 'pending', 'message': 'Iniciando instalação do Gerenciador Grupo WhatsApp...'}
        background_tasks.add_task(run_generic_install_task, 'gerenciador_whatsapp', install_gerenciador_whatsapp, 
                                 request.host, request.username, request.password, 
                                 request.postgres_password, request.super_admin_email,
                                 request.backend_domain, request.frontend_domain, stack_name="gerenciador_whatsapp")
        
        return {"message": f"Instalação do Gerenciador Grupo WhatsApp iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao instalar Gerenciador Grupo WhatsApp: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class UninstallStackRequest(ServerCredentials):
    stack_id: str
    stack_name: str

@app.post("/uninstall-stack")
def trigger_uninstall_stack(request: UninstallStackRequest, background_tasks: BackgroundTasks):
    """
    Inicia o processo de desinstalação completa de uma stack (Zero Bala).
    """
    try:
        from app.database import get_setting, save_setting, delete_stack_credentials
        is_external = get_setting(f"external_installed_{request.stack_id}", request.host) == "true"
        
        if is_external:
            logger.info(f"Removendo associação de stack externa: Stack={request.stack_id} no Host={request.host}")
            save_setting(f"external_installed_{request.stack_id}", "false", request.host)
            save_setting(f"external_urls_{request.stack_id}", "", request.host)
            save_setting(f"external_version_{request.stack_id}", "", request.host)
            save_setting(f"stack_domain_{request.stack_id}", "", request.host)
            delete_stack_credentials(request.host, request.stack_id)
            install_status[request.stack_id] = {'status': 'success', 'message': f'Associação externa de {request.stack_id} removida.'}
            return {"message": f"Associação externa de {request.stack_id} removida com sucesso."}
            
        from app.installer import uninstall_stack
        # Clear version and domain setting in database
        save_setting(f"stack_version_{request.stack_id}", "", request.host)
        save_setting(f"stack_domain_{request.stack_id}", "", request.host)
        logger.info(f"SOLICITAÇÃO DE DESINSTALAÇÃO: Stack={request.stack_id}, Name={request.stack_name} no Host={request.host}")
        install_status[request.stack_id] = {'status': 'pending', 'message': f'Iniciando desinstalação de {request.stack_id}...'}
        
        def run_uninstall():
             install_status[request.stack_id] = {'status': 'running', 'message': f'Desinstalando {request.stack_id} (Zero Bala)...'}
             try:
                 result = uninstall_stack(request.host, request.username, request.password, request.stack_id, request.stack_name)
                 install_status[request.stack_id] = {'status': 'success', 'message': result.get('message')}
             except Exception as e:
                 logger.error(f"Erro ao desinstalar {request.stack_id}: {e}")
                 install_status[request.stack_id] = {'status': 'error', 'message': str(e)}

        background_tasks.add_task(run_uninstall)
        return {"message": f"Desinstalação de {request.stack_id} iniciada em {request.host}"}
    except Exception as e:
        logger.error(f"Falha ao desinstalar stack: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class StackDomainUpdateRequest(ServerCredentials):
    stack_name: str
    old_domain: str
    new_domain: str

@app.post("/update-stack-domain")
async def update_stack_domain_endpoint(request: StackDomainUpdateRequest):
    """
    Atualiza o domínio configurado nas labels e variáveis de ambiente de uma stack.
    """
    try:
        from app.database import save_setting
        # Persist domain update in sqlite database
        save_setting(f"stack_domain_{request.stack_name}", request.new_domain, request.host)
        
        from app.installer import update_stack_domain
        import asyncio
        logger.info(f"POST /update-stack-domain recebido para stack '{request.stack_name}'")
        
        # Executa em thread separada
        result = await asyncio.to_thread(
            update_stack_domain,
            request.host,
            request.username,
            request.password,
            request.stack_name,
            request.old_domain,
            request.new_domain
        )
        return result
    except Exception as e:
        logger.error(f"Erro ao processar /update-stack-domain: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ExternalStackRequest(ServerCredentials):
    stack_name: str
    url: str
    email: Optional[str] = None
    password: Optional[str] = None
    version: Optional[str] = None

@app.post("/mark-external-stack")
def mark_external_stack(req: ExternalStackRequest):
    """
    Associa uma stack instalada externamente no banco de dados.
    """
    try:
        from app.database import save_setting, save_stack_credentials
        logger.info(f"POST /mark-external-stack recebido para stack '{req.stack_name}' no Host '{req.host}'")
        
        # Save external status
        save_setting(f"external_installed_{req.stack_name}", "true", req.host)
        save_setting(f"external_urls_{req.stack_name}", req.url, req.host)
        
        # Save version if provided
        if req.version:
            save_setting(f"external_version_{req.stack_name}", req.version, req.host)
        else:
            save_setting(f"external_version_{req.stack_name}", "", req.host)
            
        # Save credentials if provided
        if req.email or req.password:
            save_stack_credentials(req.host, req.stack_name, req.email or "", req.password or "")
            
        logger.info(f"Stack '{req.stack_name}' associada externamente com URL '{req.url}' e versão '{req.version}'")
        return {"status": "success", "message": f"Aplicação '{req.stack_name}' associada externamente com sucesso!"}
    except Exception as e:
        logger.error(f"Erro ao associar stack externa '{req.stack_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/install-status/{service_key}")
def get_install_status(service_key: str):
    """
    Retorna o status da instalação de um serviço.
    """
    status = install_status.get(service_key)
    if not status:
        return {"status": "unknown", "message": "O serviço não está sendo instalado no momento."}
    return status

# ==========================================
# CLUSTER SWARM ENDPOINTS
# ==========================================
class ClusterNodeAddRequest(BaseModel):
    parent_host: str
    parent_username: str
    parent_password: str
    node_id: int
    role: str
    parent_ip: str
    install_docker: bool = True

class ClusterNodeRemoveRequest(BaseModel):
    parent_host: str
    parent_username: str
    parent_password: str
    node_id: int

@app.get("/api/cluster/nodes")
def list_cluster_nodes_endpoint(parent_host: str):
    """
    Retorna os nós associados ao cluster do pai no banco de dados.
    """
    try:
        from app.database import get_cluster_nodes
        logger.info(f"Listando nós cadastrados no banco para o cluster do pai: {parent_host}")
        return get_cluster_nodes(parent_host)
    except Exception as e:
        logger.error(f"Erro ao listar nós do banco de dados: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cluster/status")
async def get_cluster_status_endpoint(parent_host: str, parent_username: str, parent_password: str):
    """
    Verifica se o Swarm está ativo no pai e retorna os status reais dos nós no swarm.
    """
    import asyncio
    try:
        from app.installer import check_swarm_active, get_swarm_nodes_real_status
        logger.info(f"Verificando status real do Swarm para o pai: {parent_host}")
        
        # Executa em thread separada para não travar
        swarm_active = await asyncio.to_thread(check_swarm_active, parent_host, parent_username, parent_password)
        real_nodes = []
        if swarm_active:
            real_nodes = await asyncio.to_thread(get_swarm_nodes_real_status, parent_host, parent_username, parent_password)
            
        return {
            "swarm_active": swarm_active,
            "real_nodes": real_nodes
        }
    except Exception as e:
        logger.error(f"Erro ao consultar status real do Swarm: {e}")
        return {
            "swarm_active": False,
            "real_nodes": [],
            "error": str(e)
        }

def run_cluster_node_add_task(req: ClusterNodeAddRequest):
    """
    Task executada em background para instalar o docker (se necessário) e dar join no swarm.
    """
    install_status['cluster-add'] = {'status': 'running', 'message': 'Iniciando processo de adesão ao cluster...'}
    
    try:
        from app.database import get_server_by_id, add_cluster_node
        from app.installer import check_docker_installed, install_docker, update_docker_version_config, get_swarm_join_tokens, join_swarm_cluster
        
        child = get_server_by_id(req.node_id)
        if not child:
            raise Exception("Servidor filho não encontrado no banco de dados.")
            
        logger.info(f"[CLUSTER] Iniciando adesão do nó {child['name']} ({child['host']}) ao pai {req.parent_host}")
        
        # 1. Instalar Docker se selecionado e necessário
        if req.install_docker:
            install_status['cluster-add'] = {'status': 'running', 'message': f"Verificando Docker no filho {child['name']}..."}
            has_docker = check_docker_installed(child['host'], child['username'], child['password'])
            if not has_docker:
                install_status['cluster-add'] = {'status': 'running', 'message': f"Instalando Docker no filho {child['name']}..."}
                
                def update_status_func(msg):
                    install_status['cluster-add'] = {'status': 'running', 'message': f"Docker ({child['name']}): {msg}"}
                
                install_docker(child['host'], child['username'], child['password'], status_callback=update_status_func)
                update_docker_version_config(child['host'], child['username'], child['password'])
                
        # 2. Obter token de join do pai
        install_status['cluster-add'] = {'status': 'running', 'message': f"Obtendo tokens de join do Swarm pai..."}
        tokens = get_swarm_join_tokens(req.parent_host, req.parent_username, req.parent_password)
        token = tokens.get(req.role)
        if not token:
            raise Exception(f"Token para o papel '{req.role}' não foi gerado pelo Swarm pai.")
            
        # 3. Dar join no swarm
        install_status['cluster-add'] = {'status': 'running', 'message': f"Executando docker swarm join no filho {child['name']}..."}
        join_swarm_cluster(child['host'], child['username'], child['password'], req.parent_ip, token)
        
        # 4. Registrar no banco local
        add_cluster_node(req.parent_host, req.node_id, req.role)
        
        install_status['cluster-add'] = {'status': 'success', 'message': f"Servidor {child['name']} adicionado ao cluster como {req.role} com sucesso!"}
        logger.info(f"[CLUSTER] Adesão concluída com sucesso para o nó {child['name']} ({child['host']})")
    except Exception as e:
        logger.error(f"[CLUSTER] Erro ao adicionar nó ao cluster: {e}")
        install_status['cluster-add'] = {'status': 'error', 'message': str(e)}

@app.post("/api/cluster/nodes")
def add_cluster_node_endpoint(req: ClusterNodeAddRequest, background_tasks: BackgroundTasks):
    """
    Inicia a task assíncrona para instalar o docker e associar o nó ao Swarm.
    """
    try:
        install_status['cluster-add'] = {'status': 'pending', 'message': 'Preparando tarefa de adesão...'}
        background_tasks.add_task(run_cluster_node_add_task, req)
        return {"status": "success", "message": "Processo de adesão iniciado com sucesso no background."}
    except Exception as e:
        logger.error(f"Falha ao iniciar adesão do nó: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def run_cluster_node_remove_task(req: ClusterNodeRemoveRequest):
    """
    Task executada em background para fazer o leave no filho e node rm no pai.
    """
    install_status['cluster-remove'] = {'status': 'running', 'message': 'Iniciando remoção do nó do cluster...'}
    try:
        from app.database import get_server_by_id, remove_cluster_node
        from app.installer import leave_swarm_cluster, remove_swarm_node_from_parent, get_server_hostname
        
        child = get_server_by_id(req.node_id)
        if not child:
            raise Exception("Servidor filho não encontrado no banco de dados.")
            
        logger.info(f"[CLUSTER] Iniciando desassociação do nó {child['name']} ({child['host']}) do pai {req.parent_host}")
        
        # 1. Tentar obter hostname do filho
        node_name = child['name']
        try:
            install_status['cluster-remove'] = {'status': 'running', 'message': 'Obtendo hostname do nó filho...'}
            node_name = get_server_hostname(child['host'], child['username'], child['password'])
        except Exception as he:
            logger.warning(f"Não foi possível obter o hostname real do filho via SSH, usando nome cadastrado: {he}")
            
        # 2. Executar leave no filho
        try:
            install_status['cluster-remove'] = {'status': 'running', 'message': 'Executando docker swarm leave no filho...'}
            leave_swarm_cluster(child['host'], child['username'], child['password'])
        except Exception as le:
            logger.warning(f"Erro ao forçar leave no filho (pode estar offline): {le}")
            
        # 3. Executar rm no pai
        try:
            install_status['cluster-remove'] = {'status': 'running', 'message': 'Forçando remoção do nó no Swarm pai...'}
            remove_swarm_node_from_parent(req.parent_host, req.parent_username, req.parent_password, node_name)
        except Exception as pe:
            logger.warning(f"Erro ao remover nó no Swarm pai (pode não existir): {pe}")
            
        # 4. Remover do banco local
        remove_cluster_node(req.parent_host, req.node_id)
        
        install_status['cluster-remove'] = {'status': 'success', 'message': f"Servidor {child['name']} removido do cluster com sucesso."}
        logger.info(f"[CLUSTER] Desassociação concluída para o nó {child['name']}")
    except Exception as e:
        logger.error(f"[CLUSTER] Erro ao remover nó do cluster: {e}")
        install_status['cluster-remove'] = {'status': 'error', 'message': str(e)}

@app.post("/api/cluster/nodes/remove")
def remove_cluster_node_endpoint(req: ClusterNodeRemoveRequest, background_tasks: BackgroundTasks):
    """
    Inicia a task assíncrona para remover o nó do Swarm.
    """
    try:
        install_status['cluster-remove'] = {'status': 'pending', 'message': 'Preparando tarefa de desassociação...'}
        background_tasks.add_task(run_cluster_node_remove_task, req)
        return {"status": "success", "message": "Processo de remoção iniciado com sucesso no background."}
    except Exception as e:
        logger.error(f"Falha ao iniciar remoção do nó: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/{full_path:path}")
def read_root(full_path: str = ""):
    return FileResponse(os.path.join(static_dir, "index.html"))

