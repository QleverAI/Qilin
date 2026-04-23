---
description: Reglas para el frontend React de Qilin
globs: frontend/src/**/*.{js,jsx}
---

# Reglas React — Frontend Qilin

## Estructura
- Estado global mínimo en `App.jsx`, pasado como props hacia abajo
- Lógica de datos (API calls, WebSocket) exclusivamente en `src/hooks/useQilinData.js`
- Datos mock en `src/data/` para desarrollo sin backend
- **Code-splitting**: todos los `pages/*` se importan con `React.lazy()` dentro de `App.jsx` y se envuelven en `<Suspense>`. El bundle inicial (`index-*.js`) ronda los 220 KB (~69 KB gzip); MapLibre (~1 MB) es un chunk propio que solo se descarga al entrar en la vista táctica. Al añadir una página nueva, mantén el patrón `const FooPage = lazy(() => import('./pages/FooPage'))`.

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

> `AnalystView` fue eliminada. `AnalystView.jsx` y `useAnalystData.js` han sido borrados. `App.jsx` ya no tiene estado `activeView` ni pasa `activeMode`/`onModeChange` a TopBar.

## Sistema i18n (ES/EN)

- Archivos de traducciones: `src/i18n/es.js` y `src/i18n/en.js` — diccionarios planos de clave → string
- Hook: `src/hooks/useLanguage.jsx` — exporta `LanguageProvider` y `useLang()`
- Provider montado en `src/main.jsx` envolviendo `<App />`
- Uso: `const { t, lang, switchLang } = useLang()` dentro de cualquier componente
- Sustitución de variables: `t('pagination.page_of', { page: 2, total: 10 })`
- Idioma persistido en `localStorage` bajo clave `qilin_lang` (default `'es'`)
- El toggle ES|EN vive en `TopBar.jsx` (mismo estilo widget que el antiguo MAP/ANALYST)
- `FilterGroup` usa `''` (string vacío) como sentinel interno para "mostrar todos" — el prop `allLabel` es solo texto de display
- Para añadir una traducción nueva: añadir la clave en ambos `es.js` y `en.js`, luego usar `t('la.clave')` en el componente

## Build
- `npm run dev` — servidor de desarrollo en :3000 con HMR
- `npm run build` — build de producción en `dist/`
- Vite hace proxy de `/api` y `/ws` a `localhost:8000`
