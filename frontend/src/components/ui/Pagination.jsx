import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Componente reutilizável de paginação com suporte a navegação por páginas,
 * limite de itens por página e exibição de resumo de contagem.
 */
const Pagination = ({
    currentPage = 1,
    totalPages = 1,
    totalItems = 0,
    itemsPerPage = 20,
    onPageChange,
    itemName = 'item'
}) => {
    if (totalItems === 0 || totalPages <= 1) {
        return null;
    }

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    // Gera lista de páginas com reticências para navegação limpa
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) {
                pages.push('...');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }
            if (!pages.includes(totalPages)) pages.push(totalPages);
        }

        return pages;
    };

    const pages = getPageNumbers();

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 px-1 border-t border-white/5">
            {/* Resumo de itens */}
            <div className="text-xs text-slate-400 font-medium">
                Mostrando <span className="font-semibold text-slate-200">{startItem}–{endItem}</span> de{' '}
                <span className="font-semibold text-slate-200">{totalItems}</span> {itemName}{totalItems > 1 ? '(s)' : ''}
            </div>

            {/* Controles de navegação */}
            <div className="flex items-center gap-1.5">
                {/* Botão Anterior */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900/60 border border-white/5 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-900/60 disabled:hover:text-slate-300 transition-all cursor-pointer"
                    aria-label="Página anterior"
                >
                    <ChevronLeft size={16} />
                    <span className="hidden sm:inline">Anterior</span>
                </button>

                {/* Números das páginas */}
                <div className="flex items-center gap-1">
                    {pages.map((p, idx) => {
                        if (p === '...') {
                            return (
                                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-500 text-xs font-bold">
                                    ...
                                </span>
                            );
                        }

                        const isActive = p === currentPage;
                        return (
                            <button
                                key={`page-${p}`}
                                type="button"
                                onClick={() => onPageChange(p)}
                                className={`min-w-[36px] h-9 flex items-center justify-center px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-500'
                                        : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white'
                                }`}
                                aria-label={`Página ${p}`}
                                aria-current={isActive ? 'page' : undefined}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>

                {/* Botão Próximo */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900/60 border border-white/5 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-900/60 disabled:hover:text-slate-300 transition-all cursor-pointer"
                    aria-label="Próxima página"
                >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
