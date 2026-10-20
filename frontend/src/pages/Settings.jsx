import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Settings as SettingsIcon, ShieldCheck, Server, Globe, Layers, Key, Lock, Network } from 'lucide-react';
import Toast from '../components/ui/Toast';
import { useSettings } from './settings/useSettings';
import ServerCredentialsCard from './settings/ServerCredentialsCard';
import CloudflareCard from './settings/CloudflareCard';
import SshPasswordCard from './settings/SshPasswordCard';
import SshPortCard from './settings/SshPortCard';
import SshSecurityCard from './settings/SshSecurityCard';
import Fail2banCard from './settings/Fail2banCard';
import PortainerCard from './settings/PortainerCard';

// ─── Sub-componentes simples ─────────────────────────────────────────────────

const SettingsHeader = () => (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 md:p-8 rounded-[32px] border border-white/5 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="space-y-2 relative z-10">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-600/10">
                    <SettingsIcon size={24} />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">Configurações do Sistema</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-xl">
                Gerencie as integrações, chaves de API, credenciais e segurança do seu servidor VPS ativo.
            </p>
        </div>
    </div>
);

const SecurityNote = () => (
    <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
        <h4 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" /> Nota de Segurança
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
            As credenciais salvas aqui (Cloudflare e Portainer) são armazenadas de forma protegida para automação de deploys e emissão de SSL.
            A alteração da senha SSH é uma operação crítica executada diretamente na VPS.
        </p>
    </div>
);

const LoadingScreen = () => (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
        <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                <SettingsIcon size={24} className="animate-pulse" />
            </div>
        </div>
        <div className="text-center">
            <span className="text-[10px] text-blue-400 uppercase font-bold tracking-widest mb-1.5 block opacity-80">
                Sincronizando Sistema
            </span>
            <h3 className="text-xl font-bold text-white mb-1">Carregando configurações...</h3>
            <p className="text-slate-400 text-xs">Aguarde enquanto acessamos os dados do servidor.</p>
        </div>
    </div>
);

// ─── Página Principal ─────────────────────────────────────────────────────────

const Settings = () => {
    const settings = useSettings();
    const [activeTab, setActiveTab] = useState('server'); // 'server' | 'cloudflare' | 'portainer'

    if (settings.loadingSettings) return <LoadingScreen />;

    const tabs = [
        {
            id: 'server',
            label: 'Servidor & Acesso',
            icon: Server,
            description: 'IP, Chave SSH e Senha Root'
        },
        {
            id: 'cloudflare',
            label: 'Cloudflare API',
            icon: Globe,
            description: 'Automação de DNS e Domínios'
        },
        {
            id: 'portainer',
            label: 'API do Portainer',
            icon: Layers,
            description: 'Deploy Automático de Stacks'
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {settings.toast.show && (
                <Toast
                    message={settings.toast.message}
                    type={settings.toast.type}
                    onClose={settings.hideToast}
                />
            )}

            <SettingsHeader />

            {/* Navigation Tabs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1.5 bg-slate-900/60 border border-white/5 rounded-2xl backdrop-blur-xl">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3.5 p-4 rounded-xl text-left transition-all duration-300 relative group cursor-pointer ${
                                isActive
                                    ? 'bg-blue-600/15 text-white border border-blue-500/30 shadow-lg shadow-blue-600/10'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                            }`}
                        >
                            <div className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                                    : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
                            }`}>
                                <Icon size={20} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-bold tracking-tight truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                    {tab.label}
                                </h4>
                                <p className="text-[11px] text-slate-500 truncate">
                                    {tab.description}
                                </p>
                            </div>

                            {isActive && (
                                <div className="w-1.5 h-6 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)] shrink-0" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab Contents */}
            <div className="transition-all duration-300">
                {activeTab === 'server' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <ServerCredentialsCard
                            selectedServer={settings.selectedServer}
                            showSshPassword={settings.showSshPassword}
                            setShowSshPassword={settings.setShowSshPassword}
                            showToast={settings.showToast}
                        />

                        <SshPortCard
                            selectedServer={settings.selectedServer}
                            newSshPort={settings.newSshPort}
                            setNewSshPort={settings.setNewSshPort}
                            loadingPort={settings.loadingPort}
                            handleChangeSshPort={settings.handleChangeSshPort}
                            handleUpdatePortLocally={settings.handleUpdatePortLocally}
                        />

                        <SshSecurityCard
                            selectedServer={settings.selectedServer}
                            passwordAuthEnabled={settings.passwordAuthEnabled}
                            loadingPasswordAuth={settings.loadingPasswordAuth}
                            handleTogglePasswordAuth={settings.handleTogglePasswordAuth}
                            fetchPasswordAuthStatus={settings.fetchPasswordAuthStatus}
                        />

                        <Fail2banCard
                            selectedServer={settings.selectedServer}
                            fail2banStatus={settings.fail2banStatus}
                            loadingFail2ban={settings.loadingFail2ban}
                            loadingStatus={settings.loadingFail2banStatus}
                            handleSaveFail2ban={settings.handleSaveFail2ban}
                            handleUnbanIp={settings.handleUnbanIp}
                            handleToggleFail2ban={settings.handleToggleFail2ban}
                            fetchFail2banStatus={settings.fetchFail2banStatus}
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
                )}

                {activeTab === 'cloudflare' && (
                    <div className="animate-in fade-in duration-300 max-w-2xl">
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
                            fetchZones={settings.fetchZones}
                        />
                    </div>
                )}

                {activeTab === 'portainer' && (
                    <div className="animate-in fade-in duration-300 max-w-2xl">
                        <PortainerCard
                            portainerUser={settings.portainerUser}
                            setPortainerUser={settings.setPortainerUser}
                            portainerPassword={settings.portainerPassword}
                            setPortainerPassword={settings.setPortainerPassword}
                            loadingPortainer={settings.loadingPortainer}
                            handleSavePortainer={settings.handleSavePortainer}
                        />
                    </div>
                )}
            </div>

            <SecurityNote />
        </div>
    );
};

export default Settings;
