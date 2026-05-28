import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import api from '../services/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Toast from '../components/ui/Toast';
import Modal from '../components/ui/Modal';
import { Globe, RefreshCw, Plus, Trash2, Edit2, Check, X, Search, Cloud, Eye, EyeOff, Filter, AlertTriangle } from 'lucide-react';
import { CheckingSettingsScreen, MissingTokenScreen, MissingDefaultDomainScreen } from './cloudflare/CloudflareScreens';


const CloudflareDNS = () => {
    const { selectedServer, setIsGlobalLoading = () => {} } = useServer();
    const [zones, setZones] = useState([]);
    const [selectedZone, setSelectedZone] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [missingToken, setMissingToken] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // New Record State
    const [newRecord, setNewRecord] = useState({ type: 'A', name: '', content: selectedServer?.host || '', proxied: true });
    const [addingRecord, setAddingRecord] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    // State for default domain enforcement
    const [checkingSettings, setCheckingSettings] = useState(true);
    const [defaultDomainId, setDefaultDomainId] = useState(null);
    const [missingDefaultDomain, setMissingDefaultDomain] = useState(false);
    const [filterIp, setFilterIp] = useState(true);

    // SSL Checking State
    const [checkingSsl, setCheckingSsl] = useState({});
    const [sslStatus, setSslStatus] = useState({});

    const handleCheckSSL = async (record) => {
        const domain = record.name;
        setCheckingSsl(prev => ({ ...prev, [record.id]: true }));
        try {
            const res = await api.post('/cloudflare/check-ssl', { domain });
            setSslStatus(prev => ({ ...prev, [record.id]: res.data }));
            if (res.data.valid) {
                showToast(`SSL para ${domain} está ativo!`, 'success');
            } else {
                showToast(`SSL para ${domain} não está pronto ou é inválido.`, 'error');
            }
        } catch (e) {
            showToast("Erro ao verificar SSL: " + (e.response?.data?.detail || e.message), 'error');
            setSslStatus(prev => ({ ...prev, [record.id]: { valid: false, message: e.message } }));
        } finally {
            setCheckingSsl(prev => ({ ...prev, [record.id]: false }));
        }
    };


    // Initial load
    useEffect(() => {
        checkSettingsAndLoad();
    }, []);

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
    };

    const checkSettingsAndLoad = async () => {
        setCheckingSettings(true);
        setIsGlobalLoading(true);
        setLoading(true);
        setMissingToken(false);
        setMissingDefaultDomain(false);

        try {
            // 1. Fetch Settings to get default domain
            const settingsRes = await api.get('/settings', {
                params: { host: selectedServer?.host }
            });
            const defDomId = settingsRes.data.default_domain_id;

            if (!defDomId) {
                setMissingDefaultDomain(true);
                setLoading(false);
                setCheckingSettings(false);
                setIsGlobalLoading(false);
                return; // Stop here, show blocker
            }

            setDefaultDomainId(defDomId);

            // 2. Load Zones
            // Send empty token so backend uses stored setting
            const res = await api.post('/cloudflare/zones', { 
                api_token: '',
                host: selectedServer?.host
            });
            const fetchedZones = res.data.zones || [];
            setZones(fetchedZones);

            // 3. Auto-select the default domain
            const targetZone = fetchedZones.find(z => z.id === defDomId);
            if (targetZone) {
                setSelectedZone(targetZone);
                // Load records for this zone immediately
                loadRecords(targetZone.id);
            } else {
                // Default domain ID exists in settings but not found in Cloudflare zones (maybe deleted?)
                // We fallback to blocking state or showing error
                showToast("Domínio padrão configurado não encontrado na Cloudflare.", "error");
                setMissingDefaultDomain(true); // Treat as missing to force user to fix in settings
            }

        } catch (e) {
            console.error(e);
            const msg = e.response?.data?.detail || e.message;
            if (msg.includes("Token da Cloudflare não configurado")) {
                setMissingToken(true);
            } else {
                showToast("Erro ao carregar dados: " + msg, 'error');
            }
        } finally {
            setLoading(false);
            setCheckingSettings(false);
            setIsGlobalLoading(false);
        }
    };

    // ... loadZones removed (integrated above) ...
    // Keep loadRecords, handleEdit, etc.

    const loadRecords = async (zoneId) => {
        setLoadingRecords(true);
        setRecords([]); // Clear previous
        try {
            const res = await api.post('/cloudflare/records', {
                api_token: '',  // Use stored
                zone_id: zoneId,
                host: selectedServer?.host
            });
            setRecords(res.data.records || []);
        } catch (e) {
            showToast("Erro ao carregar registros: " + (e.response?.data?.detail || e.message), 'error');
        } finally {
            setLoadingRecords(false);
        }
    };

    const handleAddOrUpdateRecord = async () => {
        if (!newRecord.name || !newRecord.content) {
            showToast("Preencha o nome e o conteúdo.", "error");
            return;
        }

        setAddingRecord(true);
        try {
            if (editingRecord) {
                await api.post('/cloudflare/update', {
                    zone_id: selectedZone.id,
                    record_id: editingRecord.id,
                    type: newRecord.type,
                    name: newRecord.name,
                    content: newRecord.content,
                    proxied: newRecord.proxied,
                    host: selectedServer?.host
                });
                showToast("Registro atualizado com sucesso!");
                setEditingRecord(null);
            } else {
                await api.post('/cloudflare/create', {
                    zone_id: selectedZone.id,
                    type: newRecord.type,
                    name: newRecord.name,
                    content: newRecord.content,
                    proxied: newRecord.proxied,
                    host: selectedServer?.host
                });
                showToast("Registro criado com sucesso!");
            }
            // Reset form but keep last chosen type/IP for convenience if possible, 
            // but for now just reset to default or server IP
            setNewRecord({ type: 'A', name: '', content: selectedServer?.host || '', proxied: true });
            loadRecords(selectedZone.id);
        } catch (e) {
            showToast("Erro ao processar registro: " + (e.response?.data?.detail || e.message), "error");
        } finally {
            setAddingRecord(false);
        }
    };

    const handleEditRecord = (record) => {
        setEditingRecord(record);
        setNewRecord({
            type: record.type,
            name: record.name,
            content: record.content,
            proxied: record.proxied
        });
    };

    const handleCancelEdit = () => {
        setEditingRecord(null);
        setNewRecord({ type: 'A', name: '', content: selectedServer?.host || '', proxied: true });
    };

    const handleDeleteRecord = (record) => {
        setRecordToDelete(record);
        setShowDeleteModal(true);
    };

    const confirmDeleteRecord = async () => {
        if (!recordToDelete) return;

        setShowDeleteModal(false);
        try {
            await api.post('/cloudflare/delete', {
                zone_id: selectedZone.id,
                record_id: recordToDelete.id,
                host: selectedServer?.host
            });
            showToast("Registro deletado com sucesso!");
            loadRecords(selectedZone.id);
        } catch (e) {
            const errorData = e.response?.data;
            const detail = errorData?.detail || e.message;
            const errorMsg = typeof detail === 'object' ? JSON.stringify(detail) : detail;
            showToast("Erro ao deletar: " + errorMsg, "error");
        } finally {
            setRecordToDelete(null);
        }
    };

    const loadZones = () => {
        checkSettingsAndLoad();
    };

    // Renders
    if (checkingSettings) return <CheckingSettingsScreen />;
    if (missingToken) return <MissingTokenScreen />;
    if (missingDefaultDomain) return <MissingDefaultDomainScreen />;



    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {toast.show && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast({ ...toast, show: false })}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Globe className="text-blue-500" /> Cloudflare DNS
                    </h2>
                    <p className="text-slate-400">Gerencie suas zonas e registros DNS diretamente.</p>
                </div>
                <Button onClick={loadZones} isLoading={loading} variant="ghost">
                    <RefreshCw size={20} />
                </Button>
            </div>

            {/* Main Content Area */}
            {zones.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Zone List Sidebar HIDDEN - We enforce Default Domain */}

                    {/* Records Panel - Expanded to Full Width */}
                    <div className="lg:col-span-3 space-y-6">
                        {selectedZone ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                                    <h3 className="font-bold">Registros DNS: {selectedZone.name}</h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setFilterIp(!filterIp)}
                                            className={`flex items-center gap-2 px-3 py-1 rounded text-xs transition-colors border ${filterIp ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
                                            title={filterIp ? "Mostrando apenas registros do servidor atual" : "Mostrando todos os registros"}
                                        >
                                            <Filter size={14} />
                                            {filterIp ? 'Filtrando IP' : 'Todos'}
                                        </button>
                                        <Button variant="ghost" size="sm" onClick={() => loadRecords(selectedZone.id)} isLoading={loadingRecords}>
                                            <RefreshCw size={16} />
                                        </Button>
                                    </div>
                                </div>

                                {/* Add/Edit Record Form */}
                                <div className={`p-4 bg-slate-800/30 border-b border-slate-800 grid grid-cols-12 gap-3 items-center relative transition-colors duration-300 ${editingRecord ? 'bg-blue-500/5' : ''}`}>
                                    {editingRecord && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                    )}
                                    <div className="col-span-2">
                                        <select
                                            className="w-full h-10 bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                                            value={newRecord.type}
                                            onChange={(e) => setNewRecord({ ...newRecord, type: e.target.value })}
                                            disabled={!!editingRecord} // Disable type change on edit since backend doesn't support it easily
                                            title={editingRecord ? "Não é possível alterar o tipo ao editar" : ""}
                                        >
                                            {['A', 'CNAME', 'TXT', 'MX'].map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="text"
                                            placeholder="Nome (ex: @)"
                                            value={newRecord.name}
                                            onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                                            className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <input
                                            type="text"
                                            placeholder="Conteúdo (IP)"
                                            value={newRecord.content}
                                            onChange={(e) => setNewRecord({ ...newRecord, content: e.target.value })}
                                            className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-center justify-center h-10">
                                        <button
                                            onClick={() => setNewRecord({ ...newRecord, proxied: !newRecord.proxied })}
                                            className={`p-2 rounded transition-colors ${newRecord.proxied ? 'text-orange-500' : 'text-slate-500'}`}
                                            title="Proxy Cloudflare"
                                        >
                                            <Cloud size={20} />
                                        </button>
                                    </div>
                                    <div className="col-span-2 flex gap-1">
                                        {editingRecord ? (
                                            <>
                                                <Button className="flex-1 h-10 text-xs px-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAddOrUpdateRecord} isLoading={addingRecord}>
                                                    Salvar
                                                </Button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="h-10 px-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                                    title="Cancelar Edição"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <Button className="w-full h-10 text-sm flex items-center justify-center gap-2" onClick={handleAddOrUpdateRecord} isLoading={addingRecord}>
                                                <Plus size={16} /> Add
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Records List - with Filter */}
                                <div className="divide-y divide-slate-800">
                                    {loadingRecords ? (
                                        <div className="p-8 text-center text-slate-500">Carregando registros...</div>
                                    ) : (
                                        (() => {
                                            const filteredRecords = records.filter(r => {
                                                if (!filterIp) return true;
                                                return r.content === selectedServer?.host;
                                            });

                                            if (filteredRecords.length === 0) {
                                                return <div className="p-8 text-center text-slate-500">
                                                    {filterIp && records.length > 0
                                                        ? `Nenhum registro aponta para este servidor (${selectedServer?.host}). Desative o filtro para ver todos.`
                                                        : "Nenhum registro encontrado."}
                                                </div>
                                            }

                                            return filteredRecords.map(record => (
                                                <div key={record.id} className={`p-3 flex items-center justify-between hover:bg-slate-800/50 group transition-colors ${editingRecord?.id === record.id ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''}`}>
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <span className="w-12 font-mono font-bold text-slate-300 text-sm">{record.type}</span>
                                                        <span className="w-48 truncate text-slate-200 text-sm" title={record.name}>{record.name}</span>
                                                        <span className="flex-1 truncate text-slate-400 text-sm font-mono" title={record.content}>{record.content}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {['A', 'CNAME'].includes(record.type) && (
                                                            <button
                                                                onClick={() => handleCheckSSL(record)}
                                                                disabled={checkingSsl[record.id]}
                                                                className={`p-1 rounded hover:bg-slate-800 transition-colors ${checkingSsl[record.id] ? 'animate-spin text-blue-500' : sslStatus[record.id]?.valid ? 'text-green-500' : sslStatus[record.id] ? 'text-red-500' : 'text-slate-500'}`}
                                                                title={sslStatus[record.id] ? sslStatus[record.id].message : "Verificar status SSL (HTTPS)"}
                                                            >
                                                                {checkingSsl[record.id] ? (
                                                                    <RefreshCw size={14} className="animate-spin" />
                                                                ) : sslStatus[record.id]?.valid ? (
                                                                    <Check size={14} />
                                                                ) : sslStatus[record.id] ? (
                                                                    <X size={14} />
                                                                ) : (
                                                                    <Globe size={14} />
                                                                )}
                                                            </button>
                                                        )}
                                                        <Cloud
                                                            size={16}
                                                            className={record.proxied ? 'text-orange-500' : 'text-slate-600'}
                                                        />
                                                        <button
                                                            className="p-1 text-slate-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleEditRecord(record)}
                                                            title="Editar registro"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            className="p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleDeleteRecord(record)}
                                                            title="Deletar registro"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ));
                                        })()
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
                                Selecione uma zona para gerenciar os registros
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Deletion Modal */}
            <Modal
                show={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDeleteRecord}
                title="Deletar Registro DNS"
                message={`Você tem certeza que deseja deletar o registro "${recordToDelete?.name}"? Esta ação não pode ser desfeita.`}
                confirmText="Deletar Registro"
            />
        </div>
    );
};

export default CloudflareDNS;
