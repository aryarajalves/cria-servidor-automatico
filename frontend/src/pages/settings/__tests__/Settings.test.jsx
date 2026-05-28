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
        stackCredentials: {},
        loadingCreds: false,
        handleUpdateStackCreds: vi.fn(),
        loadingSettings: false,
    })),
}));


import Settings from '../../Settings';
import ServerCredentialsCard from '../ServerCredentialsCard';
import SshPasswordCard from '../SshPasswordCard';
import CloudflareCard from '../CloudflareCard';

// ─── Testes: Settings (página orquestradora) ──────────────────────────────────

const defaultSettingsReturn = {
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

    it('exibe o conteúdo quando loadingSettings=false', async () => {
        const { useSettings } = await import('../../settings/useSettings');
        vi.mocked(useSettings).mockReturnValueOnce({ ...defaultSettingsReturn, loadingSettings: false });
        render(<Settings />);
        expect(screen.getByText(/Configurações do Sistema/i)).toBeInTheDocument();
    });
});

// ─── Testes: ServerCredentialsCard ───────────────────────────────────────────

describe('ServerCredentialsCard', () => {
    const selectedServer = { host: '192.168.1.1', password: 'minha_senha_ssh' };
    const showToast = vi.fn();

    it('exibe o IP do servidor', () => {
        render(
            <ServerCredentialsCard
                selectedServer={selectedServer}
                showSshPassword={false}
                setShowSshPassword={vi.fn()}
                showToast={showToast}
            />
        );
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
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
        isCfTokenFromEnv: false,
        cfZones: [],
        defaultDomain: { id: '', name: '' },
        setDefaultDomain: vi.fn(),
        isLoadingZones: false,
        loadingCloudflare: false,
        handleSaveCloudflare: vi.fn(),
    };

    it('exibe o campo de token quando não vem do .env', () => {
        render(<CloudflareCard {...baseProps} />);
        expect(screen.getByPlaceholderText(/H-29/i)).toBeInTheDocument();
    });

    it('exibe badge de segurança quando token vem do .env', () => {
        render(<CloudflareCard {...baseProps} isCfTokenFromEnv={true} />);
        expect(screen.getByText(/Token carregado via arquivo .env/i)).toBeInTheDocument();
    });

    it('exibe alerta para inserir token quando cfToken está vazio', () => {
        render(<CloudflareCard {...baseProps} cfToken="" />);
        expect(screen.getByText(/Insira o Token acima/i)).toBeInTheDocument();
    });

    it('exibe alerta de nenhum domínio quando token está presente mas cfZones está vazio', () => {
        render(<CloudflareCard {...baseProps} cfToken="meu-token" cfZones={[]} isLoadingZones={false} />);
        expect(screen.getByText(/Nenhum domínio encontrado/i)).toBeInTheDocument();
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
