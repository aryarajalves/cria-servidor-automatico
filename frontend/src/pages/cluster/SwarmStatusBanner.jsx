import React from 'react';
import { ShieldAlert, Play, CheckCircle2, Plus, Loader2 } from 'lucide-react';

const SwarmStatusBanner = ({
    swarmActive,
    isActivatingSwarm,
    handleInitSwarm,
    setShowAddModal
}) => {
    if (!swarmActive) {
        return (
            <div className="bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                        <ShieldAlert size={28} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Docker Swarm Inativo no Servidor Pai</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Para criar um cluster, você precisa inicializar o Docker Swarm neste servidor ativo para transformá-lo em um Manager/Leader.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleInitSwarm}
                    disabled={isActivatingSwarm}
                    className="w-full md:w-auto px-6 py-3 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                    {isActivatingSwarm ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Inicializando Swarm...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            Inicializar Swarm Manager
                        </>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 size={28} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">Docker Swarm Ativo & Pronto</h3>
                    <p className="text-slate-400 text-sm mt-1">
                        O nó principal está ativo. Agora você pode adicionar nós Workers ou Managers adicionais para escalar sua infraestrutura.
                    </p>
                </div>
            </div>
            <button
                onClick={() => setShowAddModal(true)}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            >
                <Plus size={18} />
                Adicionar Servidor ao Cluster
            </button>
        </div>
    );
};

export default SwarmStatusBanner;
