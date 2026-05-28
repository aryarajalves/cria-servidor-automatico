import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import Button from '../components/ui/Button';
import StatusModal from '../components/StatusModal';
import AppInstallModal from '../components/AppInstallModal';
import { Box, Database, MessageSquare, Globe, Cloud, HardDrive, Share2, Activity, Terminal, CheckCircle2, Zap, Table, MessageCircle, Check, X } from 'lucide-react';
import Toast from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const SetupStep = ({ title, description, icon: Icon, isInstalled, onInstall, isLoading, color, disabled, disabledMessage }) => (
    <div className={`bg-slate-900 border ${disabled ? 'border-slate-800/50 opacity-50' : 'border-slate-800 hover:border-slate-700 hover:scale-[1.01] hover:bg-slate-800/50'} rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-300`}>
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color.bg} ${color.text}`}>
                <Icon size={24} />
            </div>
            <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                    {title}
                    {isInstalled && <CheckCircle2 size={16} className="text-emerald-500" />}
                </h3>
                <p className="text-sm text-slate-400">{description}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {isInstalled ? (
                <span className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    Instalado
                </span>
            ) : (
                <div className="flex flex-col items-end">
                    <Button
                        variant="primary"
                        className="text-sm px-4 py-2 h-10"
                        onClick={onInstall}
                        isLoading={isLoading}
                        disabled={disabled}
                    >
                        Instalar
                    </Button>
                    {disabled && disabledMessage && (
                        <span className="text-xs text-amber-500 mt-1">{disabledMessage}</span>
                    )}
                </div>
            )}
        </div>
    </div>
);

const ExternalAppModal = ({ isOpen, onClose, onSave, appName, stackName }) => {
    const [form, setForm] = useState({ url: '', email: '', password: '', version: '' });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(stackName, form.url, form.email, form.password, form.version);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                        <Globe size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Instalação Externa</h3>
                        <p className="text-xs text-slate-400">Vincular {appName} hospedado externamente</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Link / Domínio de Acesso</label>
                        <input
                            required
                            type="text"
                            placeholder="ex: painel.meudominio.com"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.url}
                            onChange={e => setForm({ ...form, url: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Versão da Aplicação (opcional)</label>
                        <input
                            type="text"
                            placeholder="ex: 1.0.0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.version}
                            onChange={e => setForm({ ...form, version: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">E-mail de Acesso (opcional)</label>
                        <input
                            type="text"
                            placeholder="ex: admin@gmail.com"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Senha de Acesso (opcional)</label>
                        <input
                            type="password"
                            placeholder="Sua senha"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            isLoading={loading}
                        >
                            Salvar Vínculo
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ChatwootAdminModal = ({ isOpen, onClose, onCreate, stackName }) => {
    const [form, setForm] = useState({ email: '', password: '', fullName: '', companyName: '' });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onCreate(stackName, form.email, form.password, form.fullName, form.companyName);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                        <Terminal size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Criar Admin (Terminal)</h3>
                        <p className="text-xs text-slate-400">Criação forçada ignorando validações</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Nome Completo</label>
                            <input
                                required
                                type="text"
                                placeholder="Seu Nome"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                                value={form.fullName}
                                onChange={e => setForm({ ...form, fullName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Nome da Empresa</label>
                            <input
                                required
                                type="text"
                                placeholder="Ex: Minha Agência"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                                value={form.companyName}
                                onChange={e => setForm({ ...form, companyName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">E-mail do Administrador</label>
                        <input
                            required
                            type="email"
                            placeholder="ex: voce@gmail.com"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Senha de Acesso</label>
                        <input
                            required
                            type="password"
                            placeholder="Mínimo 8 caracteres"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            isLoading={loading}
                        >
                            Criar Agora
                        </Button>
                    </div>
                </form>

                <p className="mt-4 text-[10px] text-slate-500 text-center leading-relaxed">
                    Este comando será executado diretamente no servidor. <br />
                    Use apenas se a interface do Chatwoot estiver bloqueando seu cadastro.
                </p>
            </div>
        </div>
    );
};

const AppCard = ({ stack, onInstall, onRestart, onUninstall, isInstalled, disabled, disabledMessage, urls, credentials, onUpdateCredentials, onCreateChatwootAdmin, getActualStackName, onOpenChatAdmin, onUpdateDomain, onMarkExternal, version }) => {
    const [installing, setInstalling] = useState(false);
    const [showCredentials, setShowCredentials] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ user: credentials?.user || '', password: credentials?.password || '' });
    const [editingUrlIdx, setEditingUrlIdx] = useState(null);
    const [editUrlValue, setEditUrlValue] = useState('');
    const [updatingDomain, setUpdatingDomain] = useState(false);

    useEffect(() => {
        if (credentials) {
            setEditForm({ user: credentials.user || '', password: credentials.password || '' });
        }
    }, [credentials]);

    const handleInstall = async () => {
        setInstalling(true);
        try {
            await onInstall(stack.id, stack.name);
        } finally {
            setInstalling(false);
        }
    };

    const handleRestart = async () => {
        setInstalling(true);
        try {
            await onRestart(stack.id, stack.name);
        } finally {
            setInstalling(false);
        }
    };

    const handleUninstall = async () => {
        setInstalling(true);
        try {
            await onUninstall(stack.id, stack.name);
        } finally {
            setInstalling(false);
        }
    };

    return (
        <div className={`
             border rounded-xl p-6 transition-all duration-300 relative overflow-hidden group
             ${isInstalled
                ? 'bg-slate-900/40 border-emerald-500/20 opacity-100' // Opacity 100 to show links clearly
                : disabled
                    ? 'bg-slate-900 border-slate-800/50 opacity-60'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-600 hover:scale-[1.02]'
            }
        `}>
            {/* Watermark for installed apps */}
            {isInstalled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                    <CheckCircle2 size={100} className="text-emerald-500/5" />
                </div>
            )}

            {isInstalled && (
                <div className="absolute top-0 right-0 bg-emerald-500/10 border-b border-l border-emerald-500/20 px-3 py-1 rounded-bl-xl z-10">
                    <span className="text-xs font-mono text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Instalado
                    </span>
                </div>
            )}

            <div className="flex items-start justify-between mb-4 mt-2 relative z-10">
                <div className={`p-3 rounded-lg ${stack.colorBg} ${stack.colorText}`}>
                    <stack.icon size={24} />
                </div>
            </div>

            <h3 className="text-lg font-bold mb-2 flex items-center gap-2 relative z-10">
                {stack.name}
                {version && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                        v{version}
                    </span>
                )}
            </h3>
            <p className="text-slate-400 text-sm mb-4 h-10 line-clamp-2 relative z-10">
                {stack.description}
            </p>

            {/* Credentials Section */}
            {isInstalled && !['traefik', 'redis', 'postgres'].includes(stack.id) && (
                <div className="mb-4 relative z-20">
                    <button
                        onClick={() => setShowCredentials(!showCredentials)}
                        className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-emerald-500/70 hover:text-emerald-400 transition-colors mb-2 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 hover:border-emerald-500/30 w-full justify-center"
                    >
                        <HardDrive size={12} />
                        {showCredentials ? "Ocultar Acesso" : "Ver Acesso"}
                    </button>

                    {showCredentials && !isEditing && (
                        <div className="bg-slate-950/80 border border-emerald-500/20 rounded-lg p-3 space-y-2 animate-in fade-in zoom-in duration-200">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-emerald-500/50 uppercase font-bold tracking-tighter">
                                        {['chatwoot', 'zapvoice', 'gerenciador_whatsapp', 'ai_agent_manager'].includes(stack.id) ? 'E-mail' : 'Usuário'}
                                    </span>
                                    <button 
                                        onClick={() => setIsEditing(true)}
                                        className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase"
                                    >
                                        {credentials ? "Editar" : "Adicionar"}
                                    </button>
                                </div>
                                <code className="text-[11px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-1 rounded select-all cursor-copy truncate" title="Clique para copiar">
                                    {credentials?.user || "Não encontrado"}
                                </code>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-emerald-500/50 uppercase font-bold tracking-tighter">Senha</span>
                                <code className="text-[11px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-1 rounded select-all cursor-copy truncate" title="Clique para copiar">
                                    {credentials?.password || "Não encontrada"}
                                </code>
                            </div>
                        </div>
                    )}

                    {showCredentials && isEditing && (
                        <div className="bg-slate-950/80 border border-blue-500/20 rounded-lg p-3 space-y-3 animate-in fade-in zoom-in duration-200">
                            <div className="space-y-2">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-blue-500/50 uppercase font-bold tracking-tighter">
                                        {['chatwoot', 'zapvoice', 'gerenciador_whatsapp', 'ai_agent_manager'].includes(stack.id) ? 'Novo E-mail' : 'Novo Usuário'}
                                    </span>
                                    <input 
                                        type="text"
                                        value={editForm.user}
                                        onChange={(e) => setEditForm({...editForm, user: e.target.value})}
                                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-blue-500/50 uppercase font-bold tracking-tighter">Nova Senha</span>
                                    <input 
                                        type="text"
                                        value={editForm.password}
                                        onChange={(e) => setEditForm({...editForm, password: e.target.value})}
                                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        onUpdateCredentials(stack.stackName, editForm);
                                        setIsEditing(false);
                                    }}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-1.5 rounded transition-colors"
                                >
                                    Salvar
                                </button>
                                <button 
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-1.5 rounded transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* URLs Section */}
            {isInstalled && urls && urls.length > 0 && (
                <div className="mb-4 relative z-10">
                    <div className="flex flex-col gap-2">
                        {urls.map((url, idx) => {
                            // Clean URL for display
                            const displayUrl = url.replace('https://', '').replace('http://', '');
                            const href = url.startsWith('http') ? url : `https://${url}`;
                            
                            const isCurrentlyEditing = editingUrlIdx === idx;

                            if (isCurrentlyEditing) {
                                return (
                                    <div key={idx} className="bg-slate-950/80 border border-blue-500/30 rounded-lg p-2 space-y-2 animate-in fade-in duration-200">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] text-blue-400/70 uppercase font-black tracking-widest">Editar Domínio</span>
                                            <input 
                                                type="text"
                                                value={editUrlValue}
                                                onChange={(e) => setEditUrlValue(e.target.value)}
                                                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
                                                placeholder="ex: novo.dominio.com"
                                                disabled={updatingDomain}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={async () => {
                                                    if (!editUrlValue.trim()) return;
                                                    setUpdatingDomain(true);
                                                    try {
                                                        await onUpdateDomain(getActualStackName(stack.stackName), displayUrl, editUrlValue.trim());
                                                        setEditingUrlIdx(null);
                                                    } catch (e) {
                                                        console.error(e);
                                                    } finally {
                                                        setUpdatingDomain(false);
                                                    }
                                                }}
                                                disabled={updatingDomain}
                                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-1.5 rounded transition-colors disabled:opacity-50"
                                            >
                                                {updatingDomain ? "Salvando..." : "Salvar"}
                                            </button>
                                            <button 
                                                onClick={() => setEditingUrlIdx(null)}
                                                disabled={updatingDomain}
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-1.5 rounded transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 text-xs transition-colors bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/20 hover:border-blue-500/40 relative group"
                                >
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors flex-1 truncate mr-12"
                                    >
                                        <Globe size={14} className="shrink-0" />
                                        <span className="truncate">{displayUrl}</span>
                                    </a>
                                    <div className="absolute right-2 top-1.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 pl-2 py-0.5 rounded">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingUrlIdx(idx);
                                                setEditUrlValue(displayUrl);
                                            }}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase transition-colors"
                                            title="Editar domínio manualmente"
                                        >
                                            Editar
                                        </button>
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            <Share2 size={12} />
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="relative z-10">
                <div className="flex flex-col items-center gap-2">
                    
                    {isInstalled && (
                        <div className="flex flex-col gap-2 w-full">
                            <div className="grid grid-cols-2 gap-2 w-full">
                                <Button
                                    variant="secondary"
                                    className="w-full text-xs py-2 h-9 border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                                    onClick={handleRestart}
                                    isLoading={installing}
                                    disabled={disabled}
                                >
                                    <Zap size={14} className="mr-2" />
                                    Reiniciar
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="w-full text-xs py-2 h-9 border-red-500/20 text-red-400 hover:bg-red-500/10"
                                    onClick={handleUninstall}
                                    isLoading={installing}
                                    disabled={disabled}
                                >
                                    <X size={14} className="mr-2" />
                                    Desinstalar
                                </Button>
                            </div>

                            {stack.id === 'chatwoot' && (
                                <>
                                    <Button
                                        variant="secondary"
                                        className="w-full text-xs py-2 h-9 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                                        onClick={() => onOpenChatAdmin(getActualStackName(stack.stackName))}
                                        disabled={disabled}
                                    >
                                        <Terminal size={14} className="mr-2" />
                                        Criar Admin (Terminal)
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                    
                    <Button
                        variant={isInstalled ? "primary" : "secondary"}
                        className="w-full text-sm"
                        onClick={handleInstall}
                        isLoading={installing}
                        disabled={disabled && !isInstalled}
                    >
                        {isInstalled ? "Reinstalar" : "Instalar"}
                    </Button>
                    {!isInstalled && (
                        <button
                            type="button"
                            onClick={() => onMarkExternal(stack.id, stack.name)}
                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider mt-1.5 transition-colors"
                        >
                            Instalado externamente?
                        </button>
                    )}
                    {disabled && !isInstalled && disabledMessage && (
                        <span className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                            {disabledMessage}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-white bg-red-900/20 border border-red-500 rounded-xl m-4">
                    <h2 className="text-xl font-bold mb-4">Algo deu errado na interface.</h2>
                    <p className="mb-2">Erro: {this.state.error?.toString()}</p>
                    <details className="text-xs text-slate-300 whitespace-pre-wrap">
                        {this.state.errorInfo?.componentStack}
                    </details>
                    <div className="mt-4">
                        <Button onClick={() => window.location.reload()}>Recarregar Página</Button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const apps = [
    {
        id: "traefik",
        stackName: "traefik",
        category: "standard",
        name: "Traefik Proxy",
        description: "Proxy reverso moderno com SSL automático via Cloudflare.",
        icon: Globe,
        version: "v2.10",
        colorBg: "bg-blue-600/10",
        colorText: "text-blue-500",
        fields: [
            { name: "email", label: "Email para Let's Encrypt", placeholder: "seu@email.com" }
        ]
    },
    {
        id: "portainer",
        stackName: "portainer",
        category: "standard",
        name: "Portainer",
        description: "Interface web para gerenciar seus containers e clusters.",
        icon: HardDrive,
        version: "CE",
        colorBg: "bg-blue-500/10",
        colorText: "text-blue-500",
        fields: [
            { name: "portainer_host", label: "Domínio do Portainer", placeholder: "Selecione o domínio...", type: "dns_record" }
        ]
    },
    {
        id: "redis",
        stackName: "redis",
        category: "standard",
        name: "Redis",
        description: "Armazenamento de estrutura de dados em memória.",
        icon: Database,
        version: "7.2",
        colorBg: "bg-red-500/10",
        colorText: "text-red-500"
    },
    {
        id: "postgres",
        stackName: "postgres",
        category: "standard",
        name: "PostgreSQL",
        description: "Banco de dados relacional robusto e open source.",
        icon: Database,
        version: "16.1",
        colorBg: "bg-blue-600/10",
        colorText: "text-blue-400",
        fields: []
    },
    {
        id: "chatwoot",
        stackName: "chatwoot_admin",
        category: "standard",
        name: "Chatwoot",
        description: "Plataforma de engajamento do cliente open-source.",
        icon: MessageSquare,
        version: "3.x",
        colorBg: "bg-emerald-500/10",
        colorText: "text-emerald-500",
        fields: [
            { name: "chatwoot_base_url", label: "URL do Chatwoot", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "postgres_password", label: "Senha Postgres (opcional)", placeholder: "Auto-preenchimento ou vazio...", type: "password", required: false }
        ]
    },
    {
        id: "rabbitmq",
        stackName: "rabbitmq",
        category: "standard",
        name: "RabbitMQ",
        description: "Message broker robusto e escalável.",
        icon: MessageCircle,
        version: "3.12",
        colorBg: "bg-orange-500/10",
        colorText: "text-orange-500",
        fields: [
            { name: "rabbit_user", label: "Usuário Admin", placeholder: "admin", required: false },
            { name: "rabbit_password", label: "Senha Admin", placeholder: "admin", type: "password", required: false },
            { name: "rabbit_base_url", label: "Domínio do RabbitMQ", placeholder: "Selecione o domínio...", type: "dns_record" }
        ]
    },
    {
        id: "ai_agent_manager",
        stackName: "agentes",
        category: "custom",
        name: "Gerente de Agente de IA",
        description: "Interface completa para gerenciamento de agentes de IA com Backend e Frontend.",
        icon: Zap,
        version: "1.0.0",
        colorBg: "bg-purple-600/10",
        colorText: "text-purple-500",
        fields: [
            { name: "openai_api_key", label: "OpenAI API Key (Opcional)", placeholder: "sk-...", type: "password", required: false },
            { name: "domain_backend", label: "Domínio do API (Backend)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "domain_frontend", label: "Domínio da Interface (Frontend)", placeholder: "Selecione o domínio...", type: "dns_record" },
        ]
    },
    {
        id: "zapvoice",
        stackName: "zapvoice",
        category: "custom",
        name: "ZapVoice",
        description: "Plataforma completa para automação e mensagens de voz.",
        icon: MessageCircle,
        version: "3.6.2",
        colorBg: "bg-blue-600/10",
        colorText: "text-blue-500",
        fields: [
            { name: "super_admin_email", label: "Email Super Admin", placeholder: "admin@email.com", required: true },
            { name: "chatwoot_base_url", label: "Domínio do ZapVoice", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "postgres_password", label: "Senha Postgres (opcional)", placeholder: "Auto-preenchimento ou vazio...", type: "password", required: false },
        ]
    },
    {
        id: "gerenciador_whatsapp",
        stackName: "gerenciador_whatsapp",
        category: "custom",
        name: "Gerenciador Grupo WhatsApp",
        description: "Sistema completo para gerenciamento de grupos de WhatsApp.",
        icon: MessageCircle,
        version: "1.4.3",
        colorBg: "bg-emerald-600/10",
        colorText: "text-emerald-500",
        fields: [
            { name: "super_admin_email", label: "Email do Super Admin", placeholder: "seu@email.com", required: true },
            { name: "backend_domain", label: "Domínio do API (Backend)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "frontend_domain", label: "Domínio da Interface (Frontend)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "postgres_password", label: "Senha Postgres (opcional)", placeholder: "Auto-preenchimento ou vazio...", type: "password", required: false },
        ]
    },
];

const Stacks = () => {
    const { selectedServer, setIsGlobalLoading = () => {} } = useServer();
    const [status, setStatus] = useState(null);
    const [activeStacks, setActiveStacks] = useState([]);
    const [stackUrls, setStackUrls] = useState({});
    const [stackCredentials, setStackCredentials] = useState({});
    const [stackVersions, setStackVersions] = useState({});
    const [confirmAction, setConfirmAction] = useState(null); // { title, message, onConfirm, type }
    const [installationResult, setInstallationResult] = useState(null);
    const [loadingStep, setLoadingStep] = useState(null);
    const [configModal, setConfigModal] = useState(null);
    const [externalModal, setExternalModal] = useState(null);
    const [chatAdminModal, setChatAdminModal] = useState(null); // { stackName }
    const [verifyingStatus, setVerifyingStatus] = useState(false);
    const [verifyingMessage, setVerifyingMessage] = useState("Verificando status do sistema...");

    // New states for error handling
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // Função auxiliar para encontrar o nome real da stack no servidor (suporta nomes dinâmicos como chatwoot_admin_01 e objetos/strings)
    const getActualStackName = (baseStackName) => {
        if (!Array.isArray(activeStacks) || activeStacks.length === 0) return null;
        const getName = (s) => (typeof s === 'string' ? s : s?.name);
        
        const match = activeStacks.find(s => {
            let name = getName(s);
            if (!name) return false;
            name = name.trim();
            
            const regex = new RegExp(`^${baseStackName}(_\\d+)?$`);
            return regex.test(name);
        });
        
        return match ? getName(match).trim() : null;
    };

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
    };

    useEffect(() => {
        if (selectedServer) fetchStatus();
    }, [selectedServer]);

    const fetchStatus = async () => {
        setLoading(true);
        setIsGlobalLoading(true);
        setInstallationResult(null); // Clear previous result on refresh
        try {
            const { data } = await api.post('/system-status', selectedServer);
            if (data) {
                setStatus(data.system_status);
                setActiveStacks(data.detected_stacks || []);
                setStackUrls(data.stack_urls || {});
                setStackCredentials(data.stack_credentials || {});
                setStackVersions(data.stack_versions || {});
                setError(null);
            }
        } catch (e) {
            console.error("Erro ao atualizar status:", e);
            setError(e.response?.data?.detail || e.message || "Falha ao conectar ao servidor.");
        } finally {
            setLoading(false);
            setIsGlobalLoading(false);
        }
    };

    if (!selectedServer) return <Navigate to="/connect" />;

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
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center z-[1000] space-y-8 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
                
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="text-blue-500/50 animate-pulse" size={32} />
                    </div>
                </div>

                <div className="text-center relative z-10 space-y-2">
                    <span className="text-[10px] text-blue-500 uppercase font-black tracking-[0.3em] animate-pulse">Sincronizando Sistema</span>
                    <h3 className="text-4xl font-black text-white tracking-tight">{verifyingMessage}</h3>
                    <p className="text-slate-500 text-lg">Aguarde enquanto processamos sua solicitação no servidor...</p>
                </div>

                <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 bg-blue-500 animate-[shimmer_2s_infinite] w-full h-full" style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)' }}></div>
                </div>
            </div>
        );
    }

    const pollInstallation = async (service) => {
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const { data } = await api.get(`/install-status/${service}`);
                    if (data.status === 'success') {
                        clearInterval(interval);
                        resolve(data);
                    } else if (data.status === 'error') {
                        clearInterval(interval);
                        reject(new Error(data.message));
                    } else {
                        setVerifyingMessage(data.message || `Instalando ${service}...`);
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 2000);
        });
    };

    const runInstallAction = async (actionFn, service) => {
        try {
            setVerifyingMessage(`Iniciando ${service}...`);
            setVerifyingStatus(true);
            setIsGlobalLoading(true);

            await actionFn();

            await pollInstallation(service);

            setVerifyingMessage("Verificando status do sistema...");
            await fetchStatus();
        } catch (e) {
            alert("Erro: " + (e.response?.data?.detail || e.message));
        } finally {
            setLoadingStep(null);
            setVerifyingStatus(false);
            setIsGlobalLoading(false);
        }
    };

    const handleInstallDocker = async () => {
        setConfirmAction({
            title: "Instalar Docker",
            message: "Isso irá instalar o Docker Engine no seu servidor. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('docker');
                runInstallAction(async () => await api.post('/install-docker', selectedServer), 'docker');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    const handleInitSwarm = async () => {
        setConfirmAction({
            title: "Ativar Swarm",
            message: "Isso irá transformar seu servidor em um Swarm Manager. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('swarm');
                runInstallAction(async () => await api.post('/init-swarm', selectedServer), 'swarm');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    const handleCreateNetwork = async () => {
        setConfirmAction({
            title: "Criar Rede Overlay",
            message: "Isso criará a rede 'network_swarm_public' necessária para as aplicações. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('network');
                runInstallAction(async () => await api.post('/create-network', selectedServer), 'network');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    const handleInstallCtop = async () => {
        setConfirmAction({
            title: "Instalar Ctop",
            message: "Isso instalará a ferramenta de monitoramento ctop. Deseja continuar?",
            onConfirm: () => {
                setLoadingStep('ctop');
                runInstallAction(async () => await api.post('/install-ctop', selectedServer), 'ctop');
                setConfirmAction(null);
            },
            type: "info"
        });
    };

    // ... apps definition ...

    // ...

    const handleCreateChatwootAdmin = async (stackName, email, password, fullName, companyName) => {
        try {
            setVerifyingMessage("Criando administrador via terminal...");
            setVerifyingStatus(true);
            const { data } = await api.post('/stacks/chatwoot/create-admin', {
                ...selectedServer,
                stack_name: stackName,
                admin_email: email,
                admin_password: password,
                full_name: fullName,
                company_name: companyName
            });
            if (data.status === 'success') {
                showToast(data.message);
                // Refresh status to see updated credentials if any
                await fetchStatus();
            } else {
                showToast(data.message, "error");
            }
        } catch (e) {
            showToast("Erro ao criar admin: " + (e.response?.data?.detail || e.message), "error");
        } finally {
            setVerifyingStatus(false);
        }
    };

    const handleConfirmInstall = async (app, configValues) => {
        try {
            // Map app ID to endpoints
            let endpoint = '';
            switch (app.id) {
                case 'traefik': endpoint = '/install-traefik'; break;
                case 'portainer': endpoint = '/install-portainer'; break;
                case 'redis': endpoint = '/install-redis'; break;
                case 'postgres': endpoint = '/install-postgres'; break;
                case 'chatwoot': endpoint = '/install-chatwoot'; break;
                case 'rabbitmq': endpoint = '/install-rabbitmq'; break;
                case 'ai_agent_manager': endpoint = '/install-ai-agent-manager'; break;
                case 'zapvoice': endpoint = '/install-zapvoice'; break;
                case 'gerenciador_whatsapp': endpoint = '/install-gerenciador-whatsapp'; break;
                default: throw new Error("App desconhecido");
            }

            console.log(`Installing ${app.name} at ${endpoint} with config:`, configValues);

            setVerifyingMessage(`Iniciando instalação de ${app.name}...`);
            setVerifyingStatus(true);

            await api.post(endpoint, {
                ...selectedServer,
                ...configValues,
                overwrite: !!getActualStackName(app.stackName)
            });

            // Poll for completion
            const result = await pollInstallation(app.id);

            // Store credentials if returned
            if (result && result.credentials) {
                setInstallationResult({
                    appName: app.name,
                    user: result.credentials.user,
                    password: result.credentials.password
                });
            }

            // Trigger full reload/status check view
            setVerifyingMessage("Verificando status do sistema...");
            await fetchStatus();
            
            if (result && result.credentials) {
                showToast(`${app.name} instalado com sucesso!`, 'success');
            } else {
                showToast(`${app.name} instalado!`, 'success');
            }

        } catch (e) {
            alert("Erro na instalação: " + (e.response?.data?.detail || e.message));
            console.error(e);
        } finally {
            setVerifyingStatus(false);
            setConfigModal(null); // Close modal if open
        }
    };

    // ...

    const handleInstallApp = async (appId, appName) => {
        const isInstalled = activeStacks.includes(apps.find(a => a.id === appId)?.stackName);
        
        setConfirmAction({
            title: isInstalled ? `Reinstalar ${appName}` : `Instalar ${appName}`,
            message: isInstalled 
                ? `Você está prestes a reinstalar ${appName}. Os dados existentes serão mantidos se houver volumes, mas o container será recriado. Continuar?`
                : `Deseja iniciar a instalação de ${appName} no seu servidor?`,
            type: isInstalled ? "warning" : "info",
            onConfirm: async () => {
                setConfirmAction(null);
                await proceedWithInstallApp(appId, appName);
            }
        });
    };

    const proceedWithInstallApp = async (appId, appName) => {
        let app = apps.find(a => a.id === appId);
        if (!app) return;

        // Clone to avoid mutation issues
        app = { ...app, fields: app.fields ? [...app.fields] : [] };

        const actualStackName = getActualStackName(app.stackName);
        const isInstalled = !!actualStackName;

        // Auto-fill Postgres Password if Postgres is installed
        const needsPostgres = app.fields.some(f => f.name === 'postgres_password');
        const hasPostgres = Array.isArray(activeStacks) && activeStacks.includes('postgres');

        if (needsPostgres && hasPostgres) {
            try {
                console.log("Fetching Postgres password for auto-fill...");
                const { data } = await api.post(`/get-stack-env/postgres`, selectedServer);
                const pgPass = data.env_vars?.POSTGRES_PASSWORD;

                if (pgPass) {
                    app.fields = app.fields.map(f => {
                        if (f.name === 'postgres_password') {
                            return { ...f, defaultValue: pgPass };
                        }
                        return f;
                    });
                }
            } catch (e) {
                console.error("Failed to fetch postgres password", e);
            }
        }

        // Fetch other env vars if stack is already installed
        let envVars = {};
        if (isInstalled && !['traefik', 'portainer', 'redis', 'postgres'].includes(appId)) {
            try {
                console.log(`Fetching environment variables for stack: ${actualStackName}`);
                const { data } = await api.post(`/get-stack-env/${actualStackName}`, selectedServer);
                envVars = data.env_vars || {};
            } catch (e) {
                console.error("Failed to fetch stack env vars", e);
            }
        }

        // Map current environment variables and domains to fields
        if (app.fields && app.fields.length > 0) {
            app.fields = app.fields.map(f => {
                let val = '';
                
                // If it's a dns_record field, try to find the domain
                if (f.type === 'dns_record') {
                    const urls = stackUrls[actualStackName] || [];
                    if (appId === 'ai_agent_manager') {
                        if (f.name === 'domain_backend') {
                            val = envVars.VITE_API_URL || envVars.CORS_ALLOWED_ORIGINS || urls[0] || '';
                        } else if (f.name === 'domain_frontend') {
                            val = envVars.FRONTEND_URL || urls[1] || urls[0] || '';
                        }
                    } else if (appId === 'gerenciador_whatsapp') {
                        if (f.name === 'backend_domain') {
                            val = envVars.BACKEND_DOMAIN || envVars.VITE_API_URL || urls[0] || '';
                        } else if (f.name === 'frontend_domain') {
                            val = envVars.FRONTEND_DOMAIN || urls[1] || urls[0] || '';
                        }
                    } else {
                        // Default fallback to first url
                        val = urls[0] || '';
                    }
                    
                    // Clean prefix/suffix from URL
                    if (val) {
                        val = val.replace('https://', '').replace('http://', '').replace('/api', '').replace('/ws', '').split(',')[0].trim();
                    }
                } 
                // Regular environment variable fields
                else {
                    const fieldNameUpper = f.name.toUpperCase();
                    if (envVars[fieldNameUpper] !== undefined) {
                        val = envVars[fieldNameUpper];
                    } else if (envVars[f.name] !== undefined) {
                        val = envVars[f.name];
                    } else if (f.name === 'postgres_password') {
                        val = envVars.POSTGRES_PASSWORD || f.defaultValue || '';
                    } else if (f.name === 'super_admin_email') {
                        val = envVars.SUPER_ADMIN_EMAIL || '';
                    } else if (f.name === 'openai_api_key') {
                        val = envVars.OPENAI_API_KEY || '';
                    } else if (f.name === 'rabbit_user') {
                        val = envVars.RABBITMQ_DEFAULT_USER || stackCredentials[actualStackName]?.user || '';
                    } else if (f.name === 'rabbit_password') {
                        val = envVars.RABBITMQ_DEFAULT_PASS || stackCredentials[actualStackName]?.password || '';
                    } else if (f.name === 'email' && appId === 'traefik') {
                        val = stackCredentials[actualStackName]?.user || '';
                    }
                }
                
                return val ? { ...f, defaultValue: val } : f;
            });
        }

        if (app.fields && app.fields.length > 0) {
            setConfigModal({ app });
        } else {
            // Install directly if no fields (like Redis)
            await handleConfirmInstall(app, {});
        }
    };

    const handleRestartStack = async (appId, appName) => {
        const app = apps.find(a => a.id === appId);
        if (!app) return;

        setConfirmAction({
            title: `Reiniciar ${app.name}`,
            message: `Isso irá forçar a recriação dos containers da stack ${app.name}. O serviço ficará offline por alguns segundos. Continuar?`,
            type: "warning",
            onConfirm: async () => {
                setConfirmAction(null);
                try {
                    setVerifyingMessage(`Reiniciando ${app.name}...`);
                    setVerifyingStatus(true);

                    const actualStackName = getActualStackName(app.stackName) || app.stackName;
                    await api.post('/restart-stack', {
                        ...selectedServer,
                        stack_name: actualStackName
                    });

                    // Re-fetch status to ensure everything is OK
                    await fetchStatus();
                    showToast(`${app.name} reiniciado com sucesso!`);
                } catch (e) {
                    showToast("Erro ao reiniciar: " + (e.response?.data?.detail || e.message), "error");
                } finally {
                    setVerifyingStatus(false);
                }
            }
        });
    };

    const handleUninstallApp = async (appId, appName) => {
        const app = apps.find(a => a.id === appId);
        if (!app) return;

        setConfirmAction({
            title: `DESINSTALAR ${app.name}`,
            message: `ATENÇÃO: Isso irá REMOVER PERMANENTEMENTE todos os containers, volumes e bancos de dados de ${app.name}. Esta ação é irreversível e o sistema voltará ao estado original (Zero Bala). Tem certeza?`,
            type: "danger",
            onConfirm: async () => {
                setConfirmAction(null);
                console.log("Iniciando desinstalação Zero Bala de:", app.id, app.stackName);
                try {
                    setVerifyingMessage(`Desinstalando ${app.name}...`);
                    setVerifyingStatus(true);
                    setIsGlobalLoading(true);

                    const actualStackName = getActualStackName(app.stackName) || app.stackName;
                    await api.post('/uninstall-stack', {
                        ...selectedServer,
                        stack_id: app.id,
                        stack_name: actualStackName
                    });

                    // Poll for completion
                    await pollInstallation(app.id);

                    // Re-fetch status
                    setVerifyingMessage("Sincronizando sistema...");
                    await fetchStatus();
                    showToast(`${app.name} desinstalado com sucesso! (Zero Bala)`);
                } catch (e) {
                    showToast("Erro ao desinstalar: " + (e.response?.data?.detail || e.message), "error");
                } finally {
                    setVerifyingStatus(false);
                    setIsGlobalLoading(false);
                }
            }
        });
    };

    const handleUpdateCredentials = async (stackName, newCreds) => {
        try {
            setVerifyingMessage(`Atualizando credenciais de ${stackName}...`);
            setVerifyingStatus(true);

            await api.post('/update-stack-credentials', {
                host: selectedServer.host,
                stack_name: stackName,
                admin_email: newCreds.user,
                admin_password: newCreds.password
            });

            // Re-fetch status to update UI
            await fetchStatus();
            
            showToast(`Acesso de ${stackName} atualizado com sucesso!`);
        } catch (e) {
            showToast("Erro ao atualizar credenciais", "error");
        } finally {
            setVerifyingStatus(false);
        }
    };

    const handleUpdateDomain = async (stackName, oldDomain, newDomain) => {
        try {
            setVerifyingMessage(`Atualizando domínio de ${stackName}...`);
            setVerifyingStatus(true);

            await api.post('/update-stack-domain', {
                host: selectedServer.host,
                username: selectedServer.username,
                password: selectedServer.password,
                stack_name: stackName,
                old_domain: oldDomain,
                new_domain: newDomain
            });

            // Re-fetch status to update UI
            await fetchStatus();
            
            showToast(`Domínio de ${stackName} atualizado com sucesso!`);
        } catch (e) {
            showToast("Erro ao atualizar domínio: " + (e.response?.data?.detail || e.message), "error");
            throw e;
        } finally {
            setVerifyingStatus(false);
        }
    };

    const handleMarkExternal = async (stackName, url, email, password, version) => {
        try {
            setVerifyingMessage("Salvando vínculo externo...");
            setVerifyingStatus(true);
            await api.post('/mark-external-stack', {
                host: selectedServer.host,
                username: selectedServer.username,
                stack_name: stackName,
                url,
                email,
                password,
                version
            });
            await fetchStatus();
            showToast("Aplicação vinculada externamente!");
        } catch (e) {
            showToast("Erro ao vincular aplicação externa: " + (e.response?.data?.detail || e.message), "error");
        } finally {
            setVerifyingStatus(false);
        }
    };



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
                            const hasPostgres = !!getActualStackName('postgres');
                            return (
                                <AppCard
                                    key={app.id}
                                    stack={app}
                                    onInstall={handleInstallApp}
                                    onRestart={handleRestartStack}
                                    onUninstall={handleUninstallApp}
                                    isInstalled={isInstalled}
                                    disabled={!status?.network || (app.id === 'chatwoot' && !hasPostgres)}
                                    disabledMessage={!status?.network ? "Requer Rede Overlay" : "Requer PostgreSQL"}
                                    urls={stackUrls[actualStackName] || []}
                                    credentials={stackCredentials[actualStackName]}
                                    version={stackVersions[actualStackName]}
                                    onUpdateCredentials={handleUpdateCredentials}
                                    onCreateChatwootAdmin={handleCreateChatwootAdmin}
                                    getActualStackName={getActualStackName}
                                    onOpenChatAdmin={(stackName) => setChatAdminModal({ stackName })}
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
                            return (
                                <AppCard
                                    key={app.id}
                                    stack={app}
                                    onInstall={handleInstallApp}
                                    onRestart={handleRestartStack}
                                    onUninstall={handleUninstallApp}
                                    isInstalled={isInstalled}
                                    disabled={!status?.network || (app.id === 'zapvoice' && !hasRabbit)}
                                    disabledMessage={!status?.network ? "Requer Rede Overlay" : "Requer RabbitMQ"}
                                    urls={stackUrls[actualStackName] || []}
                                    credentials={stackCredentials[actualStackName]}
                                    version={stackVersions[actualStackName]}
                                    onUpdateCredentials={handleUpdateCredentials}
                                    onCreateChatwootAdmin={handleCreateChatwootAdmin}
                                    getActualStackName={getActualStackName}
                                    onOpenChatAdmin={(stackName) => setChatAdminModal({ stackName })}
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

            <ChatwootAdminModal 
                isOpen={!!chatAdminModal}
                onClose={() => setChatAdminModal(null)}
                onCreate={handleCreateChatwootAdmin}
                stackName={chatAdminModal?.stackName}
            />

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
