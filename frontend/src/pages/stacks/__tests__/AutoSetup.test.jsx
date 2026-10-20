import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AutoSetupModal from '../AutoSetupModal';
import AutoSetupProgressModal from '../AutoSetupProgressModal';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

describe('AutoSetup Modal & Progress Component Tests', () => {
    const mockServer = {
        id: 1,
        name: 'Servidor - Teste',
        host: '10.0.0.1',
        username: 'root'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        api.post.mockImplementation((url) => {
            if (url.includes('/cloudflare/zones')) {
                return Promise.resolve({
                    data: {
                        zones: [
                            { id: 'zone1', name: 'agency10x.com.br' },
                            { id: 'zone2', name: 'aryaraj.shop' }
                        ]
                    }
                });
            }
            if (url.includes('/cloudflare/records')) {
                return Promise.resolve({
                    data: {
                        records: [
                            { name: 'portainer.agency10x.com.br', type: 'A', content: '10.0.0.1' },
                            { name: 's3.agency10x.com.br', type: 'A', content: '10.0.0.1' },
                            { name: 'other.agency10x.com.br', type: 'A', content: '192.168.1.1' }
                        ]
                    }
                });
            }
            return Promise.resolve({ data: {} });
        });
    });

    it('deve renderizar o modal AutoSetupModal com título e opções padrão selecionadas', () => {
        render(
            <AutoSetupModal
                isOpen={true}
                onClose={vi.fn()}
                onStartSetup={vi.fn()}
                selectedServer={mockServer}
            />
        );

        expect(screen.getByText('Setup Automático do Servidor')).toBeInTheDocument();
        expect(screen.getByText('Docker Engine')).toBeInTheDocument();
        expect(screen.getByText('Ativar Swarm')).toBeInTheDocument();
        expect(screen.getByText('Rede Overlay')).toBeInTheDocument();
        expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
        expect(screen.getByText('MinIO S3')).toBeInTheDocument();
        expect(screen.getByText('Iniciar Instalação Automatizada')).toBeInTheDocument();
    });

    it('deve exibir campos de configuração do MinIO S3 ao marcar o checkbox', () => {
        render(
            <AutoSetupModal
                isOpen={true}
                onClose={vi.fn()}
                onStartSetup={vi.fn()}
                selectedServer={mockServer}
            />
        );

        const minioCheckbox = screen.getByText('MinIO S3').closest('label').querySelector('input[type="checkbox"]');
        expect(minioCheckbox).not.toBeChecked();

        fireEvent.click(minioCheckbox);
        expect(minioCheckbox).toBeChecked();

        expect(screen.getByText('Configuração de Domínios do MinIO S3')).toBeInTheDocument();
        expect(screen.getByText(/Domínio da API S3/)).toBeInTheDocument();
        expect(screen.getByText(/Domínio do Console/)).toBeInTheDocument();
    });

    it('deve abrir dropdown de DNS da Cloudflare filtrando registros pelo IP do servidor', async () => {
        render(
            <AutoSetupModal
                isOpen={true}
                onClose={vi.fn()}
                onStartSetup={vi.fn()}
                selectedServer={mockServer}
            />
        );

        // Aguarda carregar as zonas
        await waitFor(() => {
            expect(api.post).toHaveBeenCalledWith('/cloudflare/zones', expect.anything());
        });

        // Encontra o botão de abrir o dropdown no campo do Portainer
        const dropdownBtns = screen.getAllByTitle('Selecionar DNS da Cloudflare');
        expect(dropdownBtns.length).toBeGreaterThan(0);
        fireEvent.click(dropdownBtns[0]);

        // Verifica que o dropdown abriu listando os registros que apontam para o IP do servidor
        expect(await screen.findByText('portainer.agency10x.com.br')).toBeInTheDocument();
        expect(screen.getAllByText('Este Servidor').length).toBeGreaterThan(0);

        // Clica no registro para selecioná-lo
        fireEvent.click(screen.getByText('portainer.agency10x.com.br'));

        // Verifica que o valor foi preenchido no input
        const domainInput = screen.getByPlaceholderText('ex: portainer.meudominio.com');
        expect(domainInput.value).toBe('portainer.agency10x.com.br');
    });

    it('deve listar todos os aplicativos próprios na seção 4 para escolha do usuário', () => {
        render(
            <AutoSetupModal
                isOpen={true}
                onClose={vi.fn()}
                onStartSetup={vi.fn()}
                selectedServer={mockServer}
            />
        );

        expect(screen.getByText('SmartVSL')).toBeInTheDocument();
        expect(screen.getByText('Smart Academy')).toBeInTheDocument();
        expect(screen.getByText('Formulário Personalizado')).toBeInTheDocument();
        expect(screen.getByText('Gerente de Agente de IA')).toBeInTheDocument();
        expect(screen.getByText('ZapVoice')).toBeInTheDocument();
        expect(screen.getByText('Gerenciador Grupo WhatsApp')).toBeInTheDocument();
        expect(screen.getByText('Backup')).toBeInTheDocument();
        expect(screen.getByText('Oraculo')).toBeInTheDocument();
    });

    it('deve exibir erro de validação se Portainer estiver marcado sem domínio preenchido', async () => {
        const onStartSetup = vi.fn();
        render(
            <AutoSetupModal
                isOpen={true}
                onClose={vi.fn()}
                onStartSetup={onStartSetup}
                selectedServer={mockServer}
            />
        );

        const submitBtn = screen.getByText('Iniciar Instalação Automatizada');
        fireEvent.click(submitBtn);

        expect(await screen.findByText('Por favor, informe o domínio de acesso do Portainer.')).toBeInTheDocument();
        expect(onStartSetup).not.toHaveBeenCalled();
    });

    it('deve validar campos obrigatórios de aplicativo próprio selecionado', async () => {
        const onStartSetup = vi.fn();
        render(
            <AutoSetupModal
                isOpen={true}
                onClose={vi.fn()}
                onStartSetup={onStartSetup}
                selectedServer={mockServer}
            />
        );

        // Preenche portainer para passar da 1ª validação
        const domainInput = screen.getByPlaceholderText('ex: portainer.meudominio.com');
        fireEvent.change(domainInput, { target: { value: 'portainer.meudominio.com' } });

        // Marca SmartVSL
        const smartvslCheckbox = screen.getByText('SmartVSL').closest('label').querySelector('input[type="checkbox"]');
        fireEvent.click(smartvslCheckbox);

        // Clica em enviar sem preencher domínios do SmartVSL
        const submitBtn = screen.getByText('Iniciar Instalação Automatizada');
        fireEvent.click(submitBtn);

        expect(await screen.findByText(/Por favor, preencha o campo/)).toBeInTheDocument();
        expect(onStartSetup).not.toHaveBeenCalled();
    });

    it('deve disparar onStartSetup com payload correto incluindo aplicativo próprio configurado', async () => {
        const onStartSetup = vi.fn();
        render(
            <AutoSetupModal
                isOpen={true}
                onClose={vi.fn()}
                onStartSetup={onStartSetup}
                selectedServer={mockServer}
            />
        );

        const domainInput = screen.getByPlaceholderText('ex: portainer.meudominio.com');
        fireEvent.change(domainInput, { target: { value: 'portainer.meudominio.com' } });

        // Seleciona e preenche ZapVoice
        const zapvoiceCheckbox = screen.getByText('ZapVoice').closest('label').querySelector('input[type="checkbox"]');
        fireEvent.click(zapvoiceCheckbox);

        const zapDomainInput = screen.getByPlaceholderText('Selecione o domínio...');
        fireEvent.change(zapDomainInput, { target: { value: 'zap.meudominio.com' } });

        const submitBtn = screen.getByText('Iniciar Instalação Automatizada');
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(onStartSetup).toHaveBeenCalledTimes(1);
        });

        const payload = onStartSetup.mock.calls[0][0];
        expect(payload.host).toBe('10.0.0.1');
        expect(payload.install_docker).toBe(true);
        expect(payload.portainer_domain).toBe('portainer.meudominio.com');
        expect(payload.custom_apps).toHaveLength(1);
        expect(payload.custom_apps[0].id).toBe('zapvoice');
        expect(payload.custom_apps[0].params.chatwoot_base_url).toBe('zap.meudominio.com');
    });

    it('deve renderizar AutoSetupProgressModal com as etapas e logs em tempo real', async () => {
        api.get.mockResolvedValueOnce({
            data: {
                status: 'running',
                current_step: 'Instalando Docker Engine...',
                step_index: 1,
                total_steps: 3,
                steps: [
                    { id: 'docker', title: 'Docker Engine', status: 'running' },
                    { id: 'swarm', title: 'Ativar Swarm', status: 'pending' },
                    { id: 'network', title: 'Rede Overlay', status: 'pending' }
                ],
                logs: ['[13:00:00] Iniciando setup...']
            }
        });

        render(
            <AutoSetupProgressModal
                isOpen={true}
                onClose={vi.fn()}
                selectedServer={mockServer}
            />
        );

        expect(await screen.findByText('Instalando Infraestrutura e Stacks...')).toBeInTheDocument();
        expect(screen.getByText('Instalando Docker Engine...')).toBeInTheDocument();
        expect(screen.getByText('[13:00:00] Iniciando setup...')).toBeInTheDocument();
    });
});
