# Qilin Design Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Qilin design system (neutral near-black palette, Inter font, accent-only color, no glows) to all web and mobile UI files.

**Architecture:** CSS variables in `index.css` are the foundation — changing them propagates to most components. Files with hardcoded `#00c8ff`/`rgba(0,200,255,...)` and `boxShadow: '0 0 ...'` glows need manual updates. `LoginPage.jsx` needs a full palette swap. Mobile theme is updated in one file.

**Tech Stack:** React 18 + Vite (web inline styles), React Native + Expo SDK 54 (mobile StyleSheet)

**Design system reference:** `C:\Users\Usuario\.claude\skills\qilin-design\SKILL.md`

---

### Task 1: CSS foundation — index.css + index.html

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

No automated test possible for CSS — visual verification is the test. This task is commit-only.

- [ ] **Step 1: Update `frontend/index.html`** — swap Barlow Condensed for Inter

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>QILIN — Geopolitical Intelligence</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace all CSS variables in `frontend/src/index.css`**

Find the `:root { ... }` block and replace it entirely. The full new block (keep any existing `@keyframes`, scrollbar styles, etc. below it unchanged):

```css
:root {
  --bg-0:       #0c0c0e;
  --bg-1:       #131316;
  --bg-2:       #1a1a1f;
  --bg-3:       #222228;
  --border:     rgba(255,255,255,0.06);
  --border-md:  rgba(255,255,255,0.11);
  --border-hi:  rgba(255,255,255,0.20);
  --accent:     #4f9cf9;
  --accent-dim: rgba(79,156,249,0.12);
  --cyan:       #4f9cf9;
  --cyan-dim:   rgba(79,156,249,0.15);
  --green:      #34d399;
  --amber:      #f59e0b;
  --red:        #f43f5e;
  --txt-1:      #e8eaf0;
  --txt-2:      #7a8699;
  --txt-3:      #3f4a5c;
  --mono:       'IBM Plex Mono', monospace;
  --ui:         'Inter', sans-serif;
}
```

Note: `--cyan` and `--cyan-dim` are kept as aliases pointing to the new accent values so that components not yet migrated continue to work.

- [ ] **Step 3: Update `body` font-family if present in index.css**

Find the `body` rule. Change `font-family` to use `--ui`:

```css
body {
  font-family: var(--ui);
  /* keep all other existing properties */
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "style: update CSS foundation — Inter font, neutral palette, accent replaces cyan"
```

---

### Task 2: TopBar — remove hardcoded cyan, remove WS glow

**Files:**
- Modify: `frontend/src/components/TopBar.jsx`

Changes: replace `#00c8ff` in SVG with `var(--accent)`, remove `boxShadow: 0 0 5px` from WS dot, clock color `var(--cyan-dim)` → `var(--txt-2)`, logo text `var(--cyan)` stays (it uses CSS var which now maps to accent).

- [ ] **Step 1: Replace hardcoded `#00c8ff` in `LogoIcon` SVG**

Replace the entire `LogoIcon` function:

```jsx
function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="11" stroke="var(--accent)" strokeWidth="1.2" opacity=".4"/>
      <circle cx="13" cy="13" r="7"  stroke="var(--accent)" strokeWidth="1.2" opacity=".6"/>
      <circle cx="13" cy="13" r="3"  fill="var(--accent)" opacity=".9"/>
      <line x1="13" y1="2"  x2="13" y2="6"  stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
      <line x1="13" y1="20" x2="13" y2="24" stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
      <line x1="2"  y1="13" x2="6"  y2="13" stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
      <line x1="20" y1="13" x2="24" y2="13" stroke="var(--accent)" strokeWidth="1" opacity=".5"/>
    </svg>
  )
}
```

- [ ] **Step 2: Remove glow from WS status dot, fix clock color**

In the `return` of `TopBar`, find the WS status dot div and remove `boxShadow`:

```jsx
{/* WS status */}
<div style={{
  display:'flex', alignItems:'center', gap:'5px',
  fontFamily:'var(--mono)', fontSize:'10px', color: wsColor,
}}>
  <div style={{
    width:'5px', height:'5px', borderRadius:'50%',
    background: wsColor,
    animation: 'blink 2.4s ease-in-out infinite',
  }} />
  {wsLabel}
</div>
```

