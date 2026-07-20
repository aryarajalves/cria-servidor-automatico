import { Box, Database, MessageSquare, Globe, HardDrive, MessageCircle, Zap } from 'lucide-react';

export const apps = [
    {
        id: "traefik",
        stackName: "traefik",
        category: "standard",
        name: "Traefik Proxy",
        description: "Proxy reverso moderno com SSL automático via Cloudflare.",
        icon: Globe,
        version: "v2.10",
        colorBg: "bg-blue-600/10",
        colorText: "text-blue-500",
        fields: [
            { name: "email", label: "Email para Let's Encrypt", placeholder: "seu@email.com", type: "email" }
        ]
    },
    {
        id: "portainer",
        stackName: "portainer",
        category: "standard",
        name: "Portainer",
        description: "Interface web para gerenciar seus containers e clusters.",
        icon: HardDrive,
        version: "CE",
        colorBg: "bg-blue-500/10",
        colorText: "text-blue-500",
        fields: [
            { name: "portainer_host", label: "Domínio do Portainer", placeholder: "Selecione o domínio...", type: "dns_record" }
        ]
    },
    {
        id: "redis",
        stackName: "redis",
        category: "standard",
        name: "Redis",
        description: "Armazenamento de estrutura de dados em memória.",
        icon: Database,
        version: "7.2",
        colorBg: "bg-red-500/10",
        colorText: "text-red-500"
    },
    {
        id: "postgres",
        stackName: "postgres",
        category: "standard",
        name: "PostgreSQL",
        description: "Banco de dados relacional robusto e open source.",
        icon: Database,
        version: "16.1",
        colorBg: "bg-blue-600/10",
        colorText: "text-blue-400",
        fields: []
    },
    {
        id: "rabbitmq",
        stackName: "rabbitmq",
        category: "standard",
        name: "RabbitMQ",
        description: "Message broker robusto e escalável.",
        icon: MessageCircle,
        version: "3.12",
        colorBg: "bg-orange-500/10",
        colorText: "text-orange-500",
        fields: [
            { name: "rabbit_user", label: "Usuário Admin", placeholder: "admin", required: false },
            { name: "rabbit_password", label: "Senha Admin", placeholder: "admin", type: "password", required: false },
            { name: "rabbit_base_url", label: "Domínio do RabbitMQ", placeholder: "Selecione o domínio...", type: "dns_record" }
        ]
    },
    {
        id: "minio",
        stackName: "minio",
        category: "standard",
        name: "MinIO S3",
        description: "Servidor de armazenamento de objetos compatível com S3 de alta performance.",
        icon: HardDrive,
        version: "RELEASE.2025-02-07",
        colorBg: "bg-amber-600/10",
        colorText: "text-amber-500",
        fields: [
            { name: "minio_server_url", label: "Domínio da API S3 (Público)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "minio_console_url", label: "Domínio do Console (Privado)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "minio_root_user", label: "Usuário Admin (Root)", placeholder: "unwind", required: false },
            { name: "minio_root_password", label: "Senha Admin (Root)", placeholder: "SuaSenhaAqui", type: "password", required: false }
        ]
    },
    {
        id: "ai_agent_manager",
        stackName: "agentes",
        category: "custom",
        name: "Gerente de Agente de IA",
        description: "Interface completa para gerenciamento de agentes de IA com Backend e Frontend.",
        icon: Zap,
        version: "1.0.0",
        colorBg: "bg-purple-600/10",
        colorText: "text-purple-500",
        fields: [
            { name: "domain_backend", label: "Domínio do API (Backend)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "domain_frontend", label: "Domínio da Interface (Frontend)", placeholder: "Selecione o domínio...", type: "dns_record" },
        ]
    },
    {
        id: "zapvoice",
        stackName: "zapvoice",
        category: "custom",
        name: "ZapVoice",
        description: "Plataforma completa para automação e mensagens de voz.",
        icon: MessageCircle,
        version: "3.6.2",
        colorBg: "bg-blue-600/10",
        colorText: "text-blue-500",
        fields: [
            { name: "chatwoot_base_url", label: "Domínio do ZapVoice", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "postgres_password", label: "Senha Postgres (opcional)", placeholder: "Auto-preenchimento ou vazio...", type: "password", required: false },
        ]
    },
    {
        id: "gerenciador_whatsapp",
        stackName: "gerenciador_whatsapp",
        category: "custom",
        name: "Gerenciador Grupo WhatsApp",
        description: "Sistema completo para gerenciamento de grupos de WhatsApp.",
        icon: MessageCircle,
        version: "1.4.3",
        colorBg: "bg-emerald-600/10",
        colorText: "text-emerald-500",
        fields: [
            { name: "backend_domain", label: "Domínio do API (Backend)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "frontend_domain", label: "Domínio da Interface (Frontend)", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "postgres_password", label: "Senha Postgres (opcional)", placeholder: "Auto-preenchimento ou vazio...", type: "password", required: false },
        ]
    },
    {
        id: "backup_chatwoo_rabbit",
        stackName: "backup_chatwoo_rabbit",
        category: "custom",
        name: "Backup",
        description: "Gerenciador de backup automático do RabbitMQ e do sistema integrado com S3.",
        icon: HardDrive,
        version: "1.0.0",
        colorBg: "bg-amber-500/10",
        colorText: "text-amber-500",
        fields: [
            { name: "base_url", label: "Domínio do Painel", placeholder: "Selecione o domínio...", type: "dns_record" },
        ]
    },
    {
        id: "oraculo",
        stackName: "oraculo",
        category: "custom",
        name: "Oraculo",
        description: "Criação automatizada de carrosséis de alta conversão usando Inteligência Artificial.",
        icon: Zap,
        version: "1.0.6",
        colorBg: "bg-blue-600/10",
        colorText: "text-blue-500",
        fields: [
            { name: "oraculo_domain", label: "Domínio do Oráculo", placeholder: "Selecione o domínio...", type: "dns_record" },
            { name: "openai_api_key", label: "OpenAI API Key (Opcional)", placeholder: "sk-...", type: "password", required: false },
            { name: "gemini_api_key", label: "Gemini API Key (Opcional)", placeholder: "AIzaSy...", type: "password", required: false },
            { name: "anthropic_api_key", label: "Anthropic API Key (Opcional)", placeholder: "sk-ant-...", type: "password", required: false },
            { name: "fal_key", label: "Fal.ai Key (Opcional)", placeholder: "fal-...", type: "password", required: false },
            { name: "elevenlabs_api_key", label: "ElevenLabs API Key (Opcional)", placeholder: "", type: "password", required: false },
        ]
    },
];
