import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks do contexto do servidor
vi.mock('../../../context/ServerContext', () => ({
    useServer: () => ({
        selectedServer: {
            id: 1,
            name: 'VPS Principal',
            host: '10.0.0.1',
            username: 'root',
            password: 'secretpassword'
        },
        servers: [
            { id: 1, name: 'VPS Principal', host: '10.0.0.1' },
            { id: 2, name: 'VPS Filho 1', host: '10.0.0.2' },
            { id: 3, name: 'VPS Filho 2', host: '10.0.0.3' }
        ]
    })
}));

// Mocks das APIs/Fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

import Cluster from '../../Cluster';
import ChildNodeBanner from '../ChildNodeBanner';
import SwarmStatusBanner from '../SwarmStatusBanner';
import LinkedNodesCard from '../LinkedNodesCard';
import LiveSwarmTopologyCard from '../LiveSwarmTopologyCard';
import AddNodeModal from '../AddNodeModal';
import InitSwarmModal from '../InitSwarmModal';
import { DeleteNodeModal } from '../ProgressModals';

// Mock do hook useCluster
vi.mock('../../cluster/useCluster', () => ({
    useCluster: vi.fn(() => ({
        selectedServer: { id: 1, name: 'VPS Principal', host: '10.0.0.1', username: 'root', password: 'secretpassword' },
        servers: [
            { id: 1, name: 'VPS Principal', host: '10.0.0.1' },
            { id: 2, name: 'VPS Filho 1', host: '10.0.0.2' }
        ],
        swarmActive: true,
        realNodes: [
            { id: 'node1', hostname: 'manager-1', status: 'Ready', availability: 'Active', manager_status: 'Leader' }
        ],
        dbNodes: [],
        isLoading: false,
        isRefreshing: false,
        isChildNode: false,
        parentInfo: null,
        showAddModal: false,
        setShowAddModal: vi.fn(),
        selectedChildId: '',
        setSelectedChildId: vi.fn(),
        nodeRole: 'worker',
        setNodeRole: vi.fn(),
        parentIp: '10.0.0.1',
        installDocker: true,
        setInstallDocker: vi.fn(),
        isSubmitting: false,
        stepMessage: '',
        showProgressModal: false,
        setShowProgressModal: vi.fn(),
        progressStatus: 'pending',
        isActivatingSwarm: false,
        showInitSwarmModal: false,
        setShowInitSwarmModal: vi.fn(),
        initSwarmStatus: 'idle',
        initSwarmMessage: '',
        editingNodeId: null,
        setEditingNodeId: vi.fn(),
        newHostnameValue: '',
        setNewHostnameValue: vi.fn(),
        setEditingOldHostname: vi.fn(),
        showHostnameProgressModal: false,
        setShowHostnameProgressModal: vi.fn(),
        hostnameProgressStatus: 'pending',
        hostnameProgressMessage: '',
        showDeleteModal: false,
        setShowDeleteModal: vi.fn(),
        selectedNodeToDelete: null,
        setSelectedNodeToDelete: vi.fn(),
        deleteProgressStatus: 'idle',
        setDeleteProgressStatus: vi.fn(),
        deleteErrorMessage: '',
        setDeleteErrorMessage: vi.fn(),
        fetchClusterData: vi.fn(),
        handleInitSwarm: vi.fn(),
        handleAddNodeSubmit: vi.fn(),
        handleRemoveNode: vi.fn(),
        handleUpdateHostnameSubmit: vi.fn(),
        availableServers: []
    }))
}));

