# DEPLOY — smidbi-v2

Guía rápida para actualizar el sistema nuevo en el servidor de producción.

## Resumen

| | Cómo se actualiza |
|---|---|
| **Backend** (este repo) | Parado en el servidor, corriendo `./deploy.sh` |
| **Frontend** (`smidbi-vite-front`) | Solo un build estático — se compila local y se sube por FTP/SFTP |

---

## Backend

El backend corre en el servidor con **pm2** (proceso `smidbi2`) y se actualiza con un único script versionado en este mismo repo: [`deploy.sh`](./deploy.sh).

### Pasos

1. Desde tu máquina local, asegurate de que los cambios que querés desplegar estén **commiteados y pusheados** a `origin/main`. `deploy.sh` hace `git pull`, así que si no pusheaste, el servidor no va a tener nada nuevo que traer.
2. Conectate por SSH al servidor.
3. Corré:
   ```bash
   /home/smidbi-v2-back/deploy.sh
   ```
   (podés pararte en cualquier lado, la ruta es absoluta).

Eso hace, en este orden:
1. `git pull --ff-only` — trae los últimos commits. Si esto falla, es porque el historial del servidor divergió del remoto (por ejemplo, alguien commiteó algo a mano ahí); hay que resolverlo a mano antes de seguir, no forzar.
2. `npm ci` — reinstala dependencias exactas según `package-lock.json` (incluye paquetes nuevos que se hayan agregado, como `@react-pdf/renderer`).
3. `npm run migrate:prod` — corre las migraciones pendientes contra la base de producción.
4. `pm2 reload smidbi2` — reinicia el proceso sin downtime.

### Verificar que salió bien

```bash
pm2 status                     # smidbi2 debe figurar "online"
pm2 logs smidbi2 --lines 30 --nostream   # revisar que no haya errores al arrancar
```

Si algo se rompe después de un deploy y necesitás logs limpios (sin ruido viejo):
```bash
pm2 flush smidbi2
# reproducir el problema
pm2 logs smidbi2 --lines 30 --nostream --err
```

### Variables de entorno (`.env` del servidor)

`deploy.sh` **no** toca el `.env` — hay que editarlo a mano en el servidor cuando una nueva feature necesita una variable nueva. Después de un `git pull`, conviene comparar `.env.example`-style (o el propio código) contra el `.env` real del servidor si trabajaste en algo que agregó una variable.

**Pendiente de esta sesión**: se agregó `LEGACY_PDF_PLANIFICADOR_UPLOADS_PATH` (PDF de propuestas del Planificador, carpeta compartida con la app antigua — mismo patrón que `LEGACY_ADS_UPLOADS_PATH` / `LEGACY_QUALIFY_IMAGES_UPLOADS_PATH`, que ya deberían estar seteadas en el servidor). Falta agregar esta nueva al `.env` de producción apuntando a la ruta real del servidor, ej.:
```
LEGACY_PDF_PLANIFICADOR_UPLOADS_PATH=/home/back-end/server/uploads/pdf_planificador
```
Si esta variable no está seteada, el código cae a una carpeta propia del backend nuevo (`uploads/pdf_planificador` local) en vez de la carpeta compartida — no rompe, pero separa los PDF del sistema nuevo de los que ya genera la app vieja.

### Si `deploy.sh` no existe o está desactualizado en el servidor

La primera vez (o si el servidor tiene una copia vieja sin el `git pull` automático), hay que traerlo a mano una vez:
```bash
cd /home/smidbi-v2-back
git pull --ff-only
./deploy.sh
```
De ahí en adelante, `deploy.sh` se actualiza solo en cada corrida (ver el comentario dentro del propio script sobre por qué es seguro que se sobreescriba a sí mismo).

---

## Frontend

Confirmado: sí, es solo un build. No hay proceso de servidor para el frontend — Apache sirve los archivos estáticos directamente.

1. Local, en `smidbi-vite-front`:
   ```bash
   npm run build
   ```
   Esto genera `dist/`.
2. Subir el **contenido** de `dist/` por FTP/SFTP a la carpeta que sirve Apache en el servidor (reemplazando lo que había).

No hace falta reiniciar nada del lado del servidor para el frontend — Apache sirve los archivos nuevos apenas se suben.
