# AutoServer Deployer 🚀

O **AutoServer Deployer** é um sistema SaaS de orquestração e deploy automatizado para servidores VPS, projetado para configurar infraestruturas prontas para produção de forma extremamente simplificada e robusta. Utilizando **Docker Swarm** e **Traefik**, a plataforma transforma uma VPS recém-criada (Debian 13) em um cluster resiliente com SSL automático, proxy reverso, e deploying de aplicativos em segundos.

---

## 🛠️ Arquitetura e Tecnologias

A aplicação segue o padrão de desenvolvimento web moderno com as seguintes tecnologias principais:

- **Backend (API)**: Python 3.10+, FastAPI (com Uvicorn), SQLAlchemy (SQLite como banco local padrão), Paramiko (para comunicação e automação SSH segura com servidores remotos) e Pytest para automação de testes.
- **Frontend (SPA)**: React 18+, Vite, CSS customizado altamente polido (Glassmorphism e estética premium Neon/Modo Escuro), Tailwind CSS para utilitários de espaçamento, Axios para chamadas HTTP e Vitest para testes unitários de interface.
- **Orquestração & Infraestrutura**: Docker Swarm (modo cluster), Traefik (Proxy Reverso com SSL LetsEncrypt automatizado), Redes Overlay virtuais (`network_swarm_public`) garantindo isolamento e segurança entre as stacks de aplicativos.

---

## 🌟 Principais Funcionalidades

1. **Conexão e Inicialização de VPS via SSH**:
   - Conexão simplificada usando IP e senha ou chave SSH.
   - Instalação automatizada do Docker e ativação do modo **Docker Swarm Manager**.
   - Criação automática da rede overlay pública `network_swarm_public`.
   - Instalação automatizada do `ctop` (monitor de recursos de containers no terminal).

2. **Gerenciamento de DNS via Cloudflare**:
   - Integração completa via API da Cloudflare para criar e gerenciar registros de DNS (tipo `A` e `CNAME`).
   - Apontamento automático do domínio principal e subdomínios curinga (`*.dominio.com`) para a VPS.
   - Validação em tempo real de status dos domínios.

3. **Deploy de Stacks Remoto em Um Clique**:
   - Geração automática de credenciais seguras e aleatórias para bancos de dados e serviços auxiliares.
   - Implantação e gerenciamento de ciclo de vida completo de aplicações de terceiros e autorais.
   - Desinstalação limpa com exclusão total dos containers e volumes para liberação de espaço.

---

## 📦 Stacks Suportadas

O AutoServer Deployer divide as stacks em duas categorias para melhor controle de governança:

### 🌐 Stacks Gerais (Infraestrutura e Serviços)
- **Traefik**: O cérebro do cluster. Atua como proxy reverso, roteando o tráfego da porta 80 e 443 com geração de certificado SSL SSL/TLS LetsEncrypt automática de forma totalmente transparente.
- **Portainer**: Interface web moderna para administração visual do Docker Swarm (serviços, volumes, containers e logs).
- **PostgreSQL**: Servidor de banco de dados SQL padrão do sistema de alta performance, gerado com credenciais dinâmicas exclusivas.
- **Redis**: Armazenamento em cache chave-valor na memória de altíssima velocidade para sessões e filas das aplicações.
- **RabbitMQ**: Message broker (mensageria) robusto utilizado para o enfileiramento assíncrono de tarefas pesadas.
- **MinIO S3**: Armazenamento de objetos compatível com Amazon S3 de alta velocidade com API e Console Web.
- **Chatwoot (Admin & Sidekiq)**: Plataforma premium de atendimento omnichannel que unifica canais (WhatsApp, Instagram, Chat). A stack instala a API administrativa e os workers Sidekiq de processamento em segundo plano de forma otimizada.

