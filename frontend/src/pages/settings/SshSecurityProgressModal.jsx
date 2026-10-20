import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, ShieldCheck, Loader2, Lock, KeyRound, AlertTriangle } from 'lucide-react';

/**
 * Modal Bloqueante exibido durante a ativação/desativação de autenticação por senha na VPS.
 * Impede qualquer ação do usuário até que o processo seja finalizado.
 */
const SshSecurityProgressModal = ({
    isOpen,
    isDisabling = true,
    host
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop 100% bloqueante */}
            <div 
                className="fixed inset-0 w-full h-full bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto cursor-wait"
                onClick={(e) => e.stopPropagation()}
            />

            {/* Painel Central */}
            <div 
                className="relative z-10 w-full max-w-[480px] bg-slate-900 border border-red-500/30 rounded-[32px] shadow-2xl shadow-black/90 p-8 md:p-10 text-center flex flex-col items-center animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glow decorativo de topo */}
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r animate-pulse ${
                    isDisabling
                        ? 'from-red-500 via-rose-500 to-amber-500'
                        : 'from-blue-500 via-indigo-500 to-emerald-500'
                }`} />
                <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                    isDisabling ? 'bg-red-500/10' : 'bg-blue-500/10'
                }`} />

                {/* Ícone Animado com Pulse */}
                <div className="mb-6 relative">
                    <div className={`w-20 h-20 rounded-3xl border flex items-center justify-center relative ${
                        isDisabling
                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    }`}>
                        {isDisabling ? <Lock size={36} className="animate-pulse" /> : <KeyRound size={36} className="animate-pulse" />}
                        <div className={`absolute -bottom-2 -right-2 p-1.5 rounded-full bg-slate-900 border ${
                            isDisabling ? 'border-red-500/40 text-red-400' : 'border-blue-500/40 text-blue-400'
                        }`}>
                            <Loader2 size={16} className="animate-spin" />
                        </div>
                    </div>
                </div>

                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                    {isDisabling ? 'Desativando Senha na VPS' : 'Reativando Senha na VPS'}
                </h3>
                
                <p className="text-slate-400 text-xs mb-6 max-w-sm leading-relaxed">
                    Reconfigurando o serviço OpenSSH no servidor <span className="font-mono text-slate-200 font-semibold">{host}</span>.
                </p>

                {/* Etapas em execução */}
                <div className="w-full space-y-2.5 mb-6 text-left text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                        <span>1. Verificando chaves SSH autorizadas (Anti-lockout)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                        <span>2. Aplicando <code className="text-red-300 font-mono text-[10px]">{isDisabling ? 'PasswordAuthentication no' : 'PasswordAuthentication yes'}</code></span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                        <span>3. Validando sintaxe OpenSSH (<code className="text-red-300 font-mono text-[10px]">sshd -t</code>)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                        <span>4. Reiniciando serviço SSH e aplicando proteção</span>
                    </div>
                </div>

                {/* Alerta de Não Fechar */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] w-full text-left">
                    <AlertTriangle size={16} className="shrink-0 text-red-400" />
                    <span>Por favor, aguarde. Não feche nem recarregue a página até a conclusão.</span>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default SshSecurityProgressModal;
