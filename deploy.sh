#!/usr/bin/env bash
# deploy.sh — despliega Qilin a staging o production
#
# Uso:
#   ./deploy.sh staging     # rama staging → VPS staging
#   ./deploy.sh production  # rama main    → VPS producción
#
# Requisitos: git, python3, paramiko instalado
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  echo "Uso: ./deploy.sh [staging|production]"
  exit 1
fi

case "$TARGET" in
  staging)    BRANCH="staging" ;;
  production) BRANCH="main"    ;;
  *)
    echo "Target desconocido: '$TARGET'. Usa 'staging' o 'production'."
    exit 1
    ;;
esac

REMOTE="/opt/qilin"
DEPLOY="python .deploy_ssh.py --target $TARGET"

# ── 1. Verificar que estamos en la rama correcta ─────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "⚠  Estás en '$CURRENT_BRANCH' pero desplegando a $TARGET (rama $BRANCH)."
  read -rp "   ¿Continuar igualmente? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
fi

echo ""
echo "▶  Deploy → $TARGET  (rama $BRANCH)"
echo "────────────────────────────────────"

# ── 2. Subir archivos del backend (API + servicios) ──────────────────────────
echo "[1/4] Subiendo servicios Python..."

backend_files=(
  services/api/main.py
  services/api/requirements.txt
  services/agent_engine/agent_engine.py
  services/agent_engine/requirements.txt
)

for f in "${backend_files[@]}"; do
  [[ -f "$f" ]] && $DEPLOY --put "$f" "$REMOTE/$f"
done

# ── 3. Subir frontend (fuentes) ───────────────────────────────────────────────
echo "[2/4] Subiendo fuentes del frontend..."

find frontend/src -type f \( -name "*.jsx" -o -name "*.js" -o -name "*.css" \) | while read -r f; do
  $DEPLOY --put "$f" "$REMOTE/$f"
done
# Archivos raíz del frontend
for f in frontend/index.html frontend/vite.config.js frontend/package.json; do
  [[ -f "$f" ]] && $DEPLOY --put "$f" "$REMOTE/$f"
done

# ── 4. Subir configuración ────────────────────────────────────────────────────
echo "[3/4] Subiendo configuración..."

for f in config/topics.yaml config/zones.yaml; do
  [[ -f "$f" ]] && $DEPLOY --put "$f" "$REMOTE/$f"
done

# ── 5. Build frontend y reiniciar servicios en el servidor ────────────────────
echo "[4/4] Build frontend y restart..."

$DEPLOY "
  set -e
  cd $REMOTE
  npm --prefix frontend install --silent
  npm --prefix frontend run build
  docker compose restart api
  echo '✓ Deploy completado'
"

echo ""
echo "✅ $TARGET actualizado correctamente."
echo ""
if [[ "$TARGET" == "staging" ]]; then
  echo "   Para promover a production:"
  echo "     git checkout main && git merge staging && ./deploy.sh production"
fi
