import axios from 'axios';

// ---- Log de debug (horário de Brasília + nível), visível no console do navegador ----
const formatBRT = () => {
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(new Date()).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return `${parts.day}/${parts.month}/${parts.year.slice(-2)} ${parts.hour}:${parts.minute}:${parts.second}`;
};

const CONSOLE_FN = { DEBUG: console.debug, INFO: console.info, WARNING: console.warn, ERROR: console.error };

const log = (level, message, ...args) => {
    const fn = CONSOLE_FN[level] || console.log;
    fn(`[${formatBRT()} BRT] [${level}] [frontend]`, message, ...args);
};

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000',
    timeout: 120000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para adicionar o token JWT e logar a saída de cada requisição
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('app_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        config.metadata = { startTime: Date.now() };
        log('DEBUG', `-> ${config.method?.toUpperCase()} ${config.url}`, config.params || config.data || '');
        return config;
    },
    (error) => {
        log('ERROR', 'Falha ao montar requisição:', error.message);
        return Promise.reject(error);
    }
);

// Interceptor para logar a resposta (sucesso ou erro) e tratar casos globais (ex: 401)
api.interceptors.response.use(
    (response) => {
        const durationMs = Date.now() - (response.config.metadata?.startTime || Date.now());
        log('INFO', `<- ${response.config.method?.toUpperCase()} ${response.config.url} | status=${response.status} | ${durationMs}ms`);
        return response;
    },
    (error) => {
        const config = error.config || {};
        const durationMs = Date.now() - (config.metadata?.startTime || Date.now());
        const status = error.response?.status;

        if (status === 401 && !config.url?.includes('/verify-connection') && !config.url?.includes('/login')) {
            log('WARNING', 'Sessão expirada ou não autorizada. Limpando credenciais...');
            localStorage.removeItem('app_auth');
            localStorage.removeItem('app_token');
            localStorage.removeItem('selected_server');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }

        log(
            'ERROR',
            `<- ${config.method?.toUpperCase()} ${config.url} | status=${status ?? 'sem resposta'} | ${durationMs}ms`,
            error.response?.data || error.message
        );
        return Promise.reject(error);
    }
);

export default api;
