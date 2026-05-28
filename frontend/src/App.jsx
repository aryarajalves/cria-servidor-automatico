import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ServerProvider, useServer } from './context/ServerContext';
import Layout from './components/Layout';
import Connect from './pages/Connect';
import Stacks from './pages/Stacks';
import Dashboard from './pages/Dashboard';
import CloudflareDNS from './pages/CloudflareDNS';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Cluster from './pages/Cluster';

// Protected Route for the Application itself
const ProtectedRoute = ({ children }) => {
    const { appUser } = useServer();
    if (!appUser) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

// Protected Route for VPS dependent pages
const VPSProtectedRoute = ({ children }) => {
    const { selectedServer, isInitializing } = useServer();
    
    // Se ainda estiver inicializando a lista de servidores, não redireciona
    if (isInitializing) {
        return null; // Ou um loading leve, mas o Dashboard já trata isso
    }

    if (!selectedServer) {
        return <Navigate to="/connect" replace />;
    }
    return children;
};

function App() {
    return (
        <ServerProvider>
            <BrowserRouter>
                <Routes>
                    {/* Public Route */}
                    <Route path="/login" element={<Login />} />

                    {/* App Routes with Layout */}
                    <Route path="/*" element={
                        <ProtectedRoute>
                            <Layout>
                                <Routes>
                                    <Route path="/connect" element={<Connect />} />
                                    
                                    <Route path="/" element={
                                        <VPSProtectedRoute>
                                            <Dashboard />
                                        </VPSProtectedRoute>
                                    } />

                                    <Route path="/stacks" element={
                                        <VPSProtectedRoute>
                                            <Stacks />
                                        </VPSProtectedRoute>
                                    } />

                                    <Route path="/dns" element={
                                        <VPSProtectedRoute>
                                            <CloudflareDNS />
                                        </VPSProtectedRoute>
                                    } />

                                    <Route path="/settings" element={
                                        <VPSProtectedRoute>
                                            <Settings />
                                        </VPSProtectedRoute>
                                    } />

                                    <Route path="/cluster" element={
                                        <VPSProtectedRoute>
                                            <Cluster />
                                        </VPSProtectedRoute>
                                    } />

                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </Layout>
                        </ProtectedRoute>
                    } />
                </Routes>
            </BrowserRouter>
        </ServerProvider>
    );
}

export default App;
