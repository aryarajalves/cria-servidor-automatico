import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar", type = "info" }) => {
    if (!isOpen) return null;

    const colors = {
        info: "from-blue-500 to-indigo-600",
        danger: "from-red-500 to-rose-600",
        warning: "from-amber-500 to-orange-600",
        success: "from-emerald-500 to-teal-600"
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
            />
            
            <div className="relative w-full max-w-[440px] bg-slate-900 border border-white/10 rounded-[40px] shadow-2xl flex flex-col items-center justify-center text-center p-10 py-12 animate-in zoom-in-95 duration-200">
                {/* Gradient Header */}
                <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${colors[type]}`} />
                
                {/* Icon Circle */}
                <div className={`mb-6 p-6 rounded-full bg-slate-800/50 border border-white/5 relative group`}>
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
};

export default ConfirmDialog;
