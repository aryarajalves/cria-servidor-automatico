import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Dashboard from '../Dashboard';
import { useServer } from '../../context/ServerContext';
import api from '../../services/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    Navigate: () => <div data-testid="navigate" />
}));

vi.mock('../../context/ServerContext', () => ({
    useServer: vi.fn()
}));

vi.mock('../../services/api', () => ({
    default: {
        post: vi.fn()
    }
}));

describe('Dashboard Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exibe a tela de carregamento e permite cancelar a verificação', async () => {
        let resolvePromise;
        const pendingPromise = new Promise((resolve) => {
            resolvePromise = resolve;
        });

        api.post.mockImplementation(() => pendingPromise);

        vi.mocked(useServer).mockReturnValue({
            selectedServer: { id: 1, name: 'Servidor Teste', host: '1.2.3.4', username: 'root', auth_type: 'key' },
            setIsGlobalLoading: vi.fn(),
            isInitializing: false,
            clearSelectedServer: vi.fn()
        });

        render(<Dashboard />);

        expect(screen.getByText('Verificando status do sistema...')).toBeDefined();
        expect(screen.getByText('Cancelar verificação')).toBeDefined();

        const cancelBtn = screen.getByText('Cancelar verificação');
        fireEvent.click(cancelBtn);

        await waitFor(() => {
            expect(screen.getByText('Servidor Inacessível')).toBeDefined();
            expect(screen.getByText('Tentar Novamente')).toBeDefined();
            expect(screen.getByText('Trocar de Servidor')).toBeDefined();
        });
    });

    it('renderiza as métricas quando o status é carregado com sucesso', async () => {
        api.post.mockResolvedValueOnce({
            data: {
                system_status: { docker: '24.0.5', swarm: true, network: true, ctop: true },
                detected_stacks: ['chatwoot', 'traefik'],
                offline: false
            }
        });

        vi.mocked(useServer).mockReturnValue({
            selectedServer: { id: 1, name: 'Servidor Teste', host: '1.2.3.4', username: 'root' },
            setIsGlobalLoading: vi.fn(),
            isInitializing: false,
            clearSelectedServer: vi.fn()
        });

        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.getByText('Visão Geral do Sistema')).toBeDefined();
            expect(screen.getByText('Docker Engine')).toBeDefined();
        });
    });
});
