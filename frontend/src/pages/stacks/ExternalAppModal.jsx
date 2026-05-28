import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import Button from '../../components/ui/Button';

const ExternalAppModal = ({ isOpen, onClose, onSave, appName, stackName }) => {
    const [form, setForm] = useState({ url: '', email: '', password: '', version: '' });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSave(stackName, form.url, form.email, form.password, form.version);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                        <Globe size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Instalação Externa</h3>
                        <p className="text-xs text-slate-400">Vincular {appName} hospedado externamente</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Link / Domínio de Acesso</label>
                        <input
                            required
                            type="text"
                            placeholder="ex: painel.meudominio.com"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.url}
                            onChange={e => setForm({ ...form, url: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Versão da Aplicação (opcional)</label>
                        <input
                            type="text"
                            placeholder="ex: 1.0.0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.version}
                            onChange={e => setForm({ ...form, version: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">E-mail de Acesso (opcional)</label>
                        <input
                            type="text"
                            placeholder="ex: admin@gmail.com"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Senha de Acesso (opcional)</label>
                        <input
                            type="password"
                            placeholder="Sua senha"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            className="flex-1"
                            isLoading={loading}
                        >
                            Salvar Vínculo
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExternalAppModal;
