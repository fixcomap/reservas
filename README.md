# fixcomap/reservas

Reservas online para clubes de pádel: los jugadores eligen turno y señan, el dueño gestiona canchas,
precios, turnos fijos y la info del club desde su panel (`/admin`). React (Vite) + Node (Express) +
PostgreSQL. Hoy atiende a un solo club (`CLUB_ID`, por defecto 1).

| Entorno | URL | Rama | Servicio Cloud Run | Base de datos |
|---|---|---|---|---|
| Producción | https://reservas.fixcomap.com | `main` | `reservas` | Neon, base de `reservas-database-url` |
| Desarrollo | https://reservas.dev.fixcomap.com | `develop` | `reservas-dev` | Neon, `reservas_dev` |
| Local | http://localhost:5173 | tu rama | — | docker-compose |

## Estructura

| Ruta | Qué es |
|---|---|
| `apps/api/` | API Express: `src/index.js` (rutas públicas), `src/rutasAdmin.js` (panel), `src/turnos.js` (reglas de turnos), `src/migrar.js` (migraciones al arrancar) |
| `apps/api/scripts/crear-admin.js` | crea un usuario del panel (interactivo) |
| `apps/web/` | front React con Vite; `src/api.js` es el único sitio que habla con la API |
| `db/migrations/` | SQL numerado; se aplica en orden, una vez cada uno |
| `Dockerfile` | un solo contenedor: la API sirve también el front construido |
| `Bocetos/` | diseño de referencia de las pantallas |

## Desarrollo local

Requisitos: Node 22 y Docker.

```sh
cp .env.example .env                         # y poner una POSTGRES_PASSWORD
docker compose up -d                         # Postgres en localhost:5432
(cd apps/api && npm ci && npm run dev)       # API en :3000 (aplica migraciones al arrancar)
(cd apps/web && npm ci && npm run dev)       # front en http://localhost:5173
(cd apps/api && npm run crear-admin)         # usuario para /admin
```

Vite reenvía `/api/*` a la API sacándole el prefijo (`vite.config.js`). En el contenedor es igual:
la API cuelga de `/api` y el resto de rutas son el front.

**Migraciones**: un archivo nuevo en `db/migrations/` con el número siguiente. La API lo aplica al
arrancar (local, desarrollo y producción) y lo anota en `schema_migrations`; nunca se edita una
migración ya aplicada, se agrega otra. Una base local creada por docker-compose antes de
`schema_migrations` se da por migrada; si le faltaba alguna, `docker compose down -v` la recrea.

## Cómo se despliega

Este repo no tiene pipeline propio. `.github/workflows/ci.yml` es el mismo en todos los repos de
fixcomap y llama al pipeline estándar de [`fixcomap/platform`](https://github.com/fixcomap/platform),
que lee [`catalog/reservas.yaml`](https://github.com/fixcomap/platform/blob/main/catalog/reservas.yaml)
para saber qué es este repo (`type: webapp`, `runtime: node`) y cómo desplegarlo.

| Evento | Qué pasa |
|---|---|
| PR a `develop` o `main` | gitflow, gitleaks + trivy, `npm ci` + `lint`/`test`/`build` en `apps/api` y `apps/web`, build de la imagen + trivy (sin publicar) |
| Merge a `develop` | lo anterior + imagen a Artifact Registry, firma cosign y despliegue en `reservas-dev` |
| Merge a `main` | igual sobre `reservas`, tras aprobar el environment `production`; crea el tag `vX.Y.Z` de `VERSION` |

El único check obligatorio es `cicd / ok`. Si un deploy falla, Cloud Run sigue sirviendo la revisión
anterior.

Flujo de ramas (GitFlow):

```sh
git switch develop && git pull && git switch -c feature/<cambio>
# ... cambios, commits "<tipo>(<ámbito>): <descripción>" ...
gh pr create --base develop --fill          # checks en verde, sin aprobación
# probar en reservas.dev.fixcomap.com; para publicar:
git switch develop && git pull && git switch -c release/<x.y.z>
printf '<x.y.z>\n' > VERSION && git commit -am "chore(release): <x.y.z>"
gh pr create --base main --fill             # 1 aprobación (o bypass de admin)
# tras el merge: PR de main a develop (back-merge)
```

## Configuración en Cloud Run

| Variable | Origen |
|---|---|
| `DATABASE_URL_FILE` | secreto `reservas-database-url` (cadena *pooled* de Neon), montado como archivo |
| `DB_NAME` | catálogo: `reservas_dev` en desarrollo; en producción, la base de la cadena |
| `PORT`, `NODE_ENV`, `WEB_DIST`, `MIGRATIONS_DIR` | `Dockerfile` |
| `K_SERVICE` | Cloud Run; activa `trust proxy` (IP real del cliente para el límite de intentos de login) |

`/health` responde 200 sin tocar la base (lo usa Cloud Run para saber que arrancó); `/api/salud` hace
`SELECT 1`. Si la base no responde al arrancar, la migración falla y el contenedor termina: el deploy
falla y sigue la revisión anterior.

Cargar o rotar la cadena de conexión (nunca pasa por el repo):

```sh
printf '%s' 'postgresql://USER:PASS@HOST/reservas?sslmode=require' | \
  gcloud secrets versions add reservas-database-url --project fixcomap-core --data-file=-
```

Crear un usuario del panel en desarrollo o producción, desde tu máquina:

```sh
gcloud secrets versions access latest --secret reservas-database-url --project fixcomap-core > /tmp/db-url
cd apps/api && DATABASE_URL_FILE=/tmp/db-url DB_NAME=reservas_dev npm run crear-admin   # sin DB_NAME: producción
rm /tmp/db-url
```
