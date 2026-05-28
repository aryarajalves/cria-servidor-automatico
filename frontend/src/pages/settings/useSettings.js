import { useState, useEffect } from 'react';
import { useServer } from '../../context/ServerContext';
import api from '../../services/api';

/**
 * Hook customizado que centraliza toda a lógica de estado e chamadas de API
 * da página de Configurações.
 */
export function useSettings() {
    const { selectedServer, selectServer, updateServerInList, setIsGlobalLoading = () => {} } = useServer();

    // Estado de formulário de senha SSH
    const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });

    // Estados do Cloudflare
    const [cfToken, setCfToken] = useState('');
    const [isCfTokenFromEnv, setIsCfTokenFromEnv] = useState(false);
    const [cfZones, setCfZones] = useState([]);
    const [defaultDomain, setDefaultDomain] = useState({ id: '', name: '' });

    // Credenciais das stacks instaladas
    const [stackCredentials, setStackCredentials] = useState({});

    // Exportação de stacks
    const [stackExportPath, setStackExportPath] = useState('');

    // Estados de loading
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [loadingCloudflare, setLoadingCloudflare] = useState(false);
    const [loadingSSH, setLoadingSSH] = useState(false);
    const [isLoadingZones, setIsLoadingZones] = useState(false);
    const [loadingExportPath, setLoadingExportPath] = useState(false);
    const [loadingCreds, setLoadingCreds] = useState(false);

    // UI
    const [showSshPassword, setShowSshPassword] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
    };

    const hideToast = () => setToast((prev) => ({ ...prev, show: false }));

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
            setIsGlobalLoading(true);
            try {
                const res = await api.get('/settings', { params: { host: selectedServer?.host } });
                if (res.data) {
                    const fromEnv = res.data.cloudflare_token_env || false;
                    setIsCfTokenFromEnv(fromEnv);
                    const tokenToUse = res.data.cloudflare_token || (fromEnv ? 'env' : '');
                    if (tokenToUse) {
                        setCfToken(res.data.cloudflare_token || '');
                        await fetchZones(tokenToUse);
                    }
                    if (res.data.default_domain_id) {
                        setDefaultDomain({
                            id: res.data.default_domain_id,
                            name: res.data.default_domain_name || ''
                        });
                    }
                    setStackExportPath(res.data.stack_export_path || '');
                }
            } catch (error) {
                console.error('Erro ao carregar configurações:', error);
            } finally {
                setLoadingSettings(false);
                setIsGlobalLoading(false);
            }
        };

        const loadStackCredentials = async () => {
            if (!selectedServer) return;
            setLoadingCreds(true);
            try {
                const res = await api.post('/system-status', {
                    host: selectedServer.host,
                    username: selectedServer.username,
                    password: selectedServer.password
                });
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
            showToast('Configurações da Cloudflare salvas!', 'success');
            await fetchZones(cfToken);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            showToast('Falha ao salvar configurações', 'error');
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
            showToast('Falha ao salvar caminho', 'error');
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
        // Exportação de stacks
        stackExportPath,
        setStackExportPath,
        loadingExportPath,
        handleSaveExportPath,
        // SSH
        formData,
        handleChange,
        loadingSSH,
        handleUpdateSSH,
        handleUpdatePasswordLocally,
        showSshPassword,
        setShowSshPassword,
        // Credenciais das stacks
        stackCredentials,
        loadingCreds,
        handleUpdateStackCreds,
        // Loading global
        loadingSettings,
    };
}
