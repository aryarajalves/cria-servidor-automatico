import React from 'react';
import { Network, ShieldAlert, Check, RefreshCw, Hash } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import SshPortProgressModal from './SshPortProgressModal';

/**
 * Card para alterar a porta SSH do servidor.
 * Oferece dois modos:
 *  - Alterar na VPS via SSH (reconfigura sshd_config, UFW e reinicia o serviço)
 *  - Salvar apenas localmente (atualiza só o registro do sistema)
 */
const SshPortCard = ({
    selectedServer,
    newSshPort,
    setNewSshPort,
    loadingPort,
    handleChangeSshPort,
    handleUpdatePortLocally,
}) => {
    const currentPort = selectedServer?.port || 22;
    const suggestions = [22, 2222, 22022, 5022];

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
            {/* Modal de Bloqueio e Progresso durante a troca de porta na VPS */}
            <SshPortProgressModal
                isOpen={loadingPort}
                currentPort={currentPort}
                newPort={newSshPort}
                host={selectedServer?.host}
            />
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/10">
                        <Network size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Porta SSH do Servidor</h3>
                        <p className="text-sm text-slate-400">
                            Porta de conexão SSH para o host <span className="font-mono text-slate-200 font-semibold">{selectedServer?.host}</span>.
                        </p>
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 self-start sm:self-auto">
                    <span className="text-[11px] text-slate-400 font-medium">Porta Ativa:</span>
                    <span className="font-mono text-sm font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        {currentPort}
                    </span>
                </div>
            </div>

            <form onSubmit={handleChangeSshPort} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="space-y-2">
                        <Input
                            label="Nova Porta SSH"
                            name="newSshPort"
                            type="number"
                            min="1"
                            max="65535"
                            placeholder="Ex: 2222 ou 22022"
                            value={newSshPort}
                            onChange={(e) => setNewSshPort(e.target.value)}
                            required
                        />

                        {/* Sugestões rápidas */}
                        <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-slate-500 font-medium mr-1">Sugestões:</span>
                            {suggestions.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setNewSshPort(p)}
                                    className={`px-2 py-0.5 text-xs font-mono rounded-md border transition-all cursor-pointer ${
                                        Number(newSshPort) === p
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                                    }`}
                                >
                                    {p === 22 ? '22 (Padrão)' : p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex gap-3 text-xs text-amber-300/90">
                        <ShieldAlert size={18} className="shrink-0 text-amber-400 mt-0.5" />
                        <p className="leading-relaxed">
                            Ao alterar na VPS, o AutoServer libera a nova porta no firewall (UFW), reconfigura o <span className="font-mono text-white">sshd_config</span>, reinicia o serviço e valida a conexão antes de salvar.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 pt-2">
                    <Button
                        type="submit"
                        isLoading={loadingPort}
                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 font-bold"
                    >
                        Alterar Porta na VPS (SSH)
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        isLoading={loadingPort}
                        className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-300 font-medium"
                        onClick={handleUpdatePortLocally}
                    >
                        Salvar Apenas no Sistema
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default SshPortCard;
