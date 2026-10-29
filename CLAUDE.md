# CLAUDE.md — backend_ots

## Stack real
- **Node 20**, **Express 5**, **Sequelize 6** (ORM) + **mysql2** (pool raw para queries manuales)
- CommonJS (`require`/`module.exports`), sin ESM
- JWT (jsonwebtoken), bcrypt, multer (uploads), winston (logging), nodemailer (SMTP), axios (llamadas al microservicio ML)
- MariaDB 11.8, base `ots`

## Estructura clave
```
src/
  config/         # db.js (Sequelize + pool raw), environment.js, jwt.js, mlService.js
  controller/     # Un archivo por dominio; lógica HTTP thin
  middleware/     # authMiddleware, roleMiddleware, rateLimitMiddleware, uploadMiddleware, errorHandler
  models/         # Sequelize models; index.js hace sync({ alter: true })
  routes/         # Un archivo por dominio; index.js los une bajo /api
  services/       # Lógica de negocio; los controllers los llaman
  validators/     # Middleware de validación inline (no librería externa)
  utils/          # logger.js (winston), feriados.js, cantones.js
  seeds/          # Scripts de datos iniciales (no se ejecutan automáticamente)
sql/
  001_esquema_inicial.sql   # DDL idempotente de las 19 tablas
  002_datos_iniciales.sql   # Roles + admin de desarrollo
```

## Comandos
| Tarea | Comando |
|-------|---------|
| Dev (hot-reload) | `npm run dev` → `nodemon src/server.js` |
| Producción | `npm start` → `node src/server.js` |
| Test | ⚠️ CONFIRMAR: no hay script de test |
| Lint | ⚠️ CONFIRMAR: no hay script de lint |

## Variables de entorno críticas
Ver `.env.example` para descripción completa. Variables obligatorias:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (base = `ots`)
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `SERVICE_TOKEN` — debe coincidir con el del microservicio (header `X-Service-Token`)
- `ML_SERVICE_URL` — URL base del microservicio (default `http://localhost:5000`)
- `FRONTEND_URL` — origen(es) CORS de producción separados por coma
- `SMTP_*` — opcionales; si están vacíos el correo se imprime en consola

## Convenciones del código
- **Routes** declaran path + middleware(s) + controller; no lógica propia
- **Validators** son middleware Express inline (función(req, res, next)); errores → `{ error, detalles: [] }`
- **Controllers** son async; errors → `res.status(N).json({ error: msg })` o delegan a `estadoErrorML()`
- **Services** hacen las queries (Sequelize o pool raw); nunca tocan `req`/`res`
- **mlService.js** — wrapper para llamadas al microservicio: `ML_SERVICE_URL`, `mlHeaders()`, `estadoErrorML()`
- `estadoErrorML(error)`: sin respuesta (ECONNREFUSED/timeout) → **503**; 401/503 del micro → 502; resto pasa tal cual
- `app.set('trust proxy', 1)` — necesario para rate limiting correcto detrás de Traefik

## Restricciones
- **No borrar** `models/Prediccion.js` ni la tabla `predicciones`: `models/index.js` la registra al arrancar; `sql/001` la crea; quitarlas es una migración aparte
- `esquemaService.js` ejecuta `ALTER TABLE` en cada arranque — debe mantenerse en sync con `sql/001`
- `NO_AUTO_VALUE_ON_ZERO` requerido para `id_rol=0` (Super Administrador) al correr `sql/002`

## Estado actual (oct 2026)
- Rama `chore/retirar-predicciones-guardadas` lista para mergear a `main`
  - Removidas: rutas CRUD de predicciones guardadas, tres endpoints del dashboard (`/predicciones`, `/estadisticas`, `/metricas-modelo`)
  - Pendiente: fix de `estadoErrorML` (línea 17 de `config/mlService.js`: cambiar `return 500` → `return 503`)
- `main` en `a0f47b1` (Merge de `feat/esquema-inicial`)

## Pendientes conocidos
- `estadoErrorML` aún devuelve 500 en lugar de 503 para ECONNREFUSED/timeout (fix en la rama activa)
- Sin tests (cero archivos `.test.js`)
- `esquemaService.js` (ALTER TABLE en cada arranque) debería reemplazarse por migraciones versionadas
- El README está vacío
- Dos fuentes de conexión a BD (Sequelize + pool raw mysql2): no es un bug, pero añade complejidad
