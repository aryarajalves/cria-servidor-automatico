import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, RefreshCw, AlertTriangle, Lock } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import SshSecurityProgressModal from './SshSecurityProgressModal';

/**
 * Card de Segurança do SSH: Permite desativar ou reativar o login por senha na VPS remota.
 */
const SshSecurityCard = ({
    selectedServer,
    passwordAuthEnabled = true,
    loadingPasswordAuth = false,
    handleTogglePasswordAuth,
    fetchPasswordAuthStatus,
}) => {
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null); // 'disable' | 'enable'

    const handleOpenConfirm = (action) => {
        setPendingAction(action);
        setShowConfirmModal(true);
    };

    const handleConfirm = async () => {
        setShowConfirmModal(false);
        if (pendingAction === 'disable') {
            await handleTogglePasswordAuth(false);
        } else if (pendingAction === 'enable') {
            await handleTogglePasswordAuth(true);
        }
        setPendingAction(null);
    };

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
            {/* Modal de Bloqueio e Progresso durante a alteração de segurança SSH */}
            <SshSecurityProgressModal
                isOpen={loadingPasswordAuth}
                isDisabling={passwordAuthEnabled}
                host={selectedServer?.host}
            />
            {/* Glow decorativo de fundo */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16 transition-colors duration-500 ${
                passwordAuthEnabled ? 'bg-amber-500/5' : 'bg-emerald-500/10'
            }`} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl transition-colors duration-300 ${
                        passwordAuthEnabled
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                        {passwordAuthEnabled ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            Autenticação por Senha (SSH Hardening)
                        </h3>
                        <p className="text-sm text-slate-400">
                            Controle se a VPS aceita senhas ou exclusivamente Chaves SSH Privadas.
                        </p>
                    </div>
                </div>

                {/* Badge de Status */}
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        passwordAuthEnabled
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    }`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                            passwordAuthEnabled ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        {passwordAuthEnabled ? 'Senha Habilitada' : 'Apenas Chaves SSH (Seguro)'}
                    </span>

                    {fetchPasswordAuthStatus && (
                        <button
                            type="button"
                            onClick={() => fetchPasswordAuthStatus(true)}
                            disabled={loadingPasswordAuth}
                            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                            title="Sincronizar e verificar status na VPS"
                        >
                            <RefreshCw size={14} className={loadingPasswordAuth ? "animate-spin text-blue-400" : ""} />
                        </button>
                    )}
                </div>
            </div>

            {/* Painel Informativo */}
            <div className="space-y-4 relative z-10">
                <div className={`p-4 rounded-xl border transition-colors ${
                    passwordAuthEnabled
                        ? 'bg-slate-950/60 border-slate-800'
                        : 'bg-emerald-950/20 border-emerald-500/20'
                }`}>
                    <div className="flex items-start gap-3">
                        <KeyRound size={18} className={`shrink-0 mt-0.5 ${
                            passwordAuthEnabled ? 'text-slate-400' : 'text-emerald-400'
                        }`} />
                        <div className="text-xs space-y-1.5 text-slate-300 leading-relaxed">
                            {passwordAuthEnabled ? (
                                <p>
                                    <strong className="text-amber-400">Atenção:</strong> O servidor atualmente permite login tanto por senha root quanto por chave SSH. Desativar a autenticação por senha bloqueia ataques automatizados de força-bruta.
                                </p>
                            ) : (
                                <p>
                                    <strong className="text-emerald-400">Proteção Ativa:</strong> A autenticação por senha está desativada na VPS (<code className="text-emerald-300">PasswordAuthentication no</code>). Apenas conexões com Chaves SSH autorizadas são aceitas.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                    {passwordAuthEnabled ? (
                        <Button
                            type="button"
                            variant="danger"
                            onClick={() => handleOpenConfirm('disable')}
                            isLoading={loadingPasswordAuth}
                            className="bg-red-600/90 hover:bg-red-600 text-white font-bold"
                        >
                            <Lock size={16} className="mr-1.5" />
                            Desativar Acesso por Senha na VPS
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => handleOpenConfirm('enable')}
                            isLoading={loadingPasswordAuth}
                        >
                            <KeyRound size={16} className="mr-1.5" />
                            Reativar Acesso por Senha
                        </Button>
                    )}
                </div>
            </div>

            {/* Modal de Confirmação Obrigatório */}
            <ConfirmDialog
                isOpen={showConfirmModal}
                type={pendingAction === 'disable' ? 'danger' : 'info'}
                title={pendingAction === 'disable' ? 'Desativar Senha no Servidor?' : 'Reativar Senha no Servidor?'}
                message={
                    pendingAction === 'disable'
                        ? 'Ao desativar a senha, o acesso à VPS só será possível utilizando Chaves SSH Privadas autorizadas. Certifique-se de possuir uma chave SSH funcional configurada.'
                        : 'A VPS voltará a aceitar conexões SSH utilizando a senha root configurada no sistema.'
                }
                confirmText={pendingAction === 'disable' ? 'Sim, Desativar Senha' : 'Sim, Reativar Senha'}
                cancelText="Cancelar"
                onConfirm={handleConfirm}
                onCancel={() => setShowConfirmModal(false)}
            />
        </div>
    );
};

export default SshSecurityCard;
