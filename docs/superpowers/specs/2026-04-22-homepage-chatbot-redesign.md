# Homepage Personalizado + Chatbot Rediseño — Design Spec

## Goal

1. **ChatBot**: rediseño visual "soft tactical" — panel redondeado, header en pill, burbujas de chat asimétricas.
2. **INICIO**: reemplazar el grid 2×2 mockado por un stack vertical personalizado basado en favoritos del usuario — aeronaves, cuentas sociales, portales de noticias y organizaciones de documentos — con preview de informes y alertas.

---

## Architecture

### Backend

**Nueva tabla:** `user_source_favorites`
```sql
CREATE TABLE IF NOT EXISTS user_source_favorites (
    username     TEXT        NOT NULL,
    source_type  TEXT        NOT NULL,  -- 'news' | 'social' | 'docs'
    source_id    TEXT        NOT NULL,  -- RSS slug, account handle, org id
    source_name  TEXT,
    added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS src_fav_user_type_idx ON user_source_favorites (username, source_type);
```

**Límites por tipo:** 10 favoritos por `source_type` (social, news, docs). 20 aeronaves (ya existe).

**Nuevos endpoints** (todos requieren JWT):

- `GET /source-favorites` → `{ news: [...], social: [...], docs: [...] }` cada entrada `{ source_id, source_name, added_at }`
- `POST /source-favorites/{type}/{source_id}` — body `{ "source_name": "..." }` — inserta; 409 ignorado graciosamente; rechaza si ya hay 10 del tipo
- `DELETE /source-favorites/{type}/{source_id}` — elimina; 404 ignorado

### Frontend — Archivos nuevos

- `frontend/src/hooks/useSourceFavorites.js` — fetch/add/remove favoritos de fuentes con actualizaciones optimistas
- `frontend/src/hooks/useReports.js` — fetch `GET /api/reports?limit=2` para obtener últimos diario y semanal

### Frontend — Archivos modificados

- `frontend/src/components/ChatBot.jsx` — rediseño visual (solo CSS/JSX, misma lógica)
- `frontend/src/pages/HomePage.jsx` — reescritura completa con stack personalizado
- `frontend/src/pages/SocialPage.jsx` — añadir botón ★ en lista de cuentas
- `frontend/src/pages/NewsPage.jsx` — añadir botón ★ en panel de fuentes
- `frontend/src/pages/DocumentsPage.jsx` — añadir botón ★ en lista de organizaciones
- `db/init.sql` — añadir tabla `user_source_favorites`
- `services/api/main.py` — añadir 3 nuevos endpoints

### Backend — Sin cambios

Los endpoints `/reports`, `/reports/latest/daily`, `/reports/latest/weekly` ya existen.

---

## ChatBot — Rediseño Visual

`borderRadius` del panel: `10px`. `boxShadow`: `0 4px 40px rgba(0,0,0,0.7), 0 0 20px rgba(0,200,255,0.06)`.

**Header:** pill `border-radius: 20px` con dot animado + texto "ASISTENTE QILIN". Botón limpiar a la derecha.

**Burbujas:**
- Asistente: `border-radius: 6px 12px 12px 6px`
- Usuario: `border-radius: 12px 6px 6px 12px`

**Input:** `border-radius: 8px`. Botón enviar: `border-radius: 8px`.

**Botón flotante:** sin cambios (ya es circular).

---

## Hook: `useSourceFavorites.js`

```
Returns: { favorites, loading, isFavorite, toggleFavorite, canAddMore }
```

- `favorites`: `{ news: [...], social: [...], docs: [...] }` — cada entrada `{ source_id, source_name, added_at }`
- `loading`: boolean
- `isFavorite(type, sourceId)`: boolean
- `toggleFavorite(type, sourceId, sourceName)`: optimistic add/remove; revierte en error
- `canAddMore(type)`: `favorites[type].length < 10`
- Fetches `GET /api/source-favorites` on mount (una vez)

---

## Hook: `useReports.js`

```
Returns: { daily, weekly, loading }
```

- Fetches `GET /api/reports?limit=10` on mount
- `daily`: primer report con `report_type === 'daily'` o `null`
- `weekly`: primer report con `report_type === 'weekly'` o `null`
- Cada report: `{ id, report_type, period_start, period_end, generated_at, filename, file_size_kb, alert_count, top_severity }`
- Sin polling (los informes se generan máximo 1 vez al día)

---

## HomePage — Stack Vertical

Props: `{ aircraft, alerts, onNavigate }` (igual que ahora).

Hooks internos: `useNewsFeed`, `useDocsFeed`, `useSocialFeed`, `useFavorites`, `useSourceFavorites`, `useReports`.

**Secciones en orden:**

### 1. Status strip (siempre)
Igual que ahora: ADS-B count, alertas count, noticias count, estado informes (LIVE/SIN DATOS).