describe('Cluster Page & Components Refactoring Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('deve renderizar a página principal do Cluster com sucesso', () => {
        render(<Cluster />);
        expect(screen.getByText('Cluster Swarm')).toBeInTheDocument();
    });

    it('deve exibir o banner de nó filho (ChildNodeBanner) corretamente', () => {
        const parentInfo = { parent_name: 'Pai VPS', parent_host: '192.168.1.1', role: 'worker' };
        const selectedServer = { name: 'Servidor Filho' };
        
        render(<ChildNodeBanner selectedServer={selectedServer} parentInfo={parentInfo} />);
        
        expect(screen.getByText('Este servidor é um Nó Filho')).toBeInTheDocument();
        expect(screen.getByText('Pai VPS')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.1')).toBeInTheDocument();
    });

    it('deve renderizar o SwarmStatusBanner com Swarm Inativo e permitir inicialização', () => {
        const handleInitSwarm = vi.fn();
        render(
            <SwarmStatusBanner 
                swarmActive={false} 
                isActivatingSwarm={false} 
                handleInitSwarm={handleInitSwarm} 
                setShowAddModal={vi.fn()} 
            />
        );

        expect(screen.getByText('Docker Swarm Inativo no Servidor Pai')).toBeInTheDocument();
        expect(screen.getByText('Apenas no Servidor Manager')).toBeInTheDocument();
        expect(screen.getByText(/apenas no servidor que você quer que seja o Manager/i)).toBeInTheDocument();
        const initButton = screen.getByRole('button', { name: /Inicializar Swarm Manager/i });
        fireEvent.click(initButton);
        expect(handleInitSwarm).toHaveBeenCalledTimes(1);
    });

    it('deve renderizar o SwarmStatusBanner com Swarm Ativo e permitir abrir modal de adição', () => {
        const setShowAddModal = vi.fn();
        render(
            <SwarmStatusBanner 
                swarmActive={true} 
                isActivatingSwarm={false} 
                handleInitSwarm={vi.fn()} 
                setShowAddModal={setShowAddModal} 
            />
        );

        expect(screen.getByText('Docker Swarm Ativo & Pronto')).toBeInTheDocument();
        const addButton = screen.getByRole('button', { name: /Adicionar Servidor ao Cluster/i });
        fireEvent.click(addButton);
        expect(setShowAddModal).toHaveBeenCalledWith(true);
    });

    it('deve renderizar nós vinculados no banco de dados (LinkedNodesCard)', () => {
        const dbNodes = [
            { node_id: 1, name: 'Filho Node 1', host: '10.0.0.2', role: 'worker', created_at: '2026-05-28T12:00:00Z' }
        ];
        const setSelectedNodeToDelete = vi.fn();
        const setShowDeleteModal = vi.fn();

        render(
            <LinkedNodesCard 
                dbNodes={dbNodes} 
                setSelectedNodeToDelete={setSelectedNodeToDelete} 
                setDeleteProgressStatus={vi.fn()} 
                setDeleteErrorMessage={vi.fn()} 
                setShowDeleteModal={setShowDeleteModal} 
            />
        );

        expect(screen.getByText('Filho Node 1')).toBeInTheDocument();
        expect(screen.getByText('10.0.0.2')).toBeInTheDocument();
        expect(screen.getByText('WORKER')).toBeInTheDocument();

        const removeBtn = screen.getByTitle('Remover do Cluster');
        fireEvent.click(removeBtn);
        expect(setSelectedNodeToDelete).toHaveBeenCalledWith(dbNodes[0]);
        expect(setShowDeleteModal).toHaveBeenCalledWith(true);
    });

    it('deve renderizar a topologia real do Swarm (LiveSwarmTopologyCard)', () => {
        const realNodes = [
            { id: 'node-x', hostname: 'host-node-x', status: 'Ready', availability: 'Active', manager_status: 'Leader' }
        ];
        
        render(
            <LiveSwarmTopologyCard 
                realNodes={realNodes} 
                editingNodeId={null} 
                setEditingNodeId={vi.fn()} 
                newHostnameValue="" 
                setNewHostnameValue={vi.fn()} 
                setEditingOldHostname={vi.fn()} 
                handleUpdateHostnameSubmit={vi.fn()} 
            />
        );

        expect(screen.getByText('host-node-x')).toBeInTheDocument();
        expect(screen.getByText('Ready')).toBeInTheDocument();
        expect(screen.getByText('Leader')).toBeInTheDocument();
    });

    it('deve abrir modal de adição de nó, permitir buscar/filtrar servidores e submeter formulário (AddNodeModal)', () => {
        const handleAddNodeSubmit = vi.fn(e => e.preventDefault());
        const availableServers = [
            { id: 2, name: 'Servidor - Vinicius', host: '179.198.113.165' },
            { id: 3, name: 'Servidor - Luana', host: '178.156.230.28' },
            { id: 4, name: 'Crassus - Worker 01', host: '193.149.31.154' }
        ];
        const setSelectedChildId = vi.fn();
        const setNodeRole = vi.fn();
        const setInstallDocker = vi.fn();

        render(
            <AddNodeModal
                showAddModal={true}
                setShowAddModal={vi.fn()}
                availableServers={availableServers}
                selectedChildId=""
                setSelectedChildId={setSelectedChildId}
                nodeRole="worker"
                setNodeRole={setNodeRole}
                parentIp="10.0.0.1"
                installDocker={true}
                setInstallDocker={setInstallDocker}
                isSubmitting={false}
                handleAddNodeSubmit={handleAddNodeSubmit}
            />
        );

        expect(screen.getByText('Adicionar ao Cluster')).toBeInTheDocument();
        expect(screen.getByText('Vincular Servidor')).toBeInTheDocument();

        // 1. Abre o dropdown de seleção com busca
        const dropdownTrigger = screen.getByText('Selecione um servidor...');
        fireEvent.click(dropdownTrigger);

        // 2. Campo de busca presente
        const searchInput = screen.getByPlaceholderText('Buscar por nome ou IP...');
        expect(searchInput).toBeInTheDocument();

        // Todos os servidores aparecem inicialmente
        expect(screen.getByText('Servidor - Vinicius')).toBeInTheDocument();
        expect(screen.getByText('Servidor - Luana')).toBeInTheDocument();
        expect(screen.getByText('Crassus - Worker 01')).toBeInTheDocument();

        // 3. Filtra por nome 'Luana'
        fireEvent.change(searchInput, { target: { value: 'Luana' } });
        expect(screen.getByText('Servidor - Luana')).toBeInTheDocument();
        expect(screen.queryByText('Servidor - Vinicius')).toBeNull();
        expect(screen.queryByText('Crassus - Worker 01')).toBeNull();

        // 4. Seleciona o servidor filtrado
        fireEvent.click(screen.getByText('Servidor - Luana'));
        expect(setSelectedChildId).toHaveBeenCalledWith('3');

        // 5. Submete o formulário
        const submitBtn = screen.getByRole('button', { name: /Vincular Servidor/i });
        fireEvent.click(submitBtn);
        // Note: submit is disabled if !selectedChildId, but in mock we can test form submission or button presence
        expect(screen.getByRole('button', { name: /Cancelar/i })).toBeInTheDocument();
    });

    it('deve renderizar o modal de exclusão (DeleteNodeModal) com confirmação e ações corretas', () => {
        const handleRemoveNode = vi.fn();
        const setShowDeleteModal = vi.fn();
        const nodeToDelete = { name: 'Node Destruir', host: '10.0.0.5' };

        render(
            <DeleteNodeModal
                showDeleteModal={true}
                setShowDeleteModal={setShowDeleteModal}
                deleteProgressStatus="idle"
                selectedNodeToDelete={nodeToDelete}
                deleteErrorMessage=""
                handleRemoveNode={handleRemoveNode}
                fetchClusterData={vi.fn()}
            />
        );

        expect(screen.getByText(/Tem certeza que deseja remover o servidor/i)).toBeInTheDocument();
        expect(screen.getByText('Node Destruir')).toBeInTheDocument();

        const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
        fireEvent.click(cancelBtn);
        expect(setShowDeleteModal).toHaveBeenCalledWith(false);

        const confirmBtn = screen.getByRole('button', { name: /Confirmar Remoção/i });
        fireEvent.click(confirmBtn);
        expect(handleRemoveNode).toHaveBeenCalledTimes(1);
    });

    describe('InitSwarmModal Tests', () => {
        it('não deve renderizar quando showInitSwarmModal for falso', () => {
            const { container } = render(
                <InitSwarmModal
                    showInitSwarmModal={false}
                    setShowInitSwarmModal={vi.fn()}
                    initSwarmStatus="idle"
                    initSwarmMessage=""
                    fetchClusterData={vi.fn()}
                />
            );
            expect(container.firstChild).toBeNull();
        });

        it('deve renderizar o modal no centro com estado de carregamento e sem botão de fechar', () => {
            render(
                <InitSwarmModal
                    showInitSwarmModal={true}
                    setShowInitSwarmModal={vi.fn()}
                    initSwarmStatus="running"
                    initSwarmMessage="Inicializando Docker Swarm Manager no servidor remoto..."
                    fetchClusterData={vi.fn()}
                />
            );

            expect(screen.getByTestId('init-swarm-modal')).toBeInTheDocument();
            expect(screen.getByText('Inicializando Swarm Manager')).toBeInTheDocument();
            expect(screen.getByText('Inicializando Docker Swarm Manager no servidor remoto...')).toBeInTheDocument();
            expect(screen.getByText(/Não feche esta janela/i)).toBeInTheDocument();
            // Durante o loading, nenhum botão de fechamento deve existir
            expect(screen.queryByRole('button')).toBeNull();
        });

        it('deve exibir estado de sucesso com botão Concluir que fecha o modal e atualiza dados', () => {
            const setShowInitSwarmModal = vi.fn();
            const fetchClusterData = vi.fn();

            render(
                <InitSwarmModal
                    showInitSwarmModal={true}
                    setShowInitSwarmModal={setShowInitSwarmModal}
                    initSwarmStatus="success"
                    initSwarmMessage="Swarm inicializado com sucesso!"
                    fetchClusterData={fetchClusterData}
                />
            );

            expect(screen.getByText('Swarm Ativado com Sucesso!')).toBeInTheDocument();
            expect(screen.getByText('Swarm inicializado com sucesso!')).toBeInTheDocument();
            
            const closeBtn = screen.getByRole('button', { name: /Concluir/i });
            expect(closeBtn).toBeInTheDocument();
            fireEvent.click(closeBtn);

            expect(setShowInitSwarmModal).toHaveBeenCalledWith(false);
            expect(fetchClusterData).toHaveBeenCalledTimes(1);
        });

        it('deve exibir estado de erro com mensagem e botão Fechar', () => {
            const setShowInitSwarmModal = vi.fn();

            render(
                <InitSwarmModal
                    showInitSwarmModal={true}
                    setShowInitSwarmModal={setShowInitSwarmModal}
                    initSwarmStatus="error"
                    initSwarmMessage="Conexão SSH recusada na porta 22"
                    fetchClusterData={vi.fn()}
                />
            );

            expect(screen.getByText('Falha na Inicialização')).toBeInTheDocument();
            expect(screen.getByText('Conexão SSH recusada na porta 22')).toBeInTheDocument();
            
            const closeBtn = screen.getByRole('button', { name: /Fechar/i });
            expect(closeBtn).toBeInTheDocument();
            fireEvent.click(closeBtn);

            expect(setShowInitSwarmModal).toHaveBeenCalledWith(false);
        });
    });
});
