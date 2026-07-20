import React from 'react';
import ReactDOM from 'react-dom';
import { Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import Toast from '../components/ui/Toast';
import { useSettings } from './settings/useSettings';
import ServerCredentialsCard from './settings/ServerCredentialsCard';
import CloudflareCard from './settings/CloudflareCard';
import SshPasswordCard from './settings/SshPasswordCard';
import PortainerCard from './settings/PortainerCard';


// ─── Sub-componentes simples ─────────────────────────────────────────────────

const SettingsHeader = () => (
    <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <SettingsIcon className="text-blue-500" /> Configurações do Sistema
            </h2>
            <p className="text-slate-400">Gerencie as integrações e segurança do seu servidor ativo</p>
        </div>
    </div>
);

const SecurityNote = () => (
    <div className="mt-8 bg-slate-900/30 border border-slate-800 p-6 rounded-2xl">
        <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" /> Nota de Segurança
        </h4>
        <p className="text-xs text-slate-500 leading-relaxed">
            As credenciais salvas aqui (Cloudflare e Portainer) são armazenadas localmente no servidor para fins de automação.
            A alteração da senha SSH é uma operação crítica; certifique-se de memorizar a nova senha.
        </p>
    </div>
);

const LoadingScreen = () => {
    const content = (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#020617' }} className="flex flex-col items-center justify-center">
            <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-pulse" />
            <div className="relative flex flex-col items-center">
                <div className="relative mb-8">
                    <div className="w-24 h-24 border-4 border-blue-500/20 rounded-full" />
                    <div className="absolute top-0 left-0 w-24 h-24 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                        <SettingsIcon size={32} className="animate-pulse" />
                    </div>
                </div>
                <div className="text-center">
                    <span className="text-[10px] text-blue-500 uppercase font-black tracking-[0.3em] mb-3 block opacity-70">
                        Sincronizando Sistema
                    </span>
                    <h3 className="text-4xl font-black text-white mb-2 tracking-tight">Carregando configurações...</h3>
                    <p className="text-slate-500 text-lg">Aguarde enquanto acessamos os dados do servidor...</p>
                </div>
                <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 animate-shimmer"
                        style={{
                            backgroundSize: '200% 100%',
                            backgroundImage: 'linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
    return ReactDOM.createPortal(content, document.body);
};

// ─── Página Principal ─────────────────────────────────────────────────────────

const Settings = () => {
    const settings = useSettings();

    if (settings.loadingSettings) return <LoadingScreen />;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {settings.toast.show && (
                <Toast
                    message={settings.toast.message}
                    type={settings.toast.type}
                    onClose={settings.hideToast}
                />
            )}

            <SettingsHeader />

            <ServerCredentialsCard
                selectedServer={settings.selectedServer}
                showSshPassword={settings.showSshPassword}
                setShowSshPassword={settings.setShowSshPassword}
                showToast={settings.showToast}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CloudflareCard
                    cfToken={settings.cfToken}
                    setCfToken={settings.setCfToken}
                    isCfTokenFromEnv={settings.isCfTokenFromEnv}
                    cfZones={settings.cfZones}
                    defaultDomain={settings.defaultDomain}
                    setDefaultDomain={settings.setDefaultDomain}
                    isLoadingZones={settings.isLoadingZones}
                    loadingCloudflare={settings.loadingCloudflare}
                    handleSaveCloudflare={settings.handleSaveCloudflare}
                />

                <PortainerCard
                    portainerUser={settings.portainerUser}
                    setPortainerUser={settings.setPortainerUser}
                    portainerPassword={settings.portainerPassword}
                    setPortainerPassword={settings.setPortainerPassword}
                    loadingPortainer={settings.loadingPortainer}
                    handleSavePortainer={settings.handleSavePortainer}
                />

                <SshPasswordCard
                    selectedServer={settings.selectedServer}
                    formData={settings.formData}
                    handleChange={settings.handleChange}
                    loadingSSH={settings.loadingSSH}
                    handleUpdateSSH={settings.handleUpdateSSH}
                    handleUpdatePasswordLocally={settings.handleUpdatePasswordLocally}
                />
            </div>

            <SecurityNote />
        </div>
    );
};

export default Settings;
