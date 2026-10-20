import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Mocks globais (hoistados automaticamente pelo Vitest) ────────────────────

vi.mock('../../../../context/ServerContext', () => ({
    useServer: () => ({
        selectedServer: {
            id: 1,
            host: '10.0.0.1',
            username: 'root',
            password: 'secret123',
        },
        selectServer: vi.fn(),
        updateServerInList: vi.fn(),
        setIsGlobalLoading: vi.fn(),
    }),
}));

const mockApiGet = vi.fn().mockResolvedValue({
    data: {
        cloudflare_token: '',
        cloudflare_token_env: false,
        default_domain_id: '',
        default_domain_name: '',
        stack_export_path: '/app/stacks_backups',
    },
});
const mockApiPost = vi.fn().mockResolvedValue({ data: { zones: [], stack_credentials: {} } });
const mockApiPut = vi.fn().mockResolvedValue({ data: {} });

vi.mock('../../../../services/api', () => ({
    default: {
        get: mockApiGet,
        post: mockApiPost,
        put: mockApiPut,
    },
}));
// Mock do useSettings (hook direto) para que seja uma função controlável nos testes da página Settings
vi.mock('../../settings/useSettings', () => ({
    useSettings: vi.fn(() => ({
        selectedServer: { id: 1, host: '10.0.0.1', username: 'root', password: 'secret123' },
        toast: { show: false, message: '', type: 'success' },
        showToast: vi.fn(),
        hideToast: vi.fn(),
        cfToken: '',
        setCfToken: vi.fn(),
        isCfTokenFromEnv: false,
        cfZones: [],
        defaultDomain: { id: '', name: '' },
        setDefaultDomain: vi.fn(),
        isLoadingZones: false,
        loadingCloudflare: false,
        handleSaveCloudflare: vi.fn(),
        stackExportPath: '',
        setStackExportPath: vi.fn(),
        loadingExportPath: false,
        handleSaveExportPath: vi.fn(),
        formData: { newPassword: '', confirmPassword: '' },
        handleChange: vi.fn(),
        loadingSSH: false,
        handleUpdateSSH: vi.fn(),
        handleUpdatePasswordLocally: vi.fn(),
        showSshPassword: false,
        setShowSshPassword: vi.fn(),
        passwordAuthEnabled: true,
        loadingPasswordAuth: false,
        handleTogglePasswordAuth: vi.fn(),
        fetchPasswordAuthStatus: vi.fn(),
        fail2banStatus: { installed: true, active: true, maxretry: 5, findtime: 600, bantime: 3600, banned_ips: [] },
        loadingFail2ban: false,
        handleSaveFail2ban: vi.fn(),
        handleUnbanIp: vi.fn(),
        handleToggleFail2ban: vi.fn(),
        fetchFail2banStatus: vi.fn(),
        stackCredentials: {},
        loadingCreds: false,
        handleUpdateStackCreds: vi.fn(),
        loadingSettings: false,
    })),
}));

import Settings from '../../Settings';
import ServerCredentialsCard from '../ServerCredentialsCard';
import SshPasswordCard from '../SshPasswordCard';
import SshSecurityCard from '../SshSecurityCard';
import Fail2banCard from '../Fail2banCard';
import CloudflareCard from '../CloudflareCard';

// ─── Testes: Settings (página orquestradora) ──────────────────────────────────

const defaultSettingsReturn = {
    selectedServer: { id: 1, host: '10.0.0.1', username: 'root', password: 'secret123' },
    toast: { show: false, message: '', type: 'success' },
    showToast: vi.fn(),
    hideToast: vi.fn(),
    passwordAuthEnabled: true,
    loadingPasswordAuth: false,
    handleTogglePasswordAuth: vi.fn(),
    fetchPasswordAuthStatus: vi.fn(),
    fail2banStatus: { installed: true, active: true, maxretry: 5, findtime: 600, bantime: 3600, banned_ips: [] },
    loadingFail2ban: false,
    handleSaveFail2ban: vi.fn(),
    handleUnbanIp: vi.fn(),
    handleToggleFail2ban: vi.fn(),
    fetchFail2banStatus: vi.fn(),
    cfToken: '',
    setCfToken: vi.fn(),
    isCfTokenFromEnv: false,
    cfZones: [],
    defaultDomain: { id: '', name: '' },
    setDefaultDomain: vi.fn(),
    isLoadingZones: false,
    loadingCloudflare: false,
    handleSaveCloudflare: vi.fn(),
    stackExportPath: '',
    setStackExportPath: vi.fn(),
    loadingExportPath: false,
    handleSaveExportPath: vi.fn(),
    formData: { newPassword: '', confirmPassword: '' },
    handleChange: vi.fn(),
    loadingSSH: false,
    handleUpdateSSH: vi.fn(),
    handleUpdatePasswordLocally: vi.fn(),
    showSshPassword: false,
    setShowSshPassword: vi.fn(),
    stackCredentials: {},
    loadingCreds: false,
    handleUpdateStackCreds: vi.fn(),
    loadingSettings: false,
};

