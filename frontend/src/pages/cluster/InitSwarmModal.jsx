import React from 'react';
import ReactDOM from 'react-dom';
import { Loader2, CheckCircle2, ShieldAlert, Network } from 'lucide-react';

const InitSwarmModal = ({
    showInitSwarmModal,
    setShowInitSwarmModal,
    initSwarmStatus,
    initSwarmMessage,
    fetchClusterData
}) => {
    if (!showInitSwarmModal) return null;

    const isLoading = initSwarmStatus === 'pending' || initSwarmStatus === 'running';
    const isSuccess = initSwarmStatus === 'success';
    const isError = initSwarmStatus === 'error';

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none w-screen h-screen"
            data-testid="init-swarm-modal"
        >
            {/* Backdrop escuro e transparente que cobre 100% da viewport */}
            <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md" />

            {/* Painel Central */}
            <div className="relative z-10 w-full max-w-md bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
                {/* Ícone Indicador */}
                <div className="flex justify-center mb-6">
                    {isLoading && (
                        <div className="p-4 rounded-full bg-amber-500/10 text-amber-400 relative border border-amber-500/20 shadow-lg shadow-amber-500/10">
                            <Loader2 size={40} className="animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <Network size={18} className="text-amber-400" />
                            </div>
                        </div>
                    )}
                    {isSuccess && (
                        <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10 animate-in zoom-in-75 duration-300">
                            <CheckCircle2 size={40} />
                        </div>
                    )}
                    {isError && (
                        <div className="p-4 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shadow-lg shadow-red-500/10 animate-in zoom-in-75 duration-300">
                            <ShieldAlert size={40} />
                        </div>
                    )}
                </div>

                {/* Título */}
                <h3 className="text-xl font-bold text-white mb-2">
                    {isLoading && 'Inicializando Swarm Manager'}
                    {isSuccess && 'Swarm Ativado com Sucesso!'}
                    {isError && 'Falha na Inicialização'}
                </h3>

                {/* Mensagem de Progresso / Detalhes */}
                <p className="text-sm text-slate-300 mb-6 max-w-xs mx-auto leading-relaxed">
                    {initSwarmMessage || (isLoading ? 'Configurando este servidor exclusivamente como Nó Manager (Leader principal)...' : '')}
                </p>

                {/* Aviso bloqueante enquanto estiver carregando */}
                {isLoading && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        Aguarde a finalização • Não feche esta janela
                    </div>
                )}

                {/* Botão de Fechamento (Apenas após sucesso ou erro) */}
                {(isSuccess || isError) && (
                    <button
                        onClick={() => {
                            setShowInitSwarmModal(false);
                            if (fetchClusterData) fetchClusterData();
                        }}
                        className={`w-full mt-4 px-5 py-3 rounded-xl font-bold transition-all active:scale-95 text-sm ${
                            isSuccess
                                ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        {isSuccess ? 'Concluir' : 'Fechar'}
                    </button>
                )}
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return ReactDOM.createPortal(modalContent, document.body);
    }
    return modalContent;
};

export default InitSwarmModal;
