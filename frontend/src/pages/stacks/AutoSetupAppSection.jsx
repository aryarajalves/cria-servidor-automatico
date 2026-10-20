import React from 'react';
import { Layers } from 'lucide-react';
import Input from '../../components/ui/Input';
import DnsRecordSelect from './DnsRecordSelect';
import { apps } from './constants';

const AutoSetupAppSection = ({
    selectedApps = {},
    onToggleApp,
    appParams = {},
    onParamChange,
    dnsProps = {}
}) => {
    const customApps = apps.filter(app => app.category === 'custom');

    return (
        <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-pink-400 flex items-center gap-2">
                    <Layers size={14} /> 4. Aplicativos Próprios (Opcionais)
                </h4>
                <span className="text-[11px] text-slate-500">Implantados via Portainer API</span>
            </div>

            <div className="space-y-3">
                {customApps.map(app => {
                    const isSelected = !!selectedApps[app.id];
                    const Icon = app.icon;
                    // Filtra campos internos que o auto-setup gerencia automaticamente
                    const visibleFields = (app.fields || []).filter(
                        f => f.name !== 'postgres_password'
                    );

                    return (
                        <div 
                            key={app.id} 
                            className={`p-3.5 rounded-xl border transition-colors space-y-3 ${
                                isSelected 
                                    ? 'border-pink-500/40 bg-pink-950/10 shadow-lg shadow-pink-950/20' 
                                    : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'
                            }`}
                        >
                            <label className="flex items-center justify-between cursor-pointer select-none">
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected} 
                                        onChange={(e) => onToggleApp(app.id, e.target.checked)}
                                        className="rounded border-slate-700 text-pink-500 focus:ring-0 w-4 h-4 cursor-pointer" 
                                    />
                                    {Icon && (
                                        <div className={`p-2 rounded-lg ${app.colorBg || 'bg-slate-800'} ${app.colorText || 'text-slate-300'}`}>
                                            <Icon size={18} />
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-bold text-slate-200 flex items-center gap-2">
                                            {app.name}
                                            {app.version && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
                                                    v{app.version}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-400 line-clamp-1">
                                            {app.description}
                                        </div>
                                    </div>
                                </div>
                            </label>

                            {isSelected && visibleFields.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800/60 animate-in fade-in">
                                    {visibleFields.map(field => {
                                        const isRequired = field.required !== false;
                                        const isDnsField = field.type === 'dns_record' || field.name.includes('domain') || field.name.includes('url');
                                        const val = appParams[app.id]?.[field.name] || '';
                                        return (
                                            <div 
                                                key={field.name}
                                                className={visibleFields.length === 1 ? 'sm:col-span-2' : ''}
                                            >
                                                <label className="block text-[11px] text-slate-400 mb-1">
                                                    {field.label}
                                                    {isRequired ? (
                                                        <span className="text-pink-400 ml-1">*</span>
                                                    ) : (
                                                        !field.label.toLowerCase().includes('(opcional)') && (
                                                            <span className="text-slate-500 text-[10px] ml-1">(Opcional)</span>
                                                        )
                                                    )}
                                                </label>
                                                {isDnsField ? (
                                                    <DnsRecordSelect
                                                        {...dnsProps}
                                                        value={val}
                                                        onChange={(v) => onParamChange(app.id, field.name, v)}
                                                        placeholder={field.placeholder || `ex: ${field.name}.seudominio.com`}
                                                        required={isRequired}
                                                    />
                                                ) : (
                                                    <Input 
                                                        type={field.type === 'password' ? 'password' : 'text'}
                                                        value={val} 
                                                        onChange={(e) => onParamChange(app.id, field.name, e.target.value)} 
                                                        placeholder={field.placeholder || `ex: ${field.name}...`}
                                                        required={isRequired}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AutoSetupAppSection;
