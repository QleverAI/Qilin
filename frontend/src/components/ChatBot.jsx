import { useState, useRef, useEffect } from 'react'
import { apiFetch } from '../hooks/apiClient'

export default function ChatBot() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const data = await apiFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (_) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el asistente.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="Asistente Qilin"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
          width: 44, height: 44, borderRadius: '50%',
          background: open ? 'rgba(0,200,255,0.18)' : 'rgba(0,200,255,0.10)',
          border: `1px solid ${open ? 'rgba(0,200,255,0.6)' : 'rgba(0,200,255,0.35)'}`,
          color: '#00c8ff', fontSize: open ? 20 : 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0,200,255,0.15)',
          transition: 'all .15s',
          fontFamily: 'inherit',
        }}
      >
        {open ? '×' : '◎'}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 72, right: 20, zIndex: 999,
          width: 320, height: 440,
          background: 'rgba(7,14,28,0.97)',
          border: '1px solid rgba(0,200,255,0.25)',
          borderRadius: 4,
          boxShadow: '0 4px 32px rgba(0,0,0,0.75)',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'IBM Plex Mono', monospace",
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '9px 14px', flexShrink: 0,
            borderBottom: '1px solid rgba(0,200,255,0.12)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.2em', color: 'rgba(0,200,255,0.55)', textTransform: 'uppercase' }}>
              ◎ ASISTENTE QILIN
            </span>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                title="Limpiar conversación"
                style={{ background: 'none', border: 'none', color: 'rgba(0,200,255,0.3)', cursor: 'pointer', fontSize: 10, padding: 0 }}
              >
                limpiar
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 11, color: 'rgba(200,216,232,0.35)', lineHeight: 1.7, marginTop: 4 }}>
                Pregúntame sobre Qilin — qué muestra el mapa, cómo funcionan las alertas, qué aviones VIP se monitorean…
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '86%',
                padding: '7px 10px',
                borderRadius: m.role === 'user' ? '8px 8px 2px 8px' : '2px 8px 8px 8px',
                background: m.role === 'user' ? 'rgba(0,200,255,0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${m.role === 'user' ? 'rgba(0,200,255,0.22)' : 'rgba(255,255,255,0.07)'}`,
                fontSize: 12, lineHeight: 1.55,
                color: m.role === 'user' ? '#00c8ff' : 'rgba(200,216,232,0.82)',
                whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', fontSize: 13, color: 'rgba(0,200,255,0.4)', letterSpacing: '.15em', padding: '2px 4px' }}>
                · · ·
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{
            padding: '8px 10px', flexShrink: 0,
            borderTop: '1px solid rgba(0,200,255,0.12)',
            display: 'flex', gap: 7,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pregunta algo sobre Qilin…"
              disabled={loading}
              autoFocus
              style={{
                flex: 1,
                background: 'rgba(0,200,255,0.05)',
                border: '1px solid rgba(0,200,255,0.18)',
                borderRadius: 3, padding: '6px 9px',
                color: '#c8d8e8', fontSize: 12,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: 'rgba(0,200,255,0.10)',
                border: '1px solid rgba(0,200,255,0.28)',
                borderRadius: 3, color: '#00c8ff',
                fontSize: 14, padding: '0 11px',
                cursor: (loading || !input.trim()) ? 'default' : 'pointer',
                opacity: (loading || !input.trim()) ? 0.35 : 1,
                transition: 'opacity .1s',
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
