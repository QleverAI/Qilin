# Mobile Aesthetic Rework — Fase 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rediseñar la experiencia visual post-login de la app móvil Qilin para dar un aspecto moderno y premium acorde con la marca.

**Estilo elegido:** Editorial Oscuro · Dual accent Oro + Cian · Tab bar minimal con puntos.

**Alcance Fase 1:** Tema global, componentes compartidos y vistas Home, Noticias, Intel, Más.

---

## Sistema de diseño

### Paleta de colores

| Token | Valor | Uso |
|-------|-------|-----|
| `bg0` | `#08090d` | Fondo de pantalla principal (reemplaza `#000000`) |
| `bg1` | `#111318` | Fondo de tarjetas (reemplaza `#1c1c1e`) |
| `bg2` | `#1a1d24` | Fondo de inputs y elementos secundarios |
| `bg3` | `#22262f` | Bordes de hover / bg terciario |
| `separator` | `rgba(255,255,255,0.05)` | Líneas divisoras |
| `gold` | `#c8a03c` | Estado activo, live badges, branding, tab activo |
| `goldFill` | `rgba(200,160,60,0.08)` | Fondo tonal dorado |
| `goldBorder` | `rgba(200,160,60,0.20)` | Borde tonal dorado |
| `teal` | `#64d2ff` | Categorías tácticas (aéreo, marítimo, intel) |
| `tealFill` | `rgba(100,210,255,0.07)` | Fondo tonal cian |
| `tealBorder` | `rgba(100,210,255,0.18)` | Borde tonal cian |
| `red` | `#ff453a` | Alertas críticas / logout |
| `green` | `#30d158` | Estados OK / severidad baja |
| `amber` | `#ffd60a` | Severidad media |

Mantener todos los demás tokens existentes (`txt1`, `txt2`, `txt3`, `blue`, `indigo`…).

### Tipografía

| Rol | Tamaño | Peso | Color |
|-----|--------|------|-------|
| Label de categoría | 10px | 700 | `gold`, `letter-spacing: 2px` |
| Título de página | 22–24px | 900 | `#fff`, `letter-spacing: -0.5px` |
| Tarjeta título | 12–13px | 600 | `#fff` / `txt2`, `line-height: 1.4` |
| Meta / timestamp | 9–10px | 400 | `txt3` |
| Número grande stat | 20px | 900 | acento de color |

### Anatomía de tarjeta (patrón principal)

```
┌──────────────────────────────────────────┐
│ [borde izquierdo 2-3px color severidad]  │
│ LABEL CATEGORÍA (10px oro/cian)          │
│ Título del item (12-13px 600 blanco)     │
│ fuente · hace X min (9px txt3)           │
└──────────────────────────────────────────┘
```

- `background: rgba(255,255,255,0.04)` en item destacado, `transparent` en el resto
- `border-left: 3px solid <severityColor>` — width `0 12px 0 0` padding derecho
- Separadores entre items: `1px solid rgba(255,255,255,0.05)`
- Sin `elevation`/sombras — profundidad por opacidad

### Stat tile (patrón)

```
background: <colorFill>
border: 1px solid <colorBorder>
border-radius: 10px
padding: 8px
número: 20px 900 <color>
label: 8px txt3 letter-spacing 0.5px UPPERCASE
```

### PageHeader (nuevo patrón)

```
LABEL CATEGORÍA (10px oro, tracking 2px)   ← nuevo
Título (22px 900 blanco -0.5px tracking)   ← reemplaza largeTitle 34px
```

Sin separador `hairlineWidth`. Reemplazado por `border-bottom: 1px solid rgba(255,255,255,0.05)`.

### Tab bar

- Fondo: `bg0` / `rgba(8,9,13,0.97)`
- `border-top: 1px solid rgba(255,255,255,0.05)`
- Ícono activo: opacidad 1, punto dorado `4×4px border-radius 2px background gold` debajo
- Ícono inactivo: `opacity: 0.28`
- Sin labels de texto

---

## Archivos a modificar

### Fase 1A — Tema y componentes compartidos

