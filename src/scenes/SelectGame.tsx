import { useStore } from '../state/store';
import { GAME_NAMES } from './games/types';

const INFO = [
  { icon: '🎲', desc: 'Roll dice & climb the board!', color: '#27AE60', lighter: '#4CAF50' },
  { icon: '🦴', desc: 'Match fossil pairs!', color: '#2980B9', lighter: '#42A5F5' },
  { icon: '🌋', desc: 'Race to the volcano summit!', color: '#D35400', lighter: '#FF8A65' },
  { icon: '🥚', desc: 'Save baby dinos together!', color: '#C0392B', lighter: '#EF5350', badge: 'CO-OP' },
];

export default function SelectGame() {
  const { dispatch } = useStore();
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

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(10px, 2vw, 18px)',
        maxWidth: '520px', width: '100%', padding: '0 8px',
        animation: 'slideUp 0.5s ease 0.2s both',
      }}>
        {GAME_NAMES.map((name, i) => {
          const g = INFO[i];
          return (
            <button key={i} onClick={() => { dispatch({ type: 'SET_GAME', gameId: i }); dispatch({ type: 'SET_SCENE', scene: 'tutorial' }); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: 'clamp(14px, 2.5vh, 24px) clamp(10px, 2vw, 16px)',
                borderRadius: '20px', border: 'none',
                background: `linear-gradient(145deg, ${g.lighter}ee, ${g.color}cc)`,
                color: 'white', cursor: 'pointer',
                boxShadow: `0 6px 24px ${g.color}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
                fontFamily: 'inherit', transition: 'transform 0.15s',
                position: 'relative', overflow: 'hidden',
              }}>
              <span style={{
                fontSize: 'clamp(2.5rem, 7vw, 4rem)', marginBottom: '6px',
                filter: 'drop-shadow(2px 3px 2px rgba(0,0,0,0.3))',
              }}>{g.icon}</span>
              <span style={{
                fontSize: 'clamp(0.9rem, 2.8vw, 1.2rem)', fontWeight: 'bold', marginBottom: '2px',
                fontFamily: "'Fredoka One', cursive",
                textShadow: '1px 1px 3px rgba(0,0,0,0.4)', textAlign: 'center',
              }}>{name}</span>
              <span style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.8rem)', opacity: 0.9, textAlign: 'center' }}>{g.desc}</span>
              {g.badge && <span style={{
                marginTop: '4px', fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)',
                background: 'rgba(255,255,255,0.25)', padding: '2px 10px',
                borderRadius: '10px', fontWeight: 'bold', letterSpacing: '1px',
              }}>{g.badge}</span>}
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
