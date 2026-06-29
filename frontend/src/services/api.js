import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para adicionar o token JWT em cada requisição
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('app_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor para tratar respostas globais de erro (ex: 401 Unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn('Sessão expirada ou não autorizada. Limpando credenciais...');
            localStorage.removeItem('app_auth');
            localStorage.removeItem('app_token');
            localStorage.removeItem('selected_server');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        console.error('API Error:', error.response || error.message);
        return Promise.reject(error);
    }
);

export default api;
