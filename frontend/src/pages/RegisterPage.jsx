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

function StepIndicator({ step, t }) {
  const steps = [t('register.step.account'), t('register.step.topics'), t('register.step.telegram')]
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? '#c8a03c' : active ? 'rgba(200,160,60,0.2)' : 'transparent',
              border: `1px solid ${done || active ? '#c8a03c' : 'rgba(200,160,60,0.2)'}`,
              fontSize: '11px', color: done ? '#02060e' : '#c8a03c', fontWeight: '700',
            }}>
              {done ? '✓' : idx}
            </div>
            <span style={{ fontSize: '12px', color: active ? '#c8a03c' : 'rgba(220,230,245,0.35)' }}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div style={{ width: '20px', height: '1px', background: 'rgba(200,160,60,0.2)' }} />
            )}
          </div>
        )
      })}
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
  const plan      = params.get('plan') || 'free'

  useEffect(() => {
    fetch('/api/topics')
      .then(r => r.json())
      .then(d => setCatalog(d.topics || []))
      .catch(() => {})
  }, [])

  async function handleStep1(e) {
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
      setStep(2)
    } catch (_) {
      setError(t('register.err.connection'))
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2Continue() {
    if (myTopics.length > 0) {
      try {
        await fetch('/api/me/topics', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ topics: myTopics }),
        })
      } catch (_) {}
    }
    setStep(3)
  }

  async function handleStep3Finish() {
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

  const PLAN_TOPIC_LIMIT = { scout: 5, analyst: 20, command: null, free: 2 }
  const topicLimit = PLAN_TOPIC_LIMIT[plan] ?? 2

  const planLabel = {
    scout:   t('register.plan.scout'),
    analyst: t('register.plan.analyst'),
    command: t('register.plan.command'),
  }

  return (
    <div style={{ minHeight: '100vh', background: '#02060e', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: step === 2 ? '640px' : '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <img src="/brand/qilin-logo-nobg.png" alt="Qilin"
              style={{ width: '100px', height: '100px', objectFit: 'contain', marginBottom: '8px' }} />
          </Link>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
            {t('register.title')}
          </div>
          {plan !== 'scout' && (
            <div style={{ display: 'inline-block', padding: '4px 14px',
              background: 'rgba(200,160,60,0.1)', border: '1px solid rgba(200,160,60,0.3)',
              borderRadius: '20px', fontSize: '12px', color: '#c8a03c' }}>
              {t('register.plan_label', { plan: planLabel[plan] || plan })}
            </div>
          )}
        </div>

        <StepIndicator step={step} t={t} />

        {step === 1 && (
          <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
          </form>
        )}

        {step === 2 && (
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
              />
            </div>
            <button onClick={handleStep2Continue} style={{ ...stepBtn, marginTop: '20px' }}>
              {myTopics.length > 0
                ? t(myTopics.length === 1 ? 'register.btn.continue_topics' : 'register.btn.continue_topics_pl', { n: myTopics.length })
                : t('register.btn.continue')}
            </button>
            <button onClick={() => setStep(3)} style={skipStyle}>{t('register.btn.skip')}</button>
          </div>
        )}

        {step === 3 && (
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
            <button onClick={handleStep3Finish} style={stepBtn}>
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
