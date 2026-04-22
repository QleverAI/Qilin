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

const HERO_IMG   = 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80'
const CALLOUT_IMG = 'https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=1920&q=80'

// ── Sub-components ────────────────────────────────────────────────────────────

function Nav({ onLogin, onRegister }) {
  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 56px', height:60,
      background:'rgba(2,6,14,0.88)', backdropFilter:'blur(16px)',
      borderBottom:`1px solid ${C.border}`,
    }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:16, fontWeight:700,
        letterSpacing:'.25em', color:C.gold, textTransform:'uppercase',
        display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}
        onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>
        ◈ QILIN
      </div>
      <div style={{ display:'flex', gap:32 }}>
        {[['Plataforma','#features'],['Precios','#plans'],['Contacto','mailto:']].map(([l,h]) => (
          <a key={l} href={h}
            style={{ fontSize:13, color:C.txt2, textDecoration:'none', letterSpacing:'.03em' }}
            onMouseEnter={e=>e.target.style.color=C.goldLight}
            onMouseLeave={e=>e.target.style.color=C.txt2}>{l}</a>
        ))}
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onLogin} style={{ padding:'8px 20px', border:`1px solid ${C.goldBorder}`,
          borderRadius:6, background:'transparent', color:C.goldDim,
          fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
          Iniciar sesión
        </button>
        <button onClick={onRegister} style={{ padding:'8px 20px', border:`1px solid ${C.gold}`,
          borderRadius:6, background:C.goldFill, color:C.goldLight,
          fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
          Comenzar →
        </button>
      </div>
    </nav>
  )
}

function Hero({ aircraftCount, onRegister }) {
  return (
    <section style={{ minHeight:'100vh', position:'relative', overflow:'hidden',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      textAlign:'center', padding:'120px 48px 80px' }}>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:`url('${HERO_IMG}')`,
        backgroundSize:'cover', backgroundPosition:'center 30%',
        filter:'brightness(0.35) saturate(0.8)' }} />
      <div style={{ position:'absolute', inset:0,
        background:'linear-gradient(180deg,rgba(2,6,14,0) 0%,rgba(2,6,14,0.4) 50%,rgba(2,6,14,0.95) 85%,#02060e 100%)' }} />
      <div style={{ position:'absolute', inset:0,
        background:'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(200,160,60,0.06) 0%,transparent 70%)' }} />
      <div style={{ position:'relative', zIndex:2, maxWidth:760 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px',
          border:`1px solid ${C.goldBorder}`, borderRadius:20, marginBottom:32,
          fontSize:12, letterSpacing:'.12em', textTransform:'uppercase',
          color:C.goldDim, background:'rgba(200,160,60,0.07)',
          fontFamily:"'IBM Plex Mono',monospace" }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:C.gold,
            display:'inline-block', animation:'blink 2s infinite' }} />
          {aircraftCount > 0 ? `${aircraftCount}+ aeronaves activas ahora mismo` : 'Sistema activo'}
        </div>
        <h1 style={{ fontSize:'clamp(38px,6vw,72px)', fontWeight:800, lineHeight:1.08,
          letterSpacing:'-.03em', color:'#fff', marginBottom:24 }}>
          Ve lo que<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>otros no ven.</em>
        </h1>
        <p style={{ fontSize:17, color:C.txt2, maxWidth:560, margin:'0 auto 44px', lineHeight:1.75 }}>
          Inteligencia geopolítica en tiempo real. Aeronaves militares y privadas, flotas navales,
          alertas con IA y señales satelitales — todo en un solo panel.
        </p>
        <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={onRegister}
            style={{ padding:'15px 36px', borderRadius:8, fontSize:14, fontWeight:600,
              background:'rgba(200,160,60,0.15)', border:`1px solid ${C.gold}`, color:C.goldLight,
              cursor:'pointer', fontFamily:'inherit' }}>
            Solicitar acceso →
          </button>
          <button onClick={() => document.getElementById('features')?.scrollIntoView({behavior:'smooth'})}
            style={{ padding:'15px 36px', borderRadius:8, fontSize:14, fontWeight:600,
              background:'transparent', border:'1px solid rgba(255,255,255,0.15)',
              color:'rgba(255,255,255,0.6)', cursor:'pointer', fontFamily:'inherit' }}>
            Ver capacidades
          </button>
        </div>
      </div>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </section>
  )
}

