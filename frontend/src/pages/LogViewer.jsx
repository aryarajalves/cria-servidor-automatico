import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    ScrollText, RefreshCw, ClipboardPaste, Trash2, ChevronDown,
    Search, Copy, Download, Loader2, AlertTriangle, X, CheckSquare, Square
} from 'lucide-react';
import api from '../services/api';

const LEVELS = ['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG', 'UNKNOWN'];

const LEVEL_STYLES = {
    CRITICAL: 'bg-red-700/20 text-red-400 border-red-700/40',
    ERROR: 'bg-red-500/10 text-red-400 border-red-500/30',
    WARNING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    INFO: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    DEBUG: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    UNKNOWN: 'bg-slate-700/20 text-slate-500 border-slate-700/40',
};

const LOAD_LIMIT_OPTIONS = [500, 1000, 2000, 5000, 20000];

// Filtros rápidos: cada um aplica um termo de busca sobre a linha inteira do log
const QUICK_FILTERS = [
    { label: 'Instalação de Stacks', term: 'installer' },
    { label: 'Docker / Portainer', term: 'portainer' },
    { label: 'SSH / Conexão', term: 'ssh' },
    { label: 'Cloudflare DNS', term: 'cloudflare' },
    { label: 'Autenticação', term: 'auth' },
    { label: 'Cluster Swarm', term: 'cluster' },
    { label: 'Banco de Dados', term: 'database' },
    { label: 'Requisições HTTP', term: '/servers' },
];

// Extrai só o horário (HH:MM:SS) de um timestamp "dd/MM/yy HH:MM:SS"
const extractTime = (timestamp) => {
    if (!timestamp) return null;
    const parts = timestamp.split(' ');
    return parts.length === 2 ? parts[1] : null;
};

