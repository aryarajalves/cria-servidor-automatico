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

    it('deve abrir modal de adição de nó e permitir submeter formulário (AddNodeModal)', () => {
        const handleAddNodeSubmit = vi.fn(e => e.preventDefault());
        const availableServers = [{ id: 2, name: 'VPS Filho 1', host: '10.0.0.2' }];
        const setSelectedChildId = vi.fn();
        const setNodeRole = vi.fn();
        const setInstallDocker = vi.fn();

        render(
            <AddNodeModal
                showAddModal={true}
                setShowAddModal={vi.fn()}
                availableServers={availableServers}
                selectedChildId="2"
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

        expect(screen.getByText('Vincular Servidor')).toBeInTheDocument();
        
        const submitBtn = screen.getByRole('button', { name: /Vincular Servidor/i });
        fireEvent.click(submitBtn);
        expect(handleAddNodeSubmit).toHaveBeenCalledTimes(1);
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
});
