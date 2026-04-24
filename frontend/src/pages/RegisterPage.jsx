import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import TopicSelector from '../components/TopicSelector'
import { useLang } from '../hooks/useLanguage'

const inputStyle = {
  background: 'rgba(200,160,60,0.05)', border: '1px solid rgba(200,160,60,0.18)',
  borderRadius: '6px', padding: '12px 14px', color: '#f0f4f8',
  fontSize: '14px', fontFamily: 'inherit', outline: 'none', width: '100%',
  boxSizing: 'border-box',
}

const stepBtn = {
  marginTop: '4px', padding: '14px',
  background: 'rgba(200,160,60,0.15)', border: '1px solid #c8a03c',
  borderRadius: '8px', color: '#e8c060', fontSize: '14px', fontWeight: '600',
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s', width: '100%',
}

const skipStyle = {
  textAlign: 'center', marginTop: '14px', fontSize: '13px',
  color: 'rgba(220,230,245,0.4)', cursor: 'pointer', fontFamily: 'inherit',
  background: 'none', border: 'none', width: '100%',
}

const PLAN_TOPIC_LIMIT = { free: 2, scout: 5, analyst: 20, command: null }

function StepIndicator({ step, t }) {
  const steps = [
    t('register.step.plan'),
    t('register.step.account'),
    t('register.step.topics'),
    t('register.step.telegram'),
  ]
  return (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '28px' }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? '#c8a03c' : active ? 'rgba(200,160,60,0.2)' : 'transparent',
              border: `1px solid ${done || active ? '#c8a03c' : 'rgba(200,160,60,0.2)'}`,
              fontSize: '10px', color: done ? '#02060e' : '#c8a03c', fontWeight: '700',
              flexShrink: 0,
            }}>
              {done ? '✓' : idx}
            </div>
            <span style={{ fontSize: '11px', color: active ? '#c8a03c' : 'rgba(220,230,245,0.35)', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div style={{ width: '14px', height: '1px', background: 'rgba(200,160,60,0.2)', flexShrink: 0 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PlanCard({ planId, name, tier, price, priceNote, topics, paid, features, selected, onSelect, t }) {
  return (
    <div
      onClick={() => onSelect(planId)}
      style={{
        border: `1px solid ${selected ? '#c8a03c' : 'rgba(200,160,60,0.15)'}`,
        borderRadius: '10px', padding: '16px', cursor: 'pointer',
        background: selected ? 'rgba(200,160,60,0.07)' : 'rgba(255,255,255,0.02)',
        transition: 'all .15s', position: 'relative', userSelect: 'none',
      }}
    >
      {paid && (
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'rgba(79,156,249,0.12)', border: '1px solid rgba(79,156,249,0.3)',
          borderRadius: '4px', padding: '2px 7px',
          fontSize: '9px', color: 'rgba(79,156,249,0.8)',
          fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '.06em',
        }}>
          {t('register.plan_select.paid_badge')}
        </div>
      )}

      <div style={{ fontSize: '9px', letterSpacing: '.18em', color: 'rgba(200,160,60,0.5)', fontFamily: "'IBM Plex Mono',monospace", marginBottom: '4px' }}>
        {tier}
      </div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: selected ? '#e8c060' : '#f0f4f8', marginBottom: '8px' }}>
        {name}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '10px' }}>
        <span style={{ fontSize: '20px', fontWeight: '800', color: '#c8a03c' }}>{price}</span>
        {priceNote && <span style={{ fontSize: '11px', color: 'rgba(200,160,60,0.6)' }}>{priceNote}</span>}
      </div>

      <div style={{
        fontSize: '11px', color: selected ? 'rgba(232,192,96,0.9)' : 'rgba(200,160,60,0.6)',
        fontFamily: "'IBM Plex Mono',monospace", marginBottom: '10px',
        background: 'rgba(200,160,60,0.06)', borderRadius: '4px', padding: '3px 7px',
        display: 'inline-block',
      }}>
        {topics === null ? t('register.plan_select.topics_unlimited') : t('register.plan_select.topics', { n: topics })}
      </div>

      <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {features.map((f, i) => (
          <li key={i} style={{ fontSize: '12px', color: 'rgba(220,230,245,0.55)', lineHeight: '1.4' }}>{f}</li>
        ))}
      </ul>

      {selected && (
        <div style={{
          marginTop: '12px', textAlign: 'center',
          fontSize: '11px', color: '#c8a03c', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '.08em',
        }}>
          ✓ {t('register.plan_select.selected')}
        </div>
      )}
    </div>
  )
}

