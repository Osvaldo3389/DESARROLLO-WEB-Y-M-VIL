# Imagen única para todos los servicios Node (cada contenedor ejecuta su propio index.js)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY shared ./shared
COPY services ./services
COPY gateway ./gateway
COPY graphql-gateway ./graphql-gateway
COPY sandbox ./sandbox
COPY scripts ./scripts
COPY db ./db
ENV NODE_ENV=production SECRET_PROVIDER=file SECRETS_DIR=/run/secrets HOST=0.0.0.0
USER node
CMD ["node", "--version"]
