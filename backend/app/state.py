# Estado compartilhado para rastreamento de tarefas de instalação e progresso no backend
install_status = {}

# Cache de status de sistema para evitar conexões repetidas seguidas
system_status_cache = {}
system_status_locks = {}

def clear_system_status_cache(host: str = None):
    global system_status_cache
    if host:
        # Limpa cache de um host específico (format: host_username)
        keys_to_remove = [k for k in system_status_cache.keys() if k.startswith(f"{host}_")]
        for k in keys_to_remove:
            system_status_cache.pop(k, None)
    else:
        system_status_cache.clear()
