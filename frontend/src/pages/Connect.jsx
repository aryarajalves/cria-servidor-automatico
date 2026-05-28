import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useServer } from '../context/ServerContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import api from '../services/api';
import { Server, Lock, User, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const Connect = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { addServerToList, setIsGlobalLoading, selectedServer } = useServer();

    const initialServerRef = React.useRef(selectedServer);

    React.useEffect(() => {
        // Se já tem servidor selecionado E não foi um clique forçado no botão de adicionar, manda pro dashboard
        if (selectedServer && !location.state?.forceAdd) {
            navigate('/');
        } else if (selectedServer && location.state?.forceAdd && selectedServer?.id !== initialServerRef.current?.id) {
            // Se o usuário selecionou outro servidor existente na sidebar (mudando o selectedServer ativo), redireciona
            navigate('/');
        }
    }, [selectedServer, navigate, location.state]);
    const [formData, setFormData] = useState({
        name: '',
        host: '',
        username: 'root',
        password: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setIsGlobalLoading(true);
        setError('');

        try {
            // 1. Verifica a conexão SSH antes de salvar
            await api.post('/verify-connection', {
                host: formData.host,
                username: formData.username,
                password: formData.password
            });

            // 2. Se conexão OK, salva no banco de dados do backend
            const response = await api.post('/servers', {
                name: formData.name || formData.host,
                host: formData.host,
                username: formData.username,
                password: formData.password
            });

            // 3. Adiciona ao estado global e redireciona
            if (response.data.status === 'success') {
                addServerToList({
                    id: response.data.id,
                    name: formData.name || formData.host,
                    host: formData.host,
                    username: formData.username,
                    password: formData.password
                });
                navigate('/');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.detail || 'Falha ao conectar ao servidor. Verifique as credenciais e tente novamente.');
        } finally {
            setIsLoading(false);
            setIsGlobalLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center z-[1000] space-y-8 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-emerald-600/5 pointer-events-none" />
                
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Server className="text-emerald-500/50 animate-pulse" size={32} />
                    </div>
                </div>

                <div className="text-center relative z-10 space-y-2">
                    <span className="text-[10px] text-emerald-500 uppercase font-black tracking-[0.3em] animate-pulse">Estabelecendo Conexão</span>
                    <h3 className="text-4xl font-black text-white tracking-tight">Testando credenciais SSH...</h3>
                    <p className="text-slate-500 text-lg">Estamos validando o acesso à sua VPS antes de prosseguir.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto mt-10">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
                        <Server size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Conectar Nova VPS</h2>
                    <p className="text-slate-400 mt-2">Cadastre um novo servidor para gerenciar suas stacks</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-6 flex items-center gap-2">
                        <AlertTriangle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Apelido do Servidor (Opcional)"
                        name="name"
                        placeholder="Ex: Servidor Produção Chatwoot"
                        value={formData.name}
                        onChange={handleChange}
                    />

                    <Input
                        label="IP do Servidor"
                        name="host"
                        placeholder="Ex: 192.168.1.1"
                        value={formData.host}
                        onChange={handleChange}
                        required
                    />

                    <Input
                        label="Usuário SSH"
                        name="username"
                        placeholder="root"
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-400 ml-1">Senha SSH</label>
                        <div className="relative group">
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Digite a senha do root..."
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-12"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" variant="primary" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/10 rounded-xl font-bold mt-6" isLoading={isLoading}>
                        Salvar e Conectar
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default Connect;
