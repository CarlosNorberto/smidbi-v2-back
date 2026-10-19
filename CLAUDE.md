# CLAUDE.md — smidbi-back

Backend del sistema nuevo de Smidbi (Express + Sequelize + PostgreSQL). Comparte base de datos con un backend legacy (`BACK-END`) que se está migrando por módulos junto con su frontend nuevo (`smidbi-vite-front`).

## Filosofía del proyecto (leer antes de portar cualquier módulo)

El objetivo de este sistema nuevo (backend + frontend) es **mejorar la experiencia del usuario**, tanto en usabilidad como en velocidad, aprovechando stack backend moderno y React en el frontend. Migrar un módulo de la app antigua **no es copiar y pegar la lógica antigua tal cual**: hay que basarse en la lógica de negocio existente (las reglas, los cálculos, las validaciones que ya son correctas y conocidas) pero **mejorar la experiencia** al llevarlo a este sistema — mejor UX, mejor performance, menos fricción — no limitarse a replicar endpoints y flujos viejos. Ante cualquier feature a portar, evaluar primero si el flujo original tiene margen de mejora antes de reproducirlo 1:1.

## Estructura y convenciones

- Modelos nuevos van planos en `server/models/` (no anidados) para dominios simples/standalone — se auto-registran vía el `fs.readdirSync(__dirname)` raíz de `server/models/index.js`, sin tocar ese archivo.
- Rutas de features no específicos de un dominio van planas en `server/routes/index.js`; features de un dominio (ej. campaign manager) tienen su propio `server/routes/<dominio>/index.js`.
- Sesión vía `sessionAuth` (middleware compartido); nunca tocar el backend/frontend antiguo.
- Imágenes: cuando un feature nuevo sube archivos que la app antigua ya guardaba en disco, se comparte la misma carpeta física vía una env var `LEGACY_*_UPLOADS_PATH`, montada como estático en `app.js` (`if (process.env.X) { app.use(...) }`), con `multer` en `memoryStorage()` + `sharp` para resize/compresión antes de `fs.promises.writeFile`, y nombres de archivo con UUID (`crypto.randomUUID()`) para no colisionar con los nombres `Date.now()` de la app antigua.

## PDF del Planificador — páginas y tamaño (`server/controllers/planificador/pdf_template.js`)

- El documento usa una constante `PAGE_SIZE` (array `[ancho, alto]` en puntos) en vez de `size:'A4', orientation:'landscape'` en cada `Page` — todas las páginas la comparten, así que para ajustar el tamaño de todo el PDF alcanza con cambiar esa única constante.
- **Página de Costos (tabla CPC/CPV/CPE + CPM) quitada del PDF** a pedido del usuario (seguía viéndose "de tabla", no encajaba con el resto del rediseño tipo deck). La función `buildCostosPage` (y su tabla `buildCostosTable`, reutiliza los estilos viejos `table/row/headerCell/cell/cellLeft/totalRow/cellActive`) **sigue completa en el archivo**, solo no se llama. Para volver a incluirla: en `buildDocument`, reemplazar el comentario que dice "La página de Costos... se quitó del PDF" por:
  ```js
  ...secciones.map((s) => buildCostosPage(brief, s.tipo, s.lineas, objetivosById)),
  ```
  (antes de `buildGlosarioPage(secciones)`, mismo lugar donde estaba).

## Chatbot RAG del home — PENDIENTE (solo diseño acordado, nada implementado)

Idea: un chatbot en el home (público) que responde solo con la documentación que un admin carga desde el panel (PDF/xlsx). Primera vez "no tengo información al respecto"; tras cargar la documentación, responde bien. Se dejó en pausa a pedido del usuario; este es el contexto para retomarlo sin repetir la investigación.

