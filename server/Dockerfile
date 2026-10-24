# API de Saldo a Favor. Contexto de build: raíz del repo.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY src/mock/tiposConflicto.json src/mock/bibliotecaLegal.json ./data/
ENV DATA_DIR=/app/data PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "src/index.js"]