function StatsBar({ aircraftCount }) {
  const stats = [
    { n: aircraftCount > 0 ? `${aircraftCount}+` : '300+', l:'Aeronaves activas', s:'● En vivo ahora' },
    { n:'70+',   l:'Perfiles de alto perfil', s:'Presidentes · Billonarios' },
    { n:'500+',  l:'Fuentes de inteligencia', s:'Clasificadas con IA' },
    { n:'300+',  l:'Cuentas monitorizadas',   s:'Líderes · Analistas · OSINT' },
    { n:'24/7',  l:'Cobertura global',        s:'Sin interrupciones' },
  ]
  return (
    <div style={{ background:C.bg1, borderTop:`1px solid ${C.border}`,
      borderBottom:`1px solid ${C.border}`, padding:'28px 56px',
      display:'flex', justifyContent:'center', flexWrap:'wrap' }}>
      {stats.map((s, i) => (
        <div key={i} style={{ textAlign:'center', padding:'0 40px',
          borderRight: i < stats.length-1 ? `1px solid ${C.border}` : 'none' }}>
          <div style={{ fontSize:34, fontWeight:800, color:C.goldLight, letterSpacing:'-.03em', lineHeight:1 }}>{s.n}</div>
          <div style={{ fontSize:11, letterSpacing:'.15em', textTransform:'uppercase',
            color:C.txt3, marginTop:5, fontFamily:"'IBM Plex Mono',monospace" }}>{s.l}</div>
          <div style={{ fontSize:10, color:C.goldDim, marginTop:3 }}>{s.s}</div>
        </div>
      ))}
    </div>
  )
}

