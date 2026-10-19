# Imagen de la API para Cloud Run. Se construye desde apps/api:
#   docker build -t reservas-api apps/api

# Etapa de dependencias: npm solo se usa acá para instalar
FROM node:24-alpine AS dependencias

WORKDIR /app

# Solo dependencias de producción, instaladas exactas desde el lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Etapa final: solo node, las dependencias y el código
FROM node:24-alpine

ENV NODE_ENV=production \
    PORT=8080

# En ejecución no se usan gestores de paquetes: afuera npm, npx, yarn y corepack (y sus vulnerabilidades)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/corepack

WORKDIR /app

# Dependencias y código (lo que no se copia está en .dockerignore). Quedan de root y solo lectura para la app.
COPY --from=dependencias /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Usuario sin privilegios que ya trae la imagen oficial de Node
USER node

EXPOSE 8080
# node directo (sin npm start) para que reciba SIGTERM y haga el apagado ordenado
CMD ["node", "src/index.js"]
