import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SshKeys from '../SshKeys';
import api from '../../services/api';

vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        put: vi.fn()
    }
}));

describe('SshKeys Page Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renderiza o estado vazio quando não há chaves cadastradas', async () => {
        api.get.mockResolvedValueOnce({ data: [] });

        render(<SshKeys />);

        await waitFor(() => {
            expect(screen.getByText('Nenhuma Chave SSH Cadastrada')).toBeDefined();
        });
        expect(screen.getByText('Chaves SSH')).toBeDefined();
    });

    it('carrega e exibe os cards de chaves SSH', async () => {
        const mockKeys = [
            {
                id: 1,
                name: 'Chave Producao Hetzner',
                public_key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...',
                key_type: 'RSA',
                has_passphrase: false,
                servers_count: 2,
                created_at: '2026-08-18T10:00:00Z'
            },
            {
                id: 2,
                name: 'Chave DigitalOcean Ed25519',
                public_key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...',
                key_type: 'ED25519',
                has_passphrase: true,
                servers_count: 0,
                created_at: '2026-08-18T11:00:00Z'
            }
        ];

        api.get.mockResolvedValueOnce({ data: mockKeys });

        render(<SshKeys />);

        await waitFor(() => {
            expect(screen.getByText('Chave Producao Hetzner')).toBeDefined();
            expect(screen.getByText('Chave DigitalOcean Ed25519')).toBeDefined();
        });
        expect(screen.getByText('2 servidor(es) vinculado(s)')).toBeDefined();
    });

    it('abre o modal de criação de chave ao clicar no botão Adicionar Chave SSH', async () => {
        api.get.mockResolvedValueOnce({ data: [] });

        render(<SshKeys />);

        await waitFor(() => {
            expect(screen.getByText('Adicionar Chave SSH')).toBeDefined();
        });

        const addButtons = screen.getAllByText(/Adicionar Chave SSH|Cadastrar ou Gerar Chave/);
        fireEvent.click(addButtons[0]);

        await waitFor(() => {
            expect(screen.getByText('Nova Chave SSH')).toBeDefined();
            expect(screen.getByText('Importar Existente')).toBeDefined();
            expect(screen.getByText('Gerar Automaticamente')).toBeDefined();
        });
    });

    it('permite alternar entre as abas Importar e Gerar no modal', async () => {
        api.get.mockResolvedValueOnce({ data: [] });

        render(<SshKeys />);

        await waitFor(() => {
            expect(screen.getByText('Adicionar Chave SSH')).toBeDefined();
        });

        const addBtn = screen.getByText('Adicionar Chave SSH');
        fireEvent.click(addBtn);

        await waitFor(() => {
            expect(screen.getByText('Nova Chave SSH')).toBeDefined();
        });

        // Alterna para aba Gerar
        const generateTab = screen.getByText('Gerar Automaticamente');
        fireEvent.click(generateTab);

        expect(screen.getByText('Algoritmo')).toBeDefined();
        expect(screen.getByText('Gerar Novo Par de Chaves')).toBeDefined();
    });

    it('abre o modal de confirmação ao clicar no botão de excluir', async () => {
        const mockKeys = [
            {
                id: 1,
                name: 'Chave Para Deletar',
                public_key: 'ssh-rsa AAAAB3...',
                key_type: 'RSA',
                has_passphrase: false,
                servers_count: 0
            }
        ];

        api.get.mockResolvedValueOnce({ data: mockKeys });

        render(<SshKeys />);

        await waitFor(() => {
            expect(screen.getByText('Chave Para Deletar')).toBeDefined();
        });

        const deleteBtn = screen.getByTitle('Excluir Chave');
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(screen.getByText('Excluir Chave SSH')).toBeDefined();
            expect(screen.getByText(/Tem certeza que deseja remover a chave "Chave Para Deletar"/)).toBeDefined();
        });
    });

    it('pagina as chaves limitando a no máximo 20 por página', async () => {
        // Cria 25 chaves mock
        const mockKeys = Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            name: `Chave Teste #${i + 1}`,
            public_key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI_KEY_${i + 1}`,
            key_type: 'ED25519',
            has_passphrase: false,
            servers_count: 0,
            created_at: '2026-08-19T10:00:00Z'
        }));

        api.get.mockResolvedValueOnce({ data: mockKeys });

        render(<SshKeys />);

        // Aguarda carregar
        await waitFor(() => {
            expect(screen.getByText('Chave Teste #1')).toBeInTheDocument();
        });

        // Página 1: Deve mostrar chave #1 até #20
        expect(screen.getByText('Chave Teste #1')).toBeInTheDocument();
        expect(screen.getByText('Chave Teste #20')).toBeInTheDocument();
        // Não deve mostrar chave #21 na página 1
        expect(screen.queryByText('Chave Teste #21')).not.toBeInTheDocument();

        // Resumo de itens
        expect(screen.getByText('1–20')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();

        // Clica na página 2
        const page2Btn = screen.getByRole('button', { name: 'Página 2' });
        fireEvent.click(page2Btn);

        // Página 2: Deve mostrar chave #21 até #25
        expect(screen.getByText('Chave Teste #21')).toBeInTheDocument();
        expect(screen.getByText('Chave Teste #25')).toBeInTheDocument();
        // Não deve mostrar chave #1 na página 2
        expect(screen.queryByText('Chave Teste #1')).not.toBeInTheDocument();

        // Resumo de itens na página 2
        expect(screen.getByText('21–25')).toBeInTheDocument();
    });

    it('reseta a página para 1 quando o usuário realiza uma busca', async () => {
        const mockKeys = Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            name: `Chave Especial #${i + 1}`,
            public_key: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI_KEY_${i + 1}`,
            key_type: 'ED25519',
            has_passphrase: false,
            servers_count: 0,
            created_at: '2026-08-19T10:00:00Z'
        }));

        api.get.mockResolvedValueOnce({ data: mockKeys });

        render(<SshKeys />);

        await waitFor(() => {
            expect(screen.getByText('Chave Especial #1')).toBeInTheDocument();
        });

        // Navega para a página 2
        const page2Btn = screen.getByRole('button', { name: 'Página 2' });
        fireEvent.click(page2Btn);
        expect(screen.getByText('21–25')).toBeInTheDocument();

        // Realiza busca no input
        const searchInput = screen.getByPlaceholderText(/Buscar por nome/i);
        fireEvent.change(searchInput, { target: { value: 'Chave Especial #25' } });

        // Deve filtrar e resetar para página 1
        expect(screen.getByText('Chave Especial #25')).toBeInTheDocument();
        expect(screen.queryByText('Chave Especial #24')).not.toBeInTheDocument();
    });
});
