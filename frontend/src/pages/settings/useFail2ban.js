import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

/**
 * Hook customizado para gerenciar estado e chamadas de API do Fail2ban.
 */
export function useFail2ban(selectedServer, showToast, setIsGlobalLoading = () => {}) {
    const [fail2banStatus, setFail2banStatus] = useState({
        installed: false,
        active: false,
        maxretry: 5,
        findtime: 600,
        bantime: 3600,
        jails: [],
        banned_ips: [],
        message: ''
    });
    const [loadingFail2ban, setLoadingFail2ban] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const isFetchingRef = useRef(false);
    const lastFetchedHostRef = useRef(null);

    const fetchFail2banStatus = useCallback(async (showFeedback = false) => {
        if (!selectedServer?.host) return;
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setLoadingStatus(true);
        try {
            const res = await api.post('/settings/fail2ban/status', {
                host: selectedServer.host,
                port: Number(selectedServer.port || 22),
                username: selectedServer.username || 'root',
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password'
            });
            if (res.data) {
                setFail2banStatus(res.data);
                if (showFeedback) {
                    showToast(res.data.message || 'Status do Fail2ban atualizado!', res.data.status === 'warning' ? 'info' : 'success');
                }
            }
        } catch (err) {
            console.error('Erro ao consultar Fail2ban:', err);
            if (showFeedback) {
                showToast(err.response?.data?.detail || 'Erro ao consultar status do Fail2ban na VPS.', 'error');
            }
        } finally {
            setLoadingStatus(false);
            isFetchingRef.current = false;
        }
    }, [selectedServer?.host, selectedServer?.port, selectedServer?.username, selectedServer?.password, selectedServer?.key_id, selectedServer?.auth_type, showToast]);

    useEffect(() => {
        if (selectedServer?.host && lastFetchedHostRef.current !== selectedServer.host) {
            lastFetchedHostRef.current = selectedServer.host;
            fetchFail2banStatus(false);
        }
    }, [selectedServer?.host, fetchFail2banStatus]);

    const handleSaveFail2ban = async ({ maxretry, findtime, bantime }) => {
        if (!selectedServer?.host) return;
        setLoadingFail2ban(true);
        setIsGlobalLoading(true);
        try {
            const res = await api.post('/settings/fail2ban/save', {
                host: selectedServer.host,
                ssh_port: Number(selectedServer.port || 22),
                username: selectedServer.username || 'root',
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password',
                maxretry: Number(maxretry),
                findtime: Number(findtime),
                bantime: Number(bantime)
            });
            await fetchFail2banStatus(false);
            showToast(res.data.message || 'Regras do Fail2ban aplicadas com sucesso!', 'success');
        } catch (err) {
            console.error('Erro ao salvar Fail2ban:', err);
            showToast(err.response?.data?.detail || 'Falha ao aplicar configurações do Fail2ban na VPS.', 'error');
        } finally {
            setLoadingFail2ban(false);
            setIsGlobalLoading(false);
        }
    };

    const handleUnbanIp = async (ip, jail = 'sshd') => {
        if (!selectedServer?.host || !ip) return;
        setLoadingFail2ban(true);
        try {
            const res = await api.post('/settings/fail2ban/unban', {
                host: selectedServer.host,
                ip,
                jail,
                port: Number(selectedServer.port || 22),
                username: selectedServer.username || 'root',
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password'
            });
            await fetchFail2banStatus(false);
            showToast(res.data.message || `IP ${ip} desbanido com sucesso!`, 'success');
        } catch (err) {
            console.error('Erro ao desbanir IP:', err);
            showToast(err.response?.data?.detail || `Falha ao desbanir o IP ${ip}.`, 'error');
        } finally {
            setLoadingFail2ban(false);
        }
    };

    const handleToggleFail2ban = async (enable) => {
        if (!selectedServer?.host) return;
        setLoadingFail2ban(true);
        setIsGlobalLoading(true);
        try {
            const res = await api.post('/settings/fail2ban/toggle', {
                host: selectedServer.host,
                enable,
                port: Number(selectedServer.port || 22),
                username: selectedServer.username || 'root',
                password: selectedServer.password,
                key_id: selectedServer.key_id,
                auth_type: selectedServer.auth_type || 'password'
            });
            await fetchFail2banStatus(false);
            showToast(res.data.message || (enable ? 'Proteção ativada!' : 'Proteção pausada.'), 'success');
        } catch (err) {
            console.error('Erro ao alternar Fail2ban:', err);
            showToast(err.response?.data?.detail || 'Erro ao alterar estado do Fail2ban.', 'error');
        } finally {
            setLoadingFail2ban(false);
            setIsGlobalLoading(false);
        }
    };

    return {
        fail2banStatus,
        loadingFail2ban,
        loadingStatus,
        fetchFail2banStatus,
        handleSaveFail2ban,
        handleUnbanIp,
        handleToggleFail2ban
    };
}
