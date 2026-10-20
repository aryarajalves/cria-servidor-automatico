import React from 'react';
import { Server, Copy, Eye, EyeOff, Key, ShieldCheck, Network } from 'lucide-react';

/**
 * Exibe as credenciais do servidor VPS ativo (IP, Porta SSH e senha/chave SSH),
 * com botão de copiar e toggle de visibilidade.
 */
const ServerCredentialsCard = ({ selectedServer, showSshPassword, setShowSshPassword, showToast }) => {
    const handleCopyIp = () => {
        navigator.clipboard.writeText(selectedServer?.host || '');
        showToast('IP copiado!', 'success');
    };

    const isKeyAuth = selectedServer?.auth_type === 'key';
    const port = selectedServer?.port || 22;

    return (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
            <div className="p-6 border-b border-slate-800/80 bg-slate-800/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Server size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Credenciais do Servidor</h3>
                        <p className="text-xs text-slate-400">Informações de acesso à VPS ativa</p>
                    </div>
                </div>

                <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
                    isKeyAuth 
                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' 
                        : 'bg-emerald-600/10 text-emerald-400 border-emerald-500/20'
                }`}>
                    {isKeyAuth ? <Key size={12} /> : <ShieldCheck size={12} />}
                    {isKeyAuth ? 'Autenticação por Chave' : 'Autenticação por Senha'}
                </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* IP / Host */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Endereço IP (Host)
                    </label>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between group hover:border-slate-700 transition-colors">
                        <span className="font-mono text-slate-200 text-sm font-semibold truncate mr-2">
                            {selectedServer?.host || 'Não definido'}
                        </span>
                        <button
                            type="button"
                            onClick={handleCopyIp}
                            className="text-slate-500 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800 shrink-0"
                            title="Copiar IP"
                        >
                            <Copy size={16} />
                        </button>
                    </div>
                </div>

                {/* Porta SSH */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Porta SSH
                    </label>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between group hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-2">
                            <Network size={16} className="text-amber-400" />
                            <span className="font-mono text-slate-200 text-sm font-bold">{port}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                            {port === 22 ? 'Padrão' : 'Custom'}
                        </span>
                    </div>
                </div>

                {/* Autenticação: Senha ou Chave */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {isKeyAuth ? 'Chave SSH Vinculada' : 'Senha SSH (Root)'}
                    </label>
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between group hover:border-slate-700 transition-colors">
                        {isKeyAuth ? (
                            <div className="flex items-center gap-2 truncate">
                                <Key size={16} className="text-blue-400 shrink-0" />
                                <span className="font-mono text-slate-200 text-sm font-semibold truncate">
                                    {selectedServer?.key_name || 'Chave SSH Privada'}
                                </span>
                            </div>
                        ) : (
                            <>
                                <span className="font-mono text-slate-200 text-sm truncate mr-2">
                                    {showSshPassword ? (selectedServer?.password || 'Sem senha') : '••••••••••••••••'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowSshPassword(!showSshPassword)}
                                    className="text-slate-500 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800 shrink-0"
                                    aria-label={showSshPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                    {showSshPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerCredentialsCard;