### 🚀 Aplicativos Próprios / Autorais
- **AgenteFlow (AI Agent Manager)**: Módulo autoral que gerencia e conecta fluxos complexos de agentes inteligentes de Inteligência Artificial para automação de atendimento e processos corporativos.
- **ZapVoice**: Ferramenta premium de disparo em massa utilizando a API oficial do WhatsApp, permitindo a criação de funis de atendimento complexos de alta conversão.
- **Gerenciador de Grupos do WhatsApp**: Sistema inteligente de distribuição de leads, monitoramento, aquecimento e administração em lote de múltiplos grupos de WhatsApp para lançamentos e funis perenes.
- **Backup Chatwoot & RabbitMQ**: Automação periódica e backup resiliente para banco de dados e filas de mensagens.
- **Oráculo**: Sistema inteligente de monitoramento, métricas e auditoria.
- **Formulário Personalizado**: Construtor de formulários interativos com integração webhook e coleta de leads.
- **SmartVSL**: Plataforma de vídeo de vendas de alta conversão com controle de retenção.
- **Smart Academy**: Plataforma completa de área de membros, cursos e treinamentos.

---

## 🚀 Como Iniciar o Projeto Localmente

### Pré-requisitos
- Docker e Docker Compose instalados na sua máquina de desenvolvimento local.

### Subindo com Docker Compose (Recomendado)
Para subir o ambiente completo (Backend na porta `8005` e Frontend na porta `5500` com suporte completo a Hot-Reload):

```bash
# Inicie os containers recriando-os e limpando o cache
docker compose -f docker-compose-local.yml up -d --build --force-recreate
```

### Inicialização Manual (Sem Docker)

#### 1. Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python run.py
```
*Disponível em: `http://localhost:8000`*

#### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
*Disponível na porta de desenvolvimento do Vite (ex: `http://localhost:5173`)*

---

## 🧪 Validação e Testes Unitários

O projeto possui uma rígida suíte de testes que deve sempre ser mantida 100% verde antes de qualquer commit ou push.

### Rodar Testes do Backend (Pytest)
```bash
cd backend
pytest -v
```

### Rodar Testes do Frontend (Vitest)
```bash
cd frontend
npm test
```

---

## 🔒 Regras de Negócio e Segurança
- **Segurança CORS (Cross-Origin Resource Sharing)**: O backend modular do FastAPI está configurado para aceitar requisições de qualquer origem (`"*"`) localmente no desenvolvimento. Nas stacks reais (como AgenteFlow e ZapVoice), o CORS é dinâmico e restringe acessos em nível de navegador apenas para o domínio do frontend configurado (`{DOMAIN_FRONTEND}`).
- **Rate Limiting**: Atualmente as APIs de orquestração local não possuem limitadores de requisição ativos em código (como slowapi/Redis). A proteção de taxa de requisições de produção deve ser configurada diretamente no proxy reverso do Traefik ou na CDN (ex: Cloudflare).
- Todas as rotas administrativas exigem autenticação de usuário e validação estrita de `client_id` para prevenção de **IDOR** (Insecure Direct Object Reference).
- Nunca armazene ou exiba segredos em logs ou telas sem a devida máscara.
- As variáveis de ambiente devem ser configuradas usando o `.env` baseado no `.env.example`.

---

## 🛡️ Auditoria Automatizada de Bibliotecas Externas

O projeto conta com um sistema completo de auditoria contínua de segurança tanto para o **Backend (Python)** quanto para o **Frontend (Node.js)**:

1. **GitHub Actions CI/CD (.github/workflows/audit-dependencies.yml)**:
   - Disparado automaticamente em todo push ou pull_request na branch main (ou manualmente via workflow_dispatch).
   - Audita o Backend com pip-audit contra o banco oficial de vulnerabilidades (PyPA / OSV).
   - Audita o Frontend com 
pm audit.
   - Gera um resumo com tabelas detalhadas diretamente no **GitHub Step Summary** e armazena o artefato 
elatorio-auditoria-dependencias.

2. **Script de Auditoria Unificado Local (ackend/scripts/audit_dependencies.py)**:
   - Executa a auditoria completa em segundos na sua máquina de desenvolvimento.
   - Suporta flags como --fail-on=critical|high|moderate, --output-file e --github-summary.
   `ash
   python backend/scripts/audit_dependencies.py
   `

3. **Hook de Git Pré-Push (.git/hooks/pre-push)**:
   - Pode ser instalado com um comando simples:
   `ash
   python backend/scripts/setup_git_hooks.py
   `
   - Impede ou avisa sobre vulnerabilidades antes mesmo de autorizar o git push.
