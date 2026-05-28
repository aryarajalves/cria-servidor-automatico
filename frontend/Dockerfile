# Usar uma imagem oficial do Node.js
FROM node:18-slim

# Definir o diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o restante do código do frontend
COPY . .

# Expor a porta desejada
EXPOSE 5500

# Comando para rodar o servidor de desenvolvimento
# O --host é necessário para o Docker mapear a porta corretamente
CMD ["npm", "run", "dev", "--", "--host", "--port", "5500"]
