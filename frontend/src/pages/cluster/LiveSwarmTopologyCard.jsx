import React from 'react';
import { Network, Edit } from 'lucide-react';

const LiveSwarmTopologyCard = ({
    realNodes,
    editingNodeId,
    setEditingNodeId,
    newHostnameValue,
    setNewHostnameValue,
    setEditingOldHostname,
    handleUpdateHostnameSubmit
}) => {
    return (
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
    );
};

export default LiveSwarmTopologyCard;
