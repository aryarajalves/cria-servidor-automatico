import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { apps } from '../constants';
import { getInstallEndpoint, prefillAppFields } from '../stackHelpers';
import AppCard from '../AppCard';

describe('Smart Academy Integration Tests', () => {
    it('deve possuir a definição de smartacademy em apps com stackName gestao-aulas e campos corretos', () => {
        const app = apps.find(a => a.id === 'smartacademy');
        expect(app).toBeDefined();
        expect(app.name).toBe('Smart Academy');
        expect(app.category).toBe('custom');
        expect(app.stackName).toBe('gestao-aulas');
        expect(app.version).toBe('1.1.1');
        
        const fieldNames = app.fields.map(f => f.name);
        expect(fieldNames).toContain('frontend_domain');
        expect(fieldNames).toContain('backend_domain');
        expect(fieldNames).toContain('openai_api_key');
        expect(fieldNames).toContain('postgres_password');
    });

    it('getInstallEndpoint deve retornar rota correta para smartacademy', () => {
        expect(getInstallEndpoint('smartacademy')).toBe('/install-smartacademy');
    });

    it('prefillAppFields deve preencher domínios do smartacademy a partir de envVars e stackUrls', () => {
        const app = apps.find(a => a.id === 'smartacademy');
        const envVars = {
            API_DOMAIN: 'aulas-back.example.com',
            FRONTEND_DOMAIN: 'aulas-front.example.com',
            OPENAI_API_KEY: 'sk-proj-test123',
            POSTGRES_PASSWORD: 'pg_secret_academy'
        };
        const prefilled = prefillAppFields(app, 'gestao-aulas', { 'gestao-aulas': ['aulas-back.example.com', 'aulas-front.example.com'] }, envVars, {});
        
        const frontField = prefilled.find(f => f.name === 'frontend_domain');
        const backField = prefilled.find(f => f.name === 'backend_domain');
        const openaiField = prefilled.find(f => f.name === 'openai_api_key');
        const pgField = prefilled.find(f => f.name === 'postgres_password');

        expect(frontField.defaultValue).toBe('aulas-front.example.com');
        expect(backField.defaultValue).toBe('aulas-back.example.com');
        expect(openaiField.defaultValue).toBe('sk-proj-test123');
        expect(pgField.defaultValue).toBe('pg_secret_academy');
    });

    it('deve renderizar o card do Smart Academy na interface com nome correto', () => {
        const app = apps.find(a => a.id === 'smartacademy');
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
            version: '1.1.1'
        };

        render(<AppCard {...props} />);
        expect(screen.getByText('Smart Academy')).toBeInTheDocument();
        expect(screen.getByText('Instalar')).toBeInTheDocument();
    });
});
