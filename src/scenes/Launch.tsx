import { useState } from 'react';
import { useStore } from '../state/store';
import { audioManager } from '../engine/audioManager';
import Modal from '../ui/Modal';
import SettingsPanel from '../ui/SettingsPanel';

export default function Launch() {
  const { state, dispatch } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(audioManager.unlocked);

  const unlock = async () => {
    await audioManager.init();
    await audioManager.tryUnlock();
    setAudioUnlocked(audioManager.unlocked);
  };

  const handleStart = async () => { await unlock(); dispatch({ type: 'SET_SCENE', scene: 'setup' }); };

  return (
    <div className="scene" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: '20px', position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(180deg, #87CEEB 0%, #5BB85B 50%, #2d5a27 80%, #1a3a15 100%)',
    }}>
      {/* Decorative background dinos & clouds */}
      <div style={{ position: 'absolute', top: '6%', left: '5%', fontSize: 'clamp(2.5rem, 7vw, 4rem)', opacity: 0.5, animation: 'float 6s ease-in-out infinite' }}>☁️</div>
      <div style={{ position: 'absolute', top: '4%', right: '8%', fontSize: 'clamp(3rem, 8vw, 5rem)', opacity: 0.4, animation: 'float 8s ease-in-out infinite 2s' }}>☁️</div>
      <div style={{ position: 'absolute', top: '12%', left: '45%', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', opacity: 0.3, animation: 'float 10s ease-in-out infinite 1s' }}>☁️</div>
      <div style={{ position: 'absolute', bottom: '8%', left: '8%', fontSize: 'clamp(2rem, 6vw, 3.5rem)', animation: 'float 4s ease-in-out infinite 0.5s' }}>🦕</div>
      <div style={{ position: 'absolute', bottom: '6%', right: '6%', fontSize: 'clamp(2rem, 6vw, 3.5rem)', animation: 'float 5s ease-in-out infinite 1.5s', transform: 'scaleX(-1)' }}>🦖</div>
      <div style={{ position: 'absolute', bottom: '18%', left: '20%', fontSize: 'clamp(1.2rem, 3vw, 2rem)', opacity: 0.6, animation: 'float 7s ease-in-out infinite 3s' }}>🌿</div>
      <div style={{ position: 'absolute', bottom: '15%', right: '18%', fontSize: 'clamp(1.2rem, 3vw, 2rem)', opacity: 0.6, animation: 'float 6s ease-in-out infinite 2s' }}>🌴</div>
      <div style={{ position: 'absolute', top: '30%', right: '5%', fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', opacity: 0.4, animation: 'float 9s ease-in-out infinite 4s' }}>🐊</div>

      {/* Hero dino cluster */}
      <div style={{ display: 'flex', gap: 'clamp(4px, 2vw, 12px)', marginBottom: '4px', animation: 'bounceIn 0.6s ease' }}>
        {['🦕', '🦖', '🐊', '🦎'].map((d, i) => (
          <span key={i} style={{
            fontSize: 'clamp(2.5rem, 8vw, 5rem)',
            animation: `float ${3 + i * 0.7}s ease-in-out infinite ${i * 0.3}s`,
            filter: 'drop-shadow(2px 4px 3px rgba(0,0,0,0.3))',
          }}>{d}</span>
        ))}
      </div>

      {/* Title */}
      <div style={{
        fontSize: 'clamp(2.2rem, 9vw, 4.5rem)', fontWeight: 900, color: '#FFD700',
        fontFamily: "'Fredoka One', cursive",
        textShadow: '3px 3px 0 #E67E22, 6px 6px 0 rgba(0,0,0,0.25), 0 0 30px rgba(255,215,0,0.3)',
        textAlign: 'center', marginBottom: '4px', letterSpacing: '3px', animation: 'bounceIn 0.8s ease',
        lineHeight: 1.1,
      }}>
        Dino Party Pad
      </div>
      <div style={{
        fontSize: 'clamp(1rem, 3.5vw, 1.6rem)', color: 'white',
        marginBottom: 'clamp(24px, 5vh, 48px)', textAlign: 'center',
        textShadow: '0 2px 8px rgba(0,0,0,0.4)',
        animation: 'fadeIn 1s ease 0.3s both',
      }}>
        🎉 Roar together, play together! 🎉
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2vh, 20px)', width: '100%', maxWidth: '380px', animation: 'slideUp 0.6s ease 0.4s both' }}>
        <button className="big-btn" onClick={handleStart} style={btnSt('#4CAF50', '#66BB6A')}>
          <span style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)' }}>🎮</span>
          <span style={{ fontSize: 'clamp(1.2rem, 4vw, 1.6rem)' }}>Start Game!</span>
        </button>
        <div style={{ display: 'flex', gap: 'clamp(8px, 2vw, 16px)' }}>
          <button className="big-btn" onClick={() => dispatch({ type: 'SET_SCENE', scene: 'profiles' })} style={{ ...btnSt('#2196F3', '#42A5F5'), flex: 1 }}>
            <span style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)' }}>👤</span>
            <span style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1.1rem)' }}>Profiles</span>
          </button>
          <button className="big-btn" onClick={() => setShowSettings(true)} style={{ ...btnSt('#FF9800', '#FFA726'), flex: 1 }}>
            <span style={{ fontSize: 'clamp(1.2rem, 3vw, 1.6rem)' }}>⚙️</span>
            <span style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1.1rem)' }}>Settings</span>
          </button>
        </div>
      </div>

      {!audioUnlocked && (
        <div onClick={unlock} style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: 'white', padding: '12px 24px',
          borderRadius: '12px', cursor: 'pointer', fontSize: '1rem', animation: 'pulse 2s ease-in-out infinite',
        }}>🔊 Tap to enable sound</div>
      )}

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Settings">
        <SettingsPanel />
      </Modal>
    </div>
  );
}

function btnSt(color: string, lighter?: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    padding: 'clamp(12px, 2vh, 20px) clamp(20px, 4vw, 36px)',
    fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', fontWeight: 'bold',
    fontFamily: "'Fredoka One', cursive",
    color: 'white', background: `linear-gradient(135deg, ${lighter || color}, ${color})`,
    border: 'none', borderRadius: '20px', cursor: 'pointer',
    boxShadow: `0 6px 20px ${color}66, inset 0 1px 0 rgba(255,255,255,0.25)`,
    transition: 'transform 0.15s, box-shadow 0.15s',
  };
}
