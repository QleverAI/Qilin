import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ChatBotPublic from '../components/ChatBotPublic'

const C = {
  bg0:'#02060e', bg1:'#040c18', bg2:'#071020',
  gold:'#c8a03c', goldLight:'#e8c060',
  goldFill:'rgba(200,160,60,0.10)', goldBorder:'rgba(200,160,60,0.22)',
  goldDim:'rgba(200,160,60,0.55)',
  txt1:'#f0f4f8', txt2:'rgba(220,230,245,0.6)', txt3:'rgba(220,230,245,0.3)',
  border:'rgba(200,160,60,0.12)',
}

// ── Viewport hook ─────────────────────────────────────────────────────────────
// Branch inline: si < 640 tratamos como móvil, 640-960 tablet, ≥ 960 desktop.
function useViewport() {
  const get = () => {
    if (typeof window === 'undefined') return { w: 1280, isMobile: false, isTablet: false }
    const w = window.innerWidth
    return { w, isMobile: w < 640, isTablet: w >= 640 && w < 960 }
  }
  const [vp, setVp] = useState(get)
  useEffect(() => {
    const onResize = () => setVp(get())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vp
}

const HERO_IMG    = 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80'
const CALLOUT_IMG = 'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=1920&q=80'

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  es: {
    nav: {
      platform: 'Plataforma', pricing: 'Precios', contact: 'Contacto',
      login: 'Iniciar sesión', cta: 'Comenzar →',
    },
    hero: {
      badge: (n) => n > 0 ? `${n}+ aeronaves activas ahora mismo` : 'Sistema activo',
      h1a: 'Ve lo que', h1b: 'otros no ven.',
      sub: 'Inteligencia geopolítica en tiempo real. Aeronaves militares y privadas, flotas navales, alertas con IA y señales satelitales — todo en un solo panel.',
      cta1: 'Solicitar acceso →', cta2: 'Ver capacidades',
    },
    stats: [
      { l:'Aeronaves activas',      s:'● En vivo ahora' },
      { l:'Perfiles de alto perfil', s:'Presidentes · Billonarios' },
      { l:'Fuentes de inteligencia', s:'Clasificadas con IA' },
      { l:'Cuentas monitorizadas',   s:'Líderes · Analistas · OSINT' },
      { l:'Cobertura global',        s:'Sin interrupciones' },
    ],
    features: {
      eyebrow: 'Capacidades',
      h2a: 'Cada capa cuenta.', h2b: 'Juntas, lo cambian todo.',
      sub: 'Qilin agrega señales de múltiples fuentes y las convierte en inteligencia accionable. Sin ruido, sin demoras.',
      cards: [
        { icon:'✈', title:'Vigilancia Aérea Global',
          desc:'Aeronaves militares de todo el mundo y aviones privados de presidentes, líderes empresariales y figuras de alto perfil — rastreados en tiempo real, con historial de rutas y detección automática de bases.' },
        { icon:'⚓', title:'Tráfico Naval',
          desc:'Buques militares, petroleros y embarcaciones de interés estratégico. Detectamos automáticamente cuando un barco desaparece del radar — uno de los indicadores más claros de actividad encubierta.' },
        { icon:'◉', title:'Alertas con Inteligencia Artificial',
          desc:'Nuestro motor correlaciona eventos de múltiples fuentes simultáneamente. La IA enriquece cada alerta con contexto antes de que llegue a ti. Notificaciones instantáneas en segundos.' },
        { icon:'📡', title:'Señales Satelitales',
          desc:'Datos de satélites de observación terrestre: anomalías atmosféricas por zona. Indicadores tempranos que anteceden a eventos militares o de infraestructura antes de cualquier comunicado oficial.' },
        { icon:'📰', title:'Inteligencia de Medios',
          desc:'Más de 500 fuentes geopolíticas globales, agregadas y clasificadas por severidad y sector en tiempo real. Nunca te pierdes la señal entre el ruido.' },
        { icon:'◆', title:'Mercados de Predicción',
          desc:'Integración con mercados de predicción para cruzar probabilidades con eventos geopolíticos. ¿El mercado ya lo sabe, o va por detrás? La diferencia puede valer mucho.' },
      ],
    },
    callout: {
      eyebrow: 'Observación terrestre',
      h2a: 'La Tierra no', h2b: 'tiene secretos.',
      p: 'Integramos datos de satélites de observación para detectar anomalías atmosféricas por zona. Cuando hay actividad inusual — industrial, militar o de infraestructura — las señales lo delatan antes que cualquier comunicado oficial.',
      note: 'Disponible en el plan Command.',
    },
    plans: {
      eyebrow: 'Precios',
      h2a: 'Elige tu nivel', h2b: 'de inteligencia.',
      sub: 'Sin contratos anuales obligatorios. Cancela cuando quieras. Empieza gratis.',
      popular: 'Más popular',
      period: '/ mes',
      items: [
        {
          tier:'Tier 01', name:'Scout', price:'$0', featured:false,
          tagline:'Para explorar la plataforma. Datos con retraso y acceso limitado.',
          feats:[
            {on:true,  t:'Mapa militar con retraso'},
            {on:true,  t:'Feed de noticias — últimas 24h'},
            {on:true,  t:'5 alertas geopolíticas al día'},
            {on:false, t:'Aviones privados'},
            {on:false, t:'Tráfico naval'},
            {on:false, t:'Notificaciones instantáneas'},
            {on:false, t:'Análisis con IA'},
          ],
          cta:'Crear cuenta gratis', plan:'scout',
        },
        {
          tier:'Tier 02', name:'Analyst', price:'$49', featured:true, popular:true,
          tagline:'Acceso completo en tiempo real. Para analistas, periodistas e investigadores.',
          feats:[
            {on:true, t:'Mapa en tiempo real — militares + privados'},
            {on:true, t:'Tráfico naval completo'},
            {on:true, t:'500+ fuentes + 300+ cuentas monitorizadas'},
            {on:true, t:'Alertas ilimitadas + notificaciones'},
            {on:true, t:'Historial de rutas y bases'},
            {on:true, t:'Documentos y mercados de predicción'},
            {on:true, t:'Informes diarios · historial 30 días'},
          ],
          cta:'Empezar prueba de 7 días →', plan:'analyst',
        },
        {
          tier:'Tier 03', name:'Command', price:'$199', featured:false,
          tagline:'Para equipos e instituciones con necesidades avanzadas de inteligencia.',
          feats:[
            {on:true, t:'Todo de Analyst incluido'},
            {on:true, t:'Datos satelitales de observación'},
            {on:true, t:'Informes semanales con análisis IA'},
            {on:true, t:'Acceso API REST'},
            {on:true, t:'Hasta 5 usuarios'},
            {on:true, t:'Historial ilimitado'},
            {on:true, t:'Soporte prioritario'},
          ],
          cta:'Contactar ventas', plan:'command',
        },
      ],
    },
    footer: {
      links: ['Términos de uso','Privacidad','Contacto','Status'],
      copy: '© 2026 Qilin Intelligence. Todos los derechos reservados.',
    },
  },

  en: {
    nav: {
      platform: 'Platform', pricing: 'Pricing', contact: 'Contact',
      login: 'Sign in', cta: 'Get started →',
    },
    hero: {
      badge: (n) => n > 0 ? `${n}+ aircraft active right now` : 'System active',
      h1a: 'See what', h1b: 'others can\'t.',
      sub: 'Real-time geopolitical intelligence. Military and private aircraft, naval fleets, AI-powered alerts, and satellite signals — all in one dashboard.',
      cta1: 'Request access →', cta2: 'See capabilities',
    },
    stats: [
      { l:'Active aircraft',         s:'● Live right now' },
      { l:'High-profile targets',    s:'Heads of state · Billionaires' },
      { l:'Intelligence sources',    s:'AI-classified' },
      { l:'Monitored accounts',      s:'Leaders · Analysts · OSINT' },
      { l:'Global coverage',         s:'Around the clock' },
    ],
    features: {
      eyebrow: 'Capabilities',
      h2a: 'Every layer matters.', h2b: 'Together, they change everything.',
      sub: 'Qilin aggregates signals from multiple sources and turns them into actionable intelligence. No noise, no delays.',
      cards: [
        { icon:'✈', title:'Global Aerial Surveillance',
          desc:'Military aircraft worldwide and private jets of heads of state, business leaders, and high-profile figures — tracked in real time, with route history and automatic base detection.' },
        { icon:'⚓', title:'Naval Traffic',
          desc:'Military vessels, tankers, and strategically relevant ships. We automatically detect when a vessel goes dark — one of the clearest indicators of covert activity.' },
        { icon:'◉', title:'AI-Powered Alerts',
          desc:'Our engine correlates events from multiple sources simultaneously. AI enriches each alert with context before it reaches you. Instant notifications within seconds.' },
        { icon:'📡', title:'Satellite Signals',
          desc:'Data from earth observation satellites: atmospheric anomalies by zone. Early indicators that precede military or infrastructure events before any official statement.' },
        { icon:'📰', title:'Media Intelligence',
          desc:'Over 500 global geopolitical sources, aggregated and classified by severity and sector in real time. Never miss the signal in the noise.' },
        { icon:'◆', title:'Prediction Markets',
          desc:'Integration with prediction markets to cross-reference probabilities with geopolitical events. Does the market already know, or is it behind? The difference can be worth a lot.' },
      ],
    },
    callout: {
      eyebrow: 'Earth observation',
      h2a: 'The Earth has', h2b: 'no secrets.',
      p: 'We integrate data from observation satellites to detect atmospheric anomalies by zone. When unusual activity occurs — industrial, military, or infrastructure — the signals reveal it before any official statement.',
      note: 'Available on the Command plan.',
    },
    plans: {
      eyebrow: 'Pricing',
      h2a: 'Choose your level', h2b: 'of intelligence.',
      sub: 'No mandatory annual contracts. Cancel anytime. Start for free.',
      popular: 'Most popular',
      period: '/ mo',
      items: [
        {
          tier:'Tier 01', name:'Scout', price:'$0', featured:false,
          tagline:'Explore the platform. Delayed data and limited access.',
          feats:[
            {on:true,  t:'Military map with delay'},
            {on:true,  t:'News feed — last 24h'},
            {on:true,  t:'5 geopolitical alerts per day'},
            {on:false, t:'Private aircraft'},
            {on:false, t:'Naval traffic'},
            {on:false, t:'Instant notifications'},
            {on:false, t:'AI analysis'},
          ],
          cta:'Create free account', plan:'scout',
        },
        {
          tier:'Tier 02', name:'Analyst', price:'$49', featured:true, popular:true,
          tagline:'Full real-time access. For analysts, journalists, and researchers.',
          feats:[
            {on:true, t:'Real-time map — military + private'},
            {on:true, t:'Full naval traffic'},
            {on:true, t:'500+ sources + 300+ monitored accounts'},
            {on:true, t:'Unlimited alerts + notifications'},
            {on:true, t:'Route and base history'},
            {on:true, t:'Documents and prediction markets'},
            {on:true, t:'Daily reports · 30-day history'},
          ],
          cta:'Start 7-day trial →', plan:'analyst',
        },
        {
          tier:'Tier 03', name:'Command', price:'$199', featured:false,
          tagline:'For teams and institutions with advanced intelligence needs.',
          feats:[
            {on:true, t:'Everything in Analyst'},
            {on:true, t:'Satellite observation data'},
            {on:true, t:'Weekly AI analysis reports'},
            {on:true, t:'REST API access'},
            {on:true, t:'Up to 5 users'},
            {on:true, t:'Unlimited history'},
            {on:true, t:'Priority support'},
          ],
          cta:'Contact sales', plan:'command',
        },
      ],
    },
    footer: {
      links: ['Terms of use','Privacy','Contact','Status'],
      copy: '© 2026 Qilin Intelligence. All rights reserved.',
    },
  },
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LangToggle({ lang, setLang }) {
  return (
    <div style={{
      display:'flex', alignItems:'center',
      background:'rgba(200,160,60,0.07)', border:`1px solid ${C.goldBorder}`,
      borderRadius:20, padding:'3px 4px', gap:2,
    }}>
      {['es','en'].map(l => (
        <button key={l} onClick={() => setLang(l)}
          style={{
            padding:'4px 11px', borderRadius:16, fontSize:11, fontWeight:700,
            letterSpacing:'.08em', textTransform:'uppercase', cursor:'pointer', border:'none',
            fontFamily:"'IBM Plex Mono',monospace", transition:'all .15s',
            background: lang === l ? C.gold : 'transparent',
            color: lang === l ? C.bg0 : C.goldDim,
          }}>
          {l}
        </button>
      ))}
    </div>
  )
}

function Nav({ t, onLogin, onRegister, lang, setLang, vp }) {
  const pad = vp.isMobile ? 16 : vp.isTablet ? 28 : 56
  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:`0 ${pad}px`, height:60, gap:12,
      background:'rgba(2,6,14,0.88)', backdropFilter:'blur(16px)',
      borderBottom:`1px solid ${C.border}`,
    }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace",
        fontSize: vp.isMobile ? 14 : 16, fontWeight:700,
        letterSpacing:'.25em', color:C.gold, textTransform:'uppercase',
        display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
        onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>
        <img src="/brand/qilin-logo.jpg" alt="" style={{ height: vp.isMobile ? 28 : 32, objectFit:'contain' }} />
        QILIN
      </div>
      {!vp.isMobile && (
        <div style={{ display:'flex', gap: vp.isTablet ? 20 : 32, alignItems:'center' }}>
          {[[t.nav.platform,'#features'],[t.nav.pricing,'#plans'],[t.nav.contact,'mailto:hola@qilin.app']].map(([l,h]) => (
            <a key={l} href={h}
              style={{ fontSize:13, color:C.txt2, textDecoration:'none', letterSpacing:'.03em' }}
              onMouseEnter={e=>e.target.style.color=C.goldLight}
              onMouseLeave={e=>e.target.style.color=C.txt2}>{l}</a>
          ))}
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      )}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {vp.isMobile && <LangToggle lang={lang} setLang={setLang} />}
        <button onClick={onLogin}
          aria-label={t.nav.login}
          style={{ padding: vp.isMobile ? '6px 12px' : '8px 20px',
            border:`1px solid ${C.goldBorder}`, borderRadius:6,
            background:'transparent', color:C.goldDim,
            fontSize: vp.isMobile ? 12 : 13, cursor:'pointer', fontFamily:'inherit',
            whiteSpace:'nowrap' }}>
          {t.nav.login}
        </button>
        <button onClick={onRegister}
          style={{ padding: vp.isMobile ? '7px 12px' : '8px 20px',
            border:`1px solid ${C.gold}`, borderRadius:6, background:C.goldFill, color:C.goldLight,
            fontSize: vp.isMobile ? 12 : 13, cursor:'pointer', fontFamily:'inherit', fontWeight:600,
            whiteSpace:'nowrap' }}>
          {t.nav.cta}
        </button>
      </div>
    </nav>
  )
}

