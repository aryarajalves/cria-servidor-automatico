import React from 'react';
import { ShieldCheck } from 'lucide-react';
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
    isCfTokenFromEnv,
    cfZones,
    defaultDomain,
    setDefaultDomain,
    isLoadingZones,
    loadingCloudflare,
    handleSaveCloudflare,
}) => {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                    <WifiIcon />
                </div>
                <div>
                    <h3 className="text-lg font-bold">Cloudflare API</h3>
                    <p className="text-sm text-slate-500">Token para automação de DNS.</p>
                </div>
            </div>

            <form onSubmit={handleSaveCloudflare} className="space-y-4">
                {/* Token via .env ou campo editável */}
                {isCfTokenFromEnv ? (
                    <div className="flex items-center gap-2 mb-4 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg">
                        <ShieldCheck size={16} className="text-emerald-500" />
                        <span className="text-xs text-emerald-500 font-bold">Token carregado via arquivo .env</span>
                    </div>
                ) : (
                    <Input
                        label="API Token"
                        type="password"
                        placeholder="Ex: H-29..."
                        value={cfToken}
                        onChange={(e) => setCfToken(e.target.value)}
                        description={
                            <span className="text-amber-500 text-[10px]">
                                Recomendado: Configure no arquivo .env para maior segurança.
                            </span>
                        }
                    />
                )}

                {/* Seletor de domínio padrão */}
                <div className="space-y-2 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-sm font-medium text-slate-400">Domínio Padrão para Instalação</label>
                    <div className="relative">
                        <select
                            id="cloudflare-domain-select"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white appearance-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            value={defaultDomain.id}
                            onChange={(e) => {
                                const selected = cfZones.find((z) => z.id === e.target.value);
                                setDefaultDomain({
                                    id: e.target.value,
                                    name: selected
                                        ? selected.name
                                        : e.target.value === defaultDomain.id
                                        ? defaultDomain.name
                                        : '',
                                });
                            }}
                            disabled={isLoadingZones}
                        >
                            <option value="">
                                {isLoadingZones ? 'Carregando domínios...' : 'Nenhum (perguntar sempre)'}
                            </option>

                            {/* Opção salva que ainda não está na lista de zonas */}
                            {defaultDomain.id && !cfZones.find((z) => z.id === defaultDomain.id) && (
                                <option key={defaultDomain.id} value={defaultDomain.id}>
                                    {defaultDomain.name} (Salvo)
                                </option>
                            )}

                            {cfZones.map((z) => (
                                <option key={z.id} value={z.id}>{z.name}</option>
                            ))}
                        </select>

                        {isLoadingZones && (
                            <div className="absolute right-10 top-3">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Mensagens de ajuda */}
                    {!cfToken && !isCfTokenFromEnv && (
                        <p className="text-[10px] text-amber-500 italic">
                            Insira o Token acima para carregar a lista de domínios.
                        </p>
                    )}
                    {(cfToken || isCfTokenFromEnv) && cfZones.length === 0 && !isLoadingZones && (
                        <p className="text-[10px] text-red-400 italic">
                            Nenhum domínio encontrado. Verifique se o Token tem permissões de
                            "Zone - DNS - Edit" e "Zone - Zone - Read".
                        </p>
                    )}
                </div>

                <Button type="submit" variant="primary" isLoading={loadingCloudflare}>
                    Salvar Configurações
                </Button>
            </form>
        </div>
    );
};

export default CloudflareCard;
