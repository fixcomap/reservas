# Un solo contenedor (contrato del pipeline estándar de fixcomap/platform): la
# API de Express sirve también el front ya construido por Vite, con la API bajo
# /api igual que el proxy de Vite en desarrollo.

FROM node:22-slim AS web
WORKDIR /src/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web ./
RUN npm run build

FROM node:22-slim AS api
WORKDIR /app/apps/api
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps/api/src ./src
COPY apps/api/scripts ./scripts

# distroless: solo node, sin shell ni gestor de paquetes; menos superficie
# para trivy y para un atacante.
FROM gcr.io/distroless/nodejs22-debian13:nonroot
ENV NODE_ENV=production \
    PORT=8080 \
    WEB_DIST=/app/apps/web/dist \
    MIGRATIONS_DIR=/app/db/migrations
COPY --from=api /app/apps/api /app/apps/api
COPY --from=web /src/apps/web/dist /app/apps/web/dist
COPY db/migrations /app/db/migrations
WORKDIR /app/apps/api
USER nonroot:nonroot
EXPOSE 8080
CMD ["src/index.js"]
