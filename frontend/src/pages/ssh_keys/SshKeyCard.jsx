import React, { useState } from 'react';
import { Key, Copy, Check, Eye, Trash2, Server, Lock, ShieldCheck } from 'lucide-react';

const SshKeyCard = ({ keyItem, onViewPrivate, onDelete, onCopyPublic }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (keyItem.public_key) {
            navigator.clipboard.writeText(keyItem.public_key);
            setCopied(true);
            onCopyPublic && onCopyPublic(keyItem);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-white/5 hover:border-white/10 rounded-2xl p-5 shadow-xl transition-all duration-300 flex flex-col justify-between group hover:scale-[1.01]">
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 group-hover:bg-blue-600/20 transition-colors">
                            <Key size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-base tracking-tight">{keyItem.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-white/5">
                                    {keyItem.key_type || 'RSA'}
                                </span>
                                {keyItem.has_passphrase && (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold flex items-center gap-1 border border-amber-500/20">
                                        <Lock size={10} /> Com Senha
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onViewPrivate(keyItem)}
                            title="Ver Chave Privada"
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <Eye size={16} />
                        </button>
                        <button
                            onClick={() => onDelete(keyItem)}
                            title="Excluir Chave"
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {/* Public Key Display */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck size={12} className="text-emerald-400" />
                            Chave Pública (VPS)
                        </span>
                        <button
                            onClick={handleCopy}
                            className="text-[11px] text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
                        >
                            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            {copied ? <span className="text-emerald-400 font-bold">Copiado!</span> : 'Copiar'}
                        </button>
                    </div>
                    <div 
                        onClick={handleCopy}
                        className="bg-slate-950/60 border border-white/5 rounded-xl p-2.5 text-[11px] font-mono text-slate-400 truncate cursor-pointer hover:border-blue-500/30 hover:text-slate-200 transition-all select-all"
                        title="Clique para copiar"
                    >
                        {keyItem.public_key || 'Chave pública não disponível'}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                    <Server size={13} className="text-slate-400" />
                    <span>{keyItem.servers_count || 0} servidor(es) vinculado(s)</span>
                </div>
                <span>{keyItem.created_at ? new Date(keyItem.created_at).toLocaleDateString('pt-BR') : ''}</span>
            </div>
        </div>
    );
};

export default SshKeyCard;
