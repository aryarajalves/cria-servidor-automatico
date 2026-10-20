from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
import logging
from app.routes.installer.schemas import AutoSetupRequest
from app.services.auto_setup_service import run_auto_setup_pipeline, get_auto_setup_state, auto_setup_states

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/auto-setup")
def trigger_auto_setup_endpoint(request: AutoSetupRequest, background_tasks: BackgroundTasks):
    """
    Inicia o pipeline de Setup Automático do Servidor em segundo plano.
    """
    try:
        current_state = get_auto_setup_state(request.host)
        if current_state.get("status") == "running":
            raise HTTPException(status_code=400, detail="Já existe um Setup Automático em execução para este servidor.")

        # Dispara em background
        background_tasks.add_task(
            run_auto_setup_pipeline,
            host=request.host,
            username=request.username,
            password=request.password,
            install_docker_flag=request.install_docker,
            install_swarm_flag=request.install_swarm,
            install_network_flag=request.install_network,
            install_ctop_flag=request.install_ctop,
            install_traefik_flag=request.install_traefik,
            traefik_email=request.traefik_email or "aryarajmarketing@gmail.com",
            install_portainer_flag=request.install_portainer,
            portainer_domain=request.portainer_domain,
            portainer_password=request.portainer_password,
            install_postgres_flag=request.install_postgres,
            postgres_password=request.postgres_password,
            install_redis_flag=request.install_redis,
            install_rabbitmq_flag=request.install_rabbitmq,
            rabbitmq_user=request.rabbitmq_user or "admin",
            rabbitmq_password=request.rabbitmq_password,
            install_minio_flag=request.install_minio,
            minio_console_url=request.minio_console_url,
            minio_server_url=request.minio_server_url,
            minio_root_user=request.minio_root_user or "admin",
            minio_root_password=request.minio_root_password,
            custom_apps=request.custom_apps
        )

        return {
            "status": "success",
            "message": f"Setup Automático iniciado com sucesso no servidor {request.host}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao disparar Setup Automático: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/auto-setup-status")
def get_auto_setup_status_endpoint(host: str = Query(..., description="IP do servidor")):
    """
    Consulta o status e logs em tempo real do Setup Automático de um host.
    """
    return get_auto_setup_state(host)

@router.post("/auto-setup-reset")
def reset_auto_setup_status_endpoint(host: str = Query(..., description="IP do servidor")):
    """
    Reseta o estado do Setup Automático para permitir uma nova execução.
    """
    if host in auto_setup_states:
        del auto_setup_states[host]
    return {"status": "success", "message": f"Estado do Setup Automático resetado para o host {host}."}