Find the clock div and change `var(--cyan-dim)` to `var(--txt-2)`:

```jsx
{/* Clock */}
<div style={{ fontFamily:'var(--mono)', fontSize:'12px', color:'var(--txt-3)', letterSpacing:'.08em' }}>
  UTC <span style={{ color:'var(--txt-2)' }}>{time}</span>
</div>
```

Also find the alerts badge WS-status dot inside `{alertsTotal > 0 && ...}` — the inner red dot already has `boxShadow:'0 0 5px var(--red)'`. Remove that too:

```jsx
<div style={{
  width:'5px', height:'5px', borderRadius:'50%',
  background:'var(--red)',
  animation:'blink 1.2s ease-in-out infinite',
}} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TopBar.jsx
git commit -m "style(topbar): remove hardcoded cyan, remove glow shadows"
```

---

### Task 3: BottomBar + FilterPanel

**Files:**
- Modify: `frontend/src/components/BottomBar.jsx`
- Modify: `frontend/src/components/FilterPanel.jsx`

Changes: BottomBar `var(--cyan)` icon → `var(--accent)`, remove `animation:'liveRing'` glow-dependent animation from LIVE dot (or ensure it's non-glow). FilterPanel hardcoded `#00c8ff` → replaced by `var(--accent)` hex `#4f9cf9`.

- [ ] **Step 1: Update BottomBar** — replace `var(--cyan)` with `var(--accent)` for the aircraft icon color and fix LIVE dot

```jsx
const items = [
  { icon:'▲', color:'var(--accent)', value: stats.aircraftTotal, label:'aeronaves' },
  { icon:'▲', color:'var(--red)',    value: stats.aircraftMil,   label:'militares' },
  { icon:'●', color:'var(--red)',    value: stats.alertsHigh,    label:'high'      },
  { icon:'●', color:'var(--amber)',  value: stats.alertsMedium,  label:'medium'    },
]
```

LIVE dot — remove `animation` (the `liveRing` animation likely has a glow — use `blink` instead or static):

```jsx
<div style={{
  width:'8px', height:'8px', borderRadius:'50%',
  background:'var(--green)',
}} />
```

- [ ] **Step 2: Update FilterPanel** — replace the `FILTERS_CONFIG` hardcoded hex colors

```jsx
const FILTERS_CONFIG = [
  { key:'civil',             icon:'▲', label:'Civil',      color:'#4f9cf9' },
  { key:'military_aircraft', icon:'▲', label:'Mil. Aéreo', color:'#f43f5e' },
  { key:'alerts',            icon:'●', label:'Alertas',    color:'#f43f5e' },
]
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BottomBar.jsx frontend/src/components/FilterPanel.jsx
git commit -m "style(chrome): fix hardcoded cyan colors, remove liveRing glow in BottomBar"
```

---

### Task 4: AlertPanel — remove gradient overlay, fix accent color

**Files:**
- Modify: `frontend/src/components/AlertPanel.jsx`

Changes: remove the colored `linear-gradient` tint overlay div inside `AlertCard` (it's a SEV_BG tinted gradient — replace with nothing since the left border already signals severity), update `var(--cyan)` count badge to `var(--accent)`, update `var(--cyan)` in stats grid to `var(--accent)`, update `SEV_BG`/`SEV_BORDER` constants to use new red/amber/green hex values.

- [ ] **Step 1: Update SEV constants to new hex values**

```jsx
const SEV_COLOR  = { high:'var(--red)',   medium:'var(--amber)', low:'var(--green)' }
const SEV_BG     = { high:'rgba(244,63,94,0.10)',  medium:'rgba(245,158,11,0.09)', low:'rgba(52,211,153,0.08)' }
const SEV_BORDER = { high:'rgba(244,63,94,0.28)',  medium:'rgba(245,158,11,0.26)', low:'rgba(52,211,153,0.20)' }
const SEV_LEFT   = { high:'var(--red)',   medium:'var(--amber)', low:'var(--green)' }
```

- [ ] **Step 2: Remove tint overlay div from `AlertCard`**

In `AlertCard`'s return, delete the entire gradient overlay `<div>`:

```jsx
// DELETE this entire div:
// <div style={{
//   position:'absolute', inset:0, pointerEvents:'none',
//   background:`linear-gradient(90deg, ${SEV_BG[alert.severity]} 0%, transparent 100%)`,
// }} />
```

Also remove `position:'relative'` and `overflow:'hidden'` from the card outer div since the overlay is gone, and remove `position:'relative', zIndex:1` from the inner content div.

The cleaned-up `AlertCard` return:

```jsx
return (
  <div
    onClick={onClick}
    style={{
      margin:'4px 8px',
      padding:'10px 12px',
      background:'var(--bg-2)',
      border:'1px solid var(--border)',
      borderLeft:`3px solid ${SEV_LEFT[alert.severity]}`,
      borderRadius:'2px',
      cursor:'pointer',
      transition:'border-color .15s',
    }}
    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-md)'}
    onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}
  >
    <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'5px' }}>
      <span style={{
        fontSize:'8px', fontWeight:'700', letterSpacing:'.15em',
        textTransform:'uppercase', padding:'2px 6px', borderRadius:'2px',
        fontFamily:'var(--mono)', flexShrink:0,
        background: SEV_BG[alert.severity],
        color: SEV_COLOR[alert.severity],
        border: `1px solid ${SEV_BORDER[alert.severity]}`,
      }}>
        {alert.severity.toUpperCase()}
      </span>
      <span style={{
        fontSize:'10px', fontWeight:'600', letterSpacing:'.12em',
        textTransform:'uppercase', color:'var(--txt-2)',
        fontFamily:'var(--mono)',
      }}>{alert.zone}</span>
      <span style={{ marginLeft:'auto', fontSize:'9px', color:'var(--txt-3)', fontFamily:'var(--mono)' }}>
        {alert.time} UTC
      </span>
    </div>
    <div style={{ fontSize:'12px', fontWeight:'600', letterSpacing:'.03em', color:'var(--txt-1)', lineHeight:1.3, marginBottom:'4px' }}>
      {alert.title}
    </div>
    <div style={{ fontSize:'10px', color:'var(--txt-2)', lineHeight:1.5 }}>
      {alert.desc}
    </div>
  </div>
)
```

- [ ] **Step 3: Fix accent color in panel header and stats grid**

In `AlertPanel` return, find the alerts count badge. Change `color:'var(--cyan)'` to `color:'var(--accent)'`:

```jsx
<span style={{
  fontFamily:'var(--mono)', fontSize:'10px',
  background:'var(--bg-3)', border:'1px solid var(--border-md)',
  borderRadius:'2px', padding:'1px 7px', color:'var(--accent)',
}}>{alerts.length}</span>
```

In the stats grid, change the aircraft cell color from `var(--cyan)` to `var(--accent)`:

```jsx
{ label:'Aeronaves',   value: stats.aircraftTotal, sub:`${stats.aircraftMil} militares`, color:'var(--accent)' },
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AlertPanel.jsx
git commit -m "style(alert-panel): remove gradient overlay, hover border-only, fix accent color"
```

---

### Task 5: HomePage — remove glows, fix accent, remove emoji in DocPreview

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx`

Changes: `ModuleCard` hover remove `boxShadow` and cyan `borderColor`, use `var(--border-md)` on hover only; status dots remove `boxShadow` glow; `var(--cyan)` → `var(--accent)`; `DocsPreview` emoji icons → text glyphs; Social module status color → `var(--accent)`.

- [ ] **Step 1: Fix `ModuleCard` hover — remove glow, use border-color only**

Replace the `onMouseEnter`/`onMouseLeave` handlers on the card div:

```jsx
onMouseEnter={e => {
  e.currentTarget.style.borderColor = 'var(--border-md)'
}}
onMouseLeave={e => {
  e.currentTarget.style.borderColor = 'var(--border)'
}}
```

Remove `box-shadow` from `transition` (change to just `border-color .15s`):

```jsx
transition: 'border-color .15s',
```

- [ ] **Step 2: Fix title color in `ModuleCard` header — `var(--cyan)` → `var(--accent)`**

```jsx
<div style={{ fontSize:'11px', fontWeight:'700', letterSpacing:'.18em', color:'var(--accent)', textTransform:'uppercase' }}>
  {title}
</div>
```

- [ ] **Step 3: Remove glow from status dot in `ModuleCard` header**

```jsx
<div style={{
  width:'5px', height:'5px', borderRadius:'50%',
  background: statusColor,
  animation: 'blink 2.4s ease-in-out infinite',
}} />
```

- [ ] **Step 4: Fix system status strip — remove glow from status dots**

Find the system status strip dots and remove `boxShadow`:

```jsx
<div style={{
  width:'5px', height:'5px', borderRadius:'50%',
  background: item.color,
  animation:'blink 2.4s ease-in-out infinite',
}} />
```

- [ ] **Step 5: Fix `SocialPreview` — `var(--cyan)` → `var(--accent)`**

```jsx
<div style={{ fontSize:'10px', color:'var(--accent)', fontFamily:'var(--mono)' }}>{t.topic}</div>
```

- [ ] **Step 6: Fix `DocsPreview` — replace emoji with text glyphs**

Replace the emoji span:

```jsx
<span style={{ fontSize:'11px', flexShrink:0, fontFamily:'var(--mono)', color:'var(--txt-3)' }}>
  {d.type === 'pdf' ? '[PDF]' : d.type === 'docx' ? '[DOC]' : '[XLS]'}
</span>
```

- [ ] **Step 7: Fix Social module `statusColor` — `var(--cyan)` → `var(--accent)`**

```jsx
<ModuleCard
  title="Redes Sociales"
  icon="◉"
  subtitle="X · TELEGRAM · MONITORIZACIÓN ZONAS"
  status={`${TRENDING_TOPICS.length} TRENDING`}
  statusColor="var(--accent)"
  onClick={() => onNavigate('social')}
>
```

Also the "ABRIR →" enter hint in `ModuleCard`:

```jsx
<div style={{
  position:'absolute', bottom:10, right:12,
  fontFamily:'var(--mono)', fontSize:'9px', color:'rgba(79,156,249,0.25)',
  letterSpacing:'.1em', pointerEvents:'none',
}}>
  ABRIR →
</div>
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/HomePage.jsx
git commit -m "style(home): remove glows, hover border-only, accent replaces cyan"
```

---

### Task 6: NewsPage + DocumentsPage — accent colors, fix FilterGroup

**Files:**
- Modify: `frontend/src/pages/NewsPage.jsx`
- Modify: `frontend/src/pages/DocumentsPage.jsx`

Changes: `FilterGroup` active state `rgba(0,200,255,0.08)` → `var(--accent-dim)`, `var(--cyan)` → `var(--accent)`; country badge `var(--cyan)` → `var(--accent)`; link buttons `rgba(0,200,255,...)` → accent equivalents; hover on cards use `border-color` only (remove `background` change on hover for `NewsCard`).

- [ ] **Step 1: Update `FilterGroup` in NewsPage to use `--accent`**

In NewsPage's `FilterGroup` component, replace the active state button style:

```jsx
<button key={opt} onClick={() => onChange(opt)} style={{
  display: 'block', width: '100%', textAlign: 'left',
  background: value === opt ? 'var(--accent-dim)' : 'none',
  border: 'none',
  borderLeft: `2px solid ${value === opt ? 'var(--accent)' : 'transparent'}`,
  color: value === opt ? 'var(--accent)' : 'var(--txt-3)',
  fontFamily: 'var(--mono)', fontSize: '9px', letterSpacing: '.06em',
  padding: '4px 8px', cursor: 'pointer', transition: 'color .15s',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  textTransform: 'uppercase',
}}>
```

- [ ] **Step 2: Update `NewsCard` hover — border-color only**

```jsx
onMouseEnter={e => {
  e.currentTarget.style.borderColor = 'var(--border-md)'
}}
onMouseLeave={e => {
  e.currentTarget.style.borderColor = 'var(--border)'
}}
```

Remove `background` changes from hover handlers. Keep `background:'var(--bg-2)'` in base style.

- [ ] **Step 3: Update country badge and link button in NewsPage**

In `NewsCard`, country badge:
```jsx
{article.source_country && (
  <span style={{ fontSize: '8px', fontFamily: 'var(--mono)', color: 'var(--accent)', flexShrink: 0 }}>
    {article.source_country}
  </span>
)}
```

In `NewsModal`, country badge:
```jsx
{article.source_country && (
  <span style={{ fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--accent)', letterSpacing: '.06em' }}>
    [{article.source_country}]
  </span>
)}
```

In `NewsModal`, link button — replace cyan-based colors with accent:
```jsx
style={{
  display: 'inline-block',
  padding: '8px 20px',
  background: 'var(--accent-dim)',
  border: '1px solid rgba(79,156,249,0.3)',
  borderRadius: '2px',
  color: 'var(--accent)',
  fontFamily: 'var(--mono)',
  fontSize: '10px',
  fontWeight: '700',
  letterSpacing: '.1em',
  textDecoration: 'none',
  transition: 'background .15s',
}}
onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,156,249,0.2)'}
onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-dim)'}
```

- [ ] **Step 4: Update DocumentsPage `FilterGroup` — same as NewsPage**

In DocumentsPage's `FilterGroup`, apply identical fix (same code as Step 1 above).

- [ ] **Step 5: Update `DocRow` selected border, country badge, and link button**

`DocRow` selected border: replace `rgba(0,200,255,0.3)` → `rgba(79,156,249,0.3)`:

```jsx
border: `1px solid ${selected ? 'rgba(79,156,249,0.3)' : 'transparent'}`,
```

Country badge in `DocRow` and `DocDetail`:
```jsx
<span style={{ fontFamily: 'var(--mono)', fontSize: '8px', color: 'var(--accent)' }}>
  [{doc.source_country}]
</span>
```

Link button in `DocDetail` — same accent pattern as NewsModal.

- [ ] **Step 6: Remove emoji from DocDetail and DocRow org icons**

In `ORG_ICON`:
```jsx
const ORG_ICON = {
  defense:       '[DEF]',
  international: '[INT]',
  think_tank:    '[TT]',
  government:    '[GOV]',
  energy:        '[NRG]',
}
```

In `DocDetail` header, the large icon — change `fontSize:'24px'` to `fontFamily:'var(--mono)', fontSize:'11px', color:'var(--txt-3)'`.

In `DocRow`, the icon span:
```jsx
<span style={{ fontSize:'11px', flexShrink:0, marginTop:'1px', fontFamily:'var(--mono)', color:'var(--txt-3)' }}>
  {ORG_ICON[doc.org_type] || '[DOC]'}
</span>
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/NewsPage.jsx frontend/src/pages/DocumentsPage.jsx
git commit -m "style(news/docs): accent colors, hover border-only, remove emoji"
```

---

### Task 7: LoginPage — full palette redesign

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx`

The login page has heavy hardcoded `#00c8ff`, `rgba(0,200,255,...)`, `rgba(7,14,28,...)`, `Barlow Condensed` font. Replace completely with new palette. The `BackgroundCanvas` animation stays but uses neutral colors. Replace the complete file content.

- [ ] **Step 1: Replace the full LoginPage.jsx**

Replace the entire file with:

```jsx
import { useState, useEffect, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function BackgroundCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let scanY = 0
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * .0003,
      vy: (Math.random() - .5) * .0002,
      size: Math.random() * 1.2 + .4,
      alpha: Math.random() * .25 + .05,
    }))

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    function loop() {
      const w = canvas.width, h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#0c0c0e'; ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = .5
      const gs = 60
      for (let x = 0; x < w; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }
      for (let y = 0; y < h; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0
        if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(79,156,249,${p.alpha})`
        ctx.fill()
      })

      scanY = (scanY + .3) % h
      const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40)
      grad.addColorStop(0, 'rgba(79,156,249,0)')
      grad.addColorStop(.5, 'rgba(79,156,249,0.03)')
      grad.addColorStop(1, 'rgba(79,156,249,0)')
      ctx.fillStyle = grad; ctx.fillRect(0, scanY - 40, w, 80)

      const vig = ctx.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w*.8)
      vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.6)')
      ctx.fillStyle = vig; ctx.fillRect(0,0,w,h)

      requestAnimationFrame(loop)
    }
    loop()
    return () => window.removeEventListener('resize', resize)
  }, [])
  return <canvas ref={ref} style={{ position:'fixed', inset:0, zIndex:0 }} />
}

