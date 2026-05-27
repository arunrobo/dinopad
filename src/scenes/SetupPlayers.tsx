import { useState, useEffect } from 'react';
import { useStore, createDefaultProfile } from '../state/store';
import { PLAYER_COLORS, SIDE_ASSIGNMENTS } from '../engine/utils';
import { DINO_AVATARS, getDinoSVG } from '../engine/assets';

export default function SetupPlayers() {
  const { state, dispatch } = useStore();
  const [numPlayers, setNumPlayers] = useState(state.numberOfPlayers);

  useEffect(() => {
    const needed = numPlayers - state.playerProfiles.length;
    if (needed > 0) {
      for (let i = 0; i < needed; i++) {
        const idx = state.playerProfiles.length + i;
        dispatch({ type: 'ADD_PROFILE', profile: createDefaultProfile(idx, PLAYER_COLORS[idx % PLAYER_COLORS.length]) });
      }
    }
  }, [numPlayers, state.playerProfiles.length, dispatch]);

  const sides = SIDE_ASSIGNMENTS[numPlayers] || ['bottom'];
  const selected = state.playerProfiles.slice(0, numPlayers);

  const handleContinue = () => {
    dispatch({ type: 'SET_NUM_PLAYERS', count: numPlayers });
    dispatch({ type: 'SET_SELECTED_PLAYERS', ids: selected.map(p => p.id) });
    dispatch({ type: 'SET_SCENE', scene: 'selectGame' });
  };

  return (
    <div className="scene" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', background: 'linear-gradient(180deg, #1a3a15, #2d5a27)',
      padding: '20px', color: 'white',
    }}>
      <h1 style={{ color: '#FFD700', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', marginBottom: '20px' }}>🎮 How Many Dinos?</h1>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[1, 2, 3, 4].map(n => (
          <button key={n} onClick={() => setNumPlayers(n)} style={{
            width: 'clamp(70px, 15vw, 100px)', height: 'clamp(70px, 15vw, 100px)',
            borderRadius: '20px', border: numPlayers === n ? '4px solid #FFD700' : '3px solid rgba(255,255,255,0.2)',
            background: numPlayers === n ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)',
            color: 'white', fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: 'bold',
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            {n}
            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{'🦕'.repeat(n)}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '20px', maxWidth: '700px' }}>
        {selected.map((profile, i) => (
          <div key={profile.id} style={{
            background: 'rgba(255,255,255,0.08)', borderRadius: '16px', padding: '12px',
            width: '160px', border: `3px solid ${profile.color}`,
          }}>
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>📍 {sides[i]} side</div>
            <div style={{ margin: '0 auto 6px', width: 40, height: 40 }} dangerouslySetInnerHTML={{ __html: getDinoSVG(profile.avatarId, profile.color, 40) }} />
            <input value={profile.name}
              onChange={e => dispatch({ type: 'UPDATE_PROFILE', id: profile.id, updates: { name: e.target.value } })}
              maxLength={12}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.9rem', textAlign: 'center', outline: 'none', marginBottom: '6px' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', justifyContent: 'center' }}>
              {DINO_AVATARS.map(d => (
                <div key={d.id}
                  onClick={() => dispatch({ type: 'UPDATE_PROFILE', id: profile.id, updates: { avatarId: d.id } })}
                  style={{
                    width: 28, height: 28, borderRadius: '6px', cursor: 'pointer',
                    border: profile.avatarId === d.id ? '2px solid #FFD700' : '1px solid transparent',
                    background: profile.avatarId === d.id ? 'rgba(255,215,0,0.2)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  dangerouslySetInnerHTML={{ __html: getDinoSVG(d.id, profile.color, 22) }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={() => dispatch({ type: 'SET_SCENE', scene: 'launch' })} style={nb('rgba(255,255,255,0.15)')}>← Back</button>
        <button onClick={handleContinue} style={nb('#4CAF50')}>Choose Game →</button>
      </div>
    </div>
  );
}

function nb(bg: string): React.CSSProperties {
  return { padding: '12px 28px', fontSize: '1.1rem', fontWeight: 'bold', color: 'white', background: bg, border: 'none', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 10px rgba(0,0,0,0.2)' };
}
