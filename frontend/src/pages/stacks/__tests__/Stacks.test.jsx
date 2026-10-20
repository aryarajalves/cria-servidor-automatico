import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// Mock do contexto do servidor
vi.mock('../../../context/ServerContext', () => ({
    useServer: () => ({
        selectedServer: {
            id: 1,
            name: 'VPS Produção',
            host: '10.0.0.1',
            username: 'root'
        },
        setIsGlobalLoading: vi.fn()
    })
}));

// Mock do useStacks hook
vi.mock('../../stacks/useStacks', () => ({
    useStacks: vi.fn(() => ({
        selectedServer: { id: 1, name: 'VPS Produção', host: '10.0.0.1' },
        status: { docker: true, swarm: true, network: true, ctop: false },
        activeStacks: ['traefik'],
        stackUrls: { traefik: ['https://traefik.dev'] },
        stackCredentials: { traefik: { user: 'admin', password: 'password123' } },
        stackVersions: { traefik: '2.10' },
        confirmAction: null,
        setConfirmAction: vi.fn(),
        installationResult: null,
        setInstallationResult: vi.fn(),
        loadingStep: null,
        configModal: null,
        setConfigModal: vi.fn(),
        externalModal: null,
        setExternalModal: vi.fn(),
        chatAdminModal: null,
        setChatAdminModal: vi.fn(),
        verifyingStatus: false,
        verifyingMessage: '',
        loading: false,
        error: null,
        toast: { show: false, message: '', type: 'success' },
        setToast: vi.fn(),
        getActualStackName: vi.fn(name => name),
        fetchStatus: vi.fn(),
        handleInstallDocker: vi.fn(),
        handleInitSwarm: vi.fn(),
        handleCreateNetwork: vi.fn(),
        handleInstallCtop: vi.fn(),
        handleCreateChatwootAdmin: vi.fn(),
        handleConfirmInstall: vi.fn(),
        handleInstallApp: vi.fn(),
        handleRestartStack: vi.fn(),
        handleUninstallApp: vi.fn(),
        handleUpdateCredentials: vi.fn(),
        handleUpdateDomain: vi.fn(),
        handleMarkExternal: vi.fn()
    }))
}));

import Stacks from '../../Stacks';
import SetupStep from '../SetupStep';
import ExternalAppModal from '../ExternalAppModal';
import ChatwootAdminModal from '../ChatwootAdminModal';
import AppInstallModal from '../../../components/AppInstallModal';
import { apps } from '../constants';

describe('Stacks Page Refactoring Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve renderizar a página Stacks principal com setup inicial e aplicativos', () => {
        render(
            <MemoryRouter>
                <Stacks />
            </MemoryRouter>
        );
        expect(screen.getByText('Setup Inicial')).toBeInTheDocument();
        expect(screen.getByText('Aplicativos')).toBeInTheDocument();
        expect(screen.getByText('Aplicativos Próprios')).toBeInTheDocument();
    });

    it('deve renderizar o componente SetupStep com as informações de instalação corretas', () => {
        const onInstallMock = vi.fn();
        render(
            <SetupStep
                title="Docker"
                description="Instala Docker"
                icon={() => <span>Icon</span>}
                isInstalled={true}
                onInstall={onInstallMock}
                isLoading={false}
                color={{ bg: 'bg-blue-500/10', text: 'text-blue-500' }}
            />
        );

        expect(screen.getByText('Docker')).toBeInTheDocument();
        expect(screen.getByText('Instalado')).toBeInTheDocument();
    });

    it('deve abrir o modal de vinculo de aplicativo externo (ExternalAppModal)', () => {
        const onSaveMock = vi.fn();
        const onCloseMock = vi.fn();

        render(
            <ExternalAppModal
                isOpen={true}
                onClose={onCloseMock}
                onSave={onSaveMock}
                appName="Chatwoot"
                stackName="chatwoot"
            />
        );

        expect(screen.getByText('Instalação Externa')).toBeInTheDocument();
        expect(screen.getByText('Vincular Chatwoot hospedado externamente')).toBeInTheDocument();
    });

    it('deve abrir o modal de criação de admin no Chatwoot (ChatwootAdminModal) e submeter o form', () => {
        const onCreateMock = vi.fn();
        const onCloseMock = vi.fn();

        render(
            <ChatwootAdminModal
                isOpen={true}
                onClose={onCloseMock}
                onCreate={onCreateMock}
                stackName="chatwoot_admin"
            />
        );

        expect(screen.getByText('Criar Admin (Terminal)')).toBeInTheDocument();
    });

    it('campos do ChatwootAdminModal devem começar vazios (sem autopreenchimento)', () => {
        render(
            <ChatwootAdminModal
                isOpen={true}
                onClose={vi.fn()}
                onCreate={vi.fn()}
                stackName="chatwoot_admin"
            />
        );

        const emailInput = screen.getByPlaceholderText('ex: voce@gmail.com');
        const passwordInput = screen.getByPlaceholderText('Mínimo 8 caracteres');

        expect(emailInput.value).toBe('');
        expect(passwordInput.value).toBe('');
    });

    it('botão de ver/ocultar senha deve alternar o tipo do campo de senha', () => {
        render(
            <ChatwootAdminModal
                isOpen={true}
                onClose={vi.fn()}
                onCreate={vi.fn()}
                stackName="chatwoot_admin"
            />
        );

        const passwordInput = screen.getByPlaceholderText('Mínimo 8 caracteres');
        expect(passwordInput.type).toBe('password');

        // Clica no botão de ver senha
        const toggleButton = screen.getByTitle('Mostrar senha');
        fireEvent.click(toggleButton);

        expect(passwordInput.type).toBe('text');

        // Clica novamente para ocultar
        const hideButton = screen.getByTitle('Ocultar senha');
        fireEvent.click(hideButton);

        expect(passwordInput.type).toBe('password');
    });

    it('campo de email do Traefik Proxy no AppInstallModal deve vir preenchido por padrao com o email de unity', () => {
        const traefikApp = {
            id: "traefik",
            name: "Traefik Proxy",
            colorBg: "bg-blue-600/10",
            colorText: "text-blue-500",
            icon: () => <span>Icon</span>
        };
        const fields = [
            { name: "email", label: "Email para Let's Encrypt", placeholder: "seu@email.com", defaultValue: "aryarajunity@gmail.com" }
        ];

        render(
            <AppInstallModal
                isOpen={true}
                onClose={vi.fn()}
                onInstall={vi.fn()}
                app={traefikApp}
                fields={fields}
            />
        );

        const emailInput = screen.getByPlaceholderText('seu@email.com');
        expect(emailInput.value).toBe('aryarajunity@gmail.com');
    });
});
