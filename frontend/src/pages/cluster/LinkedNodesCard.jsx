import React from 'react';
import { Server, Trash2 } from 'lucide-react';

const LinkedNodesCard = ({ dbNodes, setSelectedNodeToDelete, setDeleteProgressStatus, setDeleteErrorMessage, setShowDeleteModal }) => {
    return (
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
    );
};

export default LinkedNodesCard;
