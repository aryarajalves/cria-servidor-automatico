import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useServer } from '../context/ServerContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import api from '../services/api';
import { Server, Lock, Key, Eye, EyeOff, AlertTriangle, Plus, ShieldCheck, Copy, Check } from 'lucide-react';
import CreateSshKeyModal from './ssh_keys/CreateSshKeyModal';

const Connect = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { addServerToList, setIsGlobalLoading, selectedServer } = useServer();

    const initialServerRef = useRef(selectedServer);

    useEffect(() => {
        if (selectedServer && !location.state?.forceAdd) {
            navigate('/');
        } else if (selectedServer && location.state?.forceAdd && selectedServer?.id !== initialServerRef.current?.id) {
            navigate('/');
        }
    }, [selectedServer, navigate, location.state]);

    const [authType, setAuthType] = useState('password'); // 'password' | 'key'
    const [savedKeys, setSavedKeys] = useState([]);
    const [isLoadingKeys, setIsLoadingKeys] = useState(false);
    const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        host: '',
        port: 22,
        username: 'root',
        password: '',
        key_id: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetchSavedKeys();
    }, []);

    const fetchSavedKeys = async () => {
        setIsLoadingKeys(true);
        try {
            const response = await api.get('/ssh-keys');
            const keys = response.data || [];
            setSavedKeys(keys);
            if (keys.length > 0 && !formData.key_id) {
                setFormData(prev => ({ ...prev, key_id: keys[0].id }));
            }
        } catch (err) {
            console.error('Erro ao buscar chaves salvas:', err);
        } finally {
            setIsLoadingKeys(false);
        }
    };

    const handleKeyCreated = (newKey) => {
        fetchSavedKeys();
        setFormData(prev => ({ ...prev, key_id: newKey.id }));
        setAuthType('key');
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const selectedKeyObject = savedKeys.find(k => String(k.id) === String(formData.key_id));

    const handleCopyPublicKey = () => {
        if (selectedKeyObject?.public_key) {
            navigator.clipboard.writeText(selectedKeyObject.public_key);
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2000);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setIsGlobalLoading(true);
        setError('');

        if (authType === 'key' && !formData.key_id) {
            setError('Selecione uma chave SSH cadastrada ou crie uma nova para continuar.');
            setIsLoading(false);
            setIsGlobalLoading(false);
            return;
        }

        const portNumber = Number(formData.port) || 22;

        try {
            const verifyPayload = {
                host: formData.host,
                port: portNumber,
                username: formData.username,
                auth_type: authType,
                password: authType === 'password' ? formData.password : null,
                key_id: authType === 'key' ? Number(formData.key_id) : null
            };

            // 1. Verifica a conexão SSH antes de salvar
            await api.post('/verify-connection', verifyPayload);

            // 2. Se conexão OK, salva no banco de dados do backend
            const response = await api.post('/servers', {
                name: formData.name || formData.host,
                host: formData.host,
                port: portNumber,
                username: formData.username,
                auth_type: authType,
                password: authType === 'password' ? formData.password : null,
                key_id: authType === 'key' ? Number(formData.key_id) : null
            });

            // 3. Adiciona ao estado global e redireciona
            if (response.data.status === 'success') {
                addServerToList({
                    id: response.data.id,
                    name: formData.name || formData.host,
                    host: formData.host,
                    port: portNumber,
                    username: formData.username,
                    auth_type: authType,
                    password: authType === 'password' ? formData.password : null,
                    key_id: authType === 'key' ? Number(formData.key_id) : null,
                    key_name: selectedKeyObject?.name
                });
                navigate('/');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'Falha ao conectar ao servidor. Verifique as credenciais e tente novamente.');
        } finally {
            setIsLoading(false);
            setIsGlobalLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center z-[1000] space-y-8 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-emerald-600/5 pointer-events-none" />
                
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Server className="text-emerald-500/50 animate-pulse" size={32} />
                    </div>
                </div>

                <div className="text-center relative z-10 space-y-2">
                    <span className="text-[10px] text-emerald-500 uppercase font-black tracking-[0.3em] animate-pulse">Estabelecendo Conexão</span>
                    <h3 className="text-4xl font-black text-white tracking-tight">
                        {authType === 'key' ? 'Testando Chave SSH Privada...' : 'Testando credenciais SSH...'}
                    </h3>
                    <p className="text-slate-500 text-lg">Estamos validando o acesso à sua VPS antes de prosseguir.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-6 pb-12">
            <CreateSshKeyModal
                isOpen={showCreateKeyModal}
                onClose={() => setShowCreateKeyModal(false)}
                onSuccess={handleKeyCreated}
            />

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500" />
                
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
                        <Server size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Conectar Nova VPS</h2>
                    <p className="text-slate-400 mt-1 text-sm">Cadastre um novo servidor para gerenciar suas stacks</p>
                </div>

                {/* Authentication Type Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-white/5 mb-6">
                    <button
                        type="button"
                        onClick={() => setAuthType('password')}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                            authType === 'password'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Lock size={14} />
                        Senha SSH
                    </button>
                    <button
                        type="button"
                        onClick={() => setAuthType('key')}
                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-bold text-xs transition-all ${
                            authType === 'key'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <Key size={14} />
                        Chave Privada
                    </button>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 flex items-start gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Apelido do Servidor (Opcional)"
                        name="name"
                        placeholder="Ex: Servidor Produção Chatwoot"
                        value={formData.name}
                        onChange={handleChange}
                    />

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                            <Input
                                label="IP do Servidor"
                                name="host"
                                placeholder="Ex: 192.168.1.1"
                                value={formData.host}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="col-span-1">
                            <Input
                                label="Porta SSH"
                                name="port"
                                type="number"
                                min="1"
                                max="65535"
                                placeholder="22"
                                value={formData.port}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <Input
                        label="Usuário SSH"
                        name="username"
                        placeholder="root"
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />

                    {authType === 'password' ? (
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-slate-400 ml-1">Senha SSH</label>
                            <div className="relative group">
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Digite a senha do root..."
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-12 text-sm"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-slate-400 ml-1">
                                    Chave SSH Privada *
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateKeyModal(true)}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                                >
                                    <Plus size={14} />
                                    Nova Chave
                                </button>
                            </div>

                            {savedKeys.length > 0 ? (
                                <select
                                    name="key_id"
                                    value={formData.key_id}
                                    onChange={handleChange}
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                    required
                                >
                                    {savedKeys.map((k) => (
                                        <option key={k.id} value={k.id}>
                                            {k.name} ({k.key_type || 'RSA'}) {k.has_passphrase ? '🔒' : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl text-center space-y-3">
                                    <p className="text-xs text-slate-400">Nenhuma chave SSH privada cadastrada.</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateKeyModal(true)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all"
                                    >
                                        Cadastrar ou Gerar Chave
                                    </button>
                                </div>
                            )}

                            {selectedKeyObject && (
                                <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <ShieldCheck size={12} className="text-emerald-400" />
                                            Chave Pública do Servidor
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCopyPublicKey}
                                            className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                                        >
                                            {copiedKey ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                            {copiedKey ? 'Copiado!' : 'Copiar'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate font-mono">
                                        {selectedKeyObject.public_key}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <Button 
                        type="submit" 
                        variant="primary" 
                        className={`w-full py-3 shadow-lg rounded-xl font-bold mt-6 transition-all ${
                            authType === 'key' 
                            ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20' 
                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                        }`} 
                        isLoading={isLoading}
                    >
                        Salvar e Conectar
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default Connect;
