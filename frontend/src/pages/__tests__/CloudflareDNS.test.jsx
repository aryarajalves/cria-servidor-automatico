import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CloudflareDNS from '../CloudflareDNS';

// Mock do contexto de Server
vi.mock('../../context/ServerContext', () => ({
    useServer: () => ({
        selectedServer: { host: '192.168.1.1' },
        setIsGlobalLoading: vi.fn(),
    }),
}));

// Mock do módulo de API
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('../../services/api', () => ({
    default: {
        get: (...args) => mockApiGet(...args),
        post: (...args) => mockApiPost(...args),
    },
}));

describe('CloudflareDNS Page', () => {
    it('exibe tela de carregamento de DNS inicialmente', () => {
        mockApiGet.mockReturnValue(new Promise(() => {})); // Nunca resolve para manter loading
        render(<CloudflareDNS />);
        expect(screen.getByText(/Verificando DNS/i)).toBeInTheDocument();
    });

    it('exibe tela de domínio padrão em falta se não houver default_domain_id', async () => {
        mockApiGet.mockResolvedValue({ data: { default_domain_id: null } });
        render(<CloudflareDNS />);
        await waitFor(() => {
            expect(screen.getByText(/Selecione um Domínio Padrão/i)).toBeInTheDocument();
        });
    });

    it('carrega os registros e mostra o botão de checagem de SSL', async () => {
        mockApiGet.mockResolvedValue({ data: { default_domain_id: 'zone-1' } });
        mockApiPost.mockImplementation((url, data) => {
            if (url === '/cloudflare/zones') {
                return Promise.resolve({ data: { zones: [{ id: 'zone-1', name: 'exemplo.com' }] } });
            }
            if (url === '/cloudflare/records') {
                return Promise.resolve({
                    data: {
                        records: [
                            { id: 'rec-1', type: 'A', name: 'app.exemplo.com', content: '192.168.1.1', proxied: true },
                            { id: 'rec-2', type: 'TXT', name: 'txt.exemplo.com', content: 'v=spf1', proxied: false }
                        ]
                    }
                });
            }
            return Promise.reject(new Error('Unknown url'));
        });

        render(<CloudflareDNS />);

        // Espera renderizar os registros DNS
        await waitFor(() => {
            expect(screen.getByText('app.exemplo.com')).toBeInTheDocument();
        });

        // O tipo A deve possuir o botão de SSL (com o ícone Globe ou de checagem)
        const checkButtons = screen.getAllByRole('button', { name: /Verificar status SSL/i });
        expect(checkButtons.length).toBe(1);

        // O tipo TXT não deve ter botão de SSL
        expect(screen.queryByText('txt.exemplo.com')?.parentElement?.querySelector('button[title*="SSL"]')).toBeFalsy();
    });

    it('executa a checagem de SSL com sucesso e mostra toast positivo', async () => {
        mockApiGet.mockResolvedValue({ data: { default_domain_id: 'zone-1' } });
        mockApiPost.mockImplementation((url, data) => {
            if (url === '/cloudflare/zones') {
                return Promise.resolve({ data: { zones: [{ id: 'zone-1', name: 'exemplo.com' }] } });
            }
            if (url === '/cloudflare/records') {
                return Promise.resolve({
                    data: {
                        records: [
                            { id: 'rec-1', type: 'A', name: 'app.exemplo.com', content: '192.168.1.1', proxied: true }
                        ]
                    }
                });
            }
            if (url === '/cloudflare/check-ssl') {
                return Promise.resolve({
                    data: { valid: true, message: 'SSL ativo e funcionando!' }
                });
            }
            return Promise.reject(new Error('Unknown url'));
        });

        render(<CloudflareDNS />);

        await waitFor(() => {
            expect(screen.getByText('app.exemplo.com')).toBeInTheDocument();
        });

        const checkButton = screen.getByRole('button', { name: /Verificar status SSL/i });
        fireEvent.click(checkButton);

        // Espera pelo toast indicando sucesso do SSL
        await waitFor(() => {
            expect(screen.getByText(/SSL para app.exemplo.com está ativo/i)).toBeInTheDocument();
        });
    });
});
