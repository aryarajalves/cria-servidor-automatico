import React, { useState } from 'react';
import { Terminal, Eye, EyeOff } from 'lucide-react';
import Button from '../../components/ui/Button';

const ChatwootAdminModal = ({ isOpen, onClose, onCreate, stackName }) => {
    const [form, setForm] = useState({ email: '', password: '', fullName: '', companyName: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onCreate(stackName, form.email, form.password, form.fullName, form.companyName);
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[2000] p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                        <Terminal size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Criar Admin (Terminal)</h3>
                        <p className="text-xs text-slate-400">Criação forçada ignorando validações</p>
                    </div>
                </div>

                {/* autocomplete="off" + name falso no topo para enganar o browser */}
                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                    {/* Campo honeypot invisível para enganar autocomplete do browser */}
                    <input type="text" name="fake_user" style={{ display: 'none' }} readOnly />
                    <input type="password" name="fake_pass" style={{ display: 'none' }} readOnly />

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Nome Completo</label>
                            <input
                                required
                                type="text"
                                placeholder="Seu Nome"
                                autoComplete="off"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                                value={form.fullName}
                                onChange={e => setForm({ ...form, fullName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Nome da Empresa</label>
                            <input
                                required
                                type="text"
                                placeholder="Ex: Minha Agência"
                                autoComplete="off"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                                value={form.companyName}
                                onChange={e => setForm({ ...form, companyName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">E-mail do Administrador</label>
                        <input
                            required
                            type="email"
                            placeholder="ex: voce@gmail.com"
                            autoComplete="new-password"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Senha de Acesso</label>
                        <div className="relative">
                            <input
                                required
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Mínimo 8 caracteres"
                                autoComplete="new-password"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(prev => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
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
                            Criar Agora
                        </Button>
                    </div>
                </form>

                <p className="mt-4 text-[10px] text-slate-500 text-center leading-relaxed">
                    Este comando será executado diretamente no servidor. <br />
                    Use apenas se a interface do Chatwoot estiver bloqueando seu cadastro.
                </p>
            </div>
        </div>
    );
};

export default ChatwootAdminModal;
