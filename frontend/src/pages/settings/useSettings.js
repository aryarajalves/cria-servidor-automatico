import { useState, useEffect } from 'react';
import { useServer } from '../../context/ServerContext';
import api from '../../services/api';
import { useFail2ban } from './useFail2ban';

/**
 * Hook customizado que centraliza toda a lógica de estado e chamadas de API
 * da página de Configurações.
 */
export function useSettings() {
    const { selectedServer, selectServer, updateServerInList, setIsGlobalLoading = () => {} } = useServer();

    // Estado de formulário de senha SSH
    const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });

    // Estado de porta SSH
    const [newSshPort, setNewSshPort] = useState(selectedServer?.port || 22);
    const [loadingPort, setLoadingPort] = useState(false);

    // Atualiza newSshPort quando selectedServer mudar
    useEffect(() => {
        if (selectedServer?.port) {
            setNewSshPort(selectedServer.port);
        }
    }, [selectedServer?.port]);

    // Estados do Cloudflare
    const [cfToken, setCfToken] = useState('');
    const [isCfTokenFromEnv, setIsCfTokenFromEnv] = useState(false);
    const [cfZones, setCfZones] = useState([]);
    const [defaultDomain, setDefaultDomain] = useState({ id: '', name: '' });

    // Credenciais das stacks instaladas
    const [stackCredentials, setStackCredentials] = useState({});

    // Exportação de stacks
    const [stackExportPath, setStackExportPath] = useState('');

    // Estados do Portainer
    const [portainerUser, setPortainerUser] = useState('');
    const [portainerPassword, setPortainerPassword] = useState('');

    // Estados de loading
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [loadingCloudflare, setLoadingCloudflare] = useState(false);
    const [loadingSSH, setLoadingSSH] = useState(false);
    const [isLoadingZones, setIsLoadingZones] = useState(false);
    const [loadingExportPath, setLoadingExportPath] = useState(false);
    const [loadingCreds, setLoadingCreds] = useState(false);
    const [loadingPortainer, setLoadingPortainer] = useState(false);

    // Estado de segurança SSH (Autenticação por Senha)
    const [passwordAuthEnabled, setPasswordAuthEnabled] = useState(true);
    const [loadingPasswordAuth, setLoadingPasswordAuth] = useState(false);

    // UI
    const [showSshPassword, setShowSshPassword] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
    };

    const hideToast = () => setToast((prev) => ({ ...prev, show: false }));

    // Hook modularizado de proteção Fail2ban
    const {
        fail2banStatus,
        loadingFail2ban,
        loadingStatus,
        fetchFail2banStatus,
        handleSaveFail2ban,
        handleUnbanIp,
        handleToggleFail2ban
    } = useFail2ban(selectedServer, showToast, setIsGlobalLoading);

    // ─── API: Buscar zonas do Cloudflare ──────────────────────────────────────
    const fetchZones = async (token) => {
        if (!token) return;
        setIsLoadingZones(true);
        try {
            const res = await api.post('/cloudflare/zones', {
                api_token: token,
                host: selectedServer?.host
            });
            setCfZones(res.data.zones || []);
        } catch (error) {
            console.error('Erro ao buscar zonas:', error);
        } finally {
            setIsLoadingZones(false);
        }
    };

    // ─── Efeito: Carregar configurações ao montar / trocar de servidor ────────
    useEffect(() => {
        const loadSettings = async () => {
            setLoadingSettings(true);
            try {
                // Sincroniza porta do servidor com o banco
                try {
                    const srvRes = await api.get('/servers');
                    if (srvRes.data && Array.isArray(srvRes.data)) {
                        const fresh = srvRes.data.find(s => (selectedServer?.id && s.id === selectedServer.id) || s.host === selectedServer?.host);
                        if (fresh && fresh.port !== selectedServer?.port) {
                            selectServer(fresh);
                            setNewSshPort(fresh.port);
                        }
                    }
                } catch (e) {
                    console.debug('Aviso sync servidor:', e);
                }

                const res = await api.get('/settings', { params: { host: selectedServer?.host } });
                if (res.data) {
                    const fromEnv = res.data.cloudflare_token_env || false;
                    setIsCfTokenFromEnv(fromEnv);
                    const tokenToUse = res.data.cloudflare_token || (fromEnv ? 'env' : '');
                    if (tokenToUse) {
                        setCfToken(res.data.cloudflare_token || '');
                        // Busca zonas em segundo plano sem bloquear a renderização da página
                        fetchZones(tokenToUse);
                    }
                    if (res.data.default_domain_id) {
                        setDefaultDomain({
                            id: res.data.default_domain_id,
                            name: res.data.default_domain_name || ''
                        });
                    }
                    setStackExportPath(res.data.stack_export_path || '');
                    setPortainerUser(res.data.portainer_user || '');
                    setPortainerPassword(res.data.portainer_password || '');
                    if (res.data.password_auth_enabled !== undefined) {
                        setPasswordAuthEnabled(res.data.password_auth_enabled !== 'false' && res.data.password_auth_enabled !== false);
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar configurações:', error);
            } finally {
                setLoadingSettings(false);
            }
        };

        const loadStackCredentials = async () => {
            if (!selectedServer) return;
            setLoadingCreds(true);
            try {
                const res = await api.post('/system-status', selectedServer);
                if (res.data?.stack_credentials) {
                    setStackCredentials(res.data.stack_credentials);
                }
            } catch (error) {
                console.error('Erro ao carregar credenciais das stacks:', error);
            } finally {
                setLoadingCreds(false);
            }
        };

        loadSettings();
        loadStackCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedServer?.host]);

    // ─── Handlers ─────────────────────────────────────────────────────────────
    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSaveCloudflare = async (e) => {
        e.preventDefault();
        setLoadingCloudflare(true);
        setIsGlobalLoading(true);
        try {
            await api.post('/settings', {
                cloudflare_token: cfToken,
                default_domain_id: defaultDomain.id,
                default_domain_name: defaultDomain.name,
                host: selectedServer?.host
            });
            showToast('Configurações da Cloudflare salvas com sucesso!', 'success');
            // Recarrega as zonas em segundo plano sem travar o botão de salvar
            fetchZones(cfToken);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            showToast(error.response?.data?.detail || 'Falha ao salvar configurações', 'error');
        } finally {
            setLoadingCloudflare(false);
            setIsGlobalLoading(false);
        }
    };

    const handleSaveExportPath = async (e) => {
        e.preventDefault();
        setLoadingExportPath(true);
        setIsGlobalLoading(true);
        try {
            await api.post('/settings', {
                stack_export_path: stackExportPath,
                host: selectedServer?.host
            });
            showToast('Caminho de exportação salvo!', 'success');
        } catch (error) {
            console.error('Erro ao salvar caminho de exportação:', error);
            showToast(error.response?.data?.detail || 'Falha ao salvar caminho', 'error');
        } finally {
            setLoadingExportPath(false);
            setIsGlobalLoading(false);
        }
    };

    const handleUpdateSSH = async (e) => {
        e.preventDefault();
        if (formData.newPassword !== formData.confirmPassword) {
            showToast('As senhas não coincidem.', 'error');
            return;
        }
        if (formData.newPassword.length < 6) {
            showToast('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }
        setLoadingSSH(true);
        setIsGlobalLoading(true);
        try {
            await api.post('/change-server-password', {
                host: selectedServer.host,
                username: selectedServer.username,
                password: selectedServer.password,
                new_password: formData.newPassword
            });
            selectServer({ ...selectedServer, password: formData.newPassword });
            showToast('Senha do servidor alterada com sucesso!', 'success');
            setFormData({ newPassword: '', confirmPassword: '' });
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.detail || 'Erro ao alterar a senha.', 'error');
        } finally {
            setLoadingSSH(false);
            setIsGlobalLoading(false);
        }
    };

    const handleUpdatePasswordLocally = async () => {
        if (!formData.newPassword) {
            showToast('Digite a nova senha no campo ao lado.', 'error');
            return;
        }
        setLoadingSSH(true);
        setIsGlobalLoading(true);
        try {
            await api.put(`/servers/${selectedServer.id}`, { password: formData.newPassword });
            updateServerInList(selectedServer.id, { password: formData.newPassword });
            showToast('Senha atualizada localmente com sucesso!', 'success');
            setFormData({ newPassword: '', confirmPassword: '' });
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.detail || 'Erro ao atualizar a senha localmente.', 'error');
        } finally {
            setLoadingSSH(false);
            setIsGlobalLoading(false);
        }
    };

    const handleSavePortainer = async (e) => {
        e.preventDefault();
        setLoadingPortainer(true);
        setIsGlobalLoading(true);
        try {
            await api.post('/settings', {
                portainer_user: portainerUser,
                portainer_password: portainerPassword,
                host: selectedServer?.host
            });
            showToast('Configurações do Portainer salvas!', 'success');
        } catch (error) {
            console.error('Erro ao salvar configurações do Portainer:', error);
            showToast(error.response?.data?.detail || 'Falha ao salvar configurações do Portainer', 'error');
        } finally {
            setLoadingPortainer(false);
            setIsGlobalLoading(false);
        }
    };

    const handleUpdateStackCreds = async (stackName, user, password) => {
        try {
            await api.post('/update-stack-credentials', {
                host: selectedServer.host,
                stack_name: stackName,
                admin_email: user,
                admin_password: password
            });
            setStackCredentials((prev) => ({ ...prev, [stackName]: { user, password } }));
            showToast(`Credenciais de ${stackName} atualizadas!`, 'success');
        } catch (error) {
            showToast('Erro ao atualizar credenciais', 'error');
        }
    };

    const handleChangeSshPort = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const portNum = parseInt(newSshPort, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            showToast('A porta deve estar entre 1 e 65535.', 'error');
            return;
        }
        if (!selectedServer) return;

        setLoadingPort(true);
        setIsGlobalLoading(true);
        try {
            const res = await api.post('/settings/change-ssh-port', {
                host: selectedServer.host,
                username: selectedServer.username || 'root',
                new_port: portNum,
                current_port: Number(selectedServer.port || 22),
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password'
            });
            updateServerInList(selectedServer.id || selectedServer.host, { port: portNum });
            selectServer({ ...selectedServer, port: portNum });
            setNewSshPort(portNum);
            showToast(res.data?.message || `Porta SSH alterada para ${portNum} com sucesso!`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.detail || 'Erro ao alterar a porta SSH na VPS.', 'error');
        } finally {
            setLoadingPort(false);
            setIsGlobalLoading(false);
        }
    };

    const handleUpdatePortLocally = async () => {
        const portNum = parseInt(newSshPort, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            showToast('A porta deve estar entre 1 e 65535.', 'error');
            return;
        }
        if (!selectedServer) return;

        setLoadingPort(true);
        setIsGlobalLoading(true);
        try {
            const res = await api.put('/settings/update-ssh-port-local', {
                host: selectedServer.host,
                port: portNum,
                server_id: selectedServer.id,
                username: selectedServer.username || 'root',
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password'
            });
            updateServerInList(selectedServer.id || selectedServer.host, { port: portNum });
            selectServer({ ...selectedServer, port: portNum });
            setNewSshPort(portNum);
            showToast(res.data?.message || `Porta SSH atualizada para ${portNum} no sistema!`, 'success');
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.detail || 'Erro ao atualizar a porta localmente.', 'error');
        } finally {
            setLoadingPort(false);
            setIsGlobalLoading(false);
        }
    };

    // ─── API: Consultar e Alternar Autenticação por Senha SSH ───────────────────
    const fetchPasswordAuthStatus = async (showToastFeedback = false) => {
        if (!selectedServer?.host) return;
        setLoadingPasswordAuth(true);
        try {
            const res = await api.post('/settings/ssh-password-auth/status', {
                host: selectedServer.host,
                port: Number(selectedServer.port || 22),
                username: selectedServer.username || 'root',
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password'
            });
            if (res.data) {
                setPasswordAuthEnabled(res.data.password_auth_enabled);
                if (res.data.port && res.data.port !== selectedServer?.port) {
                    updateServerInList(selectedServer.id || selectedServer.host, { port: res.data.port });
                    selectServer({ ...selectedServer, port: res.data.port });
                    setNewSshPort(res.data.port);
                }
                if (showToastFeedback) {
                    showToast(res.data.message || 'Status verificado com sucesso na VPS!', res.data.status === 'warning' ? 'info' : 'success');
                }
            }
        } catch (err) {
            console.error('Erro ao verificar status de senha SSH:', err);
            if (showToastFeedback) {
                showToast(err.response?.data?.detail || 'Não foi possível consultar o status ao vivo na VPS.', 'error');
            }
        } finally {
            setLoadingPasswordAuth(false);
        }
    };

    const handleTogglePasswordAuth = async (enable) => {
        if (!selectedServer?.host) return;
        setLoadingPasswordAuth(true);
        setIsGlobalLoading(true);
        try {
            const res = await api.post('/settings/ssh-password-auth/toggle', {
                host: selectedServer.host,
                port: Number(selectedServer.port || 22),
                username: selectedServer.username || 'root',
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password',
                enabled: enable
            });
            setPasswordAuthEnabled(enable);
            if (res.data?.port && res.data.port !== selectedServer?.port) {
                updateServerInList(selectedServer.id || selectedServer.host, { port: res.data.port });
                selectServer({ ...selectedServer, port: res.data.port });
                setNewSshPort(res.data.port);
            }
            showToast(res.data.message || (enable ? 'Senha SSH ativada na VPS!' : 'Senha SSH desativada na VPS com sucesso!'), 'success');
        } catch (err) {
            console.error('Erro ao alterar autenticação por senha:', err);
            showToast(err.response?.data?.detail || 'Falha ao alterar a autenticação por senha na VPS.', 'error');
        } finally {
            setLoadingPasswordAuth(false);
            setIsGlobalLoading(false);
        }
    };

    return {
        // Servidor selecionado
        selectedServer,
        // Toast
        toast,
        showToast,
        hideToast,
        // Cloudflare
        cfToken,
        setCfToken,
        isCfTokenFromEnv,
        cfZones,
        defaultDomain,
        setDefaultDomain,
        isLoadingZones,
        loadingCloudflare,
        handleSaveCloudflare,
        fetchZones,
        // Exportação de stacks
        stackExportPath,
        setStackExportPath,
        loadingExportPath,
        handleSaveExportPath,
        // SSH Password
        formData,
        handleChange,
        loadingSSH,
        handleUpdateSSH,
        handleUpdatePasswordLocally,
        showSshPassword,
        setShowSshPassword,
        // SSH Port
        newSshPort,
        setNewSshPort,
        loadingPort,
        handleChangeSshPort,
        handleUpdatePortLocally,
        // SSH Security (Autenticação por Senha)
        passwordAuthEnabled,
        loadingPasswordAuth,
        fetchPasswordAuthStatus,
        handleTogglePasswordAuth,
        // Proteção Fail2ban
        fail2banStatus,
        loadingFail2ban,
        loadingFail2banStatus: loadingStatus,
        fetchFail2banStatus,
        handleSaveFail2ban,
        handleUnbanIp,
        handleToggleFail2ban,
        // Credenciais das stacks
        stackCredentials,
        loadingCreds,
        handleUpdateStackCreds,
        // Portainer API
        portainerUser,
        setPortainerUser,
        portainerPassword,
        setPortainerPassword,
        loadingPortainer,
        handleSavePortainer,
        // Loading global
        loadingSettings,
    };
}
