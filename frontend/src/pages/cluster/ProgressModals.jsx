import React from 'react';
import ReactDOM from 'react-dom';
import { Loader2, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';

export const AddNodeProgressModal = ({
    showProgressModal,
    setShowProgressModal,
    progressStatus,
    stepMessage,
    fetchClusterData
}) => {
    if (!showProgressModal) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 w-screen h-screen">
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" />
            <div className="relative z-10 w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
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
    );

    if (typeof document !== 'undefined') {
        return ReactDOM.createPortal(modalContent, document.body);
    }
    return modalContent;
};

export const HostnameProgressModal = ({
    showHostnameProgressModal,
    setShowHostnameProgressModal,
    hostnameProgressStatus,
    hostnameProgressMessage,
    fetchClusterData
}) => {
    if (!showHostnameProgressModal) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 w-screen h-screen">
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" />
            <div className="relative z-10 w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
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
    );

    if (typeof document !== 'undefined') {
        return ReactDOM.createPortal(modalContent, document.body);
    }
    return modalContent;
};

export const DeleteNodeModal = ({
    showDeleteModal,
    setShowDeleteModal,
    deleteProgressStatus,
    selectedNodeToDelete,
    deleteErrorMessage,
    handleRemoveNode,
    fetchClusterData
}) => {
    if (!showDeleteModal) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 w-screen h-screen">
            {/* Backdrop que impede fechar ao clicar fora, como exige a regra de UX */}
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" />
            <div className="relative z-10 w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
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
                            {/* Apenas 1 botão de cancelar como exige a regra de UX */}
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all text-sm active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleRemoveNode}
                                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-all text-sm active:scale-95 shadow-lg shadow-red-600/20"
                            >
                                Confirmar Remoção
                            </button>
                        </>
                    )}
                    {(deleteProgressStatus === 'success' || deleteProgressStatus === 'error') && (
                        <button
                            type="button"
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
    );

    if (typeof document !== 'undefined') {
        return ReactDOM.createPortal(modalContent, document.body);
    }
    return modalContent;
};
