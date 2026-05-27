import { useStore } from '../state/store';
import { getDinoSVG } from '../engine/assets';
import { audioManager } from '../engine/audioManager';
import { useEffect } from 'react';

export default function Results() {
  const { state, dispatch } = useStore();
  const r = state.gameResults;

  useEffect(() => { if (r) audioManager.play('win'); }, [r]);

  if (!r) return (
    <div className="scene" style={ss}>
      <h2 style={{ color: '#FFD700' }}>No results</h2>
      <button onClick={() => dispatch({ type: 'SET_SCENE', scene: 'launch' })} style={bs('#4CAF50')}>Main Menu</button>
    </div>
  );

  const sorted = [...r.playerResults].sort((a, b) => a.rank - b.rank);

  return (
    <div className="scene" style={ss}>
      <h1 style={{ color: '#FFD700', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', marginBottom: '8px', animation: 'bounceIn 0.5s ease' }}>
        {r.coop ? '🎉 Team Results!' : '🏆 Final Standings!'}
      </h1>
      <h2 style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)', color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>{r.gameName}</h2>
      {r.coop && r.sharedScore !== undefined && (
        <div style={{ fontSize: 'clamp(2rem, 7vw, 4rem)', fontWeight: 900, color: '#FFD700', marginBottom: '16px', textShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}>
          {r.sharedScore} 🥚
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', maxWidth: '700px', marginBottom: '24px' }}>
        {sorted.map((pr, i) => (
          <div key={pr.id} style={{
            background: 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', width: '160px', textAlign: 'center',
            border: `3px solid ${pr.color}`, animation: `slideUp 0.4s ease ${i * 0.1}s both`, position: 'relative',
          }}>
            {!r.coop && pr.rank === 1 && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontSize: '1.5rem' }}>👑</div>}
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: pr.rank === 1 ? '#FFD700' : 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
              {!r.coop ? `#${pr.rank}` : '⭐'}
            </div>
            <div style={{ margin: '0 auto 6px', width: 48, height: 48 }} dangerouslySetInnerHTML={{ __html: getDinoSVG(pr.avatarId, pr.color, 48) }} />
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '2px' }}>{pr.name}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#FFD700', marginBottom: '6px' }}>{pr.score}</div>
            {Object.keys(pr.stats).length > 0 && (
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                {Object.entries(pr.stats).map(([k, v]) => <div key={k}>{k}: {v}</div>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => dispatch({ type: 'SET_SCENE', scene: 'tutorial' })} style={bs('#4CAF50')}>🔄 Play Again</button>
        <button onClick={() => dispatch({ type: 'SET_SCENE', scene: 'selectGame' })} style={bs('#2196F3')}>🎯 Change Game</button>
        <button onClick={() => dispatch({ type: 'SET_SCENE', scene: 'launch' })} style={bs('#FF9800')}>🏠 Main Menu</button>
      </div>
    </div>
  );
}

const ss: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  minHeight: '100vh', background: 'linear-gradient(180deg, #1a1a2e, #16213e)', padding: '20px', color: 'white',
};
function bs(bg: string): React.CSSProperties {
  return { padding: '14px 28px', fontSize: '1.1rem', fontWeight: 'bold', color: 'white', background: bg, border: 'none', borderRadius: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontFamily: 'inherit' };
}
