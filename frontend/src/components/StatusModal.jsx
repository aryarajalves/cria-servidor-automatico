import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react';
import api from '../services/api';
import Button from './ui/Button';

const StatusModal = ({ service, title, onClose, onFinished }) => {
    const [status, setStatus] = useState('pending'); // pending, running, success, error
    const [message, setMessage] = useState('Iniciando...');
    const [logs, setLogs] = useState([]);
    // Use ref to track last log to avoid stale closure in setInterval
    const lastLogRef = React.useRef(null);

    useEffect(() => {
        let interval;
        let isFinished = false;

        const checkStatus = async () => {
            try {
                const { data } = await api.get(`/install-status/${service}`);

                // Check against ref, not state
                if (data.message && data.message !== lastLogRef.current) {
                    lastLogRef.current = data.message;
                    setLogs(prev => [...prev, data.message]);
                    setMessage(data.message);
                }

                if (data.status === 'success') {
                    setStatus('success');
                    isFinished = true;
                    if (onFinished) onFinished();
                } else if (data.status === 'error') {
                    setStatus('error');
                    isFinished = true;
                    setMessage(data.message); // Ensure error shows
                } else {
                    setStatus('running');
                }

            } catch (error) {
                console.error("Status check failed", error);
            }
        };

        // Check immediately then interval
        checkStatus();
        interval = setInterval(() => {
            if (!isFinished) checkStatus();
        }, 2000);

        return () => clearInterval(interval);
    }, [service]);

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center z-[1000] p-0 animate-in fade-in duration-500">
            <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse" />
            
            <div className="bg-slate-900/40 border border-white/10 rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden backdrop-blur-xl relative z-10 flex flex-col h-[600px] m-4">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>

                {/* Header */}
                <div className="px-10 py-8 border-b border-white/5 flex items-center justify-between relative z-10">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-blue-500 uppercase font-black tracking-[0.2em]">Processamento do Sistema</span>
                        <h3 className="text-3xl font-black flex items-center gap-4">
                            {status === 'running' && <Loader2 className="animate-spin text-blue-500" size={32} />}
                            {status === 'success' && <CheckCircle2 className="text-emerald-500" size={32} />}
                            {status === 'error' && <XCircle className="text-red-500" size={32} />}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">
                                {title}
                            </span>
                        </h3>
                    </div>
                </div>

                {/* Content */}
                <div className="p-10 flex-1 flex flex-col relative z-10 min-h-0">
                    <div className="mb-8 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <p className={`text-lg font-bold flex items-center gap-3 ${status === 'error' ? 'text-red-400' :
                                    status === 'success' ? 'text-emerald-400' :
                                        'text-blue-400'
                                }`}>
                                {status === 'success' ? 'Operação Concluída com Sucesso!' : message}
                            </p>
                            {status === 'running' && (
                                <span className="text-[10px] text-slate-500 font-mono animate-pulse">POOLING ATIVO...</span>
                            )}
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${
                                status === 'success' ? 'w-full bg-emerald-500' : 
                                status === 'error' ? 'w-full bg-red-500' : 
                                'w-1/2 bg-blue-500 animate-shimmer'
                            }`} 
                            style={{
                                backgroundSize: '200% 100%',
                                backgroundImage: status === 'running' ? 'linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)' : 'none'
                            }}/>
                        </div>
                    </div>

                    {/* Terminal Window */}
                    <div className="bg-black/40 rounded-3xl p-6 font-mono text-[13px] text-slate-400 flex-1 overflow-hidden border border-white/5 shadow-2xl flex flex-col group">
                        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/30"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-500/30"></div>
                                <div className="w-3 h-3 rounded-full bg-emerald-500/30"></div>
                            </div>
                            <span className="text-[10px] text-slate-600 uppercase tracking-[0.2em] font-black">System Terminal Output</span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                            {logs.map((log, i) => (
                                <div key={i} className={`mb-1.5 flex gap-4 animate-in slide-in-from-left-2 duration-300 ${i === logs.length - 1 ? 'text-blue-400 font-bold' : ''}`}>
                                    <span className="text-slate-700 text-[11px] select-none shrink-0">{new Date().toLocaleTimeString()}</span>
                                    <span className="break-all">{log}</span>
                                </div>
                            ))}
                            <div id="logs-end" />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    {status !== 'running' && (
                        <div className="mt-8 flex justify-end shrink-0">
                            <Button 
                                variant="primary" 
                                onClick={onClose}
                                className="px-12 py-4 h-auto text-base rounded-2xl shadow-xl shadow-blue-500/10 hover:shadow-blue-500/20 transform hover:-translate-y-1 transition-all duration-300"
                            >
                                {status === 'success' ? 'Voltar para Dashboard' : 'Fechar Janela'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatusModal;
