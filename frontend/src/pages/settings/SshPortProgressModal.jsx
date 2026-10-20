import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Network, Loader2, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';

/**
 * Modal Bloqueante exibido durante a alteração de porta SSH na VPS.
 * Impede qualquer interação do usuário até que o processo seja concluído.
 */
const SshPortProgressModal = ({
    isOpen,
    currentPort,
    newPort,
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
                className="relative z-10 w-full max-w-[480px] bg-slate-900 border border-amber-500/30 rounded-[32px] shadow-2xl shadow-black/90 p-8 md:p-10 text-center flex flex-col items-center animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glow decorativo de topo */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 animate-pulse" />
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Ícone Animado com Pulse */}
                <div className="mb-6 relative">
                    <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 relative">
                        <Network size={36} className="animate-pulse" />
                        <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-slate-900 border border-amber-500/40 text-amber-400">
                            <Loader2 size={16} className="animate-spin" />
                        </div>
                    </div>
                </div>

                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                    Alterando Porta SSH na VPS
                </h3>
                
                <p className="text-slate-400 text-xs mb-6 max-w-sm leading-relaxed">
                    Aplicando as novas diretivas de segurança no servidor <span className="font-mono text-slate-200 font-semibold">{host}</span>.
                </p>

                {/* Badge de Transição de Portas */}
                <div className="flex items-center justify-center gap-3 px-5 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 mb-6 w-full">
                    <div className="text-center">
                        <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Porta Atual</span>
                        <span className="font-mono text-sm font-black text-slate-300">{currentPort}</span>
                    </div>

                    <ArrowRight size={18} className="text-amber-400 animate-pulse" />

                    <div className="text-center">
                        <span className="block text-[10px] text-amber-400 uppercase font-bold tracking-wider">Nova Porta</span>
                        <span className="font-mono text-sm font-black text-amber-400">{newPort}</span>
                    </div>
                </div>

                {/* Etapas em execução */}
                <div className="w-full space-y-2.5 mb-6 text-left text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span>1. Liberando nova porta no Firewall (UFW)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span>2. Reconfigurando OpenSSH (<code className="text-amber-300 font-mono text-[10px]">sshd_config</code>)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span>3. Reiniciando serviço e validando conectividade</span>
                    </div>
                </div>

                {/* Alerta de Não Fechar */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] w-full text-left">
                    <AlertTriangle size={16} className="shrink-0 text-amber-400" />
                    <span>Por favor, aguarde. Não feche nem recarregue a página até a conclusão.</span>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default SshPortProgressModal;