function Hero({ t, aircraftCount, onRegister, vp }) {
  const pad = vp.isMobile ? '96px 20px 60px' : vp.isTablet ? '110px 32px 70px' : '120px 48px 80px'
  return (
    <section style={{ minHeight: vp.isMobile ? 'auto' : '100vh', position:'relative', overflow:'hidden',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      textAlign:'center', padding: pad }}>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:`url('${HERO_IMG}')`,
        backgroundSize:'cover', backgroundPosition:'center 30%',
        filter:'brightness(0.35) saturate(0.8)' }} />
      <div style={{ position:'absolute', inset:0,
        background:'linear-gradient(180deg,rgba(2,6,14,0) 0%,rgba(2,6,14,0.4) 50%,rgba(2,6,14,0.95) 85%,#02060e 100%)' }} />
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(200,160,60,0.06) 0%,transparent 70%)' }} />
      <div style={{ position:'relative', zIndex:2, maxWidth:760 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px',
          border:`1px solid ${C.goldBorder}`, borderRadius:20, marginBottom: vp.isMobile ? 20 : 32,
          fontSize:11, letterSpacing:'.12em', textTransform:'uppercase',
          color:C.goldDim, background:'rgba(200,160,60,0.07)',
          fontFamily:"'IBM Plex Mono',monospace" }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:C.gold,
            display:'inline-block', animation:'blink 2s infinite' }} />
          {t.hero.badge(aircraftCount)}
        </div>
        <h1 style={{
          fontSize: vp.isMobile ? 36 : 'clamp(38px,6vw,72px)',
          fontWeight:800, lineHeight:1.08,
          letterSpacing:'-.03em', color:'#fff',
          marginBottom: vp.isMobile ? 18 : 24 }}>
          {t.hero.h1a}<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>{t.hero.h1b}</em>
        </h1>
        <p style={{
          fontSize: vp.isMobile ? 15 : 17,
          color:C.txt2, maxWidth:560,
          margin: vp.isMobile ? '0 auto 28px' : '0 auto 44px',
          lineHeight:1.7 }}>
          {t.hero.sub}
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap',
          flexDirection: vp.isMobile ? 'column' : 'row',
          alignItems: vp.isMobile ? 'stretch' : 'center' }}>
          <button onClick={onRegister}
            style={{ padding:'14px 28px', borderRadius:8, fontSize:14, fontWeight:600,
              background:'rgba(200,160,60,0.15)', border:`1px solid ${C.gold}`, color:C.goldLight,
              cursor:'pointer', fontFamily:'inherit' }}>
            {t.hero.cta1}
          </button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({behavior:'smooth'})}
            style={{ padding:'14px 28px', borderRadius:8, fontSize:14, fontWeight:600,
              background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
              color:'rgba(255,255,255,0.6)', cursor:'pointer', fontFamily:'inherit' }}>
            {t.hero.cta2}
          </button>
        </div>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.01s!important}}`}</style>
    </section>
  )
}

function StatsBar({ t, aircraftCount, vp }) {
  const nums = [aircraftCount > 0 ? `${aircraftCount}+` : '300+', '70+', '500+', '300+', '24/7']
  return (
    <div style={{ background:C.bg1, borderTop:`1px solid ${C.border}`,
      borderBottom:`1px solid ${C.border}`,
      padding: vp.isMobile ? '20px 12px' : '28px 56px',
      display:'grid',
      gridTemplateColumns: vp.isMobile ? 'repeat(2, 1fr)' : vp.isTablet ? 'repeat(3, 1fr)' : `repeat(${t.stats.length}, 1fr)`,
      gap: vp.isMobile ? 16 : 0,
      justifyItems:'center' }}>
      {t.stats.map((s, i) => (
        <div key={i} style={{ textAlign:'center',
          padding: vp.isMobile ? '0 4px' : '0 32px',
          borderRight: vp.isMobile ? 'none' : (i < t.stats.length-1 ? `1px solid ${C.border}` : 'none'),
          width:'100%' }}>
          <div style={{ fontSize: vp.isMobile ? 24 : 32, fontWeight:800, color:C.goldLight,
            letterSpacing:'-.03em', lineHeight:1 }}>{nums[i]}</div>
          <div style={{ fontSize:10, letterSpacing:'.12em', textTransform:'uppercase',
            color:C.txt3, marginTop:5, fontFamily:"'IBM Plex Mono',monospace" }}>{s.l}</div>
          <div style={{ fontSize:9, color:C.goldDim, marginTop:3 }}>{s.s}</div>
        </div>
      ))}
    </div>
  )
}

function Features({ t, vp }) {
  const hPad = vp.isMobile ? 20 : vp.isTablet ? 32 : 56
  const vPad = vp.isMobile ? 64 : 96
  const cols = vp.isMobile ? 1 : vp.isTablet ? 2 : 3
  return (
    <section id="features" style={{ padding: `${vPad}px 0` }}>
      <div style={{ maxWidth:1120, margin:'0 auto', padding: `0 ${hPad}px` }}>
        <div style={{ fontSize:11, letterSpacing:'.22em', textTransform:'uppercase',
          color:C.goldDim, marginBottom:14, fontFamily:"'IBM Plex Mono',monospace" }}>{t.features.eyebrow}</div>
        <h2 style={{ fontSize: vp.isMobile ? 28 : 'clamp(28px,4vw,46px)', fontWeight:800, color:'#fff',
          lineHeight:1.15, marginBottom:18, letterSpacing:'-.02em' }}>
          {t.features.h2a}<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>{t.features.h2b}</em>
        </h2>
        <p style={{ fontSize: vp.isMobile ? 15 : 16, color:C.txt2, maxWidth:520, lineHeight:1.7 }}>
          {t.features.sub}
        </p>
        <div style={{ display:'grid', gridTemplateColumns: `repeat(${cols},1fr)`,
          gap:1, marginTop: vp.isMobile ? 36 : 56,
          border:`1px solid ${C.border}`, background:C.border }}>
          {t.features.cards.map((f, i) => (
            <div key={i} style={{ background:C.bg1,
              padding: vp.isMobile ? '28px 22px' : '36px 32px',
              transition:'background .25s', cursor:'default' }}
              onMouseEnter={e=>e.currentTarget.style.background=C.bg2}
              onMouseLeave={e=>e.currentTarget.style.background=C.bg1}>
              <div style={{ width:42, height:42, borderRadius:10, background:C.goldFill,
                border:`1px solid ${C.goldBorder}`, display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:18, marginBottom:20 }}>{f.icon}</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#fff', marginBottom:10 }}>{f.title}</div>
              <div style={{ fontSize:14, color:C.txt2, lineHeight:1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function SatelliteCallout({ t, vp }) {
  const hPad = vp.isMobile ? 20 : vp.isTablet ? 32 : 56
  const vPad = vp.isMobile ? 56 : 80
  return (
    <div style={{ position:'relative', overflow:'hidden',
      borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:`url('${CALLOUT_IMG}')`,
        backgroundSize:'cover', backgroundPosition:'center',
        filter:'brightness(0.25) saturate(0.6)' }} />
      <div style={{ position:'absolute', inset:0,
        background: vp.isMobile
          ? 'linear-gradient(180deg,rgba(2,6,14,0.5) 0%,rgba(2,6,14,0.95) 100%)'
          : 'linear-gradient(90deg,rgba(2,6,14,0.97) 40%,rgba(2,6,14,0.5) 100%)' }} />
      <div style={{ position:'relative', zIndex:1,
        padding: `${vPad}px ${hPad}px`,
        maxWidth:580 }}>
        <div style={{ fontSize:11, letterSpacing:'.22em', textTransform:'uppercase',
          color:C.goldDim, marginBottom:14, fontFamily:"'IBM Plex Mono',monospace" }}>
          {t.callout.eyebrow}
        </div>
        <h2 style={{ fontSize: vp.isMobile ? 26 : 'clamp(24px,3.5vw,40px)',
          fontWeight:800, color:'#fff',
          lineHeight:1.15, marginBottom:18, letterSpacing:'-.02em' }}>
          {t.callout.h2a}<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>{t.callout.h2b}</em>
        </h2>
        <p style={{ fontSize: vp.isMobile ? 14 : 15, color:C.txt2, lineHeight:1.7, marginBottom:12 }}>
          {t.callout.p}
        </p>
        <p style={{ fontSize:13, color:C.txt3 }}>{t.callout.note}</p>
      </div>
    </div>
  )
}

function Plans({ t, onRegister, vp }) {
  const hPad = vp.isMobile ? 20 : vp.isTablet ? 32 : 56
  const vPad = vp.isMobile ? 64 : 96
  const cols = vp.isMobile ? 1 : vp.isTablet ? 1 : 3
  return (
    <section id="plans" style={{ padding: `${vPad}px 0` }}>
      <div style={{ maxWidth:1120, margin:'0 auto', padding: `0 ${hPad}px` }}>
        <div style={{ fontSize:11, letterSpacing:'.22em', textTransform:'uppercase',
          color:C.goldDim, marginBottom:14, fontFamily:"'IBM Plex Mono',monospace" }}>{t.plans.eyebrow}</div>
        <h2 style={{ fontSize: vp.isMobile ? 28 : 'clamp(28px,4vw,46px)', fontWeight:800, color:'#fff',
          lineHeight:1.15, marginBottom:18, letterSpacing:'-.02em' }}>
          {t.plans.h2a}<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>{t.plans.h2b}</em>
        </h2>
        <p style={{ fontSize: vp.isMobile ? 15 : 16, color:C.txt2, maxWidth:520, lineHeight:1.7 }}>
          {t.plans.sub}
        </p>
        <div style={{ display:'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap:16,
          marginTop: vp.isMobile ? 40 : 56 }}>
          {t.plans.items.map(p => (
            <div key={p.name} style={{ background: p.featured ? C.bg2 : C.bg1,
              border:`1px solid ${p.featured ? 'rgba(200,160,60,0.45)' : C.border}`,
              borderRadius:12, padding:32, position:'relative',
              boxShadow: p.featured ? '0 0 40px rgba(200,160,60,0.06)' : 'none' }}>
              {p.popular && (
                <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
                  background:C.gold, color:C.bg0, fontSize:10, fontWeight:700,
                  letterSpacing:'.15em', textTransform:'uppercase', padding:'4px 14px',
                  borderRadius:20, fontFamily:"'IBM Plex Mono',monospace", whiteSpace:'nowrap' }}>
                  {t.plans.popular}
                </div>
              )}
              <div style={{ fontSize:10, letterSpacing:'.22em', textTransform:'uppercase',
                color:C.goldDim, marginBottom:6, fontFamily:"'IBM Plex Mono',monospace" }}>{p.tier}</div>
              <div style={{ fontSize:26, fontWeight:800, color:'#fff', marginBottom:4 }}>{p.name}</div>
              <div style={{ margin:'16px 0 8px' }}>
                <span style={{ fontSize:42, fontWeight:800, color:C.goldLight, letterSpacing:'-.03em' }}>{p.price}</span>
                <span style={{ fontSize:14, color:C.txt3 }}> {t.plans.period}</span>
              </div>
              <div style={{ fontSize:13, color:C.txt2, marginBottom:24, lineHeight:1.5 }}>{p.tagline}</div>
              <div style={{ height:1, background:C.border, marginBottom:20 }} />
              <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
                {p.feats.map((f, i) => (
                  <li key={i} style={{ display:'flex', gap:10, fontSize:13,
                    color: f.on ? C.txt2 : C.txt3, alignItems:'flex-start' }}>
                    <span style={{ color: f.on ? C.gold : C.txt3, flexShrink:0, fontSize:12, marginTop:2 }}>
                      {f.on ? '✓' : '✗'}
                    </span>
                    {f.t}
                  </li>
                ))}
              </ul>
              <button onClick={() => onRegister(p.plan)}
                style={{ display:'block', width:'100%', padding:13, borderRadius:8,
                  fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  textAlign:'center', letterSpacing:'.03em', transition:'all .2s',
                  background: p.featured ? C.goldFill : 'transparent',
                  border:`1px solid ${p.featured ? C.gold : C.goldBorder}`,
                  color: p.featured ? C.goldLight : C.goldDim }}>
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer({ t, vp }) {
  return (
    <footer style={{ background:C.bg1, borderTop:`1px solid ${C.border}`,
      padding: vp.isMobile ? '28px 20px' : '40px 56px',
      display:'flex',
      flexDirection: vp.isMobile ? 'column' : 'row',
      justifyContent:'space-between',
      alignItems: vp.isMobile ? 'flex-start' : 'center',
      flexWrap:'wrap', gap:20 }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:700,
        letterSpacing:'.25em', color:C.goldDim }}>◈ QILIN</div>
      <div style={{ display:'flex', gap:28 }}>
        {t.footer.links.map(l => (
          <a key={l} href="#" style={{ fontSize:12, color:C.txt3, textDecoration:'none' }}>{l}</a>
        ))}
      </div>
      <div style={{ fontSize:11, color:C.txt3 }}>{t.footer.copy}</div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [aircraftCount, setAircraftCount] = useState(0)
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('qilin_lang') || 'es' } catch { return 'es' }
  })
  const navigate = useNavigate()
  const vp = useViewport()
  const t = T[lang]

  // Reflejar idioma en <html lang=> para screen readers + persistir elección.
  useEffect(() => {
    try { document.documentElement.lang = lang } catch {}
    try { localStorage.setItem('qilin_lang', lang) } catch {}
  }, [lang])

  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    const root = document.getElementById('root')
    if (root) root.style.overflow = 'auto'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      if (root) root.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    async function fetchStats() {
      try {
        const r = await fetch('/api/stats')
        if (r.ok) {
          const d = await r.json()
          setAircraftCount(d.aircraft_active || 0)
        }
      } catch (_) {}
    }
    fetchStats()
    const t = setInterval(fetchStats, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      <Nav t={t} lang={lang} setLang={setLang} vp={vp}
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />
      <Hero t={t} vp={vp} aircraftCount={aircraftCount} onRegister={() => navigate('/register')} />
      <StatsBar t={t} vp={vp} aircraftCount={aircraftCount} />
      <Features t={t} vp={vp} />
      <SatelliteCallout t={t} vp={vp} />
      <Plans t={t} vp={vp} onRegister={plan => navigate(`/register?plan=${plan}`)} />
      <Footer t={t} vp={vp} />
      <ChatBotPublic />
    </>
  )
}