describe('Settings (página orquestradora)', () => {
    it('exibe o loading screen quando loadingSettings=true', async () => {
        const { useSettings } = await import('../../settings/useSettings');
        vi.mocked(useSettings).mockReturnValueOnce({ ...defaultSettingsReturn, loadingSettings: true });
        render(<Settings />);
        expect(screen.getByText(/Carregando configurações/i)).toBeInTheDocument();
    });

    it('exibe o conteúdo e permite navegar entre as abas', async () => {
        const { useSettings } = await import('../../settings/useSettings');
        vi.mocked(useSettings).mockReturnValueOnce({ ...defaultSettingsReturn, loadingSettings: false });
        render(<Settings />);
        expect(screen.getByText(/Configurações do Sistema/i)).toBeInTheDocument();
        expect(screen.getByText('Servidor & Acesso')).toBeInTheDocument();
        expect(screen.getByText('Cloudflare API')).toBeInTheDocument();
        expect(screen.getByText('API do Portainer')).toBeInTheDocument();

        // Inicialmente na aba Servidor & Acesso
        expect(screen.getByText('Credenciais do Servidor')).toBeInTheDocument();

        // Clica na aba Cloudflare API
        const cloudflareTab = screen.getByText('Cloudflare API').closest('button');
        fireEvent.click(cloudflareTab);
        expect(screen.getByText(/Token para automação de DNS/i)).toBeInTheDocument();

        // Clica na aba API do Portainer
        const portainerTab = screen.getByText('API do Portainer').closest('button');
        fireEvent.click(portainerTab);
        expect(screen.getByText('Usuário do Portainer')).toBeInTheDocument();
    });
});

// ─── Testes: ServerCredentialsCard ───────────────────────────────────────────

describe('ServerCredentialsCard', () => {
    const selectedServer = { host: '192.168.1.1', password: 'minha_senha_ssh' };
    const showToast = vi.fn();

    it('exibe o IP e a porta do servidor', () => {
        render(
            <ServerCredentialsCard
                selectedServer={{ host: '192.168.1.1', port: 2222, password: 'minha_senha_ssh' }}
                showSshPassword={false}
                setShowSshPassword={vi.fn()}
                showToast={showToast}
            />
        );
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
        expect(screen.getByText('2222')).toBeInTheDocument();
    });

    it('oculta a senha por padrão com pontos', () => {
        render(
            <ServerCredentialsCard
                selectedServer={selectedServer}
                showSshPassword={false}
                setShowSshPassword={vi.fn()}
                showToast={showToast}
            />
        );
        expect(screen.getByText('••••••••••••••••')).toBeInTheDocument();
    });

    it('exibe a senha real quando showSshPassword=true', () => {
        render(
            <ServerCredentialsCard
                selectedServer={selectedServer}
                showSshPassword={true}
                setShowSshPassword={vi.fn()}
                showToast={showToast}
            />
        );
        expect(screen.getByText('minha_senha_ssh')).toBeInTheDocument();
    });

    it('chama setShowSshPassword ao clicar no botão de toggle', () => {
        const setShowSshPassword = vi.fn();
        render(
            <ServerCredentialsCard
                selectedServer={selectedServer}
                showSshPassword={false}
                setShowSshPassword={setShowSshPassword}
                showToast={showToast}
            />
        );
        fireEvent.click(screen.getByLabelText(/Mostrar senha/i));
        expect(setShowSshPassword).toHaveBeenCalledWith(true);
    });
});



// ─── Testes: SshPasswordCard ─────────────────────────────────────────────────