function Features() {
  const feats = [
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
  ]
  return (
    <section id="features" style={{ padding:'96px 0' }}>
      <div style={{ maxWidth:1120, margin:'0 auto', padding:'0 56px' }}>
        <div style={{ fontSize:11, letterSpacing:'.22em', textTransform:'uppercase',
          color:C.goldDim, marginBottom:14, fontFamily:"'IBM Plex Mono',monospace" }}>Capacidades</div>
        <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, color:'#fff',
          lineHeight:1.15, marginBottom:18, letterSpacing:'-.02em' }}>
          Cada capa cuenta.<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>Juntas, lo cambian todo.</em>
        </h2>
        <p style={{ fontSize:16, color:C.txt2, maxWidth:520, lineHeight:1.75 }}>
          Qilin agrega señales de múltiples fuentes y las convierte en inteligencia accionable. Sin ruido, sin demoras.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)',
          gap:1, marginTop:56, border:`1px solid ${C.border}`, background:C.border }}>
          {feats.map((f, i) => (
            <div key={i} style={{ background:C.bg1, padding:'36px 32px', transition:'background .25s',
              cursor:'default' }}
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

function SatelliteCallout() {
  return (
    <div style={{ position:'relative', overflow:'hidden',
      borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}` }}>
      <div style={{ position:'absolute', inset:0,
        backgroundImage:`url('${CALLOUT_IMG}')`,
        backgroundSize:'cover', backgroundPosition:'center',
        filter:'brightness(0.25) saturate(0.6)' }} />
      <div style={{ position:'absolute', inset:0,
        background:'linear-gradient(90deg,rgba(2,6,14,0.97) 40%,rgba(2,6,14,0.5) 100%)' }} />
      <div style={{ position:'relative', zIndex:1, padding:'80px 56px', maxWidth:580 }}>
        <div style={{ fontSize:11, letterSpacing:'.22em', textTransform:'uppercase',
          color:C.goldDim, marginBottom:14, fontFamily:"'IBM Plex Mono',monospace" }}>
          Observación terrestre
        </div>
        <h2 style={{ fontSize:'clamp(24px,3.5vw,40px)', fontWeight:800, color:'#fff',
          lineHeight:1.15, marginBottom:18, letterSpacing:'-.02em' }}>
          La Tierra no<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>tiene secretos.</em>
        </h2>
        <p style={{ fontSize:15, color:C.txt2, lineHeight:1.75, marginBottom:12 }}>
          Integramos datos de satélites de observación para detectar anomalías atmosféricas
          por zona. Cuando hay actividad inusual — industrial, militar o de infraestructura —
          las señales lo delatan antes que cualquier comunicado oficial.
        </p>
        <p style={{ fontSize:13, color:C.txt3 }}>Disponible en el plan Command.</p>
      </div>
    </div>
  )
}

function Plans({ onRegister }) {
  const plans = [
    {
      tier:'Tier 01', name:'Scout', price:'$0', period:'/ mes', featured:false,
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
      tier:'Tier 02', name:'Analyst', price:'$49', period:'/ mes', featured:true, popular:true,
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
      tier:'Tier 03', name:'Command', price:'$199', period:'/ mes', featured:false,
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
  ]
  return (
    <section id="plans" style={{ padding:'96px 0' }}>
      <div style={{ maxWidth:1120, margin:'0 auto', padding:'0 56px' }}>
        <div style={{ fontSize:11, letterSpacing:'.22em', textTransform:'uppercase',
          color:C.goldDim, marginBottom:14, fontFamily:"'IBM Plex Mono',monospace" }}>Precios</div>
        <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:800, color:'#fff',
          lineHeight:1.15, marginBottom:18, letterSpacing:'-.02em' }}>
          Elige tu nivel<br />
          <em style={{ fontStyle:'normal', color:C.goldLight }}>de inteligencia.</em>
        </h2>
        <p style={{ fontSize:16, color:C.txt2, maxWidth:520, lineHeight:1.75 }}>
          Sin contratos anuales obligatorios. Cancela cuando quieras. Empieza gratis.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginTop:56 }}>
          {plans.map(p => (
            <div key={p.name} style={{ background: p.featured ? C.bg2 : C.bg1,
              border:`1px solid ${p.featured ? 'rgba(200,160,60,0.45)' : C.border}`,
              borderRadius:12, padding:32, position:'relative',
              boxShadow: p.featured ? '0 0 40px rgba(200,160,60,0.06)' : 'none' }}>
              {p.popular && (
                <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
                  background:C.gold, color:C.bg0, fontSize:10, fontWeight:700,
                  letterSpacing:'.15em', textTransform:'uppercase', padding:'4px 14px',
                  borderRadius:20, fontFamily:"'IBM Plex Mono',monospace", whiteSpace:'nowrap' }}>
                  Más popular
                </div>
              )}
              <div style={{ fontSize:10, letterSpacing:'.22em', textTransform:'uppercase',
                color:C.goldDim, marginBottom:6, fontFamily:"'IBM Plex Mono',monospace" }}>{p.tier}</div>
              <div style={{ fontSize:26, fontWeight:800, color:'#fff', marginBottom:4 }}>{p.name}</div>
              <div style={{ margin:'16px 0 8px' }}>
                <span style={{ fontSize:42, fontWeight:800, color:C.goldLight, letterSpacing:'-.03em' }}>{p.price}</span>
                <span style={{ fontSize:14, color:C.txt3 }}> {p.period}</span>
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

function Footer() {
  return (
    <footer style={{ background:C.bg1, borderTop:`1px solid ${C.border}`,
      padding:'40px 56px', display:'flex', justifyContent:'space-between',
      alignItems:'center', flexWrap:'wrap', gap:20 }}>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:700,
        letterSpacing:'.25em', color:C.goldDim }}>◈ QILIN</div>
      <div style={{ display:'flex', gap:28 }}>
        {['Términos de uso','Privacidad','Contacto','Status'].map(l => (
          <a key={l} href="#" style={{ fontSize:12, color:C.txt3, textDecoration:'none' }}>{l}</a>
        ))}
      </div>
      <div style={{ fontSize:11, color:C.txt3 }}>© 2026 Qilin Intelligence. Todos los derechos reservados.</div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [aircraftCount, setAircraftCount] = useState(0)
  const navigate = useNavigate()

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
      <Nav
        onLogin={() => navigate('/login')}
        onRegister={() => navigate('/register')}
      />
      <Hero aircraftCount={aircraftCount} onRegister={() => navigate('/register')} />
      <StatsBar aircraftCount={aircraftCount} />
      <Features />
      <SatelliteCallout />
      <Plans onRegister={plan => navigate(`/register?plan=${plan}`)} />
      <Footer />
      <ChatBotPublic />
    </>
  )
}
