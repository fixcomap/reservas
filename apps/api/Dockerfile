# Imagen de la API para Cloud Run. Se construye desde apps/api:
#   docker build -t reservas-api apps/api
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# Solo dependencias de producción, instaladas exactas desde el lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Código (lo que no se copia está en .dockerignore). Queda de root y solo lectura para la app.
COPY src ./src

# Usuario sin privilegios que ya trae la imagen oficial de Node
USER node

EXPOSE 8080
CMD ["node", "src/index.js"]
