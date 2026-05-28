import React, { useState, useEffect } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import { X, ChevronDown, Check, Globe } from 'lucide-react';
import { useServer } from '../context/ServerContext';
import api from '../services/api';

const AppInstallModal = ({ isOpen, onClose, onInstall, app, fields }) => {
    const { selectedServer } = useServer();
    const formDataState = useState({}); // Renaming to avoid confusion if needed, but sticking to existing
    const [formData, setFormData] = formDataState;
    const [installing, setInstalling] = useState(false);

    // Custom DNS Dropdown State
    const [openDropdownField, setOpenDropdownField] = useState(null);
    // const [showAllDns, setShowAllDns] = useState(false); // Removed

    // DNS Selection State
    const [zones, setZones] = useState([]);
    const [records, setRecords] = useState({}); // Map of zoneId -> records[]
    const [loadingZones, setLoadingZones] = useState(false);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [cfMissingToken, setCfMissingToken] = useState(false);

    // Track selected zone for each dns_record field
    // structure: { [fieldName]: zoneId }
    const [selectedZones, setSelectedZones] = useState({});
    const [dnsSearch, setDnsSearch] = useState('');

    // Initialize defaults
    useEffect(() => {
        if (isOpen && fields) {
            const initialData = {};
            fields.forEach(field => {
                if (field.defaultValue) {
                    initialData[field.name] = field.defaultValue;
                }
            });
            setFormData(initialData);

            // Check if any field needs DNS
            const hasDnsField = fields.some(f => f.type === 'dns_record');
            if (hasDnsField) {
                fetchZonesAndSettings();
            }

            // Auto-fill Postgres Password if field exists
            if (fields.some(f => f.name === 'postgres_password')) {
                fetchPostgresPassword();
            }
        }
    }, [isOpen, fields]);

    const fetchPostgresPassword = async () => {
        try {
            const { data } = await api.post('/get-stack-env/postgres', selectedServer);
            if (data.env_vars && data.env_vars.POSTGRES_PASSWORD) {
                setFormData(prev => ({ ...prev, postgres_password: data.env_vars.POSTGRES_PASSWORD }));
            }
        } catch (error) {
            console.error("Erro ao buscar senha do Postgres:", error);
        }
    };

    const fetchZonesAndSettings = async () => {
        setLoadingZones(true);
        setCfMissingToken(false);
        try {
            // Try to get settings from host, fallback to global
            const settingsRes = await api.get('/settings', {
                params: { host: selectedServer?.host }
            });
            let defaultDomainId = settingsRes.data?.default_domain_id;
            
            if (!defaultDomainId) {
                const globalRes = await api.get('/settings', { params: { host: 'global' } });
                defaultDomainId = globalRes.data?.default_domain_id;
            }

            const { data } = await api.post('/cloudflare/zones', { 
                api_token: '',
                host: selectedServer?.host
            });
            const zonesList = data.zones || [];
            setZones(zonesList);

            if (defaultDomainId) {
                // Pre-select for all dns_record fields
                const dnsFields = fields.filter(f => f.type === 'dns_record');
                const newSelectedZones = {};
                dnsFields.forEach((f, index) => {
                    newSelectedZones[f.name] = defaultDomainId;
                    fetchRecords(defaultDomainId);
                    
                    // Auto-open the first dropdown if it's the only one or the first one
                    if (index === 0) {
                        setOpenDropdownField(f.name);
                    }
                });
                setSelectedZones(newSelectedZones);
            }
        } catch (error) {
            console.error("Erro ao buscar zonas/configurações:", error);
            const msg = error.response?.data?.detail || error.message;
            if (msg.includes("Token da Cloudflare não configurado")) {
                setCfMissingToken(true);
            }
        } finally {
            setLoadingZones(false);
        }
    };

    const fetchRecords = async (zoneId) => {
        if (!zoneId || records[zoneId]) return; // Cache or empty

        setLoadingRecords(true);
        try {
            const { data } = await api.post('/cloudflare/records', { 
                api_token: '', 
                zone_id: zoneId,
                host: selectedServer?.host
            });
            setRecords(prev => ({ ...prev, [zoneId]: data.records || [] }));
        } catch (error) {
            console.error("Erro ao buscar records:", error);
        } finally {
            setLoadingRecords(false);
        }
    };

    const handleZoneChange = (fieldName, zoneId) => {
        setSelectedZones(prev => ({ ...prev, [fieldName]: zoneId }));
        setDnsSearch(''); // Reset search when zone changes
        fetchRecords(zoneId);
        // Reset the field value because the zone changed
        handleChange(fieldName, '');
    };

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setInstalling(true);
        try {
            await onInstall(app, formData);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setInstalling(false);
        }
    };

    if (!isOpen) return null;

    const isFormValid = fields.every(field => {
        if (field.required === false) return true;
        const value = formData[field.name];
        return value && String(value).trim() !== '';
    });

    const renderField = (field) => {
        if (field.type === 'dns_record') {
            const zoneId = selectedZones[field.name] || '';
            const zoneRecords = records[zoneId] || [];

            if (cfMissingToken) {
                return (
                    <div key={field.name} className="mb-6 space-y-3">
                        <label className="block text-sm font-medium text-slate-400 mb-1.5">{field.label}</label>
                        <div className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl text-slate-400 text-xs flex items-start gap-3">
                            <Globe size={16} className="text-blue-500 mt-0.5 shrink-0" />
                            <span>
                                <strong className="text-slate-300 block mb-0.5">Entrada Manual</strong>
                                Digite o domínio completo abaixo. Se quiser seleção automática, configure o token em "Cloudflare DNS" ou nas Configurações.
                            </span>
                        </div>
                        <Input
                            name={field.name}
                            placeholder="ex: app.seudominio.com"
                            value={formData[field.name] || ''}
                            onChange={(e) => handleChange(field.name, e.target.value)}
                            required={field.required !== false}
                        />
                    </div>
                );
            }

            return (
                <div key={field.name} className="mb-4 space-y-3">
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">{field.label}</label>

                    {loadingZones && zones.length === 0 && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center animate-pulse">
                            <p className="text-xs text-slate-500">Carregando domínios da Cloudflare...</p>
                        </div>
                    )}

                    {!loadingZones && zones.length === 0 && (
                        <div className="bg-slate-900/50 border border-amber-500/20 rounded-lg p-4 text-center">
                            <p className="text-xs text-amber-500">Nenhum domínio configurado ou erro na Cloudflare.</p>
                            <button 
                                onClick={fetchZonesAndSettings}
                                className="text-[10px] text-blue-400 mt-2 hover:underline font-bold uppercase tracking-wider"
                            >
                                Tentar novamente
                            </button>
                        </div>
                    )}

                    {/* Zone Selector - Hidden if default is set or while loading */}
                    {zones.length > 0 && !selectedZones[field.name] && (
                        <div className="relative">
                            <label className="text-xs text-slate-500 mb-1 block uppercase font-bold tracking-wider">Passo 1: Selecione o Domínio (Zona)</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white appearance-none focus:outline-none focus:border-blue-500"
                                value={zoneId}
                                onChange={(e) => handleZoneChange(field.name, e.target.value)}
                            >
                                <option value="">Selecione uma Zona...</option>
                                {zones.map(z => (
                                    <option key={z.id} value={z.id}>{z.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-9 text-slate-500 pointer-events-none" size={16} />
                        </div>
                    )}

                    {/* Change domain button if using default */}
                    {selectedZones[field.name] && zones.length > 1 && (
                        <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                            <span>Domínio: {zones.find(z => z.id === selectedZones[field.name])?.name}</span>
                            <button
                                type="button"
                                className="text-blue-500 hover:text-blue-400"
                                onClick={() => setSelectedZones(prev => ({ ...prev, [field.name]: '' }))}
                            >
                                Trocar Domínio
                            </button>
                        </div>
                    )}

                    {/* Record Selector - Custom Dropdown */}
                    {zoneId && (
                        <div className="relative">
                            <label className="text-xs text-slate-500 mb-1 block uppercase font-bold tracking-wider">Passo 2: Selecione o Subdomínio (DNS)</label>

                            <div
                                id={`dns-trigger-${field.name}`}
                                className={`w-full bg-slate-900 border ${formData[field.name] ? 'border-slate-700' : 'border-slate-700'} rounded-lg px-4 py-2.5 text-white flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors shadow-inner`}
                                onClick={() => {
                                    const isOpen = openDropdownField === field.name;
                                    setOpenDropdownField(isOpen ? null : field.name);
                                    if (!isOpen) {
                                        // Small delay for the animation/render to start
                                        setTimeout(() => {
                                            document.getElementById(`dns-trigger-${field.name}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }, 100);
                                    }
                                }}
                            >
                                <span className={!formData[field.name] ? "text-slate-500" : "truncate"}>
                                    {formData[field.name]
                                        ? (() => {
                                            const r = records[zoneId]?.find(r => r.name === formData[field.name]);
                                            return r ? `${r.name} (${r.type}) -> ${r.content}` : formData[field.name];
                                        })()
                                        : "Selecione um registro..."
                                    }
                                </span>
                                <ChevronDown size={16} className={`text-slate-500 transition-transform ${openDropdownField === field.name ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Dropdown Menu */}
                            {openDropdownField === field.name && (
                                <div className="absolute top-full left-0 w-full bg-slate-800/95 border border-slate-700 rounded-lg mt-2 z-50 shadow-2xl flex flex-col max-h-72 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-xl">
                                    {/* Search Box */}
                                    <div className="p-2 border-b border-slate-700 bg-slate-800/80 backdrop-blur-sm sticky top-0 z-10">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Buscar subdomínio..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            value={dnsSearch}
                                            onChange={(e) => setDnsSearch(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>

                                    <div className="overflow-y-auto custom-scrollbar">
                                        {(() => {
                                            const allRecordsRaw = (records[zoneId] || []).filter(r => r.type === 'A' || r.type === 'CNAME');

                                            // 1. Filter: Match IP for A records, or just show all CNAMEs for now (since we can't easily resolve them)
                                            // Or better: show records that match the IP OR the search term if they want more.
                                            const myServerRecords = allRecordsRaw.filter(r => {
                                                if (r.type === 'A') return r.content === selectedServer?.host;
                                                return true; // Keep CNAMEs as they might be relevant
                                            });

                                            // 2. Then apply the search filter on this subset
                                            const searchTerm = dnsSearch.toLowerCase();
                                            const filteredRecords = myServerRecords.filter(r =>
                                                r.name.toLowerCase().includes(searchTerm)
                                            );

                                            if (allRecordsRaw.length === 0) {
                                                return <div className="p-6 text-center text-slate-500 text-sm">Nenhum registro A ou CNAME nesta zona.</div>;
                                            }

                                            if (filteredRecords.length === 0) {
                                                return (
                                                    <div className="p-6 text-center space-y-2">
                                                        <div className="text-slate-500 text-sm">Nenhum registro encontrado {dnsSearch ? `para "${dnsSearch}"` : "para este servidor"}.</div>
                                                        {!dnsSearch && (
                                                            <div className="text-[10px] text-slate-600 bg-slate-900/50 p-2 rounded">
                                                                Dica: Tente buscar pelo nome se ele não aparecer automaticamente.
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="py-1">
                                                    {filteredRecords.map(r => {
                                                        return (
                                                            <div
                                                                key={r.id}
                                                                className="px-4 py-3 hover:bg-slate-700/50 cursor-pointer text-sm border-b border-slate-700/30 last:border-0 flex flex-col relative group"
                                                                onClick={() => {
                                                                    handleChange(field.name, r.name);
                                                                    setOpenDropdownField(null);
                                                                    setDnsSearch('');
                                                                }}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-white font-medium group-hover:text-blue-400 transition-colors">{r.name}</span>
                                                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-bold tracking-tighter">Vinculado</span>
                                                                </div>
                                                                <span className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                                                                    <span className={`w-1.5 h-1.5 rounded-full bg-blue-500`} title={r.type} />
                                                                    {r.type} &rarr; <span className="font-mono">{r.content}</span>
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}

                            {loadingRecords && <span className="absolute right-10 top-9 text-xs text-slate-500">Carregando...</span>}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <Input
                key={field.name}
                label={field.label}
                name={field.name}
                type={field.type || "text"}
                placeholder={field.placeholder}
                value={formData[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                description={field.description}
                required={field.required !== false}
                autoComplete={field.type === 'password' ? 'new-password' : 'off'}
            />
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col max-h-[90vh] backdrop-blur-xl">
                {/* Decorative background element */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-12 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0 relative z-10">
                    <div className="flex items-center gap-5">
                        <div className={`p-4 rounded-xl ${app.colorBg} ${app.colorText} shadow-inner`}>
                            <app.icon size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Configurar {app.name}</h3>
                            <p className="text-sm text-slate-400">Personalize sua nova aplicação</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-800 text-slate-500 hover:text-white transition-all hover:rotate-90 duration-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-8 overflow-y-auto custom-scrollbar relative z-10">
                    {loadingZones ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4 animate-in fade-in duration-300">
                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-400 text-sm font-medium">Carregando informações...</p>
                        </div>
                    ) : (
                        <form id="install-form" onSubmit={handleSubmit} className={`space-y-6 transition-all duration-300 ${openDropdownField ? 'pb-64' : 'pb-0'}`}>
                            {/* Autocomplete honeypot */}
                            <input type="text" style={{ display: 'none' }} name="prevent_autofill" />
                            <input type="password" style={{ display: 'none' }} name="password_fake" />
                            
                            {fields.filter(f => f.name !== 'postgres_password').map(renderField)}
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-white/5 bg-slate-900/50 backdrop-blur-md shrink-0 flex justify-end gap-4 rounded-b-2xl relative z-10">
                    <Button variant="secondary" className="px-8" onClick={onClose} disabled={installing}>
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="install-form"
                        variant="primary"
                        className="px-8 shadow-blue-600/20"
                        isLoading={installing}
                        disabled={!isFormValid || installing}
                    >
                        Instalar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AppInstallModal;
