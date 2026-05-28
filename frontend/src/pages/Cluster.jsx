import React from 'react';
import { Network, RefreshCw, Loader2 } from 'lucide-react';
import { useCluster } from './cluster/useCluster';
import ChildNodeBanner from './cluster/ChildNodeBanner';
import SwarmStatusBanner from './cluster/SwarmStatusBanner';
import LinkedNodesCard from './cluster/LinkedNodesCard';
import LiveSwarmTopologyCard from './cluster/LiveSwarmTopologyCard';
import AddNodeModal from './cluster/AddNodeModal';
import { AddNodeProgressModal, HostnameProgressModal, DeleteNodeModal } from './cluster/ProgressModals';

const Cluster = () => {
    const {
        selectedServer,
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
        isActivatingSwarm,
        editingNodeId,
        setEditingNodeId,
        newHostnameValue,
        setNewHostnameValue,
        setEditingOldHostname,
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
    } = useCluster();

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
                <ChildNodeBanner selectedServer={selectedServer} parentInfo={parentInfo} />
            ) : (
                <>
                    {/* Banner de Status do Swarm */}
                    <SwarmStatusBanner
                        swarmActive={swarmActive}
                        isActivatingSwarm={isActivatingSwarm}
                        handleInitSwarm={handleInitSwarm}
                        setShowAddModal={setShowAddModal}
                    />

                    {/* Listas de Nós do Cluster */}
                    {swarmActive && (
                        <div className="grid grid-cols-1 gap-8">
                            {/* Nós Configurados no Painel */}
                            <LinkedNodesCard
                                dbNodes={dbNodes}
                                setSelectedNodeToDelete={setSelectedNodeToDelete}
                                setDeleteProgressStatus={setDeleteProgressStatus}
                                setDeleteErrorMessage={setDeleteErrorMessage}
                                setShowDeleteModal={setShowDeleteModal}
                            />

                            {/* Status do Docker Swarm Real */}
                            <LiveSwarmTopologyCard
                                realNodes={realNodes}
                                editingNodeId={editingNodeId}
                                setEditingNodeId={setEditingNodeId}
                                newHostnameValue={newHostnameValue}
                                setNewHostnameValue={setNewHostnameValue}
                                setEditingOldHostname={setEditingOldHostname}
                                handleUpdateHostnameSubmit={handleUpdateHostnameSubmit}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Modais */}
            <AddNodeModal
                showAddModal={showAddModal}
                setShowAddModal={setShowAddModal}
                availableServers={availableServers}
                selectedChildId={selectedChildId}
                setSelectedChildId={setSelectedChildId}
                nodeRole={nodeRole}
                setNodeRole={setNodeRole}
                parentIp={parentIp}
                installDocker={installDocker}
                setInstallDocker={setInstallDocker}
                isSubmitting={isSubmitting}
                handleAddNodeSubmit={handleAddNodeSubmit}
            />

            <AddNodeProgressModal
                showProgressModal={showProgressModal}
                setShowProgressModal={setShowProgressModal}
                progressStatus={progressStatus}
                stepMessage={stepMessage}
                fetchClusterData={fetchClusterData}
            />

            <HostnameProgressModal
                showHostnameProgressModal={showHostnameProgressModal}
                setShowHostnameProgressModal={setShowHostnameProgressModal}
                hostnameProgressStatus={hostnameProgressStatus}
                hostnameProgressMessage={hostnameProgressMessage}
                fetchClusterData={fetchClusterData}
            />

            <DeleteNodeModal
                showDeleteModal={showDeleteModal}
                setShowDeleteModal={setShowDeleteModal}
                deleteProgressStatus={deleteProgressStatus}
                selectedNodeToDelete={selectedNodeToDelete}
                deleteErrorMessage={deleteErrorMessage}
                handleRemoveNode={handleRemoveNode}
                fetchClusterData={fetchClusterData}
            />
        </div>
    );
};

export default Cluster;
