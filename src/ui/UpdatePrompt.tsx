import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { Scene } from '../state/store';

interface Props {
  scene: Scene;
}

/**
 * Listens for a waiting service worker (new version deployed).
 *
 * Behaviour:
 *  - On a menu/lobby screen  → silently reloads after a 1-second grace period.
 *  - Mid-game or on results  → shows a non-intrusive banner so the parent can
 *    choose when to apply the update without interrupting play.
 */
export default function UpdatePrompt({ scene }: Props) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const isMidGame = scene === 'game' || scene === 'results';

  // Auto-reload on safe screens so updates are invisible to players
  useEffect(() => {
    if (!needRefresh || isMidGame) return;
    const t = setTimeout(() => updateServiceWorker(true), 1_000);
    return () => clearTimeout(t);
  }, [needRefresh, isMidGame, updateServiceWorker]);

  // Only render the banner when the user is mid-game and can't auto-reload
  if (!needRefresh || !isMidGame) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 44,          // sits above the version badge
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9000,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'rgba(10,30,8,0.88)',
      backdropFilter: 'blur(10px)',
      border: '1.5px solid rgba(255,215,0,0.35)',
      borderRadius: 16,
      padding: '10px 16px',
      color: 'white',
      fontFamily: "'Fredoka One', cursive",
      fontSize: '0.9rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: '1.2rem' }}>🦕</span>
      <span>
        v<strong>{__APP_VERSION__}</strong> is ready!
      </span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          marginLeft: 4,
          padding: '5px 14px',
          background: 'linear-gradient(135deg, #66BB6A, #388E3C)',
          border: 'none',
          borderRadius: 10,
          color: 'white',
          fontFamily: "'Fredoka One', cursive",
          fontSize: '0.85rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        Reload
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '1rem',
          cursor: 'pointer',
          padding: '2px 4px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
