import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Server, Network, HelpCircle, Loader2, ChevronDown, Search, Check } from 'lucide-react';

const AddNodeModal = ({
    showAddModal,
    setShowAddModal,
    availableServers = [],
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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    // Fecha o dropdown de busca ao clicar fora do componente de seleção
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    if (!showAddModal) return null;

    const selectedServerObj = availableServers.find(s => String(s.id) === String(selectedChildId));

    const filteredServers = availableServers.filter(s => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        const nameMatch = s.name?.toLowerCase().includes(query);
        const hostMatch = s.host?.toLowerCase().includes(query);
        return nameMatch || hostMatch;
    });

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 w-screen h-screen select-none"
            data-testid="add-node-modal"
        >
            {/* Backdrop escuro e transparente que NÃO fecha ao clicar fora (Regra de UX) */}
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" />
            
            {/* Painel Central */}
            <div className="relative z-10 w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus className="text-blue-500" />
                        Adicionar ao Cluster
                    </h3>
                </div>
                
                <form onSubmit={handleAddNodeSubmit} className="p-6 space-y-6">
                    {/* Seleção do Servidor com Pesquisa/Filtro */}
                    <div className="space-y-2" ref={dropdownRef}>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Selecionar Servidor Filho
                        </label>
                        
                        {availableServers.length > 0 ? (
                            <div className="relative">
                                {/* Botão Seletor / Dropdown Trigger */}
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(prev => !prev)}
                                    className={`w-full bg-slate-800 border rounded-xl px-4 py-3 text-sm text-left flex items-center justify-between transition-all ${
                                        isDropdownOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-white/10 hover:border-white/20'
                                    }`}
                                    aria-haspopup="listbox"
                                    aria-expanded={isDropdownOpen}
                                >
                                    <span className={selectedServerObj ? "text-white font-medium truncate" : "text-slate-400"}>
                                        {selectedServerObj 
                                            ? `${selectedServerObj.name} (${selectedServerObj.host})`
                                            : 'Selecione um servidor...'
                                        }
                                    </span>
                                    <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Dropdown Menu com Campo de Busca */}
                                {isDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                        {/* Campo de Pesquisa */}
                                        <div className="p-2 border-b border-white/5 relative">
                                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Buscar por nome ou IP..."
                                                autoFocus
                                                className="w-full bg-slate-900/80 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        {/* Lista de Opções */}
                                        <div className="max-h-56 overflow-y-auto p-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                                            {filteredServers.length > 0 ? (
                                                filteredServers.map((server) => {
                                                    const isSelected = String(server.id) === String(selectedChildId);
                                                    return (
                                                        <button
                                                            key={server.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedChildId(String(server.id));
                                                                setIsDropdownOpen(false);
                                                                setSearchQuery('');
                                                            }}
                                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs transition-colors ${
                                                                isSelected 
                                                                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                                                                    : 'hover:bg-white/5 text-slate-200'
                                                            }`}
                                                        >
                                                            <div className="flex flex-col truncate pr-2">
                                                                <span className="font-semibold text-white truncate">{server.name}</span>
                                                                <span className="text-[11px] text-slate-400 font-mono">{server.host}</span>
                                                            </div>
                                                            {isSelected && <Check size={16} className="text-blue-400 flex-shrink-0" />}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="p-4 text-center text-xs text-slate-400">
                                                    Nenhum servidor encontrado com "{searchQuery}".
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
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
                                    ? 'bg-blue-600/10 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/5'
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
                                    ? 'bg-purple-600/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/5'
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

                    {/* Botões de Ação (Apenas 1 para cancelar conforme regra de UX) */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setShowAddModal(false);
                                setIsDropdownOpen(false);
                                setSearchQuery('');
                            }}
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

    if (typeof document !== 'undefined') {
        return ReactDOM.createPortal(modalContent, document.body);
    }
    return modalContent;
};

export default AddNodeModal;
