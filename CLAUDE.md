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

## Propiedad y permisos en empresas → categorías → campañas → reportes

- El **responsable (dueño)** vive en `empresas.id_usuario` y todo lo que cuelga de la empresa hereda esa propiedad. Se asigna **al crear** (la empresa/reporte queda a nombre de quien lo crea) y **nunca cambia al editar**: los controllers descartan `id_usuario`, `usuario_creacion`, `fecha_creacion` y `access_token` del body (`PROTECTED_FIELDS` / `REPORT_PROTECTED_FIELDS`). No reintroducir `body.id_usuario = req.user.id` en un update: eso hacía que cada guardado le quitara el reporte a su dueño.
- Toda ruta que **modifique** una empresa, categoría, campaña o reporte (crear, editar, copiar, habilitar/deshabilitar, eliminar) debe validar con [server/auth/ownership.js](server/auth/ownership.js) (`canManageCompany/Category/Campaign/Report`). `admin` y `superadmin` gestionan todo; el resto de roles solo lo que cuelga de empresas de las que son responsables.
- **Categorías, campañas y reportes heredan el responsable de su empresa**, nunca el de quien los crea ni copia (`getCompanyOwnerId/getCategoryOwnerId/getCampaignOwnerId` en ownership.js). Si un admin crea un reporte en la empresa de A, queda a nombre de A; quien lo creó queda en `usuario_creacion`. Motivo: `reportes.id_usuario` define "mis campañas" (asistente IA), la búsqueda global y el seguimiento, así que si no coincidiera con la empresa el responsable nunca vería ese reporte ahí. Al agregar un flujo que cree o copie categorías/campañas/reportes, asignar `id_usuario` con esos helpers.
- **Reasignar** una empresa (con todas sus categorías, campañas y reportes) a otro usuario: `PUT /companies/:id/assign` (`empresas.assignOwner`, solo admin/superadmin, en transacción). Es la única forma de cambiar el responsable de una empresa existente; editarla no lo cambia. No toca las tareas ni `tasks_card_responsibles`.
- **Datos heredados:** el invariante "mismo responsable que la empresa" vale para lo que se crea desde ahora; los registros anteriores (y lo que escriba el sistema antiguo, que comparte la BD) pueden diferir. Por eso `canManageReport` acepta también al responsable del propio reporte. Para medir la divergencia: comparar `id_usuario` de categorías/campañas/reportes contra el de su empresa.
- Ante falta de acceso se responde **404** (`denyAccess`), no 403: el interceptor de axios del frontend redirige a `/login` ante cualquier 403 y aquí no corresponde cerrar la sesión.
- Quedan fuera de esa validación (a propósito, por ahora): las lecturas y los guardados de sub-recursos del reporte (días, género, dispositivos, horas, segmentos, anuncios). El link de acceso de cliente (`access_token`) es libre por diseño: quien lo tiene entra, y quien lo genera sabe el alcance.
- Toda ruta debe llevar `sessionAuth` (o `clientSessionAuth`/token público a propósito). `reports/day/update` y `reports/day/review` estaban sin sesión.
- `reporteDiasReview` interpola `year`/`month` en un `literal` de SQL: se fuerzan a enteros acotados antes. No concatenar texto del request en `literal`.
- `reportes.id_usuario`/`empresas.id_usuario` tienen `defaultValue: 1` en el modelo: siempre asignar el responsable explícitamente al crear.
- Reactivar (activo false→true) una categoría, campaña o reporte se rechaza con 409 si su padre sigue inactivo, y NO reactiva en cascada lo que contiene (desactivar sí es en cascada). El frontend lo avisa en el modal.
- Borrar un reporte: `tasks_cards` y `anuncios` lo referencian sin cascada → el controller responde 409 con un mensaje si hay tareas o anuncios asociados.

## Anuncios de reportes (`view_ads`)

- El título del anuncio vive en la columna **`title`** (no `titulo`) y el enlace en `link_end_point`. El modal "Editar Anuncio" guarda **al instante** con `PUT /reports/view_ads/update/:id` (`updateViewAd`: valida enlace http(s), título ≤ 300 y propiedad del reporte); subir y quitar imágenes también se guardan solas. "Guardar todo" ya no interviene en los anuncios. (`saveUpdateViewAds` / `POST /reports/view_ads/save/:report_id` apunta a un modelo que no existe, `interaccion_view_ads`, y nadie lo llama.)
- Variables de entorno necesarias por entorno (cada una con SU valor; el `.env` no se versiona):
  - `LEGACY_ADS_UPLOADS_PATH`: carpeta donde se guardan los archivos y que se sirve en `/uploads/ads`. Debe **existir** (no se crea sola) y en Windows va con una ruta local, p. ej. `D:/…/server/uploads/view-ads`. Producción: `/home/back-end/server/uploads/view-ads`.
  - `BASE_URL`: URL pública de este backend; el modelo arma con ella el enlace de la imagen (`${BASE_URL}/uploads/ads/<archivo>`). Local: `http://localhost:3010`. Producción: `https://v2.smidbi.site`. Si falta, las imágenes salen con `undefined/uploads/ads/...`.

