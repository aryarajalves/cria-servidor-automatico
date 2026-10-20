import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * Modal Bloqueante exibido durante a instalação e configuração do Fail2ban na VPS.
 * Impede qualquer ação concorrente até que o apt-get e o serviço sejam finalizados.
 */
const Fail2banProgressModal = ({
    isOpen,
    isInstalled = false,
    host,
    maxretry,
    findtimeMinutes,
    bantimeDisplay
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
                className="relative z-10 w-full max-w-[490px] bg-slate-900 border border-blue-500/30 rounded-[32px] shadow-2xl shadow-black/90 p-8 md:p-10 text-center flex flex-col items-center animate-in zoom-in-95 duration-200 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glow decorativo de topo */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-pulse" />
                <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Ícone Animado com Pulse */}
                <div className="mb-6 relative">
                    <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 relative shadow-lg shadow-blue-500/10">
                        <Shield size={36} className="animate-pulse" />
                        <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-slate-900 border border-blue-500/40 text-blue-400">
                            <Loader2 size={16} className="animate-spin" />
                        </div>
                    </div>
                </div>

                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                    {isInstalled ? 'Aplicando Regras do Fail2ban' : 'Instalando e Ativando Fail2ban'}
                </h3>
                
                <p className="text-slate-400 text-xs mb-6 max-w-sm leading-relaxed">
                    Configurando a proteção ativa contra força-bruta no servidor <span className="font-mono text-slate-200 font-semibold">{host}</span>.
                </p>

                {/* Resumo da Regra sendo aplicada */}
                <div className="w-full p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 mb-6 text-left">
                    <div className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        🛡️ <strong className="text-white">Regra:</strong> Bloqueio automático após <strong className="text-blue-400">{maxretry} falhas</strong> dentro de <strong className="text-blue-400">{findtimeMinutes} min</strong> (Ban: <strong className="text-blue-400">{bantimeDisplay}</strong>).
                    </div>
                </div>

                {/* Etapas em execução */}
                <div className="w-full space-y-2.5 mb-6 text-left text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>1. Verificando pacotes do Fail2ban e Firewall Linux (IPTables)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>2. Gerando configurações de proteção (<code className="text-blue-300 font-mono text-[10px]">jail.local</code>)</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-slate-300">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>3. Inicializando serviço e ativando jail SSH</span>
                    </div>
                </div>

                {/* Alerta de Não Fechar */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] w-full text-left">
                    <AlertTriangle size={16} className="shrink-0 text-blue-400" />
                    <span>A instalação de pacotes leva cerca de 20-30s. Por favor, aguarde.</span>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default Fail2banProgressModal;
