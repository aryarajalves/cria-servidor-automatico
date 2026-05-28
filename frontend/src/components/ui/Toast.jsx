import React, { useEffect } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
    useEffect(() => {
        if (duration) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const icons = {
        success: <Check size={20} className="text-emerald-500" />,
        error: <AlertTriangle size={20} className="text-red-500" />,
        info: <Info size={20} className="text-blue-500" />
    };

    const bgColors = {
        success: 'bg-emerald-500/10 border-emerald-500/20',
        error: 'bg-red-500/10 border-red-500/20',
        info: 'bg-blue-500/10 border-blue-500/20'
    };

    return (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 fade-in duration-300 ${bgColors[type]} bg-slate-900/95`}>
            <div className={`p-1 rounded-full bg-slate-950/50`}>
                {icons[type]}
            </div>
            <p className="text-sm font-medium text-slate-200">{message}</p>
            <button
                onClick={onClose}
                className="ml-2 p-1 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800/50"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
