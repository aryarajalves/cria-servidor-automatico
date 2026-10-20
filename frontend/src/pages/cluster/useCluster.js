import { useState, useEffect } from 'react';
import { useServer } from '../../context/ServerContext';
import api from '../../services/api';

export const useCluster = () => {
    const { selectedServer, servers } = useServer();
    const [swarmActive, setSwarmActive] = useState(false);
    const [realNodes, setRealNodes] = useState([]);
    const [dbNodes, setDbNodes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isChildNode, setIsChildNode] = useState(false);
    const [parentInfo, setParentInfo] = useState(null);
    
    // Status do Modal de Adição
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedChildId, setSelectedChildId] = useState('');
    const [nodeRole, setNodeRole] = useState('worker');
    const [parentIp, setParentIp] = useState(selectedServer?.host || '');
    const [installDocker, setInstallDocker] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stepMessage, setStepMessage] = useState('');
    
    // Status do Modal de Progresso/Instalação
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [progressStatus, setProgressStatus] = useState('pending'); // pending, running, success, error
    
    // Status de ativação do swarm no pai
    const [isActivatingSwarm, setIsActivatingSwarm] = useState(false);
    const [showInitSwarmModal, setShowInitSwarmModal] = useState(false);
    const [initSwarmStatus, setInitSwarmStatus] = useState('idle'); // idle, pending, running, success, error
    const [initSwarmMessage, setInitSwarmMessage] = useState('');

    // Edição de Hostname
    const [editingNodeId, setEditingNodeId] = useState(null);
    const [editingOldHostname, setEditingOldHostname] = useState('');
    const [newHostnameValue, setNewHostnameValue] = useState('');
    const [isChangingHostname, setIsChangingHostname] = useState(false);

    // Status do Modal de Progresso do Hostname
    const [showHostnameProgressModal, setShowHostnameProgressModal] = useState(false);
    const [hostnameProgressStatus, setHostnameProgressStatus] = useState('pending'); // pending, running, success, error
    const [hostnameProgressMessage, setHostnameProgressMessage] = useState('');

    // Status do Modal de Remoção (Delete)
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedNodeToDelete, setSelectedNodeToDelete] = useState(null);
    const [deleteProgressStatus, setDeleteProgressStatus] = useState('idle'); // idle, running, success, error
    const [deleteErrorMessage, setDeleteErrorMessage] = useState('');

    useEffect(() => {
        if (selectedServer) {
            setParentIp(selectedServer.host);
            setIsLoading(true);
            fetchClusterData();
        }
    }, [selectedServer]);

    // Polling do progresso de adição de nó
    useEffect(() => {
        let interval;
        if (showProgressModal && (progressStatus === 'running' || progressStatus === 'pending')) {
            interval = setInterval(async () => {
                try {
                    const { data } = await api.get('/install-status/cluster-add');
                    if (data && data.status) {
                        setProgressStatus(data.status);
                        setStepMessage(data.message || 'Processando...');
                        
                        if (data.status === 'success' || data.status === 'error') {
                            clearInterval(interval);
                            fetchClusterData();
                        }
                    }
                } catch (err) {
                    console.error("Erro no polling de status:", err);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [showProgressModal, progressStatus]);

    // Polling do progresso de alteração de hostname
    useEffect(() => {
        let interval;
        if (showHostnameProgressModal && (hostnameProgressStatus === 'running' || hostnameProgressStatus === 'pending')) {
            interval = setInterval(async () => {
                try {
                    const { data } = await api.get('/install-status/cluster-hostname');
                    if (data && data.status) {
                        setHostnameProgressStatus(data.status);
                        setHostnameProgressMessage(data.message || 'Processando...');
                        
                        if (data.status === 'success' || data.status === 'error') {
                            clearInterval(interval);
                            fetchClusterData();
                        }
                    }
                } catch (err) {
                    console.error("Erro no polling de status do hostname:", err);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [showHostnameProgressModal, hostnameProgressStatus]);

    const fetchClusterData = async () => {
        if (!selectedServer) return;
        setIsRefreshing(true);
        try {
            // 1. Buscar status real do Swarm
            const { data: statusData } = await api.get('/api/cluster/status', {
                params: {
                    parent_host: selectedServer.host,
                    parent_username: selectedServer.username,
                    parent_password: selectedServer.password || ''
                }
            });
            
            const childStatus = statusData.is_child || false;
            setIsChildNode(childStatus);
            setParentInfo(statusData.parent_info || null);
            setSwarmActive(statusData.swarm_active);
            setRealNodes(statusData.real_nodes || []);

            // 2. Buscar nós cadastrados no banco (apenas se não for filho)
            if (!childStatus) {
                const { data: dbNodesData } = await api.get('/api/cluster/nodes', {
                    params: { parent_host: selectedServer.host }
                });
                setDbNodes(Array.isArray(dbNodesData) ? dbNodesData : []);
            } else {
                setDbNodes([]);
            }
        } catch (err) {
            console.error("Erro ao buscar dados do cluster:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleInitSwarm = async () => {
        if (!selectedServer) return;
        setIsActivatingSwarm(true);
        setShowInitSwarmModal(true);
        setInitSwarmStatus('pending');
        setInitSwarmMessage('Conectando ao servidor e enviando comando de inicialização...');
        try {
            const { data } = await api.post('/init-swarm', {
                host: selectedServer.host,
                port: selectedServer.port || 22,
                username: selectedServer.username,
                password: selectedServer.password,
                auth_type: selectedServer.auth_type,
                key_id: selectedServer.key_id
            });
            setInitSwarmStatus('running');
            setInitSwarmMessage(data?.message || 'Inicializando o modo cluster (docker swarm init)...');
            
            // Monitora o status de ativação (Swarm)
            let interval = setInterval(async () => {
                try {
                    const { data: statusData } = await api.get('/install-status/swarm');
                    if (statusData.status === 'success') {
                        clearInterval(interval);
                        setIsActivatingSwarm(false);
                        setInitSwarmStatus('success');
                        setInitSwarmMessage(statusData.message || 'Swarm inicializado com sucesso!');
                        fetchClusterData();
                    } else if (statusData.status === 'error') {
                        clearInterval(interval);
                        setIsActivatingSwarm(false);
                        setInitSwarmStatus('error');
                        setInitSwarmMessage(statusData.message || 'Erro ao ativar Swarm.');
                    } else if (statusData.status === 'running') {
                        setInitSwarmMessage(statusData.message || 'Inicializando Swarm...');
                    }
                } catch (pollErr) {
                    console.error("Erro no polling do Swarm:", pollErr);
                }
            }, 2000);
        } catch (err) {
            console.error("Erro ao iniciar Swarm:", err);
            setIsActivatingSwarm(false);
            setInitSwarmStatus('error');
            const detailMsg = err.response?.data?.detail || err.message || 'Erro de comunicação ao inicializar o Swarm.';
            setInitSwarmMessage(detailMsg);
        }
    };

    const handleAddNodeSubmit = async (e) => {
        e.preventDefault();
        if (!selectedChildId) return;
        
        setIsSubmitting(true);
        setProgressStatus('pending');
        setStepMessage('Enviando solicitação de adesão ao servidor...');
        setShowAddModal(false);
        setShowProgressModal(true);

        try {
            await api.post('/api/cluster/nodes', {
                parent_host: selectedServer.host,
                parent_username: selectedServer.username,
                parent_password: selectedServer.password,
                node_id: parseInt(selectedChildId),
                role: nodeRole,
                parent_ip: parentIp,
                install_docker: installDocker
            });
            setProgressStatus('running');
        } catch (err) {
            setProgressStatus('error');
            setStepMessage(err.response?.data?.detail || 'Erro na comunicação com a API.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveNode = async () => {
        if (!selectedNodeToDelete) return;

        setDeleteProgressStatus('running');
        setDeleteErrorMessage('');

        try {
            await api.post('/api/cluster/nodes/remove', {
                parent_host: selectedServer.host,
                parent_username: selectedServer.username,
                parent_password: selectedServer.password,
                node_id: selectedNodeToDelete.node_id
            });
            setDeleteProgressStatus('success');
            setTimeout(fetchClusterData, 3000);
        } catch (err) {
            console.error("Erro ao remover nó:", err);
            setDeleteProgressStatus('error');
            setDeleteErrorMessage(err.response?.data?.detail || 'Erro de comunicação com o servidor.');
        }
    };

    const handleUpdateHostnameSubmit = async (e) => {
        e.preventDefault();
        if (!newHostnameValue || !editingNodeId) return;

        setIsChangingHostname(true);
        setHostnameProgressStatus('pending');
        setHostnameProgressMessage('Enviando solicitação de alteração de hostname...');
        setShowHostnameProgressModal(true);
        setEditingNodeId(null);

        try {
            await api.post('/api/cluster/nodes/change-hostname', {
                parent_host: selectedServer.host,
                parent_username: selectedServer.username,
                parent_password: selectedServer.password,
                node_swarm_id: editingNodeId,
                old_hostname: editingOldHostname,
                new_hostname: newHostnameValue
            });
            setHostnameProgressStatus('running');
        } catch (err) {
            setHostnameProgressStatus('error');
            setHostnameProgressMessage(err.response?.data?.detail || 'Erro na comunicação com a API.');
        } finally {
            setIsChangingHostname(false);
        }
    };

    const availableServers = servers.filter(s => s.host !== selectedServer?.host);

    return {
        selectedServer,
        servers,
        swarmActive,
        realNodes,
        dbNodes,
        isLoading,
        isRefreshing,
        isChildNode,
        parentInfo,
        showAddModal,
        setShowAddModal,
        selectedChildId,
        setSelectedChildId,
        nodeRole,
        setNodeRole,
        parentIp,
        installDocker,
        setInstallDocker,
        isSubmitting,
        stepMessage,
        showProgressModal,
        setShowProgressModal,
        progressStatus,
        setProgressStatus,
        isActivatingSwarm,
        showInitSwarmModal,
        setShowInitSwarmModal,
        initSwarmStatus,
        setInitSwarmStatus,
        initSwarmMessage,
        setInitSwarmMessage,
        editingNodeId,
        setEditingNodeId,
        editingOldHostname,
        setEditingOldHostname,
        newHostnameValue,
        setNewHostnameValue,
        isChangingHostname,
        showHostnameProgressModal,
        setShowHostnameProgressModal,
        hostnameProgressStatus,
        hostnameProgressMessage,
        showDeleteModal,
        setShowDeleteModal,
        selectedNodeToDelete,
        setSelectedNodeToDelete,
        deleteProgressStatus,
        setDeleteProgressStatus,
        deleteErrorMessage,
        setDeleteErrorMessage,
        fetchClusterData,
        handleInitSwarm,
        handleAddNodeSubmit,
        handleRemoveNode,
        handleUpdateHostnameSubmit,
        availableServers
    };
};
