import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import Button from '../../components/ui/Button';

const SetupStep = ({ title, description, icon: Icon, isInstalled, onInstall, isLoading, color, disabled, disabledMessage }) => (
    <div className={`bg-slate-900 border ${disabled ? 'border-slate-800/50 opacity-50' : 'border-slate-800 hover:border-slate-700 hover:scale-[1.01] hover:bg-slate-800/50'} rounded-xl p-5 flex items-center justify-between shadow-sm transition-all duration-300`}>
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color.bg} ${color.text}`}>
                <Icon size={24} />
            </div>
            <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                    {title}
                    {isInstalled && <CheckCircle2 size={16} className="text-emerald-500" />}
                </h3>
                <p className="text-sm text-slate-400">{description}</p>
            </div>
        </div>

        <div className="flex items-center gap-3">
            {isInstalled ? (
                <span className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    Instalado
                </span>
            ) : (
                <div className="flex flex-col items-end">
                    <Button
                        variant="primary"
                        className="text-sm px-4 py-2 h-10"
                        onClick={onInstall}
                        isLoading={isLoading}
                        disabled={disabled}
                    >
                        Instalar
                    </Button>
                    {disabled && disabledMessage && (
                        <span className="text-xs text-amber-500 mt-1">{disabledMessage}</span>
                    )}
                </div>
            )}
        </div>
    </div>
);

export default SetupStep;
