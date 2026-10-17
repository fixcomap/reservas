# reservas

Sistema de reservas online para clubes de pádel — React, Node y PostgreSQL.

El jugador elige día, horario y cancha, paga la seña (o el total) con Mercado Pago y recibe la confirmación por mail. El dueño del club ve la agenda del día, carga reservas a mano, maneja turnos fijos y ajusta precios desde un panel con login.

---

## Qué tiene

### Para el jugador
- **Elegir turno**: selector de los próximos 7 días, grilla de horarios libres y lista de canchas disponibles para ese horario. Los turnos que ya pasaron no se muestran.
- **Información del club**: dirección con mapa de Google, horarios, WhatsApp, Instagram y servicios (vestuario, estacionamiento, bar…).
- **Confirmar reserva**: elige pagar **seña** o **total**, y carga nombre, WhatsApp y email.
- **Pago con Mercado Pago** (Checkout Pro): el turno queda retenido **15 minutos** mientras paga.
- **Link secreto de la reserva** (`/reserva/<token>`): adonde vuelve desde Mercado Pago. Muestra si el turno quedó confirmado, si el pago está pendiente (con botón "Actualizar"), si fue rechazado o si se le devolvió la plata.
- **Mail de confirmación** con fecha, cancha, dirección, lo pagado y lo que queda por pagar en el club.

### Para el dueño (`/admin`)
- **Login** con email y contraseña (sesión de 8 horas, límite de intentos).
- **Agenda del día**: grilla por cancha y horario con colores según el tipo (online, a mano, turno fijo, bloqueo), línea de "hora actual" y resumen: reservas del día, **señas cobradas** y turnos libres.
- **Detalle de cada turno**: datos del cliente, link a WhatsApp, estado del pago y monto pagado.
- **Cargar reservas a mano** (las que llegan por WhatsApp o en persona), **bloquear** turnos y **cancelar** reservas.
- **Turnos fijos**: un cliente que juega todas las semanas el mismo día y hora, con fecha de inicio y de fin. Se puede liberar una fecha puntual o desactivar el fijo.
- **Pagos para devolver**: aviso rojo arriba de la agenda cuando un reembolso automático falló, con botón para reintentarlo.
- **Ajustes**: precio de cada cancha, porcentaje de seña y datos del club (dirección, mapa, contacto, servicios).

---

## Tecnologías

| Parte | Qué usa |
|---|---|
| Front (`apps/web`) | React 19 + Vite, sin router ni librerías de UI |
| API (`apps/api`) | Node + Express 5 (CommonJS) |
| Base de datos | PostgreSQL 16 en Docker |
| Pagos | Mercado Pago, Checkout Pro vía la **API de Órdenes** (`/v1/orders`) |
| Mails | nodemailer por SMTP; en desarrollo, Mailpit |

```
reservas/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── index.js              rutas públicas (disponibilidad, club, reservas, estado, webhook)
│   │   │   ├── rutasAdmin.js         rutas del panel (/admin/*)
│   │   │   ├── turnos.js             grilla de turnos, lock por cancha, vencimientos
│   │   │   ├── pagos.js              verificarPago(): decide si una reserva está paga
│   │   │   ├── mercadopago.js        cliente de la API de Órdenes
│   │   │   ├── webhookMercadoPago.js aviso de Mercado Pago con validación de firma
│   │   │   ├── mail.js               mail de confirmación
│   │   │   ├── auth.js               contraseñas y sesiones del panel
│   │   │   └── db.js                 conexión a Postgres
│   │   └── scripts/crear-admin.js
│   └── web/
│       └── src/
│           ├── pantallas/            elegir turno, confirmar, estado de la reserva
│           └── admin/                panel del dueño
├── db/migrations/                    001 a 009, se aplican en orden
├── Bocetos/                          diseño de las pantallas
└── docker-compose.yml                Postgres + Mailpit
```

---

## Cómo levantarlo (Windows)

Requisitos: **Node 20+** y **Docker Desktop**. En PowerShell, si `npm` falla por la política de scripts, usá `npm.cmd`.

### 1. Variables de entorno

Copiá `.env.example` a `.env` en la raíz y completalo:

