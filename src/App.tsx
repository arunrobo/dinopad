import { useStore } from './state/store';
import { useState, useEffect, useRef, useCallback } from 'react';
import Launch from './scenes/Launch';
import Profiles from './scenes/Profiles';
import SetupPlayers from './scenes/SetupPlayers';
import SelectGame from './scenes/SelectGame';
import TutorialOverlay from './scenes/TutorialOverlay';
import GameLayout from './scenes/GameLayout';
import Results from './scenes/Results';
import ParentalLock from './scenes/ParentalLock';
import './App.css';

const MIN_WIDTH = 768;
const MIN_HEIGHT = 500;

const SESSION_LIMIT_MS  = 15 * 60 * 1000; // 15 minutes per session
const COOLDOWN_MS       = 30 * 60 * 1000; // 30 minute cooldown
const LOCK_STORAGE_KEY  = 'dino_locked_until';
const SESSION_START_KEY = 'dino_session_start'; // sessionStorage — survives refresh, not new tab

type ScreenState = 'ok' | 'tooSmall' | 'portrait';

function useScreenState(): ScreenState {
  const getState = (): ScreenState => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Check if even in best (landscape) orientation the screen would be too small
    if (Math.max(w, h) < MIN_WIDTH || Math.min(w, h) < MIN_HEIGHT) return 'tooSmall';
    if (h > w) return 'portrait';
    return 'ok';
  };
  const [screenState, setScreenState] = useState<ScreenState>(getState);
  useEffect(() => {
    const check = () => setScreenState(getState());
    window.addEventListener('resize', check);
    screen.orientation?.addEventListener('change', check);
    return () => { window.removeEventListener('resize', check); screen.orientation?.removeEventListener('change', check); };
  }, []);
  return screenState;
}

