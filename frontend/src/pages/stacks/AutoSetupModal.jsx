import React, { useState, useEffect } from 'react';
import { 
    X, Sparkles, Box, Globe, Database, RefreshCw, Shield, HardDrive
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import DnsRecordSelect from './DnsRecordSelect';
import AutoSetupAppSection from './AutoSetupAppSection';
import { apps } from './constants';
import api from '../../services/api';

const generateSafePassword = (length = 16) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let pass = '';
    for (let i = 0; i < length; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
};

const AutoSetupModal = ({ isOpen, onClose, onStartSetup, selectedServer }) => {
    // 1. Infra Base
    const [installDocker, setInstallDocker] = useState(true);
    const [installSwarm, setInstallSwarm] = useState(true);
    const [installNetwork, setInstallNetwork] = useState(true);
    const [installCtop, setInstallCtop] = useState(true);

    // 2. Traefik & Portainer
    const [installTraefik, setInstallTraefik] = useState(true);
    const [traefikEmail, setTraefikEmail] = useState('aryarajmarketing@gmail.com');
    const [installPortainer, setInstallPortainer] = useState(true);
    const [portainerDomain, setPortainerDomain] = useState('');
    const [portainerPassword, setPortainerPassword] = useState(() => generateSafePassword(16));

    // 3. Bancos, Filas & Storage
    const [installPostgres, setInstallPostgres] = useState(true);
    const [postgresPassword, setPostgresPassword] = useState(() => generateSafePassword(16));
    const [installRedis, setInstallRedis] = useState(true);
    const [installRabbitmq, setInstallRabbitmq] = useState(true);
    const [rabbitmqUser, setRabbitmqUser] = useState('admin');
    const [rabbitmqPassword, setRabbitmqPassword] = useState(() => generateSafePassword(16));
    const [installMinio, setInstallMinio] = useState(false);
    const [minioServerUrl, setMinioServerUrl] = useState('');
    const [minioConsoleUrl, setMinioConsoleUrl] = useState('');
    const [minioRootUser, setMinioRootUser] = useState('unwind');
    const [minioRootPassword, setMinioRootPassword] = useState(() => generateSafePassword(16));

    // 4. Apps Próprios Selecionados e Parâmetros
    const [selectedApps, setSelectedApps] = useState({});
    const [appParams, setAppParams] = useState({});

    // Cloudflare Zones & DNS Records
    const [zones, setZones] = useState([]);
    const [selectedZoneId, setSelectedZoneId] = useState('');
    const [records, setRecords] = useState({});
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [validationError, setValidationError] = useState('');

    const fetchRecords = async (zoneId) => {
        if (!zoneId || records[zoneId]) return;
        try {
            setLoadingRecords(true);
            const { data } = await api.post('/cloudflare/records', {
                api_token: '',
                zone_id: zoneId,
                host: selectedServer?.host
            });
            setRecords(prev => ({ ...prev, [zoneId]: data.records || [] }));
        } catch (e) {
            console.error("Erro ao buscar registros DNS:", e);
        } finally {
            setLoadingRecords(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const loadZonesAndSettings = async () => {
            try {
                const { data } = await api.post('/cloudflare/zones', {
                    api_token: '',
                    host: selectedServer?.host
                });
                const zonesList = data.zones || [];
                setZones(zonesList);
                if (zonesList.length > 0) {
                    const firstZoneId = zonesList[0].id;
                    setSelectedZoneId(firstZoneId);
                    try {
                        setLoadingRecords(true);
                        const recRes = await api.post('/cloudflare/records', {
                            api_token: '',
                            zone_id: firstZoneId,
                            host: selectedServer?.host
                        });
                        setRecords({ [firstZoneId]: recRes.data.records || [] });
                    } catch (err) {
                        console.error("Erro ao carregar records da primeira zona:", err);
                    } finally {
                        setLoadingRecords(false);
                    }
                }
            } catch (e) {
                // Cloudflare opcional
            }
        };

        loadZonesAndSettings();
    }, [isOpen, selectedServer?.host]);

    const dnsProps = {
        serverHost: selectedServer?.host,
        zones,
        records,
        loadingRecords,
        selectedZoneId,
        onSelectZone: (zoneId) => {
            setSelectedZoneId(zoneId);
            fetchRecords(zoneId);
        },
        onFetchRecords: fetchRecords
    };

    const handleToggleApp = (appId, isChecked) => {
        setSelectedApps(prev => ({
            ...prev,
            [appId]: isChecked
        }));
    };

    const handleParamChange = (appId, fieldName, value) => {
        setAppParams(prev => ({
            ...prev,
            [appId]: {
                ...(prev[appId] || {}),
                [fieldName]: value
            }
        }));
    };

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        setValidationError('');

        if (installPortainer && !portainerDomain.trim()) {
            setValidationError('Por favor, informe o domínio de acesso do Portainer.');
            return;
        }

        if (installMinio && (!minioServerUrl.trim() || !minioConsoleUrl.trim())) {
            setValidationError('Por favor, preencha os domínios da API S3 e Console do MinIO.');
            return;
        }

        // Validação de campos obrigatórios de cada aplicativo próprio selecionado
        const checkedAppIds = Object.keys(selectedApps).filter(id => selectedApps[id]);
        for (const appId of checkedAppIds) {
            const appDef = apps.find(a => a.id === appId);
            if (!appDef) continue;

            const visibleFields = (appDef.fields || []).filter(f => f.name !== 'postgres_password');
            for (const field of visibleFields) {
                if (field.required !== false) {
                    const val = appParams[appId]?.[field.name];
                    if (!val || !val.trim()) {
                        setValidationError(`Por favor, preencha o campo "${field.label}" para ${appDef.name}.`);
                        return;
                    }
                }
            }
        }

        // Montar lista de apps customizados
        const customAppsList = checkedAppIds.map(appId => {
            const appDef = apps.find(a => a.id === appId);
            const params = { ...(appParams[appId] || {}) };
            for (const k of Object.keys(params)) {
                if (typeof params[k] === 'string') {
                    params[k] = params[k].trim();
                }
            }
            params.super_admin_email = traefikEmail;
            params.superadmin_email = traefikEmail;

            return {
                id: appId,
                title: appDef?.name || appId,
                params
            };
        });

        const payload = {
            host: selectedServer.host,
            username: selectedServer.username || 'root',
            password: selectedServer.password,
            install_docker: installDocker,
            install_swarm: installSwarm,
            install_network: installNetwork,
            install_ctop: installCtop,
            install_traefik: installTraefik,
            traefik_email: traefikEmail,
            install_portainer: installPortainer,
            portainer_domain: portainerDomain.trim(),
            portainer_password: portainerPassword,
            install_postgres: installPostgres,
            postgres_password: postgresPassword,
            install_redis: installRedis,
            install_rabbitmq: installRabbitmq,
            rabbitmq_user: rabbitmqUser,
            rabbitmq_password: rabbitmqPassword,
            install_minio: installMinio,
            minio_console_url: minioConsoleUrl.trim(),
            minio_server_url: minioServerUrl.trim(),
            minio_root_user: minioRootUser,
            minio_root_password: minioRootPassword,
            custom_apps: customAppsList
        };

        onStartSetup(payload);
    };

    return (
        <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop fixo */}
            <div 
                className="fixed inset-0 w-full h-full bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={(e) => e.stopPropagation()}
            />

            {/* Modal Dialog */}
            <div 
                className="relative z-10 bg-slate-900 border border-blue-500/30 rounded-[28px] w-full max-w-2xl shadow-2xl shadow-black/80 overflow-hidden my-8 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-purple-500" />

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                            <Sparkles size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                Setup Automático do Servidor
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    1-Clique
                                </span>
                            </h3>
                            <p className="text-xs text-slate-400">
                                Configura a infraestrutura e instala as aplicações em lote sem intervenções manuais.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body com Scroll */}
                <form id="auto-setup-form" noValidate onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
                    {validationError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                            <Shield size={16} />
                            <span>{validationError}</span>
                        </div>
                    )}

                    {/* SEÇÃO 1: INFRAESTRUTURA BASE */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                                <Box size={14} /> 1. Infraestrutura Básica
                            </h4>
                            <span className="text-[11px] text-slate-500">Pré-requisitos do cluster</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={installDocker} 
                                    onChange={(e) => setInstallDocker(e.target.checked)}
                                    className="rounded border-slate-700 text-blue-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">Docker Engine</div>
                                    <div className="text-[11px] text-slate-500">Runtime dos containers</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={installSwarm} 
                                    onChange={(e) => setInstallSwarm(e.target.checked)}
                                    className="rounded border-slate-700 text-blue-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">Ativar Swarm</div>
                                    <div className="text-[11px] text-slate-500">Swarm Manager único</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={installNetwork} 
                                    onChange={(e) => setInstallNetwork(e.target.checked)}
                                    className="rounded border-slate-700 text-blue-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">Rede Overlay</div>
                                    <div className="text-[11px] text-slate-500">network_swarm_public</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={installCtop} 
                                    onChange={(e) => setInstallCtop(e.target.checked)}
                                    className="rounded border-slate-700 text-blue-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">Monitor Ctop</div>
                                    <div className="text-[11px] text-slate-500">Monitor top no terminal</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* SEÇÃO 2: TRAEFIK & PORTAINER */}
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                                <Globe size={14} /> 2. Roteamento & Painel Portainer
                            </h4>
                            <span className="text-[11px] text-slate-500">Gestão e SSL</span>
                        </div>

                        <div className="space-y-3">
                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={installTraefik} 
                                    onChange={(e) => setInstallTraefik(e.target.checked)}
                                    className="rounded border-slate-700 text-blue-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <span className="font-semibold text-slate-200">Traefik Proxy (SSL Automático)</span>
                                    <span className="block text-[11px] text-slate-500">Certificados Let's Encrypt para todas as stacks</span>
                                </div>
                            </label>

                            <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-4">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={installPortainer} 
                                        onChange={(e) => setInstallPortainer(e.target.checked)}
                                        className="rounded border-slate-700 text-blue-500 focus:ring-0 w-4 h-4" 
                                    />
                                    <span className="font-bold text-slate-200">Instalar Portainer CE & Configurar API</span>
                                </label>

                                {installPortainer && (
                                    <div className="space-y-3 pl-6 border-l-2 border-blue-500/30">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                Domínio do Portainer <span className="text-red-400">*</span>
                                            </label>
                                            <DnsRecordSelect
                                                {...dnsProps}
                                                value={portainerDomain}
                                                onChange={setPortainerDomain}
                                                placeholder="ex: portainer.meudominio.com"
                                                required={installPortainer}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                                Senha de Administrador do Portainer (Salva Automaticamente)
                                            </label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="text"
                                                    value={portainerPassword}
                                                    onChange={(e) => setPortainerPassword(e.target.value)}
                                                    placeholder="Senha de admin..."
                                                    required={installPortainer}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => setPortainerPassword(generateSafePassword(16))}
                                                    title="Gerar nova senha segura"
                                                >
                                                    <RefreshCw size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO 3: BANCOS, FILAS & STORAGE */}
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                                <Database size={14} /> 3. Bancos, Filas & Storage
                            </h4>
                            <span className="text-[11px] text-slate-500">Credenciais salvas automaticamente</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={installPostgres} 
                                    onChange={(e) => setInstallPostgres(e.target.checked)}
                                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">PostgreSQL</div>
                                    <div className="text-[11px] text-slate-500">Porta 5432</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={installRedis} 
                                    onChange={(e) => setInstallRedis(e.target.checked)}
                                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">Redis</div>
                                    <div className="text-[11px] text-slate-500">Porta 6379</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={installRabbitmq} 
                                    onChange={(e) => setInstallRabbitmq(e.target.checked)}
                                    className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">RabbitMQ</div>
                                    <div className="text-[11px] text-slate-500">Porta 5672</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/30 hover:border-slate-700 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={installMinio} 
                                    onChange={(e) => setInstallMinio(e.target.checked)}
                                    className="rounded border-slate-700 text-amber-500 focus:ring-0 w-4 h-4" 
                                />
                                <div>
                                    <div className="font-semibold text-slate-200">MinIO S3</div>
                                    <div className="text-[11px] text-slate-500">Storage / Uploads</div>
                                </div>
                            </label>
                        </div>

                        {installMinio && (
                            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3 animate-in fade-in">
                                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <HardDrive size={14} /> Configuração de Domínios do MinIO S3
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">
                                            Domínio da API S3 (Público) <span className="text-red-400">*</span>
                                        </label>
                                        <DnsRecordSelect
                                            {...dnsProps}
                                            value={minioServerUrl}
                                            onChange={setMinioServerUrl}
                                            placeholder="ex: s3.meudominio.com"
                                            required={installMinio}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">
                                            Domínio do Console (Privado) <span className="text-red-400">*</span>
                                        </label>
                                        <DnsRecordSelect
                                            {...dnsProps}
                                            value={minioConsoleUrl}
                                            onChange={setMinioConsoleUrl}
                                            placeholder="ex: s3-console.meudominio.com"
                                            required={installMinio}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SEÇÃO 4: APLICATIVOS PRÓPRIOS */}
                    <AutoSetupAppSection
                        selectedApps={selectedApps}
                        onToggleApp={handleToggleApp}
                        appParams={appParams}
                        onParamChange={handleParamChange}
                        dnsProps={dnsProps}
                    />
                </form>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 bg-slate-950/50 border-t border-slate-800">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="auto-setup-form"
                        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold px-6 py-2.5 shadow-lg shadow-blue-500/25 flex items-center gap-2"
                    >
                        <Sparkles size={16} />
                        Iniciar Instalação Automatizada
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AutoSetupModal;
