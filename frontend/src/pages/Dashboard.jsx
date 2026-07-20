import React, { useEffect, useState, useCallback } from 'react';
import { useServer } from '../context/ServerContext';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Button from '../components/ui/Button';
import { Server, Activity, Box, Share2, AlertCircle, WifiOff, RefreshCw, ArrowLeft } from 'lucide-react';

const StatCard = ({ title, value, subtext, icon: Icon, color }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg bg-opacity-10 ${color.bg} ${color.text}`}>
                <Icon size={24} />
            </div>
            {subtext && <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">{subtext}</span>}
        </div>
        <div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
            <div className="text-2xl font-bold text-slate-100">{value}</div>
        </div>
    </div>
);

const Dashboard = () => {
    const { selectedServer, setIsGlobalLoading = () => {}, isInitializing, clearSelectedServer } = useServer();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);
    const navigate = useNavigate(); // Usar o hook navigate em vez de window.location.href

    const fetchStatus = useCallback(async (signal) => {
        const ctrl = signal ? null : new AbortController();
        const actualSignal = signal || ctrl?.signal;
        const timeoutId = ctrl ? setTimeout(() => ctrl.abort(), 30000) : null;

        try {
            setLoading(true);
            setError(null);
            setIsGlobalLoading(true);
            const { data } = await api.post('/system-status', selectedServer, {
                signal: actualSignal
            });
            setStats(data);
            setError(null);
        } catch (err) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                // Ignora cancelamentos intencionais (evita bugs de StrictMode / unmount)
                return;
            }
            const msg = err.response?.data?.detail || err.message || '';
            const isOffline = msg.includes('Connection refused') || msg.includes('timed out') ||
                msg.includes('No route to host') || msg.includes('SSH') || msg.includes('ssh');
            setError(isOffline ? '__SERVER_OFFLINE__' : (msg || 'Falha ao obter status do sistema via SSH.'));
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            setLoading(false);
            setIsGlobalLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedServer]);

    useEffect(() => {
        if (!selectedServer) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        fetchStatus(controller.signal);

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedServer]);

    if (!selectedServer && !isInitializing) return <Navigate to="/connect" />;
    if (!selectedServer && isInitializing) return null;

    if (error === '__SERVER_OFFLINE__') {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} className="bg-slate-950 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-red-600/3 pointer-events-none" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />

                <div className="p-6 bg-red-500/10 rounded-full border border-red-500/20">
                    <WifiOff size={56} className="text-red-500" />
                </div>

                <div className="text-center space-y-3 max-w-md">
                    <span className="text-[10px] text-red-500 uppercase font-black tracking-[0.3em]">Conexão Falhou</span>
                    <h2 className="text-3xl font-black text-white">Servidor Inacessível</h2>
                    <p className="text-slate-400 text-base">
                        Não foi possível conectar ao servidor{' '}
                        <span className="text-white font-mono font-bold">{selectedServer?.host}</span> via SSH.
                        <br />O servidor pode estar desligado, deletado ou inacessível.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => fetchStatus()}
                        className="flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-slate-700"
                    >
                        <RefreshCw size={16} />
                        Tentar Novamente
                    </button>
                    <button
                        onClick={() => {
                            clearSelectedServer();
                            navigate('/connect', { state: { forceAdd: true } });
                        }}
                        className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Trocar de Servidor
                    </button>
                </div>
            </div>
        );
    }

    if (loading || isInitializing || !stats) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }} className="bg-slate-950 backdrop-blur-2xl flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse" />

                <div className="relative">
                    <div className="w-24 h-24 border-4 border-blue-500/20 rounded-full" />
                    <div className="absolute top-0 left-0 w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="text-blue-500 animate-pulse" size={32} />
                    </div>
                </div>

                <div className="text-center relative z-10 space-y-2">
                    <span className="text-[10px] text-blue-500 uppercase font-black tracking-[0.3em] animate-pulse">Sincronizando Sistema</span>
                    <h3 className="text-4xl font-black text-white tracking-tight">Verificando status do sistema...</h3>
                    <p className="text-slate-500 text-lg">Aguarde enquanto conectamos ao seu servidor e buscamos as últimas informações.</p>
                    <p className="text-slate-600 text-sm mt-2">Tempo limite: 30 segundos</p>
                </div>

                <button
                    onClick={() => { setLoading(false); setIsGlobalLoading(false); setError('Verificação cancelada pelo usuário.'); }}
                    className="mt-4 text-slate-600 hover:text-slate-400 text-sm transition-colors underline"
                >
                    Cancelar verificação
                </button>
            </div>
        );
    }

    const { system_status, detected_stacks, offline } = stats;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Visão Geral do Sistema</h2>
                    <p className="text-slate-400">Monitoramento em tempo real da sua VPS</p>
                </div>
                {offline && (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
                        <AlertCircle size={18} />
                        <span className="text-sm font-bold">Servidor Offline / Conectando...</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Docker Engine"
                    value={system_status.docker ? "Ativo" : "Inativo"}
                    subtext={typeof system_status.docker === 'string' ? system_status.docker.split(' ')[2] : 'Offline'}
                    icon={Box}
                    color={{ bg: system_status.docker ? 'bg-blue-500' : 'bg-red-500', text: system_status.docker ? 'text-blue-500' : 'text-red-500' }}
                />

                <StatCard
                    title="Swarm Mode"
                    value={system_status.swarm ? "Ativo" : "Inativo"}
                    icon={Share2}
                    color={{ bg: system_status.swarm ? 'bg-emerald-500' : 'bg-slate-500', text: system_status.swarm ? 'text-emerald-500' : 'text-slate-500' }}
                />

                <StatCard
                    title="Rede Overlay"
                    value={system_status.network ? "Criada" : "Ausente"}
                    subtext="network_swarm_public"
                    icon={Activity}
                    color={{ bg: system_status.network ? 'bg-purple-500' : 'bg-orange-500', text: system_status.network ? 'text-purple-500' : 'text-orange-500' }}
                />

                <StatCard
                    title="Stacks Ativas"
                    value={detected_stacks?.length || 0}
                    icon={Server}
                    color={{ bg: 'bg-indigo-500', text: 'text-indigo-500' }}
                />
            </div>

            {detected_stacks?.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 text-white">Serviços Detectados</h3>
                    <div className="flex flex-wrap gap-3">
                        {detected_stacks.map(stack => (
                            <span key={stack} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm font-mono border border-slate-700">
                                {stack}
                            </span>
                        ))}
                        {system_status.ctop && (
                            <span key="ctop" className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm font-mono border border-slate-700">
                                ctop
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
