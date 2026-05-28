import { useState, useEffect } from 'react';
import { useServer } from '../../context/ServerContext';

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
                    const res = await fetch(`http://localhost:8005/install-status/cluster-add`);
                    const data = await res.json();
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
                    const res = await fetch(`http://localhost:8005/install-status/cluster-hostname`);
                    const data = await res.json();
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
            const statusRes = await fetch(
                `http://localhost:8005/api/cluster/status?parent_host=${selectedServer.host}&parent_username=${selectedServer.username}&parent_password=${encodeURIComponent(selectedServer.password)}`
            );
            const statusData = await statusRes.json();
            
            const childStatus = statusData.is_child || false;
            setIsChildNode(childStatus);
            setParentInfo(statusData.parent_info || null);
            setSwarmActive(statusData.swarm_active);
            setRealNodes(statusData.real_nodes || []);

            // 2. Buscar nós cadastrados no banco (apenas se não for filho)
            if (!childStatus) {
                const dbNodesRes = await fetch(`http://localhost:8005/api/cluster/nodes?parent_host=${selectedServer.host}`);
                const dbNodesData = await dbNodesRes.json();
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
        try {
            const res = await fetch('http://localhost:8005/init-swarm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host: selectedServer.host,
                    username: selectedServer.username,
                    password: selectedServer.password
                })
            });
            const data = await res.json();
            
            // Monitora o status de ativação (Swarm)
            let interval = setInterval(async () => {
                const statusRes = await fetch('http://localhost:8005/install-status/swarm');
                const statusData = await statusRes.json();
                if (statusData.status === 'success') {
                    clearInterval(interval);
                    setIsActivatingSwarm(false);
                    fetchClusterData();
                } else if (statusData.status === 'error') {
                    clearInterval(interval);
                    setIsActivatingSwarm(false);
                    alert(`Erro ao ativar Swarm: ${statusData.message}`);
                }
            }, 2000);
        } catch (err) {
            console.error("Erro ao iniciar Swarm:", err);
            setIsActivatingSwarm(false);
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
            const res = await fetch('http://localhost:8005/api/cluster/nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parent_host: selectedServer.host,
                    parent_username: selectedServer.username,
                    parent_password: selectedServer.password,
                    node_id: parseInt(selectedChildId),
                    role: nodeRole,
                    parent_ip: parentIp,
                    install_docker: installDocker
                })
            });
            
            if (res.ok) {
                setProgressStatus('running');
            } else {
                const data = await res.json();
                setProgressStatus('error');
                setStepMessage(data.detail || 'Ocorreu um erro ao processar a requisição.');
            }
        } catch (err) {
            setProgressStatus('error');
            setStepMessage('Erro na comunicação com a API.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveNode = async () => {
        if (!selectedNodeToDelete) return;

        setDeleteProgressStatus('running');
        setDeleteErrorMessage('');

        try {
            const res = await fetch('http://localhost:8005/api/cluster/nodes/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parent_host: selectedServer.host,
                    parent_username: selectedServer.username,
                    parent_password: selectedServer.password,
                    node_id: selectedNodeToDelete.node_id
                })
            });
            
            if (res.ok) {
                setDeleteProgressStatus('success');
                setTimeout(fetchClusterData, 3000);
            } else {
                const data = await res.json();
                setDeleteProgressStatus('error');
                setDeleteErrorMessage(data.detail || 'Ocorreu um erro ao tentar remover o nó do cluster.');
            }
        } catch (err) {
            console.error("Erro ao remover nó:", err);
            setDeleteProgressStatus('error');
            setDeleteErrorMessage('Erro de comunicação com o servidor.');
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
            const res = await fetch('http://localhost:8005/api/cluster/nodes/change-hostname', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    parent_host: selectedServer.host,
                    parent_username: selectedServer.username,
                    parent_password: selectedServer.password,
                    node_swarm_id: editingNodeId,
                    old_hostname: editingOldHostname,
                    new_hostname: newHostnameValue
                })
            });

            if (res.ok) {
                setHostnameProgressStatus('running');
            } else {
                const data = await res.json();
                setHostnameProgressStatus('error');
                setHostnameProgressMessage(data.detail || 'Erro ao processar alteração de hostname.');
            }
        } catch (err) {
            setHostnameProgressStatus('error');
            setHostnameProgressMessage('Erro na comunicação com a API.');
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
        fetchClusterData,
        handleInitSwarm,
        handleAddNodeSubmit,
        handleRemoveNode,
        handleUpdateHostnameSubmit,
        availableServers
    };
};
