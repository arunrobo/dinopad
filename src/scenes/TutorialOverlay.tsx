import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/store';
import { audioManager } from '../engine/audioManager';
import { GAME_NAMES } from './games/types';

const TUTORIALS: Record<number, { hints: string[]; emoji: string }> = {
  0: { emoji: '🎲', hints: ['TAP to ROLL THE DICE!', 'Move your dino along the board!', 'Land on 🦶 trails to climb forward!', 'Watch out for mud pits!', 'HOLD for DINO ROAR — reroll once per game!', 'First to finish wins! 🏆'] },
  1: { emoji: '🦴', hints: ['A cursor highlights cards one by one.', 'TAP to select the highlighted card!', 'Match 2 fossils to score!', 'Matching lets you keep going!', 'Miss = turn passes.', 'HOLD to toggle cursor speed.'] },
  2: { emoji: '🌋', hints: ['TAP to roll dice and move safely.', 'HOLD for a RISKY roll — bonus but may stumble!', 'Land on 🥚 eggs or 🐉 pterodactyls for boosts!', 'Avoid 🌋 lava rocks!', 'First to summit wins!'] },
  3: { emoji: '🥚', hints: ['Work TOGETHER to rescue babies!', 'TAP to rescue the nearest baby!', 'HOLD for a SHIELD — pushes babies from hazards!', 'Babies drift toward dangers each round!', 'Save enough before rounds run out!'] },
};

export default function TutorialOverlay() {
  const { state, dispatch } = useStore();
  const [phase, setPhase] = useState<'hints' | 'countdown'>('hints');
  const [countdown, setCountdown] = useState(3);
  const [hintIdx, setHintIdx] = useState(0);
  const tut = TUTORIALS[state.selectedGame] || TUTORIALS[0];

  useEffect(() => {
    if (phase !== 'hints') return;
    const t = setInterval(() => {
      setHintIdx(prev => {
        if (prev >= tut.hints.length - 1) { clearInterval(t); setTimeout(() => setPhase('countdown'), 800); return prev; }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(t);
  }, [phase, tut.hints.length]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { dispatch({ type: 'SET_SCENE', scene: 'game' }); return; }
    audioManager.play('countdown');
    const t = setTimeout(() => setCountdown(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, dispatch]);

  const skip = useCallback(() => dispatch({ type: 'SET_SCENE', scene: 'game' }), [dispatch]);

  return (
    <div className="scene" onClick={phase === 'hints' ? skip : undefined} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'white', zIndex: 200, padding: '20px',
    }}>
      {phase === 'hints' && <>
        <div style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', marginBottom: '12px' }}>{tut.emoji}</div>
        <h2 style={{ fontSize: 'clamp(1.3rem, 4vw, 2rem)', color: '#FFD700', marginBottom: '24px' }}>{GAME_NAMES[state.selectedGame]}</h2>
        <div style={{ maxWidth: '500px', width: '100%' }}>
          {tut.hints.map((h, i) => (
            <div key={i} style={{
              padding: '12px 16px', marginBottom: '8px', borderRadius: '12px',
              background: i <= hintIdx ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.05)',
              fontSize: 'clamp(0.95rem, 2.5vw, 1.2rem)',
              opacity: i <= hintIdx ? 1 : 0.3, transition: 'all 0.3s ease',
              transform: i <= hintIdx ? 'translateX(0)' : 'translateX(20px)',
            }}>{i <= hintIdx ? '✅ ' : '⬜ '}{h}</div>
          ))}
        </div>
        <button onClick={skip} style={{ marginTop: '24px', padding: '10px 24px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', color: 'white', fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' }}>Skip → Start Now</button>
      </>}
      {phase === 'countdown' && (
        <div key={countdown} style={{
          fontSize: countdown > 0 ? 'clamp(5rem, 20vw, 12rem)' : 'clamp(3rem, 12vw, 6rem)',
          fontWeight: 900, color: countdown > 0 ? '#FFD700' : '#4CAF50',
          textShadow: '4px 4px 0 rgba(0,0,0,0.5)', animation: 'countdownPop 0.5s ease',
        }}>{countdown > 0 ? countdown : 'GO!'}</div>
      )}
    </div>
  );
}
