# Usar uma imagem oficial e leve do Python como base
FROM python:3.11-slim

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /app

# Instalar dependências do sistema necessárias para o Paramiko (se houver)
RUN apt-get update && apt-get install -y \
    gcc \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar o arquivo de dependências primeiro para aproveitar o cache do Docker
COPY requirements.txt .

# Instalar as dependências listadas no requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o código do backend
# Como este Dockerfile está na raiz, copiamos a pasta backend
COPY backend/ /app/

# Expor a porta 8000
EXPOSE 8000

# Comando padrão para iniciar a aplicação
# De acordo com o run.py, ele usa uvicorn internamente
CMD ["python", "run.py"]
