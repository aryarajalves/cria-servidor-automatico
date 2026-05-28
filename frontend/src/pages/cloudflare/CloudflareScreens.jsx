import React from 'react';
import ReactDOM from 'react-dom';
import { Globe, Cloud } from 'lucide-react';

export const CheckingSettingsScreen = () => {
    const content = (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#020617' }} className="flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse" />
            
            <div className="relative flex flex-col items-center">
                <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-blue-500/20 rounded-full" />
                    <div className="absolute top-0 left-0 w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                        <Globe size={32} className="animate-pulse" />
                    </div>
                </div>
                
                <div className="text-center">
                    <span className="text-[10px] text-blue-500 uppercase font-black tracking-[0.3em] mb-3 block opacity-70">Sincronizando Sistema</span>
                    <h3 className="text-4xl font-black text-white mb-2 tracking-tight">Verificando DNS...</h3>
                    <p className="text-slate-500 text-lg">Aguarde enquanto validamos as configurações de domínio na Cloudflare...</p>
                </div>
                
                <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-shimmer" style={{ backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)' }} />
                </div>
            </div>
        </div>
    );
    return ReactDOM.createPortal(content, document.body);
};

export const MissingTokenScreen = () => {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center animate-in fade-in duration-500">
            <div className="p-6 bg-slate-900 rounded-full">
                <Cloud size={64} className="text-slate-700" />
            </div>
            <div className="max-w-md space-y-2">
                <h2 className="text-2xl font-bold text-white">Token Necessário</h2>
                <p className="text-slate-400">
                    Para gerenciar o DNS, configure seu API Token da Cloudflare nas configurações.
                </p>
            </div>
            <a
                href="/settings"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
                Ir para Configurações
            </a>
        </div>
    );
};

export const MissingDefaultDomainScreen = () => {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center animate-in fade-in duration-500">
            <div className="p-6 bg-slate-900 rounded-full">
                <Globe size={64} className="text-slate-700" />
            </div>
            <div className="max-w-md space-y-2">
                <h2 className="text-2xl font-bold text-white">Selecione um Domínio Padrão</h2>
                <p className="text-slate-400">
                    Para acessar o gerenciamento de DNS rápido, você precisa definir qual é o <b>Domínio Padrão</b> do sistema.
                </p>
            </div>
            <a
                href="/settings"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
            >
                <Globe size={18} />
                Selecionar nas Configurações
            </a>
        </div>
    );
};