export default function LoginPage({ onLogin }) {
  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)

    try {
      const body = new URLSearchParams({ username: user, password: pass })
      const res  = await fetch(`${API_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })

      if (res.ok) {
        const data = await res.json()
        sessionStorage.setItem('qilin_token', data.access_token)
        sessionStorage.setItem('qilin_user',  data.username)
        onLogin({ username: data.username, token: data.access_token })
        return
      }
      throw new Error('unauthorized')

    } catch (err) {
      if (err.name === 'TypeError' || err.message === 'Failed to fetch') {
        setTimeout(() => {
          if (user === 'carlos' && pass === '12345') {
            onLogin({ username: user, token: null })
          } else {
            setLoading(false)
            triggerError()
          }
        }, 800)
        return
      }
      setLoading(false)
      triggerError()
    }
  }

  function triggerError() {
    setError('CREDENCIALES INVÁLIDAS — ACCESO DENEGADO')
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const fieldStyle = {
    width: '100%',
    background: 'var(--bg-2)',
    border: '1px solid var(--border-md)',
    borderBottom: '1px solid var(--border-hi)',
    color: 'var(--txt-1)',
    fontFamily: 'var(--mono)',
    fontSize: '13px',
    padding: '11px 14px',
    outline: 'none',
    letterSpacing: '.04em',
    borderRadius: '2px',
    transition: 'border-color .15s',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <BackgroundCanvas />

      <div style={{
        position: 'relative', zIndex: 1,
        width: '340px',
        animation: shake ? 'shake .4s ease' : 'fadeSlideIn .5s ease',
      }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <svg width="44" height="44" viewBox="0 0 26 26" fill="none" style={{ display:'block', margin:'0 auto 12px' }}>
            <circle cx="13" cy="13" r="11" stroke="#4f9cf9" strokeWidth="1.2" opacity=".3"/>
            <circle cx="13" cy="13" r="7"  stroke="#4f9cf9" strokeWidth="1.2" opacity=".55"/>
            <circle cx="13" cy="13" r="3"  fill="#4f9cf9"/>
            <line x1="13" y1="2"  x2="13" y2="5"  stroke="#4f9cf9" strokeWidth="1"/>
            <line x1="13" y1="21" x2="13" y2="24" stroke="#4f9cf9" strokeWidth="1"/>
            <line x1="2"  y1="13" x2="5"  y2="13" stroke="#4f9cf9" strokeWidth="1"/>
            <line x1="21" y1="13" x2="24" y2="13" stroke="#4f9cf9" strokeWidth="1"/>
          </svg>
          <div style={{ fontSize:'32px', fontWeight:'700', letterSpacing:'.3em', color:'var(--accent)', fontFamily:'var(--mono)', textTransform:'uppercase' }}>QILIN</div>
          <div style={{ fontSize:'10px', letterSpacing:'.18em', color:'var(--txt-3)', marginTop:'4px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
            Geopolitical Intelligence Platform
          </div>
        </div>

        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border-md)',
          borderTop: '3px solid var(--accent)',
          borderRadius: '3px',
          padding: '24px 24px 20px',
        }}>
          <div style={{ fontSize:'9px', fontWeight:'700', letterSpacing:'.22em', color:'var(--txt-3)', marginBottom:'18px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
            AUTENTICACIÓN REQUERIDA
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'8px', fontWeight:'600', letterSpacing:'.16em', color:'var(--txt-3)', marginBottom:'5px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
                USUARIO
              </div>
              <input
                type="text" value={user} onChange={e => setUser(e.target.value)}
                autoComplete="username" spellCheck={false}
                placeholder="identificador"
                style={fieldStyle}
                onFocus={e => e.target.style.borderColor = 'var(--border-hi)'}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.borderBottomColor = 'var(--border-hi)' }}
              />
            </div>

            <div style={{ marginBottom:'18px' }}>
              <div style={{ fontSize:'8px', fontWeight:'600', letterSpacing:'.16em', color:'var(--txt-3)', marginBottom:'5px', fontFamily:'var(--mono)', textTransform:'uppercase' }}>
                CONTRASEÑA
              </div>
              <input
                type="password" value={pass} onChange={e => setPass(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                style={fieldStyle}
                onFocus={e => e.target.style.borderColor = 'var(--border-hi)'}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.borderBottomColor = 'var(--border-hi)' }}
              />
            </div>

            {error && (
              <div style={{
                fontFamily:'var(--mono)', fontSize:'9px', fontWeight:'500',
                color:'var(--red)', letterSpacing:'.08em', marginBottom:'12px',
                padding:'7px 10px', background:'rgba(244,63,94,0.08)',
                border:'1px solid rgba(244,63,94,0.25)', borderRadius:'2px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading || !user || !pass}
              style={{
                width:'100%', padding:'12px',
                background: 'var(--accent-dim)',
                border:'1px solid rgba(79,156,249,0.3)',
                color:'var(--accent)',
                fontFamily:'var(--mono)',
                fontSize:'11px', fontWeight:'700', letterSpacing:'.2em', textTransform:'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition:'background .15s, border-color .15s', borderRadius:'2px',
                opacity: (!user || !pass) ? .45 : 1,
              }}
              onMouseEnter={e => { if(!loading && user && pass) e.target.style.background='rgba(79,156,249,0.2)' }}
              onMouseLeave={e => { if(!loading) e.target.style.background='var(--accent-dim)' }}
            >
              {loading ? '◌  AUTENTICANDO...' : 'ACCEDER AL SISTEMA'}
            </button>
          </form>
        </div>

        <div style={{
          marginTop:'14px', textAlign:'center',
          fontFamily:'var(--mono)', fontSize:'8px',
          color:'var(--txt-3)', letterSpacing:'.08em', lineHeight:1.8,
        }}>
          SISTEMA RESTRINGIDO · ACCESO NO AUTORIZADO PROHIBIDO<br />
          TODAS LAS SESIONES SON REGISTRADAS Y MONITORIZADAS
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
        @keyframes fadeSlideIn {
          from{opacity:0;transform:translateY(8px)}
          to{opacity:1;transform:translateY(0)}
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/LoginPage.jsx
git commit -m "style(login): full palette redesign — neutral bg, Inter font, accent border"
```

---

### Task 8: Mobile theme + layout

**Files:**
- Modify: `mobile/src/theme/index.js`
- Modify: `mobile/src/app/(tabs)/_layout.jsx`

Changes: Update `C` color constants to new palette, add `accent`/`accentDim`, rename `cyan` → `accent` in layout.

- [ ] **Step 1: Replace `mobile/src/theme/index.js`**

```js
export const C = {
  bg0: '#0c0c0e', bg1: '#131316', bg2: '#1a1a1f', bg3: '#222228',
  border: 'rgba(255,255,255,0.06)',
  borderMd: 'rgba(255,255,255,0.11)',
  borderHi: 'rgba(255,255,255,0.20)',
  accent: '#4f9cf9',
  accentDim: 'rgba(79,156,249,0.12)',
  cyan: '#4f9cf9',
  green: '#34d399',
  amber: '#f59e0b',
  red: '#f43f5e',
  txt1: '#e8eaf0', txt2: '#7a8699', txt3: '#3f4a5c',
}

export const FONT = { mono: 'SpaceMono', sans: 'System' }
```

Note: `cyan` kept as alias for `accent` — mobile tab files that reference `C.cyan` continue to work.

- [ ] **Step 2: Update `_layout.jsx` — replace `C.cyan` with `C.accent`**

```jsx
function TabIcon({ icon, label, focused }) {
  const color = focused ? C.accent : C.txt3
  return (
    <View style={{ alignItems:'center', gap:2, paddingTop:6 }}>
      <Text style={{ fontSize:14, color }}>{icon}</Text>
      <Text style={{ fontSize:7, letterSpacing:1, color, fontFamily:'SpaceMono' }}>{label}</Text>
    </View>
  )
}
```

And in `screenOptions`:
```jsx
tabBarActiveTintColor:   C.accent,
tabBarInactiveTintColor: C.txt3,
```

- [ ] **Step 3: Commit**

```bash
git add mobile/src/theme/index.js mobile/src/app/(tabs)/_layout.jsx
git commit -m "style(mobile): update theme to new palette, accent replaces cyan"
```

---

### Task 9: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run frontend build to check for errors**

```bash
cd frontend && npm run build 2>&1
```

Expected: build completes with no errors. Warnings about unused CSS variables are acceptable.

- [ ] **Step 2: Start dev server and visually verify key pages**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`. Check:
- Login page: neutral dark background, blue accent, no cyan grid
- Home page: cards with `var(--border)` borders, no glow on hover
- TopBar: active nav in accent blue (not cyan), no WS dot glow
- News page: card hover changes border color only, no background flash
- Alert panel: no colored gradient overlay on cards, left-border severity only

- [ ] **Step 3: Commit if build passes**

If build has errors, fix them before committing. If clean:

```bash
git add -A
git commit -m "chore: verify design overhaul build clean"
```
