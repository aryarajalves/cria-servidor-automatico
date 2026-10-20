import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import Connect from '../Connect';
import { useServer } from '../../context/ServerContext';
import { useNavigate, useLocation } from 'react-router-dom';

// Mocks do React Router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useLocation: vi.fn(),
}));

// Mocks do ServerContext
vi.mock('../../context/ServerContext', () => ({
    useServer: vi.fn(),
}));

// Mocks do api
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: [] }),
        post: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
    }
}));

describe('Connect Page Redirection', () => {
    it('redireciona para o dashboard se selectedServer existe e forceAdd é falso', () => {
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/connect',
            search: '',
            hash: '',
            state: { forceAdd: false },
        });

        vi.mocked(useServer).mockReturnValue({
            selectedServer: { id: 'servidor-1', name: 'Servidor 1' },
            setIsGlobalLoading: vi.fn(),
            addServerToList: vi.fn(),
        });

        render(<Connect />);
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('NÃO redireciona para o dashboard inicialmente se selectedServer existe mas forceAdd é verdadeiro', () => {
        mockNavigate.mockClear();
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/connect',
            search: '',
            hash: '',
            state: { forceAdd: true },
        });

        vi.mocked(useServer).mockReturnValue({
            selectedServer: { id: 'servidor-1', name: 'Servidor 1' },
            setIsGlobalLoading: vi.fn(),
            addServerToList: vi.fn(),
        });

        render(<Connect />);
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('redireciona para o dashboard se o selectedServer ativo mudar (ID diferente do inicial) na tela de cadastro forçado', async () => {
        mockNavigate.mockClear();
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/connect',
            search: '',
            hash: '',
            state: { forceAdd: true },
        });

        const mockUseServer = vi.fn().mockReturnValue({
            selectedServer: { id: 'servidor-1', name: 'Servidor 1' },
            setIsGlobalLoading: vi.fn(),
            addServerToList: vi.fn(),
        });
        vi.mocked(useServer).mockImplementation(mockUseServer);

        // Renderiza o componente com o servidor inicial ('servidor-1')
        const { rerender } = render(<Connect />);
        expect(mockNavigate).not.toHaveBeenCalled();

        // Altera o selectedServer ativo para outro existente ('servidor-2')
        mockUseServer.mockReturnValue({
            selectedServer: { id: 'servidor-2', name: 'Servidor 2' },
            setIsGlobalLoading: vi.fn(),
            addServerToList: vi.fn(),
        });

        rerender(<Connect />);

        // O useEffect deve disparar e redirecionar
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('permite alternar para autenticação por Chave Privada e exibe seleção de chaves', async () => {
        vi.mocked(useLocation).mockReturnValue({
            pathname: '/connect',
            search: '',
            hash: '',
            state: { forceAdd: true },
        });

        vi.mocked(useServer).mockReturnValue({
            selectedServer: null,
            setIsGlobalLoading: vi.fn(),
            addServerToList: vi.fn(),
        });

        const { getByText, getAllByText } = render(<Connect />);

        expect(getAllByText('Senha SSH').length).toBeGreaterThan(0);
        expect(getByText('Chave Privada')).toBeDefined();

        const keyTab = getByText('Chave Privada');
        keyTab.click();

        await waitFor(() => {
            expect(getByText('Chave SSH Privada *')).toBeDefined();
        });
    });
});
