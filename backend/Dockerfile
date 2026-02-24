FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/uploads/documentos

# Garante permissão de execução no entrypoint
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
