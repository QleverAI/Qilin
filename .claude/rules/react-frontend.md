---
description: Reglas para el frontend React de Qilin
globs: frontend/src/**/*.{js,jsx}
---

# Reglas React — Frontend Qilin

## Estructura
- Estado global mínimo en `App.jsx`, pasado como props hacia abajo
- Lógica de datos (API calls, WebSocket) exclusivamente en `src/hooks/useQilinData.js`
- Datos mock en `src/data/` para desarrollo sin backend

## Estilos
- CSS-in-JS con objetos `style={{...}}` inline — no crear archivos `.css` por componente
- Variables CSS globales definidas en `src/index.css` (ej: `--bg-1`, `--border-md`)
- Layout con CSS Grid en `App.jsx` para la vista táctica

## Componentes
- Funcionales con hooks, sin class components
- `useMemo` para filtrar/transformar datos derivados de aircraft, vessels, alerts
- El mapa vive en `MapView.jsx` con MapLibre GL — no importar librerías de mapa en otros componentes

## API y WebSocket
- URL base de la API: relativa `/api/...` (proxy de Vite → :8000 en dev)
- WebSocket: `ws://localhost:8000/ws?token=...`
- Token JWT se guarda en estado React (no en localStorage por ahora)

## Vistas disponibles
- `home` — HomePage con resumen
- `tactical` — mapa + panel de alertas + filtros (layout grid)
- `news` — NewsPage
- `documents` — DocumentsPage
- `social` — SocialPage

## Build
- `npm run dev` — servidor de desarrollo en :3000 con HMR
- `npm run build` — build de producción en `dist/`
- Vite hace proxy de `/api` y `/ws` a `localhost:8000`