| Variable | Para qué |
|---|---|
| `POSTGRES_PASSWORD` | contraseña de la base (la que quieras) |
| `MP_ACCESS_TOKEN` | access token de Mercado Pago (empieza con `APP_USR-`) |
| `MP_PUBLIC_KEY` | public key de Mercado Pago |
| `MP_WEBHOOK_SECRET` | clave secreta de los webhooks; vacía = el webhook responde 503 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | servidor de mails; `SMTP_HOST` vacío = no se mandan mails |
| `MAIL_FROM` | remitente, ej: `Club Demo <reservas@club.test>` |
| `FRONT_URL` *(opcional)* | adonde vuelve el jugador después de pagar; por defecto `http://localhost:5173` |

Para desarrollo con Mailpit: `SMTP_HOST=localhost` y `SMTP_PORT=1025`.

> El `.env` está en `.gitignore`: nunca lo subas al repositorio.

### 2. Base de datos y Mailpit

```powershell
docker compose up -d
```

La **primera vez** (volumen vacío), Postgres aplica solo todas las migraciones de `db/migrations`. Si la base ya existía, cada migración nueva se aplica a mano:

```powershell
Get-Content db\migrations\009_email.sql | docker compose exec -T db psql -U reservas -d reservas
```

### 3. Instalar y arrancar

En dos terminales:

```powershell
cd apps\api
npm.cmd install
npm.cmd run dev        # API en http://localhost:3000
```

```powershell
cd apps\web
npm.cmd install
npm.cmd run dev        # Front en http://localhost:5173
```

El front le pasa todo lo que empieza con `/api` a la API (proxy de Vite), así que no hay que configurar CORS.

Si cambiás el `.env`, reiniciá la API (Ctrl+C y `npm.cmd run dev` de nuevo).

### 4. Crear el usuario del dueño

```powershell
cd apps\api
npm.cmd run crear-admin
```

Pide email y contraseña por consola (mínimo 12 caracteres; nunca como argumento, para que no quede en el historial). Después entrá a http://localhost:5173/admin.

### Direcciones

| Qué | Dónde |
|---|---|
| App del jugador | http://localhost:5173 |
| Panel del dueño | http://localhost:5173/admin |
| Estado de una reserva | http://localhost:5173/reserva/&lt;token&gt; (llega desde Mercado Pago) |
| Mails de desarrollo (Mailpit) | http://localhost:8025 |
| API | http://localhost:3000 |

---

## Cómo funciona el pago

1. El jugador toca **"Pagar seña/total con Mercado Pago"**. La API crea la reserva **retenida por 15 minutos**, con los montos calculados en el servidor a partir del precio guardado (nunca del pedido del navegador).
2. La API crea una **orden** en Mercado Pago (`POST /v1/orders`) por ese monto, en ARS, con `external_reference` = id de la reserva, vencimiento de 15 minutos e idempotency key. Si Mercado Pago falla, la reserva se cancela y se responde 502.
3. El jugador paga y vuelve a `/reserva/<token>`. La API **le pregunta a Mercado Pago por la orden** y confirma solo si está pagada, el monto coincide exacto y la moneda es ARS.
4. Si el pago llega **después de los 15 minutos**:
   - si el turno sigue libre, se confirma igual;
   - si ya lo tomó otro, se **devuelve el pago completo** automáticamente. Si la devolución falla, queda como "reembolso pendiente" y el dueño la ve en el panel.
5. Al confirmarse, sale el **mail de confirmación** (una sola vez).

Toda la decisión está en una sola función, `verificarPago()` en `apps/api/src/pagos.js`. Es idempotente y corre dentro del lock por cancha. La usan la vuelta del jugador, el webhook y el panel.

### Estados del pago (`reservas.pago_estado`)

| Estado | Significa |
|---|---|
| `pendiente` | todavía no se pagó |
| `aprobado` | pagado y turno confirmado |
| `rechazado` | Mercado Pago rechazó el pago |
| `reembolsado` | se pagó pero el turno ya no estaba; se devolvió la plata |
| `reembolso_pendiente` | hay que devolver la plata y la devolución automática falló |

Las reservas manuales, los bloqueos y los turnos fijos tienen `pago_estado` en `NULL`.

### Probar pagos

Las credenciales tienen que ser las del **vendedor de prueba** (Tus integraciones → tu aplicación → Cuentas de prueba).