describe('SshPasswordCard', () => {
    const baseProps = {
        selectedServer: { username: 'root' },
        formData: { newPassword: '', confirmPassword: '' },
        handleChange: vi.fn(),
        loadingSSH: false,
        handleUpdateSSH: vi.fn(),
        handleUpdatePasswordLocally: vi.fn(),
    };

    it('exibe o username do servidor no subtítulo', () => {
        render(<SshPasswordCard {...baseProps} />);
        expect(screen.getByText('root')).toBeInTheDocument();
    });

    it('exibe os dois botões de ação', () => {
        render(<SshPasswordCard {...baseProps} />);
        expect(screen.getByRole('button', { name: /Alterar Senha na VPS/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Salvar Apenas no Sistema/i })).toBeInTheDocument();
    });

    it('chama handleUpdatePasswordLocally ao clicar em "Salvar Apenas no Sistema"', () => {
        const handleLocally = vi.fn();
        render(<SshPasswordCard {...baseProps} handleUpdatePasswordLocally={handleLocally} />);
        fireEvent.click(screen.getByRole('button', { name: /Salvar Apenas no Sistema/i }));
        expect(handleLocally).toHaveBeenCalledTimes(1);
    });
});

// ─── Testes: CloudflareCard ───────────────────────────────────────────────────

describe('CloudflareCard', () => {
    const baseProps = {
        cfToken: '',
        setCfToken: vi.fn(),
        cfZones: [],
        defaultDomain: { id: '', name: '' },
        setDefaultDomain: vi.fn(),
        isLoadingZones: false,
        loadingCloudflare: false,
        handleSaveCloudflare: vi.fn(),
        fetchZones: vi.fn(),
    };

    it('exibe o campo editável de token Cloudflare', () => {
        render(<CloudflareCard {...baseProps} />);
        expect(screen.getByPlaceholderText(/Cole o API Token da Cloudflare/i)).toBeInTheDocument();
    });

    it('exibe badge de Token Configurado quando cfToken está preenchido', () => {
        render(<CloudflareCard {...baseProps} cfToken="token-teste-123" />);
        expect(screen.getByText(/Token Configurado/i)).toBeInTheDocument();
    });

    it('exibe alerta para inserir token quando cfToken está vazio', () => {
        render(<CloudflareCard {...baseProps} cfToken="" />);
        expect(screen.getByText(/Insira o Token acima/i)).toBeInTheDocument();
    });

    it('exibe aviso de recarregar domínios quando token presente e lista vazia', () => {
        render(<CloudflareCard {...baseProps} cfToken="meu-token" cfZones={[]} isLoadingZones={false} />);
        expect(screen.getByText(/Nenhum domínio carregado ainda/i)).toBeInTheDocument();
    });

    it('exibe as zonas disponíveis no select', () => {
        const zones = [
            { id: 'zone-1', name: 'exemplo.com' },
            { id: 'zone-2', name: 'outro.com' },
        ];
        render(<CloudflareCard {...baseProps} cfToken="meu-token" cfZones={zones} />);
        expect(screen.getByText('exemplo.com')).toBeInTheDocument();
        expect(screen.getByText('outro.com')).toBeInTheDocument();
    });
});

// ─── Testes: SshSecurityCard ───────────────────────────────────────────────────

describe('SshSecurityCard', () => {
    const baseSecurityProps = {
        selectedServer: { host: '10.0.0.1', username: 'root' },
        passwordAuthEnabled: true,
        loadingPasswordAuth: false,
        handleTogglePasswordAuth: vi.fn(),
        fetchPasswordAuthStatus: vi.fn(),
    };

    it('renderiza com badge de Senha Habilitada quando passwordAuthEnabled é true', () => {
        render(<SshSecurityCard {...baseSecurityProps} passwordAuthEnabled={true} />);
        expect(screen.getByText(/Senha Habilitada/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Desativar Acesso por Senha/i })).toBeInTheDocument();
    });

    it('renderiza com badge de Apenas Chaves SSH quando passwordAuthEnabled é false', () => {
        render(<SshSecurityCard {...baseSecurityProps} passwordAuthEnabled={false} />);
        expect(screen.getByText(/Apenas Chaves SSH/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reativar Acesso por Senha/i })).toBeInTheDocument();
    });

    it('abre modal de confirmação ao clicar no botão de desativar senha', () => {
        render(<SshSecurityCard {...baseSecurityProps} passwordAuthEnabled={true} />);
        fireEvent.click(screen.getByRole('button', { name: /Desativar Acesso por Senha/i }));
        expect(screen.getByText(/Desativar Senha no Servidor\?/i)).toBeInTheDocument();
    });

    it('executa handleTogglePasswordAuth ao confirmar no modal', async () => {
        const handleToggle = vi.fn().mockResolvedValue();
        render(<SshSecurityCard {...baseSecurityProps} passwordAuthEnabled={true} handleTogglePasswordAuth={handleToggle} />);
        
        // Abre o modal
        fireEvent.click(screen.getByRole('button', { name: /Desativar Acesso por Senha/i }));
        
        // Clica no botão de confirmação do modal
        fireEvent.click(screen.getByRole('button', { name: /Sim, Desativar Senha/i }));
        
        await waitFor(() => {
            expect(handleToggle).toHaveBeenCalledWith(false);
        });
    });

    it('exibe modal bloqueante de progresso quando loadingPasswordAuth é true', () => {
        render(<SshSecurityCard {...baseSecurityProps} loadingPasswordAuth={true} passwordAuthEnabled={true} />);
        expect(screen.getByText('Desativando Senha na VPS')).toBeInTheDocument();
        expect(screen.getByText(/Verificando chaves SSH autorizadas/i)).toBeInTheDocument();
        expect(screen.getByText(/Não feche nem recarregue a página/i)).toBeInTheDocument();
    });
});