## KPI (objetivos secundarios) del reporte

- Ver, crear, editar y eliminar los KPI de un reporte (pestaña Información Principal, tabla "KPI (Obj. secundario)") es **exclusivo de admin y superadmin**: `GET /reports/secondary_objectives/:report_id` y `POST /reports/secondary_objectives/save/:report_id` llevan `requireRole('admin','superadmin')`, igual que crear/editar los tipos de KPI (`POST /objectives/create`, `PUT /objectives/update/:id`). Listar los tipos (`GET /objectives/all`) sigue abierto: lo usan el objetivo principal del reporte y el Planificador. El frontend ni monta la sección para otros roles (`ReportInfoComponent`).
- El guardado reemplaza TODA la lista (borra y recrea) en una transacción y valida antes de tocar nada: `valor` es BIGINT, así que solo enteros. Si una fila falla, queda la lista anterior.

## Copiar un reporte

- `POST /reports/copy` (`copyReport`): copia el reporte y su configuración (género, dispositivos, edades, horas, segmentación, mapa, KPI secundarios, funnel, anuncios) dentro de la MISMA campaña. No copia `reporte_dia` (los valores día a día empiezan en cero) ni las tareas; el seguimiento (`ejecutado`, `pagado`, etc.) se reinicia. El nombre y las fechas los elige quien copia; las fechas son opcionales pero, si vienen, deben ser las dos, reales y en orden (se validan antes de tocar nada).
- La copia hereda el responsable de la empresa (`id_usuario`); quien copió queda en `usuario_creacion`. La puede hacer admin/superadmin, o un `user` que sea responsable del reporte o de su empresa (`canManageReport`).
- Nace **inactiva** si su campaña está inactiva (un reporte no puede estar activo bajo una campaña inactiva).
- Los anuncios (`view_ads`) de la copia apuntan al **mismo archivo** de imagen que los del original. Por eso `deleteAdImage` solo borra el archivo (disco o Cloudinary) cuando ningún otro anuncio lo usa.
- En el frontend el modal es [copy_report_modal_component.jsx](../smidbi-vite-front/src/features/reports/components/copy_report_modal_component.jsx), usado por el botón "Copiar" del listado y por el menú del botón "Guardar todo" en la edición del reporte (ahí, al terminar, abre la copia).

## Aviso por WhatsApp al crear un reporte ("reporte_creado")

- Proceso **`nuevo_reporte`** ("Nuevo reporte creado", en `config/whatsapp_procesos.js`): aparece solo en Configuraciones → Notificaciones WhatsApp → "Recibe avisos de" (la lista sale de `/whatsapp_destinatarios/procesos`). Al crear un reporte (`saveUpdate` con reporte nuevo; **no** al editar ni al copiar), `notifyReportCreated` (`services/reportCreatedNotification.js`) envía la plantilla a los números activos suscritos. Va **sin await** y nunca lanza: si nadie está suscrito no hace nada (ni consulta ni log); si WhatsApp falla, el reporte se guarda igual y el error queda solo en el log del servidor.
- Plantilla **`reporte_creado`** (`config/whatsapp_templates.js`), registrada en Meta con **UNA variable**: `Se generó el reporte {{1}} y ya está disponible en el sistema. Puedes consultarlo en el botón de abajo.` (`{{1}}` = nombre del reporte) + botón con URL dinámica `https://<FRONT_URL>/admin/report?token={{1}}`. Si el texto de la plantilla cambia, ajustar `build` ahí (si no, Meta rechaza el envío y solo se ve en el log).
- El **token** (`utils/reportLink.js`) es `<firma>-<id>`: lleva dentro el id del reporte y una firma HMAC con `REPORT_LINK_SECRET` (si falta, `BRIEF_LINK_SECRET` o `SESSION_SECRET`). No se guarda en la BD, no caduca y cambiar el secreto invalida todos los links enviados. Un código de brief no sirve como token de reporte.
- **Acceso por token = solo lectura de ESE reporte** (`auth/report_token_auth.js`): el frontend manda `Authorization: ReportToken <token>` (CORS solo permite Content-Type y Authorization) y `sessionOrReportToken` lo acepta únicamente en 5 rutas GET que consulta la pantalla del reporte, cada una verificando que lo pedido pertenezca al reporte del token: `/reports/one/:id` (con las columnas limitadas a `GUEST_REPORT_ATTRIBUTES`), `/campaigns/one/:id` (la campaña del reporte), `/reports/view_ads/:report_id`, `/objectives/all` y `/platforms/all` (catálogos). Todo lo demás (guardar, borrar, subir imágenes, otros reportes, días, KPI, usuarios...) sigue exigiendo sesión. **Al sumar una ruta GET a la pantalla del reporte, decidir si el token debe poder leerla; por defecto NO.**
- `GET /public/reports/view/:token` (`controllers/report_public.js`, sin login, 120 consultas/hora por IP) solo resuelve el token a `{ id, nombre, empresa_id, categoria_id, campana_id }`.
- Frontend: `/admin/report?token=…` ([report_token_entry_page.jsx](../smidbi-vite-front/src/pages/report_token_entry_page.jsx)) lleva a la edición normal si hay sesión, o a `/admin/report/:company_id/:category_id/:campaign_id/:report_id?token=…` ([report_guest_page.jsx](../smidbi-vite-front/src/pages/report_guest_page.jsx)): la MISMA pantalla de edición del reporte en modo solo lectura. Ambas rutas están fuera del bloque protegido de `/admin`.

