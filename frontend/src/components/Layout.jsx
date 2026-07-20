import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Layers, Settings, Globe, LogOut, AlertTriangle, X, ChevronDown, Plus, Trash2, Network, Terminal, ScrollText } from 'lucide-react';
import { useServer } from '../context/ServerContext';

const Layout = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { appUser, logoutApp, servers, selectedServer, selectServer, deleteServerFromList, isGlobalLoading, isInitializing } = useServer();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showServerDropdown, setShowServerDropdown] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [serverToDelete, setServerToDelete] = useState(null);

    const navSections = [
        {
            title: "Visão Geral",
            items: [
                { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
            ]
        },
        {
            title: "Gerenciamento",
            items: [
                { path: '/stacks', icon: Layers, label: 'Stacks / Apps' },
                { path: '/cluster', icon: Network, label: 'Cluster Swarm' },
            ]
        },
        {
            title: "Configurações",
            items: [
                { path: '/dns', icon: Globe, label: 'Cloudflare DNS' },
                { path: '/logs', icon: ScrollText, label: 'Visualizador de Logs' },
                { path: '/settings', icon: Settings, label: 'Configurações' },
            ]
        }
    ];

    const handleLogoutClick = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        setShowLogoutConfirm(false);
        logoutApp();
        navigate('/login');
    };

    const handleAddServer = () => {
        setShowServerDropdown(false);
        navigate('/connect', { state: { forceAdd: true } });
    };

    const handleDeleteClick = (e, server) => {
        e.stopPropagation();
        setShowServerDropdown(false);
        setServerToDelete(server);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (serverToDelete) {
            deleteServerFromList(serverToDelete.id);
            setShowDeleteConfirm(false);
            setServerToDelete(null);
        }
    };

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden">
            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300 cursor-default"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    />
                    <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 via-red-500 to-red-500/50" />
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                                        <AlertTriangle size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Confirmar Saída</h3>
                                </div>
                            </div>
                            <p className="text-slate-300 mb-8 leading-relaxed">
                                Você tem certeza que deseja sair do sistema? Suas credenciais atuais serão removidas desta sessão.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmLogout}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <LogOut size={18} />
                                    Sair Agora
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Server Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                    <div
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300 cursor-default"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    />
                    <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 via-red-500 to-red-500/50" />
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                                        <Trash2 size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Remover Servidor</h3>
                                </div>
                            </div>
                            <p className="text-slate-300 mb-2 leading-relaxed">
                                Tem certeza que deseja remover o servidor <span className="text-white font-bold">{serverToDelete?.name}</span>?
                            </p>
                            <p className="text-slate-500 text-sm mb-8">
                                Esta ação apenas removerá o servidor da nossa lista. Os arquivos e containers na VPS não serão afetados.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    Remover Agora
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <aside className={`w-72 bg-slate-900 border-r border-white/5 flex flex-col z-40 relative transition-transform duration-500 ${isGlobalLoading ? '-translate-x-full absolute' : 'translate-x-0'}`}>
                {/* Brand & Server Switcher */}
                <div className="p-6 border-b border-white/5">
                    <h1 className="text-xl font-black bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent mb-6 tracking-tight">
                        AUTO SERVER
                    </h1>

                    <div className="relative">
                        <button
                            onClick={() => setShowServerDropdown(!showServerDropdown)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                                showServerDropdown 
                                ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-600/20' 
                                : 'bg-slate-800/50 border-white/5 hover:border-white/10'
                            }`}
                        >
                            <div className={`p-2 rounded-lg ${showServerDropdown ? 'bg-white/20' : 'bg-blue-600/20 text-blue-400'}`}>
                                <Server size={18} />
                            </div>
                            <div className="flex-1 text-left overflow-hidden">
                                <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${showServerDropdown ? 'text-white/70' : 'text-slate-500'}`}>Servidor Ativo</p>
                                <p className="text-sm font-bold truncate">
                                    {isInitializing ? 'Carregando...' : (selectedServer ? selectedServer.name : 'Nenhum')}
                                </p>
                            </div>
                            <ChevronDown size={18} className={`transition-transform duration-300 ${showServerDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showServerDropdown && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowServerDropdown(false)} />
                                <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-2 z-20 animate-in slide-in-from-top-2 duration-200">
                                    {servers.length > 0 ? (
                                        <div className="max-h-60 overflow-y-auto px-2 space-y-1">
                                            {servers.map((server) => (
                                                <div key={server.id} className="group flex items-center">
                                                    <button
                                                        onClick={() => {
                                                            selectServer(server);
                                                            setShowServerDropdown(false);
                                                        }}
                                                        className={`flex-1 flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                                                            selectedServer?.id === server.id 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'hover:bg-white/5 text-slate-300'
                                                        }`}
                                                    >
                                                        <div className={`w-2 h-2 rounded-full ${selectedServer?.id === server.id ? 'bg-white' : 'bg-slate-600'}`} />
                                                        <span className="text-sm font-medium truncate">{server.name}</span>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => handleDeleteClick(e, server)}
                                                        className="p-2 text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-3 text-sm text-slate-500 italic">Nenhum servidor cadastrado</div>
                                    )}
                                    <div className="mx-2 mt-2 pt-2 border-t border-white/5">
                                        <button
                                            onClick={handleAddServer}
                                            className="w-full flex items-center gap-3 p-2.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-all font-bold text-sm"
                                        >
                                            <Plus size={18} />
                                            Adicionar Servidor
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Navigation - Only if server is selected */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {isInitializing ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-4 animate-pulse">
                            <div className="w-10 h-10 bg-slate-800 rounded-full"></div>
                            <div className="w-24 h-2 bg-slate-800 rounded"></div>
                        </div>
                    ) : selectedServer ? (
                        <div className="space-y-6">
                            {navSections.map((section) => (
                                <div key={section.title} className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 select-none">
                                        {section.title}
                                    </p>
                                    <div className="space-y-1">
                                        {section.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = location.pathname === item.path;

                                            return (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group ${isActive
                                                        ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-[0_0_15px_-3px_rgba(37,99,235,0.2)]'
                                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent hover:border-slate-700/50'
                                                        }`}
                                                >
                                                    <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-blue-600/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                                                        <Icon size={18} />
                                                    </div>
                                                    <span className="font-medium text-sm tracking-wide">{item.label}</span>
                                                    {isActive && <div className="ml-auto w-1 h-4 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 px-6 text-center space-y-4">
                            <div className="p-4 bg-slate-800/50 rounded-full text-slate-600">
                                <AlertTriangle size={32} />
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Nenhum servidor ativo. Conecte-se a uma VPS para liberar as ferramentas.</p>
                        </div>
                    )}
                </nav>

                {/* Footer User Info */}
                <div className="p-4 border-t border-white/5 bg-slate-900/50 backdrop-blur-sm">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-white/5 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-slate-400 font-bold border border-white/5 uppercase">
                            {appUser.email.charAt(0)}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Administrador</p>
                            <p className="text-sm font-bold text-white truncate">{appUser.email}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogoutClick}
                        className="flex items-center gap-3 w-full px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 group border border-transparent hover:border-red-500/20"
                    >
                        <LogOut size={18} className="group-hover:rotate-12 transition-transform" />
                        <span className="font-bold text-sm tracking-wide">Sair do Sistema</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 overflow-auto bg-slate-950 p-8 scrollbar-hide transition-all duration-500 ${isGlobalLoading ? 'ml-0' : ''}`}>
                <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