const LogViewer = () => {
    const [availableDays, setAvailableDays] = useState([]);
    const [selectedDay, setSelectedDay] = useState('');
    const [showDayDropdown, setShowDayDropdown] = useState(false);

    const [loadLimit, setLoadLimit] = useState(2000);
    const [showLimitDropdown, setShowLimitDropdown] = useState(false);

    const [lines, setLines] = useState([]);
    const [totalOnServer, setTotalOnServer] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState('');

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [selectedLevels, setSelectedLevels] = useState(new Set(LEVELS));
    const [activeQuickFilter, setActiveQuickFilter] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [timeFrom, setTimeFrom] = useState('');
    const [timeTo, setTimeTo] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());

    const [toast, setToast] = useState(null);

    const showToast = (message, tone = 'success') => {
        setToast({ message, tone });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchDays = useCallback(async () => {
        try {
            const res = await api.get('/logs/days');
            const days = res.data.days || [];
            setAvailableDays(days);
            if (!selectedDay && days.length > 0) {
                setSelectedDay(days[0].day);
            }
        } catch (err) {
            console.error('Erro ao listar dias de log:', err);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchDays();
    }, [fetchDays]);

    const loadLogs = async (day, limit) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get('/logs', { params: { day, limit } });
            setLines(res.data.lines || []);
            setTotalOnServer(res.data.total || 0);
            setSelectedIds(new Set());
            showToast(`${res.data.returned} linha(s) carregada(s) — total no dia: ${res.data.total}`);
        } catch (err) {
            const detail = err.response?.data?.detail || err.message;
            setError(detail);
            showToast(`Erro ao carregar logs: ${detail}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadClick = () => {
        const day = selectedDay || undefined;
        loadLogs(day, loadLimit);
    };

    const handleClear = () => {
        setLines([]);
        setTotalOnServer(0);
        setSelectedIds(new Set());
        setSearchText('');
        setActiveQuickFilter(null);
        setTimeFrom('');
        setTimeTo('');
    };

    const handlePasteConfirm = () => {
        const rawLines = pasteText.split('\n').filter((l) => l.length > 0);
        const LINE_RE = /^\[(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) BRT\] \[([A-Z]+)\] \[([^\]]+)\] (.*)$/;
        const parsed = rawLines.map((raw, idx) => {
            const match = raw.match(LINE_RE);
            if (match) {
                return { id: idx + 1, timestamp: match[1], level: match[2], source: match[3], message: match[4], raw };
            }
            return { id: idx + 1, timestamp: null, level: 'UNKNOWN', source: null, message: raw, raw };
        });
        setLines(parsed);
        setTotalOnServer(parsed.length);
        setSelectedIds(new Set());
        setShowPasteModal(false);
        setPasteText('');
        showToast(`${parsed.length} linha(s) coladas manualmente`);
    };

    const handleDeleteOnServer = async () => {
        if (!selectedDay) return;
        setIsDeleting(true);
        try {
            await api.delete(`/logs/${selectedDay}`);
            showToast(`Log do dia ${selectedDay} apagado no servidor`);
            setShowDeleteConfirm(false);
            handleClear();
            fetchDays();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Erro ao apagar log no servidor', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        setIsLoading(true);
        try {
            const idsArray = Array.from(selectedIds);
            const res = await api.post(`/logs/${selectedDay || 'manual'}/delete-lines`, {
                line_ids: idsArray
            });
            showToast(res.data.message || 'Linhas apagadas com sucesso');
            setSelectedIds(new Set());
            // Se for do servidor, recarrega. Se for colado manual, limpa da memória local.
            if (selectedDay) {
                await loadLogs(selectedDay, loadLimit);
            } else {
                setLines(prev => prev.filter(l => !idsArray.includes(l.id)));
            }
        } catch (err) {
            showToast(err.response?.data?.detail || 'Erro ao apagar linhas selecionadas', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleLevel = (level) => {
        setSelectedLevels((prev) => {
            const next = new Set(prev);
            if (next.has(level)) next.delete(level);
            else next.add(level);
            return next;
        });
    };

    const toggleQuickFilter = (filter) => {
        if (activeQuickFilter?.label === filter.label) {
            setActiveQuickFilter(null);
        } else {
            setActiveQuickFilter(filter);
        }
    };

    const filteredLines = useMemo(() => {
        return lines.filter((line) => {
            if (!selectedLevels.has(line.level)) {
                return false;
            }

            if (searchText && !line.raw.toLowerCase().includes(searchText.toLowerCase())) {
                return false;
            }

            if (activeQuickFilter && !line.raw.toLowerCase().includes(activeQuickFilter.term.toLowerCase())) {
                return false;
            }

            const time = extractTime(line.timestamp);
            if (timeFrom && time && time < timeFrom) return false;
            if (timeTo && time && time > timeTo) return false;

            return true;
        });
    }, [lines, selectedLevels, searchText, activeQuickFilter, timeFrom, timeTo]);

    const counts = useMemo(() => {
        const c = { ERROR: 0, WARNING: 0, INFO: 0, DEBUG: 0, CRITICAL: 0, UNKNOWN: 0 };
        filteredLines.forEach((l) => {
            if (c[l.level] !== undefined) c[l.level] += 1;
        });
        return c;
    }, [filteredLines]);

    const allFilteredSelected = filteredLines.length > 0 && filteredLines.every((l) => selectedIds.has(l.id));

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredLines.map((l) => l.id)));
        }
    };

    const toggleSelectLine = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const getTextToExport = () => {
        const target = selectedIds.size > 0
            ? filteredLines.filter((l) => selectedIds.has(l.id))
            : filteredLines;
        return target.map((l) => l.raw).join('\n');
    };

    const handleCopy = async () => {
        const text = getTextToExport();
        if (!text) {
            showToast('Nada para copiar', 'error');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            showToast(`${selectedIds.size > 0 ? selectedIds.size : filteredLines.length} linha(s) copiada(s)`);
        } catch (err) {
            showToast('Não foi possível copiar', 'error');
        }
    };

    const handleDownload = () => {
        const text = getTextToExport();
        if (!text) {
            showToast('Nada para baixar', 'error');
            return;
        }
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${selectedDay || 'manual'}.log`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-2 duration-200 flex items-center gap-2 ${
                    toast.tone === 'error'
                        ? 'bg-red-950/90 border-red-500/30 text-red-300'
                        : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                }`}>
                    {toast.tone === 'error' ? <AlertTriangle size={16} /> : <CheckSquare size={16} />}
                    <span className="text-sm font-medium">{toast.message}</span>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/50 via-red-500 to-red-500/50" />
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                                    <Trash2 size={20} />
                                </div>
                                <h3 className="text-xl font-bold text-white">Apagar log no servidor</h3>
                            </div>
                            <p className="text-slate-300 mb-8 leading-relaxed">
                                Isso vai apagar permanentemente o arquivo de log do dia{' '}
                                <span className="text-white font-bold">{selectedDay}</span> no servidor. Essa ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3">
                                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-all active:scale-95">
                                    Cancelar
                                </button>
                                <button onClick={handleDeleteOnServer} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60">
                                    {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                    Apagar Agora
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Paste Modal */}
            {showPasteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowPasteModal(false)} />
                    <div className="relative w-full max-w-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                        <ClipboardPaste size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">Colar logs manualmente</h3>
                                </div>
                                <button onClick={() => setShowPasteModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <p className="text-slate-500 text-sm mb-4">
                                Cole abaixo o texto de log copiado de qualquer lugar (ex: docker logs). Linhas fora do padrão aparecem como "UNKNOWN".
                            </p>
                            <textarea
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                rows={10}
                                placeholder="[02/07/26 18:11:35 BRT] [INFO] [autoserver] mensagem..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm font-mono text-slate-200 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => setShowPasteModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-all active:scale-95">
                                    Cancelar
                                </button>
                                <button onClick={handlePasteConfirm} disabled={!pasteText.trim()} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-40">
                                    Carregar Texto Colado
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                        <ScrollText className="text-blue-500 w-8 h-8" />
                        Visualizador de Logs
                    </h2>
                    <p className="text-slate-400 mt-1.5 text-sm">
                        Depure requisições e processos do backend filtrando por dia, nível e texto.
                    </p>
                </div>
                {lines.length > 0 && (
                    <div className="px-4 py-2 rounded-xl bg-slate-900/50 border border-white/5 text-sm">
                        <span className="text-slate-500">Carregadas: </span>
                        <span className="text-white font-bold">{lines.length}</span>
                        <span className="text-slate-500"> / {totalOnServer} linhas totais</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Selecionar dia */}
                    <div className="relative">
                        <button
                            onClick={() => setShowDayDropdown(!showDayDropdown)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/5 hover:border-white/10 text-slate-200 text-sm font-medium transition-all"
                        >
                            {selectedDay || 'Selecionar dia'}
                            <ChevronDown size={16} className={`transition-transform ${showDayDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        {showDayDropdown && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowDayDropdown(false)} />
                                <div className="absolute top-full left-0 mt-2 w-56 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-2 z-20 max-h-72 overflow-y-auto">
                                    {availableDays.length > 0 ? availableDays.map((d) => (
                                        <button
                                            key={d.day}
                                            onClick={() => { setSelectedDay(d.day); setShowDayDropdown(false); }}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all ${
                                                selectedDay === d.day ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5'
                                            }`}
                                        >
                                            <span>{d.day}</span>
                                            <span className="text-xs opacity-60">{d.total_lines}</span>
                                        </button>
                                    )) : (
                                        <div className="px-4 py-3 text-sm text-slate-500 italic">Nenhum log disponível</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Carregar logs + limite */}
                    <div className="flex">
                        <button
                            onClick={handleLoadClick}
                            disabled={isLoading || !selectedDay}
                            className="flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-l-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-blue-600/20"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Carregar Logs
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setShowLimitDropdown(!showLimitDropdown)}
                                className="h-full flex items-center gap-1 px-3 py-2.5 rounded-r-xl bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold border-l border-blue-500/40 transition-all"
                            >
                                {loadLimit.toLocaleString('pt-BR')}
                                <ChevronDown size={14} />
                            </button>
                            {showLimitDropdown && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowLimitDropdown(false)} />
                                    <div className="absolute top-full right-0 mt-2 w-32 bg-slate-800 border border-white/10 rounded-xl shadow-2xl py-2 z-20">
                                        {LOAD_LIMIT_OPTIONS.map((opt) => (
                                            <button
                                                key={opt}
                                                onClick={() => { setLoadLimit(opt); setShowLimitDropdown(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm transition-all ${loadLimit === opt ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                                            >
                                                {opt.toLocaleString('pt-BR')}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => setShowPasteModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/5 hover:border-white/10 text-slate-200 text-sm font-medium transition-all"
                    >
                        <ClipboardPaste size={16} />
                        Colar manualmente
                    </button>

                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/5 hover:border-white/10 text-slate-200 text-sm font-medium transition-all"
                    >
                        <Trash2 size={16} />
                        Limpar
                    </button>

                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={!selectedDay}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-sm font-bold transition-all disabled:opacity-40 ml-auto"
                    >
                        <Trash2 size={16} />
                        Apagar log no servidor
                    </button>
                </div>

                {/* Filtros rápidos */}
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Filtros Rápidos</p>
                    <div className="flex flex-wrap gap-2">
                        {QUICK_FILTERS.map((filter) => (
                            <button
                                key={filter.label}
                                onClick={() => toggleQuickFilter(filter)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    activeQuickFilter?.label === filter.label
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-slate-800/50 border-white/5 text-slate-400 hover:border-white/10 hover:text-white'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Horário + busca */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Horário De</label>
                        <input
                            type="time"
                            step="1"
                            value={timeFrom}
                            onChange={(e) => setTimeFrom(e.target.value)}
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Horário Até</label>
                        <input
                            type="time"
                            step="1"
                            value={timeTo}
                            onChange={(e) => setTimeTo(e.target.value)}
                            className="w-full bg-slate-800/50 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Busca no Texto</label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Buscar se contém..."
                                className="w-full bg-slate-800/50 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Nível */}
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nível</p>
                    <div className="flex flex-wrap gap-2">
                        {LEVELS.map((level) => (
                            <button
                                key={level}
                                onClick={() => toggleLevel(level)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    selectedLevels.has(level)
                                        ? LEVEL_STYLES[level]
                                        : 'bg-slate-900 border-slate-800 text-slate-600'
                                }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertTriangle size={18} />
                    {error}
                </div>
            )}

            {/* Resultados */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-wrap gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-bold text-white">{filteredLines.length} / {lines.length} linhas</span>
                        <span className="px-2 py-1 rounded-md bg-red-700/20 text-red-400 text-xs font-bold">{counts.CRITICAL} CRIT</span>
                        <span className="px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-bold">{counts.ERROR} ERR</span>
                        <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 text-xs font-bold">{counts.WARNING} WARN</span>
                        <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-bold">{counts.INFO} INFO</span>
                        <span className="px-2 py-1 rounded-md bg-slate-500/10 text-slate-400 text-xs font-bold">{counts.DEBUG} DEBUG</span>
                        <span className="px-2 py-1 rounded-md bg-slate-700/20 text-slate-500 text-xs font-bold">{counts.UNKNOWN} UNKNOWN</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.size > 0 && (
                            <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all">
                                <Trash2 size={14} />
                                Apagar Selecionados ({selectedIds.size})
                            </button>
                        )}
                        <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/5 hover:border-white/10 text-slate-300 text-xs font-bold transition-all">
                            <Copy size={14} />
                            Copiar
                        </button>
                        <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-white/5 hover:border-white/10 text-slate-300 text-xs font-bold transition-all">
                            <Download size={14} />
                            Download
                        </button>
                    </div>
                </div>

                {filteredLines.length > 0 && (
                    <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-2 px-6 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors border-b border-white/5 w-full"
                    >
                        {allFilteredSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
                        Selecionar todos os filtrados ({filteredLines.length})
                    </button>
                )}

                <div className="max-h-[600px] overflow-y-auto divide-y divide-white/5">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-slate-500 text-sm">Carregando logs...</p>
                        </div>
                    ) : filteredLines.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center px-6">
                            <ScrollText className="w-10 h-10 text-slate-700" />
                            <p className="text-slate-500 text-sm">
                                {lines.length === 0
                                    ? 'Nenhum log carregado. Selecione um dia e clique em "Carregar Logs".'
                                    : 'Nenhuma linha corresponde aos filtros aplicados.'}
                            </p>
                        </div>
                    ) : (
                        filteredLines.map((line) => (
                            <div
                                key={line.id}
                                className={`flex items-start gap-3 px-6 py-2.5 text-xs font-mono hover:bg-white/[0.02] transition-colors group/row ${
                                    selectedIds.has(line.id) ? 'bg-blue-600/5' : ''
                                }`}
                            >
                                <button onClick={() => toggleSelectLine(line.id)} className="mt-0.5 shrink-0 text-slate-600 hover:text-blue-400 transition-colors">
                                    {selectedIds.has(line.id) ? <CheckSquare size={14} className="text-blue-500" /> : <Square size={14} />}
                                </button>
                                <button 
                                    onClick={async () => {
                                        setSelectedIds(new Set([line.id]));
                                        // Executa a deleção em seguida com timeout leve para o estado atualizar
                                        setTimeout(async () => {
                                            setIsLoading(true);
                                            try {
                                                const res = await api.post(`/logs/${selectedDay || 'manual'}/delete-lines`, {
                                                    line_ids: [line.id]
                                                });
                                                showToast(res.data.message || 'Linha apagada');
                                                setSelectedIds(new Set());
                                                if (selectedDay) {
                                                    await loadLogs(selectedDay, loadLimit);
                                                } else {
                                                    setLines(prev => prev.filter(l => l.id !== line.id));
                                                }
                                            } catch (err) {
                                                showToast('Erro ao apagar linha', 'error');
                                            } finally {
                                                setIsLoading(false);
                                            }
                                        }, 100);
                                    }} 
                                    className="mt-0.5 shrink-0 text-slate-600 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-all"
                                    title="Apagar esta linha de log"
                                >
                                    <Trash2 size={14} />
                                </button>
                                <span className="text-slate-600 shrink-0 w-10 text-right select-none">{line.id}</span>
                                <span className={`shrink-0 px-2 py-0.5 rounded border text-[10px] font-bold ${LEVEL_STYLES[line.level] || LEVEL_STYLES.UNKNOWN}`}>
                                    {line.level}
                                </span>
                                <span className="text-slate-500 shrink-0">{line.timestamp || '--'}</span>
                                {line.source && <span className="text-slate-600 shrink-0">[{line.source}]</span>}
                                <span className="text-slate-300 break-all">{line.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogViewer;
