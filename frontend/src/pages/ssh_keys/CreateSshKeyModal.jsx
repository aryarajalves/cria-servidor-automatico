import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Key, Shield, Sparkles, AlertTriangle, Check, Copy } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../services/api';

const CreateSshKeyModal = ({ isOpen, onClose, onSuccess }) => {
    const [mode, setMode] = useState('import'); // 'import' | 'generate'
    const [formData, setFormData] = useState({
        name: '',
        private_key: '',
        passphrase: '',
        key_type: 'RSA',
        bits: 2048
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [generatedKeyResult, setGeneratedKeyResult] = useState(null);
    const [copied, setCopied] = useState(false);

    // Reseta 100% os campos toda vez que o modal for aberto
    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: '',
                private_key: '',
                passphrase: '',
                key_type: 'RSA',
                bits: 2048
            });
            setError('');
            setGeneratedKeyResult(null);
            setCopied(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleImportSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await api.post('/ssh-keys', {
                name: formData.name,
                private_key: formData.private_key,
                passphrase: formData.passphrase || null
            });
            onSuccess(response.data);
            handleClose();
        } catch (err) {
            console.error('Erro ao importar chave SSH:', err);
            setError(err.response?.data?.detail || 'Erro ao importar chave privada SSH. Verifique o formato.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await api.post('/ssh-keys/generate', {
                name: formData.name,
                key_type: formData.key_type,
                bits: Number(formData.bits)
            });
            setGeneratedKeyResult(response.data);
            onSuccess(response.data);
        } catch (err) {
            console.error('Erro ao gerar chave SSH:', err);
            setError(err.response?.data?.detail || 'Erro ao gerar par de chaves SSH.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyPublicKey = () => {
        if (generatedKeyResult?.public_key) {
            navigator.clipboard.writeText(generatedKeyResult.public_key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        setFormData({
            name: '',
            private_key: '',
            passphrase: '',
            key_type: 'RSA',
            bits: 2048
        });
        setError('');
        setGeneratedKeyResult(null);
        setCopied(false);
        onClose();
    };

    const modalContent = (
        <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Fullscreen Backdrop */}
            <div 
                className="fixed inset-0 w-full h-full bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            />

            <div 
                className="relative z-10 bg-slate-900 border border-white/10 rounded-[32px] w-full max-w-xl shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/20">
                            <Key size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Nova Chave SSH</h3>
                            <p className="text-xs text-slate-400">Armazene ou gere chaves para autenticar em suas instâncias VPS</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-sm flex items-start gap-2.5">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {generatedKeyResult ? (
                        <div className="space-y-5 animate-in fade-in duration-300">
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3">
                                <Check size={24} className="shrink-0" />
                                <div>
                                    <h4 className="font-bold text-white">Chave Criada com Sucesso!</h4>
                                    <p className="text-xs text-emerald-300/80">O par de chaves foi salvo com segurança.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Chave Pública (Copie e cole na sua VPS):
                                </label>
                                <div className="relative">
                                    <pre className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-xs text-emerald-400 font-mono break-all whitespace-pre-wrap max-h-32 overflow-y-auto select-all">
                                        {generatedKeyResult.public_key}
                                    </pre>
                                    <button
                                        type="button"
                                        onClick={handleCopyPublicKey}
                                        className="absolute right-2 top-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        {copied ? 'Copiado!' : 'Copiar'}
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    💡 Adicione esta linha no arquivo <code className="text-slate-400">~/.ssh/authorized_keys</code> do seu servidor para permitir o login automático sem senha.
                                </p>
                            </div>

                            <div className="pt-2">
                                <Button
                                    variant="primary"
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold"
                                    onClick={handleClose}
                                >
                                    Concluir
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Mode Selector */}
                            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-2xl border border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setMode('import')}
                                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${
                                        mode === 'import'
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Shield size={16} />
                                    Importar Existente
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('generate')}
                                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs transition-all ${
                                        mode === 'generate'
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Sparkles size={16} />
                                    Gerar Automaticamente
                                </button>
                            </div>

                            {mode === 'import' ? (
                                <form onSubmit={handleImportSubmit} className="space-y-4" autoComplete="off">
                                    <Input
                                        label="Nome / Identificador da Chave"
                                        name="name"
                                        placeholder="Ex: Minha Chave Hetzner / AWS"
                                        value={formData.name}
                                        onChange={handleChange}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                        data-lpignore="true"
                                        required
                                    />

                                    <div className="space-y-1.5">
                                        <label className="block text-sm font-medium text-slate-400 ml-1">
                                            Chave Privada (OpenSSH ou PEM) *
                                        </label>
                                        <textarea
                                            name="private_key"
                                            rows={6}
                                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                                            value={formData.private_key}
                                            onChange={handleChange}
                                            autoComplete="off"
                                            spellCheck="false"
                                            data-lpignore="true"
                                            required
                                            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                                        />
                                    </div>

                                    <Input
                                        label="Senha da Chave / Passphrase (Opcional)"
                                        name="passphrase"
                                        type="password"
                                        placeholder="Deixe em branco se a chave não possuir senha"
                                        value={formData.passphrase}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                        showPasswordGenerator={false}
                                        data-lpignore="true"
                                    />

                                    <div className="pt-2">
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-lg shadow-blue-600/20"
                                            isLoading={isLoading}
                                        >
                                            Salvar Chave SSH
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleGenerateSubmit} className="space-y-4" autoComplete="off">
                                    <Input
                                        label="Nome / Identificador da Chave"
                                        name="name"
                                        placeholder="Ex: Chave AutoServer VPS 01"
                                        value={formData.name}
                                        onChange={handleChange}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                        data-lpignore="true"
                                        required
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-sm font-medium text-slate-400 ml-1">
                                                Algoritmo
                                            </label>
                                            <select
                                                name="key_type"
                                                value={formData.key_type}
                                                onChange={handleChange}
                                                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            >
                                                <option value="RSA">RSA</option>
                                                <option value="ED25519">Ed25519 (Mais Rápido & Seguro)</option>
                                            </select>
                                        </div>

                                        {formData.key_type === 'RSA' && (
                                            <div className="space-y-1.5">
                                                <label className="block text-sm font-medium text-slate-400 ml-1">
                                                    Tamanho (Bits)
                                                </label>
                                                <select
                                                    name="bits"
                                                    value={formData.bits}
                                                    onChange={handleChange}
                                                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                                >
                                                    <option value={2048}>2048 bits (Padrão)</option>
                                                    <option value={4096}>4096 bits (Alta Segurança)</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-400 space-y-1 leading-relaxed">
                                        <p className="font-semibold text-slate-300">Como funciona?</p>
                                        <p>Ao clicar no botão abaixo, geraremos um par de chaves criptográficas único. Você receberá a chave pública para colocar no seu servidor e a chave privada ficará salva para conectar automaticamente.</p>
                                    </div>

                                    <div className="pt-2">
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold shadow-lg shadow-emerald-600/20"
                                            isLoading={isLoading}
                                        >
                                            Gerar Novo Par de Chaves
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default CreateSshKeyModal;