1. Abrí una **ventana de incógnito** (si el navegador tiene tu cuenta real de Mercado Pago abierta, aparece el error "Una de las partes con la que intentás hacer el pago es de prueba").
2. Reservá un turno y, en el checkout, entrá con el **usuario comprador de prueba** (de Argentina).
3. Pagá con **tarjeta**, no con "Dinero en cuenta":

| Tarjeta | Número | CVV | Vencimiento |
|---|---|---|---|
| Mastercard | 5031 7557 3453 0604 | 123 | 11/30 |
| Visa | 4509 9535 6623 3704 | 123 | 11/30 |

El **nombre del titular** define el resultado (DNI `12345678`):

| Titular | Resultado |
|---|---|
| `APRO` | aprobado |
| `CONT` | pendiente |
| `OTHE` | rechazado |
| `FUND` | rechazado por fondos insuficientes |

Fuente: [tarjetas de prueba de Checkout Pro](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-orders/integration-test/test-purchase-with-card).

### Webhook (`POST /webhooks/mercadopago`)

Mercado Pago avisa cuando cambia una orden, aunque el jugador cierre la pestaña sin volver. Para probarlo en local hace falta un túnel HTTPS (por ejemplo ngrok o cloudflared) hacia el puerto 3000:

1. En Tus integraciones → tu aplicación → **Webhooks**, cargá `https://<tu-túnel>/webhooks/mercadopago` y elegí el evento **Order**.
2. Copiá la **clave secreta** que muestra Mercado Pago en `MP_WEBHOOK_SECRET` y reiniciá la API.

La API valida la firma (`x-signature`, HMAC-SHA256) y responde 401 si no coincide. Con firma válida, igual le pregunta a Mercado Pago por la orden: el contenido del aviso no se usa para decidir nada.

---

## Seguridad

- **Los montos los calcula el servidor** con los precios de la base; lo que mande el navegador se ignora.
- **No se confía en la URL de vuelta** de Mercado Pago (`?status=approved` lo puede escribir cualquiera) **ni en el contenido del webhook**: siempre se consulta la orden a Mercado Pago con el access token.
- **Link secreto de la reserva**: token aleatorio de 32 bytes; en la base se guarda solo su hash SHA-256. Las rutas públicas nunca usan el id numérico de la reserva, y el estado público no devuelve teléfono ni nombre.
- **Doble reserva imposible**: una restricción de Postgres (`EXCLUDE USING gist`) impide dos reservas superpuestas en la misma cancha, y un lock por cancha ordena las operaciones que se cruzan (reserva online vs. turno fijo, por ejemplo).
- **Panel**: contraseñas con bcrypt, cookie de sesión `httpOnly` + `sameSite=strict`, sesiones guardadas como hash, límite de 5 intentos de login cada 15 minutos.
- **Credenciales** solo en el `.env`; nunca se loguean ni se mandan al front.

---

## Rutas de la API

**Públicas**

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/salud` | chequeo de que la API ve la base |
| GET | `/club` | datos públicos del club |
| GET | `/disponibilidad?fecha=AAAA-MM-DD` | turnos libres del día por cancha |
| POST | `/reservas` | crea la reserva retenida y la orden de pago; devuelve `token` y `checkout_url` |
| GET | `/reservas/estado/:token` | estado de una reserva (verifica el pago con Mercado Pago) |
| POST | `/webhooks/mercadopago` | aviso de Mercado Pago |

**Panel (`/admin`, con sesión)**: `login`, `logout`, `yo`, `canchas`, `agenda`, `reservas` (cargar a mano), `bloqueos`, `reservas/:id/cancelar`, `reservas/:id/reintentar-reembolso`, `turnos-fijos` (crear, desactivar, liberar y deshacer fechas), `ajustes` (precios y seña) y `club-info`.

---

## Pendiente

- Botones de la pantalla de confirmación: agregar al calendario, compartir y cancelar reserva.
- Mail también cuando se devuelve un pago, y link a la reserva dentro del mail.
- Aviso de "te guardamos el turno 15:00 min" en la pantalla de confirmar.
- Centro de notificaciones del panel.
- Probar el webhook con un túnel y pasar a credenciales de producción.
