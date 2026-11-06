#!/usr/bin/env bash
# Deploy del sistema nuevo (smidbi2) — un solo archivo, versionado en git,
# que hace TODO: pull, dependencias, migraciones, reload del backend y build
# + publicación del frontend.
#
# Por qué es seguro que este mismo archivo se actualice a sí mismo con
# `git pull`: todo lo que corre DESPUÉS del pull vive adentro de funciones
# (`deploy()` y `deploy_frontend()`), definidas ANTES de la línea `git pull`.
# Bash ya cargó esas funciones completas en memoria al llegar ahí, así que no
# importa qué reescriba el pull en el archivo en disco — esta corrida sigue con
# la versión que ya tenía cargada. Si este mismo script cambió en ese pull, el
# cambio se aplica recién en la PRÓXIMA corrida, nunca a mitad de la actual.
#
# Uso (parado en cualquier lado, ej. cron o a mano):
#   /home/smidbi-v2-back/deploy.sh
#
# Frontend (smidbi-vite-front): pull, build y copia de dist/ a la carpeta que
# sirve Apache. Es un sitio estático, no hay proceso que levantar. El build corre
# con Node 20 (Vite 6 / Tailwind 4 no andan con el Node 16 del servidor), cargado
# con nvm SOLO dentro de un subshell: el backend y pm2 siguen con el Node 16.

set -e

BACKEND_PATH="/home/smidbi-v2-back"
PM2_BACKEND_NAME="smidbi2"
FRONTEND_PATH="/home/smidbi-vite-front"
FRONTEND_WEB_ROOT="/var/www/v2"
FRONTEND_NODE_VERSION="20"

deploy_frontend() {
    echo "==> Frontend: pull"
    cd "$FRONTEND_PATH"
    git checkout -- package-lock.json 2>/dev/null || true
    git pull --ff-only

    # Subshell: el cambio de versión de Node no sale de acá.
    (
        export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
        if [ -s "$NVM_DIR/nvm.sh" ]; then
            . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
            # El glibc del servidor es anterior a 2.28: el Node 20 oficial no corre ahí. Se usa el build
            # no oficial "glibc-217" (solo hace falta al instalar; si ya está instalado, `nvm use` lo toma).
            export NVM_NODEJS_ORG_MIRROR="https://unofficial-builds.nodejs.org/download/release"
            nvm_get_arch() { nvm_echo "x64-glibc-217"; }
            nvm use "$FRONTEND_NODE_VERSION" >/dev/null 2>&1 || nvm install "$FRONTEND_NODE_VERSION"
        fi
        NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
        if [ "$NODE_MAJOR" -lt "$FRONTEND_NODE_VERSION" ]; then
            echo "ERROR: el build del frontend necesita Node $FRONTEND_NODE_VERSION o superior (hay $(node -v)). Instalá nvm + Node $FRONTEND_NODE_VERSION." >&2
            exit 1
        fi

        echo "==> Frontend: instalando dependencias (Node $(node -v))"
        npm ci

        echo "==> Frontend: build"
        npm run build
    )

    # Llegar acá significa que el build salió bien (set -e corta antes si falló),
    # así que la web en producción nunca queda a medio reemplazar por un build roto.
    if [ ! -f "$FRONTEND_PATH/dist/index.html" ]; then
        echo "ERROR: dist/index.html no existe, no se publica nada." >&2
        exit 1
    fi

    echo "==> Frontend: publicando en $FRONTEND_WEB_ROOT (se conserva .htaccess)"
    if command -v rsync >/dev/null 2>&1; then
        rsync -a --delete --exclude '.htaccess' "$FRONTEND_PATH/dist/" "$FRONTEND_WEB_ROOT/"
    else
        find "$FRONTEND_WEB_ROOT" -mindepth 1 -not -name '.htaccess' -delete
        cp -a "$FRONTEND_PATH/dist/." "$FRONTEND_WEB_ROOT/"
    fi

    echo "==> Frontend: listo."
}

deploy() {
    echo "==> Backend nuevo: instalando dependencias"
    npm ci

    echo "==> Backend nuevo: migraciones"
    npm run migrate:prod

    echo "==> Backend nuevo: reload"
    pm2 reload "$PM2_BACKEND_NAME"

    echo "==> Backend nuevo: listo."

    deploy_frontend
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
