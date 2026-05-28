import React from 'react';
import { Plus, X, Server, Network, HelpCircle, Loader2 } from 'lucide-react';

const AddNodeModal = ({
    showAddModal,
    setShowAddModal,
    availableServers,
    selectedChildId,
    setSelectedChildId,
    nodeRole,
    setNodeRole,
    parentIp,
    installDocker,
    setInstallDocker,
    isSubmitting,
    handleAddNodeSubmit
}) => {
    if (!showAddModal) return null;

    return (
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
    );
};

export default AddNodeModal;
