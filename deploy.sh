#!/usr/bin/env bash
# Deploy del backend nuevo (smidbi2) — la parte que SÍ vive dentro del repo.
#
# Por qué está partido en dos: un script que hace `git pull` sobre sí mismo
# mientras se está ejecutando es frágil (bash puede seguir leyendo el archivo
# del disco a medida que avanza, así que un pull a mitad de camino puede
# pisar líneas que todavía no se ejecutaron). Por eso el `git pull` vive en un
# wrapper chico y estable, suelto en el servidor (ej. /home/deploy.sh, fuera
# de este repo, para que nunca se pise a sí mismo) — y esa es la parte fija
# que casi nunca cambia. Este archivo, en cambio, sí está en git: es la parte
# que evoluciona (pasos de build, migraciones, reload) y con cada `git pull`
# del wrapper llega ya actualizado, sin que haya que tocar el servidor a mano.
#
# El wrapper externo debe verse así:
#
#   #!/usr/bin/env bash
#   set -e
#   BACKEND_PATH="/home/smidbi-v2-back"
#   cd "$BACKEND_PATH"
#   git checkout -- package-lock.json 2>/dev/null || true
#   git pull --ff-only
#   bash deploy.sh
#
# El frontend NO se despliega con este script: se buildea local
# (npm run build) y se sube el contenido de dist/ a mano por FTP/SFTP.

set -e

PM2_BACKEND_NAME="smidbi2"

echo "==> Backend nuevo: instalando dependencias"
npm ci

echo "==> Backend nuevo: migraciones"
npm run migrate:prod

echo "==> Backend nuevo: reload"
pm2 reload "$PM2_BACKEND_NAME"

echo "==> Backend nuevo: listo."
