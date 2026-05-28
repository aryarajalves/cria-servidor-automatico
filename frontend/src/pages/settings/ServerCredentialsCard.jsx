import React from 'react';
import { Server, Copy, Eye, EyeOff } from 'lucide-react';

/**
 * Exibe as credenciais do servidor VPS ativo (IP e senha SSH),
 * com botão de copiar e toggle de visibilidade.
 */
const ServerCredentialsCard = ({ selectedServer, showSshPassword, setShowSshPassword, showToast }) => {
    const handleCopyIp = () => {
        navigator.clipboard.writeText(selectedServer?.host);
        showToast('IP copiado!', 'success');
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-800 bg-slate-800/30">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Server size={20} className="text-emerald-500" /> Credenciais do Servidor
                </h3>
                <p className="text-xs text-slate-400">Informações de acesso à VPS ativa</p>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* IP / Host */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Endereço IP (Host)
                    </label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between group">
                        <span className="font-mono text-slate-200">{selectedServer?.host || 'Não definido'}</span>
                        <button
                            onClick={handleCopyIp}
                            className="text-slate-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                            title="Copiar IP"
                        >
                            <Copy size={16} />
                        </button>
                    </div>
                </div>

                {/* Senha SSH */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Senha SSH (Root)
                    </label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between group">
                        <span className="font-mono text-slate-200">
                            {showSshPassword ? selectedServer?.password : '••••••••••••••••'}
                        </span>
                        <button
                            onClick={() => setShowSshPassword(!showSshPassword)}
                            className="text-slate-500 hover:text-white transition-colors"
                            aria-label={showSshPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                            {showSshPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerCredentialsCard;
