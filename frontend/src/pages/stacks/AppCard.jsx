import React, { useState, useEffect } from 'react';
import { HardDrive, Globe, Share2, Zap, X, Terminal, CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';

const AppCard = ({ stack, onInstall, onRestart, onUninstall, isInstalled, disabled, disabledMessage, urls, credentials, onUpdateCredentials, onOpenChatAdmin, onUpdateDomain, onMarkExternal, getActualStackName, version }) => {
    const [installing, setInstalling] = useState(false);
    const [showCredentials, setShowCredentials] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ user: credentials?.user || '', password: credentials?.password || '', version: version || '' });
    const [editingUrlIdx, setEditingUrlIdx] = useState(null);
    const [editUrlValue, setEditUrlValue] = useState('');
    const [updatingDomain, setUpdatingDomain] = useState(false);

    useEffect(() => {
        setEditForm({
            user: credentials?.user || '',
            password: credentials?.password || '',
            version: version || ''
        });
    }, [credentials, version]);

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
                ? 'bg-slate-900/40 border-emerald-500/20 opacity-100'
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
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-emerald-500/50 uppercase font-bold tracking-tighter">Versão</span>
                                <code className="text-[11px] text-emerald-400 font-mono bg-emerald-500/5 px-2 py-1 rounded truncate">
                                    {version || "Não informada"}
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
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-blue-500/50 uppercase font-bold tracking-tighter">Versão da Aplicação</span>
                                    <input 
                                        type="text"
                                        placeholder="ex: 1.0.0 (opcional)"
                                        value={editForm.version || ''}
                                        onChange={(e) => setEditForm({...editForm, version: e.target.value})}
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

            {/* URLs Section (Definir link se vazio) */}
            {isInstalled && !['postgres', 'redis', 'traefik'].includes(stack.id) && (!urls || urls.length === 0) && (
                <div className="mb-4 relative z-10">
                    <div className="flex flex-col gap-2">
                        {editingUrlIdx === 'new' ? (
                            <div className="bg-slate-950/80 border border-blue-500/30 rounded-lg p-2 space-y-2 animate-in fade-in duration-200">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-blue-400/70 uppercase font-black tracking-widest">Definir Link/Domínio</span>
                                    <input 
                                        type="text"
                                        value={editUrlValue}
                                        onChange={(e) => setEditUrlValue(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
                                        placeholder="ex: painel.meudominio.com"
                                        disabled={updatingDomain}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={async () => {
                                            if (!editUrlValue.trim()) return;
                                            setUpdatingDomain(true);
                                            try {
                                                await onUpdateDomain(getActualStackName(stack.stackName), '', editUrlValue.trim());
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
                        ) : (
                            <button
                                onClick={() => {
                                    setEditingUrlIdx('new');
                                    setEditUrlValue('');
                                }}
                                className="flex items-center justify-center gap-2 text-xs transition-colors bg-blue-500/5 hover:bg-blue-500/10 px-3 py-2 rounded-lg border border-dashed border-blue-500/20 hover:border-blue-500/40 text-blue-400 font-bold uppercase tracking-wider w-full"
                             >
                                <Globe size={14} />
                                Definir Link/Domínio
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* URLs Section (Exibir domínios e permitir edição) */}
            {isInstalled && !['postgres', 'redis', 'traefik'].includes(stack.id) && urls && urls.length > 0 && (
                <div className="mb-4 relative z-10">
                    <div className="flex flex-col gap-2">
                        {urls.map((url, idx) => {
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

            {/* Actions Section */}
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

export default AppCard;
