import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Box, Share2, Activity, Terminal, Check, X, Info, Zap, WifiOff, RefreshCw, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';
import StatusModal from '../components/StatusModal';
import AppInstallModal from '../components/AppInstallModal';
import Toast from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

import { useStacks } from './stacks/useStacks';
import SetupStep from './stacks/SetupStep';
import AppCard from './stacks/AppCard';
import ExternalAppModal from './stacks/ExternalAppModal';
import ErrorBoundary from './stacks/ErrorBoundary';
import { apps } from './stacks/constants';

const Stacks = () => {
    const {
        selectedServer,
        status,
        activeStacks,
        stackUrls,
        stackCredentials,
        stackVersions,
        confirmAction,
        setConfirmAction,
        installationResult,
        setInstallationResult,
        loadingStep,
        configModal,
        setConfigModal,
        externalModal,
        setExternalModal,
        verifyingStatus,
        verifyingMessage,
        loading,
        error,
        toast,
        setToast,
        getActualStackName,
        fetchStatus,
        handleInstallDocker,
        handleInitSwarm,
        handleCreateNetwork,
        handleInstallCtop,
        handleConfirmInstall,
        handleInstallApp,
        handleRestartStack,
        handleUninstallApp,
        handleUpdateCredentials,
        handleUpdateDomain,
        handleMarkExternal,
        clearSelectedServer
    } = useStacks();
    const navigate = useNavigate();

    if (!selectedServer) return <Navigate to="/connect" />;

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
                        Não foi possível conectar ao servidor <span className="text-white font-mono font-bold">{selectedServer?.host}</span> via SSH.
                        <br />O servidor pode estar desligado, deletado ou com o firewall bloqueando a porta 22.
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

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-red-400">
                <h3 className="text-xl font-bold">Erro ao carregar stacks</h3>
                <p>{error}</p>
                <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
            </div>
        );
    }

    if (loading || verifyingStatus) {
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
                    <h3 className="text-4xl font-black text-white tracking-tight">{verifyingMessage}</h3>
                    <p className="text-slate-500 text-lg">Aguarde enquanto processamos sua solicitação no servidor...</p>
                    {loading && !verifyingStatus && (
                        <p className="text-slate-600 text-sm">Tempo limite: 30 segundos</p>
                    )}
                </div>

                <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 bg-blue-500 w-full h-full" style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)', animation: 'shimmer 2s infinite' }}></div>
                </div>

                {loading && !verifyingStatus && (
                    <button
                        onClick={() => {
                            clearSelectedServer();
                            navigate('/connect', { state: { forceAdd: true } });
                        }}
                        className="text-slate-600 hover:text-slate-400 text-sm transition-colors underline"
                    >
                        Cancelar e voltar ao início
                    </button>
                )}
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="space-y-12">

                {configModal && (
                    <AppInstallModal
                        isOpen={!!configModal}
                        app={configModal.app}
                        fields={configModal.app.fields}
                        onClose={() => setConfigModal(null)}
                        onInstall={handleConfirmInstall}
                    />
                )}

                {/* STEPS PREPARAÇÃO */}
                <section>
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold">Setup Inicial</h2>
                        <p className="text-slate-400">Prepare sua infraestrutura antes de instalar as aplicações</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SetupStep
                            title="1. Docker Engine"
                            description="Instala o runtime do Docker no servidor."
                            icon={Box}
                            isInstalled={status?.docker}
                            isLoading={loadingStep === 'docker'}
                            onInstall={handleInstallDocker}
                            color={{ bg: 'bg-blue-600/10', text: 'text-blue-500' }}
                        />
                        <SetupStep
                            title="2. Ativar Swarm"
                            description="Inicia o modo cluster único (Swarm Manager)."
                            icon={Share2}
                            isInstalled={status?.swarm}
                            isLoading={loadingStep === 'swarm'}
                            onInstall={handleInitSwarm}
                            color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-500' }}
                            disabled={!status?.docker}
                            disabledMessage="Requer Docker"
                        />
                        <SetupStep
                            title="3. Rede Overlay"
                            description="Cria a rede 'network_swarm_public'."
                            icon={Activity}
                            isInstalled={status?.network}
                            isLoading={loadingStep === 'network'}
                            onInstall={handleCreateNetwork}
                            color={{ bg: 'bg-purple-500/10', text: 'text-purple-500' }}
                            disabled={!status?.swarm}
                            disabledMessage="Requer Swarm Ativo"
                        />
                        <SetupStep
                            title="4. Instalar Ctop"
                            description="Monitoramento de containers via terminal (Top-like)."
                            icon={Terminal}
                            isInstalled={status?.ctop}
                            isLoading={loadingStep === 'ctop'}
                            onInstall={handleInstallCtop}
                            color={{ bg: 'bg-amber-500/10', text: 'text-amber-500' }}
                            disabled={!status?.network}
                            disabledMessage="Requer Rede Overlay"
                        />
                    </div>
                </section>

                {/* APPS PADRÃO */}
                <section>
                    <div className="mb-6 flex items-end justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Aplicativos</h2>
                            <p className="text-slate-400">Stacks prontas para produção</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
                            <Box size={10} />
                            <span>{apps.filter(a => a.category !== 'custom').length} Disponíveis</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {apps && apps.filter(a => a.category !== 'custom').map(app => {
                            const actualStackName = getActualStackName(app.stackName);
                            const isInstalled = !!actualStackName;

                            return (
                                <AppCard
                                    key={app.id}
                                    stack={app}
                                    onInstall={handleInstallApp}
                                    onRestart={handleRestartStack}
                                    onUninstall={handleUninstallApp}
                                    isInstalled={isInstalled}
                                    disabled={!status?.network}
                                    disabledMessage="Requer Rede Overlay"
                                    urls={stackUrls[actualStackName] || []}
                                    credentials={stackCredentials[actualStackName]}
                                    version={stackVersions[actualStackName]}
                                    onUpdateCredentials={handleUpdateCredentials}
                                    getActualStackName={getActualStackName}
                                    onUpdateDomain={handleUpdateDomain}
                                    onMarkExternal={(appId, appName) => setExternalModal({ appId, appName })}
                                />
                            );
                        })}
                    </div>
                </section>

                {/* APPS PRÓPRIOS */}
                <section className="pt-8 border-t border-slate-800/50">
                    <div className="mb-6 flex items-end justify-between">
                        <div>
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">Aplicativos Próprios</h2>
                            <p className="text-slate-400">Soluções exclusivas e personalizadas</p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                            <Zap size={10} />
                            <span>{apps.filter(a => a.category === 'custom').length} Disponíveis</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {apps && apps.filter(a => a.category === 'custom').map(app => {
                            const actualStackName = getActualStackName(app.stackName);
                            const isInstalled = !!actualStackName;
                            const hasRabbit = !!getActualStackName('rabbitmq');
                            const hasPostgres = !!getActualStackName('postgres');
                            const hasMinio = !!getActualStackName('minio');
                            
                            let customDisabled = !status?.network;
                            let customDisabledMsg = "Requer Rede Overlay";
                            
                            if (status?.network) {
                                if ((app.id === 'zapvoice' || app.id === 'backup_chatwoo_rabbit') && !hasRabbit) {
                                    customDisabled = true;
                                    customDisabledMsg = "Requer RabbitMQ";
                                } else if (app.id === 'ai_agent_manager') {
                                    const hasZapvoice = !!getActualStackName('zapvoice');
                                    const missing = [];
                                    if (!hasPostgres) missing.push("PostgreSQL");
                                    if (!hasRabbit) missing.push("RabbitMQ");
                                    if (!hasMinio) missing.push("MinIO S3");
                                    if (!hasZapvoice) missing.push("ZapVoice");
                                    if (missing.length > 0) {
                                        customDisabled = true;
                                        customDisabledMsg = `Requer: ${missing.join(', ')}`;
                                    }
                                } else if (app.id === 'oraculo') {
                                    const missing = [];
                                    if (!hasPostgres) missing.push("PostgreSQL");
                                    if (!hasMinio) missing.push("MinIO S3");
                                    if (!hasRabbit) missing.push("RabbitMQ");
                                    if (missing.length > 0) {
                                        customDisabled = true;
                                        customDisabledMsg = `Requer: ${missing.join(', ')}`;
                                    }
                                }
                            }

                            return (
                                <AppCard
                                    key={app.id}
                                    stack={app}
                                    onInstall={handleInstallApp}
                                    onRestart={handleRestartStack}
                                    onUninstall={handleUninstallApp}
                                    isInstalled={isInstalled}
                                    disabled={customDisabled}
                                    disabledMessage={customDisabledMsg}
                                    urls={stackUrls[actualStackName] || []}
                                    credentials={stackCredentials[actualStackName]}
                                    version={stackVersions[actualStackName]}
                                    onUpdateCredentials={handleUpdateCredentials}
                                    getActualStackName={getActualStackName}
                                    onUpdateDomain={handleUpdateDomain}
                                    onMarkExternal={(appId, appName) => setExternalModal({ appId, appName })}
                                />
                            );
                        })}
                    </div>
                </section>
            </div>

            {toast.show && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast({ ...toast, show: false })}
                    duration={5000}
                />
            )}

            {confirmAction && (
                <ConfirmDialog
                    isOpen={!!confirmAction}
                    title={confirmAction.title}
                    message={confirmAction.message}
                    type={confirmAction.type}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                    confirmText="Sim, prosseguir"
                    cancelText="Cancelar"
                />
            )}

            {installationResult && (
                <div className="fixed bottom-6 right-6 z-50 w-80 bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-right fade-in duration-500">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-500">
                                <Check size={16} />
                            </div>
                            <h4 className="text-sm font-bold text-white truncate max-w-[180px]">{installationResult.appName}</h4>
                        </div>
                        <button onClick={() => setInstallationResult(null)} className="text-slate-500 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2.5">
                            <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Usuário</span>
                            <code className="text-xs text-emerald-400 font-mono block truncate select-all">{installationResult.user}</code>
                        </div>
                        <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2.5">
                            <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Senha</span>
                            <code className="text-xs text-emerald-400 font-mono block truncate select-all">{installationResult.password}</code>
                        </div>
                    </div>
                    
                    <p className="text-[9px] text-slate-500 mt-3 flex items-center gap-1">
                        <Info size={10} />
                        Salvo no banco de dados automaticamente.
                    </p>
                </div>
            )}


            <ExternalAppModal
                isOpen={!!externalModal}
                onClose={() => setExternalModal(null)}
                onSave={handleMarkExternal}
                appName={externalModal?.appName}
                stackName={apps.find(a => a.id === externalModal?.appId)?.stackName}
            />
        </ErrorBoundary>
    );
};

export default Stacks;
