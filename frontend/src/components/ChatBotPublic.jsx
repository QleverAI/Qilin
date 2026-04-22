import { useState, useRef, useEffect } from 'react'
import { apiFetchPublic } from '../hooks/apiClient'

const C = {
  bg1: '#040c18',
  gold: '#c8a03c',
  goldLight: '#e8c060',
  goldFill: 'rgba(200,160,60,0.10)',
  goldBorder: 'rgba(200,160,60,0.22)',
  goldDim: 'rgba(200,160,60,0.55)',
  txt1: 'rgba(220,230,245,0.82)',
  txt3: 'rgba(220,230,245,0.3)',
  border: 'rgba(200,160,60,0.12)',
}

export default function ChatBotPublic() {
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
      const data = await apiFetchPublic('/api/chat/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      const msg = err.message?.includes('429')
        ? 'Has alcanzado el límite de mensajes por hora. Inténtalo más tarde.'
        : 'Error al conectar. Inténtalo de nuevo.'
      setMessages(prev => [...prev, { role: 'assistant', content: msg }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* FAB */}
      <button onClick={() => setOpen(o => !o)} title="Hablar con Qilin"
        style={{
          position:'fixed', bottom:24, right:24, zIndex:1000,
          width:52, height:52, borderRadius:'50%',
          background: open ? 'rgba(200,160,60,0.18)' : C.goldFill,
          border:`1px solid ${open ? C.gold : C.goldBorder}`,
          color: C.goldLight, fontSize: open ? 20 : 18, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 20px rgba(200,160,60,0.18)',
          transition:'all .15s', fontFamily:'inherit',
        }}>
        {open ? '×' : '◈'}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position:'fixed', bottom:84, right:24, zIndex:999,
          width:320, background: C.bg1, borderRadius:20,
          border:`1px solid ${C.goldBorder}`,
          boxShadow:'0 8px 40px rgba(0,0,0,0.65)',
          display:'flex', flexDirection:'column',
          fontFamily:"'Segoe UI', system-ui, sans-serif",
          overflow:'hidden',
        }}>
          {/* Header */}
          <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:10,
            background:'rgba(200,160,60,0.06)', borderBottom:`1px solid ${C.border}` }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:C.goldFill,
              border:`1px solid ${C.goldBorder}`, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:15, color:C.goldLight }}>◈</div>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:C.goldLight }}>Qilin</div>
              <div style={{ fontSize:11, color:C.goldDim }}>● Activo ahora</div>
            </div>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])}
                style={{ marginLeft:'auto', background:'none', border:'none',
                  color:C.txt3, cursor:'pointer', fontSize:11, fontFamily:'inherit' }}>
                limpiar
              </button>
            )}
          </div>

          {/* Messages */}
          <div style={{ padding:'14px 14px 8px', display:'flex', flexDirection:'column',
            gap:10, maxHeight:260, overflowY:'auto' }}>
            {messages.length === 0 && (
              <div style={{ fontSize:13, color:C.txt3, lineHeight:1.65 }}>
                Hola, soy Qilin. Puedo explicarte cómo funciona la plataforma o ayudarte a elegir el plan correcto.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth:'88%', padding:'9px 13px', fontSize:13, lineHeight:1.55,
                borderRadius: m.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                background: m.role === 'user' ? 'rgba(200,160,60,0.14)' : 'rgba(255,255,255,0.05)',
                color: m.role === 'user' ? C.goldLight : C.txt1,
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf:'flex-start', fontSize:18, color:C.goldDim,
                letterSpacing:4, padding:'2px 8px' }}>···</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ display:'flex', alignItems:'center', gap:8,
            padding:'8px 12px 14px', borderTop:`1px solid ${C.border}` }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey} placeholder="Escribe algo…" disabled={loading}
              autoFocus
              style={{ flex:1, background:'rgba(255,255,255,0.05)',
                border:`1px solid rgba(200,160,60,0.15)`, borderRadius:22,
                padding:'9px 14px', color:'#f0f4f8', fontSize:13,
                fontFamily:'inherit', outline:'none' }} />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{ width:36, height:36, borderRadius:'50%', background:C.goldFill,
                border:`1px solid ${C.goldBorder}`, color:C.gold,
                cursor:(loading || !input.trim()) ? 'default' : 'pointer',
                opacity:(loading || !input.trim()) ? .35 : 1,
                fontSize:14, display:'flex', alignItems:'center', justifyContent:'center',
                transition:'opacity .1s', flexShrink:0 }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
