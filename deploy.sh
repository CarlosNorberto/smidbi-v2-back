#!/usr/bin/env bash
# Deploy del backend nuevo (smidbi2) — un solo archivo, versionado en git,
# que hace TODO: pull, dependencias, migraciones y reload.
#
# Por qué es seguro que este mismo archivo se actualice a sí mismo con
# `git pull`: todo lo que corre DESPUÉS del pull vive adentro de la función
# `deploy()`, definida ANTES de la línea `git pull`. Bash ya cargó esa
# función completa en memoria al llegar ahí, así que no importa qué
# reescriba el pull en el archivo en disco — esta corrida sigue con la
# versión que ya tenía cargada. Si este mismo script cambió en ese pull, el
# cambio se aplica recién en la PRÓXIMA corrida, nunca a mitad de la actual.
#
# Uso (parado en cualquier lado, ej. cron o a mano):
#   /home/smidbi-v2-back/deploy.sh
#
# El frontend NO se despliega con este script: se buildea local
# (npm run build) y se sube el contenido de dist/ a mano por FTP/SFTP.

set -e

BACKEND_PATH="/home/smidbi-v2-back"
PM2_BACKEND_NAME="smidbi2"

deploy() {
    echo "==> Backend nuevo: instalando dependencias"
    npm ci

    echo "==> Backend nuevo: migraciones"
    npm run migrate:prod

    echo "==> Backend nuevo: reload"
    pm2 reload "$PM2_BACKEND_NAME"

    echo "==> Backend nuevo: listo."
}

cd "$BACKEND_PATH"
# descarta drift local de package-lock.json (típico de un npm install viejo)
# para que el pull no falle por "local changes would be overwritten"
git checkout -- package-lock.json 2>/dev/null || true
# --ff-only: un deploy nunca debería generar un merge commit. Si esto falla,
# es porque el historial local divergió del remoto (ej. un commit hecho a
# mano en el servidor) y hay que resolverlo a mano antes de seguir.
git pull --ff-only

deploy
