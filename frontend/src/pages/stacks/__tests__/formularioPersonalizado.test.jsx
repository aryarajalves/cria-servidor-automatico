import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { apps } from '../constants';
import { getInstallEndpoint, prefillAppFields } from '../stackHelpers';
import AppCard from '../AppCard';

describe('Formulário Personalizado Integration Tests', () => {
    it('deve possuir a definição de formulario_personalizado em apps com campos corretos', () => {
        const app = apps.find(a => a.id === 'formulario_personalizado');
        expect(app).toBeDefined();
        expect(app.name).toBe('Formulário Personalizado');
        expect(app.category).toBe('custom');
        expect(app.stackName).toBe('formulario-personalizado');
        
        const fieldNames = app.fields.map(f => f.name);
        expect(fieldNames).toContain('frontend_domain');
        expect(fieldNames).toContain('backend_domain');
        expect(fieldNames).toContain('postgres_password');
    });

    it('getInstallEndpoint deve retornar rota correta para formulario_personalizado', () => {
        expect(getInstallEndpoint('formulario_personalizado')).toBe('/install-formulario-personalizado');
    });

    it('prefillAppFields deve preencher dominios do formulario_personalizado a partir de envVars e stackUrls', () => {
        const app = apps.find(a => a.id === 'formulario_personalizado');
        const envVars = {
            API_DOMAIN: 'api-forms.example.com',
            FRONTEND_DOMAIN: 'forms.example.com',
            POSTGRES_PASSWORD: 'pg_secret_123'
        };
        const prefilled = prefillAppFields(app, 'formulario-personalizado', {}, envVars, {});
        
        const frontField = prefilled.find(f => f.name === 'frontend_domain');
        const backField = prefilled.find(f => f.name === 'backend_domain');
        const pgField = prefilled.find(f => f.name === 'postgres_password');

        expect(frontField.defaultValue).toBe('forms.example.com');
        expect(backField.defaultValue).toBe('api-forms.example.com');
        expect(pgField.defaultValue).toBe('pg_secret_123');
    });

    it('deve renderizar o card do Formulário Personalizado na interface com botões de ação', () => {
        const app = apps.find(a => a.id === 'formulario_personalizado');
        const props = {
            stack: app,
            onInstall: vi.fn(),
            onRestart: vi.fn(),
            onUninstall: vi.fn(),
            isInstalled: false,
            disabled: false,
            disabledMessage: '',
            urls: [],
            credentials: null,
            onUpdateCredentials: vi.fn(),
            onOpenChatAdmin: vi.fn(),
            onUpdateDomain: vi.fn(),
            onMarkExternal: vi.fn(),
            getActualStackName: vi.fn(() => null),
            version: '1.0.1'
        };

        render(<AppCard {...props} />);
        expect(screen.getByText('Formulário Personalizado')).toBeInTheDocument();
        expect(screen.getByText('Instalar')).toBeInTheDocument();
    });
});
