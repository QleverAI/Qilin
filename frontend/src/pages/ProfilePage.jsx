import { useState, useEffect } from 'react'
import { useProfile } from '../hooks/useProfile'
import { authHeaders, getApiBase } from '../hooks/apiClient'
import { useLang } from '../hooks/useLanguage'
import TopicSelector from '../components/TopicSelector'

const FIELD = {
  background: 'rgba(0,200,255,0.04)',
  border: '1px solid rgba(0,200,255,0.15)',
  borderRadius: '4px',
  padding: '9px 12px',
  color: 'var(--txt-1)',
  fontSize: '13px',
  fontFamily: 'var(--mono)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', letterSpacing: '.12em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--txt-1)' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '3px', padding: '16px 20px' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '14px' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

export default function ProfilePage({ onNavigate }) {
  const { t } = useLang()
  const { profile, loading, error } = useProfile()

  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [pwLoading,    setPwLoading]    = useState(false)
  const [pwError,      setPwError]      = useState('')
  const [pwSuccess,    setPwSuccess]    = useState('')

  const [catalog,      setCatalog]      = useState([])
  const [myTopics,     setMyTopics]     = useState([])
  const [topicLimit,   setTopicLimit]   = useState(2)
  const [topicPlan,    setTopicPlan]    = useState('free')
  const [topicSaving,  setTopicSaving]  = useState(false)
  const [topicMsg,     setTopicMsg]     = useState('')

  const [chatId,       setChatId]       = useState('')
  const [tgSaving,     setTgSaving]     = useState(false)
  const [tgMsg,        setTgMsg]        = useState('')
  const [tgTesting,    setTgTesting]    = useState(false)
  const [tgTestMsg,    setTgTestMsg]    = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [catRes, topRes, tgRes] = await Promise.all([
          fetch('/api/topics'),
          fetch('/api/me/topics',   { headers: authHeaders() }),
          fetch('/api/me/telegram', { headers: authHeaders() }),
        ])
        const cat = await catRes.json()
        const top = await topRes.json()
        const tg  = await tgRes.json()
        setCatalog(cat.topics || [])
        setMyTopics(top.topics || [])
        setTopicLimit(top.limit ?? 2)
        setTopicPlan(top.plan || 'free')
        setChatId(tg.chat_id || '')
      } catch (_) {}
    }
    load()
  }, [])

  async function handleSaveTopics() {
    setTopicSaving(true); setTopicMsg('')
    try {
      const res = await fetch('/api/me/topics', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: myTopics }),
      })
      const data = await res.json()
      if (!res.ok) { setTopicMsg(data.detail || 'Error saving topics'); return }
      setTopicMsg('Topics saved ✓')
    } catch (_) { setTopicMsg('Connection error') }
    finally { setTopicSaving(false) }
  }

  async function handleSaveTelegram() {
    setTgSaving(true); setTgMsg('')
    try {
      const res = await fetch('/api/me/telegram', {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId }),
      })
      if (!res.ok) { setTgMsg('Error saving Telegram'); return }
      setTgMsg('Saved ✓')
    } catch (_) { setTgMsg('Connection error') }
    finally { setTgSaving(false) }
  }

  async function handleTestTelegram() {
    setTgTesting(true); setTgTestMsg('')
    try {
      const res = await fetch('/api/me/telegram/test', {
        method: 'POST', headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) { setTgTestMsg(data.detail === 'no_chat_id' ? 'Save a chat ID first' : 'Send failed'); return }
      setTgTestMsg('Test message sent ✓')
    } catch (_) { setTgTestMsg('Connection error') }
    finally { setTgTesting(false) }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwError(''); setPwSuccess('')
    if (newPass !== confirmPass) { setPwError(t('profile.pw.mismatch')); return }
    if (newPass.length < 8)     { setPwError(t('profile.pw.too_short')); return }
    setPwLoading(true)
    try {
      const res = await fetch(`${getApiBase()}/api/me/password`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPass, new_password: newPass }),
      })
      const data = await res.json()
      if (!res.ok) { setPwError(data.detail || t('profile.pw.error')); return }
      setPwSuccess(t('profile.pw.success'))
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
    } catch (_) {
      setPwError(t('login.error_connection'))
    } finally {
      setPwLoading(false)
    }
  }

  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-0)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.22em', color: 'var(--txt-3)', textTransform: 'uppercase', flexShrink: 0 }}>
        {t('profile.title')}
      </div>

      {loading && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>{t('profile.loading')}</div>
      )}

      {error && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--red)' }}>{error}</div>
      )}

      {profile && (
        <>
          <Section label={t('profile.section.account')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Row label={t('profile.field.username')} value={profile.username} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', letterSpacing: '.12em', color: 'var(--txt-3)', textTransform: 'uppercase' }}>{t('profile.field.plan')}</span>
                <span style={{ display: 'inline-flex', alignSelf: 'flex-start', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', fontWeight: '700', letterSpacing: '.1em', color: 'var(--accent)', background: 'rgba(0,200,255,0.10)', border: '1px solid rgba(0,200,255,0.30)', borderRadius: '3px', padding: '2px 8px' }}>
                  {profile.plan?.toUpperCase()}
                </span>
              </div>
              <Row label={t('profile.field.email')}        value={profile.email} />
              <Row label={t('profile.field.member_since')} value={createdAt} />
            </div>
          </Section>

          <Section label={t('profile.section.password')}>
            <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="password"
                placeholder={t('profile.pw.current')}
                value={currentPass}
                onChange={e => { setCurrentPass(e.target.value); setPwSuccess(''); setPwError('') }}
                required
                style={FIELD}
              />
              <input
                type="password"
                placeholder={t('profile.pw.new')}
                value={newPass}
                onChange={e => { setNewPass(e.target.value); setPwSuccess(''); setPwError('') }}
                required
                style={FIELD}
              />
              <input
                type="password"
                placeholder={t('profile.pw.confirm')}
                value={confirmPass}
                onChange={e => { setConfirmPass(e.target.value); setPwSuccess(''); setPwError('') }}
                required
                style={FIELD}
              />
              {pwError && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--red)' }}>{pwError}</div>
              )}
              {pwSuccess && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--green)' }}>{pwSuccess}</div>
              )}
              <button
                type="submit"
                disabled={pwLoading}
                style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(0,200,255,0.10)',
                  border: '1px solid rgba(0,200,255,0.30)',
                  borderRadius: '4px',
                  color: 'var(--accent)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: '700',
                  letterSpacing: '.1em',
                  padding: '8px 20px',
                  cursor: pwLoading ? 'default' : 'pointer',
                  opacity: pwLoading ? 0.5 : 1,
                  transition: 'opacity .15s',
                }}
              >
                {pwLoading ? t('profile.pw.saving') : t('profile.pw.submit')}
              </button>
            </form>
          </Section>

          <Section label={t('profile.section.plan')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '.1em' }}>
                  {profile.plan?.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', marginTop: '3px' }}>
                  {t('profile.field.current_plan')}
                </div>
              </div>
              <button
                onClick={() => onNavigate('plans')}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--txt-2)',
                  fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)',
                  fontWeight: '600',
                  letterSpacing: '.1em',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  transition: 'border-color .15s, color .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt-2)' }}
              >
                {t('profile.plan.change')}
              </button>
            </div>
          </Section>

          <Section label="My Topics">
            <div style={{ marginBottom: '10px', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)' }}>
              Plan: <span style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>{topicPlan}</span>
              {' · '}{topicLimit == null ? '∞' : topicLimit} topics max
            </div>
            <TopicSelector
              selected={myTopics}
              limit={topicLimit}
              onChange={setMyTopics}
              catalog={catalog}
            />
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleSaveTopics}
                disabled={topicSaving}
                style={{
                  padding: '8px 20px', background: 'rgba(0,200,255,0.1)',
                  border: '1px solid rgba(0,200,255,0.3)', borderRadius: '3px',
                  color: 'var(--cyan)', fontFamily: 'var(--mono)',
                  fontSize: 'var(--label-sm)', cursor: topicSaving ? 'default' : 'pointer',
                  opacity: topicSaving ? 0.7 : 1,
                }}
              >
                {topicSaving ? 'SAVING…' : 'SAVE TOPICS'}
              </button>
              {topicMsg && (
                <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                  color: topicMsg.includes('✓') ? 'var(--green)' : 'var(--red)' }}>
                  {topicMsg}
                </span>
              )}
            </div>
          </Section>

          <Section label="Telegram Alerts">
            <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: 'var(--txt-3)', marginBottom: '12px', lineHeight: '1.6' }}>
              1. Open Telegram · 2. Search <span style={{ color: 'var(--txt-2)' }}>@QilinAlertBot</span> · 3. Send <span style={{ color: 'var(--txt-2)' }}>/start</span> · 4. Copy your chat ID below
            </div>
            <input
              value={chatId}
              onChange={e => setChatId(e.target.value)}
              placeholder="Your Telegram chat ID (e.g. 123456789)"
              style={{ ...FIELD, marginBottom: '10px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={handleSaveTelegram} disabled={tgSaving} style={{
                padding: '8px 16px', background: 'rgba(0,200,255,0.1)',
                border: '1px solid rgba(0,200,255,0.3)', borderRadius: '3px',
                color: 'var(--cyan)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                cursor: tgSaving ? 'default' : 'pointer', opacity: tgSaving ? 0.7 : 1,
              }}>
                {tgSaving ? 'SAVING…' : 'SAVE'}
              </button>
              <button onClick={handleTestTelegram} disabled={tgTesting} style={{
                padding: '8px 16px', background: 'transparent',
                border: '1px solid var(--border-md)', borderRadius: '3px',
                color: 'var(--txt-2)', fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)',
                cursor: tgTesting ? 'default' : 'pointer', opacity: tgTesting ? 0.7 : 1,
              }}>
                {tgTesting ? 'SENDING…' : 'SEND TEST'}
              </button>
              {tgMsg && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: tgMsg.includes('✓') ? 'var(--green)' : 'var(--red)' }}>{tgMsg}</span>}
              {tgTestMsg && <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--label-sm)', color: tgTestMsg.includes('✓') ? 'var(--green)' : 'var(--red)' }}>{tgTestMsg}</span>}
            </div>
          </Section>
        </>
      )}
    </div>
  )
}
