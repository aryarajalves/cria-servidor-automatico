import React, { useState, useEffect, useRef } from 'react';
import { 
    X, CheckCircle, AlertCircle, Loader2, Clock, Sparkles, Terminal, 
    ArrowRight, Check, RefreshCw
} from 'lucide-react';
import Button from '../../components/ui/Button';
import api from '../../services/api';

const AutoSetupProgressModal = ({ isOpen, onClose, selectedServer, onFinished }) => {
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    const logContainerRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !selectedServer?.host) return;

        let intervalId = null;

        const fetchStatus = async () => {
            try {
                const { data } = await api.get(`/auto-setup-status?host=${selectedServer.host}`);
                setStatusData(data);
                setLoading(false);

                // Auto-scroll nos logs
                if (logContainerRef.current) {
                    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                }

                if (data.status === 'completed' || data.status === 'error') {
                    if (data.status === 'completed' && onFinished) {
                        onFinished();
                    }
                }
            } catch (err) {
                console.error('Erro ao buscar status do setup automático:', err);
            }
        };

        fetchStatus();
        intervalId = setInterval(fetchStatus, 2000);

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isOpen, selectedServer?.host, onFinished]);

    if (!isOpen) return null;

    const steps = statusData?.steps || [];
    const logs = statusData?.logs || [];
    const isCompleted = statusData?.status === 'completed';
    const isError = statusData?.status === 'error';
    const isRunning = statusData?.status === 'running' || (!isCompleted && !isError);

    const completedCount = steps.filter(s => s.status === 'completed').length;
    const totalCount = steps.length || 1;
    const progressPercent = Math.round((completedCount / totalCount) * 100);

    return (
        <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop fixo não-clicável para fechar */}
            <div 
                className="fixed inset-0 w-full h-full bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300"
                onClick={(e) => e.stopPropagation()}
            />

            {/* Modal Dialog */}
            <div 
                className="relative z-10 bg-slate-900 border border-slate-700/60 rounded-[28px] w-full max-w-xl shadow-2xl shadow-black/90 overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Linha de Progresso Neon */}
                <div 
                    className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                />

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl border ${isCompleted ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : isError ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                            {isCompleted ? <CheckCircle size={22} /> : isError ? <AlertCircle size={22} /> : <Loader2 size={22} className="animate-spin" />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {isCompleted ? 'Setup Automático Concluído!' : isError ? 'Falha no Setup Automático' : 'Instalando Infraestrutura e Stacks...'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Servidor: <span className="text-blue-400 font-mono">{selectedServer?.host}</span> ({selectedServer?.name || 'Manager'})
                            </p>
                        </div>
                    </div>

                    {(isCompleted || isError) && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
                    {/* Barra de Progresso e Status Atual */}
                    <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-300">
                                {statusData?.current_step || 'Preparando pipeline...'}
                            </span>
                            <span className="font-mono text-blue-400 font-bold">
                                {completedCount} de {totalCount} ({progressPercent}%)
                            </span>
                        </div>
                        <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
                            <div 
                                className="bg-gradient-to-r from-blue-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500" 
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Lista das Etapas */}
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {steps.map((st, index) => {
                            const isDone = st.status === 'completed';
                            const isStepRunning = st.status === 'running';
                            const isStepError = st.status === 'error';

                            return (
                                <div 
                                    key={st.id || index}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isStepRunning ? 'bg-blue-500/10 border-blue-500/40 shadow-sm shadow-blue-500/10' : isDone ? 'bg-slate-950/20 border-emerald-500/20' : isStepError ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-950/10 border-slate-800/60 opacity-60'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        {isDone ? (
                                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                                <Check size={14} />
                                            </div>
                                        ) : isStepRunning ? (
                                            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                                                <Loader2 size={14} className="animate-spin" />
                                            </div>
                                        ) : isStepError ? (
                                            <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                                                <X size={14} />
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center">
                                                <Clock size={14} />
                                            </div>
                                        )}
                                        <span className={`text-xs font-medium ${isStepRunning ? 'text-blue-300 font-bold' : isDone ? 'text-slate-200' : isStepError ? 'text-red-300' : 'text-slate-500'}`}>
                                            {st.title}
                                        </span>
                                    </div>

                                    <span className="text-[11px] font-mono">
                                        {isDone && <span className="text-emerald-400">Instalado</span>}
                                        {isStepRunning && <span className="text-blue-400 animate-pulse">Executando...</span>}
                                        {isStepError && <span className="text-red-400">Erro</span>}
                                        {!isDone && !isStepRunning && !isStepError && <span className="text-slate-600">Pendente</span>}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Console Terminal de Logs */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center gap-1.5 font-bold">
                                <Terminal size={14} /> Log de Operações
                            </span>
                            <span className="text-[10px] text-slate-500">Tempo real</span>
                        </div>
                        <div 
                            ref={logContainerRef}
                            className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1"
                        >
                            {logs.length === 0 ? (
                                <p className="text-slate-600">Aguardando início dos comandos...</p>
                            ) : (
                                logs.map((l, i) => (
                                    <div key={i} className="leading-relaxed whitespace-pre-wrap">
                                        {l}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
                    {isRunning && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 size={14} className="animate-spin text-blue-400" />
                            <span>Não feche o navegador enquanto a automação estiver em andamento.</span>
                        </div>
                    )}
                    {isCompleted && (
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                            <CheckCircle size={14} />
                            <span>Servidor 100% configurado com sucesso!</span>
                        </div>
                    )}
                    {isError && (
                        <div className="flex items-center gap-2 text-xs text-red-400">
                            <AlertCircle size={14} />
                            <span>Houve uma falha na etapa. Verifique os logs acima.</span>
                        </div>
                    )}

                    {(isCompleted || isError) && (
                        <Button
                            onClick={onClose}
                            className={isCompleted ? "bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6" : "bg-slate-800 hover:bg-slate-700 text-white"}
                        >
                            {isCompleted ? "Concluir e Ver Stacks" : "Fechar"}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AutoSetupProgressModal;
