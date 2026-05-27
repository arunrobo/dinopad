import { useStore } from './state/store';
import { useState, useEffect } from 'react';
import Launch from './scenes/Launch';
import Profiles from './scenes/Profiles';
import SetupPlayers from './scenes/SetupPlayers';
import SelectGame from './scenes/SelectGame';
import TutorialOverlay from './scenes/TutorialOverlay';
import GameLayout from './scenes/GameLayout';
import Results from './scenes/Results';
import './App.css';

function useIsPortrait() {
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', check);
    screen.orientation?.addEventListener('change', check);
    return () => { window.removeEventListener('resize', check); screen.orientation?.removeEventListener('change', check); };
  }, []);
  return portrait;
}

export default function App() {
  const { state } = useStore();
  const isPortrait = useIsPortrait();

  const scene = (() => {
    switch (state.scene) {
      case 'launch': return <Launch />;
      case 'profiles': return <Profiles />;
      case 'setup': return <SetupPlayers />;
      case 'selectGame': return <SelectGame />;
      case 'tutorial': return <TutorialOverlay />;
      case 'game': return <GameLayout />;
      case 'results': return <Results />;
      default: return <Launch />;
    }
  })();

  return (
    <div style={state.settings.highContrast ? { filter: 'contrast(1.25) saturate(1.2)', width: '100%', height: '100%' } : undefined}>
      {scene}
      {isPortrait && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'linear-gradient(135deg, #1a3a15, #0d1f0c)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '24px', color: 'white', textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: '4rem', animation: 'pulse 2s ease-in-out infinite' }}>🔄</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '1px', fontFamily: "'Fredoka One', cursive" }}>
            Please rotate your device
          </div>
          <div style={{ fontSize: '1rem', opacity: 0.7, maxWidth: 280, fontFamily: "'Nunito', sans-serif" }}>
            Dino Party Pad is best played in landscape mode!
          </div>
          <div style={{ fontSize: '3rem', marginTop: 8 }}>🦕📱🦖</div>
        </div>
      )}
    </div>
  );
}
