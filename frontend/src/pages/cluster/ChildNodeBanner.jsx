import React from 'react';
import { ShieldAlert } from 'lucide-react';

const ChildNodeBanner = ({ selectedServer, parentInfo }) => {
    return (
        <div className="bg-gradient-to-r from-red-500/10 via-rose-500/10 to-pink-500/10 border border-red-500/20 rounded-2xl p-8 flex flex-col items-center text-center gap-6 animate-in fade-in duration-300">
            <div className="p-4 rounded-full bg-red-500/10 text-red-400">
                <ShieldAlert size={48} />
            </div>
            <div className="max-w-md">
                <h3 className="text-xl font-bold text-white mb-2">Este servidor é um Nó Filho</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                    O servidor ativo <span className="text-red-400 font-bold">{selectedServer?.name}</span> já faz parte de outro cluster Swarm como um <span className="text-white font-bold">{parentInfo?.role?.toUpperCase()}</span>. Não é permitido gerenciar ou iniciar outro cluster a partir dele.
                </p>
                <div className="mt-6 p-4 bg-slate-900 border border-white/5 rounded-xl text-left space-y-2">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Informações do Servidor Pai:</p>
                    <p className="text-sm font-semibold text-white">Nome: <span className="text-blue-400">{parentInfo?.parent_name}</span></p>
                    <p className="text-sm font-semibold text-white">IP/Host: <span className="text-blue-400">{parentInfo?.parent_host}</span></p>
                </div>
            </div>
        </div>
    );
};

export default ChildNodeBanner;