**Flujo**
- Carga (admin): subir archivo → extraer texto (PDF: texto por página; xlsx: cada fila convertida a una frase tipo "Plan Básico: precio 100...") → partir en fragmentos de ~500–800 palabras con solapamiento → embeddings de OpenAI → guardar texto + vector + documento de origen.
- Pregunta (home): embedding de la pregunta → buscar fragmentos más parecidos → pasar solo esos al modelo con la instrucción "responde únicamente con este contexto; si no alcanza, di que no tienes información". Si ningún fragmento supera un umbral de similitud, ni se llama al modelo: se responde "no tengo información al respecto" (evita inventar).
- Borrar un documento borra sus fragmentos; no hay reentrenamiento, el cambio es inmediato.

**Restricciones del entorno (por qué las decisiones)**
- Producción: **PostgreSQL 10.22 en Ubuntu 18.04** (ambos sin soporte, compartido con el backend legacy). `pgvector` exige PG ≥ 13, así que **no se puede instalar en producción**; no se recomienda actualizar ese Postgres. Local es PG 17.6 sin `pgvector` instalado.
- Producción corre **Node 16** → librerías compatibles con Node 16 (p. ej. `pdf-parse`; `exceljs` y `multer` ya están). `openai` está fijado en 4.x por esto (ver DEPLOY.md); 4.x soporta embeddings.
- La API key de OpenAI vive en `system_settings` (módulo `assistant_ai`) vía `server/assistant_ai/services/openai.service.js`; reutilizar ese cliente.

**Decisión acordada (opción A, pendiente de confirmación final del usuario)**
- Vectores en una tabla normal de Postgres (arreglo/JSON) y similitud calculada en Node. Para que sea rápido: usar el parámetro `dimensions` de `text-embedding-3-small` (~512) y cargar los vectores una vez en memoria (Float32Array). Alcanza para una empresa mediana (~5.000–20.000 fragmentos).
- Acceder a los vectores detrás de una capa pequeña ("vector store") para poder pasar luego a la opción B sin tocar el resto: un **Postgres 16 con `pgvector` en Docker**, aislado del legacy (segunda conexión Sequelize). La opción C (actualizar el Postgres 10) se descartó.

**Alcance y seguridad**
- Gestionan documentos solo `admin` y `superadmin` (`requireRole('admin','superadmin')`).
- Cada documento lleva un campo de **audiencia** (`publico` ahora; `clientes` / `interno` después). El chat filtra por audiencia **antes** de buscar, para que un visitante nunca reciba fragmentos de documentos de clientes. Hoy el chat es solo para visitantes; la idea es extenderlo luego a clientes logueados (lenguaje natural en vez de intents fijos del consultor IA).
- Es un endpoint **público**: todo lo cargado es consultable por cualquiera → advertirlo en la pantalla de carga ("no subir información interna/confidencial"). Debe estar **aislado del consultor IA** (`assistant_ai`): sin acceso a campañas, clientes ni presupuestos, solo a los documentos. Requiere rate limit por IP (`server/auth/rate_limit.js` ya existe), tope de longitud de pregunta (costo de OpenAI) y mitigación de prompt injection desde el contenido de los documentos.

**OCR: se deja para después**
- PDF escaneado = imágenes sin texto; la primera versión debe **detectar un PDF sin texto y avisar** al usuario en vez de aceptarlo en silencio.
- Agregar OCR implica: convertir páginas a imagen (herramientas del SO como `poppler`), leerlas con un modelo de visión de OpenAI o Tesseract (costo/calidad variable en tablas y manuscrito) y procesar en segundo plano con estado "procesando" (un escaneo grande tarda minutos). Solo se justifica si la documentación real resulta ser escaneada.

**Plan de trabajo previsto**
1. Backend: migración (documentos + fragmentos con audiencia), carga/extracción PDF y xlsx, embeddings, búsqueda, endpoint público de chat con rate limit.
2. Frontend (`smidbi-vite-front`): sección en el admin para subir/listar/borrar documentos (con vista de prueba de pregunta que muestre qué fragmentos se usaron, y opcionalmente historial de preguntas sin respuesta) y widget de chat en el home.

**Pendiente de confirmar al retomar:** que el usuario aprueba la opción A, y el tamaño real de la documentación.
