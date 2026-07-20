import React from 'react';
import { ShieldAlert, Server } from 'lucide-react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

/**
 * Card de configuração das credenciais da API do Portainer.
 */
const PortainerCard = ({
    portainerUser,
    setPortainerUser,
    portainerPassword,
    setPortainerPassword,
    loadingPortainer,
    handleSavePortainer,
}) => {
    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Server size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-bold">API do Portainer</h3>
                    <p className="text-sm text-slate-500">Credenciais para deploy automático via API.</p>
                </div>
            </div>

            <form onSubmit={handleSavePortainer} className="space-y-4">
                {/* Campos fictícios ocultos para interceptar o preenchimento automático (autofill) do navegador */}
                <input 
                    type="text" 
                    name="prevent_autofill_username" 
                    style={{ position: 'absolute', top: '-1000px', left: '-1000px' }} 
                    tabIndex={-1} 
                    autoComplete="off" 
                />
                <input 
                    type="password" 
                    name="prevent_autofill_password" 
                    style={{ position: 'absolute', top: '-1000px', left: '-1000px' }} 
                    tabIndex={-1} 
                    autoComplete="new-password" 
                />

                <Input
                    label="Usuário do Portainer"
                    type="text"
                    name="portainer_user_field"
                    placeholder="Ex: admin"
                    value={portainerUser}
                    onChange={(e) => setPortainerUser(e.target.value)}
                    autoComplete="off"
                />

                <Input
                    label="Senha do Portainer"
                    type="password"
                    name="portainer_password_field"
                    placeholder="Sua senha..."
                    value={portainerPassword}
                    onChange={(e) => setPortainerPassword(e.target.value)}
                    autoComplete="new-password"
                />

                <div className="bg-blue-600/5 border border-blue-500/10 rounded-xl p-4 flex gap-3 text-xs text-blue-400">
                    <ShieldAlert size={16} className="shrink-0" />
                    <p>
                        Se configurado, os deploys de novas aplicações usarão a API do Portainer, registrando as stacks com controle total (editáveis). Se vazio, a plataforma usará SSH de fallback.
                    </p>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        isLoading={loadingPortainer}
                        className="w-full bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                    >
                        Salvar Credenciais do Portainer
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default PortainerCard;
