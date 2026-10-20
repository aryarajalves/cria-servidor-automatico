import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import Pagination from '../Pagination';

describe('Pagination Component', () => {
    it('não renderiza nada se totalPages <= 1 ou totalItems === 0', () => {
        const { container } = render(
            <Pagination
                currentPage={1}
                totalPages={1}
                totalItems={10}
                itemsPerPage={20}
                onPageChange={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renderiza resumo de itens e botões quando há múltiplas páginas', () => {
        render(
            <Pagination
                currentPage={1}
                totalPages={3}
                totalItems={55}
                itemsPerPage={20}
                onPageChange={vi.fn()}
                itemName="chave"
            />
        );

        expect(screen.getByText(/Mostrando/i)).toBeInTheDocument();
        expect(screen.getByText('1–20')).toBeInTheDocument();
        expect(screen.getByText('55')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Anterior/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Próxima/i })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: 'Página 1' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Página 2' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Página 3' })).toBeInTheDocument();
    });

    it('chama onPageChange ao clicar na próxima página ou em um número', () => {
        const onPageChange = vi.fn();
        render(
            <Pagination
                currentPage={1}
                totalPages={3}
                totalItems={55}
                itemsPerPage={20}
                onPageChange={onPageChange}
            />
        );

        const nextBtn = screen.getByRole('button', { name: /Próxima/i });
        fireEvent.click(nextBtn);
        expect(onPageChange).toHaveBeenCalledWith(2);

        const page3Btn = screen.getByRole('button', { name: 'Página 3' });
        fireEvent.click(page3Btn);
        expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it('desabilita o botão Próxima na última página', () => {
        render(
            <Pagination
                currentPage={3}
                totalPages={3}
                totalItems={55}
                itemsPerPage={20}
                onPageChange={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /Próxima/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Anterior/i })).not.toBeDisabled();
        expect(screen.getByText('41–55')).toBeInTheDocument();
    });
});
