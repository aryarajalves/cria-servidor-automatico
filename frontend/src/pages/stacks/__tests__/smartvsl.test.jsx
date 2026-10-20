import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { apps } from '../constants';
import { getInstallEndpoint, prefillAppFields } from '../stackHelpers';
import AppCard from '../AppCard';

describe('SmartVSL Integration Tests', () => {
    it('deve possuir a definição de smartvsl em apps com stackName clone-vturb e campos corretos', () => {
        const app = apps.find(a => a.id === 'smartvsl');
        expect(app).toBeDefined();
        expect(app.name).toBe('SmartVSL');
        expect(app.category).toBe('custom');
        expect(app.stackName).toBe('clone-vturb');
        expect(app.version).toBe('1.1.4');
        
        const fieldNames = app.fields.map(f => f.name);
        expect(fieldNames).toContain('frontend_domain');
        expect(fieldNames).toContain('backend_domain');
        expect(fieldNames).toContain('postgres_password');
    });

    it('getInstallEndpoint deve retornar rota correta para smartvsl', () => {
        expect(getInstallEndpoint('smartvsl')).toBe('/install-smartvsl');
    });

    it('prefillAppFields deve preencher domínios do smartvsl a partir de envVars e stackUrls', () => {
        const app = apps.find(a => a.id === 'smartvsl');
        const envVars = {
            VITE_API_BASE_URL: 'https://turb-back.example.com',
            POSTGRES_PASSWORD: 'pg_secret_vsl'
        };
        const prefilled = prefillAppFields(app, 'clone-vturb', { 'clone-vturb': ['turb-front.example.com', 'turb-back.example.com'] }, envVars, {});
        
        const frontField = prefilled.find(f => f.name === 'frontend_domain');
        const backField = prefilled.find(f => f.name === 'backend_domain');
        const pgField = prefilled.find(f => f.name === 'postgres_password');

        expect(frontField.defaultValue).toBe('turb-front.example.com');
        expect(backField.defaultValue).toBe('turb-back.example.com');
        expect(pgField.defaultValue).toBe('pg_secret_vsl');
    });

    it('deve renderizar o card do SmartVSL na interface com nome correto', () => {
        const app = apps.find(a => a.id === 'smartvsl');
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
            version: '1.1.4'
        };

        render(<AppCard {...props} />);
        expect(screen.getByText('SmartVSL')).toBeInTheDocument();
        expect(screen.getByText('Instalar')).toBeInTheDocument();
    });
});
