import React from 'react';
import { Lock } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

/**
 * Card para trocar a senha SSH do servidor.
 * Oferece dois modos:
 *  - Alterar na VPS via SSH (muda a senha real no servidor)
 *  - Salvar apenas localmente (atualiza só o registro do sistema)
 */
const SshPasswordCard = ({
    selectedServer,
    formData,
    handleChange,
    loadingSSH,
    handleUpdateSSH,
    handleUpdatePasswordLocally,
}) => {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm lg:col-span-2">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-600/10 rounded-xl text-blue-500">
                    <Lock size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold">Trocar Senha SSH</h3>
                    <p className="text-sm text-slate-500">
                        Altera a senha do usuário <span className="font-mono text-slate-300">{selectedServer?.username}</span>.
                    </p>
                </div>
            </div>

            <form onSubmit={handleUpdateSSH} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <Input
                    label="Nova Senha"
                    name="newPassword"
                    type="password"
                    placeholder="Nova senha..."
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                />
                <Input
                    label="Confirmar"
                    name="confirmPassword"
                    type="password"
                    placeholder="Repita a senha..."
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                />
                <div className="flex flex-col md:flex-row gap-3 md:col-span-3 mt-2">
                    <Button
                        type="submit"
                        variant="destructive"
                        isLoading={loadingSSH}
                        className="flex-1"
                    >
                        Alterar Senha na VPS (SSH)
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        isLoading={loadingSSH}
                        className="flex-1"
                        onClick={handleUpdatePasswordLocally}
                    >
                        Salvar Apenas no Sistema
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default SshPasswordCard;
