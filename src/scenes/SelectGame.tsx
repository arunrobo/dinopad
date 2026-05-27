import { useStore } from '../state/store';
import { GAME_NAMES } from './games/types';

const INFO = [
  { icon: '🎲', desc: 'Roll dice & climb the board!', color: '#27AE60', lighter: '#4CAF50' },
  { icon: '🦴', desc: 'Match fossil pairs!', color: '#2980B9', lighter: '#42A5F5' },
  { icon: '🌋', desc: 'Race to the volcano summit!', color: '#D35400', lighter: '#FF8A65' },
  { icon: '🥚', desc: 'Save baby dinos together!', color: '#C0392B', lighter: '#EF5350', badge: 'CO-OP' },
];

export default function SelectGame() {
  const { state, dispatch } = useStore();
  const complexity = state.settings.complexity ?? 'low';
  const isMedium = complexity === 'medium';

  return (
    <div className="scene" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'linear-gradient(180deg, #87CEEB 0%, #2d5a27 60%, #1a3a15 100%)',
      padding: '20px', color: 'white',
    }}>
      {/* Decorative dinos */}
      <div style={{ position: 'absolute', top: '5%', left: '6%', fontSize: '2rem', opacity: 0.4, animation: 'float 5s ease-in-out infinite' }}>🦕</div>
      <div style={{ position: 'absolute', top: '8%', right: '8%', fontSize: '2rem', opacity: 0.4, animation: 'float 6s ease-in-out infinite 1s', transform: 'scaleX(-1)' }}>🦖</div>

      <h1 style={{
        color: '#FFD700', fontSize: 'clamp(1.8rem, 6vw, 3rem)', marginBottom: 'clamp(16px, 3vh, 32px)',
        fontFamily: "'Fredoka One', cursive",
        textShadow: '2px 2px 0 #E67E22, 0 0 20px rgba(255,215,0,0.3)',
        animation: 'bounceIn 0.6s ease',
      }}>
        🎯 Pick a Game!
      </h1>

      {/* Complexity Toggle */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        marginBottom: 'clamp(14px, 2.5vh, 24px)', animation: 'slideUp 0.4s ease 0.1s both',
      }}>
        <span style={{ fontSize: 'clamp(0.7rem, 2vw, 0.85rem)', color: 'rgba(255,255,180,0.85)', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          Difficulty
        </span>
        <div style={{
          display: 'flex', background: 'rgba(0,0,0,0.35)', borderRadius: '40px',
          padding: '4px', border: '2px solid rgba(255,255,255,0.15)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          {(['low', 'medium'] as const).map(c => (
            <button key={c} onClick={() => dispatch({ type: 'UPDATE_SETTINGS', settings: { complexity: c } })}
              style={{
                padding: 'clamp(6px, 1.5vh, 10px) clamp(18px, 4vw, 36px)',
                borderRadius: '36px', border: 'none', cursor: 'pointer',
                fontFamily: "'Fredoka One', cursive",
                fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)',
                fontWeight: 'bold', letterSpacing: '0.5px',
                transition: 'all 0.2s ease',
                background: complexity === c
                  ? (c === 'low' ? 'linear-gradient(135deg, #4CAF50, #27AE60)' : 'linear-gradient(135deg, #FF8C00, #C0392B)')
                  : 'transparent',
                color: complexity === c ? 'white' : 'rgba(255,255,255,0.5)',
                boxShadow: complexity === c ? '0 3px 12px rgba(0,0,0,0.35)' : 'none',
              }}>
              {c === 'low' ? '🌱 Low' : '🔥 Medium'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 'clamp(0.6rem, 1.6vw, 0.75rem)', color: 'rgba(255,255,200,0.65)' }}>
          {isMedium ? 'Bigger boards · More challenges · Game 4 unavailable' : 'Great for younger players'}
        </span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(10px, 2vw, 18px)',
        maxWidth: '520px', width: '100%', padding: '0 8px',
        animation: 'slideUp 0.5s ease 0.2s both',
      }}>
        {GAME_NAMES.map((name, i) => {
          const g = INFO[i];
          const disabled = isMedium && i === 3;
          return (
            <button key={i}
              disabled={disabled}
              onClick={() => { if (!disabled) { dispatch({ type: 'SET_GAME', gameId: i }); dispatch({ type: 'SET_SCENE', scene: 'tutorial' }); } }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: 'clamp(14px, 2.5vh, 24px) clamp(10px, 2vw, 16px)',
                borderRadius: '20px', border: disabled ? '2px dashed rgba(255,255,255,0.2)' : 'none',
                background: disabled
                  ? 'rgba(80,80,80,0.35)'
                  : `linear-gradient(145deg, ${g.lighter}ee, ${g.color}cc)`,
                color: disabled ? 'rgba(255,255,255,0.4)' : 'white',
                cursor: disabled ? 'not-allowed' : 'pointer',
                boxShadow: disabled ? 'none' : `0 6px 24px ${g.color}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
                fontFamily: 'inherit', transition: 'transform 0.15s',
                position: 'relative', overflow: 'hidden',
                filter: disabled ? 'grayscale(0.8)' : 'none',
              }}>
              <span style={{
                fontSize: 'clamp(2.5rem, 7vw, 4rem)', marginBottom: '6px',
                filter: disabled ? 'none' : 'drop-shadow(2px 3px 2px rgba(0,0,0,0.3))',
                opacity: disabled ? 0.45 : 1,
              }}>{g.icon}</span>
              <span style={{
                fontSize: 'clamp(0.9rem, 2.8vw, 1.2rem)', fontWeight: 'bold', marginBottom: '2px',
                fontFamily: "'Fredoka One', cursive",
                textShadow: disabled ? 'none' : '1px 1px 3px rgba(0,0,0,0.4)', textAlign: 'center',
              }}>{name}</span>
              <span style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.8rem)', opacity: 0.9, textAlign: 'center' }}>
                {disabled ? '🔒 Medium mode only' : g.desc}
              </span>
              {!disabled && g.badge && <span style={{
                marginTop: '4px', fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)',
                background: 'rgba(255,255,255,0.25)', padding: '2px 10px',
                borderRadius: '10px', fontWeight: 'bold', letterSpacing: '1px',
              }}>{g.badge}</span>}
              {disabled && <span style={{
                marginTop: '4px', fontSize: 'clamp(0.55rem, 1.5vw, 0.65rem)',
                background: 'rgba(0,0,0,0.3)', padding: '2px 10px',
                borderRadius: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)',
              }}>LOW ONLY</span>}
            </button>
          );
        })}
      </div>

      <button onClick={() => dispatch({ type: 'SET_SCENE', scene: 'setup' })} style={{
        marginTop: 'clamp(16px, 3vh, 28px)', padding: '10px 28px', fontSize: '1rem', fontWeight: 'bold', color: 'white',
        background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '14px',
        cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)',
      }}>← Back</button>
    </div>
  );
}
