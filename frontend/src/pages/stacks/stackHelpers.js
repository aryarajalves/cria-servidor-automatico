/**
 * Funções auxiliares para instalação e configuração de Stacks no painel.
 */

export const getInstallEndpoint = (appId) => {
    switch (appId) {
        case 'traefik': return '/install-traefik';
        case 'portainer': return '/install-portainer';
        case 'redis': return '/install-redis';
        case 'postgres': return '/install-postgres';
        case 'rabbitmq': return '/install-rabbitmq';
        case 'minio': return '/install-minio';
        case 'ai_agent_manager': return '/install-ai-agent-manager';
        case 'zapvoice': return '/install-zapvoice';
        case 'gerenciador_whatsapp': return '/install-gerenciador-whatsapp';
        case 'formulario_personalizado': return '/install-formulario-personalizado';
        case 'smartvsl': return '/install-smartvsl';
        case 'smartacademy': return '/install-smartacademy';
        case 'oraculo': return '/install-oraculo';
        case 'backup_chatwoo_rabbit': return '/install-backup-chatwoo-rabbit';
        default: throw new Error("App desconhecido");
    }
};

export const validateAppDependencies = (appId, activeStacks) => {
    if (appId === 'ai_agent_manager') {
        const hasPostgres = Array.isArray(activeStacks) && activeStacks.some(s => s.trim() === 'postgres');
        const hasRabbit = Array.isArray(activeStacks) && activeStacks.some(s => s.trim() === 'rabbitmq');
        const hasMinio = Array.isArray(activeStacks) && activeStacks.some(s => s.trim() === 'minio');
        const hasZapvoice = Array.isArray(activeStacks) && activeStacks.some(s => s.trim() === 'zapvoice');

        if (!hasPostgres || !hasRabbit || !hasMinio || !hasZapvoice) {
            const missing = [];
            if (!hasPostgres) missing.push('PostgreSQL');
            if (!hasRabbit) missing.push('RabbitMQ');
            if (!hasMinio) missing.push('MinIO');
            if (!hasZapvoice) missing.push('ZapVoice');
            return {
                valid: false,
                message: `Não é possível instalar o Gerente de Agente de IA. As seguintes dependências obrigatórias estão ausentes no servidor: ${missing.join(', ')}. Por favor, instale-as primeiro.`
            };
        }
    }
    return { valid: true };
};

export const prefillAppFields = (app, actualStackName, stackUrls = {}, envVars = {}, stackCredentials = {}) => {
    if (!app.fields || app.fields.length === 0) return [];
    const appId = app.id;

    return app.fields.map(f => {
        let val = '';

        if (f.type === 'dns_record') {
            const urls = stackUrls[actualStackName] || [];
            if (appId === 'ai_agent_manager') {
                if (f.name === 'domain_backend') {
                    val = envVars.VITE_API_URL || envVars.CORS_ALLOWED_ORIGINS || urls[0] || '';
                } else if (f.name === 'domain_frontend') {
                    val = envVars.FRONTEND_URL || urls[1] || urls[0] || '';
                }
            } else if (appId === 'gerenciador_whatsapp') {
                if (f.name === 'backend_domain') {
                    val = envVars.BACKEND_DOMAIN || envVars.VITE_API_URL || urls[0] || '';
                } else if (f.name === 'frontend_domain') {
                    val = envVars.FRONTEND_DOMAIN || urls[1] || urls[0] || '';
                }
            } else if (appId === 'formulario_personalizado') {
                if (f.name === 'backend_domain') {
                    val = envVars.API_DOMAIN || urls[1] || urls[0] || '';
                } else if (f.name === 'frontend_domain') {
                    val = envVars.FRONTEND_DOMAIN || urls[0] || '';
                }
            } else if (appId === 'smartvsl') {
                if (f.name === 'backend_domain') {
                    val = envVars.VITE_API_BASE_URL || urls[1] || urls[0] || '';
                } else if (f.name === 'frontend_domain') {
                    val = urls[0] || '';
                }
            } else if (appId === 'smartacademy') {
                if (f.name === 'backend_domain') {
                    val = envVars.API_DOMAIN || urls[0] || '';
                } else if (f.name === 'frontend_domain') {
                    val = envVars.FRONTEND_DOMAIN || urls[1] || urls[0] || '';
                }
            } else {
                val = urls[0] || '';
            }

            if (val) {
                val = val.replace('https://', '').replace('http://', '').replace('/api', '').replace('/ws', '').split(',')[0].trim();
            }
        } else {
            const fieldNameUpper = f.name.toUpperCase();
            if (envVars[fieldNameUpper] !== undefined) {
                val = envVars[fieldNameUpper];
            } else if (envVars[f.name] !== undefined) {
                val = envVars[f.name];
            } else if (f.name === 'postgres_password') {
                val = envVars.POSTGRES_PASSWORD || f.defaultValue || '';
            } else if (f.name === 'super_admin_email') {
                val = envVars.SUPER_ADMIN_EMAIL || '';
            } else if (f.name === 'openai_api_key') {
                val = envVars.OPENAI_API_KEY || '';
            } else if (f.name === 'rabbit_user') {
                val = envVars.RABBITMQ_DEFAULT_USER || stackCredentials[actualStackName]?.user || '';
            } else if (f.name === 'rabbit_password') {
                val = envVars.RABBITMQ_DEFAULT_PASS || stackCredentials[actualStackName]?.password || '';
            }
        }

        return val ? { ...f, defaultValue: val } : f;
    });
};
