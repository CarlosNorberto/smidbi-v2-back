# CLAUDE.md — smidbi-back

Backend del sistema nuevo de Smidbi (Express + Sequelize + PostgreSQL). Comparte base de datos con un backend legacy (`BACK-END`) que se está migrando por módulos junto con su frontend nuevo (`smidbi-vite-front`).

## Filosofía del proyecto (leer antes de portar cualquier módulo)

El objetivo de este sistema nuevo (backend + frontend) es **mejorar la experiencia del usuario**, tanto en usabilidad como en velocidad, aprovechando stack backend moderno y React en el frontend. Migrar un módulo de la app antigua **no es copiar y pegar la lógica antigua tal cual**: hay que basarse en la lógica de negocio existente (las reglas, los cálculos, las validaciones que ya son correctas y conocidas) pero **mejorar la experiencia** al llevarlo a este sistema — mejor UX, mejor performance, menos fricción — no limitarse a replicar endpoints y flujos viejos. Ante cualquier feature a portar, evaluar primero si el flujo original tiene margen de mejora antes de reproducirlo 1:1.

## Estructura y convenciones

- Modelos nuevos van planos en `server/models/` (no anidados) para dominios simples/standalone — se auto-registran vía el `fs.readdirSync(__dirname)` raíz de `server/models/index.js`, sin tocar ese archivo.
- Rutas de features no específicos de un dominio van planas en `server/routes/index.js`; features de un dominio (ej. campaign manager) tienen su propio `server/routes/<dominio>/index.js`.
- Sesión vía `sessionAuth` (middleware compartido); nunca tocar el backend/frontend antiguo.
- Imágenes: cuando un feature nuevo sube archivos que la app antigua ya guardaba en disco, se comparte la misma carpeta física vía una env var `LEGACY_*_UPLOADS_PATH`, montada como estático en `app.js` (`if (process.env.X) { app.use(...) }`), con `multer` en `memoryStorage()` + `sharp` para resize/compresión antes de `fs.promises.writeFile`, y nombres de archivo con UUID (`crypto.randomUUID()`) para no colisionar con los nombres `Date.now()` de la app antigua.
