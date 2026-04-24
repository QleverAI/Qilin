#!/usr/bin/env bash
# deploy.sh — despliega Qilin a staging o production
#
# Uso:
#   ./deploy.sh staging     # rama staging  → /opt/qilin-staging  (puerto 8080)
#   ./deploy.sh production  # rama main     → /opt/qilin          (puerto 80)
#
# Requisitos: python3 + paramiko  (pip install paramiko)
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Uso: ./deploy.sh [staging|production]"
  exit 1
fi

case "$TARGET" in
  staging)
    BRANCH="staging"
    REMOTE="/opt/qilin-staging"
    COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.staging.yml"
    ;;
  production)
    BRANCH="main"
    REMOTE="/opt/qilin"
    COMPOSE_CMD="docker compose"
    ;;
  *)
    echo "Target desconocido: '$TARGET'. Usa 'staging' o 'production'."
    exit 1
    ;;
esac

DEPLOY="python .deploy_ssh.py --target $TARGET"

# ── 1. Verificar rama ────────────────────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "⚠  Estás en '$CURRENT_BRANCH' pero desplegando a $TARGET (rama esperada: $BRANCH)."
  read -rp "   ¿Continuar igualmente? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

echo ""
echo "▶  Deploy → $TARGET  (rama $BRANCH, dir $REMOTE)"
echo "────────────────────────────────────────────────"

# ── 2. Primera vez: provisionar directorio y .env en el servidor ─────────────
$DEPLOY "
  if [ ! -d $REMOTE ]; then
    echo 'Creando directorio $REMOTE...'
    mkdir -p $REMOTE
    cp -r /opt/qilin/. $REMOTE/   # copiar base desde prod
    echo 'AVISO: copia .env.staging.example a $REMOTE/.env y edítalo antes de continuar'
  fi
"

# ── 3. Subir fuentes del backend ─────────────────────────────────────────────
echo "[1/4] Subiendo servicios Python..."
backend_files=(
  services/api/main.py
  services/agent_engine/agent_engine.py
)
for f in "${backend_files[@]}"; do
  [[ -f "$f" ]] && $DEPLOY --put "$f" "$REMOTE/$f"
done

# ── 4. Subir fuentes del frontend ────────────────────────────────────────────
echo "[2/4] Subiendo fuentes del frontend..."
find frontend/src -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" \) | while read -r f; do
  $DEPLOY --put "$f" "$REMOTE/$f"
done
for f in frontend/index.html frontend/vite.config.js; do
  [[ -f "$f" ]] && $DEPLOY --put "$f" "$REMOTE/$f"
done

# ── 5. Subir configuración y compose ─────────────────────────────────────────
echo "[3/4] Subiendo configuración..."
for f in config/topics.yaml config/zones.yaml docker-compose.yml docker-compose.staging.yml; do
  [[ -f "$f" ]] && $DEPLOY --put "$f" "$REMOTE/$f"
done

# ── 6. Build frontend y reiniciar API ────────────────────────────────────────
echo "[4/4] Build frontend y restart API..."
$DEPLOY "
  set -e
  cd $REMOTE
  npm --prefix frontend install --silent
  npm --prefix frontend run build
  $COMPOSE_CMD up -d --no-deps api
  echo '✓ Deploy $TARGET completado'
"

echo ""
echo "✅ $TARGET actualizado."
echo ""
if [[ "$TARGET" == "staging" ]]; then
  echo "   Acceso: http://178.104.238.122:8080"
  echo ""
  echo "   Para promover a production:"
  echo "     git checkout main && git merge staging && ./deploy.sh production"
else
  echo "   Acceso: http://178.104.238.122  (o tu dominio)"
fi
