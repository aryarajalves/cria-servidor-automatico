import React, { useState, useEffect } from 'react';
import { Key, Plus, Sparkles, Shield, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import api from '../services/api';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import CreateSshKeyModal from './ssh_keys/CreateSshKeyModal';
import ViewPrivateKeyModal from './ssh_keys/ViewPrivateKeyModal';
import SshKeyCard from './ssh_keys/SshKeyCard';

const ITEMS_PER_PAGE = 20;

const SshKeys = () => {
    const [keys, setKeys] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [toast, setToast] = useState(null);

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewingKey, setViewingKey] = useState(null);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchKeys();
    }, []);

    // Reseta para a primeira página ao alterar a busca
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const fetchKeys = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/ssh-keys');
            setKeys(response.data || []);
        } catch (error) {
            console.error('Erro ao carregar chaves SSH:', error);
            showToast('Falha ao carregar chaves SSH.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    const handleCreateSuccess = (newKey) => {
        fetchKeys();
        showToast(`Chave SSH "${newKey.name}" salva com sucesso!`, 'success');
    };

    const handleViewPrivate = async (keyItem) => {
        try {
            const response = await api.get(`/ssh-keys/${keyItem.id}`);
            setViewingKey(response.data);
        } catch (error) {
            console.error('Erro ao buscar detalhes da chave:', error);
            showToast('Erro ao obter detalhes da chave privada.', 'error');
        }
    };

    const handleDeleteClick = (keyItem) => {
        setKeyToDelete(keyItem);
    };

    const confirmDelete = async () => {
        if (!keyToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/ssh-keys/${keyToDelete.id}`);
            setKeys(prev => prev.filter(k => k.id !== keyToDelete.id));
            showToast('Chave SSH removida com sucesso!', 'success');
            setKeyToDelete(null);
        } catch (error) {
            console.error('Erro ao excluir chave SSH:', error);
            showToast(error.response?.data?.detail || 'Erro ao remover chave SSH.', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredKeys = keys.filter(k => 
        k.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.key_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.public_key?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Paginação
    const totalPages = Math.ceil(filteredKeys.length / ITEMS_PER_PAGE) || 1;
    const paginatedKeys = filteredKeys.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Modals */}
            <CreateSshKeyModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={handleCreateSuccess}
            />

            <ViewPrivateKeyModal
                isOpen={!!viewingKey}
                keyData={viewingKey}
                onClose={() => setViewingKey(null)}
            />

            <ConfirmDialog
                isOpen={!!keyToDelete}
                title="Excluir Chave SSH"
                message={`Tem certeza que deseja remover a chave "${keyToDelete?.name}"? Servidores associados a ela poderão perder a autenticação se não tiverem outra forma de acesso configurada.`}
                onConfirm={confirmDelete}
                onCancel={() => setKeyToDelete(null)}
                confirmText={isDeleting ? 'Excluindo...' : 'Remover Chave'}
                cancelText="Cancelar"
                type="danger"
            />

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 md:p-8 rounded-[32px] border border-white/5 backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                
                <div className="space-y-2 relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-600/10">
                            <Key size={24} />
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tight">Chaves SSH</h2>
                    </div>
                    <p className="text-slate-400 text-sm max-w-xl">
                        Gerencie suas chaves privadas para autenticação criptográfica segura nas instâncias VPS, sem necessidade de senhas.
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button
                        onClick={fetchKeys}
                        title="Recarregar chaves"
                        className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/5 transition-all cursor-pointer"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>

                    <Button
                        variant="primary"
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2 text-sm cursor-pointer"
                    >
                        <Plus size={18} />
                        Adicionar Chave SSH
                    </Button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            {keys.length > 0 && (
                <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome, tipo (RSA, Ed25519) ou chave..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                        {filteredKeys.length} de {keys.length} chave(s)
                    </span>
                </div>
            )}

            {/* Keys Grid / Content */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="h-48 rounded-2xl bg-slate-900/40 border border-white/5 animate-pulse p-6 space-y-4">
                            <div className="w-1/2 h-5 bg-slate-800 rounded-lg"></div>
                            <div className="w-3/4 h-3 bg-slate-800/60 rounded"></div>
                            <div className="w-full h-12 bg-slate-800/40 rounded-xl"></div>
                        </div>
                    ))}
                </div>
            ) : keys.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/30 rounded-[32px] border border-white/5 backdrop-blur-sm space-y-6">
                    <div className="w-20 h-20 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <Key size={36} />
                    </div>
                    <div className="max-w-md space-y-2">
                        <h3 className="text-xl font-bold text-white">Nenhuma Chave SSH Cadastrada</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            Cadastre suas chaves privadas existentes ou gere novos pares de chaves criptográficas para conectar facilmente aos seus servidores VPS.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button
                            variant="primary"
                            onClick={() => setShowCreateModal(true)}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold shadow-lg shadow-blue-600/20 flex items-center gap-2 text-sm"
                        >
                            <Plus size={18} />
                            Cadastrar ou Gerar Chave
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedKeys.map((keyItem) => (
                            <SshKeyCard
                                key={keyItem.id}
                                keyItem={keyItem}
                                onViewPrivate={handleViewPrivate}
                                onDelete={handleDeleteClick}
                                onCopyPublic={() => showToast('Chave pública copiada! Cole no ~/.ssh/authorized_keys da sua VPS', 'success')}
                            />
                        ))}
                    </div>

                    {/* Paginação */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredKeys.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setCurrentPage}
                        itemName="chave"
                    />
                </div>
            )}
        </div>
    );
};

export default SshKeys;