## Buscador general (Ctrl + K)

- `controllers/utilities.js`: `campaignSearch` (reportes), `campaignSearchFilters` (años y categorías del filtro) y `companySearch` (empresas). **Admin y superadmin ven todo** (`isUnrestricted` de `auth/ownership.js`); el resto de roles (`user`, `hidden`) solo lo suyo.
- Qué ve un no-admin: **empresas** con `empresas.id_usuario` = él; **reportes** (`buildReportVisibility`) los de las empresas de las que es responsable (un reporte pertenece al dueño de su empresa, aunque por datos anteriores a esa regla figure asignado a otro) **más** los que tiene asignados directamente en `reportes.id_usuario`. Es la misma regla de `canManageReport`: el buscador muestra lo que el usuario puede abrir y editar. Cuando se normalicen los datos (reportes igualados al dueño de su empresa) la segunda mitad sobra y se puede quitar.
- A admin/superadmin cada resultado trae `responsable` (a quién pertenece: el dueño de la **empresa**, también para los reportes); a los demás no se les envía. El frontend ([global_search_component.jsx](../smidbi-vite-front/src/components/global_search_component.jsx)) lo muestra si llega.
- Al elegir una empresa se abre `/admin/companies/:id`: en `empresas.getAllByUsers`, cuando viene `company_id` el filtro `user_ids` se ignora (el frontend manda por defecto el propio usuario y escondía las empresas de otros).
- Aún usan solo `reportes.id_usuario` (no el dueño de la empresa): "mis campañas" del asistente IA (`assistant_ai/helps`), el seguimiento y `/reports/all` con `own`. Si se quiere la misma regla ahí, o se iguala el dato (migración) o se cambia cada filtro.

## PENDIENTE: igualar los responsables de datos antiguos (migración de datos)

**Decisión: se deja para después, cuando alguien lo note.** No hace falta hacerla ahora; el sistema funciona con los datos mezclados.

- **Qué es:** desde la regla "un reporte/campaña/categoría pertenece al dueño de su empresa" (`empresas.id_usuario`), todo lo que se crea o copia hereda ese responsable y editar no lo cambia (ver "Propiedad y permisos"). Los datos ANTERIORES a la regla no se tocaron: en la base local, 196 de 1.014 categorías, 486 de 6.463 campañas y 1.205 de 13.578 reportes tienen un `id_usuario` distinto al de su empresa (el sistema antiguo, que comparte la BD, también puede seguir escribiendo el suyo).
- **Síntoma que avisará de que hay que hacerla:** un usuario dice que no ve SUS reportes en el **asistente IA** ("mis campañas"), en el **seguimiento** o en `/reports/all` con `own`, porque esos tres filtran solo por `reportes.id_usuario`. (El buscador general y los permisos de edición ya cubren las dos reglas, ver "Buscador general".)
- **Qué hacer:** una migración que iguale categorías, campañas y reportes al responsable de su empresa:
  ```sql
  UPDATE categorias c SET id_usuario = e.id_usuario FROM empresas e WHERE e.id = c.id_empresa AND c.id_usuario <> e.id_usuario;
  UPDATE campanas ca SET id_usuario = e.id_usuario FROM categorias c JOIN empresas e ON e.id = c.id_empresa WHERE c.id = ca.id_categoria AND ca.id_usuario <> e.id_usuario;
  UPDATE reportes r SET id_usuario = e.id_usuario FROM campanas ca JOIN categorias c ON c.id = ca.id_categoria JOIN empresas e ON e.id = c.id_empresa WHERE ca.id = r.id_campana AND r.id_usuario <> e.id_usuario;
  ```
  Antes: respaldo de la BD y revisar la lista de lo que cambia (cada reporte que cambia de responsable sale del "mis campañas" de una persona y entra al de otra). No es reversible sin el respaldo (`down` vacío, como en la migración de roles). Para una sola empresa ya existe `PUT /companies/:id/assign` ("Asignar responsable"), que hace lo mismo en cascada.
- **Después de hacerla, limpiar:** la mitad "responsable del propio reporte" de `canManageReport` (`auth/ownership.js`) y de `buildReportVisibility` (`controllers/utilities.js`) deja de hacer falta.
