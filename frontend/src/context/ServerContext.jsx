import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const ServerContext = createContext();

export const ServerProvider = ({ children }) => {
    // Autenticação mestre da aplicação (Login via ENV)
    const [appUser, setAppUser] = useState(() => {
        const saved = localStorage.getItem('app_auth');
        return saved ? JSON.parse(saved) : null;
    });

    // Servidores VPS cadastrados
    const [servers, setServers] = useState([]);
    
    // Servidor VPS atualmente selecionado/ativo
    const [selectedServer, setSelectedServer] = useState(() => {
        const saved = localStorage.getItem('selected_server');
        return saved ? JSON.parse(saved) : null;
    });

    const [isGlobalLoading, setIsGlobalLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);

    // Carrega servidores do backend ao logar na aplicação instantaneamente
    useEffect(() => {
        if (appUser) {
            fetchServers();
        } else {
            setIsInitializing(false);
        }
    }, [appUser]);

    const fetchServers = async () => {
        try {
            const response = await api.get('/servers');
            setServers(response.data);
            
            // Se tiver servidores mas nenhum selecionado, seleciona o primeiro
            if (response.data.length > 0 && !selectedServer) {
                handleSelectServer(response.data[0]);
            }
        } catch (error) {
            console.error('Erro ao buscar servidores:', error);
        } finally {
            setIsInitializing(false);
        }
    };

    const loginApp = (email, token) => {
        const userData = { email, loggedAt: new Date().toISOString() };
        setAppUser(userData);
        localStorage.setItem('app_auth', JSON.stringify(userData));
        if (token) {
            localStorage.setItem('app_token', token);
        }
    };

    const logoutApp = () => {
        setAppUser(null);
        setSelectedServer(null);
        localStorage.removeItem('app_auth');
        localStorage.removeItem('app_token');
        localStorage.removeItem('selected_server');
    };

    const handleSelectServer = (server) => {
        setSelectedServer(server);
        localStorage.setItem('selected_server', JSON.stringify(server));
    };

    const addServerToList = (newServer) => {
        setServers(prev => [...prev, newServer]);
        handleSelectServer(newServer);
    };

    const deleteServerFromList = async (id) => {
        try {
            await api.delete(`/servers/${id}`);
            setServers(prev => prev.filter(s => s.id !== id));
            if (selectedServer?.id === id) {
                const remaining = servers.filter(s => s.id !== id);
                handleSelectServer(remaining.length > 0 ? remaining[0] : null);
            }
        } catch (error) {
            console.error('Erro ao deletar servidor:', error);
        }
    };

    const updateServerInList = (id, data) => {
        setServers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
        if (selectedServer?.id === id) {
            const updated = { ...selectedServer, ...data };
            setSelectedServer(updated);
            localStorage.setItem('selected_server', JSON.stringify(updated));
        }
    };

    const clearSelectedServer = () => {
        setSelectedServer(null);
        localStorage.removeItem('selected_server');
    };

    return (
        <ServerContext.Provider value={{ 
            appUser, 
            loginApp, 
            logoutApp, 
            servers, 
            selectedServer, 
            selectServer: handleSelectServer,
            clearSelectedServer,
            refreshServers: fetchServers,
            addServerToList,
            deleteServerFromList,
            updateServerInList,
            isGlobalLoading,
            setIsGlobalLoading,
            isInitializing
        }}>
            {children}
        </ServerContext.Provider>
    );
};

export const useServer = () => useContext(ServerContext);
