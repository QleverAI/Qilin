export default function PlaybackControls({ playback }) {
  const {
    isPlaying, speed, currentTime,
    globalStart, globalEnd,
    play, pause, seek, setSpeed,
  } = playback

  const duration = Math.max(globalEnd - globalStart, 1)
  const progress = globalStart > 0
    ? Math.round(((currentTime - globalStart) / duration) * 1000)
    : 0

  const timestamp = currentTime > 0
    ? new Date(currentTime).toISOString().slice(11, 19) + ' UTC'
    : '--:--:-- UTC'

  return (
    <div style={{
      borderTop: '1px solid var(--border-md)',
      padding: '8px 10px',
      background: 'var(--bg-0)',
      fontFamily: 'var(--mono)',
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 'var(--label-xs)', color: 'var(--txt-3)',
        letterSpacing: '.12em', marginBottom: 6,
      }}>
        REPRODUCCIÓN
      </div>

      {/* Row 1: rewind, play/pause, scrubber */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <button onClick={() => seek(globalStart)} style={BTN}>⏮</button>
        <button
          onClick={() => isPlaying ? pause() : play()}
          style={{ ...BTN, color: 'var(--accent)', fontSize: 16 }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <input
          type="range" min={0} max={1000} value={progress}
          onChange={e => seek(globalStart + (Number(e.target.value) / 1000) * duration)}
          style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: 3 }}
        />
      </div>

      {/* Row 2: speed buttons + timestamp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 'var(--label-xs)', color: 'var(--txt-3)' }}>VEL:</span>
        {[1, 5, 20, 50].map(s => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            style={{
              background: speed === s ? 'rgba(79,156,249,0.15)' : 'var(--bg-3)',
              border: `1px solid ${speed === s ? 'rgba(79,156,249,0.5)' : 'var(--border)'}`,
              color: speed === s ? 'var(--accent)' : 'var(--txt-3)',
              borderRadius: 2, fontFamily: 'var(--mono)',
              fontSize: 'var(--label-xs)', padding: '1px 5px', cursor: 'pointer',
            }}
          >{s}×</button>
        ))}
        <span style={{
          marginLeft: 'auto', fontSize: 'var(--label-xs)',
          color: 'var(--accent)', letterSpacing: '.06em',
        }}>
          {timestamp}
        </span>
      </div>
    </div>
  )
}

const BTN = {
  background: 'none', border: 'none', color: 'var(--txt-2)',
  cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px',
}
