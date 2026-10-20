import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe, Search, Check, Filter } from 'lucide-react';

const DnsRecordSelect = ({
    value = '',
    onChange,
    placeholder = 'ex: app.meudominio.com',
    required = false,
    serverHost = '',
    zones = [],
    records = {},
    loadingRecords = false,
    selectedZoneId = '',
    onSelectZone,
    onFetchRecords
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [filterByServerIp, setFilterByServerIp] = useState(true);
    const dropdownRef = useRef(null);

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const currentZoneId = selectedZoneId || (zones[0]?.id || '');
    const currentZoneRecords = records[currentZoneId] || [];

    useEffect(() => {
        if (isOpen && currentZoneId && !records[currentZoneId] && onFetchRecords) {
            onFetchRecords(currentZoneId);
        }
    }, [isOpen, currentZoneId, records, onFetchRecords]);

    // Filtra registros A e CNAME
    const dnsRecords = currentZoneRecords.filter(r => r.type === 'A' || r.type === 'CNAME');

    // Filtra pelo IP do servidor se ativado
    const serverFiltered = filterByServerIp && serverHost
        ? dnsRecords.filter(r => (r.type === 'A' && r.content === serverHost) || r.type === 'CNAME')
        : dnsRecords;

    // Filtra pelo termo de busca
    const displayedRecords = serverFiltered.filter(r => 
        (r.name && r.name.toLowerCase().includes(search.toLowerCase())) ||
        (r.content && r.content.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSelect = (recordName) => {
        onChange(recordName);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div className="relative flex items-center w-full">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors pr-10 text-sm"
                />
                <button
                    type="button"
                    onClick={() => {
                        const nextState = !isOpen;
                        setIsOpen(nextState);
                        if (nextState && currentZoneId && onFetchRecords) {
                            onFetchRecords(currentZoneId);
                        }
                    }}
                    className={`absolute right-2 p-1.5 rounded-lg transition-colors ${
                        isOpen 
                            ? 'bg-blue-600 text-white' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title="Selecionar DNS da Cloudflare"
                >
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 p-3 space-y-2.5 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-150 max-h-80 flex flex-col">
                    {/* Header com Zonas (se houver mais de uma) */}
                    {zones.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0 mr-1 flex items-center gap-1">
                                <Globe size={11} /> Zonas:
                            </span>
                            {zones.map(z => {
                                const isCurrent = z.id === currentZoneId;
                                return (
                                    <button
                                        key={z.id}
                                        type="button"
                                        onClick={() => {
                                            if (onSelectZone) onSelectZone(z.id);
                                            if (onFetchRecords) onFetchRecords(z.id);
                                        }}
                                        className={`text-[11px] px-2.5 py-0.5 rounded-md border shrink-0 transition-colors ${
                                            isCurrent 
                                                ? 'bg-blue-600 border-blue-500 text-white font-medium' 
                                                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                                        }`}
                                    >
                                        {z.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Barra de busca e filtro de IP */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                autoFocus
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar subdomínio..."
                                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        {serverHost && (
                            <button
                                type="button"
                                onClick={() => setFilterByServerIp(!filterByServerIp)}
                                className={`text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1 shrink-0 transition-colors ${
                                    filterByServerIp
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                                        : 'bg-slate-800 border-slate-700 text-slate-400'
                                }`}
                                title={filterByServerIp ? `Filtrando apenas IPs iguais a ${serverHost}` : "Mostrando todos os registros"}
                            >
                                <Filter size={10} />
                                {filterByServerIp ? 'IP Servidor' : 'Todos'}
                            </button>
                        )}
                    </div>

                    {/* Lista de Registros */}
                    <div className="overflow-y-auto space-y-1 max-h-48 custom-scrollbar pr-1 flex-1">
                        {loadingRecords && currentZoneRecords.length === 0 ? (
                            <div className="text-center py-6 text-xs text-slate-500 animate-pulse">
                                Carregando registros DNS da Cloudflare...
                            </div>
                        ) : displayedRecords.length > 0 ? (
                            displayedRecords.map(r => {
                                const isSelected = value === r.name;
                                const isMyIp = r.type === 'A' && r.content === serverHost;
                                return (
                                    <button
                                        key={`${r.name}-${r.type}-${r.content}`}
                                        type="button"
                                        onClick={() => handleSelect(r.name)}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                            isSelected 
                                                ? 'bg-blue-600/20 border border-blue-500/40 text-blue-200' 
                                                : 'hover:bg-slate-800/80 text-slate-300'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1 pr-2">
                                            <div className="font-semibold text-slate-100 truncate flex items-center gap-1.5">
                                                {r.name}
                                                {isMyIp && (
                                                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                                                        Este Servidor
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate">
                                                {r.type} → {r.content}
                                            </div>
                                        </div>
                                        {isSelected && <Check size={14} className="text-blue-400 shrink-0" />}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="text-center py-5 text-xs text-slate-500 space-y-1">
                                <div>Nenhum registro encontrado {filterByServerIp ? `apontado para ${serverHost}` : ''}.</div>
                                {filterByServerIp && (
                                    <button
                                        type="button"
                                        onClick={() => setFilterByServerIp(false)}
                                        className="text-[10px] text-blue-400 hover:underline"
                                    >
                                        Ver todos os registros da zona
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DnsRecordSelect;
