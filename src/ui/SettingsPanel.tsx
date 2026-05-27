import { useStore } from '../state/store';
import { audioManager } from '../engine/audioManager';

export default function SettingsPanel() {
  const { state, dispatch } = useStore();
  const s = state.settings;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Row label="Mute">
        <Toggle on={s.mute} onToggle={() => {
          dispatch({ type: 'UPDATE_SETTINGS', settings: { mute: !s.mute } });
          audioManager.setMuted(!s.mute);
        }} />
      </Row>
      <Row label={`Volume: ${Math.round(s.volume * 100)}%`}>
        <input type="range" min="0" max="100" value={s.volume * 100}
          onChange={e => { const v = Number(e.target.value) / 100; dispatch({ type: 'UPDATE_SETTINGS', settings: { volume: v } }); audioManager.setVolume(v); }}
          style={{ width: '120px', accentColor: '#4CAF50' }} />
      </Row>
      <Row label="Kid Mode">
        <Toggle on={s.kidMode} onToggle={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { kidMode: !s.kidMode } })} />
      </Row>
      <Row label="High Contrast">
        <Toggle on={s.highContrast} onToggle={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { highContrast: !s.highContrast } })} />
      </Row>
      <Row label={`Turn Direction: ${s.turnDirection === 'clockwise' ? '↻ CW' : '↺ CCW'}`}>
        <Toggle on={s.turnDirection === 'counter-clockwise'} onToggle={() =>
          dispatch({ type: 'UPDATE_SETTINGS', settings: { turnDirection: s.turnDirection === 'clockwise' ? 'counter-clockwise' : 'clockwise' } })
        } />
      </Row>
      <Row label={`Turn Timer: ${s.turnTimer === 0 ? 'Off' : s.turnTimer + 's'}`}>
        <input type="range" min="0" max="30" step="5" value={s.turnTimer}
          onChange={e => dispatch({ type: 'UPDATE_SETTINGS', settings: { turnTimer: Number(e.target.value) } })}
          style={{ width: '120px', accentColor: '#FF9800' }} />
      </Row>
      <Row label="Board Theme">
        <div style={{ display: 'flex', gap: '6px' }}>
          {([['jungle', '🌿'], ['desert', '🏜️'], ['iceage', '🧊']] as const).map(([t, icon]) => (
            <button key={t} onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { boardTheme: t } })}
              style={{
                padding: '6px 10px', borderRadius: '8px',
                border: s.boardTheme === t ? '2px solid #FFD700' : '2px solid transparent',
                background: s.boardTheme === t ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.15)',
                color: 'white', cursor: 'pointer', fontSize: '0.85rem',
              }}>{icon} {t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
      </Row>
      <Row label="Difficulty">
        <div style={{ display: 'flex', gap: '6px' }}>
          {([['low', '🌱 Low'], ['medium', '🔥 Medium']] as const).map(([c, label]) => (
            <button key={c} onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { complexity: c } })}
              style={{
                padding: '6px 12px', borderRadius: '8px',
                border: s.complexity === c ? `2px solid ${c === 'low' ? '#4CAF50' : '#FF8C00'}` : '2px solid transparent',
                background: s.complexity === c
                  ? (c === 'low' ? 'rgba(76,175,80,0.25)' : 'rgba(255,140,0,0.25)')
                  : 'rgba(255,255,255,0.15)',
                color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
              }}>{label}</button>
          ))}
        </div>
      </Row>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '10px', marginTop: '4px' }}>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,200,100,0.8)', marginBottom: '8px' }}>
          ℹ️ Kid Mode, Board Theme &amp; Turn Direction apply when starting a new game.
        </p>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px' }}>
        <p style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>Test Sounds:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(['tap', 'whoosh', 'sparkle', 'win', 'reminder'] as const).map(s => (
            <button key={s} onClick={async () => { await audioManager.init(); await audioManager.tryUnlock(); audioManager.play(s); }}
              style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
            >{s}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: '1rem' }}>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 56, height: 30, borderRadius: 15, border: 'none',
      background: on ? '#4CAF50' : '#666', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 3, left: on ? 29 : 3, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}