export default function RegisterPage() {
  const { t } = useLang()
  const [step,      setStep]      = useState(1)
  const [username,  setUsername]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [catalog,   setCatalog]   = useState([])
  const [myTopics,  setMyTopics]  = useState([])
  const [chatId,    setChatId]    = useState('')
  const [token,     setToken]     = useState('')

  const navigate = useNavigate()
  const [params]  = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState(params.get('plan') || 'free')

  const topicLimit = PLAN_TOPIC_LIMIT[selectedPlan] ?? 2

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(d => setCatalog(d.topics || []))
      .catch(() => {})
  }, [])

  async function handleStep2(e) {
    e.preventDefault()
    setError('')
    if (password !== password2) { setError(t('register.err.mismatch')); return }
    if (password.length < 8) { setError(t('register.err.too_short')); return }
    setLoading(true)
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.toLowerCase(), email, password }),
      })
      if (res.status === 409) { setError(t('register.err.conflict')); return }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || t('register.err.generic')); return
      }
      const { access_token } = await res.json()
      sessionStorage.setItem('qilin_token', access_token)
      sessionStorage.setItem('qilin_user', username.toLowerCase())
      setToken(access_token)
      setStep(3)
    } catch (_) {
      setError(t('register.err.connection'))
    } finally {
      setLoading(false)
    }
  }

  async function handleStep3Continue() {
    if (myTopics.length > 0) {
      try {
        await fetch('/api/me/topics', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ topics: myTopics }),
        })
      } catch (_) {}
    }
    setStep(4)
  }

  async function handleStep4Finish() {
    if (chatId.trim()) {
      try {
        await fetch('/api/me/telegram', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId.trim() }),
        })
      } catch (_) {}
    }
    navigate('/app', { replace: true })
  }

  const plans = [
    {
      id: 'free', tier: 'TIER 00', name: 'Free',
      price: t('register.plan_select.free_badge'), priceNote: '', topics: 2, paid: false,
      features: [t('register.plan.free.f1'), t('register.plan.free.f2'), t('register.plan.free.f3')],
    },
    {
      id: 'scout', tier: 'TIER 01', name: 'Scout',
      price: t('register.plan_select.free_badge'), priceNote: '', topics: 5, paid: false,
      features: [t('register.plan.scout.f1'), t('register.plan.scout.f2'), t('register.plan.scout.f3')],
    },
    {
      id: 'analyst', tier: 'TIER 02', name: 'Analyst',
      price: '$49', priceNote: '/mo', topics: 20, paid: true,
      features: [t('register.plan.analyst.f1'), t('register.plan.analyst.f2'), t('register.plan.analyst.f3')],
    },
    {
      id: 'command', tier: 'TIER 03', name: 'Command',
      price: '$199', priceNote: '/mo', topics: null, paid: true,
      features: [t('register.plan.command.f1'), t('register.plan.command.f2'), t('register.plan.command.f3')],
    },
  ]

  const maxWidth = step === 1 ? '580px' : step === 3 ? '640px' : '420px'

  return (
    <div style={{ minHeight: '100vh', background: '#02060e', display: 'flex',
      alignItems: 'flex-start', justifyContent: 'center', padding: '32px 24px',
      fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <img src="/brand/qilin-logo-nobg.png" alt="Qilin"
              style={{ width: '80px', height: '80px', objectFit: 'contain', marginBottom: '8px' }} />
          </Link>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
            {t('register.title')}
          </div>
        </div>

        <StepIndicator step={step} t={t} />

        {/* Step 1 — Plan selection */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', color: 'rgba(220,230,245,0.7)', marginBottom: '4px' }}>
                {t('register.plan_select.title')}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(220,230,245,0.35)' }}>
                {t('register.plan_select.subtitle')}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              {plans.map(p => (
                <PlanCard key={p.id} {...p} planId={p.id} selected={selectedPlan === p.id} onSelect={setSelectedPlan} t={t} />
              ))}
            </div>
            <button onClick={() => setStep(2)} style={stepBtn}>
              {t('register.plan_select.btn_continue', { plan: plans.find(p => p.id === selectedPlan)?.name || '' })}
            </button>
          </div>
        )}

        {/* Step 2 — Account */}
        {step === 2 && (
          <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>{t('register.field.username')}</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder={t('register.placeholder.user')} required autoFocus style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>{t('register.field.email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t('register.placeholder.email')} required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>{t('register.field.password')}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('register.placeholder.pass')} required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(220,230,245,0.5)', marginBottom: '6px' }}>{t('register.field.password2')}</label>
              <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder={t('register.placeholder.pass2')} required style={inputStyle} />
            </div>
            {error && (
              <div style={{ fontSize: '13px', color: '#ff453a', background: 'rgba(255,69,58,0.08)',
                border: '1px solid rgba(255,69,58,0.2)', borderRadius: '6px', padding: '10px 14px', textAlign: 'center' }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={{ ...stepBtn, opacity: loading ? 0.7 : 1, cursor: loading ? 'default' : 'pointer' }}>
              {loading ? t('register.btn.creating') : t('register.btn.continue')}
            </button>
            <button type="button" onClick={() => setStep(1)} style={skipStyle}>← {t('register.btn.back')}</button>
          </form>
        )}

        {/* Step 3 — Topics */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: '16px', fontSize: '14px', color: 'rgba(220,230,245,0.6)', textAlign: 'center' }}>
              {topicLimit === null
                ? t('register.topics.hint_unlimited')
                : t('register.topics.hint', { limit: topicLimit })}
            </div>
            <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: '2px 0' }}>
              <TopicSelector
                selected={myTopics}
                limit={topicLimit}
                onChange={setMyTopics}
                catalog={catalog}
                excludeTypes={['zone']}
              />
            </div>
            <button onClick={handleStep3Continue} style={{ ...stepBtn, marginTop: '20px' }}>
              {myTopics.length > 0
                ? t(myTopics.length === 1 ? 'register.btn.continue_topics' : 'register.btn.continue_topics_pl', { n: myTopics.length })
                : t('register.btn.continue')}
            </button>
            <button onClick={() => setStep(4)} style={skipStyle}>{t('register.btn.skip')}</button>
          </div>
        )}

        {/* Step 4 — Telegram */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: 'rgba(220,230,245,0.5)', lineHeight: '1.7' }}>
              {t('register.telegram.hint')}
              <ol style={{ margin: '10px 0 0 18px', padding: 0, color: 'rgba(220,230,245,0.6)' }}>
                <li>Telegram</li>
                <li><strong style={{ color: '#c8a03c' }}>@QilinAlertBot</strong></li>
                <li><strong style={{ color: '#c8a03c' }}>/start</strong></li>
                <li>{t('register.telegram.steps').split('·')[3]?.trim()}</li>
              </ol>
            </div>
            <input
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder={t('register.telegram.placeholder')}
              style={inputStyle}
            />
            <button onClick={handleStep4Finish} style={stepBtn}>
              {chatId.trim() ? t('register.btn.finish') : t('register.btn.go_app')}
            </button>
            <button onClick={() => navigate('/app', { replace: true })} style={skipStyle}>{t('register.btn.skip')}</button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'rgba(220,230,245,0.35)' }}>
          {t('register.already')}{' '}
          <Link to="/login" style={{ color: 'rgba(200,160,60,0.7)', textDecoration: 'none' }}>{t('register.sign_in')}</Link>
          {' '}·{' '}
          <Link to="/" style={{ color: 'rgba(220,230,245,0.25)', textDecoration: 'none' }}>{t('register.back_home')}</Link>
        </div>
      </div>
    </div>
  )
}
