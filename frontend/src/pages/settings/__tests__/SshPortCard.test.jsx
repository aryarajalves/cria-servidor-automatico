import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import SshPortCard from '../SshPortCard';

describe('SshPortCard Component', () => {
    const defaultProps = {
        selectedServer: { id: 1, host: '192.168.1.100', port: 22 },
        newSshPort: 22,
        setNewSshPort: vi.fn(),
        loadingPort: false,
        handleChangeSshPort: vi.fn(),
        handleUpdatePortLocally: vi.fn(),
    };

    it('renderiza o título, o host e a porta ativa atual', () => {
        render(<SshPortCard {...defaultProps} />);
        expect(screen.getByText('Porta SSH do Servidor')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
        expect(screen.getByText('22')).toBeInTheDocument();
    });

    it('renderiza os botões de ação na VPS e salvar apenas no sistema', () => {
        render(<SshPortCard {...defaultProps} />);
        expect(screen.getByRole('button', { name: /Alterar Porta na VPS/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Salvar Apenas no Sistema/i })).toBeInTheDocument();
    });

    it('permite clicar nas tags de sugestão para alterar o valor da porta', () => {
        const setNewSshPort = vi.fn();
        render(<SshPortCard {...defaultProps} setNewSshPort={setNewSshPort} />);

        const suggestionBtn = screen.getByText('2222');
        fireEvent.click(suggestionBtn);
        expect(setNewSshPort).toHaveBeenCalledWith(2222);
    });

    it('chama handleUpdatePortLocally ao clicar no botão salvar apenas no sistema', () => {
        const handleLocally = vi.fn();
        render(<SshPortCard {...defaultProps} handleUpdatePortLocally={handleLocally} />);

        const btn = screen.getByRole('button', { name: /Salvar Apenas no Sistema/i });
        fireEvent.click(btn);
        expect(handleLocally).toHaveBeenCalledTimes(1);
    });

    it('exibe modal bloqueante de progresso quando loadingPort é true', () => {
        render(<SshPortCard {...defaultProps} loadingPort={true} newSshPort={22022} />);
        expect(screen.getByText('Alterando Porta SSH na VPS')).toBeInTheDocument();
        expect(screen.getByText(/Liberando nova porta no Firewall/i)).toBeInTheDocument();
        expect(screen.getByText(/Não feche nem recarregue a página/i)).toBeInTheDocument();
    });
});
