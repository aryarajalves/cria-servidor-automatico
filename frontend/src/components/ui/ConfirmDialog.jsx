import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check } from 'lucide-react';

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", type = "info" }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const colors = {
        info: "from-blue-500 to-indigo-600",
        danger: "from-red-500 to-rose-600",
        warning: "from-amber-500 to-orange-600",
        success: "from-emerald-500 to-teal-600"
    };

    const dialogContent = (
        <div className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop que cobre 100% da tela */}
            <div 
                className="fixed inset-0 w-full h-full bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            />
            
            {/* Caixa Central do Modal */}
            <div 
                className="relative z-10 w-full max-w-[440px] bg-slate-900 border border-white/10 rounded-[40px] shadow-2xl shadow-black/80 flex flex-col items-center justify-center text-center p-10 py-12 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Gradient Header */}
                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${colors[type]}`} />
                
                {/* Icon Circle */}
                <div className="mb-6 p-6 rounded-full bg-slate-800/50 border border-white/5 relative group">
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${colors[type]} opacity-20 blur-xl group-hover:opacity-40 transition-opacity`} />
                    <div className="relative z-10 text-white">
                        {type === 'danger' ? <AlertTriangle size={48} /> : <Check size={48} />}
                    </div>
                </div>

                <h3 className="text-2xl font-black text-white mb-4 tracking-tight">
                    {title}
                </h3>
                
                <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-[280px]">
                    {message}
                </p>

                <div className="flex flex-col gap-3 w-full max-w-[280px]">
                    <button
                        onClick={onConfirm}
                        className={`w-full py-4 rounded-2xl bg-gradient-to-r ${colors[type]} text-white font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-sm hover:bg-slate-700 hover:text-white transition-all"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(dialogContent, document.body) : dialogContent;
};

export default ConfirmDialog;
