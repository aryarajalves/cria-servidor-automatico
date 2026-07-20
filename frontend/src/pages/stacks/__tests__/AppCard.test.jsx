import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppCard from '../AppCard';

describe('AppCard Component Tests', () => {
    const defaultProps = {
        stack: {
            id: 'chatwoot',
            stackName: 'chatwoot',
            name: 'Chatwoot',
            colorBg: 'bg-emerald-500/10',
            colorText: 'text-emerald-500',
            description: 'Plataforma de engajamento do cliente.',
            icon: () => <span>ChatwootIcon</span>
        },
        onInstall: vi.fn(),
        onRestart: vi.fn(),
        onUninstall: vi.fn(),
        isInstalled: true,
        disabled: false,
        disabledMessage: '',
        urls: [],
        credentials: { user: 'admin', password: 'password123' },
        onUpdateCredentials: vi.fn(),
        onOpenChatAdmin: vi.fn(),
        onUpdateDomain: vi.fn(),
        onMarkExternal: vi.fn(),
        getActualStackName: vi.fn(name => name),
        version: '3.x'
    };

    it('deve renderizar o botao Definir Link/Dominio para apps padrao instalados sem URL', () => {
        render(<AppCard {...defaultProps} />);
        expect(screen.getByText('Definir Link/Domínio')).toBeInTheDocument();
    });

    it('nao deve renderizar o botao Definir Link/Dominio para PostgreSQL instalado mesmo sem URL', () => {
        const postgresProps = {
            ...defaultProps,
            stack: {
                ...defaultProps.stack,
                id: 'postgres',
                stackName: 'postgres',
                name: 'PostgreSQL'
            }
        };
        render(<AppCard {...postgresProps} />);
        expect(screen.queryByText('Definir Link/Domínio')).not.toBeInTheDocument();
    });

    it('nao deve renderizar o botao Definir Link/Dominio para Redis instalado mesmo sem URL', () => {
        const redisProps = {
            ...defaultProps,
            stack: {
                ...defaultProps.stack,
                id: 'redis',
                stackName: 'redis',
                name: 'Redis'
            }
        };
        render(<AppCard {...redisProps} />);
        expect(screen.queryByText('Definir Link/Domínio')).not.toBeInTheDocument();
    });

    it('nao deve renderizar o botao Definir Link/Dominio para Traefik instalado mesmo sem URL', () => {
        const traefikProps = {
            ...defaultProps,
            stack: {
                ...defaultProps.stack,
                id: 'traefik',
                stackName: 'traefik',
                name: 'Traefik Proxy'
            }
        };
        render(<AppCard {...traefikProps} />);
        expect(screen.queryByText('Definir Link/Domínio')).not.toBeInTheDocument();
    });
});
