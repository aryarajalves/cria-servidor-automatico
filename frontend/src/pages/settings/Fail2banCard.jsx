import React, { useState } from 'react';
import {
    ShieldCheck,
    ShieldAlert,
    ShieldOff,
    Ban,
    Clock,
    RefreshCw,
    Unlock,
    Sliders,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Fail2banProgressModal from './Fail2banProgressModal';

/**
 * Card de Proteção Ativa Fail2ban: Permite configurar o limite de requisições por janela de tempo,
 * duração do banimento e desbanir IPs bloqueados diretamente pela interface.
 */
const Fail2banCard = ({
    selectedServer,
    fail2banStatus = { installed: false, active: false, maxretry: 5, findtime: 600, bantime: 3600, banned_ips: [] },
    loadingFail2ban = false,
    loadingStatus = false,
    handleSaveFail2ban,
    handleUnbanIp,
    handleToggleFail2ban,
    fetchFail2banStatus,
}) => {
    const [maxretry, setMaxretry] = useState(fail2banStatus?.maxretry || 5);
    const [findtime, setFindtime] = useState(fail2banStatus?.findtime || 600);
    const [bantime, setBantime] = useState(fail2banStatus?.bantime || 3600);

    const [ipToUnban, setIpToUnban] = useState(null);
    const [showUnbanModal, setShowUnbanModal] = useState(false);

    // Sincroniza estados caso as props mudem
    React.useEffect(() => {
        if (fail2banStatus?.maxretry) setMaxretry(fail2banStatus.maxretry);
        if (fail2banStatus?.findtime) setFindtime(fail2banStatus.findtime);
        if (fail2banStatus?.bantime) setBantime(fail2banStatus.bantime);
    }, [fail2banStatus?.maxretry, fail2banStatus?.findtime, fail2banStatus?.bantime]);

    const isInstalled = fail2banStatus?.installed;
    const isActive = fail2banStatus?.active;
    const bannedIps = fail2banStatus?.banned_ips || [];

    const handleOpenUnban = (ipObj) => {
        setIpToUnban(ipObj);
        setShowUnbanModal(true);
    };

    const handleConfirmUnban = async () => {
        if (ipToUnban) {
            await handleUnbanIp(ipToUnban.ip, ipToUnban.jail);
            setIpToUnban(null);
        }
        setShowUnbanModal(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await handleSaveFail2ban({
            maxretry: Number(maxretry),
            findtime: Number(findtime),
            bantime: Number(bantime),
        });
    };

    const bantimeFormatted = Number(bantime) >= 86400 ? `${Number(bantime) / 86400} dia(s)` : `${Number(bantime) / 3600} hora(s)`;

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm relative overflow-hidden">
            {/* Modal de Bloqueio e Progresso durante a instalação e configuração do Fail2ban */}
            <Fail2banProgressModal
                isOpen={loadingFail2ban}
                isInstalled={isInstalled}
                host={selectedServer?.host}
                maxretry={maxretry}
                findtimeMinutes={Number(findtime) / 60}
                bantimeDisplay={bantimeFormatted}
            />
            {/* Glow decorativo de fundo */}
            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16 transition-colors duration-500 ${
                isActive ? 'bg-emerald-500/10' : isInstalled ? 'bg-amber-500/10' : 'bg-blue-500/5'
            }`} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl transition-colors duration-300 ${
                        isActive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : isInstalled
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                    }`}>
                        {isActive ? <ShieldCheck size={24} /> : isInstalled ? <ShieldAlert size={24} /> : <ShieldOff size={24} />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            Proteção Ativa contra Invasões (Fail2ban)
                        </h3>
                        <p className="text-sm text-slate-400">
                            Bloqueio automático de IPs maliciosos por excesso de tentativas e força-bruta.
                        </p>
                    </div>
                </div>

                {/* Badges de Status e Sincronização */}
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : isInstalled
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${
                            isActive ? 'bg-emerald-400 animate-pulse' : isInstalled ? 'bg-amber-400' : 'bg-slate-500'
                        }`} />
                        {isActive ? 'Proteção Ativa' : isInstalled ? 'Serviço Pausado' : 'Não Configurado'}
                    </span>

                    {fetchFail2banStatus && (
                        <button
                            type="button"
                            onClick={() => fetchFail2banStatus(true)}
                            disabled={loadingStatus}
                            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                            title="Sincronizar status na VPS"
                        >
                            <RefreshCw size={14} className={loadingStatus ? 'animate-spin text-blue-400' : ''} />
                        </button>
                    )}
                </div>
            </div>

            {/* Formulário de Configurações */}
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Max Retry */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Sliders size={14} className="text-blue-400" />
                            Tentativas Máximas:
                        </label>
                        <Input
                            type="number"
                            min="1"
                            max="50"
                            value={maxretry}
                            onChange={(e) => setMaxretry(e.target.value)}
                            placeholder="5"
                            className="bg-slate-900 border-slate-700 text-white font-mono text-sm"
                            required
                        />
                        <div className="flex gap-1.5 pt-1">
                            {[3, 5, 10].map((v) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setMaxretry(v)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                        Number(maxretry) === v
                                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    {v} erros
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Find Time (Janela) */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Clock size={14} className="text-amber-400" />
                            Janela de Tempo:
                        </label>
                        <select
                            value={findtime}
                            onChange={(e) => setFindtime(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value={300}>5 minutos (300s)</option>
                            <option value={600}>10 minutos (Recomendado)</option>
                            <option value={900}>15 minutos (900s)</option>
                            <option value={1800}>30 minutos (1800s)</option>
                            <option value={3600}>1 hora (3600s)</option>
                        </select>
                        <p className="text-[10px] text-slate-500">
                            Período em que as {maxretry} falhas são contabilizadas.
                        </p>
                    </div>

                    {/* Ban Time */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <Ban size={14} className="text-rose-400" />
                            Duração do Banimento:
                        </label>
                        <select
                            value={bantime}
                            onChange={(e) => setBantime(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                            <option value={1800}>30 minutos</option>
                            <option value={3600}>1 hora (Padrão)</option>
                            <option value={86400}>24 horas (Recomendado)</option>
                            <option value={604800}>7 dias</option>
                            <option value={2592000}>30 dias</option>
                        </select>
                        <p className="text-[10px] text-slate-500">
                            Tempo que o IP do invasor ficará bloqueado no firewall.
                        </p>
                    </div>
                </div>

                {/* Informação contextual */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                        <strong>Regra Ativa:</strong> Se um mesmo IP falhar <strong>{maxretry} vezes</strong> dentro de <strong>{findtime / 60} minutos</strong>, o Fail2ban bloqueará o IP no Firewall Linux por <strong>{bantime >= 86400 ? `${bantime / 86400} dia(s)` : `${bantime / 3600} hora(s)`}</strong>.
                    </span>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={loadingFail2ban}
                        className="font-bold"
                    >
                        <Sliders size={16} className="mr-1.5" />
                        {isInstalled ? 'Salvar e Aplicar Regras' : 'Instalar e Ativar Fail2ban'}
                    </Button>

                    {isInstalled && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleToggleFail2ban(!isActive)}
                            isLoading={loadingFail2ban}
                            className="text-xs"
                        >
                            {isActive ? 'Pausar Proteção' : 'Ativar Proteção'}
                        </Button>
                    )}
                </div>
            </form>

            {/* Seção de IPs Bloqueados */}
            {isInstalled && (
                <div className="mt-8 pt-6 border-t border-slate-800/80 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <Ban size={16} className="text-rose-400" />
                            IPs Atualmente Bloqueados ({bannedIps.length})
                        </h4>
                    </div>

                    {bannedIps.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-center text-xs text-slate-400">
                            Nenhum IP bloqueado no momento. Sua VPS está segura e sem invasores ativos.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                            {bannedIps.map((item, idx) => (
                                <div key={idx} className="p-3 px-4 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <span className="font-mono font-bold text-rose-400">{item.ip}</span>
                                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                                            Jail: {item.jail}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenUnban(item)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-950/50 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/30 transition-colors"
                                    >
                                        <Unlock size={12} />
                                        Desbanir IP
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Desbanimento */}
            <ConfirmDialog
                isOpen={showUnbanModal}
                type="info"
                title="Desbanir Endereço IP?"
                message={`Deseja desbloquear o IP ${ipToUnban?.ip} na VPS? Ele voltará a ter acesso liberado.`}
                confirmText="Sim, Desbanir IP"
                cancelText="Cancelar"
                onConfirm={handleConfirmUnban}
                onCancel={() => setShowUnbanModal(false)}
            />
        </div>
    );
};

export default Fail2banCard;
