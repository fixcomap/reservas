# Despliegue

| Parte | Dónde | URL |
|---|---|---|
| Front (`apps/web`) | Cloudflare Pages | https://reservas.fixcomap.com |
| API (`apps/api`) | Google Cloud Run | https://api-reservas.fixcomap.com |
| Base de datos | Neon (Postgres con SSL) | — |

El desarrollo local no cambia: `docker compose up -d` y `npm run dev` en `apps/api` y `apps/web` (ver README).

---

## 1. Variables de entorno

Nunca subas valores al repositorio. Las secretas conviene cargarlas en **Secret Manager** y referenciarlas desde Cloud Run.

### API (Cloud Run)

| Variable | Obligatoria | Secreta | Valor / para qué |
|---|---|---|---|
| `NODE_ENV` | sí | no | `production` (ya viene en la imagen) |
| `DATABASE_URL` | sí | **sí** | connection string de Neon, la **pooled** (host con `-pooler`). Siempre se conecta con SSL verificado |
| `FRONT_URL` | sí | no | `https://reservas.fixcomap.com`: vuelta de Mercado Pago y único origen aceptado por CORS |
| `API_URL` | sí | no | `https://api-reservas.fixcomap.com`: con esta se arma la URL del webhook |
| `MP_ACCESS_TOKEN` | sí | **sí** | access token de Mercado Pago |
| `MP_WEBHOOK_SECRET` | sí | **sí** | clave secreta de los webhooks de Mercado Pago |
| `PORT` | — | — | **no la cargues**: la define Cloud Run |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `MAIL_FROM` | no | no | servidor de mails (`SMTP_HOST` vacío = no se mandan mails) |
| `SMTP_PASS` | no | **sí** | contraseña SMTP |
| `CLUB_ID` | no | no | club que muestra la app (por defecto `1`) |
| `PROXIES_CONFIABLES` | no | no | solo si ponés un balanceador externo de Google delante (ver punto 6) |

Si falta una obligatoria, la API no arranca y el log de Cloud Run dice cuál (sin mostrar valores):

```
Configuración inválida: Faltan variables de entorno obligatorias: MP_WEBHOOK_SECRET
```

### Front (Cloudflare Pages → Settings → Variables, entorno *Production*)

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://api-reservas.fixcomap.com` (obligatoria: el build falla sin ella) |
| `VITE_DEMO` | `true` para mostrar el cartel "Versión de demostración"; vacía o ausente para ocultarlo |
| `NODE_VERSION` | `22` (Vite 8 necesita Node 20.19+ o 22.12+) |

Las variables `VITE_*` quedan **dentro del JavaScript público**: nunca pongas secretos ahí. Si cambiás una, hay que volver a hacer el deploy.

---

## 2. Cloudflare Pages (front)

Conectá el repositorio y configurá:

| Campo | Valor |
|---|---|
| Framework preset | None (o Vite) |
| Root directory | `apps/web` |
| Build command | `npm run build` |
| Build output directory | `dist` |

- `apps/web/public/_redirects` hace que `/admin`, `/admin/...` y `/reserva/<token>` carguen `index.html`, y React decide qué mostrar. Además, como no hay `404.html`, Pages ya trata el sitio como una SPA.
- `apps/web/public/_headers` agrega cabeceras de seguridad al front.
- Dominio: en el proyecto de Pages → Custom domains → `reservas.fixcomap.com`.

---

## 3. Imagen de la API

El `Dockerfile` está en `apps/api`, y el contexto de build es esa carpeta. El `.env` está en la raíz del repo, así que ni siquiera entra en el contexto, y además `.dockerignore` lo excluye.

Con Docker en tu PC (PowerShell):

```powershell
docker build --platform linux/amd64 -t REGION-docker.pkg.dev/PROYECTO/REPO/reservas-api:v1 apps/api
docker push REGION-docker.pkg.dev/PROYECTO/REPO/reservas-api:v1
```

O con Cloud Build, sin Docker local:

```powershell
gcloud builds submit apps/api --tag REGION-docker.pkg.dev/PROYECTO/REPO/reservas-api:v1
```

Después, el deploy en Cloud Run con esa imagen, las variables del punto 1 y **"Allow unauthenticated"** (es una API pública). Puerto del contenedor: 8080 (Cloud Run lo pasa en `PORT`).

Probar la imagen en local sin base real:

```powershell
docker run --rm -p 8080:8080 -e DATABASE_URL=postgresql://u:p@db.invalid/x -e FRONT_URL=https://reservas.fixcomap.com -e API_URL=https://api-reservas.fixcomap.com -e MP_ACCESS_TOKEN=x -e MP_WEBHOOK_SECRET=x reservas-api:v1
# http://localhost:8080/salud responde {"ok":false} (no hay base): la API arrancó
```