export default function App() {
  const { state } = useStore();
  const screenState = useScreenState();

  // ── Parental lock state ──────────────────────────────────────────────────
  // Session start: persists across refreshes via sessionStorage (new tab = new session)
  const sessionStartRef = useRef<number>((() => {
    const stored = sessionStorage.getItem(SESSION_START_KEY);
    if (stored) return Number(stored);
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, String(now));
    return now;
  })());

  // pendingLock = timer elapsed but waiting for game/results to finish before locking
  const [pendingLock, setPendingLock] = useState(false);

  // activeLock = lock screen is showing
  const [activeLock, setActiveLock] = useState(() => {
    const v = localStorage.getItem(LOCK_STORAGE_KEY);
    return v ? Date.now() < Number(v) : false;
  });

  // lockedUntil = timestamp when cooldown ends
  const [lockedUntil, setLockedUntil] = useState<number>(() => {
    const v = localStorage.getItem(LOCK_STORAGE_KEY);
    return v ? Number(v) : 0;
  });

  // Poll every 10 s to check if session limit reached
  useEffect(() => {
    if (activeLock) return;
    const id = setInterval(() => {
      if (!pendingLock && Date.now() - sessionStartRef.current >= SESSION_LIMIT_MS) {
        setPendingLock(true);
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [pendingLock, activeLock]);

  // Activate lock when pending AND not mid-game/results
  useEffect(() => {
    if (!pendingLock || activeLock) return;
    if (state.scene === 'game' || state.scene === 'results') return;
    const until = Date.now() + COOLDOWN_MS;
    localStorage.setItem(LOCK_STORAGE_KEY, String(until));
    setLockedUntil(until);
    setActiveLock(true);
    setPendingLock(false);
  }, [pendingLock, activeLock, state.scene]);

  const handleUnlock = useCallback(() => {
    localStorage.removeItem(LOCK_STORAGE_KEY);
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, String(now)); // fresh 15-min session
    sessionStartRef.current = now;
    setActiveLock(false);
    setPendingLock(false);
  }, []);

  // ── Session time remaining (1-second tick for badge) ──────────────────────
  const [sessionRemaining, setSessionRemaining] = useState(() =>
    Math.max(0, SESSION_LIMIT_MS - (Date.now() - sessionStartRef.current))
  );
  useEffect(() => {
    if (activeLock) return;
    const id = setInterval(() => {
      setSessionRemaining(Math.max(0, SESSION_LIMIT_MS - (Date.now() - sessionStartRef.current)));
    }, 1_000);
    return () => clearInterval(id);
  }, [activeLock]);

  const sessionFraction = sessionRemaining / SESSION_LIMIT_MS; // 1 → 0 as time passes
  const sessionMins = Math.floor(sessionRemaining / 60_000);
  const sessionSecs = Math.floor((sessionRemaining % 60_000) / 1_000);
  const sessionLabel = `${sessionMins}:${String(sessionSecs).padStart(2, '0')}`;
  const sessionColor = sessionFraction > 0.4 ? '#4CAF50' : sessionFraction > 0.15 ? '#FF9800' : '#f44336';

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

      {/* ── Session timer UI (hidden when locked or screen check overlays show) ── */}
      {!activeLock && screenState === 'ok' && (
        <>
          {/* Thin progress bar — always visible, even during gameplay */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 500,
            background: 'rgba(0,0,0,0.25)',
          }}>
            <div style={{
              height: '100%',
              width: `${sessionFraction * 100}%`,
              background: sessionColor,
              transition: 'width 1s linear, background 2s',
              boxShadow: `0 0 6px ${sessionColor}`,
            }} />
          </div>

          {/* Time badge — visible on menu/lobby scenes, hidden during active game */}
          {state.scene !== 'game' && (
            <div style={{
              position: 'fixed', top: 10, right: 12, zIndex: 500,
              background: 'rgba(10,25,8,0.72)', backdropFilter: 'blur(8px)',
              border: `1.5px solid ${pendingLock ? '#FF9800' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '20px', padding: '5px 12px 5px 9px',
              display: 'flex', alignItems: 'center', gap: '6px',
              color: 'white', fontFamily: "'Fredoka One', cursive",
              fontSize: '0.85rem', letterSpacing: '0.5px',
              boxShadow: pendingLock
                ? '0 2px 12px rgba(255,152,0,0.35)'
                : '0 2px 8px rgba(0,0,0,0.4)',
              transition: 'border-color 1s, box-shadow 1s',
              animation: pendingLock ? 'pulse 2s ease-in-out infinite' : undefined,
            }}>
              {pendingLock ? (
                <>
                  <span style={{ fontSize: '0.9rem' }}>🔔</span>
                  <span style={{ color: '#FFB74D' }}>Last game!</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '0.85rem' }}>⏱️</span>
                  <span style={{ color: sessionColor, transition: 'color 2s' }}>{sessionLabel}</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.45, marginLeft: 1 }}>left</span>
                </>
              )}
            </div>
          )}
        </>
      )}
      {/* Parental lock — sits above game content, below device-check overlays */}
      {activeLock && screenState === 'ok' && (
        <ParentalLock lockedUntil={lockedUntil} totalCooldownMs={COOLDOWN_MS} onUnlock={handleUnlock} />
      )}
      {screenState === 'portrait' && (
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
      {screenState === 'tooSmall' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'linear-gradient(135deg, #1a3a15, #0d1f0c)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '20px', color: 'white', textAlign: 'center',
          fontFamily: 'system-ui, sans-serif', padding: '24px',
        }}>
          <div style={{ fontSize: '3.5rem' }}>🦕😬🦖</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '1px', fontFamily: "'Fredoka One', cursive" }}>
            Screen too small!
          </div>
          <div style={{ fontSize: '0.95rem', opacity: 0.85, maxWidth: 320, lineHeight: 1.6, fontFamily: "'Nunito', sans-serif" }}>
            Dino Party Pad requires a screen of at least{' '}
            <strong style={{ color: '#FFD700' }}>{MIN_WIDTH} × {MIN_HEIGHT} pixels</strong> in landscape mode.
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.55, maxWidth: 300, fontFamily: "'Nunito', sans-serif" }}>
            Please use a tablet or larger device for the best dino experience! 🎮
          </div>
        </div>
      )}
    </div>
  );
}