// ─── Testes: Fail2banCard ───────────────────────────────────────────────────────

describe('Fail2banCard', () => {
    const baseFail2banProps = {
        selectedServer: { host: '10.0.0.1', username: 'root' },
        fail2banStatus: {
            installed: true,
            active: true,
            maxretry: 5,
            findtime: 600,
            bantime: 3600,
            jails: ['sshd'],
            banned_ips: [{ ip: '192.168.1.50', jail: 'sshd' }],
        },
        loadingFail2ban: false,
        handleSaveFail2ban: vi.fn(),
        handleUnbanIp: vi.fn(),
        handleToggleFail2ban: vi.fn(),
        fetchFail2banStatus: vi.fn(),
    };

    it('renderiza com badge de Proteção Ativa quando ativo', () => {
        render(<Fail2banCard {...baseFail2banProps} />);
        expect(screen.getAllByText(/Proteção Ativa/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: /Salvar e Aplicar Regras/i })).toBeInTheDocument();
        expect(screen.getByText('192.168.1.50')).toBeInTheDocument();
    });

    it('renderiza com badge de Não Configurado quando não instalado', () => {
        const uninstalledProps = {
            ...baseFail2banProps,
            fail2banStatus: { installed: false, active: false, maxretry: 5, findtime: 600, bantime: 3600, banned_ips: [] },
        };
        render(<Fail2banCard {...uninstalledProps} />);
        expect(screen.getByText(/Não Configurado/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Instalar e Ativar Fail2ban/i })).toBeInTheDocument();
    });

    it('executa handleSaveFail2ban com os valores do formulário', async () => {
        const handleSave = vi.fn().mockResolvedValue();
        render(<Fail2banCard {...baseFail2banProps} handleSaveFail2ban={handleSave} />);
        
        fireEvent.click(screen.getByRole('button', { name: /Salvar e Aplicar Regras/i }));
        
        await waitFor(() => {
            expect(handleSave).toHaveBeenCalledWith({
                maxretry: 5,
                findtime: 600,
                bantime: 3600,
            });
        });
    });

    it('abre modal e executa handleUnbanIp ao desbanir IP', async () => {
        const handleUnban = vi.fn().mockResolvedValue();
        render(<Fail2banCard {...baseFail2banProps} handleUnbanIp={handleUnban} />);
        
        // Clica no botão Desbanir IP
        fireEvent.click(screen.getByRole('button', { name: /Desbanir IP/i }));
        expect(screen.getByText(/Desbanir Endereço IP\?/i)).toBeInTheDocument();
        
        // Confirma
        fireEvent.click(screen.getByRole('button', { name: /Sim, Desbanir IP/i }));
        await waitFor(() => {
            expect(handleUnban).toHaveBeenCalledWith('192.168.1.50', 'sshd');
        });
    });

    it('exibe modal bloqueante de progresso quando loadingFail2ban é true', () => {
        render(<Fail2banCard {...baseFail2banProps} loadingFail2ban={true} />);
        expect(screen.getByText('Aplicando Regras do Fail2ban')).toBeInTheDocument();
        expect(screen.getByText(/Verificando pacotes do Fail2ban e Firewall Linux/i)).toBeInTheDocument();
    });
});