---

## 4. Migraciones contra Neon

Las migraciones están en `db/migrations` y se aplican en orden con `npm run migrar`. Cada una corre en su transacción y queda anotada en la tabla `schema_migraciones`, así que correrlo de nuevo solo aplica las pendientes.

Se corren **desde tu PC**, con la connection string **directa** de Neon (la que **no** tiene `-pooler`: la migración usa un lock de sesión que PgBouncer no soporta).

```powershell
cd apps\api
$env:DATABASE_URL = Read-Host "Connection string directa de Neon"   # no queda en el historial
npm.cmd run migrar
```

Datos de demostración (un club ficticio con 2 canchas; solo si la base no tiene ningún club):

```powershell
npm.cmd run demo
```

> Para un club real, en vez de `npm run demo` cargá la fila en `clubes` (y sus `canchas` y `horarios_apertura`) desde la consola SQL de Neon, y después los datos públicos desde Ajustes en el panel.

Al terminar, borrá la variable de la sesión:

```powershell
Remove-Item Env:DATABASE_URL
```

Las migraciones se corren **antes** de desplegar una versión de la API que las necesite.

---

## 5. Crear el admin

Con la misma `DATABASE_URL` del punto 4 en la sesión de PowerShell (necesita que exista el club 1):

```powershell
cd apps\api
npm.cmd run crear-admin
```

Pide email y contraseña por consola (mínimo 12 caracteres, no se muestra). Después entrá a https://reservas.fixcomap.com/admin.

---

## 6. Proxy e IP real del cliente

La API está detrás de **Cloudflare → Google (Cloud Run)**. Para que el límite de intentos de login y de consultas cuente **por usuario**, Express toma la IP real de `X-Forwarded-For` (ver `apps/api/src/proxy.js`):

- Cada proxy agrega a la derecha de `X-Forwarded-For` la IP desde la que le llegó el pedido. Express recorre la lista de derecha a izquierda y se queda con la primera IP en la que no confía.
- Confía solo en el salto que le entrega el pedido al contenedor (Google), en las IPs publicadas de Cloudflare y en lo que pongas en `PROXIES_CONFIABLES`.
- Lo que escriba el cliente en `X-Forwarded-For` queda a la izquierda y no se usa. Si alguien entra directo a la URL `*.run.app` sin pasar por Cloudflare, se usa la IP que vio Google, que es la suya.
- En local no se confía en ningún proxy (igual que antes).

**Si ponés un balanceador externo de Google** (Application Load Balancer) delante de Cloud Run, ese balanceador agrega su propia IP. Cargala en `PROXIES_CONFIABLES` (por ejemplo `34.1.2.3`), o todos los usuarios van a contar como uno solo.

**Cómo verificar después del deploy:** pedí dos veces `https://api-reservas.fixcomap.com/reservas/estado/x` y mirá la cabecera `RateLimit-Remaining`: tiene que bajar (29, 28...). Desde otra red (por ejemplo, el celular con datos) tiene que arrancar de nuevo en 29. Si desde dos redes distintas baja el mismo contador, hay un proxy más en el medio que hay que agregar a `PROXIES_CONFIABLES`.

**Rangos de Cloudflare:** están copiados en `proxy.js` desde https://www.cloudflare.com/ips/. Cambian muy rara vez, pero conviene revisarlos de vez en cuando.

---

## 7. Mercado Pago

- **URL de retorno:** `FRONT_URL/reserva/<token>`. Se manda en cada orden.
- **Webhook:** `API_URL/webhooks/mercadopago`, o sea `https://api-reservas.fixcomap.com/webhooks/mercadopago`. La API de Órdenes no documenta una URL de notificación por orden, así que se carga en el panel: Tus integraciones → tu aplicación → Webhooks → evento **Order**. Al arrancar, la API muestra en el log la URL exacta que hay que cargar. La clave secreta que da Mercado Pago va en `MP_WEBHOOK_SECRET`.
- Para cobrar de verdad, usá las credenciales de **producción**, no las del vendedor de prueba.

---

## Checklist

1. Neon: crear la base → `npm run migrar` (+ `npm run demo` si es demo) → `npm run crear-admin`.
2. Cloud Run: imagen + variables → mapear `api-reservas.fixcomap.com`.
3. Cloudflare Pages: root `apps/web`, build `npm run build`, salida `dist`, `VITE_API_URL` → dominio `reservas.fixcomap.com`.
4. Mercado Pago: webhook `https://api-reservas.fixcomap.com/webhooks/mercadopago` → `MP_WEBHOOK_SECRET`.
5. Probar: reservar un turno, pagar, volver a `/reserva/<token>`, entrar a `/admin`, y verificar la IP real (punto 6).
