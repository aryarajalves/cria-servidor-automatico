import React, { useState, useRef, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import api from '../services/api';
import { Terminal as TerminalIcon, Play, Trash2, ShieldAlert } from 'lucide-react';

const Terminal = () => {
    const { selectedServer } = useServer();
    const [command, setCommand] = useState('');
    const [history, setHistory] = useState([
        { type: 'system', text: 'Conexão SSH estabelecida. Console pronto para comandos.' },
        { type: 'system', text: 'Use comandos com cuidado. Ações executadas diretamente no Swarm.' }
    ]);
    const [cmdHistoryList, setCmdHistoryList] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);
    const consoleEndRef = useRef(null);

    useEffect(() => {
        if (consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history, isLoading]);

    const handleExecute = async (e) => {
        e.preventDefault();
        const cmdTrimmed = command.trim();
        if (!cmdTrimmed) return;

        // Add to history list for keyboard up/down arrows
        const updatedCmdHistory = [cmdTrimmed, ...cmdHistoryList.filter(c => c !== cmdTrimmed)].slice(0, 50);
        setCmdHistoryList(updatedCmdHistory);
        setHistoryIndex(-1);

        if (cmdTrimmed.toLowerCase() === 'clear') {
            clearTerminal();
            setCommand('');
            return;
        }

        // Add to visual logs
        setHistory(prev => [...prev, { type: 'input', text: cmdTrimmed }]);
        setCommand('');
        setIsLoading(true);

        try {
            const { data } = await api.post('/servers/run-command', {
                ...selectedServer,
                command: cmdTrimmed
            });

            if (data.exit_status === 0) {
                setHistory(prev => [
                    ...prev, 
                    { type: 'output', text: data.output || 'Comando executado com sucesso (sem retorno de texto).' }
                ]);
            } else {
                setHistory(prev => [
                    ...prev, 
                    { type: 'error', text: data.error || data.output || `Comando falhou com código de saída ${data.exit_status}` }
                ]);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.detail || err.message || 'Falha ao executar o comando no servidor remoto.';
            setHistory(prev => [...prev, { type: 'error', text: errorMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistoryList.length > 0 && historyIndex < cmdHistoryList.length - 1) {
                const nextIndex = historyIndex + 1;
                setHistoryIndex(nextIndex);
                setCommand(cmdHistoryList[nextIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const nextIndex = historyIndex - 1;
                setHistoryIndex(nextIndex);
                setCommand(cmdHistoryList[nextIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setCommand('');
            }
        }
    };

    const clearTerminal = () => {
        setHistory([
            { type: 'system', text: 'Console limpo. Pronto para novos comandos.' }
        ]);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                        <TerminalIcon className="text-blue-500" size={24} />
                        Terminal SSH
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Execute comandos administrativos diretamente na VPS conectada: <span className="text-blue-400 font-bold">{selectedServer?.name} ({selectedServer?.host})</span>
                    </p>
                </div>

                <button
                    onClick={clearTerminal}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-800 hover:bg-slate-700/80 border border-white/5 rounded-xl transition-all text-slate-300 font-medium active:scale-95"
                >
                    <Trash2 size={16} />
                    Limpar Terminal
                </button>
            </div>

            {/* Warn banner */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-400 text-sm">
                <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                <div>
                    <p className="font-bold">Aviso de Segurança</p>
                    <p className="text-slate-400 mt-0.5">Todos os comandos são executados com privilégios de usuário root. Evite comandos destrutivos (como rm -rf, etc.) que possam invalidar a estabilidade do cluster.</p>
                </div>
            </div>

            {/* Terminal Window */}
            <div className="bg-slate-950/80 border border-white/5 rounded-2xl flex flex-col h-[550px] overflow-hidden shadow-2xl relative">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-900 border-b border-white/5 shrink-0">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-xs text-slate-500 ml-4 font-mono select-none">ssh root@{selectedServer?.host}</span>
                </div>

                {/* Logs Area */}
                <div className="flex-1 p-6 overflow-y-auto font-mono text-sm space-y-3 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                    {history.map((log, index) => {
                        if (log.type === 'system') {
                            return (
                                <div key={index} className="text-slate-500 italic select-none">
                                    [SISTEMA] {log.text}
                                </div>
                            );
                        }
                        if (log.type === 'input') {
                            return (
                                <div key={index} className="text-blue-400">
                                    <span className="text-slate-600 select-none">root@vps:~$</span> {log.text}
                                </div>
                            );
                        }
                        if (log.type === 'output') {
                            return (
                                <div key={index} className="text-slate-300 whitespace-pre-wrap pl-4 border-l border-slate-800">
                                    {log.text}
                                </div>
                            );
                        }
                        if (log.type === 'error') {
                            return (
                                <div key={index} className="text-red-400 whitespace-pre-wrap pl-4 border-l border-red-900">
                                    {log.text}
                                </div>
                            );
                        }
                        return null;
                    })}

                    {isLoading && (
                        <div className="flex items-center gap-2 text-slate-500 animate-pulse">
                            <span className="text-slate-600 select-none">root@vps:~$</span>
                            <div className="w-2.5 h-4 bg-slate-400 animate-ping" />
                            <span>executando...</span>
                        </div>
                    )}
                    <div ref={consoleEndRef} />
                </div>

                {/* Input Form */}
                <form onSubmit={handleExecute} className="p-4 bg-slate-900 border-t border-white/5 flex gap-3 shrink-0">
                    <span className="text-slate-600 font-mono text-sm flex items-center select-none">root@vps:~$</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        className="flex-1 bg-transparent border-0 outline-none ring-0 text-white font-mono text-sm focus:ring-0 focus:outline-none placeholder-slate-700"
                        placeholder="Digite o comando SSH aqui..."
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !command.trim()}
                        className="p-2 bg-blue-600 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-lg hover:bg-blue-500 transition-colors active:scale-95 shrink-0"
                    >
                        <Play size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Terminal;