### 2. Informes generados (siempre)
Dos cards side-by-side: diario y semanal.
- Cada card muestra: tipo, fecha (`period_start`), `alert_count`, `top_severity`, tamaño en MB.
- Botón `↓ PDF` → `window.open('/api/reports/latest/daily')` o weekly.
- Si `daily === null`: card con texto "Sin informe diario generado aún".
- Si `weekly === null`: similar.

### 3. Señales convergentes (condicional: solo si `signals.length > 0`)
Igual que `CorrelationPanel` actual — sin cambios.

### 4. ★ Mis aeronaves (condicional: solo si `favorites.length > 0`)
Pills con `{ callsign, icao24 }`. Para cada favorita, busca en `aircraft` array si está live (ADS-B activo).
- Si live → muestra altitud + estado "EN VUELO" / "EN TIERRA"
- Si no live → muestra icao24 + "Sin datos recientes" en muted

Si `favorites.length === 0` → muestra bloque de stats genérico (aeronaves totales, militares, civiles) — igual que `TacticalPreview` actual.

### 5. ★ Mis cuentas sociales (condicional: OCULTO si `sourceFavs.social.length === 0`)
Últimos posts de cuentas favoritas (filtra `posts` de `useSocialFeed` por `handle` en `sourceFavs.social`).
Muestra hasta 4 posts. Header: "★ MIS CUENTAS SOCIALES".

### 6. ★ Mis portales de noticias
- Si `sourceFavs.news.length > 0`: filtra artículos de `useNewsFeed` por `source` en favoritos. Header "★ MIS PORTALES".
- Si `sourceFavs.news.length === 0`: muestra top 4 artículos por severidad (generalista). Header "ÚLTIMAS NOTICIAS".
- Muestra hasta 4 artículos con dot de severidad + fuente.

### 7. ★ Mis organizaciones (condicional: OCULTO si `sourceFavs.docs.length === 0`)
Filtra `docs` de `useDocsFeed` por `source` en favoritos de tipo docs.
Muestra hasta 4 documentos. Header "★ MIS ORGANIZACIONES".

### 8. Alertas activas (condicional: solo si `alerts.length > 0`)
Strip horizontal scrollable igual que ahora.

---

## Botones ★ en páginas existentes

### SocialPage.jsx
En la lista de cuentas (accounts), añadir botón ★ en cada fila:
- `isFavorite('social', account.handle)` → gold si ya favorito
- `onClick`: `toggleFavorite('social', account.handle, account.name || account.handle)`
- Si `!canAddMore('social')` y no es ya favorito → botón deshabilitado con tooltip "Límite 10"

### NewsPage.jsx
En el panel de fuentes (sources), añadir botón ★:
- `isFavorite('news', source.slug || source.url)` → gold
- `onClick`: `toggleFavorite('news', source.slug || source.url, source.name)`

### DocumentsPage.jsx
En la lista de organizaciones (sources), añadir botón ★:
- `isFavorite('docs', source.id || source.slug)` → gold
- `onClick`: `toggleFavorite('docs', source.id || source.slug, source.name)`

---

## API Endpoints

```python
# GET /source-favorites
# Returns {"news": [...], "social": [...], "docs": [...]}

# POST /source-favorites/{type}/{source_id}
# Body: {"source_name": "..."}
# type must be one of: news, social, docs
# 409 if already exists (ignored)
# 422 if type invalid
# 400 if limit reached (10 per type)

# DELETE /source-favorites/{type}/{source_id}
# 404 if not found (ignored gracefully)
```

---

## Reglas de visibilidad

| Sección | Condición para mostrar |
|---------|----------------------|
| Status strip | siempre |
| Informes | siempre (vacío si sin datos) |
| Señales convergentes | `signals.length >= 1` |
| ★ Aeronaves | `favorites.length > 0`; si no → stats genéricos |
| ★ Social | `sourceFavs.social.length > 0` |
| ★ Noticias | siempre (personalizado si hay fav; generalista si no) |
| ★ Docs | `sourceFavs.docs.length > 0` |
| Alertas activas | `alerts.length > 0` |

---

## Error Handling

- `GET /source-favorites` falla → `favorites = { news: [], social: [], docs: [] }`, sin crash
- `POST /source-favorites` falla → revertir add optimista, silencioso
- `DELETE /source-favorites` falla → revertir remove optimista, silencioso
- `GET /reports` falla → `daily = null`, `weekly = null`, cards muestran "Sin informe"
- Feeds (news/social/docs) fallan → secciones muestran "Sin datos" sin crashear la página

---

## Out of Scope

- Subir o generar informes desde el frontend (solo preview/download)
- Notificaciones cuando una fuente favorita publica algo nuevo
- Sorting/filtering de favoritos
- Compartir favoritos entre usuarios
- Límites configurables por usuario (el límite es 10 fijo por ahora)
