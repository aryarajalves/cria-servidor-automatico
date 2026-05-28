import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { 
    Network, Server, Play, ShieldAlert, CheckCircle2, 
    X, Plus, Trash2, RefreshCw, Loader2, HelpCircle, Edit 
} from 'lucide-react';

const Cluster = () => {
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

    // Filtra os servidores cadastrados que podem ser adicionados (remove o próprio pai)
    const availableServers = servers.filter(s => s.host !== selectedServer?.host);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-slate-400 font-medium animate-pulse">Carregando painel do cluster Swarm...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                        <Network className="text-blue-500 w-8 h-8" />
                        Cluster Swarm
                    </h2>
                    <p className="text-slate-400 mt-1.5 text-sm">
                        Gerencie clusters Docker Swarm distribuídos. O servidor ativo <span className="text-blue-400 font-bold">{selectedServer?.name}</span> é o Nó Pai (Manager).
                    </p>
                </div>
                <button
                    onClick={fetchClusterData}
                    disabled={isRefreshing}
                    className="p-3 rounded-xl bg-slate-900 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 font-bold text-sm"
                >
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {/* Banner de Nó Filho (Aviso e Bloqueio) */}
            {isChildNode ? (
                <div className="bg-gradient-to-r from-red-500/10 via-rose-500/10 to-pink-500/10 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center gap-6 animate-in fade-in duration-300">
                    <div className="p-4 rounded-full bg-red-500/10 text-red-400">
                        <ShieldAlert size={48} />
                    </div>
                    <div className="max-w-md">
                        <h3 className="text-xl font-bold text-white mb-2">Este servidor é um Nó Filho</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            O servidor ativo <span className="text-red-400 font-bold">{selectedServer?.name}</span> já faz parte de outro cluster Swarm como um <span className="text-white font-bold">{parentInfo?.role?.toUpperCase()}</span>. Não é permitido gerenciar ou iniciar outro cluster a partir dele.
                        </p>
                        <div className="mt-6 p-4 bg-slate-900 border border-white/5 rounded-xl text-left space-y-2">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Informações do Servidor Pai:</p>
                            <p className="text-sm font-semibold text-white">Nome: <span className="text-blue-400">{parentInfo?.parent_name}</span></p>
                            <p className="text-sm font-semibold text-white">IP/Host: <span className="text-blue-400">{parentInfo?.parent_host}</span></p>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Banner de Status do Swarm */}
                    {!swarmActive ? (
                        <div className="bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                                    <ShieldAlert size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Docker Swarm Inativo no Servidor Pai</h3>
                                    <p className="text-slate-400 text-sm mt-1">
                                        Para criar um cluster, você precisa inicializar o Docker Swarm neste servidor ativo para transformá-lo em um Manager/Leader.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleInitSwarm}
                                disabled={isActivatingSwarm}
                                className="w-full md:w-auto px-6 py-3 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isActivatingSwarm ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Inicializando Swarm...
                                    </>
                                ) : (
                                    <>
                                        <Play size={18} />
                                        Inicializar Swarm Manager
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                                    <CheckCircle2 size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Docker Swarm Ativo & Pronto</h3>
                                    <p className="text-slate-400 text-sm mt-1">
                                        O nó principal está ativo. Agora você pode adicionar nós Workers ou Managers adicionais para escalar sua infraestrutura.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="w-full md:w-auto px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Plus size={18} />
                                Adicionar Servidor ao Cluster
                            </button>
                        </div>
                    )}

                    {/* Listas de Nós do Cluster */}
                    {swarmActive && (
                        <div className="grid grid-cols-1 gap-8">
                            {/* Nós Configurados no Painel */}
                            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                        <Server size={18} className="text-blue-400" />
                                        Nós Vinculados no Painel ({dbNodes.length})
                                    </h3>
                                    <span className="text-xs text-slate-500 italic">Lista local de servidores gerenciados no cluster</span>
                                </div>
                                
                                {dbNodes.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/80">
                                                    <th className="p-4">Nome do Servidor</th>
                                                    <th className="p-4">IP / Host</th>
                                                    <th className="p-4">Papel no Cluster</th>
                                                    <th className="p-4">Cadastrado em</th>
                                                    <th className="p-4 text-right">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-sm">
                                                {dbNodes.map((node) => (
                                                    <tr key={node.node_id} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-4 font-bold text-white">{node.name}</td>
                                                        <td className="p-4 text-slate-400">{node.host}</td>
                                                        <td className="p-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                                node.role === 'manager' 
                                                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                            }`}>
                                                                {node.role.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-slate-500 text-xs">
                                                            {new Date(node.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedNodeToDelete(node);
                                                                    setDeleteProgressStatus('idle');
                                                                    setDeleteErrorMessage('');
                                                                    setShowDeleteModal(true);
                                                                }}
                                                                className="p-2 text-slate-500 hover:text-red-400 transition-colors hover:bg-red-500/10 rounded-lg active:scale-95"
                                                                title="Remover do Cluster"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-slate-500 italic">
                                        Nenhum servidor filho configurado neste cluster localmente. Use o botão acima para adicionar.
                                    </div>
                                )}
                            </div>

                            {/* Status do Docker Swarm Real */}
                            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                        <Network size={18} className="text-emerald-400" />
                                        Topologia Real do Swarm ({realNodes.length})
                                    </h3>
                                    <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                        Live Swarm
                                    </span>
                                </div>
                                
                                {realNodes.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/80">
                                                    <th className="p-4">ID Swarm</th>
                                                    <th className="p-4">Hostname</th>
                                                    <th className="p-4">Status</th>
                                                    <th className="p-4">Disponibilidade</th>
                                                    <th className="p-4">Gerenciador</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-sm">
                                                {realNodes.map((node, idx) => (
                                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-4 font-mono text-xs text-slate-500">{node.id}</td>
                                                        <td className="p-4 font-bold text-white">
                                                            {editingNodeId === node.id ? (
                                                                <form onSubmit={handleUpdateHostnameSubmit} className="flex items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={newHostnameValue}
                                                                        onChange={(e) => setNewHostnameValue(e.target.value)}
                                                                        required
                                                                        className="bg-slate-800 border border-white/10 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                                                        placeholder="Novo hostname..."
                                                                    />
                                                                    <button type="submit" className="p-1 text-emerald-400 hover:text-emerald-300 font-bold text-xs bg-emerald-500/10 rounded border border-emerald-500/20 active:scale-95">Salvar</button>
                                                                    <button type="button" onClick={() => setEditingNodeId(null)} className="p-1 text-slate-400 hover:text-white font-bold text-xs bg-slate-800 rounded border border-white/5 active:scale-95">Cancelar</button>
                                                                </form>
                                                            ) : (
                                                                <div className="flex items-center gap-2.5 group/host">
                                                                    <span>{node.hostname}</span>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingNodeId(node.id);
                                                                            setEditingOldHostname(node.hostname);
                                                                            setNewHostnameValue(node.hostname);
                                                                        }}
                                                                        className="p-1 text-slate-500 hover:text-blue-400 opacity-0 group-hover/host:opacity-100 transition-opacity hover:bg-blue-500/10 rounded active:scale-95"
                                                                        title="Editar Hostname"
                                                                    >
                                                                        <Edit size={12} className="inline" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                                node.status === 'Ready' 
                                                                ? 'bg-emerald-500/10 text-emerald-400' 
                                                                : 'bg-red-500/10 text-red-400'
                                                            }`}>
                                                                {node.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-slate-400">{node.availability}</td>
                                                        <td className="p-4">
                                                            <span className="text-xs font-semibold text-slate-300">
                                                                {node.manager_status || 'Worker'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-slate-500 italic">
                                        Nenhuma informação do Swarm real obtida. Verifique o status da VPS.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal de Adicionar Servidor ao Cluster */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                    <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Plus className="text-blue-500" />
                                Adicionar ao Cluster
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddNodeSubmit} className="p-6 space-y-6">
                            {/* Seleção do Servidor */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Selecionar Servidor Filho</label>
                                {availableServers.length > 0 ? (
                                    <select
                                        value={selectedChildId}
                                        onChange={(e) => setSelectedChildId(e.target.value)}
                                        required
                                        className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    >
                                        <option value="">Selecione um servidor...</option>
                                        {availableServers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="p-4 bg-slate-800/50 border border-dashed border-white/10 rounded-xl text-center text-xs text-slate-500">
                                        Nenhum outro servidor cadastrado no painel. Vá em "Conectar VPS" para adicionar.
                                    </div>
                                )}
                            </div>

                            {/* Papel no Cluster */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Papel do Nó</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setNodeRole('worker')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                                            nodeRole === 'worker'
                                            ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                                            : 'bg-slate-800 border-white/5 hover:border-white/10 text-slate-400'
                                        }`}
                                    >
                                        <Server size={20} />
                                        <span className="text-sm font-bold">Worker Node</span>
                                        <span className="text-[10px] text-slate-500 text-center">Apenas roda containers e stacks delegadas.</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNodeRole('manager')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                                            nodeRole === 'manager'
                                            ? 'bg-purple-600/10 border-purple-500 text-purple-400'
                                            : 'bg-slate-800 border-white/5 hover:border-white/10 text-slate-400'
                                        }`}
                                    >
                                        <Network size={20} />
                                        <span className="text-sm font-bold">Manager Node</span>
                                        <span className="text-[10px] text-slate-500 text-center">Gerencia e coordena as tarefas no cluster.</span>
                                    </button>
                                </div>
                            </div>

                            {/* IP de Conexão do Pai */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">IP do Servidor Pai (Manager)</label>
                                    <div className="group relative">
                                        <HelpCircle size={14} className="text-slate-500 cursor-help" />
                                        <span className="absolute bottom-full right-0 mb-2 w-64 bg-slate-950 text-slate-300 text-[10px] p-2.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none leading-relaxed shadow-xl">
                                            O IP/Host pelo qual o nó filho irá acessar a máquina pai para se associar. Certifique-se de que a comunicação na porta 2377 está aberta.
                                        </span>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={parentIp}
                                    disabled
                                    required
                                    placeholder="Ex: 172.20.0.1 ou IP Público"
                                    className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-400 cursor-not-allowed focus:outline-none"
                                />
                            </div>

                            {/* Autoinstalação do Docker */}
                            <label className="flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-xl cursor-pointer hover:bg-slate-800/60 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={installDocker}
                                    onChange={(e) => setInstallDocker(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-white/10 focus:ring-blue-500"
                                />
                                <div className="text-left">
                                    <p className="text-sm font-bold text-white">Instalar Docker automaticamente</p>
                                    <p className="text-xs text-slate-500">Se o Docker não estiver instalado na VPS filha, instala automaticamente.</p>
                                </div>
                            </label>

                            {/* Botoes de Submissão */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-all active:scale-95 text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedChildId || isSubmitting}
                                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={16} />
                                            Vincular Servidor
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Progresso da Instalação / Adesão */}
            {showProgressModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
                        {/* Status Icon */}
                        <div className="flex justify-center mb-6">
                            {progressStatus === 'pending' || progressStatus === 'running' ? (
                                <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 relative">
                                    <Loader2 size={36} className="animate-spin" />
                                </div>
                            ) : progressStatus === 'success' ? (
                                <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400">
                                    <CheckCircle2 size={36} />
                                </div>
                            ) : (
                                <div className="p-4 rounded-full bg-red-500/10 text-red-400">
                                    <ShieldAlert size={36} />
                                </div>
                            )}
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                            {progressStatus === 'pending' || progressStatus === 'running' ? 'Ingressando no Swarm' :
                             progressStatus === 'success' ? 'Sucesso!' : 'Falha na Adesão'}
                        </h3>
                        
                        <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto leading-relaxed">
                            {stepMessage}
                        </p>

                        {(progressStatus === 'success' || progressStatus === 'error') && (
                            <button
                                onClick={() => {
                                    setShowProgressModal(false);
                                    fetchClusterData();
                                }}
                                className={`w-full px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm ${
                                    progressStatus === 'success' 
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20' 
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                Fechar Painel
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Progresso de Alteração de Hostname */}
            {showHostnameProgressModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
                        {/* Status Icon */}
                        <div className="flex justify-center mb-6">
                            {hostnameProgressStatus === 'pending' || hostnameProgressStatus === 'running' ? (
                                <div className="p-4 rounded-full bg-blue-500/10 text-blue-400 relative">
                                    <Loader2 size={36} className="animate-spin" />
                                </div>
                            ) : hostnameProgressStatus === 'success' ? (
                                <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400">
                                    <CheckCircle2 size={36} />
                                </div>
                            ) : (
                                <div className="p-4 rounded-full bg-red-500/10 text-red-400">
                                    <ShieldAlert size={36} />
                                </div>
                            )}
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                            {hostnameProgressStatus === 'pending' || hostnameProgressStatus === 'running' ? 'Alterando Hostname' :
                             hostnameProgressStatus === 'success' ? 'Sucesso!' : 'Falha na Alteração'}
                        </h3>
                        
                        <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto leading-relaxed">
                            {hostnameProgressMessage}
                        </p>

                        {(hostnameProgressStatus === 'success' || hostnameProgressStatus === 'error') && (
                            <button
                                onClick={() => {
                                    setShowHostnameProgressModal(false);
                                    fetchClusterData();
                                }}
                                className={`w-full px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm ${
                                    hostnameProgressStatus === 'success' 
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20' 
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                Fechar Painel
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Remoção de Servidor */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
                        
                        {/* Status/Warning Icon */}
                        <div className="flex justify-center mb-6">
                            {deleteProgressStatus === 'idle' ? (
                                <div className="p-4 rounded-full bg-red-500/10 text-red-400 animate-pulse">
                                    <Trash2 size={36} />
                                </div>
                            ) : deleteProgressStatus === 'running' ? (
                                <div className="p-4 rounded-full bg-blue-500/10 text-blue-400">
                                    <Loader2 size={36} className="animate-spin" />
                                </div>
                            ) : deleteProgressStatus === 'success' ? (
                                <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400">
                                    <CheckCircle2 size={36} />
                                </div>
                            ) : (
                                <div className="p-4 rounded-full bg-red-500/10 text-red-400">
                                    <ShieldAlert size={36} />
                                </div>
                            )}
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                            {deleteProgressStatus === 'idle' ? 'Remover do Cluster' :
                             deleteProgressStatus === 'running' ? 'Removendo Nó' :
                             deleteProgressStatus === 'success' ? 'Remoção Iniciada' : 'Erro ao Remover'}
                        </h3>
                        
                        <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto leading-relaxed">
                            {deleteProgressStatus === 'idle' && (
                                <>
                                    Tem certeza que deseja remover o servidor <strong className="text-white">{selectedNodeToDelete?.name}</strong> ({selectedNodeToDelete?.host}) do cluster? Isso fará com que o nó saia do Swarm.
                                </>
                            )}
                            {deleteProgressStatus === 'running' && 'Processando a remoção do nó no Swarm e atualizando o banco de dados...'}
                            {deleteProgressStatus === 'success' && 'O processo de remoção foi iniciado com sucesso no background! A lista será atualizada em breve.'}
                            {deleteProgressStatus === 'error' && deleteErrorMessage}
                        </p>

                        <div className="flex gap-3">
                            {deleteProgressStatus === 'idle' && (
                                <>
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all text-sm active:scale-95"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleRemoveNode}
                                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-all text-sm active:scale-95 shadow-lg shadow-red-600/20"
                                    >
                                        Confirmar Remoção
                                    </button>
                                </>
                            )}
                            {(deleteProgressStatus === 'success' || deleteProgressStatus === 'error') && (
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        fetchClusterData();
                                    }}
                                    className={`w-full px-4 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm ${
                                        deleteProgressStatus === 'success' 
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20' 
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                >
                                    Fechar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Cluster;
