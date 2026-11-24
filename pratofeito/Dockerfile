# Portabilidade: roda igual em qualquer máquina com Docker.  docker build -t pratofeito . && docker run -p 3000:3000 -v pratofeito-dados:/data pratofeito
FROM node:20-slim
WORKDIR /app
COPY ecommerce-backend/package*.json ./ecommerce-backend/
RUN cd ecommerce-backend && npm install --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["node", "ecommerce-backend/server.js"]
