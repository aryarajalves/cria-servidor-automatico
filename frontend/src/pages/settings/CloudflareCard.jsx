import React from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

/** Ícone de wifi inline (Cloudflare / DNS) */
const WifiIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
);

/**
 * Card de configuração do token Cloudflare e domínio padrão de instalação.
 */
const CloudflareCard = ({
    cfToken,
    setCfToken,
    cfZones = [],
    defaultDomain,
    setDefaultDomain,
    isLoadingZones,
    loadingCloudflare,
    handleSaveCloudflare,
    fetchZones,
}) => {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                        <WifiIcon />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Cloudflare API</h3>
                        <p className="text-sm text-slate-400">Token para automação de DNS e certificados SSL.</p>
                    </div>
                </div>
                {cfToken && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={13} /> Token Configurado
                    </span>
                )}
            </div>

            <form onSubmit={handleSaveCloudflare} className="space-y-5">
                {/* Campo editável do Token */}
                <div className="space-y-2">
                    <Input
                        label="API Token Cloudflare"
                        type="password"
                        placeholder="Cole o API Token da Cloudflare..."
                        value={cfToken}
                        onChange={(e) => setCfToken(e.target.value)}
                        description={
                            <span className="text-slate-400 text-xs">
                                Permissões necessárias no token: <code className="text-orange-400">Zone.Zone (Read)</code> e <code className="text-orange-400">Zone.DNS (Edit)</code>.
                            </span>
                        }
                    />
                </div>

                {/* Seletor de domínio padrão */}
                <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">Domínio Padrão para Instalação</label>
                        {cfToken && fetchZones && (
                            <button
                                type="button"
                                onClick={() => fetchZones(cfToken)}
                                disabled={isLoadingZones}
                                className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={12} className={isLoadingZones ? "animate-spin" : ""} />
                                Recarregar Domínios
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <select
                            id="cloudflare-domain-select"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white appearance-none focus:outline-none focus:border-orange-500 disabled:opacity-50 transition-colors"
                            value={defaultDomain?.id || ''}
                            onChange={(e) => {
                                const selected = cfZones.find((z) => z.id === e.target.value);
                                setDefaultDomain({
                                    id: e.target.value,
                                    name: selected
                                        ? selected.name
                                        : e.target.value === defaultDomain?.id
                                        ? defaultDomain.name
                                        : '',
                                });
                            }}
                            disabled={isLoadingZones}
                        >
                            <option value="">
                                {isLoadingZones ? 'Carregando domínios da Cloudflare...' : 'Nenhum (perguntar sempre)'}
                            </option>

                            {/* Opção salva que ainda não está na lista de zonas */}
                            {defaultDomain?.id && !cfZones.find((z) => z.id === defaultDomain.id) && (
                                <option key={defaultDomain.id} value={defaultDomain.id}>
                                    {defaultDomain.name || defaultDomain.id} (Salvo)
                                </option>
                            )}

                            {cfZones.map((z) => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>

                        {isLoadingZones && (
                            <div className="absolute right-4 top-3">
                                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Mensagens de ajuda */}
                    {!cfToken && (
                        <p className="text-xs text-amber-400 italic">
                            Insira o Token acima e clique em "Salvar Configurações" para listar seus domínios.
                        </p>
                    )}
                    {cfToken && cfZones.length === 0 && !isLoadingZones && (
                        <p className="text-xs text-slate-400">
                            Nenhum domínio carregado ainda. Salve ou clique em "Recarregar Domínios" para sincronizar com sua conta Cloudflare.
                        </p>
                    )}
                </div>

                <div className="pt-2">
                    <Button type="submit" variant="primary" isLoading={loadingCloudflare}>
                        Salvar Configurações
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CloudflareCard;