| Archivo | Cambio |
|---------|--------|
| `mobile/src/theme/index.js` | Actualizar `C.bg0`, `C.bg1`, `C.bg2`, `C.bg3`, `C.separator`; añadir `C.gold`, `C.goldFill`, `C.goldBorder`, `C.teal`, `C.tealFill`, `C.tealBorder` |
| `mobile/src/components/PageHeader.jsx` | Nuevo patrón: label dorado + título bold; reemplazar separador |
| `mobile/src/components/StatTile.jsx` | Añadir soporte de `colorFill` y `colorBorder`; aplicar nuevo tamaño/peso |
| `mobile/src/components/SectionHeader.jsx` | Label dorado tracking; sin fondo de separador |
| `mobile/src/components/FilterPill.jsx` | Pill activo con borde dorado tonal; inactivo con borde `rgba(255,255,255,0.08)` |
| `mobile/src/components/SeverityBadge.jsx` | Revisar que usa tokens del tema |
| `mobile/src/app/(tabs)/_layout.jsx` | Tab bar: punto dorado bajo activo, quitar labels, `opacity: 0.28` en inactivos |

### Fase 1B — Vistas principales

| Archivo | Cambio |
|---------|--------|
| `mobile/src/app/(tabs)/index.jsx` | Aplicar nuevo tema: fondo `bg0`, stats tiles con acento, cards con borde izquierdo, header dorado |
| `mobile/src/app/(tabs)/news.jsx` | Hero card con imagen + gradiente; lista compacta con borde izquierdo de severidad; header compacto |
| `mobile/src/app/(tabs)/intel.jsx` | Timeline con borde izquierdo dorado; badge LIVE dorado; header cian |
| `mobile/src/app/(tabs)/more.jsx` | Grupos con label dorado; icon boxes con fondo tonal; separadores sutiles |

---

## Vistas — detalle de cambios

### Home (`index.jsx`)

**Header:**
- Label: `QILIN INTEL` en oro 10px tracking 2px
- Título: `Situación` 24px 900
- Badge WS status: punto verde + texto verde 10px (reemplaza wsBadge actual)

**Stats strip:**
- 3 tiles con `goldFill`/`tealFill`/`redFill` + borde tonal
- Número 20px 900, label 8px uppercase

**Sección alertas:**
- Label sección: `ÚLTIMAS ALERTAS` 10px txt3 tracking 2px
- Cards con borde izquierdo `red`/`amber`/`green` según severidad
- Card más reciente: `background: rgba(255,69,58,0.06)` si es high
- Meta: `CATEGORÍA · hace X min` en 9px txt3

**Quick access (sección Acceso rápido):**
- Reemplazar por lista de items igual que `more.jsx` con icon boxes tonales

### Noticias (`news.jsx`)

**Layout:**
- Hero card con imagen + gradiente negro abajo para leer el título encima
- Resto: lista compacta (sin `FlatList` con `numColumns` — siempre lista vertical editorial en móvil)
- Cada item de lista: `padding: 10px 0`, `border-bottom: 1px solid rgba(255,255,255,0.05)`, borde izquierdo 2px de color severidad

**Search bar:**
- `background: rgba(255,255,255,0.05)`, `border-radius: 8px`, sin borde visible
- Placeholder 11px txt3

**Filter pills (sin cambio funcional):**
- Activo: `background: goldFill`, `border: 1px solid goldBorder`, texto `gold`
- Inactivo: `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.08)`, texto txt3

### Intel (`intel.jsx`)

**Header:**
- Label: `INTEL · TIMELINE` en oro
- Badge LIVE: `border-radius: 20px`, fondo `goldFill`, borde `goldBorder`, punto `gold` animado (pulsing)

**Timeline items:**
- Borde izquierdo dorado con opacidad decreciente según antigüedad: 100% → 40% → 15%
- Item más reciente: `background: rgba(200,160,60,0.05)`
- Label de dominio (MARÍTIMO / AÉREO / DIPLOMACIA) en teal 9px tracking 1px arriba del título

### Más (`more.jsx`)

**Grupos:**
- Label de sección: 9px txt3 tracking 2px (ya está bien)
- Tarjeta del grupo: `background: rgba(255,255,255,0.04)` (reemplaza `C.bg1`)
- Icon box: `border-radius: 7px` (reemplaza 8px), mantener colores tonales

**Items:**
- Padding: `9px 12px` (reemplaza 12px 14px)
- Label: 12px weight 500 (reemplaza 16px)
- Chevron: `rgba(255,255,255,0.2)` (reemplaza `C.txt3`)

---

## Fuera de alcance (Fase 1)

- Tactical map (ya tiene su propio rework en progreso)
- Social, Documents, Markets, SEC, Polymarket, Sentinel, Chat → Fase 2
- Animaciones de transición entre pantallas
- Modo claro (se mantiene como está en Home)
