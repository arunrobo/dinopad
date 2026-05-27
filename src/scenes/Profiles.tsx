import { useState } from 'react';
import { useStore, createDefaultProfile, type PlayerProfile } from '../state/store';
import { DINO_AVATARS, getDinoSVG } from '../engine/assets';
import { PLAYER_COLORS } from '../engine/utils';

export default function Profiles() {
  const { state, dispatch } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState(0);
  const [editColor, setEditColor] = useState('#4A90D9');

  const profiles = state.playerProfiles;
  const colors = PLAYER_COLORS;

  const handleAdd = () => {
    const idx = profiles.length;
    const c = colors[idx % colors.length];
    const p = createDefaultProfile(idx, c);
    dispatch({ type: 'ADD_PROFILE', profile: p });
    startEdit(p);
  };

  const startEdit = (p: PlayerProfile) => {
    setEditingId(p.id); setEditName(p.name); setEditAvatar(p.avatarId); setEditColor(p.color);
  };

  const saveEdit = () => {
    if (!editingId) return;
    dispatch({ type: 'UPDATE_PROFILE', id: editingId, updates: { name: editName || 'Player', avatarId: editAvatar, color: editColor } });
    setEditingId(null);
  };

  return (
    <div className="scene" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', background: 'linear-gradient(180deg, #1a3a15, #2d5a27)',
      padding: '20px', color: 'white',
    }}>
      <h1 style={{ color: '#FFD700', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', marginBottom: '20px' }}>👤 Player Profiles</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', maxWidth: '800px', marginBottom: '20px' }}>
        {profiles.map(p => (
          <div key={p.id} style={{
            background: editingId === p.id ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
            borderRadius: '16px', padding: '16px', width: '180px', textAlign: 'center',
            border: editingId === p.id ? `3px solid ${p.color}` : '2px solid rgba(255,255,255,0.1)',
          }}>
            {editingId === p.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} maxLength={12}
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '1rem', textAlign: 'center', marginBottom: '8px', outline: 'none' }}
                  placeholder="Name" />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '8px' }}>
                  {DINO_AVATARS.map(d => (
                    <div key={d.id} onClick={() => setEditAvatar(d.id)}
                      style={{ width: 36, height: 36, borderRadius: '8px', border: editAvatar === d.id ? '2px solid #FFD700' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: editAvatar === d.id ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)' }}
                      dangerouslySetInnerHTML={{ __html: getDinoSVG(d.id, editColor, 28) }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '8px' }}>
                  {colors.map(c => (
                    <div key={c} onClick={() => setEditColor(c)}
                      style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: editColor === c ? '3px solid white' : '2px solid rgba(255,255,255,0.3)', cursor: 'pointer' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button onClick={saveEdit} style={sb('#4CAF50')}>Save</button>
                  <button onClick={() => setEditingId(null)} style={sb('#666')}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ margin: '0 auto 8px', width: 48, height: 48 }} dangerouslySetInnerHTML={{ __html: getDinoSVG(p.avatarId, p.color, 48) }} />
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{DINO_AVATARS[p.avatarId]?.name || 'Dino'}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button onClick={() => startEdit(p)} style={sb('#2196F3')}>Edit</button>
                  <button onClick={() => { dispatch({ type: 'DELETE_PROFILE', id: p.id }); if (editingId === p.id) setEditingId(null); }} style={sb('#E74C3C')}>Del</button>
                </div>
              </>
            )}
          </div>
        ))}
        <div onClick={handleAdd} style={{
          background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px', width: '180px', textAlign: 'center',
          border: '2px dashed rgba(255,255,255,0.3)', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '150px',
        }}>
          <span style={{ fontSize: '2.5rem', opacity: 0.5 }}>+</span>
          <span style={{ opacity: 0.5 }}>Add Player</span>
        </div>
      </div>

      <button onClick={() => dispatch({ type: 'SET_SCENE', scene: 'launch' })} style={{
        padding: '12px 32px', fontSize: '1.1rem', fontWeight: 'bold', color: 'white',
        background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)',
        borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
      }}>← Back</button>
    </div>
  );
}

function sb(bg: string): React.CSSProperties {
  return { padding: '6px 14px', borderRadius: '8px', border: 'none', background: bg, color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' };
}
