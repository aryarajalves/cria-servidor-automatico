import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldAlert, Copy, Check, Eye, EyeOff } from 'lucide-react';
import Button from '../../components/ui/Button';

const ViewPrivateKeyModal = ({ isOpen, keyData, onClose }) => {
    const [copied, setCopied] = useState(false);
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen || !keyData) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(keyData.private_key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <ShieldAlert size={22} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">{keyData.name}</h3>
                            <p className="text-xs text-slate-400">Chave Privada SSH ({keyData.key_type || 'RSA'})</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-4">
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed flex items-start gap-2.5">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                        <span><strong>Atenção:</strong> Nunca compartilhe esta chave privada com terceiros. Qualquer pessoa com acesso a ela pode autenticar no seu servidor.</span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                Conteúdo da Chave Privada
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsRevealed(!isRevealed)}
                                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
                            >
                                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                {isRevealed ? 'Ocultar' : 'Revelar'}
                            </button>
                        </div>

                        <div className="relative">
                            <pre className="w-full bg-slate-950/90 border border-white/10 rounded-xl p-4 text-xs text-slate-300 font-mono break-all whitespace-pre-wrap max-h-56 overflow-y-auto select-all">
                                {isRevealed ? keyData.private_key : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••\n[CONTEÚDO OCULTO POR SEGURANÇA - CLIQUE EM REVELAR PARA EXIBIR]\n••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                            </pre>
                            {isRevealed && (
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="absolute right-3 top-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition-all active:scale-95"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copiado!' : 'Copiar Chave'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950/40 border-t border-white/5 flex justify-end">
                    <Button
                        variant="ghost"
                        className="px-6 py-2.5 text-slate-400 hover:text-white"
                        onClick={onClose}
                    >
                        Fechar
                    </Button>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default ViewPrivateKeyModal;
