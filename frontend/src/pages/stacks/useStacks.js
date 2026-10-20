import { useState, useEffect } from 'react';
import { useServer } from '../../context/ServerContext';
import api from '../../services/api';
import { apps } from './constants';
import { getInstallEndpoint, validateAppDependencies, prefillAppFields } from './stackHelpers';

export const useStacks = () => {
    const { selectedServer, setIsGlobalLoading = () => {}, clearSelectedServer } = useServer();
    const [status, setStatus] = useState(null);
    const [activeStacks, setActiveStacks] = useState([]);
    const [stackUrls, setStackUrls] = useState({});
    const [stackCredentials, setStackCredentials] = useState({});
    const [stackVersions, setStackVersions] = useState({});
    const [confirmAction, setConfirmAction] = useState(null); // { title, message, onConfirm, type }
    const [installationResult, setInstallationResult] = useState(null);
    const [loadingStep, setLoadingStep] = useState(null);
    const [configModal, setConfigModal] = useState(null);
    const [externalModal, setExternalModal] = useState(null);
    const [verifyingStatus, setVerifyingStatus] = useState(false);
    const [verifyingMessage, setVerifyingMessage] = useState("Verificando status do sistema...");

    // New states for error handling
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Função auxiliar para encontrar o nome real da stack no servidor
    const getActualStackName = (baseStackName) => {
        if (!Array.isArray(activeStacks) || activeStacks.length === 0) return null;
        const getName = (s) => (typeof s === 'string' ? s : s?.name);
        
        const match = activeStacks.find(s => {
            let name = getName(s);
            if (!name) return false;
            name = name.trim();
            
            const regex = new RegExp(`^${baseStackName}(_\\d+)?$`);
            return regex.test(name);
        });
        
        return match ? getName(match).trim() : null;
    };

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
    };

    useEffect(() => {
        if (selectedServer) fetchStatus();
    }, [selectedServer]);

    const fetchStatus = async () => {
        setLoading(true);
        setIsGlobalLoading(true);
        setInstallationResult(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const { data } = await api.post('/system-status', selectedServer, {
                signal: controller.signal
            });
            if (data) {
                setStatus(data.system_status);
                setActiveStacks(data.detected_stacks || []);
                setStackUrls(data.stack_urls || {});
                setStackCredentials(data.stack_credentials || {});
                setStackVersions(data.stack_versions || {});
                setError(null);
            }
        } catch (e) {
            if (e.name === 'CanceledError' || e.name === 'AbortError' || e.code === 'ERR_CANCELED') {
                // Ignora cancelamentos intencionais (evita bugs de StrictMode / unmount)
                return;
            }
            const msg = e.response?.data?.detail || e.message || '';
            const isOffline = msg.includes('Connection refused') || msg.includes('timed out') ||
                msg.includes('No route to host') || msg.includes('Network is unreachable') ||
                msg.includes('SSH') || msg.includes('ssh') || msg.includes('errno');
            setError(isOffline ? '__SERVER_OFFLINE__' : (msg || 'Falha ao conectar ao servidor.'));
        } finally {
            clearTimeout(timeoutId);
            setLoading(false);
            setIsGlobalLoading(false);
        }
    };

    const pollInstallation = async (service) => {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const { data } = await api.get(`/install-status/${service}`);
                    if (data.status === 'success') {
                        clearInterval(interval);
                        resolve(data);
                    } else if (data.status === 'error') {
                        clearInterval(interval);
                        reject(new Error(data.message));
                    } else {
                        setVerifyingMessage(data.message || `Instalando ${service}...`);
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 2000);
        });
    };

    const runInstallAction = async (actionFn, service) => {
        try {
            setVerifyingMessage(`Iniciando ${service}...`);
            setVerifyingStatus(true);
            setIsGlobalLoading(true);

            await actionFn();

            await pollInstallation(service);

            setVerifyingMessage("Verificando status do sistema...");
            await fetchStatus();
        } catch (e) {
            alert("Erro: " + (e.response?.data?.detail || e.message));
        } finally {
            setLoadingStep(null);
            setVerifyingStatus(false);
            setIsGlobalLoading(false);
        }
    };

    const handleInstallDocker = async () => {
        setConfirmAction({
            title: "Instalar Docker",
            message: "Isso irá instalar o Docker Engine no seu servidor. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('docker');
                runInstallAction(async () => await api.post('/install-docker', selectedServer), 'docker');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    const handleInitSwarm = async () => {
        setConfirmAction({
            title: "Ativar Swarm",
            message: "Isso irá transformar seu servidor em um Swarm Manager. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('swarm');
                runInstallAction(async () => await api.post('/init-swarm', selectedServer), 'swarm');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    const handleCreateNetwork = async () => {
        setConfirmAction({
            title: "Criar Rede Overlay",
            message: "Isso criará a rede 'network_swarm_public' necessária para as aplicações. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('network');
                runInstallAction(async () => await api.post('/create-network', selectedServer), 'network');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    const handleInstallCtop = async () => {
        setConfirmAction({
            title: "Instalar Ctop",
            message: "Isso instalará a ferramenta de monitoramento ctop. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('ctop');
                runInstallAction(async () => await api.post('/install-ctop', selectedServer), 'ctop');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    const handleConfirmInstall = async (app, configValues) => {
        try {
            const endpoint = getInstallEndpoint(app.id);

            console.log(`Installing ${app.name} at ${endpoint} with config:`, configValues);

            setVerifyingMessage(`Iniciando instalação de ${app.name}...`);
            setVerifyingStatus(true);

            await api.post(endpoint, {
                ...selectedServer,
                ...configValues,
                email: app.id === 'traefik' ? 'aryarajunity@gmail.com' : undefined,
                overwrite: !!getActualStackName(app.stackName)
            });

            const result = await pollInstallation(app.id);

            if (result && result.credentials) {
                setInstallationResult({
                    appName: app.name,
                    user: result.credentials.user,
                    password: result.credentials.password
                });
            }

            setVerifyingMessage("Verificando status do sistema...");
            await fetchStatus();
            
            if (result && result.credentials) {
                showToast(`${app.name} instalado com sucesso!`, 'success');
            } else {
                showToast(`${app.name} instalado!`, 'success');
            }

        } catch (e) {
            alert("Erro na instalação: " + (e.response?.data?.detail || e.message));
            console.error(e);
        } finally {
            setVerifyingStatus(false);
            setConfigModal(null);
        }
    };

    const handleInstallApp = async (appId, appName) => {
        const isInstalled = activeStacks.includes(apps.find(a => a.id === appId)?.stackName);
        
        setConfirmAction({
            title: isInstalled ? `Reinstalar ${appName}` : `Instalar ${appName}`,
            message: isInstalled 
                ? `Você está prestes a reinstalar ${appName}. Os dados existentes serão mantidos se houver volumes, mas o container será recriado. Continuar?`
                : `Deseja iniciar a instalação de ${appName} no seu servidor?`,
            type: isInstalled ? "warning" : "info",
            onConfirm: async () => {
                setConfirmAction(null);
                await proceedWithInstallApp(appId, appName);
            }
        });
    };

    const proceedWithInstallApp = async (appId, appName) => {
        let app = apps.find(a => a.id === appId);
        if (!app) return;

        app = { ...app, fields: app.fields ? [...app.fields] : [] };

        const actualStackName = getActualStackName(app.stackName);
        const isInstalled = !!actualStackName;

        // Validação de dependências obrigatórias
        const depCheck = validateAppDependencies(appId, activeStacks);
        if (!depCheck.valid) {
            alert(depCheck.message);
            return;
        }

        const needsPostgres = app.fields.some(f => f.name === 'postgres_password');
        const hasPostgres = Array.isArray(activeStacks) && activeStacks.includes('postgres');

        if (needsPostgres && hasPostgres) {
            try {
                console.log("Fetching Postgres password for auto-fill...");
                const { data } = await api.post(`/get-stack-env/postgres`, selectedServer);
                const pgPass = data.env_vars?.POSTGRES_PASSWORD;

                if (pgPass) {
                    app.fields = app.fields.map(f => {
                        if (f.name === 'postgres_password') {
                            return { ...f, defaultValue: pgPass };
                        }
                        return f;
                    });
                }
            } catch (e) {
                console.error("Failed to fetch postgres password", e);
            }
        }

        let envVars = {};
        if (isInstalled && !['traefik', 'portainer', 'redis', 'postgres'].includes(appId)) {
            try {
                console.log(`Fetching environment variables for stack: ${actualStackName}`);
                const { data } = await api.post(`/get-stack-env/${actualStackName}`, selectedServer);
                envVars = data.env_vars || {};
            } catch (e) {
                console.error("Failed to fetch stack env vars", e);
            }
        }

        if (app.fields && app.fields.length > 0) {
            app.fields = prefillAppFields(app, actualStackName, stackUrls, envVars, stackCredentials);
            setConfigModal({ app });
        } else {
            await handleConfirmInstall(app, {});
        }
    };

    const handleRestartStack = async (appId, appName) => {
        const app = apps.find(a => a.id === appId);
        if (!app) return;

        setConfirmAction({
            title: `Reiniciar ${app.name}`,
            message: `Isso irá forçar a recriação dos containers da stack ${app.name}. O serviço ficará offline por alguns segundos. Continuar?`,
            type: "warning",
            onConfirm: async () => {
                setConfirmAction(null);
                try {
                    setVerifyingMessage(`Reiniciando ${app.name}...`);
                    setVerifyingStatus(true);

                    const actualStackName = getActualStackName(app.stackName) || app.stackName;
                    await api.post('/restart-stack', {
                        ...selectedServer,
                        stack_name: actualStackName
                    });

                    await fetchStatus();
                    showToast(`${app.name} reiniciado com sucesso!`);
                } catch (e) {
                    showToast("Erro ao reiniciar: " + (e.response?.data?.detail || e.message), "error");
                } finally {
                    setVerifyingStatus(false);
                }
            }
        });
    };

    const handleUninstallApp = async (appId, appName) => {
        const app = apps.find(a => a.id === appId);
        if (!app) return;

        setConfirmAction({
            title: `DESINSTALAR ${app.name}`,
            message: `ATENÇÃO: Isso irá REMOVER PERMANENTEMENTE todos os containers, volumes e bancos de dados de ${app.name}. Esta ação é irreversível e o sistema voltará ao estado original (Zero Bala). Tem certeza?`,
            type: "danger",
            onConfirm: async () => {
                setConfirmAction(null);
                console.log("Iniciando desinstalação Zero Bala de:", app.id, app.stackName);
                try {
                    setVerifyingMessage(`Desinstalando ${app.name}...`);
                    setVerifyingStatus(true);
                    setIsGlobalLoading(true);

                    const actualStackName = getActualStackName(app.stackName) || app.stackName;
                    await api.post('/uninstall-stack', {
                        ...selectedServer,
                        stack_id: app.id,
                        stack_name: actualStackName
                    });

                    await pollInstallation(app.id);

                    setVerifyingMessage("Sincronizando sistema...");
                    await fetchStatus();
                    showToast(`${app.name} desinstalado com sucesso! (Zero Bala)`);
                } catch (e) {
                    showToast("Erro ao desinstalar: " + (e.response?.data?.detail || e.message), "error");
                } finally {
                    setVerifyingStatus(false);
                    setIsGlobalLoading(false);
                }
            }
        });
    };

    const handleUpdateCredentials = async (stackName, newCreds) => {
        try {
            setVerifyingMessage(`Atualizando credenciais de ${stackName}...`);
            setVerifyingStatus(true);

            await api.post('/update-stack-credentials', {
                host: selectedServer.host,
                stack_name: stackName,
                admin_email: newCreds.user,
                admin_password: newCreds.password,
                version: newCreds.version
            });

            await fetchStatus();
            showToast(`Acesso de ${stackName} atualizado com sucesso!`);
        } catch (e) {
            showToast("Erro ao atualizar credenciais", "error");
        } finally {
            setVerifyingStatus(false);
        }
    };

    const handleUpdateDomain = async (stackName, oldDomain, newDomain) => {
        try {
            setVerifyingMessage(`Atualizando domínio de ${stackName}...`);
            setVerifyingStatus(true);

            await api.post('/update-stack-domain', {
                host: selectedServer.host,
                username: selectedServer.username,
                password: selectedServer.password,
                stack_name: stackName,
                old_domain: oldDomain,
                new_domain: newDomain
            });

            await fetchStatus();
            showToast(`Domínio de ${stackName} atualizado com sucesso!`);
        } catch (e) {
            showToast("Erro ao atualizar domínio: " + (e.response?.data?.detail || e.message), "error");
            throw e;
        } finally {
            setVerifyingStatus(false);
        }
    };

    const handleMarkExternal = async (stackName, url, email, password, version) => {
        try {
            setVerifyingMessage("Salvando vínculo externo...");
            setVerifyingStatus(true);
            await api.post('/mark-external-stack', {
                host: selectedServer.host,
                username: selectedServer.username,
                stack_name: stackName,
                url,
                email,
                password,
                version
            });
            await fetchStatus();
            showToast("Aplicação vinculada externamente!");
        } catch (e) {
            showToast("Erro ao vincular aplicação externa: " + (e.response?.data?.detail || e.message), "error");
        } finally {
            setVerifyingStatus(false);
        }
    };

    return {
        selectedServer,
        status,
        activeStacks,
        stackUrls,
        stackCredentials,
        stackVersions,
        confirmAction,
        setConfirmAction,
        installationResult,
        setInstallationResult,
        loadingStep,
        configModal,
        setConfigModal,
        externalModal,
        setExternalModal,
        verifyingStatus,
        verifyingMessage,
        loading,
        error,
        toast,
        setToast,
        getActualStackName,
        fetchStatus,
        handleInstallDocker,
        handleInitSwarm,
        handleCreateNetwork,
        handleInstallCtop,
        handleConfirmInstall,
        handleInstallApp,
        handleRestartStack,
        handleUninstallApp,
        handleUpdateCredentials,
        handleUpdateDomain,
        handleMarkExternal,
        clearSelectedServer
    };
};
